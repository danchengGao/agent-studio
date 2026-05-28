"""
EvaluationClient — Python SDK for the OpenJiuwen Evaluation System.

Quick start::

    from openjiuwen_studio.evaluation.sdk import EvaluationClient

    client = EvaluationClient(
        api_url="http://localhost:8000",
        token="<jwt>",
        space_id="<space_id>",
    )

    # List suites
    suites = client.list_suites()

    # Create a suite, add a task, run, inspect results
    suite = client.create_suite("Routing Regression")

    task = (
        client.task_builder("Route Billing Query")
        .input(query="I need to cancel my subscription")
        .expected_output(department="billing")
        .trials(5)
        .grader_exact_match(path="department", expected="billing")
        .build()
    )
    client.add_task(suite.evaluation_id, task)

    run = client.run(
        evaluation_id=suite.evaluation_id,
        workflow_id="<workflow_id>",
        wait=True,
    )
    print(f"Success rate: {run.metrics.success_rate:.1%}")

    results = client.get_results(run.run_id)
    for r in results.failed_tasks():
        print(f"  FAIL  trial {r.trial_number}: {r.error_message}")
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

import requests

from .models import (
    BenchmarkInfo,
    EvaluationResults,
    RunInfo,
    SuiteInfo,
    TaskInfo,
    TaskResult,
)


# ── TaskBuilder ───────────────────────────────────────────────────────────────


class TaskBuilder:
    """Fluent builder for constructing evaluation task definitions.

    Example::

        task = (
            client.task_builder("Routing Test")
            .input(query="Cancel my plan")
            .expected_output(department="billing")
            .trials(5)
            .grader_exact_match(path="department", expected="billing")
            .grader_model(criteria="The response is polite and professional")
            .build()
        )
    """

    def __init__(self, name: str) -> None:
        self._name = name
        self._description: Optional[str] = None
        self._tags: List[str] = []
        self._difficulty: Optional[str] = None
        self._pattern_type: Optional[str] = None
        self._trials: int = 3
        self._input: Dict[str, Any] = {}
        self._expected_output: Dict[str, Any] = {}
        self._graders: List[Dict[str, Any]] = []

    # ── Metadata ──────────────────────────────────────────────────────────────

    def description(self, text: str) -> "TaskBuilder":
        """Set a human-readable description for this task."""
        self._description = text
        return self

    def tags(self, *tags: str) -> "TaskBuilder":
        """Add one or more tags (e.g., ``"smoke"``, ``"routing"``)."""
        self._tags.extend(tags)
        return self

    def difficulty(self, level: str) -> "TaskBuilder":
        """Set difficulty: ``"easy"``, ``"medium"``, or ``"hard"``."""
        self._difficulty = level
        return self

    def pattern_type(self, pattern: str) -> "TaskBuilder":
        """Set workflow pattern type (e.g., ``"routing"``, ``"chaining"``)."""
        self._pattern_type = pattern
        return self

    def trials(self, n: int) -> "TaskBuilder":
        """Number of times to execute this task per run (default: 3)."""
        self._trials = n
        return self

    # ── Input / Output ────────────────────────────────────────────────────────

    def input(self, **kwargs: Any) -> "TaskBuilder":
        """Set the input data passed to the workflow or agent.

        Keyword arguments become the input dict::

            .input(query="hello", context="world")
            # → {"query": "hello", "context": "world"}
        """
        self._input.update(kwargs)
        return self

    def input_dict(self, d: Dict[str, Any]) -> "TaskBuilder":
        """Set the input data from an existing dict."""
        self._input.update(d)
        return self

    def expected_output(self, **kwargs: Any) -> "TaskBuilder":
        """Set the expected output used by deterministic graders.

        Example::

            .expected_output(department="billing", sentiment="negative")
        """
        self._expected_output.update(kwargs)
        return self

    def expected_output_dict(self, d: Dict[str, Any]) -> "TaskBuilder":
        """Set expected output from an existing dict."""
        self._expected_output.update(d)
        return self

    # ── Graders ───────────────────────────────────────────────────────────────

    def grader_exact_match(
        self,
        path: str,
        expected: Any,
        *,
        name: Optional[str] = None,
        case_sensitive: bool = True,
    ) -> "TaskBuilder":
        """Add a state_check grader that compares one field exactly.

        Args:
            path: Dot-separated path into the output dict (e.g. ``"result.department"``).
            expected: The value the field must equal.
            name: Optional grader name (default: ``"exact_match:<path>"``).
            case_sensitive: For strings, whether to compare case-sensitively.
        """
        self._graders.append({
            "name": name or f"exact_match:{path}",
            "type": "state_check",
            "path": path,
            "operator": "equals",
            "expected": expected,
            "case_sensitive": case_sensitive,
        })
        return self

    def grader_contains(
        self,
        keyword: str,
        *,
        path: Optional[str] = None,
        name: Optional[str] = None,
        case_sensitive: bool = False,
    ) -> "TaskBuilder":
        """Add a grader that checks whether the output contains a keyword.

        Args:
            keyword: The string to search for.
            path: If set, search inside ``output[path]``; otherwise search the whole output string.
            name: Optional grader name.
            case_sensitive: Whether the search is case-sensitive (default: False).
        """
        grader: Dict[str, Any] = {
            "name": name or f"contains:{keyword!r}",
            "type": "output_check" if path is None else "state_check",
            "operator": "contains",
            "expected": keyword,
            "case_sensitive": case_sensitive,
        }
        if path:
            grader["path"] = path
        self._graders.append(grader)
        return self

    def grader_not_empty(
        self,
        path: Optional[str] = None,
        *,
        name: Optional[str] = None,
    ) -> "TaskBuilder":
        """Add a grader that verifies the output (or a field) is not empty."""
        grader: Dict[str, Any] = {
            "name": name or ("not_empty" if not path else f"not_empty:{path}"),
            "type": "output_check" if path is None else "state_check",
            "operator": "is_not_empty",
        }
        if path:
            grader["path"] = path
        self._graders.append(grader)
        return self

    def grader_model(
        self,
        criteria: str,
        *,
        model_id: Optional[str] = None,
        name: Optional[str] = None,
        threshold: float = 0.7,
    ) -> "TaskBuilder":
        """Add a model-based (AI-judge) grader.

        Args:
            criteria: Natural-language description of what "correct" looks like.
                      Example: ``"The response correctly identifies the department as billing."``
            model_id: ID of the model to use as judge (uses space default if omitted).
            name: Optional grader name (default: ``"model_judge"``).
            threshold: Minimum score (0–1) to consider the trial passed (default: 0.7).
        """
        grader: Dict[str, Any] = {
            "name": name or "model_judge",
            "type": "model_based",
            "criteria": criteria,
            "threshold": threshold,
        }
        if model_id:
            grader["model_id"] = model_id
        self._graders.append(grader)
        return self

    def grader_code(
        self,
        code: str,
        *,
        name: Optional[str] = None,
        threshold: float = 0.5,
    ) -> "TaskBuilder":
        """Add a code-based grader (Python function).

        The function signature must be::

            def grade(output: dict, expected: dict) -> float:
                # return a score between 0.0 and 1.0
                ...

        Args:
            code: Full Python source code of the grader function (must define ``grade``).
            name: Optional grader name.
            threshold: Minimum score to pass.
        """
        self._graders.append({
            "name": name or "code_grader",
            "type": "code_based",
            "code": code,
            "threshold": threshold,
        })
        return self

    def add_grader(self, grader_config: Dict[str, Any]) -> "TaskBuilder":
        """Add a raw grader configuration dict (for advanced use cases)."""
        self._graders.append(grader_config)
        return self

    # ── Build ─────────────────────────────────────────────────────────────────

    def build(self) -> Dict[str, Any]:
        """Return the task definition dict ready to pass to :meth:`EvaluationClient.add_task`."""
        return {
            "task_name": self._name,
            "description": self._description,
            "tags": self._tags,
            "difficulty": self._difficulty,
            "pattern_type": self._pattern_type,
            "trials": self._trials,
            "input_data": self._input,
            "expected_output": self._expected_output,
            "graders_config": self._graders,
        }


# ── EvaluationClient ──────────────────────────────────────────────────────────


class EvaluationClient:
    """Synchronous Python client for the OpenJiuwen Evaluation REST API.

    All methods raise :class:`requests.HTTPError` on non-2xx responses.

    Example::

        from openjiuwen_studio.evaluation.sdk import EvaluationClient

        client = EvaluationClient(
            api_url="http://localhost:8000",
            token="<jwt_token>",
            space_id="<your_space_id>",
        )

        suites = client.list_suites()
        run = client.run(evaluation_id=suites[0].evaluation_id, workflow_id="<id>", wait=True)
        print(run.metrics.success_rate)
    """

    def __init__(
        self,
        api_url: str,
        token: str,
        space_id: str,
        *,
        timeout: float = 30.0,
    ) -> None:
        self._base = f"{api_url.rstrip('/')}/api/v1/evaluation"
        self._headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        self.space_id = space_id
        self._timeout = timeout
        self._session = requests.Session()
        self._session.headers.update(self._headers)

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _get(self, path: str, params: Optional[Dict] = None) -> Any:
        r = self._session.get(f"{self._base}{path}", params=params, timeout=self._timeout)
        r.raise_for_status()
        return r.json()

    def _post(self, path: str, body: Optional[Dict] = None) -> Any:
        r = self._session.post(f"{self._base}{path}", json=body or {}, timeout=self._timeout)
        r.raise_for_status()
        return r.json()

    def _put(self, path: str, body: Optional[Dict] = None) -> Any:
        r = self._session.put(f"{self._base}{path}", json=body or {}, timeout=self._timeout)
        r.raise_for_status()
        return r.json()

    def _delete(self, path: str, params: Optional[Dict] = None) -> Any:
        r = self._session.delete(f"{self._base}{path}", params=params, timeout=self._timeout)
        r.raise_for_status()
        return r.json()

    @staticmethod
    def _data(resp: Any) -> Any:
        """Extract ``resp['data']``, raising on API-level errors."""
        if isinstance(resp, dict) and resp.get("code", 200) not in (200, 0):
            msg = resp.get("message", "API error")
            raise RuntimeError(f"API error {resp.get('code')}: {msg}")
        return resp.get("data") if isinstance(resp, dict) else resp

    # ── Suite operations ──────────────────────────────────────────────────────

    def list_suites(self) -> List[SuiteInfo]:
        """Return all evaluation suites in the configured space."""
        data = self._data(self._get("/list", {"space_id": self.space_id}))
        items = (data or {}).get("evaluations", []) if isinstance(data, dict) else []
        return [
            SuiteInfo(
                evaluation_id=s["evaluation_id"],
                suite_name=s.get("suite_name", ""),
                space_id=s.get("space_id", self.space_id),
                description=s.get("description"),
                config=s.get("config") or {},
                create_time=s.get("create_time", 0),
                update_time=s.get("update_time", 0),
            )
            for s in items
        ]

    def get_suite(self, evaluation_id: str) -> SuiteInfo:
        """Return a single suite by ID.

        Raises :class:`KeyError` if the suite is not found.
        """
        suites = self.list_suites()
        for s in suites:
            if s.evaluation_id == evaluation_id:
                return s
        raise KeyError(f"Suite {evaluation_id!r} not found")

    def create_suite(self, name: str, description: Optional[str] = None) -> SuiteInfo:
        """Create a new evaluation suite and return it."""
        body = {"suite_name": name, "space_id": self.space_id}
        if description:
            body["description"] = description
        data = self._data(self._post("/create", body))
        evaluation_id = (data or {}).get("evaluation_id", "")
        return self.get_suite(evaluation_id) if evaluation_id else SuiteInfo(
            evaluation_id=evaluation_id,
            suite_name=name,
            space_id=self.space_id,
            description=description,
        )

    def update_suite(
        self,
        evaluation_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> None:
        """Rename a suite or update its description."""
        body: Dict[str, Any] = {"evaluation_id": evaluation_id, "space_id": self.space_id}
        if name is not None:
            body["suite_name"] = name
        if description is not None:
            body["description"] = description
        self._put("/update", body)

    def delete_suite(self, evaluation_id: str) -> None:
        """Delete an evaluation suite and all its tasks."""
        self._delete(f"/{evaluation_id}", {"space_id": self.space_id})

    # ── Task operations ───────────────────────────────────────────────────────

    @staticmethod
    def task_builder(name: str) -> TaskBuilder:
        """Return a :class:`TaskBuilder` for constructing a task definition.

        Example::

            task = (
                client.task_builder("Billing Routing")
                .input(query="Cancel my plan")
                .expected_output(department="billing")
                .trials(5)
                .grader_exact_match(path="department", expected="billing")
                .build()
            )
            client.add_task(suite.evaluation_id, task)
        """
        return TaskBuilder(name)

    def list_tasks(self, evaluation_id: str) -> List[TaskInfo]:
        """Return all tasks in an evaluation suite."""
        data = self._data(self._get("/task/list", {
            "evaluation_id": evaluation_id,
            "space_id": self.space_id,
        }))
        items = data if isinstance(data, list) else (data or {}).get("tasks", [])
        return [
            TaskInfo(
                task_id=t.get("task_id", ""),
                evaluation_id=evaluation_id,
                task_name=t.get("task_name", ""),
                trials=t.get("trials", 3),
                description=t.get("description"),
                tags=t.get("tags") or [],
                difficulty=t.get("difficulty"),
                pattern_type=t.get("pattern_type"),
                input_data=t.get("input_data") or t.get("input") or {},
                expected_output=t.get("expected_output") or t.get("expected_outcome") or {},
                graders_config=t.get("graders_config") or t.get("graders") or [],
                create_time=t.get("create_time", 0),
            )
            for t in (items or [])
        ]

    def add_task(self, evaluation_id: str, task: Dict[str, Any]) -> None:
        """Add a task to a suite.

        ``task`` should be a dict as returned by :meth:`TaskBuilder.build`, or
        a raw task dict with keys ``task_name``, ``input_data``, ``expected_output``,
        ``graders_config``, ``trials``.
        """
        self._post("/task/add", {
            "evaluation_id": evaluation_id,
            "task": {
                **task,
                "input": task.get("input_data", {}),
                "expected_outcome": task.get("expected_output", {}),
                "graders": task.get("graders_config", []),
            },
        })

    def update_task(self, evaluation_id: str, task: Dict[str, Any]) -> None:
        """Update an existing task (must include ``task_id``)."""
        self._put("/task/update", {
            "evaluation_id": evaluation_id,
            "task": {
                **task,
                "input": task.get("input_data", {}),
                "expected_outcome": task.get("expected_output", {}),
                "graders": task.get("graders_config", []),
            },
        })

    def delete_task(self, evaluation_id: str, task_id: str) -> None:
        """Delete a task from a suite."""
        self._delete("/task/delete", {
            "evaluation_id": evaluation_id,
            "task_id": task_id,
            "space_id": self.space_id,
        })

    # ── Run operations ────────────────────────────────────────────────────────

    def run(
        self,
        evaluation_id: str,
        *,
        workflow_id: Optional[str] = None,
        workflow_version: Optional[str] = None,
        agent_id: Optional[str] = None,
        agent_version: Optional[str] = None,
        task_ids: Optional[List[str]] = None,
        parallel: bool = False,
        wait: bool = False,
        poll_interval: float = 4.0,
        timeout: Optional[float] = None,
    ) -> RunInfo:
        """Start an evaluation run and optionally block until it completes.

        Args:
            evaluation_id: The suite to run.
            workflow_id: Workflow to evaluate (mutually exclusive with ``agent_id``).
            workflow_version: Optional workflow version.
            agent_id: Agent to evaluate (mutually exclusive with ``workflow_id``).
            agent_version: Optional agent version.
            task_ids: If set, only run these specific tasks (default: all tasks).
            parallel: Execute tasks in parallel for speed (default: False).
            wait: Block until the run finishes (default: False).
            poll_interval: Seconds between status polls when ``wait=True`` (default: 4.0).
            timeout: Maximum seconds to wait when ``wait=True``; raises :class:`TimeoutError`
                     if exceeded. ``None`` means wait indefinitely.

        Returns:
            :class:`RunInfo` — either the initial run record (if ``wait=False``) or
            the final completed record (if ``wait=True``).
        """
        if not workflow_id and not agent_id:
            raise ValueError("Provide workflow_id or agent_id")

        body: Dict[str, Any] = {
            "evaluation_id": evaluation_id,
            "space_id": self.space_id,
            "parallel": parallel,
        }
        if workflow_id:
            body["workflow_id"] = workflow_id
        if workflow_version:
            body["workflow_version"] = workflow_version
        if agent_id:
            body["agent_id"] = agent_id
        if agent_version:
            body["agent_version"] = agent_version
        if task_ids:
            body["task_ids"] = task_ids

        data = self._data(self._post("/run/start", body))
        run_id: str = (data or {}).get("run_id", "")

        if not wait:
            return RunInfo(run_id=run_id, evaluation_id=evaluation_id, status="0")

        # Poll until done
        deadline = time.monotonic() + timeout if timeout is not None else None
        while True:
            run = self.get_run(run_id)
            if run.is_complete:
                return run
            if deadline is not None and time.monotonic() >= deadline:
                raise TimeoutError(f"Run {run_id} did not complete within {timeout}s")
            time.sleep(poll_interval)

    def list_runs(self, evaluation_id: str) -> List[RunInfo]:
        """Return all runs for a suite, most recent first."""
        data = self._data(self._get("/run/list", {
            "evaluation_id": evaluation_id,
            "space_id": self.space_id,
        }))
        items = data if isinstance(data, list) else (data or {}).get("runs", [])
        return [RunInfo.from_dict(r) for r in (items or [])]

    def get_run(self, run_id: str) -> RunInfo:
        """Return the current status and metrics for a run."""
        data = self._data(self._get(f"/run/{run_id}", {"space_id": self.space_id}))
        return RunInfo.from_dict(data or {"run_id": run_id, "status": "0"})

    def delete_run(self, run_id: str) -> None:
        """Delete a run and all associated results."""
        self._delete("/run/delete", {"run_id": run_id, "space_id": self.space_id})

    # ── Results ───────────────────────────────────────────────────────────────

    def get_results(self, run_id: str) -> EvaluationResults:
        """Return the full results for a completed run.

        Includes per-trial task results with grader outputs, scores, and latency.
        """
        data = self._data(self._get(f"/results/{run_id}", {"space_id": self.space_id}))
        return EvaluationResults.from_dict(data or {"run_id": run_id, "status": "0"})

    # ── Benchmarks ────────────────────────────────────────────────────────────

    def list_benchmarks(self) -> List[BenchmarkInfo]:
        """Return metadata for all pre-built benchmark YAML files."""
        data = self._data(self._get("/benchmarks/list"))
        items = (data or {}).get("benchmarks", [])
        return [
            BenchmarkInfo(
                file_name=b.get("file_name", ""),
                suite_name=b.get("suite_name", ""),
                description=b.get("description", ""),
                task_count=b.get("task_count", 0),
            )
            for b in items
        ]

    def import_benchmark(
        self,
        file_name: str,
        suite_name: Optional[str] = None,
    ) -> SuiteInfo:
        """Import a pre-built benchmark YAML as a new evaluation suite.

        Args:
            file_name: The benchmark filename (e.g. ``"routing_benchmark.yaml"``).
                       List available benchmarks with :meth:`list_benchmarks`.
            suite_name: Optional custom name for the created suite.

        Returns:
            The newly created :class:`SuiteInfo`.
        """
        body: Dict[str, Any] = {"file_name": file_name, "space_id": self.space_id}
        if suite_name:
            body["suite_name"] = suite_name
        data = self._data(self._post("/benchmarks/import", body))
        evaluation_id = (data or {}).get("evaluation_id", "")
        return self.get_suite(evaluation_id)

    # ── Context manager support ───────────────────────────────────────────────

    def __enter__(self) -> "EvaluationClient":
        return self

    def __exit__(self, *_: Any) -> None:
        self._session.close()

    def close(self) -> None:
        """Close the underlying HTTP session."""
        self._session.close()

    def __repr__(self) -> str:
        return f"EvaluationClient(api_url={self._base!r}, space_id={self.space_id!r})"
