use async_graphql::{EmptySubscription, MergedObject, Schema};

use super::mutations::{AuthMutation, ProjectMutation};
use super::queries::{MeQuery, ProjectQuery};

#[derive(MergedObject, Default)]
pub struct QueryRoot(pub MeQuery, pub ProjectQuery);

#[derive(MergedObject, Default)]
pub struct MutationRoot(pub AuthMutation, pub ProjectMutation);

pub type AppSchema = Schema<QueryRoot, MutationRoot, EmptySubscription>;

pub fn create_schema() -> AppSchema {
    Schema::build(
        QueryRoot(MeQuery::default(), ProjectQuery::default()),
        MutationRoot(AuthMutation::default(), ProjectMutation::default()),
        EmptySubscription,
    )
    .finish()
}
