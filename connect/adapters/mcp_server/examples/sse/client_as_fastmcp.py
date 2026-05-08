#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SSE — FastMCP (raw MCP protocol) client for OpenJiuwen Studio
==============================================================
Connects to the OpenJiuwen Studio MCP server via SSE transport using the
raw MCP protocol (mcp.ClientSession) — the same way Claude Desktop or any
standard MCP client would.

Unlike the other clients in this folder, this one does NOT use
openjiuwen-core abstractions; it talks directly to the MCP protocol layer.

Prerequisites:
    1. Start the studio MCP server first (SSE mode):
           python -m connect.adapters.mcp_server --transport sse --port 8080
    2. Run this file:
           python client_as_fastmcp.py --server-url http://localhost:8080/sse

Usage:
    python client_as_fastmcp.py [options]

    Options:
      --server-url URL      SSE server URL (env: OJ_SERVER_URL)
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
from mcp.client.sse import sse_client

from openjiuwen.core.common.logging import logger

from connect.adapters.mcp_server.examples.sse._shared import build_parser
from connect.adapters.mcp_server.examples._shared_for_fast_mcp import do_run_example


async def _run(args) -> None:
    interactive = not args.no_interactive and sys.stdin.isatty()
    logger.info(f"{'=' * 60}")
    logger.info("  OpenJiuwen MCP — FastMCP SSE client")
    logger.info(f"{'=' * 60}")
    logger.info(f"  Server : {args.server_url}")
    logger.info(f"  Mode   : {'interactive' if interactive else 'non-interactive'}")
    logger.info(f"{'=' * 60}")
    logger.info("  Connecting to SSE server…")

    async with sse_client(args.server_url) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            await do_run_example(session, args)

    logger.info("Done.")


if __name__ == "__main__":
    parser = build_parser(
        "FastMCP SSE client — connects to OpenJiuwen Studio MCP server using raw MCP protocol"
    )
    parser.add_argument("--no-interactive", action="store_true",
                        help="Skip interactive multi-turn chat")
    args = parser.parse_args()
    asyncio.run(_run(args))
