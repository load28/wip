# Phase 2: 인증 시스템 구현 계획서

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Google OAuth 기반의 완전한 인증 시스템 구현 (백엔드 + 프론트엔드)

**Architecture:**
- 백엔드: Rust + Actix-web에서 JWT 발급, CSRF 토큰 관리, SQLite 사용자 저장
- 프론트엔드: Google OAuth 로그인 UI, 토큰 기반 인증 상태 관리
- 보안: HttpOnly 쿠키, SameSite=Lax, Synchronizer Token CSRF 보호

**Tech Stack:** Rust, async-graphql, jsonwebtoken, SQLx, Next.js, Jotai, React Hook Form, Zod

---

## Task 1: 백엔드 프로젝트 구조 설정

**Files:**
- Create: `backend/src/lib.rs`
- Create: `backend/src/config.rs`
- Create: `backend/src/error.rs`
- Modify: `backend/src/main.rs`

**Step 1: src/lib.rs 생성**

```rust
pub mod config;
pub mod error;
```

**Step 2: src/config.rs 생성**

```rust
use std::env;

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub google_client_id: String,
    pub google_client_secret: String,
    pub frontend_url: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "sqlite:./data.db".to_string()),
            jwt_secret: env::var("JWT_SECRET")
                .expect("JWT_SECRET must be set"),
            google_client_id: env::var("GOOGLE_CLIENT_ID")
                .expect("GOOGLE_CLIENT_ID must be set"),
            google_client_secret: env::var("GOOGLE_CLIENT_SECRET")
                .expect("GOOGLE_CLIENT_SECRET must be set"),
            frontend_url: env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
        }
    }
}
```

**Step 3: src/error.rs 생성**

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("인증 실패: {0}")]
    Unauthorized(String),

    #[error("잘못된 요청: {0}")]
    BadRequest(String),

    #[error("서버 오류: {0}")]
    Internal(String),

    #[error("데이터베이스 오류: {0}")]
    Database(#[from] sqlx::Error),

    #[error("JWT 오류: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),

    #[error("HTTP 요청 오류: {0}")]
    Request(#[from] reqwest::Error),
}

impl AppError {
    pub fn unauthorized(msg: impl Into<String>) -> Self {
        Self::Unauthorized(msg.into())
    }

    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self::BadRequest(msg.into())
    }
}
```

**Step 4: main.rs 업데이트**

```rust
use actix_cors::Cors;
use actix_web::{web, App, HttpServer};
use dotenvy::dotenv;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use task_management_backend::config::Config;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env();
    let frontend_url = config.frontend_url.clone();

    tracing::info!("Starting server at http://127.0.0.1:8080");

    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin(&frontend_url)
            .allow_any_method()
            .allow_any_header()
            .supports_credentials();

        App::new()
            .app_data(web::Data::new(config.clone()))
            .wrap(cors)
            .route("/health", web::get().to(|| async { "OK" }))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
```

**Step 5: 빌드 확인**

Run: `cd backend && cargo check`
Expected: 컴파일 성공

**Step 6: 커밋**

```bash
git add backend/
git commit -m "chore: 백엔드 프로젝트 구조 설정 (config, error 모듈)"
```

---

## Task 2: 데이터베이스 스키마 및 연결 설정

**Files:**
- Create: `backend/src/db/mod.rs`
- Create: `backend/src/db/schema.sql`
- Create: `backend/migrations/001_init.sql`
- Modify: `backend/src/lib.rs`

**Step 1: migrations 디렉토리 생성**

```bash
mkdir -p backend/migrations
```

**Step 2: migrations/001_init.sql 생성**

```sql
-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    google_id TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 리프레시 토큰 테이블
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, token_hash)
);

-- CSRF 토큰 테이블
CREATE TABLE IF NOT EXISTS csrf_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_user_id ON csrf_tokens(user_id);
```

**Step 3: src/db/mod.rs 생성**

```rust
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::time::Duration;

pub async fn create_pool(database_url: &str) -> Result<SqlitePool, sqlx::Error> {
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(3))
        .connect(database_url)
        .await?;

    // 마이그레이션 실행
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await?;

    Ok(pool)
}
```

**Step 4: src/lib.rs 업데이트**

```rust
pub mod config;
pub mod db;
pub mod error;
```

**Step 5: Cargo.toml에 sqlx-cli 추가**

```toml
# [dependencies] 섹션에 추가
sqlx = { version = "0.7", features = ["runtime-tokio", "sqlite", "chrono", "migrate"] }
```

**Step 6: 빌드 확인**

Run: `cd backend && cargo check`
Expected: 컴파일 성공

**Step 7: 커밋**

```bash
git add backend/
git commit -m "feat: 데이터베이스 스키마 및 연결 설정"
```

---

## Task 3: 사용자 모델 및 리포지토리

**Files:**
- Create: `backend/src/models/mod.rs`
- Create: `backend/src/models/user.rs`
- Create: `backend/src/repositories/mod.rs`
- Create: `backend/src/repositories/user_repository.rs`
- Modify: `backend/src/lib.rs`

**Step 1: src/models/mod.rs 생성**

```rust
pub mod user;

