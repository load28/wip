use async_graphql::{ComplexObject, Context, Result, SimpleObject};

use crate::graphql::types::project::ProjectType;
use crate::graphql::types::user::UserType;
use crate::models::task::Task;
use crate::repositories::ProjectRepository;
use crate::repositories::TaskRepository;
use crate::repositories::UserRepository;

#[derive(SimpleObject)]
#[graphql(complex)]
pub struct TaskType {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub project_id: String,
    pub assignee_id: Option<String>,
    pub parent_id: Option<String>,
    pub due_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[ComplexObject]
impl TaskType {
    async fn project(&self, ctx: &Context<'_>) -> Result<Option<ProjectType>> {
        let pool = ctx.data::<sqlx::SqlitePool>()?;
        let project = ProjectRepository::find_by_id(pool, &self.project_id).await?;
        Ok(project.map(ProjectType::from))
    }

    async fn assignee(&self, ctx: &Context<'_>) -> Result<Option<UserType>> {
        if let Some(assignee_id) = &self.assignee_id {
            let pool = ctx.data::<sqlx::SqlitePool>()?;
            let user = UserRepository::find_by_id(pool, assignee_id).await?;
            Ok(user.map(UserType::from))
        } else {
            Ok(None)
        }
    }

    async fn parent(&self, ctx: &Context<'_>) -> Result<Option<TaskType>> {
        if let Some(parent_id) = &self.parent_id {
            let pool = ctx.data::<sqlx::SqlitePool>()?;
            let task = TaskRepository::find_by_id(pool, parent_id).await?;
            Ok(task.map(TaskType::from))
        } else {
            Ok(None)
        }
    }

    async fn subtasks(&self, ctx: &Context<'_>) -> Result<Vec<TaskType>> {
        let pool = ctx.data::<sqlx::SqlitePool>()?;
        let tasks = TaskRepository::find_subtasks(pool, &self.id).await?;
        Ok(tasks.into_iter().map(TaskType::from).collect())
    }
}

impl From<Task> for TaskType {
    fn from(task: Task) -> Self {
        Self {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            project_id: task.project_id,
            assignee_id: task.assignee_id,
            parent_id: task.parent_id,
            due_date: task.due_date,
            created_at: task.created_at,
            updated_at: task.updated_at,
        }
    }
}
