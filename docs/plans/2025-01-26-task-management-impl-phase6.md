# Phase 6: 태스크 관리 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 태스크 CRUD 기능 구현 - 백엔드 모델/API + 프론트엔드 UI

**Architecture:** FSD 구조에 따라 entities/task, features/task, 백엔드 GraphQL 스키마

**Tech Stack:** Rust + async-graphql, Next.js, MUI, Jotai, react-i18next

---

## Task 1: 백엔드 태스크 모델 및 레포지토리

**Files:**
- Modify: `backend/migrations/001_init.sql`
- Create: `backend/src/models/task.rs`
- Create: `backend/src/repositories/task_repository.rs`
- Modify: `backend/src/models/mod.rs`
- Modify: `backend/src/repositories/mod.rs`

**Step 1: tasks 테이블 마이그레이션 추가**

```sql
-- backend/migrations/001_init.sql (추가)
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'TODO',
    priority TEXT NOT NULL DEFAULT 'MEDIUM',
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    due_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
```

**Step 2: Task 모델 구현**

```rust
// backend/src/models/task.rs
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub project_id: String,
    pub assignee_id: Option<String>,
    pub parent_id: Option<String>,
    pub due_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateTaskInput {
    pub title: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub project_id: String,
    pub assignee_id: Option<String>,
    pub parent_id: Option<String>,
    pub due_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTaskInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub assignee_id: Option<String>,
    pub parent_id: Option<String>,
    pub due_date: Option<String>,
}
```

**Step 3: Task 레포지토리 구현**

```rust
// backend/src/repositories/task_repository.rs
use crate::error::{AppError, Result};
use crate::models::task::{CreateTaskInput, Task, UpdateTaskInput};
use sqlx::SqlitePool;
use uuid::Uuid;

pub struct TaskRepository;

impl TaskRepository {
    pub async fn create(pool: &SqlitePool, input: CreateTaskInput) -> Result<Task> {
        let id = Uuid::new_v4().to_string();
        let status = input.status.unwrap_or_else(|| "TODO".to_string());
        let priority = input.priority.unwrap_or_else(|| "MEDIUM".to_string());

        sqlx::query_as::<_, Task>(
            r#"
            INSERT INTO tasks (id, title, description, status, priority, project_id, assignee_id, parent_id, due_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *
            "#,
        )
        .bind(&id)
        .bind(&input.title)
        .bind(&input.description)
        .bind(&status)
        .bind(&priority)
        .bind(&input.project_id)
        .bind(&input.assignee_id)
        .bind(&input.parent_id)
        .bind(&input.due_date)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)
    }

    pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Task>> {
        sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)
    }

    pub async fn find_by_project(pool: &SqlitePool, project_id: &str) -> Result<Vec<Task>> {
        sqlx::query_as::<_, Task>(
            "SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC",
        )
        .bind(project_id)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)
    }

    pub async fn find_by_assignee(pool: &SqlitePool, assignee_id: &str) -> Result<Vec<Task>> {
        sqlx::query_as::<_, Task>(
            "SELECT * FROM tasks WHERE assignee_id = ? ORDER BY created_at DESC",
        )
        .bind(assignee_id)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)
    }

    pub async fn find_subtasks(pool: &SqlitePool, parent_id: &str) -> Result<Vec<Task>> {
        sqlx::query_as::<_, Task>(
            "SELECT * FROM tasks WHERE parent_id = ? ORDER BY created_at ASC",
        )
        .bind(parent_id)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)
    }

    pub async fn update(pool: &SqlitePool, id: &str, input: UpdateTaskInput) -> Result<Task> {
        let task = Self::find_by_id(pool, id).await?;
        let task = task.ok_or(AppError::NotFound)?;

        let title = input.title.unwrap_or(task.title);
        let description = input.description.or(task.description);
        let status = input.status.unwrap_or(task.status);
        let priority = input.priority.unwrap_or(task.priority);
        let assignee_id = input.assignee_id.or(task.assignee_id);
        let parent_id = input.parent_id.or(task.parent_id);
        let due_date = input.due_date.or(task.due_date);

        sqlx::query_as::<_, Task>(
            r#"
            UPDATE tasks
            SET title = ?, description = ?, status = ?, priority = ?,
                assignee_id = ?, parent_id = ?, due_date = ?, updated_at = datetime('now')
            WHERE id = ?
            RETURNING *
            "#,
        )
        .bind(&title)
        .bind(&description)
        .bind(&status)
        .bind(&priority)
        .bind(&assignee_id)
        .bind(&parent_id)
        .bind(&due_date)
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)
    }

    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<bool> {
        let result = sqlx::query("DELETE FROM tasks WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;

        Ok(result.rows_affected() > 0)
    }
}
```

