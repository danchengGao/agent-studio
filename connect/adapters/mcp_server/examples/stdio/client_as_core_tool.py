#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Stdio — MCPTool usage example for OpenJiuwen Studio
=====================================================
Demonstrates using MCPTool with the Stdio transport.
The client launches the OpenJiuwen Studio MCP server as a subprocess; MCPTool wraps
each discovered tool card so it can be invoked via the standard Tool.invoke() interface.

Prerequisites:
    No separate server process needed — the subprocess is managed automatically.

Run:
    python client_as_core_tool.py --token YOUR_TOKEN [options]

Usage:
    python client_as_core_tool.py --token YOUR_TOKEN [options]

    Options:
      --token TOKEN         Backend access token (env: OJ_TOKEN, required)
      --backend-url URL     Backend URL (env: OJ_BACKEND_URL)
      --agent-id ID         Run this agent (optional)
      --message TEXT        Message to send to agent
      --workflow-id ID      Run this workflow (optional)
      --workflow-inputs JSON  Workflow inputs as JSON string
      --skip-agents         Skip agent operations
      --skip-workflows      Skip workflow operations
"""

import argparse
import asyncio
import sys

from openjiuwen.core.common.logging import logger
from openjiuwen.core.foundation.tool.mcp.base import MCPTool, McpServerConfig
from openjiuwen.core.foundation.tool.mcp.client.stdio_client import StdioClient

from connect.adapters.mcp_server.examples._shared import SERVER_NAME
from connect.adapters.mcp_server.examples.stdio._shared import PROJECT_ROOT, build_parser, SERVER_SCRIPT
from connect.adapters.mcp_server.examples._shared_for_core_tool import do_run_example


async def main(args: argparse.Namespace) -> None:
    if not args.token:
        logger.error("ERROR: --token is required (or set OJ_TOKEN environment variable)")
        return

    # ── 1. Create and connect the transport client ────────────────────────────
    client = StdioClient(McpServerConfig(
        server_name=SERVER_NAME,
        server_path="",
        client_type="stdio",
        params={
            "command": sys.executable,
            "args": [
                SERVER_SCRIPT,
                "--token", args.token,
            ],
            "cwd": PROJECT_ROOT,
            "encoding_error_handler": "strict",
        },
    ))

    logger.info(f"Launching Stdio server: {sys.executable} -m connect.adapters.mcp_server.server")
    connected = await client.connect()
    if not connected:
        logger.error("Failed to start server subprocess.")
        return
    logger.info("Server started.\n")

    # ── 2. Discover tools and wrap each card in MCPTool ───────────────────────
    tool_cards = await client.list_tools()
    logger.info(f"Discovered {len(tool_cards)} tool(s): {[c.name for c in tool_cards]}\n")

    tools: dict[str, MCPTool] = {
        card.name: MCPTool(mcp_client=client, tool_info=card)
        for card in tool_cards
    }

    # ── 3. Invoke tools via the standard Tool.invoke() interface ─────────────
    async def call(name: str, params: dict) -> dict:
        return await tools[name].invoke(params)

    await do_run_example(call, args)

    # ── 4. Disconnect (terminates subprocess) ─────────────────────────────────
    await client.disconnect()
    logger.info("Disconnected — subprocess terminated.")


if __name__ == "__main__":
    parser = build_parser("Stdio MCP client example for OpenJiuwen Studio (MCPTool wrapper pattern)")
    args = parser.parse_args()
    asyncio.run(main(args))
