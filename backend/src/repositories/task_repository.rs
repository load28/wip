use sqlx::SqlitePool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::task::{CreateTaskInput, Task, UpdateTaskInput};

pub struct TaskRepository;

impl TaskRepository {
    pub async fn create(pool: &SqlitePool, input: CreateTaskInput) -> Result<Task, AppError> {
        let id = Uuid::new_v4().to_string();
        let status = input.status.unwrap_or_else(|| "TODO".to_string());
        let priority = input.priority.unwrap_or_else(|| "MEDIUM".to_string());

        let task = sqlx::query_as::<_, Task>(
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
        .await?;

        Ok(task)
    }

    pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Task>, AppError> {
        let task = sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?;

        Ok(task)
    }

    pub async fn find_by_project(
        pool: &SqlitePool,
        project_id: &str,
    ) -> Result<Vec<Task>, AppError> {
        let tasks = sqlx::query_as::<_, Task>(
            "SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC",
        )
        .bind(project_id)
        .fetch_all(pool)
        .await?;

        Ok(tasks)
    }

    pub async fn find_by_assignee(
        pool: &SqlitePool,
        assignee_id: &str,
    ) -> Result<Vec<Task>, AppError> {
        let tasks = sqlx::query_as::<_, Task>(
            "SELECT * FROM tasks WHERE assignee_id = ? ORDER BY created_at DESC",
        )
        .bind(assignee_id)
        .fetch_all(pool)
        .await?;

        Ok(tasks)
    }

    pub async fn find_subtasks(pool: &SqlitePool, parent_id: &str) -> Result<Vec<Task>, AppError> {
        let tasks = sqlx::query_as::<_, Task>(
            "SELECT * FROM tasks WHERE parent_id = ? ORDER BY created_at ASC",
        )
        .bind(parent_id)
        .fetch_all(pool)
        .await?;

        Ok(tasks)
    }

    pub async fn update(
        pool: &SqlitePool,
        id: &str,
        input: UpdateTaskInput,
    ) -> Result<Task, AppError> {
        let task = Self::find_by_id(pool, id)
            .await?
            .ok_or(AppError::NotFound)?;

        let title = input.title.unwrap_or(task.title);
        let description = input.description.or(task.description);
        let status = input.status.unwrap_or(task.status);
        let priority = input.priority.unwrap_or(task.priority);
        let assignee_id = input.assignee_id.or(task.assignee_id);
        let parent_id = input.parent_id.or(task.parent_id);
        let due_date = input.due_date.or(task.due_date);

        let updated = sqlx::query_as::<_, Task>(
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
        .await?;

        Ok(updated)
    }

    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<bool, AppError> {
        let result = sqlx::query("DELETE FROM tasks WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }
}