**Step 4: 모듈 등록**

**Step 5: cargo check 실행**

**Step 6: 커밋**

---

## Task 2: 백엔드 태스크 GraphQL 스키마

**Files:**
- Create: `backend/src/graphql/types/task.rs`
- Create: `backend/src/graphql/mutations/task.rs`
- Create: `backend/src/graphql/queries/task.rs`
- Modify: `backend/src/graphql/types/mod.rs`
- Modify: `backend/src/graphql/mutations/mod.rs`
- Modify: `backend/src/graphql/queries/mod.rs`
- Modify: `backend/src/graphql/schema.rs`

**Step 1: TaskType 구현**

```rust
// backend/src/graphql/types/task.rs
use async_graphql::{ComplexObject, Context, Result, SimpleObject};
use crate::db::Database;
use crate::models::task::Task;
use crate::repositories::{TaskRepository, UserRepository, ProjectRepository};
use super::user::UserType;
use super::project::ProjectType;

#[derive(SimpleObject)]
#[graphql(complex)]
pub struct TaskType {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub project_id: String,
    pub assignee_id: Option<String>,
    pub parent_id: Option<String>,
    pub due_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[ComplexObject]
impl TaskType {
    async fn project(&self, ctx: &Context<'_>) -> Result<Option<ProjectType>> {
        let db = ctx.data::<Database>()?;
        let project = ProjectRepository::find_by_id(&db.pool, &self.project_id).await?;
        Ok(project.map(|p| p.into()))
    }

    async fn assignee(&self, ctx: &Context<'_>) -> Result<Option<UserType>> {
        if let Some(assignee_id) = &self.assignee_id {
            let db = ctx.data::<Database>()?;
            let user = UserRepository::find_by_id(&db.pool, assignee_id).await?;
            Ok(user.map(|u| u.into()))
        } else {
            Ok(None)
        }
    }

    async fn parent(&self, ctx: &Context<'_>) -> Result<Option<TaskType>> {
        if let Some(parent_id) = &self.parent_id {
            let db = ctx.data::<Database>()?;
            let task = TaskRepository::find_by_id(&db.pool, parent_id).await?;
            Ok(task.map(|t| t.into()))
        } else {
            Ok(None)
        }
    }

    async fn subtasks(&self, ctx: &Context<'_>) -> Result<Vec<TaskType>> {
        let db = ctx.data::<Database>()?;
        let tasks = TaskRepository::find_subtasks(&db.pool, &self.id).await?;
        Ok(tasks.into_iter().map(|t| t.into()).collect())
    }
}

impl From<Task> for TaskType {
    fn from(task: Task) -> Self {
        Self {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            project_id: task.project_id,
            assignee_id: task.assignee_id,
            parent_id: task.parent_id,
            due_date: task.due_date,
            created_at: task.created_at,
            updated_at: task.updated_at,
        }
    }
}
```

**Step 2: Task Mutations 구현**

