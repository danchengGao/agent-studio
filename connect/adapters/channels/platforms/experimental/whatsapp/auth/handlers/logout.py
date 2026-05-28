"""Logout command handler."""
from connect.client.auth.token_storage import get_user_token, remove_user_token


async def handle_logout(user_id: str, say, user_data: dict) -> None:
    if not get_user_token(user_id):
        await say("ℹ️ You are not logged in.")
        return
    remove_user_token(user_id)
    user_data.pop('backend_client', None)
    user_data['state'] = 'idle'
    await say("✅ Successfully logged out. Reply *login* to sign in again.")
