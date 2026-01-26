use async_graphql::{Context, InputObject, Object, Result};

use crate::graphql::types::task::TaskType;
use crate::models::task::{CreateTaskInput, UpdateTaskInput};
use crate::repositories::TaskRepository;

#[derive(InputObject)]
pub struct CreateTaskGqlInput {
    pub title: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub project_id: String,
    pub assignee_id: Option<String>,
    pub parent_id: Option<String>,
    pub due_date: Option<String>,
}

#[derive(InputObject)]
pub struct UpdateTaskGqlInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub assignee_id: Option<String>,
    pub parent_id: Option<String>,
    pub due_date: Option<String>,
}

#[derive(Default)]
pub struct TaskMutation;

#[Object]
impl TaskMutation {
    async fn create_task(&self, ctx: &Context<'_>, input: CreateTaskGqlInput) -> Result<TaskType> {
        let pool = ctx.data::<sqlx::SqlitePool>()?;
        let _user_id = ctx
            .data::<Option<String>>()?
            .clone()
            .ok_or_else(|| async_graphql::Error::new("Unauthorized"))?;

        let task = TaskRepository::create(
            pool,
            CreateTaskInput {
                title: input.title,
                description: input.description,
                status: input.status,
                priority: input.priority,
                project_id: input.project_id,
                assignee_id: input.assignee_id,
                parent_id: input.parent_id,
                due_date: input.due_date,
            },
        )
        .await?;

        Ok(TaskType::from(task))
    }

    async fn update_task(
        &self,
        ctx: &Context<'_>,
        id: String,
        input: UpdateTaskGqlInput,
    ) -> Result<TaskType> {
        let pool = ctx.data::<sqlx::SqlitePool>()?;
        let _user_id = ctx
            .data::<Option<String>>()?
            .clone()
            .ok_or_else(|| async_graphql::Error::new("Unauthorized"))?;

        let task = TaskRepository::update(
            pool,
            &id,
            UpdateTaskInput {
                title: input.title,
                description: input.description,
                status: input.status,
                priority: input.priority,
                assignee_id: input.assignee_id,
                parent_id: input.parent_id,
                due_date: input.due_date,
            },
        )
        .await?;

        Ok(TaskType::from(task))
    }

    async fn delete_task(&self, ctx: &Context<'_>, id: String) -> Result<bool> {
        let pool = ctx.data::<sqlx::SqlitePool>()?;
        let _user_id = ctx
            .data::<Option<String>>()?
            .clone()
            .ok_or_else(|| async_graphql::Error::new("Unauthorized"))?;

        TaskRepository::delete(pool, &id).await?;
        Ok(true)
    }
}
