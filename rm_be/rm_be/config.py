"""Application configuration"""

from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""
    mongodb_uri: str = "mongodb://localhost:27017/roadmap_db_dev"
    mongodb_db_name: str = "roadmap_db_dev"

    app_name: str = "Roadmap Manager API"
    app_version: str = "0.1.0"
    debug: bool = True

    host: str = "0.0.0.0"
    port: int = 8000

    keycloak_server_url: str = "http://localhost:8080"
    keycloak_realm: str = "roadmap-realm"
    keycloak_client_id: str = "roadmap-api"
    keycloak_client_secret: Optional[str] = None
    keycloak_verify_ssl: bool = False
    use_mock_auth: bool = False
    mock_users_file: str = "mockusers.json"

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
