#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
"""
Tests for PatternValidator.

Validates that execution traces are correctly classified by workflow pattern type.
"""
import pytest

from openjiuwen_studio.core.executor.evaluation.pattern_validator import (
    PatternValidator,
    _COMPONENT_TYPE_IF,
    _COMPONENT_TYPE_LOOP,
    _COMPONENT_TYPE_SET_VARIABLE,
    _COMPONENT_TYPE_SUB_WORKFLOW,
    _COMPONENT_TYPE_VARIABLE_MERGE,
)
from openjiuwen_studio.schemas.evaluation import PatternType


def _tracer_chunk(component_type: int, start_time: int = 100, end_time: int = 200) -> dict:
    """Helper: build a tracer_workflow chunk dict."""
    return {
        "type": "tracer_workflow",
        "payload": {
            "component_type": component_type,
            "start_time": start_time,
            "end_time": end_time,
        },
    }


def _trace(*chunks) -> dict:
    """Wrap chunks in a trace dict."""
    return {"chunks": list(chunks), "final_output": "result"}


@pytest.fixture
def validator():
    return PatternValidator()


# ──────────────────────────────────────────────────────────────────────────────
# Routing (PatternType.ROUTING = 0)
# ──────────────────────────────────────────────────────────────────────────────

class TestRoutingPattern:
    @pytest.mark.asyncio
    async def test_detects_if_component(self, validator):
        trace = _trace(_tracer_chunk(_COMPONENT_TYPE_IF))
        assert await validator.validate_pattern(PatternType.ROUTING, trace) is True

    @pytest.mark.asyncio
    async def test_no_if_returns_false(self, validator):
        trace = _trace(_tracer_chunk(1), _tracer_chunk(2))
        assert await validator.validate_pattern(PatternType.ROUTING, trace) is False

    @pytest.mark.asyncio
    async def test_empty_trace_returns_false(self, validator):
        assert await validator.validate_pattern(PatternType.ROUTING, _trace()) is False


# ──────────────────────────────────────────────────────────────────────────────
# Chaining (PatternType.CHAINING = 1)
# ──────────────────────────────────────────────────────────────────────────────

class TestChainingPattern:
    @pytest.mark.asyncio
    async def test_two_spans_passes(self, validator):
        trace = _trace(_tracer_chunk(1), _tracer_chunk(2))
        assert await validator.validate_pattern(PatternType.CHAINING, trace) is True

    @pytest.mark.asyncio
    async def test_one_span_fails(self, validator):
        trace = _trace(_tracer_chunk(1))
        assert await validator.validate_pattern(PatternType.CHAINING, trace) is False

    @pytest.mark.asyncio
    async def test_empty_trace_fails(self, validator):
        assert await validator.validate_pattern(PatternType.CHAINING, _trace()) is False


# ──────────────────────────────────────────────────────────────────────────────
# Parallelization (PatternType.PARALLELIZATION = 2)
# ──────────────────────────────────────────────────────────────────────────────

class TestParallelizationPattern:
    @pytest.mark.asyncio
    async def test_overlapping_windows_detected(self, validator):
        # Chunk A: 100-300, Chunk B: 200-400 → overlap
        trace = _trace(
            _tracer_chunk(1, start_time=100, end_time=300),
            _tracer_chunk(2, start_time=200, end_time=400),
        )
        assert await validator.validate_pattern(PatternType.PARALLELIZATION, trace) is True

    @pytest.mark.asyncio
    async def test_non_overlapping_fallback_three_spans(self, validator):
        # Non-overlapping but 3 components → heuristic fallback
        trace = _trace(
            _tracer_chunk(1, start_time=100, end_time=200),
            _tracer_chunk(2, start_time=300, end_time=400),
            _tracer_chunk(3, start_time=500, end_time=600),
        )
        assert await validator.validate_pattern(PatternType.PARALLELIZATION, trace) is True

    @pytest.mark.asyncio
    async def test_single_non_overlapping_fails(self, validator):
        # Only 2 non-overlapping spans — no overlap, below heuristic threshold
        trace = _trace(
            _tracer_chunk(1, start_time=100, end_time=200),
            _tracer_chunk(2, start_time=300, end_time=400),
        )
        assert await validator.validate_pattern(PatternType.PARALLELIZATION, trace) is False


