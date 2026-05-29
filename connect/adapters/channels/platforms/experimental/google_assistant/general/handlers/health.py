from connect.client.general.health_check import health_check
from connect.client import OpenJiuwenClient
from ...state import get_app_config


async def handle_health(user_id, say, user_data):
    backend_url = get_app_config().get("backend_url", "http://localhost:8000")
    client = OpenJiuwenClient(base_url=backend_url)
    try:
        result = health_check(client)
        await say(f"The backend is healthy at {backend_url}.")
    except Exception as e:
        await say(f"The backend is unreachable at {backend_url}: {e}")
