#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2026. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
"""
Schema definitions for the evaluation persistence layer.
"""
from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import (JSON, BigInteger, Boolean, Float, ForeignKey, Index,
                        Integer, String, Text, UniqueConstraint)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from openjiuwen_studio.models.db_fun_base import Base, DBFunBase
from openjiuwen_studio.ops.config import settings


# ── Column factory helpers ──────────────────────────────────────────────────
# Centralise repetitive mapped_column calls so column definitions read as
# declarative intent rather than repeated keyword arguments.

def _req(length: int, **kw: Any):
    """Required (non-nullable) VARCHAR column."""
    return mapped_column(String(length), nullable=False, **kw)


def _opt(length: int, **kw: Any):
    """Optional (nullable) VARCHAR column."""
    return mapped_column(String(length), nullable=True, default=None, **kw)


# ── Shared record-tracking mixin ────────────────────────────────────────────

class AuditMixin:
    """Adds auto-increment primary key plus create/update timestamps."""
    if settings.DB_TYPE.lower() == "sqlite":
        primary_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, name="id")
    else:
        primary_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True, name="id")

    create_time: Mapped[int] = mapped_column(BigInteger, nullable=False)
    update_time: Mapped[int] = mapped_column(BigInteger, nullable=False)


# ── tbl_evaluation ──────────────────────────────────────────────────────────

class EvaluationDB(Base, DBFunBase, AuditMixin):
    __tablename__ = "evaluation"
    __table_args__ = (
        Index("idx_eval_scope_uid", "space_id"),
        Index("idx_eval_label_uid", "suite_name"),
    )

    space_id: Mapped[str] = _req(100)
    evaluation_id: Mapped[str] = _req(100, unique=True, index=True)
    suite_name: Mapped[str] = _req(255)
    description: Mapped[str | None] = _opt(512)

    # Python attribute 'runtime_params' maps to DB column 'config'
    runtime_params: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=None, name="config")

    tasks: Mapped[list["EvaluationTaskDB"]] = relationship(
        "EvaluationTaskDB", back_populates="owner_eval", cascade="all, delete-orphan", passive_deletes=True
    )
    runs: Mapped[list["EvaluationRunDB"]] = relationship(
        "EvaluationRunDB", back_populates="owner_eval", cascade="all, delete-orphan", passive_deletes=True
    )


# ── tbl_evaluation_task ─────────────────────────────────────────────────────

class EvaluationTaskDB(Base, DBFunBase, AuditMixin):
    __tablename__ = "evaluation_task"
    __table_args__ = (
        Index("idx_task_parent_uid", "evaluation_id"),
        Index("idx_task_alias_uid", "task_name"),
        UniqueConstraint("task_id", "evaluation_id", name="uq_eval_task_v6"),
        {"extend_existing": True}
    )

    evaluation_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("evaluation.evaluation_id", ondelete="CASCADE"), nullable=False
    )
    task_id: Mapped[str] = _req(100)
    task_name: Mapped[str] = _req(255)
    trials: Mapped[int] = mapped_column(Integer, default=1)
    task_definition: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[str | None] = _opt(50)
    description: Mapped[str | None] = _opt(512)

    graders_config: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    input_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    expected_output: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    tags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    pattern_type: Mapped[str | None] = _opt(50)
    pattern_types: Mapped[list | None] = mapped_column(JSON, nullable=True)

    owner_eval: Mapped["EvaluationDB"] = relationship("EvaluationDB", back_populates="tasks")


# ── tbl_evaluation_run ──────────────────────────────────────────────────────

class EvaluationRunDB(Base, DBFunBase, AuditMixin):
    __tablename__ = "evaluation_run"
    __table_args__ = (
        Index("idx_run_eval_link", "evaluation_id"),
        Index("idx_run_wf_link", "workflow_id"),
        Index("idx_run_ag_link", "agent_id"),
        Index("idx_run_state_link", "status"),
        {"extend_existing": True}
    )

    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    workflow_id: Mapped[str | None] = _opt(100)

    evaluation_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("evaluation.evaluation_id", ondelete="CASCADE"), nullable=False
    )

    status: Mapped[str] = _req(50)
    run_id: Mapped[str] = _req(100, unique=True, index=True)

    # Execution target — workflow or agent, mutually optional
    workflow_version: Mapped[Optional[str]] = _opt(100)
    agent_id: Mapped[Optional[str]] = _opt(100)
    agent_version: Mapped[Optional[str]] = _opt(100)

    start_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    end_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    owner_eval: Mapped["EvaluationDB"] = relationship("EvaluationDB", back_populates="runs")
    task_results: Mapped[list["EvaluationTaskResultDB"]] = relationship(
        "EvaluationTaskResultDB", back_populates="run_handle", cascade="all, delete-orphan", passive_deletes=True
    )


# ── tbl_evaluation_task_result ──────────────────────────────────────────────

class EvaluationTaskResultDB(Base, DBFunBase):
    __tablename__ = "evaluation_task_result"
    __table_args__ = (
        Index("idx_res_exec_run", "run_id"),
        Index("idx_res_exec_task", "task_id"),
        UniqueConstraint("run_id", "task_id", "trial_number", "perturbation_type", name="uq_res_v6_final"),
        {"extend_existing": True}
    )

    if settings.DB_TYPE.lower() == "sqlite":
        primary_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, name="id")
        passed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    else:
        primary_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True, name="id")
        passed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    trial_number: Mapped[int] = mapped_column(Integer, nullable=False)
    run_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("evaluation_run.run_id", ondelete="CASCADE"), nullable=False
    )
    result_id: Mapped[str] = _req(100, unique=True)
    task_id: Mapped[str] = _req(100)

    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    trace_id: Mapped[str | None] = _opt(100)

    # Python 'evaluator_output' maps to DB column 'grader_results'
    evaluator_output: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True, name="grader_results")

    token_usage: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    perturbation_type: Mapped[str | None] = _opt(50)

    # Python 'reliability_score' maps to DB column 'confidence'
    reliability_score: Mapped[float | None] = mapped_column(Float, nullable=True, name="confidence")

    safety_severity: Mapped[float | None] = mapped_column(Float, nullable=True)
    action_sequence: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    safety_violations: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    start_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    end_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    create_time: Mapped[int] = mapped_column(BigInteger, nullable=False)

    run_handle: Mapped["EvaluationRunDB"] = relationship("EvaluationRunDB", back_populates="task_results")


# ── tbl_grader ──────────────────────────────────────────────────────────────

class GraderDB(Base, DBFunBase, AuditMixin):
    __tablename__ = "grader"
    __table_args__ = (
        Index("idx_grader_space_loc", "space_id"),
        Index("idx_grader_kind_loc", "grader_type"),
    )

    grader_id: Mapped[str] = _req(100, unique=True, index=True)
    grader_name: Mapped[str] = _req(255)
    grader_type: Mapped[str] = _req(50)
    space_id: Mapped[str] = _req(100)
    description: Mapped[Optional[str]] = _opt(512)

    # Python 'spec_config' maps to DB column 'config'
    spec_config: Mapped[dict] = mapped_column(JSON, nullable=False, name="config")

    def __repr__(self) -> str:
        return f"<Grader(id='{self.grader_id}', name='{self.grader_name}')>"
