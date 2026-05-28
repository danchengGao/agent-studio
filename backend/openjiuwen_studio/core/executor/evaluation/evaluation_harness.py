#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
"""
Evaluation harness — orchestrates evaluation runs end-to-end.

Responsibilities:
- Load evaluation tasks from the database
- Execute each task's workflow / agent for every trial
- Capture full execution traces (streaming chunks)
- Invoke the grader engine and pattern validator
- Persist results and update run status

Design: wraps WorkflowRunner / AgentRunner without modifying them.
"""
import asyncio
import dataclasses
import uuid
from typing import Any, Dict, List, Optional

from openjiuwen.core.common.logging import logger

from openjiuwen_studio.core.database import milliseconds
from openjiuwen_studio.core.executor.evaluation.grader_engine import GraderEngine
from openjiuwen_studio.core.executor.evaluation.pattern_validator import PatternValidator
from openjiuwen_studio.core.executor.evaluation.perturbations import PerturbationCoordinator
from openjiuwen_studio.core.executor.evaluation.safety_grader import SafetyGrader
from openjiuwen_studio.core.manager.repositories.evaluation_repository import (
    evaluation_repository,
    evaluation_run_repository,
    evaluation_task_repository,
    evaluation_task_result_repository,
)
from openjiuwen_studio.schemas.evaluation import EvaluationStatus


# ── Parameter dataclasses (G.FNM.03) ──────────────────────────────────────────

@dataclasses.dataclass
class EvaluationRunConfig:
    """Parameters for a full evaluation run."""
    run_id: str
    evaluation_id: str
    space_id: str
    current_user: Dict[str, Any]
    workflow_id: Optional[str] = None
    workflow_version: Optional[str] = None
    agent_id: Optional[str] = None
    agent_version: Optional[str] = None
    task_ids: Optional[List[str]] = None
    parallel: bool = False
    max_workers: int = 5
    enable_perturbations: bool = False
    perturbation_model_id: Optional[str] = None
    fault_probability: float = 0.2


@dataclasses.dataclass
class _TaskRunConfig:
    """Parameters for executing a single task."""
    run_id: str
    task: Dict[str, Any]
    space_id: str
    current_user: Dict[str, Any]
    workflow_id: Optional[str] = None
    workflow_version: Optional[str] = None
    agent_id: Optional[str] = None
    agent_version: Optional[str] = None
    enable_perturbations: bool = False


@dataclasses.dataclass
class _TrialRunConfig:
    """Parameters for executing a single trial."""
    run_id: str
    task: Dict[str, Any]
    trial_num: int
    space_id: str
    current_user: Dict[str, Any]
    workflow_id: Optional[str] = None
    workflow_version: Optional[str] = None
    agent_id: Optional[str] = None
    agent_version: Optional[str] = None
    perturbation_type: str = "nominal"


@dataclasses.dataclass
class _RunnerContext:
    """Shared execution context passed to workflow/agent runners."""
    inputs: Any
    conversation_id: str
    space_id: str
    current_user: Dict[str, Any]


