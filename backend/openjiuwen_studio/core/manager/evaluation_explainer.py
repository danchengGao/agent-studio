#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
"""
Heuristic evaluation result explainer.

Analyses completed-run metrics + task results and returns structured
natural-language insights, top failures, and actionable recommendations.
No LLM call is required — all analysis is rule-based so it is fast and
deterministic.

Public API
----------
explain_run(metrics, task_results) -> ExplainResult
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


# ──────────────────────────────────────────────────────────────────────────────
# Domain objects
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class Insight:
    """A single observation about the run."""
    severity: str          # "good" | "warn" | "bad" | "info"
    icon: str              # lucide icon name hint for the frontend
    title: str
    body: str


@dataclass
class FailingSample:
    """A task that failed with a brief explanation."""
    task_id: str
    task_name: str
    failure_reason: str    # short human-readable cause
    grader_names: List[str] = field(default_factory=list)


@dataclass
class ExplainResult:
    """Full explanation payload returned to the frontend."""
    headline: str
    summary: str
    insights: List[Insight]
    top_fails: List[FailingSample]
    recommendations: List[str]
    data_quality_warnings: List[str]


# ──────────────────────────────────────────────────────────────────────────────
# Helper utilities
# ──────────────────────────────────────────────────────────────────────────────

def _pct(v: Optional[float]) -> str:
    if v is None:
        return "N/A"
    return f"{v * 100:.1f}%"


def _severity_from_rate(rate: Optional[float], *, good: float = 0.8, warn: float = 0.5) -> str:
    if rate is None:
        return "info"
    if rate >= good:
        return "good"
    if rate >= warn:
        return "warn"
    return "bad"


def _std_severity(std: Optional[float]) -> str:
    if std is None:
        return "info"
    if std <= 0.05:
        return "good"
    if std <= 0.15:
        return "warn"
    return "bad"


def _flakiness_severity(flak: Optional[float]) -> str:
    if flak is None:
        return "info"
    if flak <= 0.05:
        return "good"
    if flak <= 0.2:
        return "warn"
    return "bad"


# ──────────────────────────────────────────────────────────────────────────────
# Insight generators
# ──────────────────────────────────────────────────────────────────────────────

def _insight_success_rate(m: Dict[str, Any]) -> Optional[Insight]:
    rate = m.get("success_rate")
    if rate is None:
        return None
    sev = _severity_from_rate(rate)
    total = m.get("total_results", 0)
    passed = m.get("passed", 0)
    if sev == "good":
        body = (
            f"Your agent passed {passed} of {total} trials ({_pct(rate)}). "
            "This is a strong result. Consider running more trials or harder tasks "
            "to validate further."
        )
        return Insight("good", "TrendingUp", "Strong pass rate", body)
    if sev == "warn":
        body = (
            f"{passed} of {total} trials passed ({_pct(rate)}). "
            "The agent is doing reasonably well but there's room for improvement. "
            "Review the failing tasks in the Traces tab to identify patterns."
        )
        return Insight("warn", "TrendingUp", "Moderate pass rate", body)
    body = (
        f"Only {passed} of {total} trials passed ({_pct(rate)}). "
        "The agent is struggling with a large fraction of tasks. "
        "Focus on the top failing tasks below and check your prompt / grader configuration."
    )
    return Insight("bad", "TrendingDown", "Low pass rate — action needed", body)


def _insight_avg_score(m: Dict[str, Any]) -> Optional[Insight]:
    score = m.get("avg_score")
    if score is None:
        return None
    sev = _severity_from_rate(score, good=0.8, warn=0.5)
    if sev == "good":
        body = f"Average score across all trials is {_pct(score)}, indicating high output quality."
        icon = "Star"
    elif sev == "warn":
        body = (
            f"Average score is {_pct(score)}. Outputs are partially correct but often incomplete "
            "or imprecise. Check model-based grader rubrics for actionable feedback."
        )
        icon = "Star"
    else:
        body = (
            f"Average score is only {_pct(score)}, meaning graders find the agent's outputs "
            "largely incorrect or off-target. Consider revising your system prompt and rubric."
        )
        icon = "StarOff"
    return Insight(sev, icon, f"Avg score: {_pct(score)}", body)


def _insight_flakiness(m: Dict[str, Any]) -> Optional[Insight]:
    flak = m.get("flakiness")
    if flak is None:
        return None
    sev = _flakiness_severity(flak)
    if sev == "good":
        body = (
            f"Flakiness is {flak:.3f} — the agent produces very consistent pass/fail outcomes "
            "across repeated trials. Results are reliable."
        )
        return Insight("good", "Shuffle", "Low flakiness — consistent outputs", body)
    if sev == "warn":
        body = (
            f"Flakiness is {flak:.3f}. Some tasks pass on some trials but fail on others. "
            "This suggests borderline prompt sensitivity. Adding more specific grader checks "
            "or increasing trials may give clearer signal."
        )
        return Insight("warn", "Shuffle", "Moderate flakiness detected", body)
    body = (
        f"Flakiness is {flak:.3f} — high trial-to-trial variability. The agent's success "
        "is unreliable for a significant fraction of tasks. Consider: (1) clarifying your "
        "system prompt, (2) lowering temperature, or (3) adding stricter grading criteria."
    )
    return Insight("bad", "Shuffle", "High flakiness — outputs are inconsistent", body)


def _insight_consistency(m: Dict[str, Any]) -> Optional[Insight]:
    std = m.get("score_std")
    if std is None:
        return None
    sev = _std_severity(std)
    label = "Low" if sev == "bad" else ("Medium" if sev == "warn" else "High")
    if sev == "good":
        body = (
            f"Score standard deviation is {_pct(std)}, meaning output quality is highly "
            "consistent run to run."
        )
    elif sev == "warn":
        body = (
            f"Score std is {_pct(std)} — moderate variation in quality across trials. "
            "Some tasks may benefit from more deterministic instructions."
        )
    else:
        body = (
            f"Score std is {_pct(std)} — large variance. The agent's quality fluctuates "
            "significantly between runs. Investigate tasks with the widest score spread."
        )
    return Insight(sev, "Activity", f"{label} consistency (score std: {_pct(std)})", body)


def _insight_task_reliability(m: Dict[str, Any]) -> Optional[Insight]:
    fully_passed = m.get("tasks_fully_passed_rate")
    never_passed = m.get("tasks_never_passed_rate")
    total_tasks = m.get("total_tasks")
    if total_tasks is None or total_tasks == 0:
        return None

    parts = []
    sev = "info"

    if fully_passed is not None:
        if fully_passed >= 0.8:
            sev = "good"
            parts.append(f"{_pct(fully_passed)} of tasks pass on every trial")
        elif fully_passed >= 0.4:
            sev = "warn"
            parts.append(f"only {_pct(fully_passed)} of tasks always pass")
        else:
            sev = "bad"
            parts.append(f"very few tasks ({_pct(fully_passed)}) pass consistently")

    if never_passed and never_passed > 0:
        sev = "bad"
        parts.append(f"{_pct(never_passed)} of tasks never pass on any trial — these need immediate attention")

    if not parts:
        return None

    body = "; ".join(p.capitalize() for p in parts) + "."
    return Insight(sev, "ShieldCheck", "Task-level reliability", body)


def _insight_grader_breakdown(m: Dict[str, Any]) -> List[Insight]:
    breakdown = m.get("per_grader_breakdown") or {}
    insights: List[Insight] = []
    for grader_name, stats in breakdown.items():
        pr = stats.get("pass_rate")
        if pr is None:
            continue
        if pr < 0.5:
            insights.append(Insight(
                "bad",
                "Scale",
                f"Grader '{grader_name}' has low pass rate ({_pct(pr)})",
                (
                    f"This grader fails {_pct(1 - pr)} of trials. Either the agent consistently "
                    f"misses what '{grader_name}' checks, or the grader criteria may be too strict. "
                    "Review the grader definition and sample failing outputs in Traces."
                ),
            ))
        elif pr < 0.8:
            insights.append(Insight(
                "warn",
                "Scale",
                f"Grader '{grader_name}' is borderline ({_pct(pr)} pass rate)",
                (
                    f"'{grader_name}' passes {_pct(pr)} of trials — just over half. "
                    "Small prompt adjustments may push this grader into the green."
                ),
            ))
    return insights


def _insight_latency(m: Dict[str, Any]) -> Optional[Insight]:
    p50 = m.get("latency_p50_ms")
    p95 = m.get("latency_p95_ms")
    if p50 is None and p95 is None:
        return None
    parts = []
    if p50 is not None:
        parts.append(f"median {p50:.0f} ms")
    if p95 is not None:
        parts.append(f"p95 {p95:.0f} ms")
    sev = "info"
    body = "Latency: " + ", ".join(parts) + "."
    if p95 and p95 > 30_000:
        sev = "warn"
        body += " The p95 latency exceeds 30 s — consider optimising your workflow or enabling parallel execution."
    elif p95 and p95 > 60_000:
        sev = "bad"
        body += " The p95 latency exceeds 60 s. This may cause timeout issues in production."
    return Insight(sev, "Clock", "Latency", body)


def _insight_token_usage(m: Dict[str, Any]) -> Optional[Insight]:
    avg_tokens = m.get("avg_tokens_total")
    if avg_tokens is None:
        return None
    if avg_tokens > 50_000:
        return Insight(
            "warn",
            "Cpu",
            f"High token usage (avg {avg_tokens:,.0f} tokens/trial)",
            "Average token usage is high. Consider shortening your system prompt or using a "
            "more concise output format to reduce cost and latency.",
        )
    return Insight(
        "info",
        "Cpu",
        f"Avg token usage: {avg_tokens:,.0f} tokens/trial",
        "Token usage looks normal.",
    )


# ──────────────────────────────────────────────────────────────────────────────
# Top failures extractor
# ──────────────────────────────────────────────────────────────────────────────

def _extract_top_fails(task_results: List[Dict[str, Any]], *, max_fails: int = 5) -> List[FailingSample]:
    """
    Pick the most informative failing task results.
    Prefer tasks where every trial failed (never-pass tasks).
    """
    # Group by task_id
    by_task: Dict[str, List[dict]] = {}
    for r in task_results:
        tid = r.get("task_id") or "unknown"
        by_task.setdefault(tid, []).append(r)

    fail_samples: List[FailingSample] = []

    for tid, trials in by_task.items():
        all_failed = all(not t.get("passed", True) for t in trials)
        any_failed = any(not t.get("passed", True) for t in trials)
        if not any_failed:
            continue

        task_name = (trials[0].get("task_name") or tid) if trials else tid

        # Build failure reason from grader scores
        failing_graders: List[str] = []
        for trial in trials:
            grader_results = trial.get("grader_results") or {}
            for gname, gres in grader_results.items():
                if isinstance(gres, dict) and not gres.get("passed", True):
                    if gname not in failing_graders:
                        failing_graders.append(gname)

        if failing_graders:
            reason = f"Failed graders: {', '.join(failing_graders[:3])}"
            if len(failing_graders) > 3:
                reason += f" (+{len(failing_graders) - 3} more)"
        elif all_failed:
            reason = "All trials failed (no grader detail available)"
        else:
            n_fail = sum(1 for t in trials if not t.get("passed", True))
            reason = f"{n_fail}/{len(trials)} trials failed"

        fail_samples.append(FailingSample(
            task_id=tid,
            task_name=task_name,
            failure_reason=reason,
            grader_names=failing_graders,
        ))

    # Sort: never-pass first, then by task_name
    def sort_key(s: FailingSample):
        trials = by_task.get(s.task_id, [])
        all_fail = all(not t.get("passed", True) for t in trials)
        return (0 if all_fail else 1, s.task_name)

    fail_samples.sort(key=sort_key)
    return fail_samples[:max_fails]


# ──────────────────────────────────────────────────────────────────────────────
# Recommendation generator
# ──────────────────────────────────────────────────────────────────────────────

def _generate_recommendations(
    m: Dict[str, Any],
    insights: List[Insight],
    fail_count: int,
) -> List[str]:
    recs: List[str] = []
    sr = m.get("success_rate")
    flak = m.get("flakiness")
    std = m.get("score_std")
    trials = m.get("total_trials_per_task") or m.get("trials_per_task")

    # Low pass rate
    if sr is not None and sr < 0.5:
        recs.append(
            "Review your system prompt and task instructions — the agent isn't meeting grader "
            "criteria on most trials. Start with the failing traces and work backwards."
        )

    # High flakiness
    if flak is not None and flak > 0.2:
        recs.append(
            "Reduce model temperature or add more specific output-format instructions to cut "
            "down on trial-to-trial variability (flakiness is above 0.2)."
        )
        if trials and trials < 5:
            recs.append(
                "Increase trials per task to 5 or more — with fewer trials, flakiness "
                "estimates are unreliable."
            )

    # High score std
    if std is not None and std > 0.15:
        recs.append(
            "Large score variance (std > 15%) suggests the agent handles similar inputs very "
            "differently. Add few-shot examples to stabilise outputs."
        )

    # Low avg score but decent pass rate — graders might be easy
    avg = m.get("avg_score")
    avg_low_sr_ok = avg is not None and sr is not None
    if avg_low_sr_ok and avg < 0.6 and sr >= 0.7:
        recs.append(
            "Pass rate looks okay but average score is low — your passing threshold may be "
            "set too low, or grader weights favour easy checks. Consider tightening rubrics."
        )

    # Multiple graders failing
    bad_graders = [
        i for i in insights
        if i.severity == "bad" and i.icon == "Scale"
    ]
    if len(bad_graders) >= 2:
        recs.append(
            f"{len(bad_graders)} graders are failing frequently. Prioritise fixing the grader "
            "with the lowest pass rate first — fixing one often cascades to others."
        )

    # Never-pass tasks exist
    nvr = m.get("tasks_never_passed_rate")
    if nvr and nvr > 0:
        n = int(round(nvr * (m.get("total_tasks") or 1)))
        recs.append(
            f"{n} task(s) never passed on any trial. These need direct attention — "
            "open the Traces tab, filter to those tasks, and inspect the agent output."
        )

    # No trials hint
    if trials and trials == 1:
        recs.append(
            "You're running only 1 trial per task. Use at least 3 trials to get "
            "statistically meaningful metrics like flakiness and score std."
        )

    # No grader breakdown — graders might be misconfigured
    breakdown = m.get("per_grader_breakdown") or {}
    if not breakdown and (m.get("total_results") or 0) > 0:
        recs.append(
            "No per-grader breakdown is available. Check that your graders_config JSON "
            "includes a 'name' field for each grader."
        )

    # Generic positive recommendation when doing well
    good_sr = sr is not None and sr >= 0.9
    low_flak = flak is None or flak <= 0.05
    if good_sr and low_flak:
        recs.append(
            "Results look great! Consider increasing difficulty: add harder tasks, raise "
            "grader thresholds, or test edge-case inputs."
        )

    return recs


# ──────────────────────────────────────────────────────────────────────────────
# Data quality warnings
# ──────────────────────────────────────────────────────────────────────────────

def _data_quality_warnings(m: Dict[str, Any], task_results: List[dict]) -> List[str]:
    warnings: List[str] = []
    total = m.get("total_results") or 0
    if total == 0:
        warnings.append("No results recorded — the evaluation may not have run successfully.")
    elif total < 3:
        warnings.append(
            f"Only {total} trial result(s) recorded. Increase trials per task for reliable statistics."
        )

    trials_per_task = m.get("total_trials_per_task") or m.get("trials_per_task")
    if trials_per_task and trials_per_task < 3:
        warnings.append(
            f"Trials per task is set to {trials_per_task}. Metrics like flakiness require "
            "at least 3 trials to be meaningful."
        )

    return warnings


# ──────────────────────────────────────────────────────────────────────────────
# Headline generator
# ──────────────────────────────────────────────────────────────────────────────

def _headline(m: Dict[str, Any]) -> tuple[str, str]:
    """Return (headline, summary) based on overall metrics."""
    sr = m.get("success_rate")
    flak = m.get("flakiness")
    total = m.get("total_results", 0)

    if sr is None or total == 0:
        return "No results yet", "Evaluation may still be running or produced no output."

    if sr >= 0.9 and (flak is None or flak <= 0.1):
        headline = "Excellent — agent is performing very well"
        summary = (
            f"Pass rate is {_pct(sr)} with low flakiness. "
            "Your agent handles these tasks reliably."
        )
    elif sr >= 0.75:
        headline = "Good results with some room for improvement"
        summary = (
            f"Pass rate is {_pct(sr)}. Most tasks succeed, but a subset need attention. "
            "See the failing tasks and grader insights below."
        )
    elif sr >= 0.5:
        headline = "Mixed results — targeted fixes needed"
        summary = (
            f"Pass rate is {_pct(sr)}. The agent succeeds on roughly half the tasks. "
            "Focus on the consistently-failing tasks first."
        )
    else:
        headline = "Poor results — significant issues detected"
        summary = (
            f"Pass rate is only {_pct(sr)}. Most tasks are failing. "
            "This often indicates a prompt, grader configuration, or model selection issue."
        )

    return headline, summary


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────

def explain_run(
    metrics: Optional[Dict[str, Any]],
    task_results: Optional[List[Dict[str, Any]]],
) -> Dict[str, Any]:
    """
    Analyse evaluation run data and return structured natural-language insights.

    Parameters
    ----------
    metrics : dict | None
        The ``metrics`` dict from the run record (may be None if run is still
        in progress).
    task_results : list[dict] | None
        The list of per-trial task result records.

    Returns
    -------
    dict
        Serialisable representation of an ExplainResult.
    """
    m: Dict[str, Any] = metrics or {}
    tr: List[Dict[str, Any]] = task_results or []

    insights: List[Insight] = []

    # Core performance insights
    sr_insight = _insight_success_rate(m)
    if sr_insight:
        insights.append(sr_insight)

    score_insight = _insight_avg_score(m)
    if score_insight:
        insights.append(score_insight)

    # Reliability insights
    flak_insight = _insight_flakiness(m)
    if flak_insight:
        insights.append(flak_insight)

    cons_insight = _insight_consistency(m)
    if cons_insight:
        insights.append(cons_insight)

    task_rel = _insight_task_reliability(m)
    if task_rel:
        insights.append(task_rel)

    # Per-grader insights
    insights.extend(_insight_grader_breakdown(m))

    # Operational insights
    lat_insight = _insight_latency(m)
    if lat_insight:
        insights.append(lat_insight)

    tok_insight = _insight_token_usage(m)
    if tok_insight:
        insights.append(tok_insight)

    # Extract failing tasks
    top_fails = _extract_top_fails(tr)

    # Recommendations
    recommendations = _generate_recommendations(m, insights, len(top_fails))

    # Data quality warnings
    dq_warnings = _data_quality_warnings(m, tr)

    # Headline
    headline, summary = _headline(m)

    result = ExplainResult(
        headline=headline,
        summary=summary,
        insights=insights,
        top_fails=top_fails,
        recommendations=recommendations,
        data_quality_warnings=dq_warnings,
    )

    return {
        "headline": result.headline,
        "summary": result.summary,
        "insights": [
            {
                "severity": i.severity,
                "icon": i.icon,
                "title": i.title,
                "body": i.body,
            }
            for i in result.insights
        ],
        "top_fails": [
            {
                "task_id": f.task_id,
                "task_name": f.task_name,
                "failure_reason": f.failure_reason,
                "grader_names": f.grader_names,
            }
            for f in result.top_fails
        ],
        "recommendations": result.recommendations,
        "data_quality_warnings": result.data_quality_warnings,
    }