pub use user::User;
```

**Step 2: src/models/user.rs 생성**

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: String,
    pub email: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub google_id: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone)]
pub struct CreateUser {
    pub email: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub google_id: String,
}
```

**Step 3: src/repositories/mod.rs 생성**

```rust
pub mod user_repository;

pub use user_repository::UserRepository;
```

**Step 4: src/repositories/user_repository.rs 생성**

```rust
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::user::{CreateUser, User};

pub struct UserRepository;

impl UserRepository {
    pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<User>, AppError> {
        let user = sqlx::query_as::<_, User>(
            "SELECT id, email, name, avatar_url, google_id, created_at, updated_at
             FROM users WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        Ok(user)
    }

    pub async fn find_by_google_id(pool: &SqlitePool, google_id: &str) -> Result<Option<User>, AppError> {
        let user = sqlx::query_as::<_, User>(
            "SELECT id, email, name, avatar_url, google_id, created_at, updated_at
             FROM users WHERE google_id = ?"
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
             VALUES (?, ?, ?, ?, ?, ?, ?)"
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

    pub async fn update(pool: &SqlitePool, id: &str, name: &str, avatar_url: Option<&str>) -> Result<(), AppError> {
        let now = chrono::Utc::now().to_rfc3339();

        sqlx::query(
            "UPDATE users SET name = ?, avatar_url = ?, updated_at = ? WHERE id = ?"
        )
        .bind(name)
        .bind(avatar_url)
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await?;

        Ok(())
    }
}
```

**Step 5: src/lib.rs 업데이트**

```rust
pub mod config;
pub mod db;
pub mod error;
pub mod models;
pub mod repositories;
```

**Step 6: 빌드 확인**

Run: `cd backend && cargo check`
Expected: 컴파일 성공

**Step 7: 커밋**

```bash
git add backend/
git commit -m "feat: 사용자 모델 및 리포지토리 구현"
```

---

## Task 4: 토큰 서비스 (JWT, Refresh, CSRF)

**Files:**
- Create: `backend/src/services/mod.rs`
- Create: `backend/src/services/token_service.rs`
- Modify: `backend/src/lib.rs`

**Step 1: src/services/mod.rs 생성**

```rust
pub mod token_service;

pub use token_service::TokenService;
```

**Step 2: src/services/token_service.rs 생성**

```rust
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
    pub sub: String,      // user_id
    pub email: String,
    pub exp: i64,         // 만료 시간
    pub iat: i64,         // 발급 시간
}

pub struct TokenService;

impl TokenService {
    /// Access Token 생성 (1시간)
    pub fn create_access_token(config: &Config, user_id: &str, email: &str) -> Result<String, AppError> {
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
    pub async fn create_refresh_token(pool: &SqlitePool, user_id: &str) -> Result<String, AppError> {
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
            "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)"
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

        let result: Option<(String, String)> = sqlx::query_as(
            "SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = ?"
        )
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
            "INSERT INTO csrf_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)"
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
    pub async fn verify_csrf_token(pool: &SqlitePool, user_id: &str, token: &str) -> Result<(), AppError> {
        let token_hash = Self::hash_token(token);

        let result: Option<(String,)> = sqlx::query_as(
            "SELECT expires_at FROM csrf_tokens WHERE user_id = ? AND token_hash = ?"
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
```

**Step 3: Cargo.toml에 sha2 추가**

```toml
# [dependencies] 섹션에 추가
sha2 = "0.10"
```

**Step 4: src/lib.rs 업데이트**

```rust
pub mod config;
pub mod db;
pub mod error;
pub mod models;
pub mod repositories;
pub mod services;
```

**Step 5: 빌드 확인**

Run: `cd backend && cargo check`
Expected: 컴파일 성공

**Step 6: 커밋**

```bash
git add backend/
git commit -m "feat: 토큰 서비스 구현 (JWT, Refresh, CSRF)"
```

---

## Task 5: Google OAuth 서비스

**Files:**
- Create: `backend/src/services/google_auth_service.rs`
- Modify: `backend/src/services/mod.rs`

**Step 1: src/services/google_auth_service.rs 생성**

```rust
use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::config::Config;
use crate::error::AppError;

#[derive(Debug, Deserialize)]
pub struct GoogleTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i64,
    pub id_token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GoogleUserInfo {
    pub id: String,
    pub email: String,
    pub name: String,
    pub picture: Option<String>,
}

pub struct GoogleAuthService;

impl GoogleAuthService {
    /// Authorization code를 access token으로 교환
    pub async fn exchange_code(config: &Config, code: &str, redirect_uri: &str) -> Result<GoogleTokenResponse, AppError> {
        let client = Client::new();

        let params = [
            ("client_id", config.google_client_id.as_str()),
            ("client_secret", config.google_client_secret.as_str()),
            ("code", code),
            ("grant_type", "authorization_code"),
            ("redirect_uri", redirect_uri),
        ];

        let response = client
            .post("https://oauth2.googleapis.com/token")
            .form(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            tracing::error!("Google token exchange failed: {}", error_text);
            return Err(AppError::unauthorized("Google 인증 실패"));
        }

        let token_response = response.json::<GoogleTokenResponse>().await?;
        Ok(token_response)
    }

    /// Access token으로 사용자 정보 조회
    pub async fn get_user_info(access_token: &str) -> Result<GoogleUserInfo, AppError> {
        let client = Client::new();

        let response = client
            .get("https://www.googleapis.com/oauth2/v2/userinfo")
            .bearer_auth(access_token)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            tracing::error!("Google userinfo failed: {}", error_text);
            return Err(AppError::unauthorized("사용자 정보 조회 실패"));
        }

        let user_info = response.json::<GoogleUserInfo>().await?;
        Ok(user_info)
    }
}
```

