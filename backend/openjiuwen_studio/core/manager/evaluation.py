#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
"""
Evaluation system manager — business logic layer.

Follows the same pattern as plugin.py: top-level module functions that
call repository methods and return ResponseModel dicts.
"""
import asyncio
import pathlib
import uuid
from functools import wraps
from typing import Any, Callable, Dict, List, Optional

import yaml
from fastapi import status

from openjiuwen.core.common.logging import logger
from openjiuwen_studio.core.database import milliseconds
from openjiuwen_studio.core.manager.repositories.evaluation_repository import (
    evaluation_repository,
    evaluation_run_repository,
    evaluation_task_repository,
    evaluation_task_result_repository,
    grader_repository,
)
from openjiuwen_studio.schemas.common import ResponseModel
from openjiuwen_studio.schemas.evaluation import (
    EvaluationCreate,
    EvaluationRunRequest,
    EvaluationStatus,
    EvaluationTaskCreate,
    GraderCreate,
)

# Path to pre-built benchmark YAML files (relative to this module)
_BENCHMARKS_DIR = pathlib.Path(__file__).parent.parent.parent / "marketplace" / "benchmarks"


def _handle(func: Callable) -> Callable:
    """Standard exception wrapper for manager functions."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logger.error(f"[evaluation manager] {func.__name__} error: {e}", exc_info=True)
            return ResponseModel(
                code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message=str(e),
            ).model_dump(exclude_none=True)
    return wrapper


# ──────────────────────────────────────────────────────────────────────────────
# Evaluation suite CRUD
# ──────────────────────────────────────────────────────────────────────────────

@_handle
def evaluation_create(request: EvaluationCreate, current_user: Dict[str, Any]) -> dict:
    """Create a new evaluation suite."""
    data = {
        "evaluation_id": str(uuid.uuid4()),
        "suite_name": request.suite_name,
        "description": request.description,
        "space_id": request.space_id,
        "config": request.config or {},
        "create_time": milliseconds(),
        "update_time": milliseconds(),
    }
    return evaluation_repository.create(data)


@_handle
def evaluation_get(evaluation_id: str, space_id: str, current_user: Dict[str, Any]) -> dict:
    """Get evaluation suite by ID."""
    return evaluation_repository.get({"evaluation_id": evaluation_id, "space_id": space_id})


@_handle
def evaluation_list(space_id: str, page: int, size: int, current_user: Dict[str, Any]) -> dict:
    """List evaluation suites for a space."""
    return evaluation_repository.list({"space_id": space_id, "page": page, "size": size})


@_handle
def evaluation_delete(evaluation_id: str, space_id: str, current_user: Dict[str, Any]) -> dict:
    """Delete an evaluation suite."""
    return evaluation_repository.delete({"evaluation_id": evaluation_id, "space_id": space_id})


@_handle
def evaluation_update(request, current_user: Dict[str, Any]) -> dict:
    """Update evaluation suite name, description, and/or config."""
    update_data: dict = {
        "evaluation_id": request.evaluation_id,
        "space_id": request.space_id,
    }
    if request.suite_name is not None:
        update_data["suite_name"] = request.suite_name
    # Always include description so it can be cleared (set to None/empty)
    update_data["description"] = request.description
    if request.config is not None:
        update_data["config"] = request.config
    return evaluation_repository.update(update_data)


# ──────────────────────────────────────────────────────────────────────────────
# Task CRUD
# ──────────────────────────────────────────────────────────────────────────────

@_handle
def evaluation_add_task(request: EvaluationTaskCreate, current_user: Dict[str, Any]) -> dict:
    """Add a task to an evaluation suite."""
    td = request.task
    data = {
        "task_id": td.task_id,
        "evaluation_id": request.evaluation_id,
        "task_name": td.task_name,
        "description": td.description,
        "task_definition": td.model_dump_json(),
        "input_data": td.input,
        "expected_output": td.expected_outcome,
        "graders_config": td.graders,
        "tags": td.tags,
        "difficulty": td.difficulty.value if td.difficulty is not None else None,
        "pattern_type": td.pattern_type.value if td.pattern_type is not None else None,
        "pattern_types": td.pattern_types or [],
        "trials": td.trials,
        "create_time": milliseconds(),
        "update_time": milliseconds(),
    }
    return evaluation_task_repository.create(data)


@_handle
def evaluation_update_task(request: EvaluationTaskCreate, current_user: Dict[str, Any]) -> dict:
    """Update an existing task in an evaluation suite."""
    td = request.task
    data = {
        "task_id": td.task_id,
        "evaluation_id": request.evaluation_id,
        "task_name": td.task_name,
        "description": td.description,
        "task_definition": td.model_dump_json(),
        "input_data": td.input,
        "expected_output": td.expected_outcome,
        "graders_config": td.graders,
        "tags": td.tags,
        "difficulty": td.difficulty.value if td.difficulty is not None else None,
        "pattern_type": td.pattern_type.value if td.pattern_type is not None else None,
        "pattern_types": td.pattern_types or [],
        "trials": td.trials,
        "update_time": milliseconds(),
    }
    return evaluation_task_repository.update(data)


@_handle
def evaluation_list_tasks(evaluation_id: str, space_id: str, current_user: Dict[str, Any]) -> dict:
    """List all tasks for an evaluation suite (scoped by space_id for security)."""
    # Verify the evaluation belongs to this space
    eval_res = evaluation_repository.get({"evaluation_id": evaluation_id, "space_id": space_id})
    if eval_res.get("code") != 200:
        return eval_res
    return evaluation_task_repository.list_by_evaluation(evaluation_id)


@_handle
def evaluation_delete_task(
    evaluation_id: str, task_id: str, space_id: str, current_user: Dict[str, Any]
) -> dict:
    """Delete a task from an evaluation suite (scoped by space_id for security)."""
    eval_res = evaluation_repository.get({"evaluation_id": evaluation_id, "space_id": space_id})
    if eval_res.get("code") != 200:
        return eval_res
    return evaluation_task_repository.delete({"evaluation_id": evaluation_id, "task_id": task_id})


# ──────────────────────────────────────────────────────────────────────────────
# Run management
# ──────────────────────────────────────────────────────────────────────────────

def evaluation_run_start(request: EvaluationRunRequest, current_user: Dict[str, Any]) -> dict:
    """
    Create a run record and launch the harness as a background task.
    Returns immediately with run_id; the harness updates status async.
    """
    try:
        run_id = str(uuid.uuid4())
        # Store display names in initial metrics so they survive harness updates
        initial_meta: Dict[str, Any] = {}
        if request.workflow_name:
            initial_meta["_workflow_name"] = request.workflow_name
        if request.agent_name:
            initial_meta["_agent_name"] = request.agent_name

        run_data = {
            "run_id": run_id,
            "evaluation_id": request.evaluation_id,
            "workflow_id": request.workflow_id,
            "workflow_version": request.workflow_version,
            "agent_id": request.agent_id,
            "agent_version": request.agent_version,
            "status": str(EvaluationStatus.PENDING.value),
            "metrics": initial_meta or None,
            "start_time": milliseconds(),
            "create_time": milliseconds(),
            "update_time": milliseconds(),
        }
        res = evaluation_run_repository.create(run_data)
        if res.get("code") != status.HTTP_200_OK:
            return res

        # Fire-and-forget harness execution
        from openjiuwen_studio.core.executor.evaluation.evaluation_harness import (
            EvaluationHarness,
            EvaluationRunConfig,
        )
        harness = EvaluationHarness()
        run_config = EvaluationRunConfig(
            run_id=run_id,
            evaluation_id=request.evaluation_id,
            space_id=request.space_id,
            current_user=current_user,
            workflow_id=request.workflow_id,
            workflow_version=request.workflow_version,
            agent_id=request.agent_id,
            agent_version=request.agent_version,
            task_ids=request.task_ids,
            parallel=request.parallel,
            max_workers=request.max_workers,
            enable_perturbations=request.enable_perturbations,
            perturbation_model_id=request.perturbation_model_id,
            fault_probability=request.fault_probability,
        )

        async def _launch():
            await harness.execute_evaluation(run_config)

        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_launch())
        except RuntimeError:
            # No running loop (test context) — just note it
            logger.warning("No running event loop; harness will not execute in this context")

        return ResponseModel(
            code=status.HTTP_200_OK,
            message="Evaluation run started",
            data={"run_id": run_id, "status": str(EvaluationStatus.PENDING.value)},
        ).model_dump(exclude_none=True)

    except Exception as e:
        logger.error(f"evaluation_run_start error: {e}", exc_info=True)
        return ResponseModel(
            code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=str(e),
        ).model_dump(exclude_none=True)


@_handle
def evaluation_run_get(run_id: str, space_id: str, current_user: Dict[str, Any]) -> dict:
    """Get run status (space_id accepted for API consistency; run_id is globally unique)."""
    return evaluation_run_repository.get(run_id)


@_handle
def evaluation_run_list(evaluation_id: str, space_id: str, current_user: Dict[str, Any]) -> dict:
    """List runs for an evaluation suite (scoped by space_id for security)."""
    eval_res = evaluation_repository.get({"evaluation_id": evaluation_id, "space_id": space_id})
    if eval_res.get("code") != 200:
        return eval_res
    res = evaluation_run_repository.list_by_evaluation(evaluation_id)
    # Enrich each run with display names stored in the metrics _metadata keys
    runs: List[dict] = res.get("data") or []
    if isinstance(runs, dict):
        runs = runs.get("data") or []
    enriched_runs = []
    for run in runs:
        r = dict(run) if isinstance(run, dict) else {}
        meta = r.get("metrics") or {}
        if isinstance(meta, dict):
            if meta.get("_workflow_name") and not r.get("workflow_name"):
                r["workflow_name"] = meta["_workflow_name"]
            if meta.get("_agent_name") and not r.get("agent_name"):
                r["agent_name"] = meta["_agent_name"]
        enriched_runs.append(r)
    return ResponseModel(
        code=status.HTTP_200_OK,
        message="Success",
        data=enriched_runs,
    ).model_dump(exclude_none=True)


@_handle
def evaluation_run_delete(run_id: str, space_id: str, current_user: Dict[str, Any]) -> dict:
    """Delete a run and its results (cascade)."""
    return evaluation_run_repository.delete(run_id)


# ──────────────────────────────────────────────────────────────────────────────
# Results
# ──────────────────────────────────────────────────────────────────────────────

@_handle
def evaluation_results_get(run_id: str, space_id: str, current_user: Dict[str, Any]) -> dict:
    """
    Get detailed results for a run, including aggregate metrics.
    Enriches task_results with task_name and workflow/agent names.
    """
    run_res = evaluation_run_repository.get(run_id)
    if run_res.get("code") != status.HTTP_200_OK:
        return run_res

    run_data: dict = run_res.get("data") or {}

    # Extract display names stored in run metrics metadata
    run_metrics_meta = run_data.get("metrics") or {}
    if isinstance(run_metrics_meta, dict):
        if not run_data.get("workflow_name") and run_metrics_meta.get("_workflow_name"):
            run_data["workflow_name"] = run_metrics_meta["_workflow_name"]
        if not run_data.get("agent_name") and run_metrics_meta.get("_agent_name"):
            run_data["agent_name"] = run_metrics_meta["_agent_name"]

    results_res = evaluation_task_result_repository.list_by_run(run_id)
    results: List[dict] = results_res.get("data") or []
    if isinstance(results, dict):
        results = results.get("data") or []

    # Build task_id → task_name lookup from the evaluation's task list
    evaluation_id = run_data.get("evaluation_id")
    task_name_map: Dict[str, str] = {}
    if evaluation_id:
        try:
            tasks_res = evaluation_task_repository.list_by_evaluation(evaluation_id)
            task_list = tasks_res.get("data") or []
            if isinstance(task_list, dict):
                task_list = task_list.get("data") or []
            for t in task_list:
                if isinstance(t, dict):
                    tid = t.get("task_id", "")
                    tname = t.get("task_name", tid)
                    if tid:
                        task_name_map[tid] = tname
        except Exception as e:
            logger.warning(f"Could not fetch task names for run {run_id}: {e}")

    # Enrich each result with task_name
    enriched_results = []
    for r in results:
        r_copy = dict(r) if isinstance(r, dict) else {}
        task_id = r_copy.get("task_id", "")
        if "task_name" not in r_copy or not r_copy.get("task_name"):
            r_copy["task_name"] = task_name_map.get(task_id, task_id)
        enriched_results.append(r_copy)

    # Load suite config to pick up custom metric definitions for re-computation
    custom_metric_defs: List[dict] = []
    if evaluation_id:
        try:
            suite_res = evaluation_repository.get({"evaluation_id": evaluation_id})
            suite_data = suite_res.get("data") or {}
            if isinstance(suite_data, dict):
                custom_metric_defs = (suite_data.get("config") or {}).get("custom_metrics") or []
        except Exception as e:
            logger.warning(f"Could not load suite config for custom metrics: {e}")

    from openjiuwen_studio.core.executor.evaluation.metrics import compute_aggregate_metrics
    metrics = compute_aggregate_metrics(enriched_results, custom_metric_defs=custom_metric_defs)

    return ResponseModel(
        code=status.HTTP_200_OK,
        message="Success",
        data={
            "run_id": run_id,
            "evaluation_id": run_data.get("evaluation_id"),
            "status": run_data.get("status"),
            "workflow_id": run_data.get("workflow_id"),
            "workflow_name": run_data.get("workflow_name"),
            "agent_id": run_data.get("agent_id"),
            "agent_name": run_data.get("agent_name"),
            "metrics": metrics,
            "task_results": enriched_results,
        },
    ).model_dump(exclude_none=True)


# ──────────────────────────────────────────────────────────────────────────────
# Result explanation
# ──────────────────────────────────────────────────────────────────────────────

@_handle
def evaluation_explain(run_id: str, space_id: str, current_user: Dict[str, Any]) -> dict:
    """
    Generate heuristic natural-language insights for a completed run.

    Fetches the same data as evaluation_results_get but passes metrics +
    task_results through the evaluation_explainer module instead of returning
    raw numbers.
    """
    from openjiuwen_studio.core.manager.evaluation_explainer import explain_run

    run_res = evaluation_run_repository.get(run_id)
    if run_res.get("code") != status.HTTP_200_OK:
        return run_res
    run_data: dict = run_res.get("data") or {}

    results_res = evaluation_task_result_repository.list_by_run(run_id)
    results: List[dict] = results_res.get("data") or []
    if isinstance(results, dict):
        results = results.get("data") or []

    # Enrich with task names (best effort)
    evaluation_id = run_data.get("evaluation_id")
    task_name_map: Dict[str, str] = {}
    if evaluation_id:
        try:
            tasks_res = evaluation_task_repository.list_by_evaluation(evaluation_id)
            task_list = tasks_res.get("data") or []
            if isinstance(task_list, dict):
                task_list = task_list.get("data") or []
            for t in task_list:
                if isinstance(t, dict) and t.get("task_id"):
                    task_name_map[t["task_id"]] = t.get("task_name") or t["task_id"]
        except Exception as e:
            logger.warning(f"Could not fetch task names for explain {run_id}: {e}")

    enriched: List[dict] = []
    for r in results:
        r_copy = dict(r) if isinstance(r, dict) else {}
        if not r_copy.get("task_name"):
            r_copy["task_name"] = task_name_map.get(r_copy.get("task_id", ""), r_copy.get("task_id", ""))
        enriched.append(r_copy)

    # Compute fresh metrics (same as results endpoint)
    custom_metric_defs: List[dict] = []
    if evaluation_id:
        try:
            suite_res = evaluation_repository.get({"evaluation_id": evaluation_id})
            suite_data = suite_res.get("data") or {}
            if isinstance(suite_data, dict):
                custom_metric_defs = (suite_data.get("config") or {}).get("custom_metrics") or []
        except Exception as e:
            logger.warning(f"Could not load suite config for explain: {e}")

    from openjiuwen_studio.core.executor.evaluation.metrics import compute_aggregate_metrics
    metrics = compute_aggregate_metrics(enriched, custom_metric_defs=custom_metric_defs)

    explanation = explain_run(metrics, enriched)

    return ResponseModel(
        code=status.HTTP_200_OK,
        message="Success",
        data=explanation,
    ).model_dump(exclude_none=True)


# ──────────────────────────────────────────────────────────────────────────────
# Benchmark suite operations
# ──────────────────────────────────────────────────────────────────────────────

@_handle
def evaluation_list_benchmarks() -> dict:
    """
    List all pre-built benchmark YAML files available on disk.
    Returns metadata for each benchmark (name, description, task count).
    """
    benchmarks = []
    if not _BENCHMARKS_DIR.exists():
        return ResponseModel(
            code=status.HTTP_200_OK,
            message="Success",
            data={"benchmarks": []},
        ).model_dump(exclude_none=True)

    for yaml_path in sorted(_BENCHMARKS_DIR.glob("*.yaml")):
        try:
            with open(yaml_path, "r", encoding="utf-8") as f:
                doc = yaml.safe_load(f)
            suite_meta = doc.get("suite", {})
            tasks = doc.get("tasks", [])
            benchmarks.append({
                "file_name": yaml_path.name,
                "suite_name": suite_meta.get("suite_name", yaml_path.stem),
                "description": suite_meta.get("description", ""),
                "task_count": len(tasks),
            })
        except Exception as e:
            logger.warning(f"Failed to read benchmark YAML {yaml_path.name}: {e}")

    return ResponseModel(
        code=status.HTTP_200_OK,
        message="Success",
        data={"benchmarks": benchmarks},
    ).model_dump(exclude_none=True)


@_handle
def evaluation_import_benchmark(
    file_name: str,
    space_id: str,
    suite_name_override: Optional[str],
    current_user: Dict[str, Any],
) -> dict:
    """
    Import a pre-built benchmark YAML as a new evaluation suite.

    Creates the suite record and all tasks from the YAML.
    YAML format uses slightly different field names (input_data, graders_config[].type);
    this function normalises them to the internal schema.
    """
    yaml_path = _BENCHMARKS_DIR / file_name
    if not yaml_path.exists() or yaml_path.suffix not in (".yaml", ".yml"):
        return ResponseModel(
            code=status.HTTP_404_NOT_FOUND,
            message=f"Benchmark file not found: {file_name}",
        ).model_dump(exclude_none=True)

    with open(yaml_path, "r", encoding="utf-8") as f:
        doc = yaml.safe_load(f)

    suite_meta = doc.get("suite", {})
    tasks_raw = doc.get("tasks", [])

    # Create the suite
    evaluation_id = str(uuid.uuid4())
    suite_name = suite_name_override or suite_meta.get("suite_name", yaml_path.stem)
    ts = milliseconds()
    suite_data = {
        "evaluation_id": evaluation_id,
        "suite_name": suite_name,
        "description": suite_meta.get("description", ""),
        "space_id": space_id,
        "config": {"imported_from": file_name},
        "create_time": ts,
        "update_time": ts,
    }
    suite_res = evaluation_repository.create(suite_data)
    if suite_res.get("code") != status.HTTP_200_OK:
        return suite_res

    # Import each task
    imported = 0
    errors = []
    for task_raw in tasks_raw:
        try:
            task_id = task_raw.get("task_id", str(uuid.uuid4()))
            ts2 = milliseconds()

            # Normalise graders: YAML uses "type" field; store as-is since
            # the grader engine now accepts both "type" and "grader_type".
            graders_config = task_raw.get("graders_config", [])

            # Normalise difficulty and pattern_type (already integers in YAML)
            difficulty = task_raw.get("difficulty")
            if isinstance(difficulty, int):
                difficulty = str(difficulty)
            pattern_type = task_raw.get("pattern_type")
            if isinstance(pattern_type, int):
                pattern_type = str(pattern_type)

            task_data = {
                "task_id": task_id,
                "evaluation_id": evaluation_id,
                "task_name": task_raw.get("task_name", task_id),
                "description": task_raw.get("description", ""),
                "task_definition": str(task_raw),  # Store raw for reference
                "input_data": task_raw.get("input_data", {}),
                "expected_output": task_raw.get("expected_output", {}),
                "graders_config": graders_config,
                "tags": task_raw.get("tags", []),
                "difficulty": difficulty,
                "pattern_type": pattern_type,
                "trials": int(task_raw.get("trials", 1)),
                "create_time": ts2,
                "update_time": ts2,
            }
            task_res = evaluation_task_repository.create(task_data)
            if task_res.get("code") == status.HTTP_200_OK:
                imported += 1
            else:
                errors.append(f"Task {task_id}: {task_res.get('message')}")
        except Exception as e:
            errors.append(f"Task error: {e}")

    return ResponseModel(
        code=status.HTTP_200_OK,
        message=f"Benchmark imported: {imported} tasks, {len(errors)} errors",
        data={
            "evaluation_id": evaluation_id,
            "suite_name": suite_name,
            "tasks_imported": imported,
            "errors": errors,
        },
    ).model_dump(exclude_none=True)


# ──────────────────────────────────────────────────────────────────────────────
# Grader CRUD
# ──────────────────────────────────────────────────────────────────────────────

@_handle
def grader_create(request: GraderCreate, current_user: Dict[str, Any]) -> dict:
    """Create a reusable grader definition."""
    data = {
        "grader_id": str(uuid.uuid4()),
        "grader_name": request.grader_name,
        "description": request.description,
        "space_id": request.space_id,
        "grader_type": request.grader_type,
        "config": request.config,
        "create_time": milliseconds(),
        "update_time": milliseconds(),
    }
    return grader_repository.create(data)


@_handle
def grader_list(space_id: str, current_user: Dict[str, Any]) -> dict:
    """List graders for a space."""
    return grader_repository.list_by_space(space_id)


# ──────────────────────────────────────────────────────────────────────────────
# AI-assisted grader generation
# ──────────────────────────────────────────────────────────────────────────────

_GRADER_GEN_PROMPT = """You are an expert AI evaluation engineer. Your task is to generate a grader configuration for 
an automated evaluation system.

