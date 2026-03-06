# Passkey(WebAuthn) 로그인 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 기존 Google OAuth 로그인에 더해 Passkey(WebAuthn) 로그인을 추가하여, 사용자가 생체인식/보안키로 로그인할 수 있게 한다.

**Architecture:** Rust 백엔드에 `webauthn-rs` 크레이트 기반 REST 엔드포인트를 추가하고, Next.js 프론트엔드에서 Web Authentication API + Conditional UI로 패스키 등록/인증을 구현한다. Challenge 상태는 인메모리로 관리하고, credential은 SQLite에 저장한다.

**Tech Stack:** webauthn-rs, actix-web REST, SQLite(sqlx), React 19, Next.js 16, Web Authentication API, Conditional UI

---

### Task 1: DB 마이그레이션 추가

**Files:**
- Create: `backend/migrations/0002_passkey_credentials.sql`
- Modify: `backend/migrations/0001_initial.sql` (참고용, 수정하지 않음)

**Step 1: 마이그레이션 SQL 파일 작성**

```sql
-- passkey_credentials 테이블
CREATE TABLE IF NOT EXISTS passkey_credentials (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_json TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'My Passkey',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_passkey_credentials_user_id ON passkey_credentials(user_id);

-- users 테이블의 google_id를 nullable로 변경
-- SQLite는 ALTER COLUMN을 지원하지 않으므로 테이블 재생성 필요
CREATE TABLE IF NOT EXISTS users_new (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    google_id TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO users_new SELECT * FROM users;
DROP TABLE IF EXISTS users;
ALTER TABLE users_new RENAME TO users;

-- 인덱스 재생성
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
```

**Step 2: 빌드 확인**

Run: `cd backend && cargo build 2>&1 | head -20`
Expected: 컴파일 성공 (마이그레이션은 런타임에 실행됨)

**Step 3: 커밋**

```bash
git add backend/migrations/0002_passkey_credentials.sql
git commit -m "feat: add passkey_credentials migration and make google_id nullable"
```

---

### Task 2: Cargo.toml에 webauthn-rs 의존성 추가

**Files:**
- Modify: `backend/Cargo.toml`

**Step 1: 의존성 추가**

`[dependencies]` 섹션에 추가:

```toml
webauthn-rs = { version = "0.5", features = ["danger-allow-state-serialisation", "conditional-ui"] }
webauthn-rs-proto = "0.5"
```

**Step 2: 빌드 확인**

Run: `cd backend && cargo build 2>&1 | tail -5`
Expected: 컴파일 성공

**Step 3: 커밋**

```bash
git add backend/Cargo.toml backend/Cargo.lock
git commit -m "feat: add webauthn-rs dependency"
```

---

### Task 3: Passkey 모델 및 리포지토리 생성

**Files:**
- Create: `backend/src/models/passkey.rs`
- Modify: `backend/src/models/mod.rs`
- Create: `backend/src/repositories/passkey_repository.rs`
- Modify: `backend/src/repositories/mod.rs`

**Step 1: Passkey 모델 작성**

`backend/src/models/passkey.rs`:

```rust
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PasskeyCredential {
    pub id: String,
    pub user_id: String,
    pub credential_json: String,
    pub name: String,
    pub created_at: String,
    pub last_used_at: Option<String>,
}
```

**Step 2: models/mod.rs에 passkey 모듈 추가**

```rust
pub mod passkey;
// 기존 모듈들 유지
```

**Step 3: Passkey 리포지토리 작성**

`backend/src/repositories/passkey_repository.rs`:

```rust
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

    pub async fn find_all(
        pool: &SqlitePool,
    ) -> Result<Vec<PasskeyCredential>, AppError> {
        let credentials = sqlx::query_as::<_, PasskeyCredential>(
            "SELECT id, user_id, credential_json, name, created_at, last_used_at
             FROM passkey_credentials",
        )
        .fetch_all(pool)
        .await?;

        Ok(credentials)
    }

    pub async fn update_last_used(
        pool: &SqlitePool,
        id: &str,
    ) -> Result<(), AppError> {
        let now = chrono::Utc::now().to_rfc3339();

        sqlx::query("UPDATE passkey_credentials SET last_used_at = ? WHERE id = ?")
            .bind(&now)
            .bind(id)
            .execute(pool)
            .await?;

        Ok(())
    }

    pub async fn delete(pool: &SqlitePool, id: &str, user_id: &str) -> Result<bool, AppError> {
        let result =
            sqlx::query("DELETE FROM passkey_credentials WHERE id = ? AND user_id = ?")
                .bind(id)
                .bind(user_id)
                .execute(pool)
                .await?;

        Ok(result.rows_affected() > 0)
    }
}
```

**Step 4: repositories/mod.rs에 passkey_repository 모듈 추가**

```rust
pub mod passkey_repository;
// 기존 모듈들 유지
pub use passkey_repository::PasskeyRepository;
```

**Step 5: 빌드 확인**

