use actix_web::{web, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use webauthn_rs::prelude::*;

use crate::config::Config;
use crate::error::AppError;
use crate::repositories::PasskeyRepository;
use crate::repositories::UserRepository;
use crate::services::TokenService;
use crate::services::WebAuthnService;

// --- Helper: extract user_id from access_token cookie ---

fn extract_user_id(req: &HttpRequest, config: &Config) -> Result<String, AppError> {
    let cookie = req
        .cookie("access_token")
        .ok_or_else(|| AppError::unauthorized("로그인이 필요합니다"))?;

    let claims = TokenService::verify_access_token(config, cookie.value())?;
    Ok(claims.sub)
}

// --- Request/Response types ---

#[derive(Debug, Deserialize)]
pub struct RegisterBeginRequest {
    pub name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RegisterBeginResponse {
    pub public_key: CreationChallengeResponse,
}

#[derive(Debug, Deserialize)]
pub struct RegisterFinishRequest {
    pub credential: RegisterPublicKeyCredential,
    pub name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthBeginResponse {
    pub public_key: RequestChallengeResponse,
    pub session_id: String,
}

#[derive(Debug, Deserialize)]
pub struct AuthFinishRequest {
    pub credential: PublicKeyCredential,
    pub session_id: String,
}

#[derive(Debug, Serialize)]
pub struct CredentialResponse {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub last_used_at: Option<String>,
}

// --- Handlers ---

/// POST /api/webauthn/register/begin
async fn register_begin(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<sqlx::SqlitePool>,
    webauthn_service: web::Data<WebAuthnService>,
) -> Result<HttpResponse, AppError> {
    let user_id = extract_user_id(&req, &config)?;

    // Get user info for registration
    let user = UserRepository::find_by_id(&pool, &user_id)
        .await?
        .ok_or_else(|| AppError::unauthorized("사용자를 찾을 수 없습니다"))?;

    // Get existing credentials to exclude
    let existing = PasskeyRepository::find_by_user_id(&pool, &user_id).await?;
    let exclude_credentials: Vec<CredentialID> = existing
        .iter()
        .filter_map(|c| {
            serde_json::from_str::<Passkey>(&c.credential_json)
                .ok()
                .map(|pk| pk.cred_id().clone())
        })
        .collect();

    let exclude = if exclude_credentials.is_empty() {
        None
    } else {
        Some(exclude_credentials)
    };

    // Parse user_id as UUID for webauthn (use a deterministic UUID from the user_id string)
    let user_unique_id = Uuid::new_v5(&Uuid::NAMESPACE_URL, user_id.as_bytes());

    let user_display_name = &user.name;

    let (ccr, reg_state) = webauthn_service
        .webauthn
        .start_passkey_registration(user_unique_id, &user.email, user_display_name, exclude)
        .map_err(|e| AppError::Internal(format!("WebAuthn 등록 시작 실패: {:?}", e)))?;

    webauthn_service.store_registration(&user_id, reg_state);

    // Patch authenticatorSelection to require resident key for discoverable credentials
    let mut ccr_json = serde_json::to_value(&RegisterBeginResponse { public_key: ccr })
        .map_err(|e| AppError::Internal(format!("직렬화 실패: {:?}", e)))?;
    if let Some(auth_sel) = ccr_json.pointer_mut("/public_key/publicKey/authenticatorSelection") {
        if let Some(obj) = auth_sel.as_object_mut() {
            obj.insert("residentKey".to_string(), serde_json::json!("required"));
            obj.insert("requireResidentKey".to_string(), serde_json::json!(true));
        }
    }

    Ok(HttpResponse::Ok().json(ccr_json))
}

/// POST /api/webauthn/register/finish
async fn register_finish(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<sqlx::SqlitePool>,
    webauthn_service: web::Data<WebAuthnService>,
    body: web::Json<RegisterFinishRequest>,
) -> Result<HttpResponse, AppError> {
    let user_id = extract_user_id(&req, &config)?;

    let reg_state = webauthn_service
        .take_registration(&user_id)
        .ok_or_else(|| AppError::bad_request("등록 세션이 만료되었거나 존재하지 않습니다"))?;

    let passkey = webauthn_service
        .webauthn
        .finish_passkey_registration(&body.credential, &reg_state)
        .map_err(|e| AppError::Internal(format!("WebAuthn 등록 완료 실패: {:?}", e)))?;

    let credential_json = serde_json::to_string(&passkey)
        .map_err(|e| AppError::Internal(format!("패스키 직렬화 실패: {:?}", e)))?;

    let name = body.name.as_deref().unwrap_or("My Passkey");

    let credential = PasskeyRepository::create(&pool, &user_id, &credential_json, name).await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "id": credential.id,
        "name": credential.name,
        "created_at": credential.created_at,
    })))
}

/// POST /api/webauthn/auth/begin
async fn auth_begin(
    webauthn_service: web::Data<WebAuthnService>,
) -> Result<HttpResponse, AppError> {
    let (rcr, auth_state) = webauthn_service
        .webauthn
        .start_discoverable_authentication()
        .map_err(|e| AppError::Internal(format!("WebAuthn 인증 시작 실패: {:?}", e)))?;

    let session_id = uuid::Uuid::new_v4().to_string();
    webauthn_service.store_authentication(&session_id, auth_state);

    Ok(HttpResponse::Ok().json(AuthBeginResponse {
        public_key: rcr,
        session_id,
    }))
}

