"""FastAPI application factory."""
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

from .routes.health import router as health_router
from .routes.auth import router as auth_router
from .routes.workflows import router as workflows_router
from .routes.agents import router as agents_router

_openapi_tags = [
    {
        "name": "Auth",
        "description": (
            "Login with username and password.\n\n"
            "After a successful `POST /auth/login` the server stores the returned "
            "`token` and `space_id` internally — all subsequent requests are "
            "authenticated automatically without any extra steps."
        ),
    },
    {
        "name": "General",
        "description": "Health check and server status.",
    },
    {
        "name": "Agents",
        "description": (
            "List, search, and execute OpenJiuwen agents.\n\n"
            "- `GET /agents/list` — list all agents in the space\n"
            "- `GET /agents/search?keyword=...` — search agents by name\n"
            "- `POST /agents/execute` — send a message and get a reply"
        ),
    },
    {
        "name": "Workflows",
        "description": (
            "List, search, inspect, and execute OpenJiuwen workflows.\n\n"
            "- `GET /workflows/list` — list all workflows in the space\n"
            "- `GET /workflows/search?keyword=...` — search workflows by name\n"
            "- `GET /workflows/get?workflow_id=...` — get workflow details\n"
            "- `POST /workflows/execute` — run a workflow and return outputs"
        ),
    },
]


def create_app() -> FastAPI:
    app = FastAPI(
        title="OpenJiuwen Webhook Server",
        description=(
            "HTTP webhook server that exposes OpenJiuwen workflows and agents as REST endpoints.\n\n"
            "## Getting started\n\n"
            "**Option A — Login via API:**\n"
            "Call `POST /auth/login` once with your credentials. "
            "The server stores the returned token and space ID — all subsequent requests work automatically.\n\n"
            "**Option B — Static startup credentials:**\n"
            "Start the server with `--token` and `--space-id`. No login needed.\n\n"
            "**Option C — Per-request credentials (Authorize dialog):**\n"
            "Click **Authorize** (top right) and fill in `X-Token` and `X-Space-ID` directly. "
            "These override anything set by login or startup args.\n\n"
            "## Authorize fields\n\n"
            "| Field | Description |\n"
            "|---|---|\n"
            "| `X-API-Key` | Webhook server key (only if started with `--api-key`) |\n"
            "| `BearerToken` | Access token via `Authorization: Bearer` header |\n"
            "| `X-Token` | Access token as a plain value (alternative to BearerToken) |\n"
            "| `X-Space-ID` | Workspace ID |\n"
        ),
        version="1.0.0",
        openapi_tags=_openapi_tags,
    )

    app.include_router(auth_router)
    app.include_router(health_router)
    app.include_router(workflows_router)
    app.include_router(agents_router)

    # BearerToken (HTTP Bearer) is not auto-detected because make_client reads
    # Authorization from the raw request. Inject it manually so it appears in
    # the Authorize dialog. X-Token and X-Space-ID are auto-detected from their
    # APIKeyHeader Security dependencies in make_client.
    def custom_openapi():
        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(
            title=app.title,
            version=app.version,
            description=app.description,
            routes=app.routes,
            tags=_openapi_tags,
        )
        schema.setdefault("components", {}).setdefault("securitySchemes", {})
        schema["components"]["securitySchemes"]["BearerToken"] = {
            "type": "http",
            "scheme": "bearer",
            "description": "OpenJiuwen access token (without the 'Bearer ' prefix). "
                           "Alternative to X-Token — use one or the other.",
        }
        app.openapi_schema = schema
        return schema

    app.openapi = custom_openapi

    return app
