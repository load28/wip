use async_graphql::{Context, InputObject, Object, Result};

use crate::graphql::types::project::ProjectType;
use crate::models::project::{CreateProject, UpdateProject};
use crate::repositories::project_repository::ProjectRepository;

#[derive(InputObject)]
pub struct CreateProjectInput {
    pub name: String,
    pub description: Option<String>,
}

#[derive(InputObject)]
pub struct UpdateProjectInput {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Default)]
pub struct ProjectMutation;

#[Object]
impl ProjectMutation {
    async fn create_project(
        &self,
        ctx: &Context<'_>,
        input: CreateProjectInput,
    ) -> Result<ProjectType> {
        let pool = ctx.data::<sqlx::SqlitePool>()?;
        let user_id = ctx
            .data::<Option<String>>()?
            .clone()
            .ok_or_else(|| async_graphql::Error::new("Unauthorized"))?;

        let project = ProjectRepository::create(
            pool,
            CreateProject {
                name: input.name,
                description: input.description,
                owner_id: user_id,
            },
        )
        .await?;

        Ok(ProjectType::from(project))
    }

    async fn update_project(
        &self,
        ctx: &Context<'_>,
        input: UpdateProjectInput,
    ) -> Result<ProjectType> {
        let pool = ctx.data::<sqlx::SqlitePool>()?;
        let user_id = ctx
            .data::<Option<String>>()?
            .clone()
            .ok_or_else(|| async_graphql::Error::new("Unauthorized"))?;

        let project = ProjectRepository::find_by_id(pool, &input.id)
            .await?
            .ok_or_else(|| async_graphql::Error::new("Project not found"))?;

        if project.owner_id != user_id {
            return Err(async_graphql::Error::new("Forbidden"));
        }

        let updated = ProjectRepository::update(
            pool,
            &input.id,
            UpdateProject {
                name: input.name,
                description: input.description,
            },
        )
        .await?;

        Ok(ProjectType::from(updated))
    }

    async fn delete_project(&self, ctx: &Context<'_>, id: String) -> Result<bool> {
        let pool = ctx.data::<sqlx::SqlitePool>()?;
        let user_id = ctx
            .data::<Option<String>>()?
            .clone()
            .ok_or_else(|| async_graphql::Error::new("Unauthorized"))?;

        let project = ProjectRepository::find_by_id(pool, &id)
            .await?
            .ok_or_else(|| async_graphql::Error::new("Project not found"))?;

        if project.owner_id != user_id {
            return Err(async_graphql::Error::new("Forbidden"));
        }

        ProjectRepository::delete(pool, &id).await?;
        Ok(true)
    }
}
