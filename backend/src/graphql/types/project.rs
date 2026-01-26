use async_graphql::{ComplexObject, Context, Result, SimpleObject};

use crate::graphql::types::user::UserType;
use crate::models::project::Project;
use crate::repositories::user_repository::UserRepository;

#[derive(SimpleObject)]
#[graphql(complex)]
pub struct ProjectType {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: String,
    pub created_at: String,
    pub updated_at: String,
}

#[ComplexObject]
impl ProjectType {
    async fn owner(&self, ctx: &Context<'_>) -> Result<Option<UserType>> {
        let pool = ctx.data::<sqlx::SqlitePool>()?;
        let user = UserRepository::find_by_id(pool, &self.owner_id).await?;
        Ok(user.map(UserType::from))
    }
}

impl From<Project> for ProjectType {
    fn from(project: Project) -> Self {
        Self {
            id: project.id,
            name: project.name,
            description: project.description,
            owner_id: project.owner_id,
            created_at: project.created_at,
            updated_at: project.updated_at,
        }
    }
}
