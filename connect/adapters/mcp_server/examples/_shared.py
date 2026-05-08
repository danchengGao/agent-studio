#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Shared utilities for Stdio MCP client examples."""

import argparse
from typing import Any
from openjiuwen.core.common.logging import logger


SERVER_NAME = "openjiuwen-studio"


def build_parser(description: str) -> argparse.ArgumentParser:
    """Create argument parser with common Stdio client arguments."""
    p = argparse.ArgumentParser(
        description=description,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--agent-id", default=None,
                   help="Run this agent (default: uses first from list_agents)")
    p.add_argument("--message", default="Hello! What can you help me with?",
                   help="Message to send to agent")
    p.add_argument("--workflow-id", default=None,
                   help="Run this workflow (default: uses first from list_workflows)")
    p.add_argument("--workflow-inputs", default="{}",
                   help='Workflow inputs as JSON string')
    p.add_argument("--skip-agents", action="store_true", help="Skip agent operations")
    p.add_argument("--skip-workflows", action="store_true", help="Skip workflow operations")
    return p


# ── ID extraction ──────────────────────────────────────────────────────────────

def extract_ids(listing: str) -> list[str]:
    """Pull IDs from a list_agents / list_workflows output string."""
    ids = []
    for line in listing.splitlines():
        if "•" in line and "[" in line:
            try:
                start = line.index("[") + 1
                end = line.index("]", start)
                ids.append(line[start:end])
            except ValueError:
                continue
    return ids


_SEP = "─" * 60


def get_header(title: str) -> None:
    logger.info(f"\n{_SEP}\n  {title}\n{_SEP}")


def get_tool_call_args(name: str, **kwargs) -> None:
    args_str = ", ".join(f"{k}={v!r}" for k, v in kwargs.items() if v not in (None, "", {}))
    logger.info(f"[MCP tool call]  {name}({args_str})")


def log_tool_result(text: str) -> None:
    for line in text.splitlines():
        logger.info(f"  {line}")


def extract_conversation_id(result: str) -> str | None:
    for line in result.splitlines():
        if line.startswith("Conversation ID:"):
            return line.split(":", 1)[1].strip()
    return None


async def do_call_tool(session: Any, name: str, **kwargs) -> str:
    get_tool_call_args(name, **kwargs)
    result = await session.call_tool(name, arguments=kwargs or None)
    text = result.content[0].text if result.content else "(no content)"
    log_tool_result(text)
    return text