# ──────────────────────────────────────────────────────────────────────────────
# Orchestrator-Worker (PatternType.ORCHESTRATOR_WORKER = 3)
# ──────────────────────────────────────────────────────────────────────────────

class TestOrchestratorWorkerPattern:
    @pytest.mark.asyncio
    async def test_sub_workflow_detected(self, validator):
        trace = _trace(_tracer_chunk(_COMPONENT_TYPE_SUB_WORKFLOW))
        assert await validator.validate_pattern(PatternType.ORCHESTRATOR_WORKER, trace) is True

    @pytest.mark.asyncio
    async def test_no_sub_workflow_fails(self, validator):
        trace = _trace(_tracer_chunk(1), _tracer_chunk(2))
        assert await validator.validate_pattern(PatternType.ORCHESTRATOR_WORKER, trace) is False


# ──────────────────────────────────────────────────────────────────────────────
# Evaluator-Optimizer (PatternType.EVALUATOR_OPTIMIZER = 4)
# ──────────────────────────────────────────────────────────────────────────────

class TestEvaluatorOptimizerPattern:
    @pytest.mark.asyncio
    async def test_loop_detected(self, validator):
        trace = _trace(_tracer_chunk(_COMPONENT_TYPE_LOOP))
        assert await validator.validate_pattern(PatternType.EVALUATOR_OPTIMIZER, trace) is True

    @pytest.mark.asyncio
    async def test_no_loop_fails(self, validator):
        trace = _trace(_tracer_chunk(1))
        assert await validator.validate_pattern(PatternType.EVALUATOR_OPTIMIZER, trace) is False


# ──────────────────────────────────────────────────────────────────────────────
# Memory Usage (PatternType.MEMORY_USAGE = 5)
# ──────────────────────────────────────────────────────────────────────────────

class TestMemoryUsagePattern:
    @pytest.mark.asyncio
    async def test_set_variable_detected(self, validator):
        trace = _trace(_tracer_chunk(_COMPONENT_TYPE_SET_VARIABLE))
        assert await validator.validate_pattern(PatternType.MEMORY_USAGE, trace) is True

    @pytest.mark.asyncio
    async def test_variable_merge_detected(self, validator):
        trace = _trace(_tracer_chunk(_COMPONENT_TYPE_VARIABLE_MERGE))
        assert await validator.validate_pattern(PatternType.MEMORY_USAGE, trace) is True

    @pytest.mark.asyncio
    async def test_neither_fails(self, validator):
        trace = _trace(_tracer_chunk(1), _tracer_chunk(2))
        assert await validator.validate_pattern(PatternType.MEMORY_USAGE, trace) is False


# ──────────────────────────────────────────────────────────────────────────────
# Edge cases
# ──────────────────────────────────────────────────────────────────────────────

class TestEdgeCases:
    @pytest.mark.asyncio
    async def test_unknown_pattern_type_returns_false(self, validator):
        trace = _trace(_tracer_chunk(1))
        assert await validator.validate_pattern(999, trace) is False

    @pytest.mark.asyncio
    async def test_exception_in_trace_returns_false(self, validator):
        # Passing None as trace should not raise
        result = await validator.validate_pattern(PatternType.ROUTING, None)
        assert result is False

    @pytest.mark.asyncio
    async def test_non_tracer_chunks_ignored(self, validator):
        trace = {
            "chunks": [
                {"type": "text", "payload": {"component_type": _COMPONENT_TYPE_IF}},
                {"type": "tool_call", "payload": {"component_type": _COMPONENT_TYPE_IF}},
            ]
        }
        # Only "tracer_workflow" chunks count → routing returns False
        assert await validator.validate_pattern(PatternType.ROUTING, trace) is False
