use sqlx::SqlitePool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::passkey::{CreatePasskeyCredential, PasskeyCredential, WebauthnChallenge};

pub struct PasskeyRepository;

impl PasskeyRepository {
    /// 사용자의 패스키 크레덴셜 목록 조회
    pub async fn find_by_user_id(
        pool: &SqlitePool,
        user_id: &str,
    ) -> Result<Vec<PasskeyCredential>, AppError> {
        let credentials = sqlx::query_as::<_, PasskeyCredential>(
            "SELECT id, user_id, credential_id, passkey_json, name, created_at
             FROM passkey_credentials WHERE user_id = ?",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;

        Ok(credentials)
    }

    /// 모든 패스키 크레덴셜 조회 (인증 시 사용)
    pub async fn find_all(pool: &SqlitePool) -> Result<Vec<PasskeyCredential>, AppError> {
        let credentials = sqlx::query_as::<_, PasskeyCredential>(
            "SELECT id, user_id, credential_id, passkey_json, name, created_at
             FROM passkey_credentials",
        )
        .fetch_all(pool)
        .await?;

        Ok(credentials)
    }

    /// 패스키 크레덴셜 저장
    pub async fn create(
        pool: &SqlitePool,
        data: CreatePasskeyCredential,
    ) -> Result<PasskeyCredential, AppError> {
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        sqlx::query(
            "INSERT INTO passkey_credentials (id, user_id, credential_id, passkey_json, name, created_at)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&data.user_id)
        .bind(&data.credential_id)
        .bind(&data.passkey_json)
        .bind(&data.name)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(PasskeyCredential {
            id,
            user_id: data.user_id,
            credential_id: data.credential_id,
            passkey_json: data.passkey_json,
            name: data.name,
            created_at: now,
        })
    }

    /// 패스키 크레덴셜 삭제
    pub async fn delete(pool: &SqlitePool, id: &str, user_id: &str) -> Result<bool, AppError> {
        let result =
            sqlx::query("DELETE FROM passkey_credentials WHERE id = ? AND user_id = ?")
                .bind(id)
                .bind(user_id)
                .execute(pool)
                .await?;

        Ok(result.rows_affected() > 0)
    }

    /// 패스키 크레덴셜 JSON 업데이트 (sign_count 등)
    pub async fn update_passkey_json(
        pool: &SqlitePool,
        credential_id: &str,
        passkey_json: &str,
    ) -> Result<(), AppError> {
        sqlx::query("UPDATE passkey_credentials SET passkey_json = ? WHERE credential_id = ?")
            .bind(passkey_json)
            .bind(credential_id)
            .execute(pool)
            .await?;

        Ok(())
    }

    /// WebAuthn 챌린지 저장
    pub async fn save_challenge(
        pool: &SqlitePool,
        user_id: Option<&str>,
        challenge_state: &str,
        challenge_type: &str,
    ) -> Result<String, AppError> {
        let id = Uuid::new_v4().to_string();
        let expires_at = (chrono::Utc::now() + chrono::Duration::minutes(5)).to_rfc3339();

        sqlx::query(
            "INSERT INTO webauthn_challenges (id, user_id, challenge_state, challenge_type, expires_at)
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(user_id)
        .bind(challenge_state)
        .bind(challenge_type)
        .bind(&expires_at)
        .execute(pool)
        .await?;

        Ok(id)
    }

    /// WebAuthn 챌린지 조회 및 삭제 (일회성)
    pub async fn consume_challenge(
        pool: &SqlitePool,
        challenge_id: &str,
    ) -> Result<WebauthnChallenge, AppError> {
        let challenge = sqlx::query_as::<_, WebauthnChallenge>(
            "SELECT id, user_id, challenge_state, challenge_type, expires_at, created_at
             FROM webauthn_challenges WHERE id = ?",
        )
        .bind(challenge_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::bad_request("유효하지 않은 챌린지입니다"))?;

        // 사용한 챌린지 삭제
        sqlx::query("DELETE FROM webauthn_challenges WHERE id = ?")
            .bind(challenge_id)
            .execute(pool)
            .await?;

        // 만료 확인
        let exp = chrono::DateTime::parse_from_rfc3339(&challenge.expires_at)
            .map_err(|_| AppError::bad_request("챌린지 파싱 실패"))?;

        if exp < chrono::Utc::now() {
            return Err(AppError::bad_request("챌린지가 만료되었습니다"));
        }

        Ok(challenge)
    }

    /// 만료된 챌린지 정리
    pub async fn cleanup_expired_challenges(pool: &SqlitePool) -> Result<(), AppError> {
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query("DELETE FROM webauthn_challenges WHERE expires_at < ?")
            .bind(&now)
            .execute(pool)
            .await?;
        Ok(())
    }
}
