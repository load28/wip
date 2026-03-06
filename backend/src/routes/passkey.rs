use actix_web::{web, HttpRequest, HttpResponse};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use serde::Deserialize;
use sqlx::SqlitePool;

use crate::config::Config;
use crate::repositories::{PasskeyRepository, UserRepository};
use crate::services::{
    webauthn_service::{AuthenticationResponse, RegistrationResponse},
    TokenService, WebAuthnService,
};

/// POST /api/passkey/register/options
/// 로그인된 사용자가 패스키를 등록하기 위한 옵션 요청
pub async fn registration_options(
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    req: HttpRequest,
) -> HttpResponse {
    // 쿠키에서 access_token 추출하여 사용자 확인
    let access_token = match req.cookie("access_token") {
        Some(c) => c.value().to_string(),
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "인증이 필요합니다"})),
    };

    let claims = match TokenService::verify_access_token(&config, &access_token) {
        Ok(c) => c,
        Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "유효하지 않은 토큰입니다"})),
    };

    let user = match UserRepository::find_by_id(&pool, &claims.sub).await {
        Ok(Some(u)) => u,
        _ => return HttpResponse::NotFound().json(serde_json::json!({"error": "사용자를 찾을 수 없습니다"})),
    };

    // 이미 등록된 credential 제외
    let existing_creds = PasskeyRepository::find_by_user_id(&pool, &user.id)
        .await
        .unwrap_or_default();

    let exclude_ids: Vec<String> = existing_creds
        .iter()
        .map(|c| URL_SAFE_NO_PAD.encode(&c.credential_id))
        .collect();

    let options = WebAuthnService::create_registration_options(
        &config,
        &user.id,
        &user.email,
        &user.name,
        exclude_ids,
    );

    // Challenge 저장
    if let Err(e) = PasskeyRepository::store_challenge(
        &pool,
        &options.challenge,
        Some(&user.id),
        "registration",
    )
    .await
    {
        tracing::error!("챌린지 저장 실패: {}", e);
        return HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": "서버 오류"}));
    }

    HttpResponse::Ok().json(options)
}

/// POST /api/passkey/register/complete
/// 패스키 등록 완료
pub async fn registration_complete(
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    req: HttpRequest,
    body: web::Json<RegistrationResponse>,
) -> HttpResponse {
    // 사용자 인증 확인
    let access_token = match req.cookie("access_token") {
        Some(c) => c.value().to_string(),
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "인증이 필요합니다"})),
    };

    let claims = match TokenService::verify_access_token(&config, &access_token) {
        Ok(c) => c,
        Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "유효하지 않은 토큰입니다"})),
    };

    // 챌린지 검증 및 소비
    // 먼저 사용자의 registration 챌린지를 가져와야 하므로 body에서 clientDataJSON을 파싱
    let client_data_bytes = match URL_SAFE_NO_PAD.decode(&body.response.client_data_json) {
        Ok(b) => b,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": "clientDataJSON 디코딩 실패"}))
        }
    };

    #[derive(Deserialize)]
    struct ClientDataPartial {
        challenge: String,
    }

    let client_data: ClientDataPartial = match serde_json::from_slice(&client_data_bytes) {
        Ok(c) => c,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": "clientDataJSON 파싱 실패"}))
        }
    };

    // 챌린지 검증 (일회용으로 소비)
    match PasskeyRepository::verify_and_consume_challenge(&pool, &client_data.challenge, "registration").await {
        Ok(Some(user_id)) if user_id == claims.sub => {}
        Ok(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": "챌린지 사용자 불일치"}))
        }
        Err(e) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": e.to_string()}))
        }
    }

    // WebAuthn 등록 검증
    let result = match WebAuthnService::verify_registration(&config, &body, &client_data.challenge) {
        Ok(r) => r,
        Err(e) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": e.to_string()}))
        }
    };

    let credential_id_b64 = URL_SAFE_NO_PAD.encode(&result.credential_id);
    let aaguid_hex = result
        .aaguid
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>();

    // DB에 저장
    match PasskeyRepository::create_credential(
        &pool,
        &claims.sub,
        &credential_id_b64,
        &result.public_key,
        Some(&aaguid_hex),
    )
    .await
    {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({"status": "ok"})),
        Err(e) => {
            tracing::error!("패스키 저장 실패: {}", e);
            HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": "패스키 저장 실패"}))
        }
    }
}