Run: `cd backend && cargo build 2>&1 | tail -5`
Expected: 컴파일 성공

**Step 6: 커밋**

```bash
git add backend/src/models/passkey.rs backend/src/models/mod.rs \
        backend/src/repositories/passkey_repository.rs backend/src/repositories/mod.rs
git commit -m "feat: add Passkey model and repository"
```

---

### Task 4: User 모델 google_id nullable 대응

**Files:**
- Modify: `backend/src/models/user.rs`
- Modify: `backend/src/repositories/user_repository.rs`

**Step 1: User 모델의 google_id를 Option으로 변경**

`backend/src/models/user.rs` — `google_id: String` → `google_id: Option<String>`:

```rust
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: String,
    pub email: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub google_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone)]
pub struct CreateUser {
    pub email: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub google_id: Option<String>,
}
```

**Step 2: user_repository.rs 수정 — find_by_email 메서드 추가**

`find_by_google_id`의 파라미터를 그대로 유지하고, 패스키 인증용 `find_by_email` 추가:

```rust
pub async fn find_by_email(
    pool: &SqlitePool,
    email: &str,
) -> Result<Option<User>, AppError> {
    let user = sqlx::query_as::<_, User>(
        "SELECT id, email, name, avatar_url, google_id, created_at, updated_at
         FROM users WHERE email = ?",
    )
    .bind(email)
    .fetch_optional(pool)
    .await?;

    Ok(user)
}
```

**Step 3: auth.rs의 CreateUser 사용부 수정**

`backend/src/graphql/mutations/auth.rs`에서 `CreateUser` 생성 시 `google_id`를 `Some()`으로 감싸기:

```rust
// 기존: google_id: google_user.id,
// 변경:
google_id: Some(google_user.id),
```

**Step 4: 빌드 확인**

Run: `cd backend && cargo build 2>&1 | tail -10`
Expected: 컴파일 성공

**Step 5: 커밋**

```bash
git add backend/src/models/user.rs backend/src/repositories/user_repository.rs \
        backend/src/graphql/mutations/auth.rs
git commit -m "feat: make google_id nullable, add find_by_email"
```

---

### Task 5: WebAuthn 서비스 생성

**Files:**
- Create: `backend/src/services/webauthn_service.rs`
- Modify: `backend/src/services/mod.rs`
- Modify: `backend/src/config.rs`

**Step 1: Config에 WebAuthn 설정 추가**

`backend/src/config.rs`에 `rp_id`와 `rp_origin` 추가:

```rust
use std::env;

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub google_client_id: String,
    pub google_client_secret: String,
    pub frontend_url: String,
    pub webauthn_rp_id: String,
    pub webauthn_rp_origin: String,
}

impl Config {
    pub fn from_env() -> Self {
        let frontend_url = env::var("FRONTEND_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());

        Self {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "sqlite:./data.db".to_string()),
            jwt_secret: env::var("JWT_SECRET").expect("JWT_SECRET must be set"),
            google_client_id: env::var("GOOGLE_CLIENT_ID").expect("GOOGLE_CLIENT_ID must be set"),
            google_client_secret: env::var("GOOGLE_CLIENT_SECRET")
                .expect("GOOGLE_CLIENT_SECRET must be set"),
            webauthn_rp_id: env::var("WEBAUTHN_RP_ID")
                .unwrap_or_else(|_| "localhost".to_string()),
            webauthn_rp_origin: env::var("WEBAUTHN_RP_ORIGIN")
                .unwrap_or_else(|_| frontend_url.clone()),
            frontend_url,
        }
    }
}
```

**Step 2: WebAuthn 서비스 작성**

`backend/src/services/webauthn_service.rs`:

