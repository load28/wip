use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PasskeyCredential {
    pub id: String,
    pub user_id: String,
    pub credential_id: String,
    pub passkey_json: String,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Clone)]
pub struct CreatePasskeyCredential {
    pub user_id: String,
    pub credential_id: String,
    pub passkey_json: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct WebauthnChallenge {
    pub id: String,
    pub user_id: Option<String>,
    pub challenge_state: String,
    pub challenge_type: String,
    pub expires_at: String,
    pub created_at: String,
}