class EvaluationHarness:
    """Orchestrates a full evaluation run."""

    def __init__(self) -> None:
        self._grader = GraderEngine()
        self._pattern_validator = PatternValidator()
        self._perturbation_coordinator = PerturbationCoordinator()
        self._safety_grader = SafetyGrader()

    # ──────────────────────────────────────────────────────────────────────────
    # Public entry-point
    # ──────────────────────────────────────────────────────────────────────────

    async def execute_evaluation(self, config: EvaluationRunConfig) -> None:
        """
        Execute the evaluation run asynchronously.
        Called as a background task; writes results directly to the database.
        """
        logger.info(
            f"EvaluationHarness: starting run_id={config.run_id} "
            f"perturbations={config.enable_perturbations}"
        )
        try:
            # Re-initialise perturbation coordinator with run-level settings
            self._perturbation_coordinator = PerturbationCoordinator(
                model_id=config.perturbation_model_id,
                space_id=config.space_id,
                fault_probability=config.fault_probability,
            )

            # Mark as running
            evaluation_run_repository.update_status(config.run_id, str(EvaluationStatus.RUNNING.value))

            # Load tasks
            tasks_res = evaluation_task_repository.list_by_evaluation(config.evaluation_id)
            tasks: List[Dict[str, Any]] = tasks_res.get("data") or []
            if isinstance(tasks, dict):
                tasks = tasks.get("data") or []

            if config.task_ids:
                tasks = [t for t in tasks if t.get("task_id") in config.task_ids]

            if not tasks:
                logger.warning(f"No tasks found for evaluation_id={config.evaluation_id}")
                evaluation_run_repository.update_status(
                    config.run_id, str(EvaluationStatus.COMPLETED.value), metrics={}
                )
                return

            # Build task config for each task
            def _make_task_cfg(task: Dict[str, Any]) -> _TaskRunConfig:
                return _TaskRunConfig(
                    run_id=config.run_id,
                    task=task,
                    space_id=config.space_id,
                    current_user=config.current_user,
                    workflow_id=config.workflow_id,
                    workflow_version=config.workflow_version,
                    agent_id=config.agent_id,
                    agent_version=config.agent_version,
                    enable_perturbations=config.enable_perturbations,
                )

            # Execute
            if config.parallel:
                sem = asyncio.Semaphore(config.max_workers)

                async def _run_task_guarded(task: Dict[str, Any]) -> None:
                    async with sem:
                        await self._execute_task(_make_task_cfg(task))

                await asyncio.gather(*[_run_task_guarded(t) for t in tasks])
            else:
                for task in tasks:
                    await self._execute_task(_make_task_cfg(task))

            # Collect aggregate metrics and mark complete
            results_res = evaluation_task_result_repository.list_by_run(config.run_id)
            results: List[Dict] = results_res.get("data") or []
            if isinstance(results, dict):
                results = results.get("data") or []

            # Load suite config to pick up any custom metric definitions
            suite_res = evaluation_repository.get({"evaluation_id": config.evaluation_id})
            suite_data = suite_res.get("data") or {} if isinstance(suite_res.get("data"), dict) else {}
            custom_metric_defs = (suite_data.get("config") or {}).get("custom_metrics") or []

            from openjiuwen_studio.core.executor.evaluation.metrics import compute_aggregate_metrics
            metrics = compute_aggregate_metrics(results, custom_metric_defs=custom_metric_defs)

            # ── Regression / anomaly detection ────────────────────────────
            try:
                prev_run = self._get_last_completed_run(config.evaluation_id, exclude_run_id=config.run_id)
                if prev_run:
                    prev_metrics = prev_run.get("metrics") or {}
                    alerts = self._detect_regressions(metrics, prev_metrics, prev_run.get("run_id", ""))
                    if alerts:
                        metrics["alerts"] = alerts
                        for a in alerts:
                            logger.warning(f"[Regression] run={config.run_id} — {a['message']}")
            except Exception as _reg_err:
                logger.debug(f"Regression detection skipped: {_reg_err}")

            evaluation_run_repository.update_status(
                config.run_id, str(EvaluationStatus.COMPLETED.value), metrics=metrics
            )
            logger.info(f"EvaluationHarness: completed run_id={config.run_id}, metrics={metrics}")

        except Exception as e:
            logger.error(f"EvaluationHarness: run_id={config.run_id} failed: {e}", exc_info=True)
            evaluation_run_repository.update_status(config.run_id, str(EvaluationStatus.FAILED.value))

    # ──────────────────────────────────────────────────────────────────────────
    # Task + trial execution
    # ──────────────────────────────────────────────────────────────────────────

    async def _execute_task(self, config: _TaskRunConfig) -> None:
        task_id = config.task.get("task_id", "unknown")
        trials = int(config.task.get("trials") or 1)
        logger.info(f"Executing task={task_id}, trials={trials}, perturbations={config.enable_perturbations}")

        # Perturbation types to run
        perturbation_types = ["nominal"]
        if config.enable_perturbations:
            perturbation_types.extend(["prompt_perturbed", "env_perturbed", "fault_injected"])

        for perturbation_type in perturbation_types:
            for trial_num in range(1, trials + 1):
                trial_cfg = _TrialRunConfig(
                    run_id=config.run_id,
                    task=config.task,
                    trial_num=trial_num,
                    space_id=config.space_id,
                    current_user=config.current_user,
                    workflow_id=config.workflow_id,
                    workflow_version=config.workflow_version,
                    agent_id=config.agent_id,
                    agent_version=config.agent_version,
                    perturbation_type=perturbation_type,
                )
                await self._execute_trial(trial_cfg)

    async def _execute_trial(self, config: _TrialRunConfig) -> None:
        task_id = config.task.get("task_id", "unknown")
        result_id = str(uuid.uuid4())
        trace_id = str(uuid.uuid4())
        start_time = milliseconds()

        try:
            # Unique conversation_id per trial prevents execution conflicts
            conversation_id = (
                f"eval_{config.run_id}_{task_id}_t{config.trial_num}"
                f"_{config.perturbation_type[:4]}_{trace_id[:8]}"
            )

            inputs = config.task.get("input_data") or {}
            expected = config.task.get("expected_output")
            graders_cfg = config.task.get("graders_config") or []
            # Support new array format (pattern_types) and legacy single value (pattern_type)
            _pt_raw = config.task.get("pattern_types")
            if isinstance(_pt_raw, list) and _pt_raw:
                pattern_types_list = _pt_raw
            elif config.task.get("pattern_type") is not None:
                pattern_types_list = [config.task.get("pattern_type")]
            else:
                pattern_types_list = []

            # Apply perturbations based on type
            if config.perturbation_type == "prompt_perturbed":
                # Paraphrase the task prompt (if available in inputs)
                if "prompt" in inputs:
                    paraphrases = await self._perturbation_coordinator.generate_prompt_variants(
                        inputs["prompt"], num_variants=1
                    )
                    inputs = inputs.copy()
                    inputs["prompt"] = paraphrases[0] if paraphrases else inputs["prompt"]
            elif config.perturbation_type == "env_perturbed":
                # Perturb input data
                inputs = self._perturbation_coordinator.perturb_environment(inputs)
            elif config.perturbation_type == "fault_injected":
                # Fault injection is handled during execution (see below)
                pass

            runner_ctx = _RunnerContext(
                inputs=inputs,
                conversation_id=conversation_id,
                space_id=config.space_id,
                current_user=config.current_user,
            )

            # Execute workflow or agent
            if config.workflow_id:
                execution_trace = await self._run_workflow(
                    config.workflow_id, config.workflow_version or "draft", runner_ctx
                )
            elif config.agent_id:
                execution_trace = await self._run_agent(
                    config.agent_id, config.agent_version or "draft", runner_ctx
                )
            else:
                raise ValueError("Either workflow_id or agent_id must be specified")

            execution_trace["trace_id"] = trace_id

            # Apply fault injection if needed (post-execution)
            if config.perturbation_type == "fault_injected":
                fault = self._perturbation_coordinator.inject_fault()
                if fault:
                    # Inject fault into execution trace
                    execution_trace["_injected_fault"] = fault
                    # Optionally modify final_output to simulate fault
                    if fault["type"] in ["malformed", "error"]:
                        execution_trace["final_output"] = {"error": fault["message"]}

            end_time = milliseconds()
            latency_ms = end_time - start_time

            # Extract action sequence from trace for trajectory consistency
            action_sequence = self._extract_action_sequence(execution_trace)

            # Extract confidence from output
            confidence = self._extract_confidence(execution_trace)

            # Grade
            grader_results = await self._grader.run_graders(
                graders_cfg, execution_trace, expected, config.space_id
            )

            # Pattern validation — one result per selected pattern type
            for pt in pattern_types_list:
                pattern_ok = await self._pattern_validator.validate_pattern(
                    pt, execution_trace
                )
                grader_results.append({
                    "grader_name": f"pattern_check_{pt}",
                    "grader_type": "pattern",
                    "passed": pattern_ok,
                    "score": 1.0 if pattern_ok else 0.0,
                    "details": {"pattern_type": pt},
                })

            # Safety grading
            safety_violations, safety_severity = await self._evaluate_safety(
                execution_trace, inputs
            )

            # Weight-aware aggregation
            # Graders with weight=0 are informational only — excluded from pass/fail and score
            active = [r for r in grader_results if r.get("weight", 1.0) > 0]
            passed = all(r.get("passed", False) for r in active) if active else False
            total_weight = sum(r.get("weight", 1.0) for r in active)
            score = (
                sum(r.get("score", 0.0) * r.get("weight", 1.0) for r in active) / total_weight
                if active and total_weight > 0 else 0.0
            )

            # Token usage from trace
            token_usage = execution_trace.get("token_usage")

        except Exception as e:
            logger.error(
                f"Trial task={task_id} trial={config.trial_num} "
                f"perturbation={config.perturbation_type} failed: {e}",
                exc_info=True,
            )
            end_time = milliseconds()
            latency_ms = end_time - start_time
            grader_results = []
            passed = False
            score = 0.0
            token_usage = None
            error_message = str(e)
            action_sequence = []
            confidence = None
            safety_violations = []
            safety_severity = 0.0
        else:
            error_message = None

        # Persist
        evaluation_task_result_repository.create({
            "result_id": result_id,
            "run_id": config.run_id,
            "task_id": task_id,
            "trial_number": config.trial_num,
            "trace_id": trace_id,
            "grader_results": grader_results,
            "passed": 1 if passed else 0,  # SQLite-safe bool
            "score": score,
            "latency_ms": latency_ms,
            "token_usage": token_usage,
            "error_message": error_message,
            "perturbation_type": config.perturbation_type,
            "confidence": confidence,
            "action_sequence": action_sequence,
            "safety_violations": safety_violations,
            "safety_severity": safety_severity,
            "start_time": start_time,
            "end_time": end_time,
            "create_time": milliseconds(),
        })
        logger.info(
            f"Trial task={task_id} trial={config.trial_num} "
            f"perturbation={config.perturbation_type}: passed={passed} score={score:.3f}"
        )

    # ──────────────────────────────────────────────────────────────────────────
    # Execution wrappers (non-invasive)
    # ──────────────────────────────────────────────────────────────────────────

    async def _run_workflow(
        self,
        workflow_id: str,
        version: str,
        ctx: _RunnerContext,
    ) -> Dict[str, Any]:
        """Run a workflow and collect the full trace."""
        from openjiuwen_studio.core.executor.workflow.workflow_runner import WorkflowRunner

        runner = WorkflowRunner()
        return await self._collect_trace(
            runner.run(
                id=workflow_id,
                version=version,
                inputs=ctx.inputs,
                conversation_id=ctx.conversation_id,
                space_id=ctx.space_id,
                current_user=ctx.current_user,
            )
        )

    async def _run_agent(
        self,
        agent_id: str,
        version: str,
        ctx: _RunnerContext,
    ) -> Dict[str, Any]:
        """Run an agent and collect the full trace."""
        from openjiuwen_studio.core.executor.agent.agent_runner import agent_mgr

        # AgentRunner.run() validates that inputs contains conversation_id.
        # Task input_data is a plain dict (e.g. {"query": "..."}), so we inject it here.
        inputs = ctx.inputs
        if isinstance(inputs, dict) and "conversation_id" not in inputs:
            inputs = {**inputs, "conversation_id": ctx.conversation_id}

        runner = agent_mgr
        return await self._collect_trace(
            runner.run(
                id=agent_id,
                version=version,
                inputs=inputs,
                conversation_id=ctx.conversation_id,
                space_id=ctx.space_id,
                current_user=ctx.current_user,
            )
        )

    async def _collect_trace(self, gen) -> Dict[str, Any]:
        """
        Consume an async generator from a runner, collecting every chunk.

        Returns a unified trace dict used by graders and pattern validator.
        """
        chunks: List[Any] = []
        final_output: Any = None
        agent_answer_parts: List[str] = []
        token_usage: Optional[Dict] = None
        trace_id: Optional[str] = None

        async for chunk in gen:
            chunks.append(chunk)

            # Extract common fields from chunk (handles both attrs and dicts)
            chunk_type = (getattr(chunk, "type", None)
                          or (chunk.get("type") if isinstance(chunk, dict) else None))
            payload = (getattr(chunk, "payload", None)
                       or (chunk.get("payload") if isinstance(chunk, dict) else None))

            # Workflow pattern: the last finished component emits type="trace", status="finish"
            # with outputs containing the structured result.
            if chunk_type == "trace" and isinstance(payload, dict) and payload.get("status") == "finish":
                candidate = payload.get("outputs")
                if candidate:
                    final_output = candidate

            # Agent pattern: the answer is streamed token-by-token.
            # Each chunk has payload["result_type"] == "answer" and payload["output"] = partial token.
            # Accumulate all tokens — they are joined after the loop.
            elif isinstance(payload, dict) and payload.get("result_type") == "answer":
                output_text = payload.get("output", "")
                if output_text:
                    agent_answer_parts.append(output_text)

            if not trace_id:
                tid = (getattr(chunk, "trace_id", None)
                       or (chunk.get("trace_id") if isinstance(chunk, dict) else None))
                if tid:
                    trace_id = tid

            # Accumulate token usage from summary chunks
            if chunk_type == "usage" and isinstance(payload, dict):
                token_usage = payload

        # If no structured workflow output was captured, use the accumulated agent answer.
        if final_output is None and agent_answer_parts:
            full_text = "".join(agent_answer_parts).strip()
            if full_text:
                final_output = full_text

        return {
            "chunks": chunks,
            "final_output": final_output,
            "trace_id": trace_id,
            "token_usage": token_usage,
        }

    # ──────────────────────────────────────────────────────────────────────────
    # Reliability extraction helpers
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _extract_action_sequence(execution_trace: Dict[str, Any]) -> List[str]:
        """
        Extract action sequence from execution trace for trajectory consistency.

        Returns list of action identifiers (e.g., tool names, component names).
        """
        action_sequence = []
        chunks = execution_trace.get("chunks", [])

        for chunk in chunks:
            chunk_type = (getattr(chunk, "type", None)
                          or (chunk.get("type") if isinstance(chunk, dict) else None))
            payload = (getattr(chunk, "payload", None)
                       or (chunk.get("payload") if isinstance(chunk, dict) else None))

            # Extract tool calls
            if chunk_type == "tool_call":
                tool_name = payload.get("tool_name") if isinstance(payload, dict) else None
                if tool_name:
                    action_sequence.append(f"tool:{tool_name}")

            # Extract component executions
            elif chunk_type == "component":
                component_name = payload.get("component_name") if isinstance(payload, dict) else None
                if component_name:
                    action_sequence.append(f"component:{component_name}")

            # Extract other actions
            elif chunk_type in ["branch", "loop", "decision"]:
                action_sequence.append(f"control:{chunk_type}")

        return action_sequence

    @staticmethod
    def _extract_confidence(execution_trace: Dict[str, Any]) -> Optional[float]:
        """
        Extract confidence score from execution trace.

        Strategies:
        1. Look for explicit confidence in final_output
        2. Use implicit confidence from trace metadata
        3. Default to None if not available
        """
        final_output = execution_trace.get("final_output")

        # Strategy 1: explicit confidence in output
        if isinstance(final_output, dict):
            if "confidence" in final_output:
                try:
                    return float(final_output["confidence"])
                except (ValueError, TypeError):
                    pass

        # Strategy 2: implicit confidence from trace
        chunks = execution_trace.get("chunks", [])
        for chunk in reversed(chunks):  # Check recent chunks first
            if isinstance(chunk, dict):
                payload = chunk.get("payload", {})
                if isinstance(payload, dict) and "confidence" in payload:
                    try:
                        return float(payload["confidence"])
                    except (ValueError, TypeError):
                        pass

        # Default: None (no confidence available)
        return None

    async def _evaluate_safety(
        self,
        execution_trace: Dict[str, Any],
        inputs: Dict[str, Any]
    ) -> tuple[List[str], float]:
        """
        Evaluate safety constraints on execution trace.

        Returns:
            (violations, max_severity) tuple
        """
        final_output = execution_trace.get("final_output")
        if not final_output:
            return [], 0.0

        # Convert output to string for safety checks
        output_str = str(final_output)

        # Build context for safety grader
        context = {
            "action_sequence": self._extract_action_sequence(execution_trace),
            "input_data": inputs,
        }

        # Run safety grader
        violations, max_severity = await self._safety_grader.evaluate(output_str, context)

        return violations if violations else [], max_severity

    # ──────────────────────────────────────────────────────────────────────────
    # Regression / anomaly detection helpers
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _get_last_completed_run(evaluation_id: str, exclude_run_id: str) -> Optional[Dict[str, Any]]:
        """Return the most recent COMPLETED run for this evaluation (excluding current run)."""
        res = evaluation_run_repository.list_by_evaluation(evaluation_id)
        runs: List[Dict] = res.get("data") or []
        if isinstance(runs, dict):
            runs = runs.get("data") or []

        completed = []
        for r in runs:
            run_id_not_excluded = r.get("run_id") != exclude_run_id
            run_completed = str(r.get("status", "")) == str(EvaluationStatus.COMPLETED.value)
            if run_id_not_excluded and run_completed:
                completed.append(r)

        if not completed:
            return None
        # Sort by create_time descending and return most recent
        completed.sort(key=lambda r: r.get("create_time", 0), reverse=True)
        return completed[0]

    @staticmethod
    def _detect_regressions(
        current: Dict[str, Any],
        previous: Dict[str, Any],
        prev_run_id: str,
    ) -> List[Dict[str, Any]]:
        """Compare current run metrics to a previous run and return any regressions."""
        alerts: List[Dict[str, Any]] = []

        # Success rate: flag if dropped >10 percentage points
        curr_sr = current.get("success_rate")
        prev_sr = previous.get("success_rate")
        if curr_sr is not None and prev_sr is not None:
            delta = curr_sr - prev_sr
            if delta < -0.10:
                alerts.append({
                    "type": "regression",
                    "metric": "success_rate",
                    "severity": "high",
                    "message": (
                        f"Success rate dropped from {prev_sr*100:.0f}% to {curr_sr*100:.0f}% "
                        f"(−{abs(delta)*100:.0f} pp vs previous run)"
                    ),
                    "previous_run_id": prev_run_id,
                    "previous_value": prev_sr,
                    "current_value": curr_sr,
                    "delta": delta,
                })

        # Avg latency: flag if increased >500 ms
        curr_lat = current.get("avg_latency_ms")
        prev_lat = previous.get("avg_latency_ms")
        if curr_lat is not None and prev_lat is not None and prev_lat > 0:
            delta = curr_lat - prev_lat
            if delta > 500:
                alerts.append({
                    "type": "regression",
                    "metric": "avg_latency_ms",
                    "severity": "medium",
                    "message": (
                        f"Avg latency increased by {delta:.0f} ms "
                        f"(from {prev_lat:.0f} ms to {curr_lat:.0f} ms)"
                    ),
                    "previous_run_id": prev_run_id,
                    "previous_value": prev_lat,
                    "current_value": curr_lat,
                    "delta": delta,
                })

        # Avg score: flag if dropped >15 percentage points
        curr_score = current.get("avg_score")
        prev_score = previous.get("avg_score")
        if curr_score is not None and prev_score is not None:
            delta = curr_score - prev_score
            if delta < -0.15:
                alerts.append({
                    "type": "regression",
                    "metric": "avg_score",
                    "severity": "high",
                    "message": (
                        f"Avg score dropped from {prev_score*100:.0f}% to {curr_score*100:.0f}% "
                        f"(−{abs(delta)*100:.0f} pp vs previous run)"
                    ),
                    "previous_run_id": prev_run_id,
                    "previous_value": prev_score,
                    "current_value": curr_score,
                    "delta": delta,
                })

        return alerts
