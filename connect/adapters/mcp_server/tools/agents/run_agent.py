import uuid as _uuid

from mcp.server.fastmcp import FastMCP

from connect.client.client import OpenJiuwenClient
from connect.client.agents.execute_agent import execute_agent as _execute_agent
from connect.client.agents.response_parser import parse_agent_response


def run_agent_tool(
    client: OpenJiuwenClient,
    agent_id: str,
    message: str,
    conversation_id: str = '',
) -> str:
    """
    Send a message to an agent and return its reply plus a conversation_id.

    Pass the returned conversation_id back on subsequent calls to continue the thread.
    """
    # Ensure there is always a stable conversation_id to return even when the
    # backend does not echo it back in the SSE stream.
    actual_conv_id = conversation_id or str(_uuid.uuid4())
    try:
        events = _execute_agent(client, agent_id, message, actual_conv_id)
        text, conv_id_from_events, error = parse_agent_response(events)
        if error:
            return f"ERROR from agent: {error}"
        reply = text or "(no reply)"
        conv_id = conv_id_from_events or actual_conv_id
        return f"Reply: {reply}\nConversation ID: {conv_id}"
    except Exception as exc:
        return f"ERROR running agent: {exc}"


def register(mcp: FastMCP, client: OpenJiuwenClient) -> None:
    @mcp.tool()
    def run_agent(agent_id: str, message: str, conversation_id: str = '') -> str:
        """
        Send a message to an agent and get its reply.

        To maintain a multi-turn conversation pass the conversation_id returned
        by the previous call. Omit it (or pass '') to start a new conversation.

        Args:
            agent_id: The agent's ID (from list_agents or search_agents)
            message: The message to send to the agent
            conversation_id: Conversation ID for continuing a prior thread (optional)

        Returns:
            The agent's reply followed by the conversation_id to use in follow-up calls.
        """
        return run_agent_tool(client, agent_id, message, conversation_id)
