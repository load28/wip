use async_graphql::{Context, Object, Result};

use crate::graphql::types::task::TaskType;
use crate::repositories::TaskRepository;

#[derive(Default)]
pub struct TaskQuery;

#[Object]
impl TaskQuery {
    async fn task(&self, ctx: &Context<'_>, id: String) -> Result<Option<TaskType>> {
        let pool = ctx.data::<sqlx::SqlitePool>()?;
        let task = TaskRepository::find_by_id(pool, &id).await?;
        Ok(task.map(TaskType::from))
    }

    async fn tasks_by_project(
        &self,
        ctx: &Context<'_>,
        project_id: String,
    ) -> Result<Vec<TaskType>> {
        let pool = ctx.data::<sqlx::SqlitePool>()?;
        let tasks = TaskRepository::find_by_project(pool, &project_id).await?;
        Ok(tasks.into_iter().map(TaskType::from).collect())
    }

    async fn my_tasks(&self, ctx: &Context<'_>) -> Result<Vec<TaskType>> {
        let pool = ctx.data::<sqlx::SqlitePool>()?;
        let user_id = ctx
            .data::<Option<String>>()?
            .clone()
            .ok_or_else(|| async_graphql::Error::new("Unauthorized"))?;

        let tasks = TaskRepository::find_by_assignee(pool, &user_id).await?;
        Ok(tasks.into_iter().map(TaskType::from).collect())
    }
}
