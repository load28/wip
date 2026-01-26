use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone)]
pub struct CreateProject {
    pub name: String,
    pub description: Option<String>,
    pub owner_id: String,
}

#[derive(Debug, Clone)]
pub struct UpdateProject {
    pub name: Option<String>,
    pub description: Option<String>,
}