**Step 2: src/services/mod.rs 업데이트**

```rust
pub mod google_auth_service;
pub mod token_service;

pub use google_auth_service::GoogleAuthService;
pub use token_service::TokenService;
```

**Step 3: 빌드 확인**

Run: `cd backend && cargo check`
Expected: 컴파일 성공

**Step 4: 커밋**

```bash
git add backend/
git commit -m "feat: Google OAuth 서비스 구현"
```

---

## Task 6: GraphQL 스키마 - 인증 관련

**Files:**
- Create: `backend/src/graphql/mod.rs`
- Create: `backend/src/graphql/schema.rs`
- Create: `backend/src/graphql/types/mod.rs`
- Create: `backend/src/graphql/types/user.rs`
- Create: `backend/src/graphql/mutations/mod.rs`
- Create: `backend/src/graphql/mutations/auth.rs`
- Create: `backend/src/graphql/queries/mod.rs`
- Create: `backend/src/graphql/queries/me.rs`
- Modify: `backend/src/lib.rs`

**Step 1: src/graphql/types/mod.rs 생성**

```rust
pub mod user;

pub use user::UserType;
```

**Step 2: src/graphql/types/user.rs 생성**

```rust
use async_graphql::SimpleObject;

use crate::models::User;

#[derive(SimpleObject)]
pub struct UserType {
    pub id: String,
    pub email: String,
    pub name: String,
    pub avatar_url: Option<String>,
}

impl From<User> for UserType {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar_url: user.avatar_url,
        }
    }
}
```

**Step 3: src/graphql/mutations/mod.rs 생성**

```rust
pub mod auth;

pub use auth::AuthMutation;
```

**Step 4: src/graphql/mutations/auth.rs 생성**

```rust
use async_graphql::{Context, Object, Result, SimpleObject};
use sqlx::SqlitePool;

use crate::config::Config;
use crate::error::AppError;
use crate::graphql::types::UserType;
use crate::models::user::CreateUser;
use crate::repositories::UserRepository;
use crate::services::{GoogleAuthService, TokenService};

#[derive(SimpleObject)]
pub struct LoginPayload {
    pub user: UserType,
    pub csrf_token: String,
}

#[derive(SimpleObject)]
pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
}

pub struct AuthMutation;

#[Object]
impl AuthMutation {
    /// Google OAuth 로그인
    async fn login_with_google(
        &self,
        ctx: &Context<'_>,
        code: String,
        redirect_uri: String,
    ) -> Result<LoginPayload> {
        let config = ctx.data::<Config>()?;
        let pool = ctx.data::<SqlitePool>()?;

        // 1. Google에서 access token 획득
        let token_response = GoogleAuthService::exchange_code(config, &code, &redirect_uri).await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        // 2. 사용자 정보 조회
        let google_user = GoogleAuthService::get_user_info(&token_response.access_token).await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        // 3. 사용자 조회 또는 생성
        let user = match UserRepository::find_by_google_id(pool, &google_user.id).await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?
        {
            Some(existing_user) => {
                // 기존 사용자 정보 업데이트
                UserRepository::update(
                    pool,
                    &existing_user.id,
                    &google_user.name,
                    google_user.picture.as_deref(),
                ).await.map_err(|e| async_graphql::Error::new(e.to_string()))?;

                existing_user
            }
            None => {
                // 새 사용자 생성
                UserRepository::create(pool, CreateUser {
                    email: google_user.email,
                    name: google_user.name,
                    avatar_url: google_user.picture,
                    google_id: google_user.id,
                }).await.map_err(|e| async_graphql::Error::new(e.to_string()))?
            }
        };

        // 4. 토큰 생성
        let access_token = TokenService::create_access_token(config, &user.id, &user.email)
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        let refresh_token = TokenService::create_refresh_token(pool, &user.id).await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        let csrf_token = TokenService::create_csrf_token(pool, &user.id).await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        // 5. 쿠키 설정 (Context에 저장하여 나중에 응답에 추가)
        ctx.insert_http_header("Set-Cookie", format!(
            "access_token={}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600",
            access_token
        ));
        ctx.insert_http_header("Set-Cookie", format!(
            "refresh_token={}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000",
            refresh_token
        ));

        Ok(LoginPayload {
            user: user.into(),
            csrf_token,
        })
    }

    /// 토큰 갱신
    async fn refresh_token(&self, ctx: &Context<'_>) -> Result<bool> {
        let config = ctx.data::<Config>()?;
        let pool = ctx.data::<SqlitePool>()?;

        // 쿠키에서 refresh_token 추출 (실제 구현에서는 요청에서 가져옴)
        let refresh_token = ctx.data_opt::<String>()
            .ok_or_else(|| async_graphql::Error::new("리프레시 토큰이 없습니다"))?;

        // 토큰 검증
        let user_id = TokenService::verify_refresh_token(pool, refresh_token).await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        // 사용자 조회
        let user = UserRepository::find_by_id(pool, &user_id).await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?
            .ok_or_else(|| async_graphql::Error::new("사용자를 찾을 수 없습니다"))?;

        // 새 토큰 생성
        let new_access_token = TokenService::create_access_token(config, &user.id, &user.email)
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        let new_refresh_token = TokenService::create_refresh_token(pool, &user.id).await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        // 쿠키 설정
        ctx.insert_http_header("Set-Cookie", format!(
            "access_token={}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600",
            new_access_token
        ));
        ctx.insert_http_header("Set-Cookie", format!(
            "refresh_token={}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000",
            new_refresh_token
        ));

        Ok(true)
    }

    /// 로그아웃
    async fn logout(&self, ctx: &Context<'_>) -> Result<bool> {
        // 쿠키 삭제
        ctx.insert_http_header("Set-Cookie", "access_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
        ctx.insert_http_header("Set-Cookie", "refresh_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");

        Ok(true)
    }
}
```

