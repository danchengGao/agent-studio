#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Shared utilities for Stdio MCP client examples."""

import argparse
import os
from pathlib import Path

from .._shared import build_parser as build_parser_shared


PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.parent.parent
SERVER_SCRIPT = str(PROJECT_ROOT / "connect" / "adapters" / "mcp_server" / "server.py")

_SERVER_MODULE = "connect.adapters.mcp_server.server"


# ── Argument parser ────────────────────────────────────────────────────────────

def build_parser(description: str) -> argparse.ArgumentParser:
    """Create argument parser with common Stdio client arguments."""
    p = build_parser_shared(description)
    p.add_argument("--token", default=os.getenv("OJ_TOKEN"),
                   help="Backend access token (env: OJ_TOKEN, required)")
    return p