/// POST /api/passkey/authenticate/options
/// 패스키 인증 옵션 요청 (로그인 전)
pub async fn authentication_options(
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    let options = WebAuthnService::create_authentication_options(&config);

    // Challenge 저장
    if let Err(e) =
        PasskeyRepository::store_challenge(&pool, &options.challenge, None, "authentication").await
    {
        tracing::error!("챌린지 저장 실패: {}", e);
        return HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": "서버 오류"}));
    }

    HttpResponse::Ok().json(options)
}

/// POST /api/passkey/authenticate/complete
/// 패스키 인증 완료 (로그인)
pub async fn authentication_complete(
    config: web::Data<Config>,
    pool: web::Data<SqlitePool>,
    body: web::Json<AuthenticationResponse>,
) -> HttpResponse {
    // clientDataJSON에서 challenge 추출
    let client_data_bytes = match URL_SAFE_NO_PAD.decode(&body.response.client_data_json) {
        Ok(b) => b,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": "clientDataJSON 디코딩 실패"}))
        }
    };

    #[derive(Deserialize)]
    struct ClientDataPartial {
        challenge: String,
    }

    let client_data: ClientDataPartial = match serde_json::from_slice(&client_data_bytes) {
        Ok(c) => c,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": "clientDataJSON 파싱 실패"}))
        }
    };

    // 챌린지 검증 (일회용으로 소비)
    if let Err(e) =
        PasskeyRepository::verify_and_consume_challenge(&pool, &client_data.challenge, "authentication")
            .await
    {
        return HttpResponse::BadRequest()
            .json(serde_json::json!({"error": e.to_string()}));
    }

    // credential_id로 저장된 공개 키 조회
    let credential = match PasskeyRepository::find_by_credential_id(&pool, &body.id).await {
        Ok(Some(c)) => c,
        Ok(None) => {
            return HttpResponse::Unauthorized()
                .json(serde_json::json!({"error": "등록되지 않은 패스키입니다"}))
        }
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": e.to_string()}))
        }
    };

    // WebAuthn 인증 검증
    let result = match WebAuthnService::verify_authentication(
        &config,
        &body,
        &client_data.challenge,
        &credential.public_key,
        credential.sign_count,
    ) {
        Ok(r) => r,
        Err(e) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": e.to_string()}))
        }
    };

    // signCount 업데이트
    if let Err(e) = PasskeyRepository::update_sign_count(
        &pool,
        &result.credential_id,
        result.new_sign_count as i64,
    )
    .await
    {
        tracing::warn!("signCount 업데이트 실패: {}", e);
    }

    // 사용자 조회
    let user = match UserRepository::find_by_id(&pool, &credential.user_id).await {
        Ok(Some(u)) => u,
        _ => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": "사용자를 찾을 수 없습니다"}))
        }
    };

    // 토큰 생성
    let access_token = match TokenService::create_access_token(&config, &user.id, &user.email) {
        Ok(t) => t,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": e.to_string()}))
        }
    };

    let refresh_token = match TokenService::create_refresh_token(&pool, &user.id).await {
        Ok(t) => t,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": e.to_string()}))
        }
    };

    let csrf_token = match TokenService::create_csrf_token(&pool, &user.id).await {
        Ok(t) => t,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": e.to_string()}))
        }
    };

    // 쿠키 설정
    HttpResponse::Ok()
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
        .json(serde_json::json!({
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "avatarUrl": user.avatar_url,
            },
            "csrfToken": csrf_token,
        }))
}

/// Passkey 라우트 설정
pub fn passkey_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/passkey")
            .route("/register/options", web::post().to(registration_options))
            .route("/register/complete", web::post().to(registration_complete))
            .route(
                "/authenticate/options",
                web::post().to(authentication_options),
            )
            .route(
                "/authenticate/complete",
                web::post().to(authentication_complete),
            ),
    );
}