```rust
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

use webauthn_rs::prelude::*;
use webauthn_rs::Webauthn;

use crate::config::Config;

/// Challenge의 TTL (5분)
const CHALLENGE_TTL_SECS: u64 = 300;

pub struct WebAuthnService {
    pub webauthn: Webauthn,
    /// 등록 중인 challenge 상태: key = user_id
    reg_states: Mutex<HashMap<String, (PasskeyRegistration, Instant)>>,
    /// 인증 중인 challenge 상태: key = 랜덤 세션 ID
    auth_states: Mutex<HashMap<String, (DiscoverableAuthentication, Instant)>>,
}

impl WebAuthnService {
    pub fn new(config: &Config) -> Self {
        let rp_origin = Url::parse(&config.webauthn_rp_origin)
            .expect("Invalid WEBAUTHN_RP_ORIGIN URL");

        let builder = WebauthnBuilder::new(&config.webauthn_rp_id, &rp_origin)
            .expect("Invalid WebAuthn configuration")
            .rp_name("Wip Task Manager");

        let webauthn = builder.build().expect("Failed to build WebAuthn");

        Self {
            webauthn,
            reg_states: Mutex::new(HashMap::new()),
            auth_states: Mutex::new(HashMap::new()),
        }
    }

    /// 등록 challenge 저장
    pub fn store_registration(&self, user_id: &str, state: PasskeyRegistration) {
        let mut states = self.reg_states.lock().unwrap();
        self.cleanup_expired(&mut states);
        states.insert(user_id.to_string(), (state, Instant::now()));
    }

    /// 등록 challenge 꺼내기 (1회용)
    pub fn take_registration(&self, user_id: &str) -> Option<PasskeyRegistration> {
        let mut states = self.reg_states.lock().unwrap();
        states.remove(user_id).and_then(|(state, created)| {
            if created.elapsed().as_secs() < CHALLENGE_TTL_SECS {
                Some(state)
            } else {
                None
            }
        })
    }

    /// 인증 challenge 저장
    pub fn store_authentication(&self, session_id: &str, state: DiscoverableAuthentication) {
        let mut states = self.auth_states.lock().unwrap();
        self.cleanup_expired_auth(&mut states);
        states.insert(session_id.to_string(), (state, Instant::now()));
    }

    /// 인증 challenge 꺼내기 (1회용)
    pub fn take_authentication(&self, session_id: &str) -> Option<DiscoverableAuthentication> {
        let mut states = self.auth_states.lock().unwrap();
        states.remove(session_id).and_then(|(state, created)| {
            if created.elapsed().as_secs() < CHALLENGE_TTL_SECS {
                Some(state)
            } else {
                None
            }
        })
    }

    fn cleanup_expired<T>(&self, states: &mut HashMap<String, (T, Instant)>) {
        states.retain(|_, (_, created)| created.elapsed().as_secs() < CHALLENGE_TTL_SECS);
    }

    fn cleanup_expired_auth(&self, states: &mut HashMap<String, (DiscoverableAuthentication, Instant)>) {
        states.retain(|_, (_, created)| created.elapsed().as_secs() < CHALLENGE_TTL_SECS);
    }
}
```

**Step 3: services/mod.rs에 모듈 추가**

```rust
pub mod google_auth_service;
pub mod token_service;
pub mod webauthn_service;

pub use google_auth_service::GoogleAuthService;
pub use token_service::TokenService;
pub use webauthn_service::WebAuthnService;
```

**Step 4: 빌드 확인**

Run: `cd backend && cargo build 2>&1 | tail -10`
Expected: 컴파일 성공

**Step 5: 커밋**

```bash
git add backend/src/services/webauthn_service.rs backend/src/services/mod.rs \
        backend/src/config.rs
git commit -m "feat: add WebAuthn service with challenge state management"
```

---

### Task 6: WebAuthn REST 엔드포인트 구현

**Files:**
- Create: `backend/src/routes/mod.rs`
- Create: `backend/src/routes/webauthn.rs`
- Modify: `backend/src/lib.rs`
- Modify: `backend/src/main.rs`
- Modify: `backend/src/error.rs`

**Step 1: error.rs에 actix-web ResponseError 구현 추가**

`backend/src/error.rs` 끝에 추가:

```rust
impl actix_web::ResponseError for AppError {
    fn error_response(&self) -> actix_web::HttpResponse {
        use actix_web::HttpResponse;

        let status = match self {
            AppError::Unauthorized(_) => actix_web::http::StatusCode::UNAUTHORIZED,
            AppError::BadRequest(_) => actix_web::http::StatusCode::BAD_REQUEST,
            AppError::NotFound => actix_web::http::StatusCode::NOT_FOUND,
            _ => actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
        };

        HttpResponse::build(status).json(serde_json::json!({
            "error": self.to_string()
        }))
    }
}
```

**Step 2: WebAuthn REST 핸들러 작성**

`backend/src/routes/webauthn.rs`:

```rust
use actix_web::{web, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;
use webauthn_rs::prelude::*;

use crate::config::Config;
use crate::error::AppError;
use crate::repositories::{PasskeyRepository, UserRepository};
use crate::services::{TokenService, WebAuthnService};

#[derive(Deserialize)]
pub struct RegisterFinishRequest {
    pub credential: RegisterPublicKeyCredential,
    pub name: Option<String>,
}

#[derive(Serialize)]
pub struct AuthBeginResponse {
    pub challenge: RequestChallengeResponse,
    pub session_id: String,
}

#[derive(Deserialize)]
pub struct AuthFinishRequest {
    pub credential: PublicKeyCredential,
    pub session_id: String,
}

#[derive(Serialize)]
pub struct AuthFinishResponse {
    pub user_id: String,
    pub email: String,
    pub name: String,
    pub csrf_token: String,
}

/// 현재 로그인된 사용자 ID를 쿠키에서 추출
fn get_current_user_id(req: &HttpRequest, config: &Config) -> Result<String, AppError> {
    let cookie = req
        .cookie("access_token")
        .ok_or_else(|| AppError::unauthorized("로그인이 필요합니다"))?;

    let claims = TokenService::verify_access_token(config, cookie.value())?;
    Ok(claims.sub)
}

/// POST /api/webauthn/register/begin
/// 로그인된 사용자가 새 패스키를 등록하기 위한 challenge 발급
pub async fn register_begin(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    webauthn: web::Data<WebAuthnService>,
) -> Result<HttpResponse, AppError> {
    let user_id = get_current_user_id(&req, &config)?;

    let user = UserRepository::find_by_id(&pool, &user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    // 기존 패스키 목록 조회 (중복 방지용)
    let existing = PasskeyRepository::find_by_user_id(&pool, &user_id).await?;
    let exclude_credentials: Vec<Passkey> = existing
        .iter()
        .filter_map(|c| serde_json::from_str(&c.credential_json).ok())
        .collect();

    let user_unique_id = Uuid::parse_str(&user.id)
        .unwrap_or_else(|_| Uuid::new_v4());

    let (ccr, reg_state) = webauthn
        .webauthn
        .start_passkey_registration(
            user_unique_id,
            &user.email,
            &user.name,
            Some(exclude_credentials.iter().collect()),
        )
        .map_err(|e| AppError::Internal(format!("WebAuthn 등록 시작 실패: {e}")))?;

    webauthn.store_registration(&user_id, reg_state);

    Ok(HttpResponse::Ok().json(ccr))
}

/// POST /api/webauthn/register/finish
/// 브라우저에서 받은 credential로 등록 완료
pub async fn register_finish(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    webauthn: web::Data<WebAuthnService>,
    body: web::Json<RegisterFinishRequest>,
) -> Result<HttpResponse, AppError> {
    let user_id = get_current_user_id(&req, &config)?;

    let reg_state = webauthn
        .take_registration(&user_id)
        .ok_or_else(|| AppError::bad_request("등록 세션이 만료되었습니다"))?;

    let passkey = webauthn
        .webauthn
        .finish_passkey_registration(&body.credential, &reg_state)
        .map_err(|e| AppError::bad_request(format!("패스키 등록 실패: {e}")))?;

    let credential_json = serde_json::to_string(&passkey)
        .map_err(|e| AppError::Internal(format!("직렬화 실패: {e}")))?;

    let name = body.name.as_deref().unwrap_or("My Passkey");

    PasskeyRepository::create(&pool, &user_id, &credential_json, name).await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({ "status": "ok" })))
}

/// POST /api/webauthn/auth/begin
/// 패스키 인증 시작 (Discoverable Credential — allowCredentials 비움)
pub async fn auth_begin(
    webauthn: web::Data<WebAuthnService>,
) -> Result<HttpResponse, AppError> {
    let (rcr, auth_state) = webauthn
        .webauthn
        .start_discoverable_authentication()
        .map_err(|e| AppError::Internal(format!("WebAuthn 인증 시작 실패: {e}")))?;

    let session_id = Uuid::new_v4().to_string();
    webauthn.store_authentication(&session_id, auth_state);

    Ok(HttpResponse::Ok().json(AuthBeginResponse {
        challenge: rcr,
        session_id,
    }))
}

/// POST /api/webauthn/auth/finish
/// 패스키 인증 완료 — 서명 검증 후 JWT 발급
pub async fn auth_finish(
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    webauthn: web::Data<WebAuthnService>,
    body: web::Json<AuthFinishRequest>,
) -> Result<HttpResponse, AppError> {
    let auth_state = webauthn
        .take_authentication(&body.session_id)
        .ok_or_else(|| AppError::bad_request("인증 세션이 만료되었습니다"))?;

    // 모든 패스키를 불러와서 discoverable authentication을 완료
    let all_credentials = PasskeyRepository::find_all(&pool).await?;

    let creds_map: Vec<(CredentialID, Passkey, String, String)> = all_credentials
        .iter()
        .filter_map(|c| {
            let passkey: Passkey = serde_json::from_str(&c.credential_json).ok()?;
            Some((passkey.cred_id().clone(), passkey, c.user_id.clone(), c.id.clone()))
        })
        .collect();

    let auth_result = webauthn
        .webauthn
        .finish_discoverable_authentication(
            &body.credential,
            auth_state,
            &creds_map.iter().map(|(_, pk, _, _)| {
                let uid = pk.cred_id().clone();
                (uid, pk.clone())
            }).collect::<Vec<_>>(),
        )
        .map_err(|e| AppError::unauthorized(format!("패스키 인증 실패: {e}")))?;

    // userHandle에서 사용자 찾기
    let user_handle = auth_result.user_id();

    // credential ID로 매칭하여 user_id 확인
    let cred_id = auth_result.cred_id();
    let (_, _, user_id, passkey_row_id) = creds_map
        .iter()
        .find(|(id, _, _, _)| id == cred_id)
        .ok_or_else(|| AppError::unauthorized("매칭되는 패스키가 없습니다"))?;

    // 사용자 조회
    let user = UserRepository::find_by_id(&pool, user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    // last_used_at 업데이트
    PasskeyRepository::update_last_used(&pool, passkey_row_id).await?;

    // JWT 토큰 발급 (기존 TokenService 재사용)
    let access_token = TokenService::create_access_token(&config, &user.id, &user.email)?;
    let refresh_token = TokenService::create_refresh_token(&pool, &user.id).await?;
    let csrf_token = TokenService::create_csrf_token(&pool, &user.id).await?;

    Ok(HttpResponse::Ok()
        .insert_header((
            "Set-Cookie",
            format!(
                "access_token={}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600",
                access_token
            ),
        ))
        .insert_header((
            "Set-Cookie",
            format!(
                "refresh_token={}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000",
                refresh_token
            ),
        ))
        .json(AuthFinishResponse {
            user_id: user.id,
            email: user.email,
            name: user.name,
            csrf_token,
        }))
}

/// GET /api/webauthn/credentials
/// 현재 사용자의 등록된 패스키 목록 조회
pub async fn list_credentials(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
) -> Result<HttpResponse, AppError> {
    let user_id = get_current_user_id(&req, &config)?;
    let credentials = PasskeyRepository::find_by_user_id(&pool, &user_id).await?;

    let response: Vec<serde_json::Value> = credentials
        .into_iter()
        .map(|c| {
            serde_json::json!({
                "id": c.id,
                "name": c.name,
                "createdAt": c.created_at,
                "lastUsedAt": c.last_used_at,
            })
        })
        .collect();

    Ok(HttpResponse::Ok().json(response))
}

/// DELETE /api/webauthn/credentials/{id}
/// 패스키 삭제
pub async fn delete_credential(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let user_id = get_current_user_id(&req, &config)?;
    let credential_id = path.into_inner();

    let deleted = PasskeyRepository::delete(&pool, &credential_id, &user_id).await?;

    if deleted {
        Ok(HttpResponse::Ok().json(serde_json::json!({ "status": "ok" })))
    } else {
        Err(AppError::NotFound)
    }
}

/// actix-web 라우트 설정
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/webauthn")
            .route("/register/begin", web::post().to(register_begin))
            .route("/register/finish", web::post().to(register_finish))
            .route("/auth/begin", web::post().to(auth_begin))
            .route("/auth/finish", web::post().to(auth_finish))
            .route("/credentials", web::get().to(list_credentials))
            .route("/credentials/{id}", web::delete().to(delete_credential)),
    );
}
```