```rust
// backend/src/graphql/mutations/task.rs
use async_graphql::{Context, InputObject, Object, Result};
use crate::db::Database;
use crate::graphql::types::task::TaskType;
use crate::models::task::{CreateTaskInput, UpdateTaskInput};
use crate::repositories::TaskRepository;

#[derive(InputObject)]
pub struct CreateTaskGqlInput {
    pub title: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub project_id: String,
    pub assignee_id: Option<String>,
    pub parent_id: Option<String>,
    pub due_date: Option<String>,
}

#[derive(InputObject)]
pub struct UpdateTaskGqlInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub assignee_id: Option<String>,
    pub parent_id: Option<String>,
    pub due_date: Option<String>,
}

#[derive(Default)]
pub struct TaskMutation;

#[Object]
impl TaskMutation {
    async fn create_task(&self, ctx: &Context<'_>, input: CreateTaskGqlInput) -> Result<TaskType> {
        let db = ctx.data::<Database>()?;

        let create_input = CreateTaskInput {
            title: input.title,
            description: input.description,
            status: input.status,
            priority: input.priority,
            project_id: input.project_id,
            assignee_id: input.assignee_id,
            parent_id: input.parent_id,
            due_date: input.due_date,
        };

        let task = TaskRepository::create(&db.pool, create_input).await?;
        Ok(task.into())
    }

    async fn update_task(
        &self,
        ctx: &Context<'_>,
        id: String,
        input: UpdateTaskGqlInput,
    ) -> Result<TaskType> {
        let db = ctx.data::<Database>()?;

        let update_input = UpdateTaskInput {
            title: input.title,
            description: input.description,
            status: input.status,
            priority: input.priority,
            assignee_id: input.assignee_id,
            parent_id: input.parent_id,
            due_date: input.due_date,
        };

        let task = TaskRepository::update(&db.pool, &id, update_input).await?;
        Ok(task.into())
    }

    async fn delete_task(&self, ctx: &Context<'_>, id: String) -> Result<bool> {
        let db = ctx.data::<Database>()?;
        let deleted = TaskRepository::delete(&db.pool, &id).await?;
        Ok(deleted)
    }
}
```

**Step 3: Task Queries 구현**

```rust
// backend/src/graphql/queries/task.rs
use async_graphql::{Context, Object, Result};
use crate::db::Database;
use crate::graphql::types::task::TaskType;
use crate::repositories::TaskRepository;

#[derive(Default)]
pub struct TaskQuery;

#[Object]
impl TaskQuery {
    async fn task(&self, ctx: &Context<'_>, id: String) -> Result<Option<TaskType>> {
        let db = ctx.data::<Database>()?;
        let task = TaskRepository::find_by_id(&db.pool, &id).await?;
        Ok(task.map(|t| t.into()))
    }

    async fn tasks_by_project(
        &self,
        ctx: &Context<'_>,
        project_id: String,
    ) -> Result<Vec<TaskType>> {
        let db = ctx.data::<Database>()?;
        let tasks = TaskRepository::find_by_project(&db.pool, &project_id).await?;
        Ok(tasks.into_iter().map(|t| t.into()).collect())
    }

    async fn my_tasks(&self, ctx: &Context<'_>) -> Result<Vec<TaskType>> {
        let db = ctx.data::<Database>()?;
        // TODO: Get user from context when auth is implemented
        let user_id = "current_user_id";
        let tasks = TaskRepository::find_by_assignee(&db.pool, user_id).await?;
        Ok(tasks.into_iter().map(|t| t.into()).collect())
    }
}
```

**Step 4: 스키마 통합**

**Step 5: cargo check 실행**

**Step 6: 커밋**

---

## Task 3: 프론트엔드 태스크 API 및 훅

**Files:**
- Create: `front/src/features/task/api/task.graphql.ts`
- Create: `front/src/features/task/model/useTasks.ts`
- Create: `front/src/features/task/model/useTasks.test.tsx`
- Create: `front/src/features/task/index.ts`

**Step 1: 테스트 작성**

