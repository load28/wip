use async_graphql::{Context, Object, Result, SimpleObject};
use sqlx::SqlitePool;

use crate::config::Config;
use crate::graphql::queries::me::AccessTokenData;
use crate::graphql::types::UserType;
use crate::repositories::{PasskeyRepository, UserRepository};
use crate::services::{PasskeyService, TokenService};

/// 패스키 등록 시작 응답
#[derive(SimpleObject)]
pub struct StartPasskeyRegistrationPayload {
    /// 챌린지 ID (finish 호출 시 필요)
    pub challenge_id: String,
    /// WebAuthn CreationChallengeResponse (JSON 문자열)
    pub options_json: String,
}

/// 패스키 인증 시작 응답
#[derive(SimpleObject)]
pub struct StartPasskeyAuthenticationPayload {
    /// 챌린지 ID (finish 호출 시 필요)
    pub challenge_id: String,
    /// WebAuthn RequestChallengeResponse (JSON 문자열)
    pub options_json: String,
}

/// 패스키 인증 완료 응답 (로그인)
#[derive(SimpleObject)]
pub struct PasskeyLoginPayload {
    pub user: UserType,
    pub csrf_token: String,
}

/// 패스키 크레덴셜 정보
#[derive(SimpleObject)]
pub struct PasskeyCredentialType {
    pub id: String,
    pub name: String,
    pub created_at: String,
}

#[derive(Default)]
pub struct PasskeyMutation;

#[Object]
impl PasskeyMutation {
    /// 패스키 등록 시작 (로그인된 사용자만)
    async fn start_passkey_registration(
        &self,
        ctx: &Context<'_>,
    ) -> Result<StartPasskeyRegistrationPayload> {
        let config = ctx.data::<Config>()?;
        let pool = ctx.data::<SqlitePool>()?;

        // 로그인된 사용자 확인
        let access_token = ctx
            .data_opt::<AccessTokenData>()
            .map(|d| d.0.as_str())
            .ok_or_else(|| async_graphql::Error::new("로그인이 필요합니다"))?;

        let claims = TokenService::verify_access_token(config, access_token)
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        let user = UserRepository::find_by_id(pool, &claims.sub)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?
            .ok_or_else(|| async_graphql::Error::new("사용자를 찾을 수 없습니다"))?;

        let (challenge_id, options_json) = PasskeyService::start_registration(
            config,
            pool,
            &user.id,
            &user.email,
            &user.name,
        )
        .await
        .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        Ok(StartPasskeyRegistrationPayload {
            challenge_id,
            options_json,
        })
    }

    /// 패스키 등록 완료
    async fn finish_passkey_registration(
        &self,
        ctx: &Context<'_>,
        challenge_id: String,
        credential_json: String,
        #[graphql(default = "My Passkey")] name: String,
    ) -> Result<bool> {
        let config = ctx.data::<Config>()?;
        let pool = ctx.data::<SqlitePool>()?;

        PasskeyService::finish_registration(config, pool, &challenge_id, &name, &credential_json)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        Ok(true)
    }

    /// 패스키 인증 시작 (로그인 전)
    async fn start_passkey_authentication(
        &self,
        ctx: &Context<'_>,
    ) -> Result<StartPasskeyAuthenticationPayload> {
        let config = ctx.data::<Config>()?;
        let pool = ctx.data::<SqlitePool>()?;

        let (challenge_id, options_json) =
            PasskeyService::start_authentication(config, pool)
                .await
                .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        Ok(StartPasskeyAuthenticationPayload {
            challenge_id,
            options_json,
        })
    }

    /// 패스키 인증 완료 (로그인)
    async fn finish_passkey_authentication(
        &self,
        ctx: &Context<'_>,
        challenge_id: String,
        credential_json: String,
    ) -> Result<PasskeyLoginPayload> {
        let config = ctx.data::<Config>()?;
        let pool = ctx.data::<SqlitePool>()?;

        let user_id = PasskeyService::finish_authentication(
            config,
            pool,
            &challenge_id,
            &credential_json,
        )
        .await
        .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        // 사용자 조회
        let user = UserRepository::find_by_id(pool, &user_id)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?
            .ok_or_else(|| async_graphql::Error::new("사용자를 찾을 수 없습니다"))?;

        // 토큰 생성
        let access_token = TokenService::create_access_token(config, &user.id, &user.email)
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        let refresh_token = TokenService::create_refresh_token(pool, &user.id)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        let csrf_token = TokenService::create_csrf_token(pool, &user.id)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        // 쿠키 설정
        ctx.insert_http_header(
            "Set-Cookie",
            format!(
                "access_token={}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600",
                access_token
            ),
        );
        ctx.insert_http_header(
            "Set-Cookie",
            format!(
                "refresh_token={}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000",
                refresh_token
            ),
        );

        Ok(PasskeyLoginPayload {
            user: user.into(),
            csrf_token,
        })
    }

    /// 패스키 삭제
    async fn delete_passkey(
        &self,
        ctx: &Context<'_>,
        passkey_id: String,
    ) -> Result<bool> {
        let config = ctx.data::<Config>()?;
        let pool = ctx.data::<SqlitePool>()?;

        // 로그인된 사용자 확인
        let access_token = ctx
            .data_opt::<AccessTokenData>()
            .map(|d| d.0.as_str())
            .ok_or_else(|| async_graphql::Error::new("로그인이 필요합니다"))?;

        let claims = TokenService::verify_access_token(config, access_token)
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        let deleted = PasskeyRepository::delete(pool, &passkey_id, &claims.sub)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        Ok(deleted)
    }

    /// 내 패스키 목록 조회
    async fn my_passkeys(&self, ctx: &Context<'_>) -> Result<Vec<PasskeyCredentialType>> {
        let config = ctx.data::<Config>()?;
        let pool = ctx.data::<SqlitePool>()?;

        let access_token = ctx
            .data_opt::<AccessTokenData>()
            .map(|d| d.0.as_str())
            .ok_or_else(|| async_graphql::Error::new("로그인이 필요합니다"))?;

        let claims = TokenService::verify_access_token(config, access_token)
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        let credentials = PasskeyRepository::find_by_user_id(pool, &claims.sub)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        Ok(credentials
            .into_iter()
            .map(|c| PasskeyCredentialType {
                id: c.id,
                name: c.name,
                created_at: c.created_at,
            })
            .collect())
    }
}
