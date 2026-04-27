"""add plugin auth field

Revision ID: e6f7a8b9c0d1
Revises: d4e5f6a7b8c9
Create Date: 2026-04-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from openjiuwen_studio.core.database.migration_utils import column_exists


# revision identifiers, used by Alembic.
revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if not column_exists("plugin", "auth"):
        op.add_column("plugin", sa.Column("auth", sa.JSON(), nullable=True))
    if not column_exists("plugin_publish", "auth"):
        op.add_column("plugin_publish", sa.Column("auth", sa.JSON(), nullable=True))


def downgrade() -> None:
    if column_exists("plugin_publish", "auth"):
        op.drop_column("plugin_publish", "auth")
    if column_exists("plugin", "auth"):
        op.drop_column("plugin", "auth")
