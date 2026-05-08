from mcp.server.fastmcp import FastMCP

from connect.client.client import OpenJiuwenClient


def reset_agent_tool(conversation_id: str) -> str:
    """
    Discard a conversation_id to start a fresh agent conversation.

    No server-side state is deleted; the ID is simply no longer used.
    """
    return (
        f"Conversation '{conversation_id}' has been reset. "
        "Pass an empty conversation_id to run_agent() to start a new conversation."
    )


def register(mcp: FastMCP, client: OpenJiuwenClient) -> None:
    @mcp.tool()
    def reset_agent(conversation_id: str) -> str:
        """
        Reset (forget) a conversation with an agent.

        This discards the conversation_id so the next call to run_agent() starts
        a fresh context. No data is deleted on the server.

        Args:
            conversation_id: The conversation ID to discard
        """
        return reset_agent_tool(conversation_id)
