#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
"""
Tests for GraderEngine.

Covers deterministic (all check types), code-based graders, and helper methods.
Model-based graders are not tested here as they require external LLM services.
"""
import pytest

from openjiuwen_studio.core.executor.evaluation.grader_engine import GraderEngine
from openjiuwen_studio.schemas.evaluation import GraderType


# ──────────────────────────────────────────────────────────────────────────────
# Fixtures & helpers
# ──────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def engine():
    return GraderEngine()


def _det_grader(check_type: str, **cfg_kwargs) -> dict:
    """Build a deterministic grader config dict."""
    return {
        "name": f"test_{check_type}",
        "grader_type": GraderType.DETERMINISTIC,
        "config": {"check_type": check_type, **cfg_kwargs},
    }


def _code_grader(code: str, fn_name: str = "grade") -> dict:
    return {
        "name": "test_code_grader",
        "grader_type": GraderType.CODE_BASED,
        "config": {"code": code, "function_name": fn_name},
    }


def _trace(final_output=None, chunks=None):
    return {
        "final_output": final_output,
        "chunks": chunks or [],
        "trace_id": "test-trace-001",
    }


def _tracer_chunk(component_type: int):
    return {"type": "tracer_workflow", "payload": {"component_type": component_type}}


def _tool_chunk(tool_name: str):
    return {"type": "tool_call", "payload": {"tool_name": tool_name}}


# ──────────────────────────────────────────────────────────────────────────────
# _compare helper
# ──────────────────────────────────────────────────────────────────────────────

# pylint: disable=protected-access
class TestCompare:
    @staticmethod
    def test_eq(engine):
        assert engine._compare("hello", "hello", "eq") is True
        assert engine._compare("hello", "world", "eq") is False

    @staticmethod
    def test_ne(engine):
        assert engine._compare("a", "b", "ne") is True

    @staticmethod
    def test_gt_lt_ge_le(engine):
        assert engine._compare(5, 3, "gt") is True
        assert engine._compare(5, 7, "lt") is True
        assert engine._compare(5, 5, "ge") is True
        assert engine._compare(5, 5, "le") is True

    @staticmethod
    def test_contains(engine):
        assert engine._compare("hello world", "world", "contains") is True
        assert engine._compare("hello world", "python", "contains") is False

    @staticmethod
    def test_not_contains(engine):
        assert engine._compare("hello world", "python", "not_contains") is True

    @staticmethod
    def test_regex(engine):
        assert engine._compare("price: $42.99", r"\$\d+\.\d{2}", "regex") is True
        assert engine._compare("no price here", r"\$\d+", "regex") is False

    @staticmethod
    def test_is_not_empty(engine):
        assert engine._compare("text", None, "is_not_empty") is True
        assert engine._compare("", None, "is_not_empty") is False
        assert engine._compare(None, None, "is_not_empty") is False
        assert engine._compare([], None, "is_not_empty") is False
        assert engine._compare({}, None, "is_not_empty") is False

    @staticmethod
    def test_unknown_condition(engine):
        assert engine._compare("a", "a", "unknown_condition") is False

    @staticmethod
    def test_type_error_returns_false(engine):
        assert engine._compare(None, 5, "gt") is False


# ──────────────────────────────────────────────────────────────────────────────
# _get_nested helper
# ──────────────────────────────────────────────────────────────────────────────

# pylint: disable=protected-access
class TestGetNested:
    @staticmethod
    def test_empty_path_returns_data(engine):
        assert engine._get_nested({"a": 1}, "") == {"a": 1}

    @staticmethod
    def test_single_key(engine):
        assert engine._get_nested({"key": "value"}, "key") == "value"

    @staticmethod
    def test_nested_path(engine):
        data = {"a": {"b": {"c": 42}}}
        assert engine._get_nested(data, "a.b.c") == 42

    @staticmethod
    def test_missing_key_returns_none(engine):
        assert engine._get_nested({"a": 1}, "b") is None

    @staticmethod
    def test_none_data(engine):
        assert engine._get_nested(None, "key") is None


# ──────────────────────────────────────────────────────────────────────────────
# Deterministic — output_check
# ──────────────────────────────────────────────────────────────────────────────

