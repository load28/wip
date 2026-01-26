use async_graphql::{Context, Object, Result};

use crate::graphql::types::project::ProjectType;
use crate::repositories::project_repository::ProjectRepository;

#[derive(Default)]
pub struct ProjectQuery;

#[Object]
impl ProjectQuery {
    async fn project(&self, ctx: &Context<'_>, id: String) -> Result<Option<ProjectType>> {
        let pool = ctx.data::<sqlx::SqlitePool>()?;
        let project = ProjectRepository::find_by_id(pool, &id).await?;
        Ok(project.map(ProjectType::from))
    }

    async fn my_projects(&self, ctx: &Context<'_>) -> Result<Vec<ProjectType>> {
        let pool = ctx.data::<sqlx::SqlitePool>()?;
        let user_id = ctx
            .data::<Option<String>>()?
            .clone()
            .ok_or_else(|| async_graphql::Error::new("Unauthorized"))?;

        let projects = ProjectRepository::find_by_owner(pool, &user_id).await?;
        Ok(projects.into_iter().map(ProjectType::from).collect())
    }
}
