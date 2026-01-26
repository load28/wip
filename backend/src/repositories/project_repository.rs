use sqlx::SqlitePool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::project::{CreateProject, Project, UpdateProject};

pub struct ProjectRepository;

impl ProjectRepository {
    pub async fn create(pool: &SqlitePool, input: CreateProject) -> Result<Project, AppError> {
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        let project = sqlx::query_as::<_, Project>(
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
        .await?;

        Ok(project)
    }

    pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Project>, AppError> {
        let project = sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?;

        Ok(project)
    }

    pub async fn find_by_owner(
        pool: &SqlitePool,
        owner_id: &str,
    ) -> Result<Vec<Project>, AppError> {
        let projects = sqlx::query_as::<_, Project>(
            "SELECT * FROM projects WHERE owner_id = ? ORDER BY created_at DESC",
        )
        .bind(owner_id)
        .fetch_all(pool)
        .await?;

        Ok(projects)
    }

    pub async fn update(
        pool: &SqlitePool,
        id: &str,
        input: UpdateProject,
    ) -> Result<Project, AppError> {
        let now = chrono::Utc::now().to_rfc3339();
        let project = Self::find_by_id(pool, id)
            .await?
            .ok_or(AppError::NotFound)?;

        let name = input.name.unwrap_or(project.name);
        let description = input.description.or(project.description);

        let updated = sqlx::query_as::<_, Project>(
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
        .await?;

        Ok(updated)
    }

    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<bool, AppError> {
        let result = sqlx::query("DELETE FROM projects WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }
}
