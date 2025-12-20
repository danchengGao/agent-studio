import os
import sys
from fastapi import FastAPI, APIRouter
from app.routers import (auth, models, users, agents, workflows, execution, space,
                         related_member, plugin, tags, knowledge_base, embedding_models)
from ops.routers import llm_router, prompt_router, prompt_debug_router, prompt_tuning_router

api_router = APIRouter()


def router_register(app: FastAPI):
    """Register API routers to FastAPI app."""
    v1_router = APIRouter(prefix="/v1")
    v1_router.include_router(auth.auth_router, prefix="/auth", tags=["Authentication"])
    v1_router.include_router(users.users_router, prefix="/users", tags=["Users"])
    v1_router.include_router(space.space_router, prefix="/spaces", tags=["Space"])
    v1_router.include_router(models.models_router, prefix="/models", tags=["Models"])
    v1_router.include_router(embedding_models.embedding_models_router, tags=["Embedding Models"])
    v1_router.include_router(agents.agents_router, prefix="/agents", tags=["Agents"])
    v1_router.include_router(execution.execution_router, prefix="/execution", tags=["Execution"])
    v1_router.include_router(workflows.workflows_router, prefix="/workflows", tags=["Workflows"])
    v1_router.include_router(related_member.related_router, prefix="/related", tags=["Relation"])
    v1_router.include_router(plugin.plugin_router, prefix="/plugin", tags=["Plugin"])
    v1_router.include_router(tags.tags_router, prefix="/tags", tags=["Tags"])
    v1_router.include_router(knowledge_base.knowledge_base_router, prefix="/knowledge-base", tags=["Knowledge Base"])

    # Add health check endpoint directly to api_router (not v1_router)
    @api_router.get("/health")
    async def health_check():
        return {
            "status": "healthy",
            "service": "Jiuwen Agent Studio Backend",
            "version": "1.0.0"
        }

    api_router.include_router(v1_router)
    app.include_router(api_router, prefix="/api")

    app.include_router(llm_router.router)
    app.include_router(prompt_router.router)
    app.include_router(prompt_debug_router.router)
    app.include_router(prompt_tuning_router.router)

    @app.get("/")
    async def root():
        return {
            "message": "Welcome to Jiuwen Agent Studio Backend",
            "docs": "/api/docs",
            "health": "/api/health"
        }