**Step 5: src/graphql/queries/mod.rs 생성**

```rust
pub mod me;

pub use me::MeQuery;
```

**Step 6: src/graphql/queries/me.rs 생성**

```rust
use async_graphql::{Context, Object, Result};
use sqlx::SqlitePool;

use crate::config::Config;
use crate::graphql::types::UserType;
use crate::repositories::UserRepository;
use crate::services::TokenService;

pub struct MeQuery;

#[Object]
impl MeQuery {
    /// 현재 로그인한 사용자 정보
    async fn me(&self, ctx: &Context<'_>) -> Result<Option<UserType>> {
        let config = ctx.data::<Config>()?;
        let pool = ctx.data::<SqlitePool>()?;

        // 쿠키에서 access_token 추출 (Context에서 가져옴)
        let access_token = match ctx.data_opt::<String>() {
            Some(token) => token,
            None => return Ok(None),
        };

        // 토큰 검증
        let claims = match TokenService::verify_access_token(config, access_token) {
            Ok(claims) => claims,
            Err(_) => return Ok(None),
        };

        // 사용자 조회
        let user = UserRepository::find_by_id(pool, &claims.sub).await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        Ok(user.map(|u| u.into()))
    }
}
```

**Step 7: src/graphql/schema.rs 생성**

```rust
use async_graphql::{EmptySubscription, MergedObject, Schema};

use super::mutations::AuthMutation;
use super::queries::MeQuery;

#[derive(MergedObject, Default)]
pub struct QueryRoot(pub MeQuery);

#[derive(MergedObject, Default)]
pub struct MutationRoot(pub AuthMutation);

pub type AppSchema = Schema<QueryRoot, MutationRoot, EmptySubscription>;

pub fn create_schema() -> AppSchema {
    Schema::build(
        QueryRoot(MeQuery),
        MutationRoot(AuthMutation),
        EmptySubscription,
    )
    .finish()
}
```

**Step 8: src/graphql/mod.rs 생성**

```rust
pub mod mutations;
pub mod queries;
pub mod schema;
pub mod types;

pub use schema::{create_schema, AppSchema};
```

**Step 9: src/lib.rs 업데이트**

```rust
pub mod config;
pub mod db;
pub mod error;
pub mod graphql;
pub mod models;
pub mod repositories;
pub mod services;
```

**Step 10: 빌드 확인**

Run: `cd backend && cargo check`
Expected: 컴파일 성공

**Step 11: 커밋**

```bash
git add backend/
git commit -m "feat: GraphQL 인증 스키마 구현 (login, refresh, logout, me)"
```

---

## Task 7: GraphQL 엔드포인트 연동 (main.rs)

**Files:**
- Modify: `backend/src/main.rs`

**Step 1: main.rs 전체 업데이트**

```rust
use actix_cors::Cors;
use actix_web::{guard, web, App, HttpRequest, HttpResponse, HttpServer};
use async_graphql::http::{playground_source, GraphQLPlaygroundConfig};
use async_graphql_actix_web::{GraphQLRequest, GraphQLResponse};
use dotenvy::dotenv;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use task_management_backend::config::Config;
use task_management_backend::db::create_pool;
use task_management_backend::graphql::{create_schema, AppSchema};

async fn graphql_handler(
    schema: web::Data<AppSchema>,
    req: HttpRequest,
    gql_req: GraphQLRequest,
) -> GraphQLResponse {
    // 쿠키에서 토큰 추출
    let access_token = req
        .cookie("access_token")
        .map(|c| c.value().to_string());
    let refresh_token = req
        .cookie("refresh_token")
        .map(|c| c.value().to_string());

    let mut request = gql_req.into_inner();

    // Context에 토큰 추가
    if let Some(token) = access_token {
        request = request.data(token);
    }

    schema.execute(request).await.into()
}

async fn graphql_playground() -> HttpResponse {
    HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(playground_source(GraphQLPlaygroundConfig::new("/graphql")))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env();
    let frontend_url = config.frontend_url.clone();

    // 데이터베이스 연결
    let pool = create_pool(&config.database_url)
        .await
        .expect("Failed to create database pool");

    tracing::info!("Database connected");

    // GraphQL 스키마 생성
    let schema = create_schema();
    let schema = async_graphql::Schema::build(
        schema.query().clone(),
        schema.mutation().clone(),
        async_graphql::EmptySubscription,
    )
    .data(config.clone())
    .data(pool.clone())
    .finish();

    tracing::info!("Starting server at http://127.0.0.1:8080");

    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin(&frontend_url)
            .allow_any_method()
            .allow_any_header()
            .supports_credentials();

        App::new()
            .app_data(web::Data::new(schema.clone()))
            .wrap(cors)
            .route("/health", web::get().to(|| async { "OK" }))
            .service(
                web::resource("/graphql")
                    .guard(guard::Post())
                    .to(graphql_handler)
            )
            .service(
                web::resource("/graphql")
                    .guard(guard::Get())
                    .to(graphql_playground)
            )
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
```