**Step 3: routes/mod.rs 작성**

`backend/src/routes/mod.rs`:

```rust
pub mod webauthn;
```

**Step 4: lib.rs에 routes 모듈 추가**

```rust
pub mod config;
pub mod db;
pub mod error;
pub mod graphql;
pub mod models;
pub mod repositories;
pub mod routes;
pub mod services;
```

**Step 5: main.rs에 WebAuthn 서비스 및 라우트 등록**

`backend/src/main.rs`를 수정:

1. import 추가:
```rust
use task_management_backend::routes::webauthn;
use task_management_backend::services::WebAuthnService;
```

2. `main()` 함수 안, schema 생성 후:
```rust
// WebAuthn 서비스 생성
let webauthn_service = web::Data::new(WebAuthnService::new(&config));
```

3. `HttpServer::new` 클로저 안에서:
```rust
let webauthn_service = webauthn_service.clone();
```

4. `App::new()` 체인에 추가:
```rust
.app_data(webauthn_service.clone())
.configure(webauthn::configure)
```

**Step 6: 빌드 확인**

Run: `cd backend && cargo build 2>&1 | tail -20`
Expected: 컴파일 성공

> 참고: `finish_discoverable_authentication`의 정확한 시그니처는 webauthn-rs 버전에 따라 다를 수 있음.
> 빌드 에러 시 API 시그니처를 확인하여 맞춤 조정 필요.

**Step 7: 커밋**

```bash
git add backend/src/routes/ backend/src/lib.rs backend/src/main.rs backend/src/error.rs
git commit -m "feat: add WebAuthn REST endpoints for passkey register/auth"
```

---

### Task 7: 프론트엔드 — WebAuthn API 클라이언트 생성

**Files:**
- Create: `front/src/features/auth/api/webauthn.ts`

**Step 1: WebAuthn API 클라이언트 작성**

`front/src/features/auth/api/webauthn.ts`:

