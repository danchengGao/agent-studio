#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
"""
Test configuration for evaluation engine tests.

Stubs out the `openjiuwen` core package (separate repo) so that individual
evaluation modules (metrics, pattern_validator, grader_engine) can be
imported and tested in isolation without the full runtime installed.
"""
import logging
import sys
import types
from unittest.mock import MagicMock

# ---------------------------------------------------------------------------
# Stub `openjiuwen` package tree so that evaluation modules can be imported
# without the separate openjiuwen core library being installed.
# ---------------------------------------------------------------------------


def _make_stub_module(name: str) -> types.ModuleType:
    mod = types.ModuleType(name)
    sys.modules[name] = mod
    return mod


def _ensure_openjiuwen_stubs():
    """Insert minimal stubs for openjiuwen.* before any imports."""
    if "openjiuwen" in sys.modules:
        return  # already available (full install), nothing to do

    # Top-level package
    oj = _make_stub_module("openjiuwen")

    # openjiuwen.core
    core = _make_stub_module("openjiuwen.core")
    oj.core = core

    # openjiuwen.core.common
    common = _make_stub_module("openjiuwen.core.common")
    core.common = common

    # openjiuwen.core.common.logging — provides `logger`
    log_mod = _make_stub_module("openjiuwen.core.common.logging")
    log_mod.logger = logging.getLogger("openjiuwen")
    common.logging = log_mod

    # openjiuwen.core.foundation (needed by grader_engine model-based path)
    foundation = _make_stub_module("openjiuwen.core.foundation")
    core.foundation = foundation

    llm = _make_stub_module("openjiuwen.core.foundation.llm")
    llm.InvokeParams = MagicMock
    llm.LLMMessage = MagicMock
    llm.LLMMessageRole = MagicMock
    foundation.llm = llm

    llm_model = _make_stub_module("openjiuwen.core.foundation.llm.model")
    llm_model.Model = MagicMock
    llm.model = llm_model


_ensure_openjiuwen_stubs()
