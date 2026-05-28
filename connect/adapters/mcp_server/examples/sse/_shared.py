#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Shared utilities for SSE MCP client examples."""

import argparse
import os

from .._shared import build_parser as build_parser_shared


# ── Argument parser ────────────────────────────────────────────────────────────

def build_parser(description: str) -> argparse.ArgumentParser:
    """Create argument parser with common SSE client arguments."""
    p = build_parser_shared(description)
    p.add_argument(
        "--server-url", default=os.getenv("OJ_SERVER_URL", "http://127.0.0.1:8080/sse"),
        help="SSE server URL (env: OJ_SERVER_URL, default: http://127.0.0.1:8080/sse)",
    )
    return p
