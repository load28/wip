use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::config::Config;
use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // user_id
    pub email: String,
    pub exp: i64, // 만료 시간
    pub iat: i64, // 발급 시간
}

pub struct TokenService;

impl TokenService {
    /// Access Token 생성 (1시간)
    pub fn create_access_token(
        config: &Config,
        user_id: &str,
        email: &str,
    ) -> Result<String, AppError> {
        let now = Utc::now();
        let exp = now + Duration::hours(1);

        let claims = Claims {
            sub: user_id.to_string(),
            email: email.to_string(),
            exp: exp.timestamp(),
            iat: now.timestamp(),
        };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
        )?;

        Ok(token)
    }

    /// Access Token 검증
    pub fn verify_access_token(config: &Config, token: &str) -> Result<Claims, AppError> {
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(config.jwt_secret.as_bytes()),
            &Validation::default(),
        )?;

        Ok(token_data.claims)
    }

    /// Refresh Token 생성 (30일)
    pub async fn create_refresh_token(
        pool: &SqlitePool,
        user_id: &str,
    ) -> Result<String, AppError> {
        let token = Uuid::new_v4().to_string();
        let token_hash = Self::hash_token(&token);
        let expires_at = (Utc::now() + Duration::days(30)).to_rfc3339();
        let id = Uuid::new_v4().to_string();

        // 기존 토큰 삭제 (사용자당 하나만 유지)
        sqlx::query("DELETE FROM refresh_tokens WHERE user_id = ?")
            .bind(user_id)
            .execute(pool)
            .await?;

        // 새 토큰 저장
        sqlx::query(
            "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(user_id)
        .bind(&token_hash)
        .bind(&expires_at)
        .execute(pool)
        .await?;

        Ok(token)
    }

    /// Refresh Token 검증
    pub async fn verify_refresh_token(pool: &SqlitePool, token: &str) -> Result<String, AppError> {
        let token_hash = Self::hash_token(token);

        let result: Option<(String, String)> =
            sqlx::query_as("SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = ?")
                .bind(&token_hash)
                .fetch_optional(pool)
                .await?;

        match result {
            Some((user_id, expires_at)) => {
                let exp = chrono::DateTime::parse_from_rfc3339(&expires_at)
                    .map_err(|_| AppError::unauthorized("토큰 파싱 실패"))?;

                if exp < Utc::now() {
                    return Err(AppError::unauthorized("리프레시 토큰이 만료되었습니다"));
                }

                Ok(user_id)
            }
            None => Err(AppError::unauthorized("유효하지 않은 리프레시 토큰입니다")),
        }
    }

    /// CSRF Token 생성
    pub async fn create_csrf_token(pool: &SqlitePool, user_id: &str) -> Result<String, AppError> {
        let token = Uuid::new_v4().to_string();
        let token_hash = Self::hash_token(&token);
        let expires_at = (Utc::now() + Duration::days(30)).to_rfc3339();
        let id = Uuid::new_v4().to_string();

        // 기존 토큰 삭제
        sqlx::query("DELETE FROM csrf_tokens WHERE user_id = ?")
            .bind(user_id)
            .execute(pool)
            .await?;

        // 새 토큰 저장
        sqlx::query(
            "INSERT INTO csrf_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(user_id)
        .bind(&token_hash)
        .bind(&expires_at)
        .execute(pool)
        .await?;

        Ok(token)
    }

    /// CSRF Token 검증
    pub async fn verify_csrf_token(
        pool: &SqlitePool,
        user_id: &str,
        token: &str,
    ) -> Result<(), AppError> {
        let token_hash = Self::hash_token(token);

        let result: Option<(String,)> = sqlx::query_as(
            "SELECT expires_at FROM csrf_tokens WHERE user_id = ? AND token_hash = ?",
        )
        .bind(user_id)
        .bind(&token_hash)
        .fetch_optional(pool)
        .await?;

        match result {
            Some((expires_at,)) => {
                let exp = chrono::DateTime::parse_from_rfc3339(&expires_at)
                    .map_err(|_| AppError::unauthorized("토큰 파싱 실패"))?;

                if exp < Utc::now() {
                    return Err(AppError::unauthorized("CSRF 토큰이 만료되었습니다"));
                }

                Ok(())
            }
            None => Err(AppError::unauthorized("유효하지 않은 CSRF 토큰입니다")),
        }
    }

    /// 토큰 해시
    fn hash_token(token: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(token.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}
