# Phase 4: 프로젝트 관리 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 프로젝트 CRUD 기능 구현 - 백엔드 GraphQL API + 프론트엔드 UI

**Architecture:** 백엔드에서 Project 엔티티 및 GraphQL 스키마 구현, 프론트엔드에서 프로젝트 목록/생성/수정 UI 구현

**Tech Stack:** Rust + async-graphql, Next.js, MUI, Jotai, React Hook Form + Zod

---

## Task 1: 백엔드 - 프로젝트 모델 및 리포지토리

**Files:**
- Create: `backend/src/models/project.rs`
- Create: `backend/src/repositories/project_repository.rs`
- Modify: `backend/src/models/mod.rs`
- Modify: `backend/src/repositories/mod.rs`
- Modify: `backend/migrations/001_init.sql`

**Step 1: 마이그레이션 수정 (projects 테이블 추가)**

```sql
-- migrations/001_init.sql에 추가
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_projects_owner ON projects(owner_id);
```

**Step 2: 프로젝트 모델 구현**

```rust
// backend/src/models/project.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone)]
pub struct CreateProject {
    pub name: String,
    pub description: Option<String>,
    pub owner_id: String,
}

#[derive(Debug, Clone)]
pub struct UpdateProject {
    pub name: Option<String>,
    pub description: Option<String>,
}
```

**Step 3: 프로젝트 리포지토리 구현**

```rust
// backend/src/repositories/project_repository.rs
use sqlx::SqlitePool;
use uuid::Uuid;
use crate::error::AppError;
use crate::models::project::{CreateProject, Project, UpdateProject};

pub struct ProjectRepository;

impl ProjectRepository {
    pub async fn create(pool: &SqlitePool, input: CreateProject) -> Result<Project, AppError> {
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        sqlx::query_as::<_, Project>(
            r#"
            INSERT INTO projects (id, name, description, owner_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING *
            "#,
        )
        .bind(&id)
        .bind(&input.name)
        .bind(&input.description)
        .bind(&input.owner_id)
        .bind(&now)
        .bind(&now)
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))
    }

    pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Project>, AppError> {
        sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::Database(e.to_string()))
    }

    pub async fn find_by_owner(pool: &SqlitePool, owner_id: &str) -> Result<Vec<Project>, AppError> {
        sqlx::query_as::<_, Project>(
            "SELECT * FROM projects WHERE owner_id = ? ORDER BY created_at DESC"
        )
        .bind(owner_id)
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))
    }

    pub async fn update(pool: &SqlitePool, id: &str, input: UpdateProject) -> Result<Project, AppError> {
        let now = chrono::Utc::now().to_rfc3339();
        let project = Self::find_by_id(pool, id).await?.ok_or(AppError::NotFound)?;

        let name = input.name.unwrap_or(project.name);
        let description = input.description.or(project.description);

        sqlx::query_as::<_, Project>(
            r#"
            UPDATE projects SET name = ?, description = ?, updated_at = ?
            WHERE id = ?
            RETURNING *
            "#,
        )
        .bind(&name)
        .bind(&description)
        .bind(&now)
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))
    }

    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<bool, AppError> {
        let result = sqlx::query("DELETE FROM projects WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(result.rows_affected() > 0)
    }
}
```

**Step 4: mod.rs 업데이트**

**Step 5: cargo check 실행**

```bash
cd backend && cargo check
```

**Step 6: 커밋**

```bash
git add backend/
git commit -m "feat(backend): 프로젝트 모델 및 리포지토리 구현"
```

---

## Task 2: 백엔드 - 프로젝트 GraphQL 스키마

**Files:**
- Create: `backend/src/graphql/types/project.rs`
- Create: `backend/src/graphql/mutations/project.rs`
- Create: `backend/src/graphql/queries/project.rs`
- Modify: `backend/src/graphql/schema.rs`
- Modify: `backend/src/graphql/types/mod.rs`
- Modify: `backend/src/graphql/mutations/mod.rs`
- Modify: `backend/src/graphql/queries/mod.rs`

**Step 1: ProjectType 구현**

