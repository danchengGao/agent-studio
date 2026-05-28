#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
"""
Evaluation system Pydantic schemas.

Provides:
- Enums: EvaluationStatus, GraderType, PatternType, TaskDifficulty
- Request models: EvaluationCreate, EvaluationRunRequest, etc.
- Response models: EvaluationRunResponse, EvaluationResultsResponse, etc.
- Grader configuration models
"""
from enum import IntEnum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ==================== Enums ====================

class EvaluationStatus(IntEnum):
    """Evaluation run status."""
    PENDING = 0
    RUNNING = 1
    COMPLETED = 2
    FAILED = 3
    CANCELLED = 4


class GraderType(IntEnum):
    """Grader type enumeration."""
    DETERMINISTIC = 0  # State checks, tool-call validation, output matching
    MODEL_BASED = 1    # LLM-based scoring, rubrics, assertions
    CODE_BASED = 2     # Custom Python functions


class PatternType(IntEnum):
    """Workflow pattern types for validation."""
    ROUTING = 0           # IF component usage
    CHAINING = 1          # Sequential component execution
    PARALLELIZATION = 2   # Multiple parallel branches
    ORCHESTRATOR_WORKER = 3  # SubWorkflow delegation
    EVALUATOR_OPTIMIZER = 4  # Loop with improvement
    MEMORY_USAGE = 5      # Memory/state management
    CUSTOM = 99


class TaskDifficulty(IntEnum):
    """Task difficulty levels."""
    EASY = 0
    MEDIUM = 1
    HARD = 2


# ==================== Base Models ====================

class EvaluationId(BaseModel):
    """Evaluation identifier."""
    evaluation_id: str = Field(..., min_length=1, description="Evaluation suite ID")
    space_id: str = Field(..., min_length=1, description="Space ID")


class TaskId(BaseModel):
    """Task identifier."""
    task_id: str = Field(..., min_length=1, description="Task ID")
    evaluation_id: str = Field(..., min_length=1, description="Evaluation suite ID")


class RunId(BaseModel):
    """Run identifier."""
    run_id: str = Field(..., min_length=1, description="Evaluation run ID")
    space_id: str = Field(..., min_length=1, description="Space ID")


# ==================== Evaluation Suite Models ====================

class EvaluationCreate(BaseModel):
    """Create new evaluation suite."""
    suite_name: str = Field(..., min_length=1, max_length=255, description="Suite name")
    description: Optional[str] = Field(None, max_length=512, description="Suite description")
    space_id: str = Field(..., min_length=1, description="Space ID")
    config: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Suite configuration")


class CustomMetricDef(BaseModel):
    """Definition of a user-supplied custom aggregate metric."""
    name: str = Field(..., min_length=1, max_length=100, description="Metric identifier (valid Python identifier)")
    description: Optional[str] = Field(None, max_length=512, description="Human-readable description")
    code: str = Field(..., min_length=1, description="Python code defining  def compute(results): -> float | dict")


class EvaluationUpdate(BaseModel):
    """Update evaluation suite name/description/config."""
    evaluation_id: str = Field(..., description="Evaluation suite ID")
    space_id: str = Field(..., description="Space ID")
    suite_name: Optional[str] = Field(None, min_length=1, max_length=255, description="New suite name")
    description: Optional[str] = Field(None, max_length=512, description="New description")
    config: Optional[Dict[str, Any]] = Field(None, description="Suite configuration (replaces existing config)")


class EvaluationInfo(BaseModel):
    """Evaluation suite information."""
    evaluation_id: str = Field(..., description="Evaluation suite ID")
    suite_name: str = Field(..., description="Suite name")
    description: Optional[str] = Field(None, description="Suite description")
    space_id: str = Field(..., description="Space ID")
    config: Optional[Dict[str, Any]] = Field(None, description="Suite configuration")
    create_time: int = Field(..., description="Creation timestamp")
    update_time: int = Field(..., description="Update timestamp")


