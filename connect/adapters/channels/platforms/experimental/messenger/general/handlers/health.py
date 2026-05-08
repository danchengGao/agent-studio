"""Handle the 'health' command."""
from connect.client.general.health_check import health_check
from ....messenger.client_session import get_backend_client


async def handle(user_id: str, say, user_data: dict) -> None:
    client, err = get_backend_client(user_id)
    if err:
        await say(f"Backend: {err}")
        return
    try:
        result = health_check(client)
        await say(f"Backend health: {result}")
    except Exception as e:
        await say(f"Backend health check failed: {e}")