```typescript
import { authConfig } from '@/shared/config/auth';

const WEBAUTHN_BASE = `${authConfig.backendUrl}/api/webauthn`;

/**
 * ArrayBuffer를 Base64URL 문자열로 변환
 */
function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64URL 문자열을 ArrayBuffer로 변환
 */
function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * 서버 challenge 응답을 navigator.credentials.create()에 맞게 변환
 */
function prepareCreationOptions(
  options: PublicKeyCredentialCreationOptions
): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: base64urlToBuffer(options.challenge as unknown as string),
    user: {
      ...options.user,
      id: base64urlToBuffer(options.user.id as unknown as string),
    },
    excludeCredentials: options.excludeCredentials?.map((cred) => ({
      ...cred,
      id: base64urlToBuffer(cred.id as unknown as string),
    })),
  };
}

/**
 * 서버 challenge 응답을 navigator.credentials.get()에 맞게 변환
 */
function prepareRequestOptions(
  options: PublicKeyCredentialRequestOptions
): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: base64urlToBuffer(options.challenge as unknown as string),
    allowCredentials: options.allowCredentials?.map((cred) => ({
      ...cred,
      id: base64urlToBuffer(cred.id as unknown as string),
    })),
  };
}

/**
 * PublicKeyCredential을 서버 전송용 JSON으로 변환
 */
function credentialToJSON(credential: PublicKeyCredential) {
  const response = credential.response;

  const result: Record<string, unknown> = {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    extensions: credential.getClientExtensionResults(),
  };

  if ('attestationObject' in response) {
    // Registration response
    const attestationResponse = response as AuthenticatorAttestationResponse;
    result.response = {
      attestationObject: bufferToBase64url(attestationResponse.attestationObject),
      clientDataJSON: bufferToBase64url(attestationResponse.clientDataJSON),
    };
  } else {
    // Authentication response
    const assertionResponse = response as AuthenticatorAssertionResponse;
    result.response = {
      authenticatorData: bufferToBase64url(assertionResponse.authenticatorData),
      clientDataJSON: bufferToBase64url(assertionResponse.clientDataJSON),
      signature: bufferToBase64url(assertionResponse.signature),
      userHandle: assertionResponse.userHandle
        ? bufferToBase64url(assertionResponse.userHandle)
        : null,
    };
  }

  return result;
}

/**
 * 패스키 등록 시작 + 완료
 */
export async function registerPasskey(name?: string): Promise<void> {
  // 1. Begin — challenge 가져오기
  const beginRes = await fetch(`${WEBAUTHN_BASE}/register/begin`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!beginRes.ok) throw new Error('패스키 등록 시작 실패');

  const creationOptions = await beginRes.json();

  // 2. 브라우저에서 credential 생성
  const credential = (await navigator.credentials.create({
    publicKey: prepareCreationOptions(creationOptions.publicKey),
  })) as PublicKeyCredential;

  if (!credential) throw new Error('패스키 생성이 취소되었습니다');

  // 3. Finish — 서버에 credential 전송
  const finishRes = await fetch(`${WEBAUTHN_BASE}/register/finish`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      credential: credentialToJSON(credential),
      name: name || undefined,
    }),
  });
  if (!finishRes.ok) throw new Error('패스키 등록 완료 실패');
}

/**
 * 패스키 인증 시작 + 완료
 */
export async function authenticateWithPasskey(): Promise<{
  userId: string;
  email: string;
  name: string;
  csrfToken: string;
}> {
  // 1. Begin — challenge 가져오기
  const beginRes = await fetch(`${WEBAUTHN_BASE}/auth/begin`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!beginRes.ok) throw new Error('패스키 인증 시작 실패');

  const { challenge, session_id: sessionId } = await beginRes.json();

  // 2. 브라우저에서 credential 가져오기
  const credential = (await navigator.credentials.get({
    publicKey: prepareRequestOptions(challenge.publicKey),
  })) as PublicKeyCredential;

  if (!credential) throw new Error('패스키 인증이 취소되었습니다');

  // 3. Finish — 서버에 credential 전송
  const finishRes = await fetch(`${WEBAUTHN_BASE}/auth/finish`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      credential: credentialToJSON(credential),
      session_id: sessionId,
    }),
  });
  if (!finishRes.ok) throw new Error('패스키 인증 실패');

  return finishRes.json();
}

/**
 * Conditional UI를 통한 패스키 인증 (mediation: 'conditional')
 */
export async function authenticateWithConditionalUI(
  abortController: AbortController
): Promise<{
  userId: string;
  email: string;
  name: string;
  csrfToken: string;
} | null> {
  // 1. Begin
  const beginRes = await fetch(`${WEBAUTHN_BASE}/auth/begin`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!beginRes.ok) return null;

  const { challenge, session_id: sessionId } = await beginRes.json();

  try {
    // 2. Conditional UI로 credential 가져오기
    const credential = (await navigator.credentials.get({
      publicKey: prepareRequestOptions(challenge.publicKey),
      mediation: 'conditional' as CredentialMediationRequirement,
      signal: abortController.signal,
    })) as PublicKeyCredential;

    if (!credential) return null;

    // 3. Finish
    const finishRes = await fetch(`${WEBAUTHN_BASE}/auth/finish`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credential: credentialToJSON(credential),
        session_id: sessionId,
      }),
    });
    if (!finishRes.ok) return null;

    return finishRes.json();
  } catch {
    // AbortError 등 무시
    return null;
  }
}

/**
 * 브라우저 WebAuthn 지원 여부 확인
 */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined'
  );
}

/**
 * Conditional UI 지원 여부 확인
 */
export async function isConditionalUISupported(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isConditionalMediationAvailable();
  } catch {
    return false;
  }
}

/**
 * 등록된 패스키 목록 조회
 */
export async function listPasskeys(): Promise<
  Array<{
    id: string;
    name: string;
    createdAt: string;
    lastUsedAt: string | null;
  }>
> {
  const res = await fetch(`${WEBAUTHN_BASE}/credentials`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('패스키 목록 조회 실패');
  return res.json();
}

/**
 * 패스키 삭제
 */
export async function deletePasskey(id: string): Promise<void> {
  const res = await fetch(`${WEBAUTHN_BASE}/credentials/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('패스키 삭제 실패');
}
```

**Step 2: 커밋**

```bash
git add front/src/features/auth/api/webauthn.ts
git commit -m "feat: add WebAuthn API client with Conditional UI support"
```

---

### Task 8: 프론트엔드 — useAuth 훅에 패스키 인증 추가

**Files:**
- Modify: `front/src/features/auth/model/useAuth.ts`

**Step 1: useAuth에 loginWithPasskey 추가**

import 추가:
```typescript
import { authenticateWithPasskey } from '../api/webauthn';
import { setCSRFToken } from '@/shared/api';
```

`useAuth` 훅 안에 `loginWithPasskey` 콜백 추가:

```typescript
const loginWithPasskey = useCallback(async () => {
  const result = await authenticateWithPasskey();

  const user: User = {
    id: result.userId,
    email: result.email,
    name: result.name,
  };

  setUser(user);
  setCsrfToken(result.csrfToken);
  setCSRFToken(result.csrfToken);

  return user;
}, [setUser, setCsrfToken]);
```

return 객체에 `loginWithPasskey` 추가.

**Step 2: 커밋**

```bash
git add front/src/features/auth/model/useAuth.ts
git commit -m "feat: add loginWithPasskey to useAuth hook"
```

---

### Task 9: 프론트엔드 — 로그인 페이지에 Conditional UI 적용

**Files:**
- Modify: `front/src/app/login/page.tsx`

**Step 1: Conditional UI 로직 추가**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import { useTranslation } from 'react-i18next';
import { useAuth, GoogleLoginButton } from '@/features/auth';
import {
  isWebAuthnSupported,
  isConditionalUISupported,
  authenticateWithConditionalUI,
  authenticateWithPasskey,
} from '@/features/auth/api/webauthn';
import { setCSRFToken } from '@/shared/api';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isAuthenticated, setUser, setCsrfToken } = useAuth();
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  // Conditional UI 시작
  useEffect(() => {
    let cancelled = false;

    const startConditionalUI = async () => {
      const supported = await isConditionalUISupported();
      if (!supported || cancelled) return;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const result = await authenticateWithConditionalUI(controller);
      if (result && !cancelled) {
        setUser({
          id: result.userId,
          email: result.email,
          name: result.name,
        });
        setCsrfToken(result.csrfToken);
        setCSRFToken(result.csrfToken);
        router.replace('/');
      }
    };

    startConditionalUI();

    return () => {
      cancelled = true;
      abortControllerRef.current?.abort();
    };
  }, [router, setUser, setCsrfToken]);

  const handlePasskeyLogin = async () => {
    try {
      abortControllerRef.current?.abort();
      const result = await authenticateWithPasskey();
      setUser({
        id: result.userId,
        email: result.email,
        name: result.name,
      });
      setCsrfToken(result.csrfToken);
      setCSRFToken(result.csrfToken);
      router.replace('/');
    } catch {
      // 사용자가 취소하거나 에러 발생 시 무시
    }
  };

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
          minWidth: 320,
        }}
      >
        <Typography variant="h4" component="h1">
          {t('auth.login.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center">
          {t('auth.login.description')}
        </Typography>

        {/* Conditional UI용 숨겨진 input */}
        <input
          type="text"
          autoComplete="username webauthn"
          style={{
            position: 'absolute',
            opacity: 0,
            width: 0,
            height: 0,
          }}
          tabIndex={-1}
        />

        <GoogleLoginButton />

        {isWebAuthnSupported() && (
          <>
            <Divider sx={{ width: '100%' }}>또는</Divider>
            <Button
              variant="outlined"
              onClick={handlePasskeyLogin}
              startIcon={<FingerprintIcon />}
              sx={{ textTransform: 'none', fontWeight: 500 }}
              fullWidth
            >
              패스키로 로그인
            </Button>
          </>
        )}
      </Paper>
    </Box>
  );
}
```

