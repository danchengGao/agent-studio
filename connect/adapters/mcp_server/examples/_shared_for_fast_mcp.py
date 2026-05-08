#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Shared utilities for Stdio MCP client examples."""

import argparse
import asyncio
import json
import sys
from typing import Any

from openjiuwen.core.common.logging import logger
from ._shared import get_header, do_call_tool, extract_conversation_id, extract_ids


async def do_run_example(session: Any, args: argparse.Namespace) -> None:
    """Run the FastMCP demo against an initialised mcp.ClientSession."""
    interactive = not args.no_interactive and sys.stdin.isatty()

    get_header("Available MCP tools")
    tools_result = await session.list_tools()
    for tool in tools_result.tools:
        schema = tool.inputSchema or {}
        props = schema.get("properties", {})
        required = set(schema.get("required", []))
        params = []
        for pname, pschema in props.items():
            ptype = pschema.get("type", "any")
            if pname not in required and "default" in pschema:
                params.append(f"{pname}: {ptype} = {pschema['default']!r}")
            else:
                params.append(f"{pname}: {ptype}")
        sig = f"{tool.name}({', '.join(params)}) -> str"
        logger.info(f"  • {sig}")
        if tool.description:
            logger.info(f"      {tool.description.strip().splitlines()[0]}")

    get_header("health_check()")
    health_text = await do_call_tool(session, "health_check")
    if "ERROR" in health_text:
        logger.warning("[Demo] Backend health check failed — continuing anyway.")

    if not args.skip_agents:
        get_header("list_agents()")
        listing = await do_call_tool(session, "list_agents", page=1, page_size=10)
        agent_ids = extract_ids(listing)

        if agent_ids:
            get_header("search_agents(keyword='bot')")
            await do_call_tool(session, "search_agents", keyword="bot")

        agent_id = args.agent_id or (agent_ids[0] if agent_ids else None)
        if agent_id:
            get_header(f"get_agent(agent_id={agent_id!r})")
            await do_call_tool(session, "get_agent", agent_id=agent_id)

            get_header(f"run_agent(agent_id={agent_id!r}, ...)")
            conversation_id = ""
            result = await do_call_tool(session, "run_agent",
                                        agent_id=agent_id, message=args.message,
                                        conversation_id=conversation_id)
            conversation_id = extract_conversation_id(result) or conversation_id

            if interactive:
                logger.info("[Demo] Entering conversation loop. Blank line to stop.")
                turn = 1
                while True:
                    try:
                        user_input = await asyncio.to_thread(input, f"\nYou (turn {turn + 1}): ")
                        user_input = user_input.strip()
                    except (EOFError, KeyboardInterrupt):
                        break
                    if not user_input:
                        break
                    result = await do_call_tool(session, "run_agent",
                                                agent_id=agent_id, message=user_input,
                                                conversation_id=conversation_id)
                    conversation_id = extract_conversation_id(result) or conversation_id
                    turn += 1

            if conversation_id:
                get_header("reset_agent()")
                await do_call_tool(session, "reset_agent", conversation_id=conversation_id)
        else:
            logger.info("[Demo] No agents found — skipping run_agent demo.")

    if not args.skip_workflows:
        get_header("list_workflows()")
        listing = await do_call_tool(session, "list_workflows", page=1, page_size=10)
        wf_ids = extract_ids(listing)

        if wf_ids:
            get_header("search_workflows(keyword='data')")
            await do_call_tool(session, "search_workflows", keyword="data")

            wf_id = args.workflow_id or wf_ids[0]
            get_header(f"get_workflow(workflow_id={wf_id!r})")
            await do_call_tool(session, "get_workflow", workflow_id=wf_id)

            try:
                workflow_inputs = json.loads(args.workflow_inputs)
            except json.JSONDecodeError:
                logger.error(f"--workflow-inputs is not valid JSON: {args.workflow_inputs}")
                workflow_inputs = {}

            get_header(f"run_workflow(workflow_id={wf_id!r}, ...)")
            await do_call_tool(session, "run_workflow",
                               workflow_id=wf_id, inputs=workflow_inputs or None)
        else:
            logger.info("[Demo] No workflows found — skipping workflow demo.")
