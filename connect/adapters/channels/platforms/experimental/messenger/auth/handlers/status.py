"""Handle the 'status' command — show login status."""
from connect.client.auth.token_storage import get_user_token


async def handle(user_id: str, say, user_data: dict) -> None:
    token = get_user_token(user_id)
    if token:
        await say("You are logged in.")
    else:
        await say("You are not logged in. Send 'login' to authenticate.")