Available grader types:
- type 0 (Deterministic, rule-based, fast and free):
    Fields: check_type, pattern (for contains/equals/regex), min_value/max_value (for range), schema (for json_schema)
    check_type options: "contains", "equals", "regex", "range", "json_schema"
- type 1 (Model-Based, uses AI to judge quality):
    Fields: rubric (evaluation criteria text), passing_score (0.0 to 1.0)
    Note: model_id will be set by the user, do NOT include it.
- type 2 (Code-Based, custom Python logic):
    Fields: code (Python function definition)
    Function signature: def grade(trace, expected): ...
    trace has: trace.get('final_output') — the workflow output
    Must return: dict with 'passed' (bool) and 'score' (float 0-1)

Common fields for all types: name (python identifier), weight (float, default 1.0)

Examples:

User: "Check if the output exactly equals 'Paris'"
{"name": "exact_match", "type": 0, "weight": 1.0, "check_type": "equals", "pattern": "Paris"}

User: "Check if the output contains a valid email address"
{"name": "email_check", "type": 0, "weight": 1.0, "check_type": "regex", "pattern": 
"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,}"}

User: "Check if the numeric result is between 0 and 100"
{"name": "range_check", "type": 0, "weight": 1.0, "check_type": "range", "min_value": 0, "max_value": 100}