```rust
// backend/src/graphql/types/project.rs
use async_graphql::{ComplexObject, Context, Result, SimpleObject};
use crate::models::project::Project;
use crate::graphql::types::user::UserType;
use crate::repositories::user_repository::UserRepository;

#[derive(SimpleObject)]
#[graphql(complex)]
pub struct ProjectType {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: String,
    pub created_at: String,
    pub updated_at: String,
}

#[ComplexObject]
impl ProjectType {
    async fn owner(&self, ctx: &Context<'_>) -> Result<Option<UserType>> {
        let pool = ctx.data::<sqlx::SqlitePool>()?;
        let user = UserRepository::find_by_id(pool, &self.owner_id).await?;
        Ok(user.map(UserType::from))
    }
}

impl From<Project> for ProjectType {
    fn from(project: Project) -> Self {
        Self {
            id: project.id,
            name: project.name,
            description: project.description,
            owner_id: project.owner_id,
            created_at: project.created_at,
            updated_at: project.updated_at,
        }
    }
}
```

**Step 2: Project Mutations 구현**

```rust
// backend/src/graphql/mutations/project.rs
use async_graphql::{Context, InputObject, Object, Result};
use crate::graphql::types::project::ProjectType;
use crate::models::project::{CreateProject, UpdateProject};
use crate::repositories::project_repository::ProjectRepository;

#[derive(InputObject)]
pub struct CreateProjectInput {
    pub name: String,
    pub description: Option<String>,
}

#[derive(InputObject)]
pub struct UpdateProjectInput {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Default)]
pub struct ProjectMutation;

#[Object]
impl ProjectMutation {
    async fn create_project(
        &self,
        ctx: &Context<'_>,
        input: CreateProjectInput,
    ) -> Result<ProjectType> {
        let pool = ctx.data::<sqlx::SqlitePool>()?;
        let user_id = ctx.data::<Option<String>>()?.clone()
            .ok_or_else(|| async_graphql::Error::new("Unauthorized"))?;

        let project = ProjectRepository::create(
            pool,
            CreateProject {
                name: input.name,
                description: input.description,
                owner_id: user_id,
            },
        ).await?;

        Ok(ProjectType::from(project))
    }

    async fn update_project(
        &self,
        ctx: &Context<'_>,
        input: UpdateProjectInput,
    ) -> Result<ProjectType> {
        let pool = ctx.data::<sqlx::SqlitePool>()?;
        let user_id = ctx.data::<Option<String>>()?.clone()
            .ok_or_else(|| async_graphql::Error::new("Unauthorized"))?;

        let project = ProjectRepository::find_by_id(pool, &input.id).await?
            .ok_or_else(|| async_graphql::Error::new("Project not found"))?;

        if project.owner_id != user_id {
            return Err(async_graphql::Error::new("Forbidden"));
        }

        let updated = ProjectRepository::update(
            pool,
            &input.id,
            UpdateProject {
                name: input.name,
                description: input.description,
            },
        ).await?;

        Ok(ProjectType::from(updated))
    }

    async fn delete_project(&self, ctx: &Context<'_>, id: String) -> Result<bool> {
        let pool = ctx.data::<sqlx::SqlitePool>()?;
        let user_id = ctx.data::<Option<String>>()?.clone()
            .ok_or_else(|| async_graphql::Error::new("Unauthorized"))?;

        let project = ProjectRepository::find_by_id(pool, &id).await?
            .ok_or_else(|| async_graphql::Error::new("Project not found"))?;

        if project.owner_id != user_id {
            return Err(async_graphql::Error::new("Forbidden"));
        }

        ProjectRepository::delete(pool, &id).await?;
        Ok(true)
    }
}
```

**Step 3: Project Queries 구현**

```rust
// backend/src/graphql/queries/project.rs
use async_graphql::{Context, Object, Result};
use crate::graphql::types::project::ProjectType;
use crate::repositories::project_repository::ProjectRepository;

#[derive(Default)]
pub struct ProjectQuery;

#[Object]
impl ProjectQuery {
    async fn project(&self, ctx: &Context<'_>, id: String) -> Result<Option<ProjectType>> {
        let pool = ctx.data::<sqlx::SqlitePool>()?;
        let project = ProjectRepository::find_by_id(pool, &id).await?;
        Ok(project.map(ProjectType::from))
    }

    async fn my_projects(&self, ctx: &Context<'_>) -> Result<Vec<ProjectType>> {
        let pool = ctx.data::<sqlx::SqlitePool>()?;
        let user_id = ctx.data::<Option<String>>()?.clone()
            .ok_or_else(|| async_graphql::Error::new("Unauthorized"))?;

        let projects = ProjectRepository::find_by_owner(pool, &user_id).await?;
        Ok(projects.into_iter().map(ProjectType::from).collect())
    }
}
```

