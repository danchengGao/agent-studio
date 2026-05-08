#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Shared utilities for SSE MCP client examples."""

import argparse
import json
from typing import Any

from openjiuwen.core.common.logging import logger
from ._shared import extract_ids


async def do_run_example(client: Any, args: argparse.Namespace) -> None:
    """Run the standard demo using client.call_tool(name, params) directly."""
    logger.info("Calling health_check:")
    result = await client.call_tool("health_check", {})
    logger.info(f"  {result}\n")

    if not args.skip_agents:
        logger.info("Calling list_agents (page 1, page_size 5):")
        result = await client.call_tool("list_agents", {"page": 1, "page_size": 5})
        logger.info(f"  {result}\n")
        agent_ids = extract_ids(str(result))

        logger.info("Calling search_agents (keyword='bot'):")
        result = await client.call_tool("search_agents", {"keyword": "bot"})
        logger.info(f"  {result}\n")

        agent_id = args.agent_id or (agent_ids[0] if agent_ids else None)
        if agent_id:
            logger.info(f"Calling get_agent (agent_id={agent_id}):")
            result = await client.call_tool("get_agent", {"agent_id": agent_id})
            logger.info(f"  {result}\n")

            logger.info(f"Calling run_agent (agent_id={agent_id}, message='{args.message}'):")
            result = await client.call_tool("run_agent", {
                "agent_id": agent_id,
                "message": args.message,
                "conversation_id": "",
            })
            logger.info(f"  {result}\n")
        else:
            logger.info("No agents found — skipping agent operations.\n")

    if not args.skip_workflows:
        logger.info("Calling list_workflows (page 1, page_size 5):")
        result = await client.call_tool("list_workflows", {"page": 1, "page_size": 5})
        logger.info(f"  {result}\n")
        workflow_ids = extract_ids(str(result))

        if workflow_ids:
            workflow_id = args.workflow_id or workflow_ids[0]
            logger.info(f"Calling get_workflow (workflow_id={workflow_id}):")
            result = await client.call_tool("get_workflow", {"workflow_id": workflow_id})
            logger.info(f"  {result}\n")

            try:
                workflow_inputs = json.loads(args.workflow_inputs)
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON in --workflow-inputs: {args.workflow_inputs}")
                workflow_inputs = {}

            logger.info(f"Calling run_workflow (workflow_id={workflow_id}, inputs={workflow_inputs}):")
            result = await client.call_tool("run_workflow", {
                "workflow_id": workflow_id,
                "inputs": workflow_inputs,
            })
            logger.info(f"  {result}\n")
        else:
            logger.info("No workflows found — skipping workflow operations.\n")