```typescript
// front/src/features/task/model/useTasks.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { useTasks } from './useTasks';

vi.mock('../api/task.graphql', () => ({
  fetchTasksByProject: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

import { fetchTasksByProject, createTask } from '../api/task.graphql';

describe('useTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('프로젝트별 태스크를 조회한다', async () => {
    const mockTasks = [
      { id: '1', title: '태스크 1', status: 'TODO', priority: 'MEDIUM' },
      { id: '2', title: '태스크 2', status: 'IN_PROGRESS', priority: 'HIGH' },
    ];
    (fetchTasksByProject as any).mockResolvedValue(mockTasks);

    const store = createStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { result } = renderHook(() => useTasks('project-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.tasks).toEqual(mockTasks);
    });
  });

  it('새 태스크를 생성한다', async () => {
    const newTask = { id: '3', title: '새 태스크', status: 'TODO', priority: 'LOW' };
    (fetchTasksByProject as any).mockResolvedValue([]);
    (createTask as any).mockResolvedValue(newTask);

    const store = createStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { result } = renderHook(() => useTasks('project-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.createTask({
      title: '새 태스크',
      projectId: 'project-1',
    });

    expect(createTask).toHaveBeenCalledWith({
      title: '새 태스크',
      projectId: 'project-1',
    });
  });

  it('태스크 상태를 업데이트한다', async () => {
    const mockTasks = [{ id: '1', title: '태스크', status: 'TODO', priority: 'MEDIUM' }];
    (fetchTasksByProject as any).mockResolvedValue(mockTasks);

    const store = createStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { result } = renderHook(() => useTasks('project-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(1);
    });
  });
});
```

**Step 2: GraphQL API 구현**

```typescript
// front/src/features/task/api/task.graphql.ts
import { graphqlClient } from '@/shared/api/graphql-client';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  projectId: string;
  assigneeId?: string;
  parentId?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  projectId: string;
  assigneeId?: string;
  parentId?: string;
  dueDate?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  parentId?: string;
  dueDate?: string;
}

export async function fetchTasksByProject(projectId: string): Promise<Task[]> {
  const query = `
    query TasksByProject($projectId: String!) {
      tasksByProject(projectId: $projectId) {
        id
        title
        description
        status
        priority
        projectId
        assigneeId
        parentId
        dueDate
        createdAt
        updatedAt
      }
    }
  `;

  const data = await graphqlClient.request<{ tasksByProject: Task[] }>(query, {
    projectId,
  });
  return data.tasksByProject;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const mutation = `
    mutation CreateTask($input: CreateTaskGqlInput!) {
      createTask(input: $input) {
        id
        title
        description
        status
        priority
        projectId
        assigneeId
        parentId
        dueDate
        createdAt
        updatedAt
      }
    }
  `;

  const data = await graphqlClient.request<{ createTask: Task }>(mutation, {
    input,
  });
  return data.createTask;
}

export async function updateTask(
  id: string,
  input: UpdateTaskInput
): Promise<Task> {
  const mutation = `
    mutation UpdateTask($id: String!, $input: UpdateTaskGqlInput!) {
      updateTask(id: $id, input: $input) {
        id
        title
        description
        status
        priority
        projectId
        assigneeId
        parentId
        dueDate
        createdAt
        updatedAt
      }
    }
  `;

  const data = await graphqlClient.request<{ updateTask: Task }>(mutation, {
    id,
    input,
  });
  return data.updateTask;
}

export async function deleteTask(id: string): Promise<boolean> {
  const mutation = `
    mutation DeleteTask($id: String!) {
      deleteTask(id: $id)
    }
  `;

  const data = await graphqlClient.request<{ deleteTask: boolean }>(mutation, {
    id,
  });
  return data.deleteTask;
}
```

**Step 3: useTasks 훅 구현**