class EvaluationList(BaseModel):
    """List evaluations request."""
    space_id: str = Field(..., min_length=1, description="Space ID")
    skip: int = Field(default=0, ge=0, description="Number of records to skip")
    limit: int = Field(default=100, ge=1, le=1000, description="Number of records to return")


class EvaluationListResponse(BaseModel):
    """List evaluations response."""
    evaluations: List[EvaluationInfo] = Field(..., description="List of evaluations")
    total: int = Field(..., description="Total number of evaluations")


# ==================== Task Models ====================

class EvaluationTaskDefinition(BaseModel):
    """Task definition in YAML/JSON format."""
    task_id: str = Field(..., min_length=1, description="Task ID")
    task_name: str = Field(..., min_length=1, description="Task name")
    description: Optional[str] = Field(None, description="Task description")
    tags: Optional[List[str]] = Field(default_factory=list, description="Task tags")
    difficulty: Optional[TaskDifficulty] = Field(None, description="Task difficulty")
    pattern_type: Optional[PatternType] = Field(None, description="Expected workflow pattern (legacy single value)")
    pattern_types: Optional[List[str]] = Field(None, description="Array of pattern checks")

    # Input configuration
    input: Dict[str, Any] = Field(..., description="Input data for the task")
    initial_state: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Initial workflow state")

    # Expected outcome
    expected_outcome: Optional[Dict[str, Any]] = Field(None, description="Expected output")
    pattern: Optional[str] = Field(None, description="Expected workflow pattern string")

    # Graders configuration
    graders: List[Dict[str, Any]] = Field(default_factory=list, description="List of graders")

    # Execution configuration
    trials: int = Field(default=1, ge=1, le=100, description="Number of trials to run")
    timeout_seconds: Optional[int] = Field(default=300, description="Timeout in seconds")


class EvaluationTaskCreate(BaseModel):
    """Add task to evaluation suite."""
    evaluation_id: str = Field(..., min_length=1, description="Evaluation suite ID")
    task: EvaluationTaskDefinition = Field(..., description="Task definition")


class EvaluationTaskInfo(BaseModel):
    """Task information."""
    task_id: str = Field(..., description="Task ID")
    evaluation_id: str = Field(..., description="Evaluation suite ID")
    task_name: str = Field(..., description="Task name")
    description: Optional[str] = Field(None, description="Task description")
    tags: Optional[List[str]] = Field(None, description="Task tags")
    difficulty: Optional[str] = Field(None, description="Task difficulty")
    pattern_type: Optional[str] = Field(None, description="Expected pattern type (legacy)")
    pattern_types: Optional[List[str]] = Field(None, description="Array of pattern checks")
    trials: int = Field(..., description="Number of trials")
    create_time: int = Field(..., description="Creation timestamp")


# ==================== Grader Configuration Models ====================

class GraderConfig(BaseModel):
    """Grader configuration."""
    grader_id: Optional[str] = Field(None, description="Reference to saved grader")
    grader_type: GraderType = Field(..., description="Grader type")
    name: str = Field(..., min_length=1, description="Grader name")
    config: Dict[str, Any] = Field(..., description="Grader configuration")
    weight: float = Field(default=1.0, ge=0.0, le=1.0, description="Grader weight")


class DeterministicGraderConfig(BaseModel):
    """Configuration for deterministic graders."""
    check_type: str = Field(..., description="Check type: state_check, tool_call_check, output_check, pattern_check")
    expected_value: Any = Field(None, description="Expected value")
    path: Optional[str] = Field(None, description="JSON path for nested checks")
    condition: Optional[str] = Field(None, description="Condition: eq, ne, gt, lt, contains, regex")
    expected_tools: Optional[List[str]] = Field(None, description="Expected tools for tool_call_check")
    pattern: Optional[str] = Field(None, description="Regex pattern for pattern_check")


