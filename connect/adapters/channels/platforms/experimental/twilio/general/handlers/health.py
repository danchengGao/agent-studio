"""Backend health check."""
import asyncio
from connect.client.general.health_check import health_check
from connect.client import OpenJiuwenClient
from ...state import get_app_config


async def handle_health(user_id: str, text: str, say) -> None:
    config = get_app_config()
    client = OpenJiuwenClient(base_url=config.get("backend_url", "http://localhost:8000"))
    try:
        result = await asyncio.get_event_loop().run_in_executor(None, lambda: health_check(client))
        await say(f"Backend is up. Status: {result}")
    except Exception as exc:
        await say(f"Backend is unreachable: {exc}")
