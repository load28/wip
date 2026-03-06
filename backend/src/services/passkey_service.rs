use sqlx::SqlitePool;
use url::Url;
use uuid::Uuid;
use webauthn_rs::prelude::*;
use webauthn_rs::Webauthn;

use crate::config::Config;
use crate::error::AppError;
use crate::models::passkey::CreatePasskeyCredential;
use crate::repositories::PasskeyRepository;

pub struct PasskeyService;

impl PasskeyService {
    /// Webauthn 인스턴스 생성
    fn create_webauthn(config: &Config) -> Result<Webauthn, AppError> {
        let rp_id = &config.webauthn_rp_id;
        let rp_origin =
            Url::parse(&config.webauthn_rp_origin).map_err(|e| AppError::Internal(e.to_string()))?;

        let builder = WebauthnBuilder::new(rp_id, &rp_origin)
            .map_err(|e| AppError::Internal(e.to_string()))?
            .rp_name(&config.webauthn_rp_name);

        builder
            .build()
            .map_err(|e| AppError::Internal(e.to_string()))
    }

    /// 패스키 등록 시작 - CreationChallengeResponse 반환
    pub async fn start_registration(
        config: &Config,
        pool: &SqlitePool,
        user_id: &str,
        user_name: &str,
        user_display_name: &str,
    ) -> Result<(String, String), AppError> {
        let webauthn = Self::create_webauthn(config)?;

        // 기존 패스키 조회 (중복 등록 방지)
        let existing_credentials = PasskeyRepository::find_by_user_id(pool, user_id).await?;
        let exclude_credentials: Vec<Passkey> = existing_credentials
            .iter()
            .filter_map(|c| serde_json::from_str(&c.passkey_json).ok())
            .collect();

        let user_unique_id =
            Uuid::parse_str(user_id).unwrap_or_else(|_| {
                // user_id가 UUID 형식이 아닌 경우 해시로 변환
                Uuid::new_v5(&Uuid::NAMESPACE_OID, user_id.as_bytes())
            });

        let exclude_refs: Vec<CredentialID> = exclude_credentials
            .iter()
            .map(|p| p.cred_id().clone())
            .collect();

        let (ccr, reg_state) = webauthn
            .start_passkey_registration(
                user_unique_id,
                user_name,
                user_display_name,
                Some(exclude_refs),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        // 챌린지 상태 저장
        let state_json = serde_json::to_string(&reg_state)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        let challenge_id =
            PasskeyRepository::save_challenge(pool, Some(user_id), &state_json, "registration")
                .await?;

        // CreationChallengeResponse를 JSON 문자열로 반환
        let ccr_json =
            serde_json::to_string(&ccr).map_err(|e| AppError::Internal(e.to_string()))?;

        Ok((challenge_id, ccr_json))
    }

    /// 패스키 등록 완료
    pub async fn finish_registration(
        config: &Config,
        pool: &SqlitePool,
        challenge_id: &str,
        credential_name: &str,
        reg_response_json: &str,
    ) -> Result<(), AppError> {
        let webauthn = Self::create_webauthn(config)?;

        // 챌린지 상태 복원
        let challenge = PasskeyRepository::consume_challenge(pool, challenge_id).await?;

        if challenge.challenge_type != "registration" {
            return Err(AppError::bad_request("잘못된 챌린지 타입입니다"));
        }

        let user_id = challenge
            .user_id
            .ok_or_else(|| AppError::bad_request("사용자 ID가 없습니다"))?;

        let reg_state: PasskeyRegistration = serde_json::from_str(&challenge.challenge_state)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let reg_response: RegisterPublicKeyCredential =
            serde_json::from_str(reg_response_json)
                .map_err(|e| AppError::bad_request(format!("잘못된 등록 응답입니다: {}", e)))?;

        // WebAuthn 등록 완료 검증
        let passkey = webauthn
            .finish_passkey_registration(&reg_response, &reg_state)
            .map_err(|e| AppError::bad_request(format!("패스키 등록 검증 실패: {}", e)))?;

        // 크레덴셜 ID를 JSON으로 직렬화하여 저장
        let credential_id_str = serde_json::to_string(passkey.cred_id())
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let passkey_json =
            serde_json::to_string(&passkey).map_err(|e| AppError::Internal(e.to_string()))?;

        PasskeyRepository::create(
            pool,
            CreatePasskeyCredential {
                user_id,
                credential_id: credential_id_str,
                passkey_json,
                name: credential_name.to_string(),
            },
        )
        .await?;

        Ok(())
    }

    /// 패스키 인증 시작 - RequestChallengeResponse 반환
    pub async fn start_authentication(
        config: &Config,
        pool: &SqlitePool,
    ) -> Result<(String, String), AppError> {
        let webauthn = Self::create_webauthn(config)?;

        // 모든 패스키 크레덴셜 조회
        let all_credentials = PasskeyRepository::find_all(pool).await?;

        if all_credentials.is_empty() {
            return Err(AppError::bad_request("등록된 패스키가 없습니다"));
        }

        let passkeys: Vec<Passkey> = all_credentials
            .iter()
            .filter_map(|c| serde_json::from_str(&c.passkey_json).ok())
            .collect();

        if passkeys.is_empty() {
            return Err(AppError::bad_request("유효한 패스키가 없습니다"));
        }

        let (rcr, auth_state) = webauthn
            .start_passkey_authentication(&passkeys)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        // 챌린지 상태 저장
        let state_json = serde_json::to_string(&auth_state)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        let challenge_id =
            PasskeyRepository::save_challenge(pool, None, &state_json, "authentication").await?;

        // RequestChallengeResponse를 JSON 문자열로 반환
        let rcr_json =
            serde_json::to_string(&rcr).map_err(|e| AppError::Internal(e.to_string()))?;

        Ok((challenge_id, rcr_json))
    }

    /// 패스키 인증 완료 - 인증된 사용자 ID 반환
    pub async fn finish_authentication(
        config: &Config,
        pool: &SqlitePool,
        challenge_id: &str,
        auth_response_json: &str,
    ) -> Result<String, AppError> {
        let webauthn = Self::create_webauthn(config)?;

        // 챌린지 상태 복원
        let challenge = PasskeyRepository::consume_challenge(pool, challenge_id).await?;

        if challenge.challenge_type != "authentication" {
            return Err(AppError::bad_request("잘못된 챌린지 타입입니다"));
        }

        let auth_state: PasskeyAuthentication =
            serde_json::from_str(&challenge.challenge_state)
                .map_err(|e| AppError::Internal(e.to_string()))?;

        let auth_response: PublicKeyCredential = serde_json::from_str(auth_response_json)
            .map_err(|e| AppError::bad_request(format!("잘못된 인증 응답입니다: {}", e)))?;

        // WebAuthn 인증 완료 검증
        let auth_result = webauthn
            .finish_passkey_authentication(&auth_response, &auth_state)
            .map_err(|e| AppError::unauthorized(format!("패스키 인증 검증 실패: {}", e)))?;

        // 인증된 크레덴셜 ID로 사용자 찾기
        let credential_id_str = serde_json::to_string(auth_result.cred_id())
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let all_credentials = PasskeyRepository::find_all(pool).await?;
        let matched_credential = all_credentials
            .iter()
            .find(|c| c.credential_id == credential_id_str)
            .ok_or_else(|| AppError::unauthorized("일치하는 패스키를 찾을 수 없습니다"))?;

        let user_id = matched_credential.user_id.clone();

        // sign_count 등 업데이트된 패스키 정보 저장
        // 기존 패스키를 업데이트하여 counter를 반영
        if let Some(updated_passkey_json) = all_credentials
            .iter()
            .find(|c| c.credential_id == credential_id_str)
            .and_then(|c| {
                let mut passkey: Passkey = serde_json::from_str(&c.passkey_json).ok()?;
                passkey.update_credential(&auth_result);
                serde_json::to_string(&passkey).ok()
            })
        {
            PasskeyRepository::update_passkey_json(pool, &credential_id_str, &updated_passkey_json)
                .await?;
        }

        Ok(user_id)
    }
}
