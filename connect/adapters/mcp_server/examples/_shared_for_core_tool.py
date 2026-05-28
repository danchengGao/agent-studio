#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Shared utilities for SSE MCP client examples."""

import argparse
import json
from typing import Awaitable, Callable

from openjiuwen.core.common.logging import logger
from ._shared import extract_ids


SERVER_ID = "oj-studio-01"

# ── Demo runners for openjiuwen-core client patterns ──────────────────────────


async def do_run_example(call: Callable[[str, dict], Awaitable[dict]], args: argparse.Namespace) -> None:
    """Run the standard demo using call(name, params) -> {"result": ...}."""
    result = await call("health_check", {})
    logger.info(f"health_check() → {result}\n")

    if not args.skip_agents:
        result = await call("list_agents", {"page": 1, "page_size": 5})
        logger.info(f"list_agents(page=1, page_size=5) → {result['result'][:300]}...")
        agent_ids = extract_ids(result["result"])

        result = await call("search_agents", {"keyword": "bot"})
        logger.info(f"search_agents(keyword='bot') → {result['result'][:300]}...\n")

        agent_id = args.agent_id or (agent_ids[0] if agent_ids else None)
        if agent_id:
            result = await call("get_agent", {"agent_id": agent_id})
            logger.info(f"get_agent() → {result['result'][:300]}...")

            result = await call("run_agent", {
                "agent_id": agent_id,
                "message": args.message,
                "conversation_id": "",
            })
            logger.info(f"run_agent() → {result['result'][:300]}...\n")
        else:
            logger.info("No agents found — skipping agent operations.\n")

    if not args.skip_workflows:
        result = await call("list_workflows", {"page": 1, "page_size": 5})
        logger.info(f"list_workflows(page=1, page_size=5) → {result['result'][:300]}...")
        workflow_ids = extract_ids(result["result"])

        if workflow_ids:
            workflow_id = args.workflow_id or workflow_ids[0]
            result = await call("get_workflow", {"workflow_id": workflow_id})
            logger.info(f"get_workflow() → {result['result'][:300]}...\n")

            try:
                workflow_inputs = json.loads(args.workflow_inputs)
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON in --workflow-inputs: {args.workflow_inputs}")
                workflow_inputs = {}

            result = await call("run_workflow", {
                "workflow_id": workflow_id,
                "inputs": workflow_inputs,
            })
            logger.info(f"run_workflow() → {result['result'][:300]}...\n")
        else:
            logger.info("No workflows found — skipping workflow operations.\n")
