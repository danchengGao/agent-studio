from __future__ import annotations

from typing import Any, Dict, Optional

from sqlalchemy import BigInteger, Boolean, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from openjiuwen_studio.models.db_fun_base import Base, DBFunBase
from openjiuwen_studio.ops.config import settings


class TriggerDB(Base, DBFunBase):
    """
    One row per trigger definition.
    Type-specific config lives in the JSON `config` column to avoid sparse columns.
    """
    __tablename__ = "trigger"
    __table_args__ = (
        Index("idx_trigger_space_type", "space_id", "trigger_type"),
        Index("idx_trigger_target", "target_type", "target_id"),
        # webhook_token uniqueness is enforced at the DB level
        # (application also checks before insert)
    )

    if settings.DB_TYPE.lower() == "sqlite":
        id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    else:
        id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # Tenancy
    space_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    create_user: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    update_user: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Stable string identifier (UUID v4, 36 chars) — used in all foreign references
    trigger_id: Mapped[str] = mapped_column(
        String(36), nullable=False, unique=True, index=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)

    # "cron" | "webhook" | "polling"
    trigger_type: Mapped[str] = mapped_column(String(32), nullable=False)

    # "agent" | "workflow"
    target_type: Mapped[str] = mapped_column(String(32), nullable=False)
    target_id: Mapped[str] = mapped_column(String(64), nullable=False)
    # "draft" by default; can be set to a published version string e.g. "1.0.0"
    target_version: Mapped[str] = mapped_column(String(64), nullable=False, default="draft")

    # Fixed key/value inputs forwarded to run() on every fire
    input_payload: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Type-specific config blob:
    #   Cron:    {"cron_expr": "0 9 * * 1"}
    #   Webhook: {"webhook_secret": "hex-or-null"}
    #   Polling: {"poll_url": "https://...", "poll_interval_seconds": 300,
    #             "last_seen_hash": "sha256hex", "last_checked_at": 1700000000000}
    config: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Secret token embedded in inbound webhook URL — NULL for non-webhook triggers
    webhook_token: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, unique=True, index=True
    )

    # APScheduler job ID — stored so CRUD can call scheduler.remove_job() directly
    scheduler_job_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Milliseconds since epoch — matches every other model in the codebase
    create_time: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    update_time: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)



class TriggerExecutionLogDB(Base, DBFunBase):
    """
    One row per trigger fire attempt. Append-only after the final status write.
    Linked to existing trace infrastructure via trace_id.
    """
    __tablename__ = "trigger_execution_log"
    __table_args__ = (
        Index("idx_tel_trigger_time", "trigger_id", "started_at"),
        Index("idx_tel_trace", "trace_id"),
        Index("idx_tel_space", "space_id"),
    )

    # ── Primary key: BigInteger for production, Integer for SQLite dev ──────────
    if settings.DB_TYPE.lower() == "sqlite":
        id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    else:
        id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # ── Tenant + trigger identity ────────────────────────────────────────────────
    # space_id scopes every log row to its owning workspace (max 64 chars)
    space_id: Mapped[str] = mapped_column(String(64), nullable=False)
    # trigger_id references TriggerDB.trigger_id — UUID v4, always 36 chars
    trigger_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)

    # Cross-reference to AgentExecutionDB.trace_id / WorkflowExecutionDB.trace_id
    # Allows deep-linking from trigger log into the existing execution trace viewer
    trace_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    conversation_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    # "running" | "success" | "error" | "skipped"
    # "skipped" = polling job ran but content was unchanged
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="running")

    # "scheduler" | "webhook" | "poll" | "manual"
    fired_by: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    trigger_type: Mapped[str] = mapped_column(String(32), nullable=False)

    started_at: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    finished_at: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Snapshot of inputs at time of fire (input_payload + any injected context)
    inputs_snapshot: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    # Last output captured from the async generator
    outputs: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Polling only: the content hash that triggered this fire
    poll_hash_seen: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    create_time: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    update_time: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)

