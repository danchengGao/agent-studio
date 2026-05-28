#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
"""
Evaluation metrics computation.

Implements pass@k, pass^k, success rate, latency stats, score stats,
token usage, and error rate metrics, plus reliability metrics.
"""
import math
from collections import defaultdict
from typing import Any, Dict, List, Optional

from openjiuwen_studio.core.executor.evaluation.reliability_metrics import (
    compute_all_reliability_metrics
)


def _comb(n: int, k: int) -> float:
    """Compute binomial coefficient C(n, k) safely."""
    if k > n or k < 0:
        return 0.0
    if k == 0 or k == n:
        return 1.0
    return float(math.comb(n, k))


def _get(r: Any, field: str, default: Any = None) -> Any:
    """Unified attribute/dict access for result objects."""
    return r.__dict__.get(field, default) if hasattr(r, "__dict__") and field in r.__dict__ \
        else (getattr(r, field, default) if hasattr(r, field) else r.get(field, default) if isinstance(r, dict)
    else default)


def compute_pass_at_k(
    results: List[Any],
    k_values: Optional[List[int]] = None
) -> Dict[int, float]:
    """
    Compute pass@k metric across all task results.

    pass@k = probability that at least one of k independent samples passes.
    Formula: pass@k = 1 - C(n-c, k) / C(n, k)
    where n = total trials for a task, c = number of passing trials.
    """
    if k_values is None:
        k_values = [1, 3, 5]

    task_results: Dict[str, List[bool]] = defaultdict(list)
    for r in results:
        task_id = r.task_id if hasattr(r, "task_id") else r.get("task_id", "")
        passed = bool(r.passed if hasattr(r, "passed") else r.get("passed", False))
        task_results[task_id].append(passed)

    pass_at_k: Dict[int, float] = {}
    for k in k_values:
        task_probs = []
        for passes in task_results.values():
            n = len(passes)
            c = sum(passes)
            if n < k:
                continue
            denom = _comb(n, k)
            if denom == 0:
                continue
            prob = 1.0 - _comb(n - c, k) / denom
            task_probs.append(prob)
        pass_at_k[k] = sum(task_probs) / len(task_probs) if task_probs else 0.0

    return pass_at_k


def compute_pass_pow_k(
    results: List[Any],
    k_values: Optional[List[int]] = None
) -> Dict[int, float]:
    """
    Compute pass^k metric across all task results.

    pass^k = probability that all k independent samples pass.
    Formula: pass^k = C(c, k) / C(n, k)
    """
    if k_values is None:
        k_values = [1, 3, 5]

    task_results: Dict[str, List[bool]] = defaultdict(list)
    for r in results:
        task_id = r.task_id if hasattr(r, "task_id") else r.get("task_id", "")
        passed = bool(r.passed if hasattr(r, "passed") else r.get("passed", False))
        task_results[task_id].append(passed)

    pass_pow_k: Dict[int, float] = {}
    for k in k_values:
        task_probs = []
        for passes in task_results.values():
            n = len(passes)
            c = sum(passes)
            if n < k:
                continue
            denom = _comb(n, k)
            if denom == 0:
                continue
            prob = _comb(c, k) / denom
            task_probs.append(prob)
        pass_pow_k[k] = sum(task_probs) / len(task_probs) if task_probs else 0.0

    return pass_pow_k


def compute_success_rate(results: List[Any]) -> float:
    """Overall fraction of passed results."""
    if not results:
        return 0.0
    passed = sum(
        1 for r in results
        if bool(r.passed if hasattr(r, "passed") else r.get("passed", False))
    )
    return passed / len(results)


