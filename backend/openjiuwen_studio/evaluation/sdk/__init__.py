"""
openjiuwen_studio.evaluation.sdk — Python SDK for the OpenJiuwen Evaluation System.

Quick start::

    from openjiuwen_studio.evaluation.sdk import EvaluationClient

    client = EvaluationClient(
        api_url="http://localhost:8000",
        token="<jwt>",
        space_id="<space_id>",
    )

    suites = client.list_suites()
    run = client.run(evaluation_id=suites[0].evaluation_id, workflow_id="<id>", wait=True)
    print(f"Success rate: {run.metrics.success_rate:.1%}")

See also:
    - :class:`EvaluationClient` — main entry point
    - :class:`TaskBuilder` — fluent builder for evaluation tasks
    - :mod:`openjiuwen_studio.evaluation.sdk.models` — data models returned by the client
"""

from .client import EvaluationClient, TaskBuilder
from .models import (
    BenchmarkInfo,
    EvaluationResults,
    RunInfo,
    RunMetrics,
    SuiteInfo,
    TaskInfo,
    TaskResult,
)

__all__ = [
    "EvaluationClient",
    "TaskBuilder",
    "BenchmarkInfo",
    "EvaluationResults",
    "RunInfo",
    "RunMetrics",
    "SuiteInfo",
    "TaskInfo",
    "TaskResult",
]
