use reqwest::Client;
use serde::Deserialize;

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
    pub async fn exchange_code(
        config: &Config,
        code: &str,
        redirect_uri: &str,
    ) -> Result<GoogleTokenResponse, AppError> {
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
