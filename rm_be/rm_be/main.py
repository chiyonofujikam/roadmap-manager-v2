"""FastAPI application entry point"""

from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from rm_be.api.deps import (CurrentUser, RequireAdmin, RequireCollaborator,
                            RequireResponsible)
from rm_be.api.routes import router as api_router
from rm_be.config import settings
from rm_be.core.security import get_keycloak_client
from rm_be.database import (close_database, create_indexes, get_database,
                            init_database)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    await init_database()

    db = get_database()
    await create_indexes(db)
    if not settings.use_mock_auth:
        get_keycloak_client()

    yield
    await close_database()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan,
    description="Roadmap Management System API with Keycloak authentication",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "authentication": "keycloak" if not settings.use_mock_auth else "mock",
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        db = get_database()
        await db.client.admin.command("ping")
        return {"status": "healthy", "database": "connected"}

    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

@app.get("/auth/me")
async def get_current_user_info(current_user: dict = CurrentUser):
    """Get current authenticated user information"""
    return {
        "user": current_user,
        "message": "Authentication successful"
    }

@app.get("/auth/admin")
async def admin_only_endpoint(current_user: dict = RequireAdmin):
    """Example admin-only endpoint"""
    return {
        "message": "Admin access granted",
        "user": current_user
    }

@app.get("/auth/responsible")
async def responsible_only_endpoint(current_user: dict = RequireResponsible):
    """Example responsible-only endpoint"""
    return {
        "message": "Responsible access granted",
        "user": current_user
    }

@app.get("/auth/collaborator")
async def collaborator_only_endpoint(current_user: dict = RequireCollaborator):
    """Example collaborator-only endpoint"""
    return {
        "message": "Collaborator access granted",
        "user": current_user
    }

app.include_router(api_router)

if __name__ == "__main__":
    uvicorn.run(
        "rm_be.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
