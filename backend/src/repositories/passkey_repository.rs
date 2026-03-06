use chrono::{Duration, Utc};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::passkey::{PasskeyCredential, WebAuthnChallenge};

pub struct PasskeyRepository;

impl PasskeyRepository {
    pub async fn create_credential(
        pool: &SqlitePool,
        user_id: &str,
        credential_id: &str,
        public_key: &[u8],
        aaguid: Option<&str>,
    ) -> Result<PasskeyCredential, AppError> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            "INSERT INTO passkey_credentials (id, user_id, credential_id, public_key, sign_count, aaguid, created_at)
             VALUES (?, ?, ?, ?, 0, ?, ?)",
        )
        .bind(&id)
        .bind(user_id)
        .bind(credential_id)
        .bind(public_key)
        .bind(aaguid)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(PasskeyCredential {
            id,
            user_id: user_id.to_string(),
            credential_id: credential_id.to_string(),
            public_key: public_key.to_vec(),
            sign_count: 0,
            aaguid: aaguid.map(String::from),
            created_at: now,
            last_used: None,
        })
    }

    pub async fn find_by_credential_id(
        pool: &SqlitePool,
        credential_id: &str,
    ) -> Result<Option<PasskeyCredential>, AppError> {
        let cred = sqlx::query_as::<_, PasskeyCredential>(
            "SELECT id, user_id, credential_id, public_key, sign_count, aaguid, created_at, last_used
             FROM passkey_credentials WHERE credential_id = ?",
        )
        .bind(credential_id)
        .fetch_optional(pool)
        .await?;

        Ok(cred)
    }

    pub async fn find_by_user_id(
        pool: &SqlitePool,
        user_id: &str,
    ) -> Result<Vec<PasskeyCredential>, AppError> {
        let creds = sqlx::query_as::<_, PasskeyCredential>(
            "SELECT id, user_id, credential_id, public_key, sign_count, aaguid, created_at, last_used
             FROM passkey_credentials WHERE user_id = ?",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;

        Ok(creds)
    }

    pub async fn update_sign_count(
        pool: &SqlitePool,
        credential_id: &str,
        sign_count: i64,
    ) -> Result<(), AppError> {
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            "UPDATE passkey_credentials SET sign_count = ?, last_used = ? WHERE credential_id = ?",
        )
        .bind(sign_count)
        .bind(&now)
        .bind(credential_id)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Challenge 저장 (5분 만료)
    pub async fn store_challenge(
        pool: &SqlitePool,
        challenge: &str,
        user_id: Option<&str>,
        challenge_type: &str,
    ) -> Result<(), AppError> {
        let id = Uuid::new_v4().to_string();
        let expires_at = (Utc::now() + Duration::minutes(5)).to_rfc3339();

        sqlx::query(
            "INSERT INTO webauthn_challenges (id, challenge, user_id, type, expires_at)
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(challenge)
        .bind(user_id)
        .bind(challenge_type)
        .bind(&expires_at)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Challenge 검증 및 삭제 (일회용)
    pub async fn verify_and_consume_challenge(
        pool: &SqlitePool,
        challenge: &str,
        challenge_type: &str,
    ) -> Result<Option<String>, AppError> {
        let result = sqlx::query_as::<_, WebAuthnChallenge>(
            "SELECT id, challenge, user_id, type as challenge_type, expires_at, created_at
             FROM webauthn_challenges WHERE challenge = ? AND type = ?",
        )
        .bind(challenge)
        .bind(challenge_type)
        .fetch_optional(pool)
        .await?;

        match result {
            Some(record) => {
                // 삭제 (일회용)
                sqlx::query("DELETE FROM webauthn_challenges WHERE id = ?")
                    .bind(&record.id)
                    .execute(pool)
                    .await?;

                // 만료 확인
                let exp = chrono::DateTime::parse_from_rfc3339(&record.expires_at)
                    .map_err(|_| AppError::bad_request("챌린지 파싱 실패"))?;

                if exp < Utc::now() {
                    return Err(AppError::bad_request("챌린지가 만료되었습니다"));
                }

                Ok(record.user_id)
            }
            None => Err(AppError::bad_request("유효하지 않은 챌린지입니다")),
        }
    }

    /// 만료된 challenge 정리
    pub async fn cleanup_expired_challenges(pool: &SqlitePool) -> Result<(), AppError> {
        let now = Utc::now().to_rfc3339();
        sqlx::query("DELETE FROM webauthn_challenges WHERE expires_at < ?")
            .bind(&now)
            .execute(pool)
            .await?;
        Ok(())
    }
}
