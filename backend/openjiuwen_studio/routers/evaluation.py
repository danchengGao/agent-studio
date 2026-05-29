#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
"""
Evaluation system API router.

Endpoints:
  POST /create               — create evaluation suite
  POST /task/add             — add task to suite
  PUT  /task/update          — update existing task
  GET  /task/list            — list tasks for a suite
  DELETE /task/delete        — remove a task
  DELETE /{evaluation_id}    — delete suite
  GET  /list                 — list suites for a space
  GET  /{evaluation_id}      — get suite
  POST /run/start            — start a run
  GET  /run/{run_id}         — get run status
  GET  /run/{run_id}/explain — natural-language insights for a completed run
  GET  /run/list             — list runs for a suite
  GET  /results/{run_id}     — get results + metrics
  GET  /benchmarks/list      — list pre-built benchmark YAMLs
  POST /benchmarks/import    — import a benchmark YAML as a suite
  POST /grader/create        — create reusable grader
  GET  /grader/list          — list graders
  GET  /docs/{filename}      — serve markdown docs (single source from docs/)

NOTE: Routes with path parameters (/{evaluation_id}, /run/{run_id}) must be
registered AFTER all specific static-path routes to avoid shadowing them.
"""
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, ValidationError

from openjiuwen.core.common.logging import logger
from openjiuwen_studio.core.manager.login_manager.user import get_current_user
from openjiuwen_studio.routers.common import handle_response
from openjiuwen_studio.schemas.common import ResponseModel
from openjiuwen_studio.schemas.evaluation import (
    EvaluationCreate,
    EvaluationUpdate,
    EvaluationRunRequest,
    EvaluationTaskCreate,
    GraderCreate,
)
import openjiuwen_studio.core.manager.evaluation as mgr

evaluation_router = APIRouter()


class BenchmarkImportRequest(BaseModel):
    """Request body for importing a benchmark YAML."""
    file_name: str
    space_id: str
    suite_name: Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────────
# Evaluation suite — collection endpoints (no path params) come first
# ──────────────────────────────────────────────────────────────────────────────