```typescript
// front/src/features/task/model/useTasks.ts
import { useState, useEffect, useCallback } from 'react';
import {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  fetchTasksByProject,
  createTask as createTaskApi,
  updateTask as updateTaskApi,
  deleteTask as deleteTaskApi,
} from '../api/task.graphql';

export function useTasks(projectId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchTasksByProject(projectId);
      setTasks(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const createTask = useCallback(
    async (input: CreateTaskInput) => {
      const newTask = await createTaskApi(input);
      setTasks((prev) => [newTask, ...prev]);
      return newTask;
    },
    []
  );

  const updateTask = useCallback(async (id: string, input: UpdateTaskInput) => {
    const updated = await updateTaskApi(id, input);
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    await deleteTaskApi(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const tasksByStatus = {
    TODO: tasks.filter((t) => t.status === 'TODO'),
    IN_PROGRESS: tasks.filter((t) => t.status === 'IN_PROGRESS'),
    DONE: tasks.filter((t) => t.status === 'DONE'),
  };

  return {
    tasks,
    tasksByStatus,
    isLoading,
    error,
    createTask,
    updateTask,
    deleteTask,
    refetch: loadTasks,
  };
}
```

**Step 4: 모듈 export**

```typescript
// front/src/features/task/index.ts
export { useTasks } from './model/useTasks';
export type { Task, CreateTaskInput, UpdateTaskInput } from './api/task.graphql';
```

**Step 5: 테스트 실행**

**Step 6: 커밋**

---

## Task 4: 태스크 카드 컴포넌트

**Files:**
- Create: `front/src/entities/task/ui/TaskCard.tsx`
- Create: `front/src/entities/task/ui/TaskCard.test.tsx`
- Create: `front/src/entities/task/ui/index.ts`
- Create: `front/src/entities/task/index.ts`

**Step 1: 테스트 작성**

```typescript
// front/src/entities/task/ui/TaskCard.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'task.card.dueDate': '마감일',
        'task.priority.low': '낮음',
        'task.priority.medium': '보통',
        'task.priority.high': '높음',
      };
      return translations[key] || key;
    },
  }),
}));

import { TaskCard } from './TaskCard';

describe('TaskCard', () => {
  const mockTask = {
    id: '1',
    title: '테스트 태스크',
    description: '태스크 설명',
    status: 'TODO' as const,
    priority: 'HIGH' as const,
    projectId: 'project-1',
    createdAt: '2025-01-26T00:00:00Z',
    updatedAt: '2025-01-26T00:00:00Z',
  };

  it('태스크 제목이 표시된다', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('테스트 태스크')).toBeInTheDocument();
  });

  it('우선순위 배지가 표시된다', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('높음')).toBeInTheDocument();
  });
});
```

**Step 2: TaskCard 구현**

```typescript
// front/src/entities/task/ui/TaskCard.tsx
'use client';

import { useTranslation } from 'react-i18next';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import type { Task } from '@/features/task';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
}

const priorityColors = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'error',
} as const;

export function TaskCard({ task, onClick }: TaskCardProps) {
  const { t } = useTranslation();

  return (
    <Card
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { boxShadow: 3 } : undefined,
      }}
      onClick={onClick}
    >
      <CardContent>
        <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
          {task.title}
        </Typography>
        {task.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {task.description}
          </Typography>
        )}
        <Box mt={2} display="flex" gap={1} flexWrap="wrap">
          <Chip
            label={t(`task.priority.${task.priority.toLowerCase()}`)}
            size="small"
            color={priorityColors[task.priority]}
          />
          {task.dueDate && (
            <Chip
              label={`${t('task.card.dueDate')}: ${new Date(task.dueDate).toLocaleDateString()}`}
              size="small"
              variant="outlined"
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
```

**Step 3: 모듈 export**

**Step 4: 테스트 실행**

**Step 5: 커밋**

---

## Task 5: 태스크 생성 모달

**Files:**
- Create: `front/src/features/task/ui/CreateTaskModal.tsx`
- Create: `front/src/features/task/ui/CreateTaskModal.test.tsx`
- Modify: `front/src/features/task/index.ts`