**Step 2: 빌드 및 실행 테스트**

Run: `cd backend && cargo build`
Expected: 컴파일 성공

Run: `cd backend && cargo run`
Expected: 서버 시작, http://127.0.0.1:8080/graphql 에서 Playground 접근 가능

**Step 3: 커밋**

```bash
git add backend/
git commit -m "feat: GraphQL 엔드포인트 연동 및 Playground 설정"
```

---

## Task 8: 프론트엔드 - Google OAuth 설정

**Files:**
- Create: `front/src/shared/config/auth.ts`
- Modify: `front/src/shared/config/index.ts`

**Step 1: src/shared/config/auth.ts 생성**

```typescript
export const authConfig = {
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080',
  redirectUri: typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : '',
};

export const getGoogleAuthUrl = () => {
  const params = new URLSearchParams({
    client_id: authConfig.googleClientId,
    redirect_uri: authConfig.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};
```

**Step 2: src/shared/config/index.ts 업데이트**

```typescript
export * from './auth';
```

**Step 3: .env.local.example 생성**

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
```

**Step 4: 커밋**

```bash
git add front/
git commit -m "feat: 프론트엔드 Google OAuth 설정"
```

---

## Task 9: 프론트엔드 - GraphQL 클라이언트 설정

**Files:**
- Create: `front/src/shared/api/graphql-client.ts`
- Create: `front/src/shared/api/index.ts`
- Modify: `front/package.json` (graphql-request 추가)

**Step 1: graphql-request 의존성 추가**

```bash
cd front && bun add graphql graphql-request
```

**Step 2: src/shared/api/graphql-client.ts 생성**

```typescript
import { GraphQLClient } from 'graphql-request';
import { authConfig } from '@/shared/config/auth';

export const graphqlClient = new GraphQLClient(`${authConfig.backendUrl}/graphql`, {
  credentials: 'include', // 쿠키 포함
});

// CSRF 토큰 헤더 추가 함수
export const setCSRFToken = (token: string) => {
  graphqlClient.setHeader('X-CSRF-Token', token);
};
```

**Step 3: src/shared/api/index.ts 생성**

```typescript
export { graphqlClient, setCSRFToken } from './graphql-client';
```

**Step 4: 커밋**

```bash
git add front/
git commit -m "feat: GraphQL 클라이언트 설정"
```

---

## Task 10: 프론트엔드 - 인증 훅 및 API

**Files:**
- Create: `front/src/features/auth/api/auth.graphql.ts`
- Create: `front/src/features/auth/model/useAuth.ts`
- Create: `front/src/features/auth/model/useAuth.test.ts`
- Modify: `front/src/features/auth/index.ts`

**Step 1: 실패하는 테스트 작성 - src/features/auth/model/useAuth.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { useAuth } from './useAuth';
import { currentUserAtom, csrfTokenAtom } from '@/shared/store/auth';

// GraphQL 클라이언트 모킹
vi.mock('@/shared/api', () => ({
  graphqlClient: {
    request: vi.fn(),
  },
  setCSRFToken: vi.fn(),
}));

describe('useAuth', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider>{children}</Provider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loginWithGoogle', () => {
    it('Google 로그인 성공 시 사용자 정보와 CSRF 토큰을 저장한다', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: null,
      };
      const mockCsrfToken = 'csrf-token-123';

      const { graphqlClient } = await import('@/shared/api');
      vi.mocked(graphqlClient.request).mockResolvedValueOnce({
        loginWithGoogle: {
          user: mockUser,
          csrfToken: mockCsrfToken,
        },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.loginWithGoogle('auth-code', 'http://localhost:3000/auth/callback');
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.isAuthenticated).toBe(true);
      });
    });

    it('Google 로그인 실패 시 에러를 반환한다', async () => {
      const { graphqlClient } = await import('@/shared/api');
      vi.mocked(graphqlClient.request).mockRejectedValueOnce(new Error('인증 실패'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await expect(
        result.current.loginWithGoogle('invalid-code', 'http://localhost:3000/auth/callback')
      ).rejects.toThrow('인증 실패');
    });
  });

  describe('logout', () => {
    it('로그아웃 시 사용자 정보를 초기화한다', async () => {
      const { graphqlClient } = await import('@/shared/api');
      vi.mocked(graphqlClient.request).mockResolvedValueOnce({ logout: true });

      const store = createStore();
      store.set(currentUserAtom, {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      });

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <Provider store={store}>{children}</Provider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper: customWrapper });

      await act(async () => {
        await result.current.logout();
      });

      await waitFor(() => {
        expect(result.current.user).toBeNull();
        expect(result.current.isAuthenticated).toBe(false);
      });
    });
  });
});
```

