from ..._state_helpers import set_state


async def handle(user_id: str, text: str, say, user_data: dict) -> None:
    user_data['login_username'] = text
    set_state(user_data, 'login_password')
    await say("Please enter your password:")
