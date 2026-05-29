"""
Data models returned by the EvaluationClient SDK.

All models are plain dataclasses — no external dependencies beyond the stdlib.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class SuiteInfo:
    """An evaluation suite (a collection of tasks)."""

    evaluation_id: str
    suite_name: str
    space_id: str
    description: Optional[str] = None
    config: Dict[str, Any] = field(default_factory=dict)
    create_time: int = 0
    update_time: int = 0

    def __repr__(self) -> str:
        return f"SuiteInfo(id={self.evaluation_id!r}, name={self.suite_name!r})"


@dataclass
class TaskInfo:
    """A single evaluation task inside a suite."""

    task_id: str
    evaluation_id: str
    task_name: str
    trials: int = 3
    description: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    difficulty: Optional[str] = None
    pattern_type: Optional[str] = None
    input_data: Dict[str, Any] = field(default_factory=dict)
    expected_output: Dict[str, Any] = field(default_factory=dict)
    graders_config: List[Dict[str, Any]] = field(default_factory=list)
    create_time: int = 0

    def __repr__(self) -> str:
        return f"TaskInfo(id={self.task_id!r}, name={self.task_name!r})"


@dataclass
class RunMetrics:
    """Aggregate metrics computed after a run completes."""

    success_rate: float = 0.0
    passed: int = 0
    total_results: int = 0
    error_rate: float = 0.0
    avg_score: Optional[float] = None
    median_score: Optional[float] = None
    avg_latency_ms: float = 0.0
    median_latency_ms: Optional[float] = None
    p95_latency_ms: Optional[float] = None
    total_tasks: Optional[int] = None
    task_pass_rate: Optional[float] = None
    tasks_fully_passed_rate: Optional[float] = None
    tasks_never_passed_rate: Optional[float] = None
    pass_at_k: Dict[str, float] = field(default_factory=dict)
    pass_pow_k: Dict[str, float] = field(default_factory=dict)
    custom_metrics: Dict[str, Any] = field(default_factory=dict)
    per_grader_breakdown: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    alerts: List[Dict[str, Any]] = field(default_factory=list)
    _raw: Dict[str, Any] = field(default_factory=dict, repr=False)

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "RunMetrics":
        return cls(
            success_rate=d.get("success_rate", 0.0),
            passed=d.get("passed", 0),
            total_results=d.get("total_results", 0),
            error_rate=d.get("error_rate", 0.0),
            avg_score=d.get("avg_score"),
            median_score=d.get("median_score"),
            avg_latency_ms=d.get("avg_latency_ms", 0.0),
            median_latency_ms=d.get("median_latency_ms"),
            p95_latency_ms=d.get("p95_latency_ms"),
            total_tasks=d.get("total_tasks"),
            task_pass_rate=d.get("task_pass_rate"),
            tasks_fully_passed_rate=d.get("tasks_fully_passed_rate"),
            tasks_never_passed_rate=d.get("tasks_never_passed_rate"),
            pass_at_k=d.get("pass_at_k") or {},
            pass_pow_k=d.get("pass_pow_k") or {},
            custom_metrics=d.get("custom_metrics") or {},
            per_grader_breakdown=d.get("per_grader_breakdown") or {},
            alerts=d.get("alerts") or [],
            _raw=d,
        )

    def __repr__(self) -> str:
        pct = f"{self.success_rate * 100:.1f}%"
        return f"RunMetrics(success_rate={pct}, passed={self.passed}/{self.total_results})"


@dataclass
class RunInfo:
    """Status and summary for a single evaluation run."""

    run_id: str
    evaluation_id: str
    status: str  # '0'=pending '1'=running '2'=completed '3'=failed '4'=cancelled
    workflow_id: Optional[str] = None
    workflow_name: Optional[str] = None
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    metrics: Optional[RunMetrics] = None
    start_time: Optional[int] = None
    end_time: Optional[int] = None
    create_time: int = 0

    @property
    def is_complete(self) -> bool:
        return self.status in ("2", "3", "4")

    @property
    def succeeded(self) -> bool:
        return self.status == "2"

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "RunInfo":
        raw_metrics = d.get("metrics")
        return cls(
            run_id=d["run_id"],
            evaluation_id=d.get("evaluation_id", ""),
            status=str(d.get("status", "0")),
            workflow_id=d.get("workflow_id"),
            workflow_name=d.get("workflow_name"),
            agent_id=d.get("agent_id"),
            agent_name=d.get("agent_name"),
            metrics=RunMetrics.from_dict(raw_metrics) if raw_metrics else None,
            start_time=d.get("start_time"),
            end_time=d.get("end_time"),
            create_time=d.get("create_time", 0),
        )

    def __repr__(self) -> str:
        status_map = {"0": "pending", "1": "running", "2": "completed", "3": "failed", "4": "cancelled"}
        return f"RunInfo(id={self.run_id!r}, status={status_map.get(self.status, self.status)!r})"


@dataclass
class TaskResult:
    """Result of a single trial for a single task."""

    result_id: str
    task_id: str
    trial_number: int
    passed: Optional[bool] = None
    score: Optional[float] = None
    task_name: Optional[str] = None
    latency_ms: Optional[float] = None
    token_usage: Dict[str, int] = field(default_factory=dict)
    error_message: Optional[str] = None
    trace_id: Optional[str] = None
    grader_results: List[Dict[str, Any]] = field(default_factory=list)

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "TaskResult":
        return cls(
            result_id=d.get("result_id", ""),
            task_id=d.get("task_id", ""),
            trial_number=d.get("trial_number", 0),
            passed=d.get("passed"),
            score=d.get("score"),
            task_name=d.get("task_name"),
            latency_ms=d.get("latency_ms"),
            token_usage=d.get("token_usage") or {},
            error_message=d.get("error_message"),
            trace_id=d.get("trace_id"),
            grader_results=d.get("grader_results") or [],
        )

    def __repr__(self) -> str:
        status = "PASS" if self.passed else ("FAIL" if self.passed is False else "?")
        return f"TaskResult(task={self.task_name!r}, trial={self.trial_number}, {status})"


@dataclass
class EvaluationResults:
    """Full results for a completed run, including all task-level trial results."""

    run_id: str
    evaluation_id: str
    status: str
    task_results: List[TaskResult] = field(default_factory=list)
    workflow_id: Optional[str] = None
    workflow_name: Optional[str] = None
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    metrics: Optional[RunMetrics] = None

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "EvaluationResults":
        raw_metrics = d.get("metrics")
        task_results = [TaskResult.from_dict(r) for r in (d.get("task_results") or [])]
        return cls(
            run_id=d.get("run_id", ""),
            evaluation_id=d.get("evaluation_id", ""),
            status=str(d.get("status", "")),
            task_results=task_results,
            workflow_id=d.get("workflow_id"),
            workflow_name=d.get("workflow_name"),
            agent_id=d.get("agent_id"),
            agent_name=d.get("agent_name"),
            metrics=RunMetrics.from_dict(raw_metrics) if raw_metrics else None,
        )

    def passed_tasks(self) -> List[TaskResult]:
        """Return only results where passed=True."""
        return [r for r in self.task_results if r.passed is True]

    def failed_tasks(self) -> List[TaskResult]:
        """Return only results where passed=False."""
        return [r for r in self.task_results if r.passed is False]

    def errored_tasks(self) -> List[TaskResult]:
        """Return results that have an error message."""
        return [r for r in self.task_results if r.error_message]

    def __repr__(self) -> str:
        return (
            f"EvaluationResults(run_id={self.run_id!r}, "
            f"tasks={len(self.task_results)}, metrics={self.metrics!r})"
        )


@dataclass
class BenchmarkInfo:
    """Metadata for a pre-built benchmark YAML."""

    file_name: str
    suite_name: str
    description: str = ""
    task_count: int = 0

    def __repr__(self) -> str:
        return f"BenchmarkInfo(file={self.file_name!r}, tasks={self.task_count})"