# pylint: disable=protected-access
class TestOutputCheck:
    @staticmethod
    def test_contains_passes(engine):
        grader = _det_grader("output_check", condition="contains", expected_value="hello")
        result = engine._run_deterministic(grader, _trace(final_output="hello world"), None)
        assert result["passed"] is True
        assert result["score"] == pytest.approx(1.0)

    @staticmethod
    def test_contains_fails(engine):
        grader = _det_grader("output_check", condition="contains", expected_value="python")
        result = engine._run_deterministic(grader, _trace(final_output="hello world"), None)
        assert result["passed"] is False
        assert result["score"] == pytest.approx(0.0)

    @staticmethod
    def test_eq_condition(engine):
        grader = _det_grader("output_check", condition="eq", expected_value="exact")
        result = engine._run_deterministic(grader, _trace(final_output="exact"), None)
        assert result["passed"] is True

    @staticmethod
    def test_path_extraction(engine):
        grader = _det_grader("output_check", condition="eq", path="status", expected_value="ok")
        result = engine._run_deterministic(grader, _trace(final_output={"status": "ok"}), None)
        assert result["passed"] is True

    @staticmethod
    def test_is_not_empty(engine):
        grader = _det_grader("output_check", condition="is_not_empty", expected_value="")
        result = engine._run_deterministic(grader, _trace(final_output="some output"), None)
        assert result["passed"] is True


# ──────────────────────────────────────────────────────────────────────────────
# Deterministic — state_check
# ──────────────────────────────────────────────────────────────────────────────

# pylint: disable=protected-access
class TestStateCheck:
    @staticmethod
    def test_nested_state_passes(engine):
        grader = _det_grader("state_check", path="result.score", condition="ge", expected_value=0.8)
        trace = _trace(final_output={"result": {"score": 0.95}})
        result = engine._run_deterministic(grader, trace, None)
        assert result["passed"] is True

    @staticmethod
    def test_missing_path_fails(engine):
        grader = _det_grader("state_check", path="nonexistent.key", condition="eq", expected_value=42)
        result = engine._run_deterministic(grader, _trace(final_output={}), None)
        assert result["passed"] is False


# ──────────────────────────────────────────────────────────────────────────────
# Deterministic — tool_call_check
# ──────────────────────────────────────────────────────────────────────────────

# pylint: disable=protected-access
class TestToolCallCheck:
    @staticmethod
    def test_expected_tool_present(engine):
        grader = _det_grader("tool_call_check", expected_tools=["search_tool"])
        chunks = [_tool_chunk("search_tool"), _tool_chunk("calculator")]
        result = engine._run_deterministic(grader, _trace(chunks=chunks), None)
        assert result["passed"] is True

    @staticmethod
    def test_missing_tool(engine):
        grader = _det_grader("tool_call_check", expected_tools=["missing_tool"])
        chunks = [_tool_chunk("other_tool")]
        result = engine._run_deterministic(grader, _trace(chunks=chunks), None)
        assert result["passed"] is False

    @staticmethod
    def test_partial_tools_partial_score(engine):
        grader = _det_grader("tool_call_check", expected_tools=["tool_a", "tool_b"])
        chunks = [_tool_chunk("tool_a")]  # only one of two
        result = engine._run_deterministic(grader, _trace(chunks=chunks), None)
        assert result["passed"] is False
        assert result["score"] == pytest.approx(0.5)

    @staticmethod
    def test_no_tools_required(engine):
        grader = _det_grader("tool_call_check", expected_tools=[])
        result = engine._run_deterministic(grader, _trace(), None)
        assert result["passed"] is True


# ──────────────────────────────────────────────────────────────────────────────
# Deterministic — pattern_check (regex on full trace JSON)
# ──────────────────────────────────────────────────────────────────────────────

# pylint: disable=protected-access
class TestPatternCheck:
    @staticmethod
    def test_regex_matches(engine):
        grader = _det_grader("pattern_check", pattern=r"hello")
        result = engine._run_deterministic(grader, _trace(final_output="hello world"), None)
        assert result["passed"] is True

    @staticmethod
    def test_regex_no_match(engine):
        grader = _det_grader("pattern_check", pattern=r"python\d+")
        result = engine._run_deterministic(grader, _trace(final_output="hello world"), None)
        assert result["passed"] is False

    @staticmethod
    def test_empty_pattern_fails(engine):
        grader = _det_grader("pattern_check", pattern="")
        result = engine._run_deterministic(grader, _trace(final_output="anything"), None)
        assert result["passed"] is False


# ──────────────────────────────────────────────────────────────────────────────
# Deterministic — transcript_check
# ──────────────────────────────────────────────────────────────────────────────

# pylint: disable=protected-access
class TestTranscriptCheck:
    @staticmethod
    def test_tool_call_count_ge(engine):
        grader = _det_grader("transcript_check", metric="tool_call_count", condition="ge", expected_value=2)
        chunks = [_tool_chunk("tool_a"), _tool_chunk("tool_b"), _tool_chunk("tool_c")]
        result = engine._run_deterministic(grader, _trace(chunks=chunks), None)
        assert result["passed"] is True

    @staticmethod
    def test_component_count_ge(engine):
        grader = _det_grader("transcript_check", metric="component_count", condition="ge", expected_value=2)
        chunks = [_tracer_chunk(1), _tracer_chunk(2)]
        result = engine._run_deterministic(grader, _trace(chunks=chunks), None)
        assert result["passed"] is True


