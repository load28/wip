use async_graphql::{EmptySubscription, MergedObject, Schema};

use super::mutations::AuthMutation;
use super::queries::MeQuery;

#[derive(MergedObject, Default)]
pub struct QueryRoot(pub MeQuery);

#[derive(MergedObject, Default)]
pub struct MutationRoot(pub AuthMutation);

pub type AppSchema = Schema<QueryRoot, MutationRoot, EmptySubscription>;

pub fn create_schema() -> AppSchema {
    Schema::build(
        QueryRoot(MeQuery),
        MutationRoot(AuthMutation),
        EmptySubscription,
    )
    .finish()
}