class ModelBasedGraderConfig(BaseModel):
    """Configuration for model-based graders."""
    model_id: str = Field(..., description="LLM model to use for grading")
    rubric: Optional[str] = Field(None, description="Scoring rubric")
    assertions: Optional[List[str]] = Field(None, description="Natural language assertions")
    comparison_type: Optional[str] = Field(None, description="Comparison type: pairwise, absolute")
    prompt_template: Optional[str] = Field(None, description="Custom prompt template")


class CodeBasedGraderConfig(BaseModel):
    """Configuration for code-based graders."""
    code: str = Field(..., description="Python code for grading function")
    function_name: str = Field(default="grade", description="Function name to call")
    dependencies: Optional[List[str]] = Field(default_factory=list, description="Required Python packages")


# ==================== Evaluation Run Models ====================

class EvaluationRunRequest(BaseModel):
    """Start an evaluation run."""
    evaluation_id: str = Field(..., min_length=1, description="Evaluation suite ID")
    space_id: str = Field(..., min_length=1, description="Space ID")

    # Target to evaluate
    workflow_id: Optional[str] = Field(None, description="Workflow ID to evaluate")
    workflow_version: Optional[str] = Field(None, description="Workflow version")
    workflow_name: Optional[str] = Field(None, description="Workflow display name (for UI)")
    agent_id: Optional[str] = Field(None, description="Agent ID to evaluate")
    agent_version: Optional[str] = Field(None, description="Agent version")
    agent_name: Optional[str] = Field(None, description="Agent display name (for UI)")

    # Run configuration
    task_ids: Optional[List[str]] = Field(None, description="Specific tasks to run (if None, run all)")
    parallel: bool = Field(default=False, description="Run tasks in parallel")
    max_workers: int = Field(default=5, ge=1, le=20, description="Max parallel workers")

    # Reliability evaluation configuration
    enable_perturbations: bool = Field(default=False, description="Enable reliability perturbations "
                                                                  "(prompt, env, fault)")
    perturbation_model_id: Optional[str] = Field(None, description="Model ID for LLM-based prompt paraphrasing")
    fault_probability: float = Field(default=0.2, ge=0.0, le=1.0, description="Probability of fault injection "
                                                                              "per trial")


class EvaluationRunResponse(BaseModel):
    """Evaluation run response."""
    run_id: str = Field(..., description="Run ID")
    evaluation_id: str = Field(..., description="Evaluation suite ID")
    status: str = Field(..., description="Run status")
    workflow_id: Optional[str] = Field(None, description="Workflow ID")
    agent_id: Optional[str] = Field(None, description="Agent ID")
    metrics: Optional[Dict[str, Any]] = Field(None, description="Aggregate metrics")
    start_time: Optional[int] = Field(None, description="Start timestamp")
    end_time: Optional[int] = Field(None, description="End timestamp")


class EvaluationRunInfo(BaseModel):
    """Evaluation run information."""
    run_id: str = Field(..., description="Run ID")
    evaluation_id: str = Field(..., description="Evaluation suite ID")
    workflow_id: Optional[str] = Field(None, description="Workflow ID")
    workflow_version: Optional[str] = Field(None, description="Workflow version")
    agent_id: Optional[str] = Field(None, description="Agent ID")
    agent_version: Optional[str] = Field(None, description="Agent version")
    status: str = Field(..., description="Run status")
    start_time: Optional[int] = Field(None, description="Start timestamp")
    end_time: Optional[int] = Field(None, description="End timestamp")
    create_time: int = Field(..., description="Creation timestamp")


# ==================== Results Models ====================

