use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PasskeyCredential {
    pub id: String,
    pub user_id: String,
    pub credential_json: String,
    pub name: String,
    pub created_at: String,
    pub last_used_at: Option<String>,
}