**Step 1: 테스트 작성**

```typescript
// front/src/features/task/ui/CreateTaskModal.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'task.form.title': '제목',
        'task.form.titleRequired': '제목을 입력해주세요',
        'task.form.description': '설명',
        'task.form.submit': '생성',
        'task.form.cancel': '취소',
      };
      return translations[key] || key;
    },
  }),
}));

import { CreateTaskModal } from './CreateTaskModal';

describe('CreateTaskModal', () => {
  const defaultProps = {
    open: true,
    projectId: 'project-1',
    onClose: vi.fn(),
    onSubmit: vi.fn(),
  };

  it('모달이 열리면 제목 입력 필드가 표시된다', () => {
    render(<CreateTaskModal {...defaultProps} />);
    expect(screen.getByLabelText('제목')).toBeInTheDocument();
  });

  it('제목 없이 제출하면 에러가 표시된다', async () => {
    render(<CreateTaskModal {...defaultProps} />);

    fireEvent.click(screen.getByText('생성'));

    expect(await screen.findByText('제목을 입력해주세요')).toBeInTheDocument();
  });
});
```

**Step 2: CreateTaskModal 구현**

```typescript
// front/src/features/task/ui/CreateTaskModal.tsx
'use client';

import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import type { CreateTaskInput } from '../api/task.graphql';

interface CreateTaskModalProps {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onSubmit: (data: CreateTaskInput) => Promise<void>;
}

const createTaskSchema = z.object({
  title: z.string().min(1, 'task.form.titleRequired').max(100, 'task.form.titleMaxLength'),
  description: z.string().max(1000, 'task.form.descriptionMaxLength').optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).default('TODO'),
});

type FormData = z.infer<typeof createTaskSchema>;

export function CreateTaskModal({
  open,
  projectId,
  onClose,
  onSubmit,
}: CreateTaskModalProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      priority: 'MEDIUM',
      status: 'TODO',
    },
  });

  const handleFormSubmit = async (data: FormData) => {
    await onSubmit({
      ...data,
      projectId,
    });
    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogTitle>{t('task.form.createTitle') || '태스크 생성'}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              {...register('title')}
              label={t('task.form.title')}
              fullWidth
              error={!!errors.title}
              helperText={errors.title && t(errors.title.message as string)}
            />
            <TextField
              {...register('description')}
              label={t('task.form.description')}
              fullWidth
              multiline
              rows={3}
              error={!!errors.description}
              helperText={
                errors.description && t(errors.description.message as string)
              }
            />
            <FormControl fullWidth>
              <InputLabel>{t('task.card.priority')}</InputLabel>
              <Select
                value={watch('priority')}
                label={t('task.card.priority')}
                onChange={(e) =>
                  setValue('priority', e.target.value as 'LOW' | 'MEDIUM' | 'HIGH')
                }
              >
                <MenuItem value="LOW">{t('task.priority.low')}</MenuItem>
                <MenuItem value="MEDIUM">{t('task.priority.medium')}</MenuItem>
                <MenuItem value="HIGH">{t('task.priority.high')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{t('task.form.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {t('task.form.submit')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
```

**Step 3: i18n 번역 추가**

ko.json에 추가:
```json
"task": {
  "form": {
    "createTitle": "새 태스크 생성",
    ...
  }
}
```

**Step 4: 모듈 export 업데이트**

**Step 5: 테스트 실행**

**Step 6: 커밋**

---

## Task 6: 프로젝트 상세 페이지 (태스크 목록)

**Files:**
- Create: `front/src/app/projects/[id]/page.tsx`
- Create: `front/src/app/projects/[id]/page.test.tsx`
- Create: `front/src/app/projects/[id]/layout.tsx`

**Step 1: 테스트 작성**

