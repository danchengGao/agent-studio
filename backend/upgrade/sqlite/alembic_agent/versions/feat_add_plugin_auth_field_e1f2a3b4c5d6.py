"""add plugin auth field

Revision ID: e1f2a3b4c5d6
Revises: c3d4e5f6a7b8
Create Date: 2026-04-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from openjiuwen_studio.core.database.migration_utils import column_exists


# revision identifiers, used by Alembic.
revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("plugin", schema=None) as batch_op:
        if not column_exists("plugin", "auth"):
            batch_op.add_column(sa.Column("auth", sa.JSON(), nullable=True))

    with op.batch_alter_table("plugin_publish", schema=None) as batch_op:
        if not column_exists("plugin_publish", "auth"):
            batch_op.add_column(sa.Column("auth", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("plugin_publish", schema=None) as batch_op:
        if column_exists("plugin_publish", "auth"):
            batch_op.drop_column("auth")

    with op.batch_alter_table("plugin", schema=None) as batch_op:
        if column_exists("plugin", "auth"):
            batch_op.drop_column("auth")
