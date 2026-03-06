use sqlx::SqlitePool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::user::{CreateUser, User};

pub struct UserRepository;

impl UserRepository {
    pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<User>, AppError> {
        let user = sqlx::query_as::<_, User>(
            "SELECT id, email, name, avatar_url, google_id, created_at, updated_at
             FROM users WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        Ok(user)
    }

    pub async fn find_by_email(pool: &SqlitePool, email: &str) -> Result<Option<User>, AppError> {
        let user = sqlx::query_as::<_, User>(
            "SELECT id, email, name, avatar_url, google_id, created_at, updated_at
             FROM users WHERE email = ?",
        )
        .bind(email)
        .fetch_optional(pool)
        .await?;

        Ok(user)
    }

    pub async fn find_by_google_id(
        pool: &SqlitePool,
        google_id: &str,
    ) -> Result<Option<User>, AppError> {
        let user = sqlx::query_as::<_, User>(
            "SELECT id, email, name, avatar_url, google_id, created_at, updated_at
             FROM users WHERE google_id = ?",
        )
        .bind(google_id)
        .fetch_optional(pool)
        .await?;

        Ok(user)
    }

    pub async fn create(pool: &SqlitePool, data: CreateUser) -> Result<User, AppError> {
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        sqlx::query(
            "INSERT INTO users (id, email, name, avatar_url, google_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&data.email)
        .bind(&data.name)
        .bind(&data.avatar_url)
        .bind(&data.google_id)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(User {
            id,
            email: data.email,
            name: data.name,
            avatar_url: data.avatar_url,
            google_id: data.google_id,
            created_at: now.clone(),
            updated_at: now,
        })
    }

    pub async fn update(
        pool: &SqlitePool,
        id: &str,
        name: &str,
        avatar_url: Option<&str>,
    ) -> Result<(), AppError> {
        let now = chrono::Utc::now().to_rfc3339();

        sqlx::query("UPDATE users SET name = ?, avatar_url = ?, updated_at = ? WHERE id = ?")
            .bind(name)
            .bind(avatar_url)
            .bind(&now)
            .bind(id)
            .execute(pool)
            .await?;

        Ok(())
    }
}
