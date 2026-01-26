use async_graphql::{EmptySubscription, MergedObject, Schema};

use super::mutations::{AuthMutation, ProjectMutation, TaskMutation};
use super::queries::{MeQuery, ProjectQuery, TaskQuery};

#[derive(MergedObject, Default)]
pub struct QueryRoot(pub MeQuery, pub ProjectQuery, pub TaskQuery);

#[derive(MergedObject, Default)]
pub struct MutationRoot(pub AuthMutation, pub ProjectMutation, pub TaskMutation);

pub type AppSchema = Schema<QueryRoot, MutationRoot, EmptySubscription>;

pub fn create_schema() -> AppSchema {
    Schema::build(
        QueryRoot(
            MeQuery::default(),
            ProjectQuery::default(),
            TaskQuery::default(),
        ),
        MutationRoot(
            AuthMutation::default(),
            ProjectMutation::default(),
            TaskMutation::default(),
        ),
        EmptySubscription,
    )
    .finish()
}