**Step 2: 테스트 실행하여 실패 확인**

Run: `cd front && bunx vitest run src/features/auth/model/useAuth.test.ts`
Expected: FAIL - "Cannot find module './useAuth'"

**Step 3: src/features/auth/api/auth.graphql.ts 생성**

```typescript
import { gql } from 'graphql-request';

export const LOGIN_WITH_GOOGLE = gql`
  mutation LoginWithGoogle($code: String!, $redirectUri: String!) {
    loginWithGoogle(code: $code, redirectUri: $redirectUri) {
      user {
        id
        email
        name
        avatarUrl
      }
      csrfToken
    }
  }
`;

export const LOGOUT = gql`
  mutation Logout {
    logout
  }
`;

export const REFRESH_TOKEN = gql`
  mutation RefreshToken {
    refreshToken
  }
`;

export const GET_ME = gql`
  query GetMe {
    me {
      id
      email
      name
      avatarUrl
    }
  }
`;
```

**Step 4: src/features/auth/model/useAuth.ts 구현**

```typescript
'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback } from 'react';
import { graphqlClient, setCSRFToken } from '@/shared/api';
import {
  currentUserAtom,
  csrfTokenAtom,
  isAuthenticatedAtom,
  isSessionExpiredAtom,
  User,
} from '@/shared/store/auth';
import { LOGIN_WITH_GOOGLE, LOGOUT, REFRESH_TOKEN, GET_ME } from '../api/auth.graphql';

interface LoginPayload {
  loginWithGoogle: {
    user: User;
    csrfToken: string;
  };
}

interface MePayload {
  me: User | null;
}

export function useAuth() {
  const [user, setUser] = useAtom(currentUserAtom);
  const [csrfToken, setCsrfToken] = useAtom(csrfTokenAtom);
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const setSessionExpired = useSetAtom(isSessionExpiredAtom);

  const loginWithGoogle = useCallback(
    async (code: string, redirectUri: string) => {
      const data = await graphqlClient.request<LoginPayload>(LOGIN_WITH_GOOGLE, {
        code,
        redirectUri,
      });

      setUser(data.loginWithGoogle.user);
      setCsrfToken(data.loginWithGoogle.csrfToken);
      setCSRFToken(data.loginWithGoogle.csrfToken);

      return data.loginWithGoogle.user;
    },
    [setUser, setCsrfToken]
  );

  const logout = useCallback(async () => {
    await graphqlClient.request(LOGOUT);
    setUser(null);
    setCsrfToken(null);
    setCSRFToken('');
  }, [setUser, setCsrfToken]);

  const refreshToken = useCallback(async () => {
    try {
      await graphqlClient.request(REFRESH_TOKEN);
      return true;
    } catch {
      setSessionExpired(true);
      return false;
    }
  }, [setSessionExpired]);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const data = await graphqlClient.request<MePayload>(GET_ME);
      if (data.me) {
        setUser(data.me);
      }
      return data.me;
    } catch {
      return null;
    }
  }, [setUser]);

  return {
    user,
    isAuthenticated,
    csrfToken,
    loginWithGoogle,
    logout,
    refreshToken,
    fetchCurrentUser,
  };
}
```

**Step 5: 테스트 실행하여 통과 확인**

Run: `cd front && bunx vitest run src/features/auth/model/useAuth.test.ts`
Expected: PASS

**Step 6: src/features/auth/index.ts 업데이트**

```typescript
export { useAuth } from './model/useAuth';
export * from './api/auth.graphql';
```

**Step 7: 커밋**

```bash
git add front/
git commit -m "feat: 인증 훅 및 GraphQL API 구현"
```

---

## Task 11: 프론트엔드 - 로그인 UI 컴포넌트

**Files:**
- Create: `front/src/features/auth/ui/GoogleLoginButton.tsx`
- Create: `front/src/features/auth/ui/GoogleLoginButton.test.tsx`
- Create: `front/src/features/auth/ui/index.ts`
- Modify: `front/src/features/auth/index.ts`

**Step 1: 실패하는 테스트 작성 - src/features/auth/ui/GoogleLoginButton.test.tsx**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GoogleLoginButton } from './GoogleLoginButton';

// window.location 모킹
const mockAssign = vi.fn();
Object.defineProperty(window, 'location', {
  value: { assign: mockAssign, origin: 'http://localhost:3000' },
  writable: true,
});

vi.mock('@/shared/config/auth', () => ({
  getGoogleAuthUrl: vi.fn(() => 'https://accounts.google.com/o/oauth2/v2/auth?test=1'),
}));

