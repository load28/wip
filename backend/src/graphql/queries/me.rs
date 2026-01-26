use async_graphql::{Context, Object, Result};
use sqlx::SqlitePool;

use crate::config::Config;
use crate::graphql::types::UserType;
use crate::repositories::UserRepository;
use crate::services::TokenService;

/// 액세스 토큰을 Context로 전달하기 위한 래퍼
pub struct AccessTokenData(pub String);

#[derive(Default)]
pub struct MeQuery;

#[Object]
impl MeQuery {
    /// 현재 로그인한 사용자 정보
    async fn me(&self, ctx: &Context<'_>) -> Result<Option<UserType>> {
        let config = ctx.data::<Config>()?;
        let pool = ctx.data::<SqlitePool>()?;

        // 쿠키에서 access_token 추출 (Context data로 전달됨)
        let access_token = match ctx.data_opt::<AccessTokenData>() {
            Some(token_data) => &token_data.0,
            None => return Ok(None),
        };

        // 토큰 검증
        let claims = match TokenService::verify_access_token(config, access_token) {
            Ok(claims) => claims,
            Err(_) => return Ok(None),
        };

        // 사용자 조회
        let user = UserRepository::find_by_id(pool, &claims.sub)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        Ok(user.map(|u| u.into()))
    }
}
