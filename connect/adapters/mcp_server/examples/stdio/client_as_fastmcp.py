#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Stdio — FastMCP (raw MCP protocol) client for OpenJiuwen Studio
================================================================
Launches the OpenJiuwen Studio MCP server as a subprocess and communicates
with it using the raw MCP protocol (mcp.ClientSession) — the same way
Claude Desktop or any standard MCP client would.

Unlike the other clients in this folder, this one does NOT use
openjiuwen-core abstractions; it talks directly to the MCP protocol layer.

Prerequisites:
    No need to start the server manually — launched automatically as subprocess.

Run:
    python client_as_fastmcp.py --token YOUR_TOKEN [options]

Usage:
    python client_as_fastmcp.py [options]

    Options:
      --token TOKEN         Backend access token (env: OJ_TOKEN, required)
      --backend-url URL     Backend URL (env: OJ_BACKEND_URL)
      --agent-id ID         Run this agent (optional)
      --message TEXT        Opening message to send to agent
      --workflow-id ID      Run this workflow (optional)
      --workflow-inputs JSON  Workflow inputs as JSON string
      --no-interactive      Skip interactive multi-turn chat
      --skip-agents         Skip agent operations
      --skip-workflows      Skip workflow operations
"""

import asyncio
import sys

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

from openjiuwen.core.common.logging import logger

from connect.adapters.mcp_server.examples.stdio._shared import PROJECT_ROOT, build_parser, SERVER_SCRIPT
from connect.adapters.mcp_server.examples._shared_for_fast_mcp import do_run_example


async def _run(args) -> None:
    if not args.token:
        logger.error("ERROR: --token is required (or set OJ_TOKEN).")
        return

    server_params = StdioServerParameters(
        command=sys.executable,
        args=[SERVER_SCRIPT, "--token", args.token],
        cwd=PROJECT_ROOT,
    )

    interactive = not args.no_interactive and sys.stdin.isatty()
    logger.info(f"{'=' * 60}")
    logger.info("  OpenJiuwen MCP — FastMCP Stdio client")
    logger.info(f"{'=' * 60}")
    logger.info(f"  Mode   : {'interactive' if interactive else 'non-interactive'}")
    logger.info(f"{'=' * 60}")
    logger.info("  Starting MCP server subprocess…")

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            await do_run_example(session, args)

    logger.info("Done.")


if __name__ == "__main__":
    parser = build_parser(
        "FastMCP Stdio client — connects to OpenJiuwen Studio MCP server using raw MCP protocol"
    )
    parser.add_argument("--no-interactive", action="store_true",
                        help="Skip interactive multi-turn chat")
    args = parser.parse_args()
    asyncio.run(_run(args))