> 참고: `setUser`와 `setCsrfToken`을 useAuth에서 직접 노출해야 함.
> useAuth 훅의 return에 이미 있으면 그대로 사용하고, 없으면 추가 필요.

**Step 2: 커밋**

```bash
git add front/src/app/login/page.tsx
git commit -m "feat: add Conditional UI and passkey login button to login page"
```

---

### Task 10: 프론트엔드 — 설정 페이지에 패스키 관리 UI 추가

**Files:**
- Modify: `front/src/app/settings/page.tsx`

**Step 1: 패스키 관리 섹션 추가**

설정 페이지의 기존 Card 아래에 패스키 관리 Card 추가:

```tsx
// 추가 import
import { useState, useEffect, useCallback } from 'react';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import AddIcon from '@mui/icons-material/Add';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import {
  isWebAuthnSupported,
  listPasskeys,
  registerPasskey,
  deletePasskey,
} from '@/features/auth/api/webauthn';

// 컴포넌트 내부에 패스키 관리 상태 추가:
const [passkeys, setPasskeys] = useState<Array<{
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}>>([]);
const [passkeySupported, setPasskeySupported] = useState(false);
const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
const [newPasskeyName, setNewPasskeyName] = useState('');
const [passkeyError, setPasskeyError] = useState<string | null>(null);

const loadPasskeys = useCallback(async () => {
  try {
    const list = await listPasskeys();
    setPasskeys(list);
  } catch {
    // 무시
  }
}, []);

useEffect(() => {
  setPasskeySupported(isWebAuthnSupported());
  loadPasskeys();
}, [loadPasskeys]);

const handleRegister = async () => {
  try {
    setPasskeyError(null);
    await registerPasskey(newPasskeyName || undefined);
    setRegisterDialogOpen(false);
    setNewPasskeyName('');
    await loadPasskeys();
  } catch (e) {
    setPasskeyError(e instanceof Error ? e.message : '패스키 등록 실패');
  }
};

const handleDelete = async (id: string) => {
  try {
    await deletePasskey(id);
    await loadPasskeys();
  } catch {
    // 무시
  }
};

// JSX — 기존 테마 Card 아래에 추가:
{passkeySupported && (
  <Card sx={{ mt: 2 }}>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight="medium">
          패스키 관리
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setRegisterDialogOpen(true)}
        >
          패스키 등록
        </Button>
      </Box>

      {passkeys.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          등록된 패스키가 없습니다.
        </Typography>
      ) : (
        <List>
          {passkeys.map((pk) => (
            <ListItem key={pk.id}>
              <ListItemIcon>
                <FingerprintIcon />
              </ListItemIcon>
              <ListItemText
                primary={pk.name}
                secondary={`등록: ${new Date(pk.createdAt).toLocaleDateString()}${
                  pk.lastUsedAt
                    ? ` · 마지막 사용: ${new Date(pk.lastUsedAt).toLocaleDateString()}`
                    : ''
                }`}
              />
              <ListItemSecondaryAction>
                <IconButton edge="end" onClick={() => handleDelete(pk.id)}>
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}
    </CardContent>

    <Dialog open={registerDialogOpen} onClose={() => setRegisterDialogOpen(false)}>
      <DialogTitle>새 패스키 등록</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="패스키 이름 (선택)"
          fullWidth
          value={newPasskeyName}
          onChange={(e) => setNewPasskeyName(e.target.value)}
          placeholder="예: MacBook Pro, iPhone"
        />
        {passkeyError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {passkeyError}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setRegisterDialogOpen(false)}>취소</Button>
        <Button onClick={handleRegister} variant="contained">
          등록
        </Button>
      </DialogActions>
    </Dialog>
  </Card>
)}
```

