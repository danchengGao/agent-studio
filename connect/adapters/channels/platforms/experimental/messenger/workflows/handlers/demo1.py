"""Demo workflow handler 1."""


async def handle(user_id: str, say, user_data: dict) -> None:
    await say("Demo workflow 1 executed.")