def compute_latency_stats(results: List[Any]) -> Dict[str, float]:
    """Compute latency percentiles (median, p75, p95), range (min, max), std dev, and CV."""
    latencies = sorted([
        float(r.latency_ms if hasattr(r, "latency_ms") else r.get("latency_ms") or 0)
        for r in results
        if (r.latency_ms if hasattr(r, "latency_ms") else r.get("latency_ms") or 0) > 0
    ])
    if not latencies:
        return {
            "min_ms": 0.0, "max_ms": 0.0, "median_ms": 0.0,
            "p75_ms": 0.0, "p95_ms": 0.0, "std_ms": 0.0, "cv": 0.0,
        }
    n = len(latencies)
    avg = sum(latencies) / n
    median = (latencies[(n - 1) // 2] + latencies[n // 2]) / 2.0
    p75_idx = max(0, int(math.ceil(0.75 * n)) - 1)
    p95_idx = max(0, int(math.ceil(0.95 * n)) - 1)
    variance = sum((v - avg) ** 2 for v in latencies) / n
    std = math.sqrt(variance)
    cv = std / avg if avg > 0 else 0.0
    return {
        "min_ms": latencies[0],
        "max_ms": latencies[-1],
        "median_ms": median,
        "p75_ms": latencies[p75_idx],
        "p95_ms": latencies[p95_idx],
        "std_ms": std,
        "cv": cv,
    }


def compute_score_stats(results: List[Any]) -> Dict[str, float]:
    """
    Compute score distribution: mean, median, standard deviation, min, max.

    std close to 0 means the agent is consistent; high std means variable quality.
    """
    scores = sorted([
        float(r.score if hasattr(r, "score") else r.get("score") or 0.0)
        for r in results
        if (r.score if hasattr(r, "score") else r.get("score")) is not None
    ])
    if not scores:
        return {"avg": 0.0, "median": 0.0, "std": 0.0, "min": 0.0, "max": 0.0}
    n = len(scores)
    avg = sum(scores) / n
    variance = sum((s - avg) ** 2 for s in scores) / n
    median = (scores[(n - 1) // 2] + scores[n // 2]) / 2.0
    return {
        "avg": avg,
        "median": median,
        "std": math.sqrt(variance),
        "min": scores[0],
        "max": scores[-1],
    }


def compute_error_rate(results: List[Any]) -> float:
    """Fraction of trials that raised an error (had a non-empty error_message)."""
    if not results:
        return 0.0
    errors = sum(
        1 for r in results
        if (r.error_message if hasattr(r, "error_message") else r.get("error_message"))
    )
    return errors / len(results)


def compute_average_latency(results: List[Any]) -> float:
    """Average latency in milliseconds across all results."""
    if not results:
        return 0.0
    latencies = [
        (r.latency_ms if hasattr(r, "latency_ms") else r.get("latency_ms") or 0)
        for r in results
    ]
    return sum(latencies) / len(latencies)


def compute_token_usage(results: List[Any]) -> Dict[str, int]:
    """Aggregate token usage across all results."""
    totals: Dict[str, int] = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    for r in results:
        usage = r.token_usage if hasattr(r, "token_usage") else r.get("token_usage") or {}
        if usage:
            for key in totals:
                totals[key] += usage.get(key, 0)
    return totals


def compute_perfect_score_rate(results: List[Any]) -> float:
    """Fraction of trials with score exactly 1.0 (fully correct)."""
    scored = [
        r for r in results
        if (r.score if hasattr(r, "score") else r.get("score")) is not None
    ]
    if not scored:
        return 0.0
    perfect = sum(
        1 for r in scored
        if float(r.score if hasattr(r, "score") else r.get("score", 0.0)) >= 1.0
    )
    return perfect / len(scored)


def compute_score_distribution(results: List[Any]) -> Dict[str, float]:
    """
    Score histogram: fraction of trials in each 20-point bucket.

    Returns dict with keys '0_20', '20_40', '40_60', '60_80', '80_100',
    each holding the fraction (0.0–1.0) of trials falling in that bucket.
    """
    scores = [
        float(r.score if hasattr(r, "score") else r.get("score") or 0.0)
        for r in results
        if (r.score if hasattr(r, "score") else r.get("score")) is not None
    ]
    if not scores:
        return {}
    buckets: Dict[str, int] = {"0_20": 0, "20_40": 0, "40_60": 0, "60_80": 0, "80_100": 0}
    for s in scores:
        if s < 0.2:
            buckets["0_20"] += 1
        elif s < 0.4:
            buckets["20_40"] += 1
        elif s < 0.6:
            buckets["40_60"] += 1
        elif s < 0.8:
            buckets["60_80"] += 1
        else:
            buckets["80_100"] += 1
    n = len(scores)
    return {k: v / n for k, v in buckets.items()}


def compute_tokens_per_trial(results: List[Any]) -> Dict[str, float]:
    """Average token usage (prompt, completion, total) per trial."""
    totals: Dict[str, int] = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    count = 0
    for r in results:
        usage = r.token_usage if hasattr(r, "token_usage") else r.get("token_usage") or {}
        if usage:
            for key in totals:
                totals[key] += usage.get(key, 0)
            count += 1
    if count == 0:
        return {}
    return {k: round(v / count, 1) for k, v in totals.items()}


def compute_per_grader_breakdown(results: List[Any]) -> Dict[str, Dict[str, Any]]:
    """
    Per-grader aggregate: pass rate, average score, and trial count.

    Returns {grader_name: {pass_rate, avg_score, count}}.
    Useful for spotting which individual grader (criterion) is failing.
    """
    grader_data: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for r in results:
        grader_results = r.grader_results if hasattr(r, "grader_results") else r.get("grader_results") or []
        for gr in grader_results:
            name = gr.get("name") or gr.get("grader_name") or "unknown"
            grader_data[name].append({
                "passed": bool(gr.get("passed", False)),
                "score": float(gr.get("score") or 0.0),
            })
    breakdown: Dict[str, Dict[str, Any]] = {}
    for name, items in grader_data.items():
        n = len(items)
        pass_rate = sum(1 for i in items if i["passed"]) / n
        avg_score = sum(i["score"] for i in items) / n
        breakdown[name] = {"pass_rate": pass_rate, "avg_score": avg_score, "count": n}
    return breakdown


def compute_flakiness(results: List[Any]) -> Optional[float]:
    """
    Flakiness score: mean std-dev of pass/fail per unique task input.

    Range 0.0 (perfectly consistent) to 0.5 (maximally random).
    Returns None when no task has more than one trial.
    """
    task_passes: Dict[str, List[float]] = defaultdict(list)
    for r in results:
        task_id = r.task_id if hasattr(r, "task_id") else r.get("task_id", "")
        passed = 1.0 if bool(r.passed if hasattr(r, "passed") else r.get("passed", False)) else 0.0
        task_passes[task_id].append(passed)
    stds = []
    for passes in task_passes.values():
        if len(passes) < 2:
            continue
        n = len(passes)
        mean = sum(passes) / n
        variance = sum((p - mean) ** 2 for p in passes) / n
        stds.append(math.sqrt(variance))
    if not stds:
        return None
    return sum(stds) / len(stds)


def compute_task_level_stats(results: List[Any]) -> Dict[str, Any]:
    """
    Task-level pass statistics (one entry per unique task, not per trial).

    - total_tasks: number of unique tasks evaluated
    - task_pass_rate: fraction of tasks where at least one trial passed (pass@1 equivalent)
    - tasks_fully_passed_rate: fraction of tasks where every trial passed
    - tasks_never_passed_rate: fraction of tasks where no trial passed (always fails)
    """
    task_passes: Dict[str, List[bool]] = defaultdict(list)
    for r in results:
        task_id = r.task_id if hasattr(r, "task_id") else r.get("task_id", "")
        passed = bool(r.passed if hasattr(r, "passed") else r.get("passed", False))
        task_passes[task_id].append(passed)

    if not task_passes:
        return {
            "total_tasks": 0,
            "task_pass_rate": 0.0,
            "tasks_fully_passed_rate": 0.0,
            "tasks_never_passed_rate": 0.0,
        }

    total = len(task_passes)
    at_least_one = sum(1 for passes in task_passes.values() if any(passes))
    all_passed = sum(1 for passes in task_passes.values() if all(passes))
    never_passed = sum(1 for passes in task_passes.values() if not any(passes))
    return {
        "total_tasks": total,
        "task_pass_rate": at_least_one / total,
        "tasks_fully_passed_rate": all_passed / total,
        "tasks_never_passed_rate": never_passed / total,
    }


def compute_tokens_efficiency(results: List[Any]) -> Dict[str, Any]:
    """
    Token usage split by outcome: avg tokens for passed vs failed trials.

    Returns dict with keys 'passed' and 'failed', each containing
    {prompt_tokens, completion_tokens, total_tokens} averages.
    Only populated when token usage data is present.
    """
    passed_tokens: List[Dict[str, int]] = []
    failed_tokens: List[Dict[str, int]] = []
    for r in results:
        usage = r.token_usage if hasattr(r, "token_usage") else r.get("token_usage") or {}
        if not usage:
            continue
        passed = bool(r.passed if hasattr(r, "passed") else r.get("passed", False))
        if passed:
            passed_tokens.append(usage)
        else:
            failed_tokens.append(usage)

    def _avg(token_list: List[Dict[str, int]]) -> Optional[Dict[str, float]]:
        if not token_list:
            return None
        keys = ["prompt_tokens", "completion_tokens", "total_tokens"]
        return {k: round(sum(t.get(k, 0) for t in token_list) / len(token_list), 1) for k in keys}

    result: Dict[str, Any] = {}
    p = _avg(passed_tokens)
    f = _avg(failed_tokens)
    if p is not None:
        result["passed"] = p
    if f is not None:
        result["failed"] = f
    return result


def compute_custom_metrics(
    results: List[Any],
    custom_metric_defs: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Run user-defined custom aggregate metric functions.

    Each definition must have:
        name: str   — metric key (valid Python identifier)
        code: str   — Python code defining  def compute(results): -> float | dict

    The ``results`` list passed to each compute() function is the same list of
    plain dicts that all built-in metrics receive (fields: task_id, passed,
    score, latency_ms, token_usage, error_message, grader_results, …).

    Returns a dict mapping metric name → value (float or nested dict).
    Any definition that errors returns {"error": "<message>"} for that key.
    """
    output: Dict[str, Any] = {}
    for defn in custom_metric_defs:
        name = str(defn.get("name", "")).strip()
        code = str(defn.get("code", "")).strip()
        if not name or not code:
            continue
        try:
            namespace: Dict[str, Any] = {}
            exec(compile(code, f"<custom_metric:{name}>", "exec"), namespace)  # nosec B102
            compute_fn = namespace.get("compute")
            if not callable(compute_fn):
                output[name] = {"error": "No compute(results) function defined"}
                continue
            raw = compute_fn(results)
            output[name] = raw if isinstance(raw, dict) else float(raw)
        except Exception as exc:
            output[name] = {"error": str(exc)}
    return output


def compute_aggregate_metrics(
    results: List[Any],
    custom_metric_defs: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Compute all aggregate metrics for a set of results."""
    pass_at_k = compute_pass_at_k(results)
    pass_pow_k = compute_pass_pow_k(results)
    latency_stats = compute_latency_stats(results)
    score_stats = compute_score_stats(results)
    task_stats = compute_task_level_stats(results)
    total = len(results)
    passed = sum(
        1 for r in results
        if bool(r.passed if hasattr(r, "passed") else r.get("passed", False))
    )

    # Convert results to dicts for reliability metrics
    results_dicts = []
    for r in results:
        if hasattr(r, "__dict__"):
            results_dicts.append(r.__dict__)
        elif isinstance(r, dict):
            results_dicts.append(r)
        else:
            # Fallback: extract key fields
            results_dicts.append({
                "task_id": _get(r, "task_id", "unknown"),
                "passed": _get(r, "passed", False),
                "score": _get(r, "score", None),
                "latency_ms": _get(r, "latency_ms", None),
                "token_usage": _get(r, "token_usage", None),
                "confidence": _get(r, "confidence", None),
                "action_sequence": _get(r, "action_sequence", None),
                "perturbation_type": _get(r, "perturbation_type", "nominal"),
                "safety_violations": _get(r, "safety_violations", None),
                "safety_severity": _get(r, "safety_severity", None),
            })

    # Compute reliability metrics
    reliability_metrics = compute_all_reliability_metrics(results_dicts)

    metrics: Dict[str, Any] = {
        # Core pass/fail (trial-level)
        "success_rate": compute_success_rate(results),
        "passed": passed,
        "total_results": total,
        "error_rate": compute_error_rate(results),
        # Task-level pass stats
        "total_tasks": task_stats["total_tasks"],
        "task_pass_rate": task_stats["task_pass_rate"],
        "tasks_fully_passed_rate": task_stats["tasks_fully_passed_rate"],
        "tasks_never_passed_rate": task_stats["tasks_never_passed_rate"],
        # Score stats (0.0–1.0 per trial)
        "avg_score": score_stats["avg"],
        "median_score": score_stats["median"],
        "score_std": score_stats["std"],
        "score_min": score_stats["min"],
        "score_max": score_stats["max"],
        # Latency
        "avg_latency_ms": compute_average_latency(results),
        "total_latency_ms": sum(
            (r.latency_ms if hasattr(r, "latency_ms") else r.get("latency_ms") or 0)
            for r in results
        ),
        "median_latency_ms": latency_stats["median_ms"],
        "p75_latency_ms": latency_stats["p75_ms"],
        "p95_latency_ms": latency_stats["p95_ms"],
        "min_latency_ms": latency_stats["min_ms"],
        "max_latency_ms": latency_stats["max_ms"],
        "latency_std_ms": latency_stats["std_ms"],
        "latency_cv": latency_stats["cv"],
        # Sampling metrics
        "pass_at_k": {str(k): v for k, v in pass_at_k.items()},
        "pass_pow_k": {str(k): v for k, v in pass_pow_k.items()},
        # Token usage
        "token_usage": compute_token_usage(results),
        # Extended metrics
        "perfect_score_rate": compute_perfect_score_rate(results),
        "score_distribution": compute_score_distribution(results),
        "tokens_per_trial": compute_tokens_per_trial(results),
        "tokens_efficiency": compute_tokens_efficiency(results),
        "per_grader_breakdown": compute_per_grader_breakdown(results),
        "flakiness": compute_flakiness(results),
        # Reliability metrics
        **reliability_metrics,
    }
    if custom_metric_defs:
        custom = compute_custom_metrics(results, custom_metric_defs)
        if custom:
            metrics["custom_metrics"] = custom
    return metrics