```typescript
// front/src/app/projects/[id]/page.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: 'project-1' }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'task.status.todo': '할 일',
        'task.status.inProgress': '진행 중',
        'task.status.done': '완료',
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock('@/features/task', () => ({
  useTasks: () => ({
    tasks: [],
    tasksByStatus: { TODO: [], IN_PROGRESS: [], DONE: [] },
    isLoading: false,
    error: null,
    createTask: vi.fn(),
  }),
}));

vi.mock('@/features/project', () => ({
  useProjects: () => ({
    projects: [{ id: 'project-1', name: '테스트 프로젝트' }],
    isLoading: false,
  }),
}));

import ProjectDetailPage from './page';

describe('ProjectDetailPage', () => {
  it('칸반 보드 컬럼이 표시된다', () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <ProjectDetailPage />
      </Provider>
    );

    expect(screen.getByText('할 일')).toBeInTheDocument();
    expect(screen.getByText('진행 중')).toBeInTheDocument();
    expect(screen.getByText('완료')).toBeInTheDocument();
  });
});
```

**Step 2: 프로젝트 상세 페이지 구현**

```typescript
// front/src/app/projects/[id]/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import AddIcon from '@mui/icons-material/Add';
import { useTasks, CreateTaskModal } from '@/features/task';
import { useProjects } from '@/features/project';
import { TaskCard } from '@/entities/task';

const COLUMNS = ['TODO', 'IN_PROGRESS', 'DONE'] as const;

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { projects } = useProjects();
  const { tasksByStatus, createTask, isLoading } = useTasks(id);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const project = projects.find((p) => p.id === id);

  const handleCreateTask = async (data: Parameters<typeof createTask>[0]) => {
    await createTask(data);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          {project?.name || t('common.loading')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateModalOpen(true)}
        >
          {t('task.form.createTitle') || '새 태스크'}
        </Button>
      </Box>

      <Box display="flex" gap={2} sx={{ overflowX: 'auto', pb: 2 }}>
        {COLUMNS.map((status) => (
          <Paper
            key={status}
            sx={{
              minWidth: 300,
              p: 2,
              backgroundColor: 'grey.100',
              flex: '1 1 0',
            }}
          >
            <Typography variant="h6" fontWeight="medium" mb={2}>
              {t(`task.status.${status.toLowerCase().replace('_', '')}`)}
              <Typography component="span" color="text.secondary" ml={1}>
                ({tasksByStatus[status]?.length || 0})
              </Typography>
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              {tasksByStatus[status]?.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </Box>
          </Paper>
        ))}
      </Box>

      <CreateTaskModal
        open={createModalOpen}
        projectId={id}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateTask}
      />
    </Box>
  );
}
```

**Step 3: 레이아웃 구현**

```typescript
// front/src/app/projects/[id]/layout.tsx
'use client';

import { ReactNode } from 'react';
import { AuthGuard } from '@/features/auth';
import { AppLayout } from '@/widgets/layout';

interface ProjectDetailLayoutProps {
  children: ReactNode;
}

export default function ProjectDetailLayout({ children }: ProjectDetailLayoutProps) {
  return (
    <AuthGuard>
      <AppLayout>{children}</AppLayout>
    </AuthGuard>
  );
}
```

**Step 4: 테스트 실행**

**Step 5: 커밋**

---

## Task 7: 전체 테스트 및 검증

**Step 1: 전체 프론트엔드 테스트 실행**

```bash
cd front && bun run vitest run
```

**Step 2: 백엔드 빌드 확인**

```bash
cd backend && cargo check
```

---

## 검증 체크리스트

| 항목 | 설계 규칙 | 확인 |
|------|----------|:----:|
| FSD 레이어 | entities/task, features/task | |
| 백엔드 모델 | Task CRUD | |
| GraphQL | Query, Mutation | |
| 상태 관리 | useTasks 훅 | |
| i18n | 태스크 관련 번역 | |
| 테스트 | TDD, 한글 명세 | |