# ──────────────────────────────────────────────────────────────────────────────
# Code-based graders
# ──────────────────────────────────────────────────────────────────────────────

# pylint: disable=protected-access
class TestCodeBasedGrader:
    @staticmethod
    def test_simple_pass(engine):
        code = """
def grade(trace, expected):
    output = trace.get("final_output", "")
    return {"passed": "hello" in str(output), "score": 1.0 if "hello" in str(output) else 0.0}
"""
        grader = _code_grader(code)
        result = engine._run_code_based(grader, _trace(final_output="hello world"), None)
        assert result["passed"] is True
        assert result["score"] == pytest.approx(1.0)

    @staticmethod
    def test_simple_fail(engine):
        code = """
def grade(trace, expected):
    return {"passed": False, "score": 0.0}
"""
        grader = _code_grader(code)
        result = engine._run_code_based(grader, _trace(), None)
        assert result["passed"] is False

    @staticmethod
    def test_no_code_returns_error(engine):
        grader = _code_grader("")
        result = engine._run_code_based(grader, _trace(), None)
        assert result["passed"] is False
        assert "error" in result

    @staticmethod
    def test_syntax_error_returns_error(engine):
        grader = _code_grader("def grade(!!invalid")
        result = engine._run_code_based(grader, _trace(), None)
        assert result["passed"] is False
        assert "error" in result

    @staticmethod
    def test_missing_function_returns_error(engine):
        code = "x = 1  # no grade function defined"
        grader = _code_grader(code)
        result = engine._run_code_based(grader, _trace(), None)
        assert result["passed"] is False
        assert "error" in result

    @staticmethod
    def test_function_returns_bool(engine):
        code = """
def grade(trace, expected):
    return True
"""
        grader = _code_grader(code)
        result = engine._run_code_based(grader, _trace(final_output="anything"), None)
        assert result["passed"] is True

    @staticmethod
    def test_custom_function_name(engine):
        code = """
def my_evaluator(trace, expected):
    return {"passed": True, "score": 0.9}
"""
        grader = {
            "name": "custom_fn",
            "grader_type": GraderType.CODE_BASED,
            "config": {"code": code, "function_name": "my_evaluator"},
        }
        result = engine._run_code_based(grader, _trace(final_output="ok"), None)
        assert result["passed"] is True
        assert result["score"] == pytest.approx(0.9)


# ──────────────────────────────────────────────────────────────────────────────
# run_graders integration (deterministic only, no external services)
# ──────────────────────────────────────────────────────────────────────────────

class TestRunGraders:
    @staticmethod
    @pytest.mark.asyncio
    async def test_empty_graders_returns_empty(engine):
        results = await engine.run_graders([], _trace(), None, "space-001")
        assert results == []

    @staticmethod
    @pytest.mark.asyncio
    async def test_single_deterministic_grader(engine):
        graders = [_det_grader("output_check", condition="contains", expected_value="test")]
        results = await engine.run_graders(graders, _trace(final_output="test output"), None, "space-001")
        assert len(results) == 1
        assert results[0]["passed"] is True

    @staticmethod
    @pytest.mark.asyncio
    async def test_multiple_graders(engine):
        graders = [
            _det_grader("output_check", condition="contains", expected_value="success"),
            _det_grader("output_check", condition="not_contains", expected_value="error"),
        ]
        results = await engine.run_graders(graders, _trace(final_output="success!"), None, "space-001")
        assert len(results) == 2
        assert all(r["passed"] for r in results)

    @staticmethod
    @pytest.mark.asyncio
    async def test_unknown_grader_type(engine):
        graders = [{"name": "bad", "grader_type": 99, "config": {}}]
        results = await engine.run_graders(graders, _trace(), None, "space-001")
        assert len(results) == 1
        assert results[0]["passed"] is False
        assert "error" in results[0]

    @staticmethod
    @pytest.mark.asyncio
    async def test_default_grader_type_is_deterministic(engine):
        # Missing grader_type → defaults to DETERMINISTIC (0)
        graders = [{
            "name": "implicit_det",
            "config": {"check_type": "output_check", "condition": "eq", "expected_value": "ok"}
        }]
        results = await engine.run_graders(graders, _trace(final_output="ok"), None, "space-001")
        assert results[0]["passed"] is True
