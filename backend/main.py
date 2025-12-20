import os
import sys
from contextlib import asynccontextmanager
from typing import Dict

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables from project root globally
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(project_root, '.env'))

from ops.config import settings
from ops.modules.prompt.infra.database import create_database_tables
from sqlalchemy import inspect
from memory_engine_start import MemoryEngineManager

from app.routers import register
from app.core.database import engine, Base
# Import all models to ensure they are registered with SQLAlchemy
from app.models import ModelConfig, ModelUsageLog, EmbeddingModelConfig, AgentBaseDB, AgentPublishDB, \
    PromptRelationDB, TagDB, UserDB, SpaceDB, SpaceUserDB, WorkflowBaseDB, WorkflowPublishDB, PluginBaseDB, \
    PluginPublishDB, ToolBaseDB, \
    WorkflowExecutionDB, WorkflowExecutionDetailsDB, AgentExecutionDB, AgentExecutionDetailsDB, \
    AgentWorkflowRelationDB, KnowledgeBaseDB, KnowledgeBaseDocumentDB
# Import database sync tool
from openjiuwen.core.common.logging import logger
from app.core.db_sync import run_database_sync
# Import Trace models
from app.models.trace_detail import TraceDetailDB
from app.models.trace_summary import TraceSummaryDB
from app.models.tag import workflow_tag_association


@asynccontextmanager
async def lifespan_func(app: FastAPI):
    # Startup
    logger.info("🚀 Starting Jiuwen Agent Studio Backend...")
    
    # Create database tables with checkfirst=True to avoid creating existing indexes
    Base.metadata.create_all(
        bind=engine,
        tables=[
            ModelConfig.__table__,
            ModelUsageLog.__table__,
            EmbeddingModelConfig.__table__,
            AgentBaseDB.__table__,
            AgentPublishDB.__table__,
            PromptRelationDB.__table__,
            TagDB.__table__,
            UserDB.__table__,
            SpaceDB.__table__,
            SpaceUserDB.__table__,
            WorkflowBaseDB.__table__,
            WorkflowPublishDB.__table__,
            PluginBaseDB.__table__,
            PluginPublishDB.__table__,
            ToolBaseDB.__table__,
            WorkflowExecutionDB.__table__,
            WorkflowExecutionDetailsDB.__table__,
            AgentExecutionDB.__table__,
            AgentExecutionDetailsDB.__table__,
            AgentWorkflowRelationDB.__table__,
            # Trace tables
            TraceDetailDB.__table__,
            TraceSummaryDB.__table__,
            # Knowledge Base tables
            KnowledgeBaseDB.__table__,
            KnowledgeBaseDocumentDB.__table__,
        ],
        checkfirst=True
    )
    await MemoryEngineManager.init()

    # Create workflow_tag_association table if it doesn't exist
    workflow_tag_association.create(bind=engine, checkfirst=True)

    # 运行数据库字段同步（添加新字段）
    run_database_sync()
    logger.info("✅ Database field sync completed")

    # ops数据库相关表自动创建
    create_database_tables()
    logger.info("✅ Database tables created")

    yield

    # Shutdown
    logger.info("🛑 Shutting down Jiuwen Agent Studio Backend...")


# Create FastAPI app
app = FastAPI(
    title="Jiuwen Agent Studio API",
    description="Backend API for Jiuwen Agent Studio - Professional LLM Agent Development Platform",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan_func,
    # 添加Swagger UI的OAuth2配置
    swagger_ui_init_oauth={
        "usePkceWithAuthorizationCodeGrant": True,
        "appName": "Jiuwen Agent Studio API",
        "clientId": "swagger-ui",
    }
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "message": "Welcome to Jiuwen Agent Studio Backend",
        "docs": "/api/docs",
        "health": "/api/health"
    }


register.router_register(app)


def main():
    # Development configuration
    config = {
        "host": os.getenv("HOST", "0.0.0.0"),
        "port": int(os.getenv("BACKEND_PORT", "8000")),
        "reload": False,
        "log_level": "info",
        "access_log": True,
        "workers": int(os.getenv("WORKER_NUM", 1)),
    }

    logger.info("🚀 Starting Jiuwen Agent Studio Backend in development mode...")
    logger.info(f"📍 Server will be available at: http://{config['host']}:{config['port']}")
    logger.info(f"📚 API Documentation: http://{config['host']}:{config['port']}/api/docs")
    logger.info(f"🔍 Health Check: http://{config['host']}:{config['port']}/api/health")
    logger.info("🔄 Auto-reload enabled for development")
    logger.info("⏹️  Press Ctrl+C to stop the server")
    logger.info("-" * 60)

    # Start the server；force asyncio loop to avoid uvloop + nest_asyncio conflict
    uvicorn.run(
        "main:app",
        loop="asyncio",
        **config
    )


if __name__ == "__main__":
    main()