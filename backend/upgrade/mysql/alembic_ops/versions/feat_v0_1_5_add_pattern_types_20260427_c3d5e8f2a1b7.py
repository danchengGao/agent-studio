"""add_pattern_types_column_to_evaluation_task_v0.1.5_20260427

Revision ID: c3d5e8f2a1b7
Revises: b9d4e7c2f1a6
Create Date: 2026-04-27 00:00:00.000000

Adds pattern_types JSON column to evaluation_task to support multiple
pattern checks per task (replaces single pattern_type string).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from openjiuwen_studio.core.database.migration_utils import column_exists

revision: str = 'c3d5e8f2a1b7'
down_revision: Union[str, Sequence[str], None] = 'b9d4e7c2f1a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('evaluation_task', schema=None) as batch_op:
        if not column_exists('evaluation_task', 'pattern_types'):
            batch_op.add_column(sa.Column('pattern_types', sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('evaluation_task', schema=None) as batch_op:
        if column_exists('evaluation_task', 'pattern_types'):
            batch_op.drop_column('pattern_types')
