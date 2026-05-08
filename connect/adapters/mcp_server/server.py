"""
OpenJiuwen MCP Server.

Run this file to expose OpenJiuwen tools as MCP tools for LLM clients such as Claude Desktop.

Usage:
    python connect/adapters/mcp_server/server.py --token YOUR_TOKEN [OPTIONS]
    python -m connect.adapters.mcp_server        --token YOUR_TOKEN [OPTIONS]

Options:
    --token         Backend access token          (env: OJ_TOKEN,       required)
    --backend-url   OpenJiuwen backend URL        (env: OJ_BACKEND_URL, default: http://localhost:8000)
    --transport     Transport type: stdio or sse  (env: OJ_TRANSPORT,   default: stdio)
    --host          SSE server host               (env: OJ_HOST,        default: 0.0.0.0)
    --port          SSE server port               (env: OJ_PORT,        default: 8080)

The space is auto-selected from your account on startup (first space returned by the backend).

Claude Desktop config — stdio (~/.config/claude/claude_desktop_config.json):
    {
      "mcpServers": {
        "openjiuwen": {
          "command": "/usr/local/bin/python3.12",
          "args": [
            "-m", "connect.adapters.mcp_server",
            "--backend-url", "http://localhost:8000",
            "--token", "YOUR_TOKEN_HERE"
          ],
          "cwd": "/path/to/agent-studio"
        }
      }
    }

Claude Desktop config — SSE (server must already be running):
    {
      "mcpServers": {
        "openjiuwen": {
          "url": "http://localhost:8080/sse"
        }
      }
    }
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# Keep project root on sys.path so absolute imports work when run directly.
_PROJECT_ROOT = str(Path(__file__).parent.parent.parent.parent)
if _PROJECT_ROOT not in sys.path:
    sys.path.append(_PROJECT_ROOT)

from mcp.server.fastmcp import FastMCP
from openjiuwen.core.common.logging import logger
from connect.client.client import OpenJiuwenClient
from connect.client.auth.get_spaces import get_spaces
from connect.adapters.mcp_server.tools.registrator import register_all

# ── Entry point ───────────────────────────────────────────────────────────────


def main() -> None:
    p = argparse.ArgumentParser(
        prog='python connect/adapters/mcp_server/server.py',
        description='OpenJiuwen MCP Server',
    )
    p.add_argument('--backend-url', default=os.getenv('OJ_BACKEND_URL', 'http://localhost:8000'),
                   help='Backend URL (env: OJ_BACKEND_URL)')
    p.add_argument('--token', default=os.getenv('OJ_TOKEN'),
                   help='Access token (env: OJ_TOKEN, required)')
    p.add_argument('--transport', default=os.getenv('OJ_TRANSPORT', 'stdio'),
                   choices=['stdio', 'sse'],
                   help='Transport type (env: OJ_TRANSPORT, default: stdio)')
    p.add_argument('--host', default=os.getenv('OJ_HOST', '0.0.0.0'),
                   help='SSE server host (env: OJ_HOST, default: 0.0.0.0)')
    p.add_argument('--port', type=int, default=int(os.getenv('OJ_PORT', '8080')),
                   help='SSE server port (env: OJ_PORT, default: 8080)')
    args = p.parse_args()

    if not args.token:
        error = "ERROR: --token is required (or set OJ_TOKEN)."
        logger.error(error)
        raise RuntimeError(error)

    client = OpenJiuwenClient(base_url=args.backend_url)
    client.set_token(args.token)

    mcp = FastMCP(
        name="OpenJiuwen",
        host=args.host,
        port=args.port,
        instructions=(
            "OpenJiuwen is an AI agent and workflow platform. "
            "Use health_check() to verify connectivity. "
            "Use list_agents() / search_agents() to discover agents, then run_agent() to chat with one. "
            "Preserve the conversation_id returned by run_agent() and pass it back on follow-up calls "
            "to maintain context. Call reset_agent() when you want to start a fresh conversation. "
            "Use list_workflows() / search_workflows() to find workflows, get_workflow() to inspect "
            "required inputs, and run_workflow() to execute one."
        ),
    )

    try:
        resp = get_spaces(client)
        space_list = resp.get('data', {}).get('space_list', [])
        if space_list:
            auto_id = space_list[0]['space_id']
            client.set_space_id(auto_id)
            space_display = auto_id
        else:
            space_display = "(no spaces found)"
    except Exception as exc:
        space_display = f"(could not fetch spaces: {exc})"

    register_all(mcp, client)

    logger.info("OpenJiuwen MCP Server starting")
    logger.info(f"  Backend  : {args.backend_url}")
    logger.info(f"  Space    : {space_display}")
    logger.info(f"  Transport: {args.transport}")
    if args.transport == 'sse':
        logger.info(f"  Listen   : http://{args.host}:{args.port}/sse")
        mcp.run(transport='sse')
    else:
        mcp.run(transport='stdio')


if __name__ == '__main__':
    main()
