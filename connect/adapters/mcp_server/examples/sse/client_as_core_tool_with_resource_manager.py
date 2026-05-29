#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SSE — Runner / ResourceMgr usage example for OpenJiuwen Studio
================================================================
Demonstrates registering the OpenJiuwen Studio MCP server and invoking tools
entirely through the openjiuwen Runner and ResourceMgr — rather than managing
client connections manually.

Patterns demonstrated:
  1. MCP server lifecycle via Runner.resource_mgr.add_mcp_server() /
     remove_mcp_server()
  2. Tool discovery and direct invocation via Runner.resource_mgr.get_mcp_tool()
  3. Integration with OpenJiuwen Studio backend operations

Prerequisites:
    1. Start the studio MCP server first (SSE mode):
           python -m connect.adapters.mcp_server --transport sse --port 8080
    2. Run this file:
           python client_as_core_resource_manager.py --server-url http://localhost:8080/sse

Usage:
    python client_as_core_resource_manager.py --server-url http://localhost:8080/sse [options]

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
from openjiuwen.core.foundation.tool.mcp.base import McpServerConfig
from openjiuwen.core.runner import Runner

from connect.adapters.mcp_server.examples._shared import SERVER_NAME
from connect.adapters.mcp_server.examples.sse._shared import build_parser
from connect.adapters.mcp_server.examples._shared_for_core_tool import do_run_example, SERVER_ID


async def main(args: argparse.Namespace) -> None:
    await Runner.start()
    try:
        # ── 1. Register MCP server with the resource manager ──────────────────
        #   Runner.resource_mgr.add_mcp_server() connects to the server,
        #   discovers all tools, and registers them internally.
        config = McpServerConfig(
            server_id=SERVER_ID,
            server_name=SERVER_NAME,
            server_path=args.server_url,
            client_type="sse",
        )
        logger.info(f"Registering OpenJiuwen Studio MCP server '{SERVER_NAME}' at {args.server_url}...")
        result = await Runner.resource_mgr.add_mcp_server(config, tag=["mcp", "studio", "openjiuwen"])
        if result.is_err():
            logger.error(f"Failed to register server: {result.msg()}")
            return
        logger.info("Server registered.\n")

        # ── 2. List all tools registered from the MCP server ──────────────────
        tool_infos = await Runner.resource_mgr.get_mcp_tool_infos(server_name=SERVER_NAME)
        tool_infos = tool_infos if isinstance(tool_infos, list) else [tool_infos]
        logger.info(f"Registered {len(tool_infos)} tool(s): {[t.name for t in tool_infos if t]}\n")

        # ── 3. Retrieve tools and invoke them ─────────────────────────────────
        async def call(name: str, params: dict) -> dict:
            tool_result = await Runner.resource_mgr.get_mcp_tool(name=name, server_name=SERVER_NAME)
            tool = tool_result[0] if isinstance(tool_result, list) else tool_result
            return await tool.invoke(params)

        await do_run_example(call, args)

    finally:
        # ── 4. Clean up registered resources ──────────────────────────────────
        await Runner.resource_mgr.remove_mcp_server(server_name=SERVER_NAME)
        await Runner.stop()
        logger.info("Runner stopped.")


if __name__ == "__main__":
    parser = build_parser("SSE MCP client example for OpenJiuwen Studio (Runner + ResourceMgr pattern)")
    args = parser.parse_args()
    asyncio.run(main(args))
