"""Health check command handler."""
from connect.client.general.health_check import health_check
from connect.client import OpenJiuwenClient
from ...state import get_app_config


async def handle_health(user_id: str, say, user_data: dict) -> None:
    backend_url = get_app_config().get("backend_url", "http://localhost:8000")
    client = OpenJiuwenClient(base_url=backend_url)
    try:
        result = health_check(client)
        await say(f"Backend is healthy at {backend_url}\n{result}")
    except Exception as e:
        await say(f"Backend unreachable at {backend_url}: {e}")
