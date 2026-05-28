#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SSE — MCPTool usage example for OpenJiuwen Studio
===================================================
Demonstrates using MCPTool (openjiuwen.core.foundation.tool.mcp.base.MCPTool)
instead of calling the transport client directly.

MCPTool wraps an McpClient + McpToolCard and exposes the standard Tool.invoke()
interface, making MCP tools interchangeable with any other openjiuwen Tool.

Prerequisites:
    1. Start the studio MCP server first (SSE mode):
           python -m connect.adapters.mcp_server --transport sse --port 8080
    2. Run this file:
           python client_as_core_tool.py --server-url http://localhost:8080/sse

Usage:
    python client_as_core_tool.py --server-url http://localhost:8080/sse [options]

    Options:
      --server-url URL      SSE server URL (env: OJ_SERVER_URL)
      --agent-id ID         Run this agent (optional)
      --message TEXT        Message to send to agent
      --workflow-id ID      Run this workflow (optional)
      --workflow-inputs JSON  Workflow inputs as JSON string
      --skip-agents         Skip agent operations
      --skip-workflows      Skip workflow operations
"""

import argparse
import asyncio

from openjiuwen.core.common.logging import logger
from openjiuwen.core.foundation.tool.mcp.base import MCPTool, McpServerConfig
from openjiuwen.core.foundation.tool.mcp.client.sse_client import SseClient

from connect.adapters.mcp_server.examples._shared import SERVER_NAME
from connect.adapters.mcp_server.examples.sse._shared import build_parser
from connect.adapters.mcp_server.examples._shared_for_core_tool import do_run_example


async def main(args: argparse.Namespace) -> None:
    # ── 1. Create and connect the transport client ────────────────────────────
    client = SseClient(McpServerConfig(
        server_name=SERVER_NAME,
        server_path=args.server_url,
        client_type="sse",
    ))

    logger.info(f"Connecting to SSE server at {args.server_url}...")
    connected = await client.connect()
    if not connected:
        logger.error("Failed to connect. Make sure the server is running.")
        logger.info("Start server with: python -m connect.adapters.mcp_server --transport sse --port 8080")
        return
    logger.info("Connected.\n")

    # ── 2. Discover tools and wrap each card in MCPTool ───────────────────────
    #   MCPTool(mcp_client, tool_info) — the client is shared across all tools.
    #   MCPTool.invoke() delegates to client.call_tool() internally.
    tool_cards = await client.list_tools()
    logger.info(f"Discovered {len(tool_cards)} tool(s): {[c.name for c in tool_cards]}\n")

    tools: dict[str, MCPTool] = {
        card.name: MCPTool(mcp_client=client, tool_info=card)
        for card in tool_cards
    }

    # ── 3. Invoke tools via the standard Tool.invoke() interface ─────────────
    #   invoke() always returns {"result": <value>}
    async def call(name: str, params: dict) -> dict:
        return await tools[name].invoke(params)

    await do_run_example(call, args)

    # ── 4. Disconnect ─────────────────────────────────────────────────────────
    await client.disconnect()
    logger.info("Disconnected.")


if __name__ == "__main__":
    parser = build_parser("SSE MCP client example for OpenJiuwen Studio (MCPTool wrapper pattern)")
    args = parser.parse_args()
    asyncio.run(main(args))
