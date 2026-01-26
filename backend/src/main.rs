use actix_cors::Cors;
use actix_web::{guard, web, App, HttpRequest, HttpResponse, HttpServer};
use async_graphql::http::{playground_source, GraphQLPlaygroundConfig};
use async_graphql_actix_web::{GraphQLRequest, GraphQLResponse};
use dotenvy::dotenv;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use task_management_backend::config::Config;
use task_management_backend::db::create_pool;
use task_management_backend::graphql::{
    create_schema, AccessTokenData, AppSchema, RefreshTokenData,
};

async fn graphql_handler(
    schema: web::Data<AppSchema>,
    config: web::Data<Config>,
    pool: web::Data<sqlx::SqlitePool>,
    req: HttpRequest,
    gql_req: GraphQLRequest,
) -> GraphQLResponse {
    // 쿠키에서 토큰 추출
    let access_token = req.cookie("access_token").map(|c| c.value().to_string());
    let refresh_token = req.cookie("refresh_token").map(|c| c.value().to_string());

    let mut request = gql_req.into_inner();

    // Context에 데이터 추가
    request = request.data(config.get_ref().clone());
    request = request.data(pool.get_ref().clone());

    // Context에 토큰 추가
    if let Some(token) = access_token {
        request = request.data(AccessTokenData(token));
    }
    if let Some(token) = refresh_token {
        request = request.data(RefreshTokenData(token));
    }

    schema.execute(request).await.into()
}

async fn graphql_playground() -> HttpResponse {
    HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(playground_source(GraphQLPlaygroundConfig::new("/graphql")))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env();
    let frontend_url = config.frontend_url.clone();

    // 데이터베이스 연결
    let pool = create_pool(&config.database_url)
        .await
        .expect("Failed to create database pool");

    tracing::info!("Database connected");

    // GraphQL 스키마 생성
    let schema = create_schema();

    tracing::info!("Starting server at http://127.0.0.1:8080");

    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin(&frontend_url)
            .allow_any_method()
            .allow_any_header()
            .supports_credentials();

        App::new()
            .app_data(web::Data::new(config.clone()))
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(schema.clone()))
            .wrap(cors)
            .route("/health", web::get().to(|| async { "OK" }))
            .service(
                web::resource("/graphql")
                    .guard(guard::Post())
                    .to(graphql_handler),
            )
            .service(
                web::resource("/graphql")
                    .guard(guard::Get())
                    .to(graphql_playground),
            )
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
