use async_graphql::{Context, Object, Result, SimpleObject};
use sqlx::SqlitePool;

use crate::config::Config;
use crate::graphql::types::UserType;
use crate::models::user::CreateUser;
use crate::repositories::UserRepository;
use crate::services::{GoogleAuthService, TokenService};

#[derive(SimpleObject)]
pub struct LoginPayload {
    pub user: UserType,
    pub csrf_token: String,
}

#[derive(Default)]
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
        let token_response = GoogleAuthService::exchange_code(config, &code, &redirect_uri)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        // 2. 사용자 정보 조회
        let google_user = GoogleAuthService::get_user_info(&token_response.access_token)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        // 3. 사용자 조회 또는 생성
        let user = match UserRepository::find_by_google_id(pool, &google_user.id)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?
        {
            Some(existing_user) => {
                // 기존 사용자 정보 업데이트
                UserRepository::update(
                    pool,
                    &existing_user.id,
                    &google_user.name,
                    google_user.picture.as_deref(),
                )
                .await
                .map_err(|e| async_graphql::Error::new(e.to_string()))?;

                existing_user
            }
            None => {
                // 새 사용자 생성
                UserRepository::create(
                    pool,
                    CreateUser {
                        email: google_user.email,
                        name: google_user.name,
                        avatar_url: google_user.picture,
                        google_id: google_user.id,
                    },
                )
                .await
                .map_err(|e| async_graphql::Error::new(e.to_string()))?
            }
        };

        // 4. 토큰 생성
        let access_token = TokenService::create_access_token(config, &user.id, &user.email)
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        let refresh_token = TokenService::create_refresh_token(pool, &user.id)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        let csrf_token = TokenService::create_csrf_token(pool, &user.id)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        // 5. 쿠키 설정 (Context에 저장하여 나중에 응답에 추가)
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

        Ok(LoginPayload {
            user: user.into(),
            csrf_token,
        })
    }

    /// 토큰 갱신
    async fn refresh_token(&self, ctx: &Context<'_>) -> Result<bool> {
        let config = ctx.data::<Config>()?;
        let pool = ctx.data::<SqlitePool>()?;

        // 쿠키에서 refresh_token 추출 (Context data로 전달됨)
        let refresh_token = ctx
            .data_opt::<RefreshTokenData>()
            .map(|d| d.0.as_str())
            .ok_or_else(|| async_graphql::Error::new("리프레시 토큰이 없습니다"))?;

        // 토큰 검증
        let user_id = TokenService::verify_refresh_token(pool, refresh_token)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        // 사용자 조회
        let user = UserRepository::find_by_id(pool, &user_id)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?
            .ok_or_else(|| async_graphql::Error::new("사용자를 찾을 수 없습니다"))?;

        // 새 토큰 생성
        let new_access_token = TokenService::create_access_token(config, &user.id, &user.email)
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        let new_refresh_token = TokenService::create_refresh_token(pool, &user.id)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        // 쿠키 설정
        ctx.insert_http_header(
            "Set-Cookie",
            format!(
                "access_token={}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600",
                new_access_token
            ),
        );
        ctx.insert_http_header(
            "Set-Cookie",
            format!(
                "refresh_token={}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000",
                new_refresh_token
            ),
        );

        Ok(true)
    }

    /// 로그아웃
    async fn logout(&self, ctx: &Context<'_>) -> Result<bool> {
        // 쿠키 삭제
        ctx.insert_http_header(
            "Set-Cookie",
            "access_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
        );
        ctx.insert_http_header(
            "Set-Cookie",
            "refresh_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
        );

        Ok(true)
    }
}

/// 리프레시 토큰을 Context로 전달하기 위한 래퍼
pub struct RefreshTokenData(pub String);