/// POST /api/webauthn/auth/finish
async fn auth_finish(
    config: web::Data<Config>,
    pool: web::Data<sqlx::SqlitePool>,
    webauthn_service: web::Data<WebAuthnService>,
    body: web::Json<AuthFinishRequest>,
) -> Result<HttpResponse, AppError> {
    let auth_state = webauthn_service
        .take_authentication(&body.session_id)
        .ok_or_else(|| AppError::bad_request("인증 세션이 만료되었거나 존재하지 않습니다"))?;

    // Get user handle from the credential response to identify the user
    let user_handle_bytes = body
        .credential
        .get_user_unique_id()
        .ok_or_else(|| AppError::bad_request("사용자 식별 정보가 없습니다"))?;

    let user_unique_id = Uuid::from_slice(user_handle_bytes)
        .map_err(|_| AppError::bad_request("잘못된 사용자 식별자입니다"))?;

    // Find all passkey credentials across all users and match by user_unique_id
    let all_credentials = PasskeyRepository::find_all(&pool).await?;

    // Find credentials for the user whose UUID matches
    let mut matching_user_id: Option<String> = None;
    let mut discoverable_keys: Vec<DiscoverableKey> = Vec::new();
    let mut passkey_map: Vec<(String, Passkey)> = Vec::new();

    for cred_record in &all_credentials {
        if let Ok(passkey) = serde_json::from_str::<Passkey>(&cred_record.credential_json) {
            let cred_user_uuid = Uuid::new_v5(&Uuid::NAMESPACE_URL, cred_record.user_id.as_bytes());
            if cred_user_uuid == user_unique_id {
                matching_user_id = Some(cred_record.user_id.clone());
                let dk: DiscoverableKey = (&passkey).into();
                discoverable_keys.push(dk);
                passkey_map.push((cred_record.id.clone(), passkey));
            }
        }
    }

    let user_id = matching_user_id
        .ok_or_else(|| AppError::unauthorized("등록된 패스키를 찾을 수 없습니다"))?;

    // Finish discoverable authentication
    let auth_result = webauthn_service
        .webauthn
        .finish_discoverable_authentication(&body.credential, auth_state, &discoverable_keys)
        .map_err(|e| AppError::Internal(format!("WebAuthn 인증 완료 실패: {:?}", e)))?;

    // Update passkey credential if needed
    for (record_id, mut passkey) in passkey_map {
        if let Some(updated) = passkey.update_credential(&auth_result) {
            if updated {
                let updated_json = serde_json::to_string(&passkey)
                    .map_err(|e| AppError::Internal(format!("패스키 직렬화 실패: {:?}", e)))?;
                // Update credential_json in database
                sqlx::query("UPDATE passkey_credentials SET credential_json = ? WHERE id = ?")
                    .bind(&updated_json)
                    .bind(&record_id)
                    .execute(pool.get_ref())
                    .await?;
            }
            // Update last_used_at
            PasskeyRepository::update_last_used(&pool, &record_id).await?;
        }
    }

    // Get user info for JWT
    let user = UserRepository::find_by_id(&pool, &user_id)
        .await?
        .ok_or_else(|| AppError::unauthorized("사용자를 찾을 수 없습니다"))?;

    // Create JWT tokens and CSRF token
    let access_token = TokenService::create_access_token(&config, &user.id, &user.email)?;
    let refresh_token = TokenService::create_refresh_token(&pool, &user.id).await?;
    let csrf_token = TokenService::create_csrf_token(&pool, &user.id).await?;

    Ok(HttpResponse::Ok()
        .cookie(
            actix_web::cookie::Cookie::build("access_token", &access_token)
                .path("/")
                .http_only(true)
                .secure(false)
                .same_site(actix_web::cookie::SameSite::Lax)
                .max_age(actix_web::cookie::time::Duration::hours(1))
                .finish(),
        )
        .cookie(
            actix_web::cookie::Cookie::build("refresh_token", &refresh_token)
                .path("/")
                .http_only(true)
                .secure(false)
                .same_site(actix_web::cookie::SameSite::Lax)
                .max_age(actix_web::cookie::time::Duration::days(30))
                .finish(),
        )
        .json(serde_json::json!({
            "userId": user.id,
            "email": user.email,
            "name": user.name,
            "avatarUrl": user.avatar_url,
            "csrfToken": csrf_token,
        })))
}

/// GET /api/webauthn/credentials
async fn list_credentials(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<sqlx::SqlitePool>,
) -> Result<HttpResponse, AppError> {
    let user_id = extract_user_id(&req, &config)?;

    let credentials = PasskeyRepository::find_by_user_id(&pool, &user_id).await?;

    let response: Vec<CredentialResponse> = credentials
        .into_iter()
        .map(|c| CredentialResponse {
            id: c.id,
            name: c.name,
            created_at: c.created_at,
            last_used_at: c.last_used_at,
        })
        .collect();

    Ok(HttpResponse::Ok().json(response))
}

/// DELETE /api/webauthn/credentials/{id}
async fn delete_credential(
    req: HttpRequest,
    config: web::Data<Config>,
    pool: web::Data<sqlx::SqlitePool>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let user_id = extract_user_id(&req, &config)?;
    let credential_id = path.into_inner();

    let deleted = PasskeyRepository::delete(&pool, &credential_id, &user_id).await?;

    if deleted {
        Ok(HttpResponse::Ok().json(serde_json::json!({
            "message": "패스키가 삭제되었습니다"
        })))
    } else {
        Err(AppError::NotFound)
    }
}

// --- Route configuration ---

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