User: "The response should be helpful, professional, and relevant to the question"
{"name": "quality_check", "type": 1, "weight": 1.0, "rubric": "Evaluate if the response is helpful, professional, 
and directly answers the user's question. High scores (0.8-1.0) for complete, accurate, well-structured answers. 
Low scores for irrelevant or incomplete answers.", "passing_score": 0.7}

User: "The output JSON must have a 'result' key with a numeric value"
{"name": "result_key_check", "type": 2, "weight": 1.0, "code": "import json\\ndef grade(trace, expected):\\n    
try:\\n        out = trace.get('final_output', {})\\n        if isinstance(out, str):\\n            
out = json.loads(out)\\n        has_result = isinstance(out.get('result'), (int, float))\\n        
return {'passed': has_result, 'score': 1.0 if has_result else 0.0}\\n    except Exception:\\n        
return {'passed': False, 'score': 0.0}"}

Now generate a grader for this requirement:
User: "{description}"

Respond with ONLY valid JSON, no explanation, no markdown. Generate exactly one grader config object."""


def _parse_generated_grader(text: str) -> Optional[dict]:
    """Extract JSON from LLM response text."""
    import re
    import json
    # Try to find JSON object in the response
    match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except ValueError:
            pass
    # Try parsing the whole text
    try:
        return json.loads(text.strip())
    except ValueError:
        return None


async def grader_generate(
    description: str,
    space_id: str,
    model_id: Optional[int],
    current_user: Dict[str, Any],
) -> dict:
    """Generate a grader config from a natural-language description using an LLM."""
    try:
        from openjiuwen_studio.core.manager.convertor.components.llm import build_dsl_model_config
        from openjiuwen_studio.core.database import SessionLocal
        from openjiuwen_studio.core.manager.model_manager.managers import ModelConfigManager
        from openjiuwen.core.foundation.llm import Model, ModelClientConfig, ModelRequestConfig, UserMessage

        # If no model_id, find first active model in the space
        if not model_id:
            db = SessionLocal()
            try:
                manager = ModelConfigManager(db)
                models, _ = manager.get_paginated_configs(
                    page=1, size=1,
                    filters={"space_id": space_id, "is_active": True},
                )
                if not models:
                    return {
                        "code": 400,
                        "message": "No active models available. Please add and activate a model in Settings → Models.",
                        "data": None,
                    }
                model_id = models[0].id
            finally:
                db.close()

        dsl_cfg = build_dsl_model_config(int(model_id), space_id)
        cc = dsl_cfg.model_client_config
        rc = dsl_cfg.request_config

        client_config = ModelClientConfig(
            client_provider=cc.client_provider or "openai",
            api_key=cc.api_key or "",
            api_base=cc.api_base or "",
            timeout=float(cc.timeout or 60.0),
            verify_ssl=False,
        )
        request_config = ModelRequestConfig(
            model=rc.model_name or "",
            temperature=0.1,
            top_p=rc.top_p if rc.top_p is not None else 0.9,
        )

        prompt = _GRADER_GEN_PROMPT.replace("{description}", description)
        model = Model(model_client_config=client_config, model_config=request_config)
        result = await model.invoke([UserMessage(content=prompt)])
        response_text = result.content or ""

        grader_config = _parse_generated_grader(response_text)
        if not grader_config:
            return {
                "code": 422,
                "message": "Could not parse grader from LLM response. Try rephrasing your description.",
                "data": {"raw_response": response_text},
            }

        return {"code": 200, "message": "success", "data": {"grader_config": grader_config}}

    except Exception as e:
        logger.error(f"Grader generation failed: {e}", exc_info=True)
        return {"code": 500, "message": f"Generation failed: {str(e)}", "data": None}
