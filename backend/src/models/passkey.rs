use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PasskeyCredential {
    pub id: String,
    pub user_id: String,
    pub credential_id: String,
    pub public_key: Vec<u8>,
    pub sign_count: i64,
    pub aaguid: Option<String>,
    pub created_at: String,
    pub last_used: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct WebAuthnChallenge {
    pub id: String,
    pub challenge: String,
    pub user_id: Option<String>,
    #[sqlx(rename = "type")]
    pub challenge_type: String,
    pub expires_at: String,
    pub created_at: String,
}
