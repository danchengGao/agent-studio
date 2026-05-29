#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
"""
Tests for evaluation metrics computation.

Covers pass@k, pass^k, success_rate, latency, token_usage, and aggregate metrics.
"""
import pytest

from openjiuwen_studio.core.executor.evaluation.metrics import (
    _comb,
    compute_aggregate_metrics,
    compute_average_latency,
    compute_pass_at_k,
    compute_pass_pow_k,
    compute_success_rate,
    compute_token_usage,
)


# ──────────────────────────────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────────────────────────────

def _make_result(task_id: str, passed: bool, latency_ms: int = 100, token_usage: dict = None):
    """Create a plain dict result (as stored in DB)."""
    return {
        "task_id": task_id,
        "passed": 1 if passed else 0,
        "latency_ms": latency_ms,
        "token_usage": token_usage or {"prompt_tokens": 50, "completion_tokens": 30, "total_tokens": 80},
    }


@pytest.fixture
def all_pass_results():
    """5 trials for one task, all passing."""
    return [_make_result("task_a", True, latency_ms=100) for _ in range(5)]


@pytest.fixture
def partial_pass_results():
    """One task with 3 passing out of 5 trials."""
    return [
        _make_result("task_a", True, latency_ms=80),
        _make_result("task_a", True, latency_ms=90),
        _make_result("task_a", True, latency_ms=100),
        _make_result("task_a", False, latency_ms=200),
        _make_result("task_a", False, latency_ms=150),
    ]


@pytest.fixture
def multi_task_results():
    """Two tasks, each with 3 trials: task_a all pass, task_b all fail."""
    results = [_make_result("task_a", True) for _ in range(3)]
    results += [_make_result("task_b", False) for _ in range(3)]
    return results


# ──────────────────────────────────────────────────────────────────────────────
# _comb
# ──────────────────────────────────────────────────────────────────────────────

# pylint: disable=protected-access
class TestComb:
    @staticmethod
    def test_basic_values():
        assert _comb(5, 0) == 1.0
        assert _comb(5, 5) == 1.0
        assert _comb(5, 1) == 5.0
        assert _comb(5, 2) == 10.0

    @staticmethod
    def test_k_greater_than_n():
        assert _comb(3, 5) == 0.0

    @staticmethod
    def test_negative_k():
        assert _comb(5, -1) == 0.0

    @staticmethod
    def test_zero_zero():
        assert _comb(0, 0) == 1.0


# ──────────────────────────────────────────────────────────────────────────────
# compute_pass_at_k
# ──────────────────────────────────────────────────────────────────────────────

class TestPassAtK:
    @staticmethod
    def test_all_pass_pass_at_1_is_1(all_pass_results):
        result = compute_pass_at_k(all_pass_results, k_values=[1])
        assert result[1] == pytest.approx(1.0)

    @staticmethod
    def test_all_pass_pass_at_k_is_1(all_pass_results):
        result = compute_pass_at_k(all_pass_results, k_values=[3, 5])
        assert result[3] == pytest.approx(1.0)
        assert result[5] == pytest.approx(1.0)

    @staticmethod
    def test_no_pass_is_zero():
        results = [_make_result("task_a", False) for _ in range(5)]
        result = compute_pass_at_k(results, k_values=[1, 3])
        assert result[1] == pytest.approx(0.0)
        assert result[3] == pytest.approx(0.0)

    @staticmethod
    def test_partial_pass(partial_pass_results):
        # 3 passes out of 5 — pass@1 = 1 - C(2,1)/C(5,1) = 1 - 2/5 = 0.6
        result = compute_pass_at_k(partial_pass_results, k_values=[1])
        assert result[1] == pytest.approx(0.6)

    @staticmethod
    def test_k_larger_than_n_skipped():
        results = [_make_result("task_a", True) for _ in range(2)]
        result = compute_pass_at_k(results, k_values=[5])
        # n=2 < k=5, no task_probs → returns 0.0
        assert result[5] == pytest.approx(0.0)

    @staticmethod
    def test_empty_results():
        result = compute_pass_at_k([], k_values=[1, 3])
        assert result[1] == pytest.approx(0.0)
        assert result[3] == pytest.approx(0.0)

    @staticmethod
    def test_multi_task_average(multi_task_results):
        # task_a: 3/3 pass → pass@1=1.0; task_b: 0/3 pass → pass@1=0.0; avg=0.5
        result = compute_pass_at_k(multi_task_results, k_values=[1])
        assert result[1] == pytest.approx(0.5)

    @staticmethod
    def test_default_k_values(all_pass_results):
        result = compute_pass_at_k(all_pass_results)
        assert set(result.keys()) == {1, 3, 5}