class TaskResultDetail(BaseModel):
    """Detailed task result."""
    result_id: str = Field(..., description="Result ID")
    task_id: str = Field(..., description="Task ID")
    task_name: str = Field(..., description="Task name")
    trial_number: int = Field(..., description="Trial number")
    passed: Optional[bool] = Field(None, description="Whether task passed")
    score: Optional[float] = Field(None, description="Task score (0.0-1.0)")

    grader_results: List[Dict[str, Any]] = Field(default_factory=list, description="Grader results")

    latency_ms: Optional[int] = Field(None, description="Execution latency in milliseconds")
    token_usage: Optional[Dict[str, int]] = Field(None, description="Token usage statistics")
    error_message: Optional[str] = Field(None, description="Error message if failed")

    # Reliability fields
    perturbation_type: Optional[str] = Field("nominal", description="Perturbation type: nominal, prompt_perturbed, "
                                                                    "env_perturbed, fault_injected")
    confidence: Optional[float] = Field(None, description="Agent's confidence score (0.0-1.0)")
    action_sequence: Optional[List[str]] = Field(None, description="Sequence of actions/tool calls")
    safety_violations: Optional[List[str]] = Field(None, description="List of safety constraint violations")
    safety_severity: Optional[float] = Field(None, description="Max severity weight (0.25=low, 0.5=medium, 1.0=high)")

    trace_id: Optional[str] = Field(None, description="Link to execution trace")
    start_time: Optional[int] = Field(None, description="Start timestamp")
    end_time: Optional[int] = Field(None, description="End timestamp")


class EvaluationResultsResponse(BaseModel):
    """Evaluation results summary."""
    run_id: str = Field(..., description="Run ID")
    evaluation_id: str = Field(..., description="Evaluation suite ID")
    status: str = Field(..., description="Run status")

    # Aggregate metrics
    total_tasks: int = Field(..., description="Total number of tasks")
    passed_tasks: int = Field(..., description="Number of passed tasks")
    failed_tasks: int = Field(..., description="Number of failed tasks")
    success_rate: float = Field(..., description="Success rate (0.0-1.0)")

    # Advanced metrics
    pass_at_k: Optional[Dict[int, float]] = Field(None, description="pass@k for different k values")
    pass_pow_k: Optional[Dict[int, float]] = Field(None, description="pass^k for different k values")

    # Per-task results
    task_results: List[TaskResultDetail] = Field(default_factory=list, description="Per-task results")

    # Execution statistics
    total_latency_ms: int = Field(..., description="Total latency in milliseconds")
    avg_latency_ms: float = Field(..., description="Average latency in milliseconds")
    total_tokens: Optional[Dict[str, int]] = Field(None, description="Total token usage")


class TaskResultList(BaseModel):
    """List task results request."""
    run_id: str = Field(..., min_length=1, description="Run ID")
    skip: int = Field(default=0, ge=0, description="Number of records to skip")
    limit: int = Field(default=100, ge=1, le=1000, description="Number of records to return")


# ==================== Grader Models ====================

class GraderCreate(BaseModel):
    """Create reusable grader."""
    grader_name: str = Field(..., min_length=1, max_length=255, description="Grader name")
    description: Optional[str] = Field(None, max_length=512, description="Grader description")
    space_id: str = Field(..., min_length=1, description="Space ID")
    grader_type: str = Field(..., description="Grader type")
    config: Dict[str, Any] = Field(..., description="Grader configuration")


class GraderInfo(BaseModel):
    """Grader information."""
    grader_id: str = Field(..., description="Grader ID")
    grader_name: str = Field(..., description="Grader name")
    description: Optional[str] = Field(None, description="Grader description")
    space_id: str = Field(..., description="Space ID")
    grader_type: str = Field(..., description="Grader type")
    config: Dict[str, Any] = Field(..., description="Grader configuration")
    create_time: int = Field(..., description="Creation timestamp")
    update_time: int = Field(..., description="Update timestamp")


class GraderIdRequest(BaseModel):
    """Grader identifier request."""
    grader_id: str = Field(..., min_length=1, description="Grader ID")
    space_id: str = Field(..., min_length=1, description="Space ID")
