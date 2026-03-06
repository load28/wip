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
        let frontend_url =
            env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());

        Self {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "sqlite:./data.db".to_string()),
            jwt_secret: env::var("JWT_SECRET").expect("JWT_SECRET must be set"),
            google_client_id: env::var("GOOGLE_CLIENT_ID").expect("GOOGLE_CLIENT_ID must be set"),
            google_client_secret: env::var("GOOGLE_CLIENT_SECRET")
                .expect("GOOGLE_CLIENT_SECRET must be set"),
            webauthn_rp_id: env::var("WEBAUTHN_RP_ID").unwrap_or_else(|_| "localhost".to_string()),
            webauthn_rp_origin: env::var("WEBAUTHN_RP_ORIGIN")
                .unwrap_or_else(|_| frontend_url.clone()),
            frontend_url,
        }
    }
}
