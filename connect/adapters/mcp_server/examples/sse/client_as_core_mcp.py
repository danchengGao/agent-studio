#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SSE (Server-Sent Events) MCP Client Example for OpenJiuwen Studio
===================================================================
This client connects to the OpenJiuwen Studio MCP server via SSE transport,
lists available tools, and demonstrates calling various studio operations.

Prerequisites:
    1. Start the studio MCP server first (SSE mode):
           python -m connect.adapters.mcp_server --transport sse --port 8080
    2. Then run this client:
           python client_as_core_mcp.py --server-url http://localhost:8080/sse

Usage:
    python client_as_core_mcp.py --server-url http://localhost:8080/sse [options]

    Options:
      --server-url URL      SSE server URL (env: OJ_SERVER_URL)
      --agent-id ID         Run this agent (optional)
      --message TEXT        Message to send to agent (default: "Hello! What can you help me with?")
      --workflow-id ID      Run this workflow (optional)
      --workflow-inputs JSON  Workflow inputs as JSON string (default: {})
      --skip-agents         Skip agent operations
      --skip-workflows      Skip workflow operations
"""

import argparse
import asyncio

from openjiuwen.core.common.logging import logger
from openjiuwen.core.foundation.tool.mcp.base import McpServerConfig
from openjiuwen.core.foundation.tool.mcp.client.sse_client import SseClient

from connect.adapters.mcp_server.examples._shared import SERVER_NAME
from connect.adapters.mcp_server.examples.sse._shared import build_parser
from connect.adapters.mcp_server.examples._shared_for_core_mcp import do_run_example


async def main(args: argparse.Namespace) -> None:
    logger.info(f"Connecting to OpenJiuwen Studio MCP server at {args.server_url}...")

    client = SseClient(McpServerConfig(
        server_name=SERVER_NAME,
        server_path=args.server_url,
        client_type="sse",
    ))

    connected = await client.connect()
    if not connected:
        logger.error("Failed to connect to SSE server. Make sure the server is running.")
        logger.info("Start server with: python -m connect.adapters.mcp_server --transport sse --port 8080")
        return

    logger.info("Connected successfully!\n")

    tools = await client.list_tools()
    logger.info(f"Available tools ({len(tools)}): {[t.name for t in tools]}\n")

    await do_run_example(client, args)

    await client.disconnect()
    logger.info("Disconnected from SSE server.")


if __name__ == "__main__":
    parser = build_parser("SSE MCP client example for OpenJiuwen Studio (direct client pattern)")
    args = parser.parse_args()
    asyncio.run(main(args))