describe('GoogleLoginButton', () => {
  it('Google 로그인 버튼이 렌더링된다', () => {
    render(<GoogleLoginButton />);
    expect(screen.getByRole('button', { name: /google로 로그인/i })).toBeInTheDocument();
  });

  it('버튼 클릭 시 Google OAuth URL로 이동한다', () => {
    render(<GoogleLoginButton />);

    const button = screen.getByRole('button', { name: /google로 로그인/i });
    fireEvent.click(button);

    expect(mockAssign).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?test=1');
  });

  it('로딩 상태에서는 버튼이 비활성화된다', () => {
    render(<GoogleLoginButton loading />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });
});
```

**Step 2: 테스트 실행하여 실패 확인**

Run: `cd front && bunx vitest run src/features/auth/ui/GoogleLoginButton.test.tsx`
Expected: FAIL

**Step 3: src/features/auth/ui/GoogleLoginButton.tsx 구현**

```typescript
'use client';

import { useCallback } from 'react';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { useTranslation } from 'react-i18next';
import { getGoogleAuthUrl } from '@/shared/config/auth';

interface GoogleLoginButtonProps {
  loading?: boolean;
}

export function GoogleLoginButton({ loading = false }: GoogleLoginButtonProps) {
  const { t } = useTranslation();

  const handleClick = useCallback(() => {
    const authUrl = getGoogleAuthUrl();
    window.location.assign(authUrl);
  }, []);

  return (
    <Button
      variant="contained"
      onClick={handleClick}
      disabled={loading}
      startIcon={
        loading ? (
          <CircularProgress size={20} color="inherit" />
        ) : (
          <GoogleIcon />
        )
      }
      sx={{
        backgroundColor: '#fff',
        color: '#757575',
        '&:hover': {
          backgroundColor: '#f5f5f5',
        },
        textTransform: 'none',
        fontWeight: 500,
      }}
    >
      {t('auth.login.button')}
    </Button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" fillRule="evenodd">
        <path
          d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
          fill="#4285F4"
        />
        <path
          d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
          fill="#34A853"
        />
        <path
          d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
          fill="#FBBC05"
        />
        <path
          d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
          fill="#EA4335"
        />
      </g>
    </svg>
  );
}
```

**Step 4: 테스트 실행하여 통과 확인**

Run: `cd front && bunx vitest run src/features/auth/ui/GoogleLoginButton.test.tsx`
Expected: PASS

**Step 5: src/features/auth/ui/index.ts 생성**

```typescript
export { GoogleLoginButton } from './GoogleLoginButton';
```

**Step 6: src/features/auth/index.ts 업데이트**

```typescript
export { useAuth } from './model/useAuth';
export { GoogleLoginButton } from './ui';
export * from './api/auth.graphql';
```

**Step 7: 커밋**

```bash
git add front/
git commit -m "feat: Google 로그인 버튼 컴포넌트 구현"
```

---

## Task 12: 프론트엔드 - OAuth 콜백 페이지

**Files:**
- Create: `front/src/app/auth/callback/page.tsx`

**Step 1: src/app/auth/callback/page.tsx 생성**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { useAuth } from '@/features/auth';
import { authConfig } from '@/shared/config/auth';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError('Google 로그인이 취소되었습니다.');
      return;
    }

    if (!code) {
      setError('인증 코드가 없습니다.');
      return;
    }

    const handleLogin = async () => {
      try {
        await loginWithGoogle(code, authConfig.redirectUri);
        router.replace('/');
      } catch (err) {
        setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
      }
    };

    handleLogin();
  }, [searchParams, loginWithGoogle, router]);

  if (error) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        gap={2}
      >
        <Alert severity="error">{error}</Alert>
        <Typography
          component="a"
          href="/"
          sx={{ color: 'primary.main', textDecoration: 'underline' }}
        >
          홈으로 돌아가기
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      gap={2}
    >
      <CircularProgress />
      <Typography>로그인 중...</Typography>
    </Box>
  );
}
```

**Step 2: 커밋**

```bash
git add front/
git commit -m "feat: OAuth 콜백 페이지 구현"
```

---

## Task 13: 프론트엔드 - 인증 가드 컴포넌트

**Files:**
- Create: `front/src/features/auth/ui/AuthGuard.tsx`
- Create: `front/src/features/auth/ui/AuthGuard.test.tsx`
- Modify: `front/src/features/auth/ui/index.ts`

**Step 1: 실패하는 테스트 작성 - src/features/auth/ui/AuthGuard.test.tsx**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { AuthGuard } from './AuthGuard';
import { currentUserAtom } from '@/shared/store/auth';

// useRouter 모킹
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('인증된 사용자에게는 children을 렌더링한다', async () => {
    const store = createStore();
    store.set(currentUserAtom, {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
    });

    render(
      <Provider store={store}>
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  it('인증되지 않은 사용자는 로그인 페이지로 리다이렉트된다', async () => {
    const store = createStore();
    store.set(currentUserAtom, null);

    render(
      <Provider store={store}>
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      </Provider>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('로딩 중에는 로딩 UI를 표시한다', () => {
    const store = createStore();
    // 초기 상태 (아직 인증 확인 전)

    render(
      <Provider store={store}>
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      </Provider>
    );

    // 로딩 상태에서는 children이 렌더링되지 않음
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
```

**Step 2: 테스트 실행하여 실패 확인**

Run: `cd front && bunx vitest run src/features/auth/ui/AuthGuard.test.tsx`
Expected: FAIL

**Step 3: src/features/auth/ui/AuthGuard.tsx 구현**

```typescript
'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from '../model/useAuth';

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const router = useRouter();
  const { isAuthenticated, fetchCurrentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isChecked, setIsChecked] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await fetchCurrentUser();
      } finally {
        setIsLoading(false);
        setIsChecked(true);
      }
    };

    checkAuth();
  }, [fetchCurrentUser]);

  useEffect(() => {
    if (isChecked && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isChecked, isAuthenticated, router]);

  if (isLoading) {
    return (
      fallback || (
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          minHeight="100vh"
        >
          <CircularProgress />
        </Box>
      )
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
```

**Step 4: 테스트 실행하여 통과 확인**

Run: `cd front && bunx vitest run src/features/auth/ui/AuthGuard.test.tsx`
Expected: PASS

**Step 5: src/features/auth/ui/index.ts 업데이트**

```typescript
export { GoogleLoginButton } from './GoogleLoginButton';
export { AuthGuard } from './AuthGuard';
```

**Step 6: src/features/auth/index.ts 업데이트**

```typescript
export { useAuth } from './model/useAuth';
export { GoogleLoginButton, AuthGuard } from './ui';
export * from './api/auth.graphql';
```

**Step 7: 커밋**

```bash
git add front/
git commit -m "feat: 인증 가드 컴포넌트 구현"
```

---

## Task 14: 프론트엔드 - 로그인 페이지

**Files:**
- Create: `front/src/app/login/page.tsx`

**Step 1: src/app/login/page.tsx 생성**

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import { useTranslation } from 'react-i18next';
import { GoogleLoginButton, useAuth } from '@/features/auth';

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      bgcolor="grey.100"
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          maxWidth: 400,
          width: '100%',
          mx: 2,
        }}
      >
        <Typography variant="h4" component="h1" fontWeight="bold">
          Task Management
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center">
          {t('dashboard.header.description')}
        </Typography>
        <GoogleLoginButton />
      </Paper>
    </Box>
  );
}
```

**Step 2: 커밋**

```bash
git add front/
git commit -m "feat: 로그인 페이지 구현"
```

---

## Task 15: 통합 테스트 및 환경 설정 정리

**Files:**
- Modify: `backend/.env.example`
- Create: `front/.env.local.example`

**Step 1: backend/.env.example 업데이트**

```
DATABASE_URL=sqlite:./data.db
JWT_SECRET=your-super-secret-jwt-key-change-in-production
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FRONTEND_URL=http://localhost:3000
RUST_LOG=info
```

**Step 2: front/.env.local.example 생성**

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
```

**Step 3: 전체 테스트 실행**

Run: `cd front && bunx vitest run`
Expected: 모든 테스트 통과

**Step 4: 백엔드 빌드 확인**

Run: `cd backend && cargo build`
Expected: 컴파일 성공

**Step 5: 커밋**

```bash
git add .
git commit -m "chore: Phase 2 인증 시스템 구현 완료"
```

---

## 체크포인트 요약

Phase 2 완료 후 구조:

```
backend/
├── Cargo.toml
├── migrations/
│   └── 001_init.sql
└── src/
    ├── config.rs
    ├── db/
    │   └── mod.rs
    ├── error.rs
    ├── graphql/
    │   ├── mod.rs
    │   ├── schema.rs
    │   ├── mutations/
    │   │   ├── mod.rs
    │   │   └── auth.rs
    │   ├── queries/
    │   │   ├── mod.rs
    │   │   └── me.rs
    │   └── types/
    │       ├── mod.rs
    │       └── user.rs
    ├── lib.rs
    ├── main.rs
    ├── models/
    │   ├── mod.rs
    │   └── user.rs
    ├── repositories/
    │   ├── mod.rs
    │   └── user_repository.rs
    └── services/
        ├── mod.rs
        ├── google_auth_service.rs
        └── token_service.rs

front/
├── src/
│   ├── app/
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── page.tsx
│   │   └── login/
│   │       └── page.tsx
│   ├── features/
│   │   └── auth/
│   │       ├── api/
│   │       │   └── auth.graphql.ts
│   │       ├── model/
│   │       │   ├── useAuth.ts
│   │       │   └── useAuth.test.ts
│   │       ├── ui/
│   │       │   ├── AuthGuard.tsx
│   │       │   ├── AuthGuard.test.tsx
│   │       │   ├── GoogleLoginButton.tsx
│   │       │   ├── GoogleLoginButton.test.tsx
│   │       │   └── index.ts
│   │       └── index.ts
│   └── shared/
│       ├── api/
│       │   ├── graphql-client.ts
│       │   └── index.ts
│       └── config/
│           ├── auth.ts
│           └── index.ts
```

### 테스트 커버리지 목표

- 프론트엔드: useAuth, GoogleLoginButton, AuthGuard
- 백엔드: 토큰 생성/검증 단위 테스트 (별도 추가 권장)

### 보안 체크리스트

- [x] JWT Access Token (1시간 만료)
- [x] Refresh Token (30일, HttpOnly 쿠키)
- [x] CSRF Token (Synchronizer Token 패턴)
- [x] SameSite=Lax 쿠키 설정
- [x] CORS credentials 설정
