#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Stdio — Runner / ResourceMgr usage example for OpenJiuwen Studio
==================================================================
Demonstrates registering the OpenJiuwen Studio MCP server (subprocess) and invoking
tools entirely through the openjiuwen Runner and ResourceMgr.

The subprocess is launched automatically by the resource manager when
add_mcp_server() is called — no manual StdioClient setup needed.

Patterns demonstrated:
  1. Subprocess-based MCP server registration via Runner.resource_mgr.add_mcp_server()
     with client_type="stdio" and params
  2. Tool discovery and direct invocation via Runner.resource_mgr.get_mcp_tool()
  3. Integration with OpenJiuwen Studio backend operations

Prerequisites:
    No separate server process needed — the subprocess is managed automatically.

Run:
    python client_as_core_resource_manager.py --token YOUR_TOKEN [options]

Usage:
    python client_as_core_resource_manager.py --token YOUR_TOKEN [options]

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
from openjiuwen.core.runner import Runner

from connect.adapters.mcp_server.examples._shared import SERVER_NAME
from connect.adapters.mcp_server.examples.stdio._shared import PROJECT_ROOT, build_parser, SERVER_SCRIPT
from connect.adapters.mcp_server.examples._shared_for_core_tool import do_run_example, SERVER_ID


async def main(args: argparse.Namespace) -> None:
    if not args.token:
        logger.error("ERROR: --token is required (or set OJ_TOKEN environment variable)")
        return

    await Runner.start()
    try:
        # ── 1. Register Stdio MCP server with the resource manager ────────────
        #   client_type="stdio" tells the resource manager to launch the script
        #   as a subprocess and communicate over stdin/stdout.
        config = McpServerConfig(
            server_id=SERVER_ID,
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
        )
        logger.info(f"Registering OpenJiuwen Studio MCP server '{SERVER_NAME}' (subprocess) ...")
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
        # ── 4. Clean up — also terminates the subprocess ──────────────────────
        await Runner.resource_mgr.remove_mcp_server(server_name=SERVER_NAME)
        await Runner.stop()
        logger.info("Runner stopped — subprocess terminated.")


if __name__ == "__main__":
    parser = build_parser("Stdio MCP client example for OpenJiuwen Studio (Runner + ResourceMgr pattern)")
    args = parser.parse_args()
    asyncio.run(main(args))
