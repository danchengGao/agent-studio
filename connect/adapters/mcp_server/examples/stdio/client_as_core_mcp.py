#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Stdio MCP Client Example for OpenJiuwen Studio
================================================
This client launches the OpenJiuwen Studio MCP server as a subprocess (Stdio transport),
communicates with it over stdin/stdout, and demonstrates calling various studio operations.

Prerequisites:
    No need to start the server manually — the client starts it automatically as a subprocess.

Run:
    python client_as_core_mcp.py --token YOUR_TOKEN [options]

Usage:
    python client_as_core_mcp.py --token YOUR_TOKEN [options]

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
from openjiuwen.core.foundation.tool.mcp.base import McpServerConfig
from openjiuwen.core.foundation.tool.mcp.client.stdio_client import StdioClient

from connect.adapters.mcp_server.examples._shared import SERVER_NAME
from connect.adapters.mcp_server.examples.stdio._shared import PROJECT_ROOT, build_parser, SERVER_SCRIPT
from connect.adapters.mcp_server.examples._shared_for_core_mcp import do_run_example


async def main(args: argparse.Namespace) -> None:
    if not args.token:
        logger.error("ERROR: --token is required (or set OJ_TOKEN environment variable)")
        return

    logger.info(f"Launching Stdio MCP server: {sys.executable} -m connect.adapters.mcp_server.server")

    client = StdioClient(McpServerConfig(
        server_name=SERVER_NAME,
        server_path="",
        client_type="stdio",
        params={
            "command": sys.executable,
            "args": [
                SERVER_SCRIPT,
                "--token", args.token],
            "env": None,
            "cwd": PROJECT_ROOT,
            "encoding_error_handler": "strict",
        },
    ))

    connected = await client.connect()
    if not connected:
        logger.error("Failed to start Stdio server.")
        return

    logger.info("Stdio server started and connected!\n")

    tools = await client.list_tools()
    logger.info(f"Available tools ({len(tools)}): {[t.name for t in tools]}\n")

    await do_run_example(client, args)

    await client.disconnect()
    logger.info("Disconnected — subprocess terminated.")


if __name__ == "__main__":
    parser = build_parser("Stdio MCP client example for OpenJiuwen Studio (direct client pattern)")
    args = parser.parse_args()
    asyncio.run(main(args))
