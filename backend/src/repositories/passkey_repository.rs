use sqlx::SqlitePool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::passkey::PasskeyCredential;

pub struct PasskeyRepository;

impl PasskeyRepository {
    pub async fn create(
        pool: &SqlitePool,
        user_id: &str,
        credential_json: &str,
        name: &str,
    ) -> Result<PasskeyCredential, AppError> {
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        sqlx::query(
            "INSERT INTO passkey_credentials (id, user_id, credential_json, name, created_at)
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(user_id)
        .bind(credential_json)
        .bind(name)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(PasskeyCredential {
            id,
            user_id: user_id.to_string(),
            credential_json: credential_json.to_string(),
            name: name.to_string(),
            created_at: now,
            last_used_at: None,
        })
    }

    pub async fn find_by_user_id(
        pool: &SqlitePool,
        user_id: &str,
    ) -> Result<Vec<PasskeyCredential>, AppError> {
        let credentials = sqlx::query_as::<_, PasskeyCredential>(
            "SELECT id, user_id, credential_json, name, created_at, last_used_at
             FROM passkey_credentials WHERE user_id = ?",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;

        Ok(credentials)
    }

    pub async fn find_all(pool: &SqlitePool) -> Result<Vec<PasskeyCredential>, AppError> {
        let credentials = sqlx::query_as::<_, PasskeyCredential>(
            "SELECT id, user_id, credential_json, name, created_at, last_used_at
             FROM passkey_credentials",
        )
        .fetch_all(pool)
        .await?;

        Ok(credentials)
    }

    pub async fn update_last_used(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
        let now = chrono::Utc::now().to_rfc3339();

        sqlx::query("UPDATE passkey_credentials SET last_used_at = ? WHERE id = ?")
            .bind(&now)
            .bind(id)
            .execute(pool)
            .await?;

        Ok(())
    }

    pub async fn delete(pool: &SqlitePool, id: &str, user_id: &str) -> Result<bool, AppError> {
        let result = sqlx::query("DELETE FROM passkey_credentials WHERE id = ? AND user_id = ?")
            .bind(id)
            .bind(user_id)
            .execute(pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }
}
