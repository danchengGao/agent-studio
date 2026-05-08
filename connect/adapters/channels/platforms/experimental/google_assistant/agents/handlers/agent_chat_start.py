from ...client_session import get_backend_client


async def handle_chat_start(user_id, say, user_data, agent_id=""):
    if not agent_id:
        await say("Please say: agent start followed by the agent ID.")
        return
    client, err = get_backend_client(user_id)
    if err:
        await say(err)
        return
    user_data["agent_chat"] = {"agent_id": agent_id, "conversation_id": ""}
    user_data["state"] = "agent_chat"
    await say(f"Chat started with agent {agent_id}. Just speak your messages. Say agent end to finish.")
