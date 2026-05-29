"""add_evaluation_tables_v0.1.4_20260314

Revision ID: b9d4e7c2f1a6
Revises: 13377a900fe2
Create Date: 2026-03-14 00:00:00.000000

Creates 5 tables for the evaluation/benchmarking system:
  - evaluation         (evaluation suites)
  - evaluation_task    (task definitions)
  - evaluation_run     (run instances)
  - evaluation_task_result  (per-trial results)
  - grader             (reusable grader definitions)
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from openjiuwen_studio.core.database.migration_utils import (
    column_exists,
    index_exists,
    table_exists,
)

# revision identifiers, used by Alembic.
revision: str = 'b9d4e7c2f1a6'
down_revision: Union[str, Sequence[str], None] = '13377a900fe2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema — create evaluation tables (MySQL/BigInteger variant)."""

    # ──────────────────────────────────────────────────────────────────────────
    # evaluation
    # ──────────────────────────────────────────────────────────────────────────
    if not table_exists('evaluation'):
        op.create_table(
            'evaluation',
            sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
            sa.Column('evaluation_id', sa.String(length=100), nullable=False),
            sa.Column('suite_name', sa.String(length=255), nullable=False),
            sa.Column('description', sa.String(length=512), nullable=True),
            sa.Column('space_id', sa.String(length=100), nullable=False),
            sa.Column('config', sa.JSON(), nullable=True),
            sa.Column('create_time', sa.BigInteger(), nullable=False),
            sa.Column('update_time', sa.BigInteger(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('evaluation_id', name='uq_evaluation_id'),
        )
    with op.batch_alter_table('evaluation', schema=None) as batch_op:
        if not index_exists('evaluation', 'idx_evaluation_space_id'):
            batch_op.create_index('idx_evaluation_space_id', ['space_id'], unique=False)
        if not index_exists('evaluation', 'idx_evaluation_suite_name'):
            batch_op.create_index('idx_evaluation_suite_name', ['suite_name'], unique=False)
        if not index_exists('evaluation', 'ix_evaluation_evaluation_id'):
            batch_op.create_index('ix_evaluation_evaluation_id', ['evaluation_id'], unique=True)

    # ──────────────────────────────────────────────────────────────────────────
    # evaluation_task
    # ──────────────────────────────────────────────────────────────────────────
    if not table_exists('evaluation_task'):
        op.create_table(
            'evaluation_task',
            sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
            sa.Column('task_id', sa.String(length=100), nullable=False),
            sa.Column('evaluation_id', sa.String(length=100), nullable=False),
            sa.Column('task_name', sa.String(length=255), nullable=False),
            sa.Column('description', sa.String(length=512), nullable=True),
            sa.Column('task_definition', sa.Text(), nullable=False),
            sa.Column('input_data', sa.JSON(), nullable=True),
            sa.Column('expected_output', sa.JSON(), nullable=True),
            sa.Column('graders_config', sa.JSON(), nullable=True),
            sa.Column('tags', sa.JSON(), nullable=True),
            sa.Column('difficulty', sa.String(length=50), nullable=True),
            sa.Column('pattern_type', sa.String(length=50), nullable=True),
            sa.Column('trials', sa.Integer(), nullable=True),
            sa.Column('create_time', sa.BigInteger(), nullable=False),
            sa.Column('update_time', sa.BigInteger(), nullable=False),
            sa.ForeignKeyConstraint(['evaluation_id'], ['evaluation.evaluation_id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('evaluation_id', 'task_id', name='unique_eval_task'),
        )
    with op.batch_alter_table('evaluation_task', schema=None) as batch_op:
        if not index_exists('evaluation_task', 'idx_task_evaluation_id'):
            batch_op.create_index('idx_task_evaluation_id', ['evaluation_id'], unique=False)
        if not index_exists('evaluation_task', 'idx_task_name'):
            batch_op.create_index('idx_task_name', ['task_name'], unique=False)

    # ──────────────────────────────────────────────────────────────────────────
    # evaluation_run
    # ──────────────────────────────────────────────────────────────────────────
    if not table_exists('evaluation_run'):
        op.create_table(
            'evaluation_run',
            sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
            sa.Column('run_id', sa.String(length=100), nullable=False),
            sa.Column('evaluation_id', sa.String(length=100), nullable=False),
            sa.Column('workflow_id', sa.String(length=100), nullable=True),
            sa.Column('workflow_version', sa.String(length=100), nullable=True),
            sa.Column('agent_id', sa.String(length=100), nullable=True),
            sa.Column('agent_version', sa.String(length=100), nullable=True),
            sa.Column('status', sa.String(length=50), nullable=False),
            sa.Column('metrics', sa.JSON(), nullable=True),
            sa.Column('start_time', sa.BigInteger(), nullable=True),
            sa.Column('end_time', sa.BigInteger(), nullable=True),
            sa.Column('create_time', sa.BigInteger(), nullable=False),
            sa.Column('update_time', sa.BigInteger(), nullable=False),
            sa.ForeignKeyConstraint(['evaluation_id'], ['evaluation.evaluation_id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('run_id', name='uq_run_id'),
        )
    with op.batch_alter_table('evaluation_run', schema=None) as batch_op:
        if not index_exists('evaluation_run', 'idx_run_evaluation_id'):
            batch_op.create_index('idx_run_evaluation_id', ['evaluation_id'], unique=False)
        if not index_exists('evaluation_run', 'idx_run_workflow_id'):
            batch_op.create_index('idx_run_workflow_id', ['workflow_id'], unique=False)
        if not index_exists('evaluation_run', 'idx_run_agent_id'):
            batch_op.create_index('idx_run_agent_id', ['agent_id'], unique=False)
        if not index_exists('evaluation_run', 'idx_run_status'):
            batch_op.create_index('idx_run_status', ['status'], unique=False)
        if not index_exists('evaluation_run', 'ix_evaluation_run_run_id'):
            batch_op.create_index('ix_evaluation_run_run_id', ['run_id'], unique=True)

    # ──────────────────────────────────────────────────────────────────────────
    # evaluation_task_result
    # ──────────────────────────────────────────────────────────────────────────
    if not table_exists('evaluation_task_result'):
        op.create_table(
            'evaluation_task_result',
            sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
            sa.Column('result_id', sa.String(length=100), nullable=False),
            sa.Column('run_id', sa.String(length=100), nullable=False),
            sa.Column('task_id', sa.String(length=100), nullable=False),
            sa.Column('trial_number', sa.Integer(), nullable=False),
            sa.Column('trace_id', sa.String(length=100), nullable=True),
            sa.Column('grader_results', sa.JSON(), nullable=True),
            sa.Column('passed', sa.Boolean(), nullable=True),
            sa.Column('score', sa.Float(), nullable=True),
            sa.Column('latency_ms', sa.Integer(), nullable=True),
            sa.Column('token_usage', sa.JSON(), nullable=True),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('start_time', sa.BigInteger(), nullable=True),
            sa.Column('end_time', sa.BigInteger(), nullable=True),
            sa.Column('create_time', sa.BigInteger(), nullable=False),
            sa.ForeignKeyConstraint(['run_id'], ['evaluation_run.run_id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('result_id', name='uq_result_id'),
            sa.UniqueConstraint('run_id', 'task_id', 'trial_number', name='unique_run_task_trial'),
        )
    with op.batch_alter_table('evaluation_task_result', schema=None) as batch_op:
        if not index_exists('evaluation_task_result', 'idx_result_run_id'):
            batch_op.create_index('idx_result_run_id', ['run_id'], unique=False)
        if not index_exists('evaluation_task_result', 'idx_result_task_id'):
            batch_op.create_index('idx_result_task_id', ['task_id'], unique=False)

    # ──────────────────────────────────────────────────────────────────────────
    # grader
    # ──────────────────────────────────────────────────────────────────────────
    if not table_exists('grader'):
        op.create_table(
            'grader',
            sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
            sa.Column('grader_id', sa.String(length=100), nullable=False),
            sa.Column('grader_name', sa.String(length=255), nullable=False),
            sa.Column('description', sa.String(length=512), nullable=True),
            sa.Column('space_id', sa.String(length=100), nullable=False),
            sa.Column('grader_type', sa.String(length=50), nullable=False),
            sa.Column('config', sa.JSON(), nullable=False),
            sa.Column('create_time', sa.BigInteger(), nullable=False),
            sa.Column('update_time', sa.BigInteger(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('grader_id', name='uq_grader_id'),
        )
    with op.batch_alter_table('grader', schema=None) as batch_op:
        if not index_exists('grader', 'idx_grader_space_id'):
            batch_op.create_index('idx_grader_space_id', ['space_id'], unique=False)
        if not index_exists('grader', 'idx_grader_type'):
            batch_op.create_index('idx_grader_type', ['grader_type'], unique=False)
        if not index_exists('grader', 'ix_grader_grader_id'):
            batch_op.create_index('ix_grader_grader_id', ['grader_id'], unique=True)


def downgrade() -> None:
    """Downgrade schema — drop evaluation tables in reverse dependency order."""
    with op.batch_alter_table('grader', schema=None) as batch_op:
        for idx in ['ix_grader_grader_id', 'idx_grader_type', 'idx_grader_space_id']:
            if index_exists('grader', idx):
                batch_op.drop_index(idx)
    if table_exists('grader'):
        op.drop_table('grader')

    with op.batch_alter_table('evaluation_task_result', schema=None) as batch_op:
        for idx in ['idx_result_task_id', 'idx_result_run_id']:
            if index_exists('evaluation_task_result', idx):
                batch_op.drop_index(idx)
    if table_exists('evaluation_task_result'):
        op.drop_table('evaluation_task_result')

    with op.batch_alter_table('evaluation_run', schema=None) as batch_op:
        for idx in ['ix_evaluation_run_run_id', 'idx_run_status', 'idx_run_agent_id',
                    'idx_run_workflow_id', 'idx_run_evaluation_id']:
            if index_exists('evaluation_run', idx):
                batch_op.drop_index(idx)
    if table_exists('evaluation_run'):
        op.drop_table('evaluation_run')

    with op.batch_alter_table('evaluation_task', schema=None) as batch_op:
        for idx in ['idx_task_name', 'idx_task_evaluation_id']:
            if index_exists('evaluation_task', idx):
                batch_op.drop_index(idx)
    if table_exists('evaluation_task'):
        op.drop_table('evaluation_task')

    with op.batch_alter_table('evaluation', schema=None) as batch_op:
        for idx in ['ix_evaluation_evaluation_id', 'idx_evaluation_suite_name', 'idx_evaluation_space_id']:
            if index_exists('evaluation', idx):
                batch_op.drop_index(idx)
    if table_exists('evaluation'):
        op.drop_table('evaluation')