**Step 4: schema.rs에 통합**

**Step 5: cargo check 실행**

**Step 6: 커밋**

```bash
git add backend/
git commit -m "feat(backend): 프로젝트 GraphQL 스키마 구현 (CRUD)"
```

---

## Task 3: 프론트엔드 - 프로젝트 GraphQL API

**Files:**
- Create: `front/src/features/project/api/project.graphql.ts`
- Create: `front/src/features/project/model/useProjects.ts`
- Create: `front/src/features/project/model/useProjects.test.tsx`
- Create: `front/src/features/project/index.ts`

**Step 1: GraphQL 쿼리/뮤테이션 정의**

```typescript
// front/src/features/project/api/project.graphql.ts
export const MY_PROJECTS_QUERY = `
  query MyProjects {
    myProjects {
      id
      name
      description
      createdAt
      updatedAt
    }
  }
`;

export const PROJECT_QUERY = `
  query Project($id: String!) {
    project(id: $id) {
      id
      name
      description
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_PROJECT_MUTATION = `
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      id
      name
      description
    }
  }
`;

export const UPDATE_PROJECT_MUTATION = `
  mutation UpdateProject($input: UpdateProjectInput!) {
    updateProject(input: $input) {
      id
      name
      description
    }
  }
`;

export const DELETE_PROJECT_MUTATION = `
  mutation DeleteProject($id: String!) {
    deleteProject(id: $id)
  }
`;
```

**Step 2: useProjects 훅 구현**

**Step 3: 테스트 작성**

**Step 4: 커밋**

---

## Task 4: 프론트엔드 - 프로젝트 목록 페이지

**Files:**
- Create: `front/src/app/projects/page.tsx`
- Create: `front/src/app/projects/page.test.tsx`
- Create: `front/src/app/projects/layout.tsx`

**Step 1: 테스트 작성**

**Step 2: 프로젝트 목록 페이지 구현**

**Step 3: 커밋**

---

## Task 5: 프론트엔드 - 프로젝트 생성 모달

**Files:**
- Create: `front/src/features/project/ui/CreateProjectModal.tsx`
- Create: `front/src/features/project/ui/CreateProjectModal.test.tsx`
- Create: `front/src/features/project/model/schema.ts`

**Step 1: Zod 스키마 정의**

```typescript
// front/src/features/project/model/schema.ts
import { z } from 'zod';
import i18n from '@/shared/lib/i18n';

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, { message: i18n.t('project.form.nameRequired') })
    .max(100, { message: i18n.t('project.form.nameMaxLength') }),
  description: z
    .string()
    .max(500, { message: i18n.t('project.form.descriptionMaxLength') })
    .optional(),
});

export type CreateProjectFormData = z.infer<typeof createProjectSchema>;
```

**Step 2: 모달 구현 (React Hook Form + MUI)**

**Step 3: 테스트 작성**

**Step 4: 커밋**

---

## Task 6: 프론트엔드 - 프로젝트 카드 컴포넌트

**Files:**
- Create: `front/src/entities/project/ui/ProjectCard.tsx`
- Create: `front/src/entities/project/ui/ProjectCard.test.tsx`
- Create: `front/src/entities/project/index.ts`

**Step 1: 프로젝트 카드 구현**

**Step 2: 테스트 작성**

**Step 3: 커밋**

---

## Task 7: i18n 번역 키 추가

**Files:**
- Modify: `front/src/shared/lib/i18n/locales/ko.json`
- Modify: `front/src/shared/lib/i18n/locales/en.json`

**Step 1: 프로젝트 관련 번역 추가**

**Step 2: 커밋**

---

## Task 8: 전체 테스트 및 검증

**Step 1: 전체 프론트엔드 테스트 실행**

```bash
cd front && bun run vitest run
```

**Step 2: 백엔드 빌드 확인**

```bash
cd backend && cargo check
```

**Step 3: 검증 리포트 작성**

---

## 검증 체크리스트

| 항목 | 설계 규칙 | 확인 |
|------|----------|:----:|
| FSD 레이어 | features/project, entities/project | |
| 상태 관리 | features/project/model/ | |
| 폼 관리 | React Hook Form + Zod | |
| 테스트 | TDD, 한글 명세 | |
| i18n | 번역 키 규칙 준수 | |
| GraphQL | 모든 통신 GraphQL | |
