use async_graphql::SimpleObject;

use crate::models::User;

#[derive(SimpleObject)]
pub struct UserType {
    pub id: String,
    pub email: String,
    pub name: String,
    pub avatar_url: Option<String>,
}

impl From<User> for UserType {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar_url: user.avatar_url,
        }
    }
}