@evaluation_router.post("/create", response_model=ResponseModel)
async def evaluation_create(
    request: EvaluationCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new evaluation suite."""
    try:
        res = mgr.evaluation_create(request, current_user)
        return handle_response(ResponseModel(**res))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@evaluation_router.get("/list", response_model=ResponseModel)
async def evaluation_list(
    space_id: str,
    page: int = 1,
    size: int = 20,
    current_user: dict = Depends(get_current_user),
):
    """List evaluation suites for a space."""
    res = mgr.evaluation_list(space_id, page, size, current_user)
    return handle_response(ResponseModel(**res))


@evaluation_router.put("/update", response_model=ResponseModel)
async def evaluation_update(
    request: EvaluationUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update evaluation suite name and/or description."""
    res = mgr.evaluation_update(request, current_user)
    return handle_response(ResponseModel(**res))


# ──────────────────────────────────────────────────────────────────────────────
# Tasks
# ──────────────────────────────────────────────────────────────────────────────

@evaluation_router.post("/task/add", response_model=ResponseModel)
async def evaluation_add_task(
    request: EvaluationTaskCreate,
    current_user: dict = Depends(get_current_user),
):
    """Add a task to an evaluation suite."""
    try:
        res = mgr.evaluation_add_task(request, current_user)
        return handle_response(ResponseModel(**res))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@evaluation_router.put("/task/update", response_model=ResponseModel)
async def evaluation_update_task(
    request: EvaluationTaskCreate,
    current_user: dict = Depends(get_current_user),
):
    """Update an existing task in an evaluation suite."""
    try:
        res = mgr.evaluation_update_task(request, current_user)
        return handle_response(ResponseModel(**res))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@evaluation_router.get("/task/list", response_model=ResponseModel)
async def evaluation_list_tasks(
    evaluation_id: str,
    space_id: str,
    current_user: dict = Depends(get_current_user),
):
    """List tasks for an evaluation suite."""
    res = mgr.evaluation_list_tasks(evaluation_id, space_id, current_user)
    return handle_response(ResponseModel(**res))


@evaluation_router.delete("/task/delete", response_model=ResponseModel)
async def evaluation_delete_task(
    evaluation_id: str,
    task_id: str,
    space_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a task from a suite."""
    res = mgr.evaluation_delete_task(evaluation_id, task_id, space_id, current_user)
    return handle_response(ResponseModel(**res))


# ──────────────────────────────────────────────────────────────────────────────
# Benchmark suite operations
# ──────────────────────────────────────────────────────────────────────────────

@evaluation_router.get("/benchmarks/list", response_model=ResponseModel)
async def benchmark_list(
    current_user: dict = Depends(get_current_user),
):
    """List pre-built benchmark YAML files available for import."""
    res = mgr.evaluation_list_benchmarks()
    return handle_response(ResponseModel(**res))


@evaluation_router.post("/benchmarks/import", response_model=ResponseModel)
async def benchmark_import(
    request: BenchmarkImportRequest,
    current_user: dict = Depends(get_current_user),
):
    """Import a pre-built benchmark YAML as a new evaluation suite."""
    res = mgr.evaluation_import_benchmark(
        file_name=request.file_name,
        space_id=request.space_id,
        suite_name_override=request.suite_name,
        current_user=current_user,
    )
    return handle_response(ResponseModel(**res))


# ──────────────────────────────────────────────────────────────────────────────
# Runs — static paths before /run/{run_id}
# ──────────────────────────────────────────────────────────────────────────────

@evaluation_router.post("/run/start", response_model=ResponseModel)
async def evaluation_run_start(
    request: EvaluationRunRequest,
    current_user: dict = Depends(get_current_user),
):
    """Start an evaluation run (returns immediately; runs in background)."""
    try:
        res = mgr.evaluation_run_start(request, current_user)
        return handle_response(ResponseModel(**res))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@evaluation_router.get("/run/list", response_model=ResponseModel)
async def evaluation_run_list(
    evaluation_id: str,
    space_id: str,
    current_user: dict = Depends(get_current_user),
):
    """List runs for an evaluation suite."""
    res = mgr.evaluation_run_list(evaluation_id, space_id, current_user)
    return handle_response(ResponseModel(**res))


@evaluation_router.delete("/run/delete", response_model=ResponseModel)
async def evaluation_run_delete(
    run_id: str,
    space_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a run and its results."""
    res = mgr.evaluation_run_delete(run_id, space_id, current_user)
    return handle_response(ResponseModel(**res))


@evaluation_router.get("/run/{run_id}/explain", response_model=ResponseModel)
async def evaluation_run_explain(
    run_id: str,
    space_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Generate natural-language insights for a completed run."""
    res = mgr.evaluation_explain(run_id, space_id, current_user)
    return handle_response(ResponseModel(**res))


@evaluation_router.get("/run/{run_id}", response_model=ResponseModel)
async def evaluation_run_get(
    run_id: str,
    space_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get run status."""
    res = mgr.evaluation_run_get(run_id, space_id, current_user)
    return handle_response(ResponseModel(**res))


# ──────────────────────────────────────────────────────────────────────────────
# Results
# ──────────────────────────────────────────────────────────────────────────────

@evaluation_router.get("/results/{run_id}", response_model=ResponseModel)
async def evaluation_results_get(
    run_id: str,
    space_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get results and metrics for a completed run."""
    res = mgr.evaluation_results_get(run_id, space_id, current_user)
    return handle_response(ResponseModel(**res))


# ──────────────────────────────────────────────────────────────────────────────
# Graders
# ──────────────────────────────────────────────────────────────────────────────

@evaluation_router.post("/grader/create", response_model=ResponseModel)
async def grader_create(
    request: GraderCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a reusable grader definition."""
    try:
        res = mgr.grader_create(request, current_user)
        return handle_response(ResponseModel(**res))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@evaluation_router.get("/grader/list", response_model=ResponseModel)
async def grader_list(
    space_id: str,
    current_user: dict = Depends(get_current_user),
):
    """List graders for a space."""
    res = mgr.grader_list(space_id, current_user)
    return handle_response(ResponseModel(**res))


class GraderGenerateRequest(BaseModel):
    """Request body for AI-assisted grader generation."""
    description: str
    space_id: str
    model_id: Optional[int] = None


@evaluation_router.post("/grader/generate", response_model=ResponseModel)
async def grader_generate(
    request: GraderGenerateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Generate a grader config from a natural-language description using an LLM."""
    res = await mgr.grader_generate(request.description, request.space_id, request.model_id, current_user)
    return handle_response(ResponseModel(**res))


# ──────────────────────────────────────────────────────────────────────────────
# Documentation serving — single source of truth from docs/
# ──────────────────────────────────────────────────────────────────────────────

_EVAL_DOCS_DIR = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "docs" / "en" / "4.Development Guide" / "Evaluation Agent and Workflow"
)

_ALLOWED_DOC_FILES = {
    "01_Overview.md",
    "02_Getting_Started.md",
    "03_User_Guide.md",
    "04_Reference.md",
    "07_Cookbook.md",
    "08_Troubleshooting.md",
    "09_Glossary.md",
    "10_Import_Guide.md",
}


@evaluation_router.get("/docs/{filename}", response_class=PlainTextResponse)
async def get_eval_doc(
    filename: str,
    current_user: dict = Depends(get_current_user),
):
    """Serve a markdown documentation file for the in-app help modal."""
    if filename not in _ALLOWED_DOC_FILES:
        raise HTTPException(status_code=404, detail=f"Doc '{filename}' not found")
    doc_path = _EVAL_DOCS_DIR / filename
    if not doc_path.exists():
        raise HTTPException(status_code=404, detail=f"File '{filename}' missing on disk")
    return PlainTextResponse(doc_path.read_text(encoding="utf-8"))


# ──────────────────────────────────────────────────────────────────────────────
# Evaluation suite — parameterized routes LAST to avoid shadowing static paths
# ──────────────────────────────────────────────────────────────────────────────

@evaluation_router.get("/{evaluation_id}", response_model=ResponseModel)
async def evaluation_get(
    evaluation_id: str,
    space_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get evaluation suite details."""
    res = mgr.evaluation_get(evaluation_id, space_id, current_user)
    return handle_response(ResponseModel(**res))


@evaluation_router.delete("/{evaluation_id}", response_model=ResponseModel)
async def evaluation_delete(
    evaluation_id: str,
    space_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete an evaluation suite."""
    res = mgr.evaluation_delete(evaluation_id, space_id, current_user)
    return handle_response(ResponseModel(**res))