# ──────────────────────────────────────────────────────────────────────────────
# compute_pass_pow_k
# ──────────────────────────────────────────────────────────────────────────────

class TestPassPowK:
    @staticmethod
    def test_all_pass_is_1(all_pass_results):
        result = compute_pass_pow_k(all_pass_results, k_values=[1, 3, 5])
        assert result[1] == pytest.approx(1.0)
        assert result[3] == pytest.approx(1.0)
        assert result[5] == pytest.approx(1.0)

    @staticmethod
    def test_no_pass_is_zero():
        results = [_make_result("task_a", False) for _ in range(5)]
        result = compute_pass_pow_k(results, k_values=[1])
        assert result[1] == pytest.approx(0.0)

    @staticmethod
    def test_partial_pass(partial_pass_results):
        # 3 passes out of 5 — pass^1 = C(3,1)/C(5,1) = 3/5 = 0.6
        result = compute_pass_pow_k(partial_pass_results, k_values=[1])
        assert result[1] == pytest.approx(0.6)

    @staticmethod
    def test_pass_pow_3_partial(partial_pass_results):
        # pass^3 = C(3,3)/C(5,3) = 1/10 = 0.1
        result = compute_pass_pow_k(partial_pass_results, k_values=[3])
        assert result[3] == pytest.approx(0.1)

    @staticmethod
    def test_empty_results():
        result = compute_pass_pow_k([])
        assert result[1] == pytest.approx(0.0)


# ──────────────────────────────────────────────────────────────────────────────
# compute_success_rate
# ──────────────────────────────────────────────────────────────────────────────

class TestSuccessRate:
    @staticmethod
    def test_all_pass(all_pass_results):
        assert compute_success_rate(all_pass_results) == pytest.approx(1.0)

    @staticmethod
    def test_all_fail():
        results = [_make_result("t", False) for _ in range(4)]
        assert compute_success_rate(results) == pytest.approx(0.0)

    @staticmethod
    def test_half_pass():
        results = [_make_result("t", True), _make_result("t", False)]
        assert compute_success_rate(results) == pytest.approx(0.5)

    @staticmethod
    def test_empty():
        assert compute_success_rate([]) == pytest.approx(0.0)


# ──────────────────────────────────────────────────────────────────────────────
# compute_average_latency
# ──────────────────────────────────────────────────────────────────────────────

class TestAverageLatency:
    @staticmethod
    def test_basic():
        results = [
            _make_result("t", True, latency_ms=100),
            _make_result("t", True, latency_ms=200),
        ]
        assert compute_average_latency(results) == pytest.approx(150.0)

    @staticmethod
    def test_empty():
        assert compute_average_latency([]) == pytest.approx(0.0)

    @staticmethod
    def test_none_latency_treated_as_zero():
        r = {"task_id": "t", "passed": 1, "latency_ms": None}
        assert compute_average_latency([r]) == pytest.approx(0.0)


# ──────────────────────────────────────────────────────────────────────────────
# compute_token_usage
# ──────────────────────────────────────────────────────────────────────────────

class TestTokenUsage:
    @staticmethod
    def test_aggregation():
        results = [
            _make_result("t", True, token_usage={"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}),
            _make_result("t", True, token_usage={"prompt_tokens": 20, "completion_tokens": 10, "total_tokens": 30}),
        ]
        totals = compute_token_usage(results)
        assert totals["prompt_tokens"] == 30
        assert totals["completion_tokens"] == 15
        assert totals["total_tokens"] == 45

    @staticmethod
    def test_empty():
        totals = compute_token_usage([])
        assert totals == {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}


# ──────────────────────────────────────────────────────────────────────────────
# compute_aggregate_metrics
# ──────────────────────────────────────────────────────────────────────────────

class TestAggregateMetrics:
    @staticmethod
    def test_returns_expected_keys(all_pass_results):
        result = compute_aggregate_metrics(all_pass_results)
        assert "success_rate" in result
        assert "pass_at_k" in result
        assert "pass_pow_k" in result
        assert "avg_latency_ms" in result
        assert "token_usage" in result
        assert "total_results" in result
        assert "passed" in result

    @staticmethod
    def test_values_correct(all_pass_results):
        result = compute_aggregate_metrics(all_pass_results)
        assert result["success_rate"] == pytest.approx(1.0)
        assert result["total_results"] == 5
        assert result["passed"] == 5

    @staticmethod
    def test_empty():
        result = compute_aggregate_metrics([])
        assert result["success_rate"] == pytest.approx(0.0)
        assert result["total_results"] == 0