**Step 2: 커밋**

```bash
git add front/src/app/settings/page.tsx
git commit -m "feat: add passkey management UI to settings page"
```

---

### Task 11: 환경변수 설정 파일 업데이트

**Files:**
- Modify: `backend/.env.example`

**Step 1: WebAuthn 환경변수 추가**

`.env.example`에 추가:

```env
# WebAuthn / Passkey
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_ORIGIN=http://localhost:3000
```

**Step 2: 커밋**

```bash
git add backend/.env.example
git commit -m "feat: add WebAuthn env vars to .env.example"
```

---

### Task 12: 빌드 검증 및 최종 조정

**Step 1: 백엔드 빌드**

Run: `cd backend && cargo build 2>&1`
Expected: 컴파일 성공. 에러 발생 시 `webauthn-rs` API 시그니처에 맞게 `routes/webauthn.rs` 조정.

특히 `finish_discoverable_authentication`의 시그니처를 확인할 것:
- webauthn-rs 0.5에서 해당 함수가 어떤 인자를 받는지 `cargo doc --open`으로 확인
- `DiscoverableKey` 변환이 필요할 수 있음

**Step 2: 프론트엔드 빌드**

Run: `cd front && bun run build 2>&1`
Expected: 빌드 성공. TypeScript 에러 발생 시 타입 조정.

**Step 3: 통합 테스트 (수동)**

1. 백엔드 시작: `cd backend && cargo run`
2. 프론트엔드 시작: `cd front && bun run dev`
3. Google 로그인으로 계정 생성
4. 설정 페이지에서 패스키 등록
5. 로그아웃 후 패스키로 로그인 시도

**Step 4: 최종 커밋**

```bash
git add -A
git commit -m "feat: complete passkey/webauthn login integration"
```
