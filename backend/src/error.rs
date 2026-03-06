use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("인증 실패: {0}")]
    Unauthorized(String),

    #[error("잘못된 요청: {0}")]
    BadRequest(String),

    #[error("리소스를 찾을 수 없습니다")]
    NotFound,

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
