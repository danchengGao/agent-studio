"""Tiny helpers shared across wechat handler modules."""


def set_state(user_data: dict, state: str) -> None:
    user_data['state'] = state
