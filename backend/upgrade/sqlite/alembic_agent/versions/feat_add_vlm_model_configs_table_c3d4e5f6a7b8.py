"""add vlm model configs table

Revision ID: c3d4e5f6a7b8
Revises: c7d8e9f0a1b2
Create Date: 2026-04-10 18:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from openjiuwen_studio.core.database.migration_utils import index_exists, table_exists


# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "c7d8e9f0a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    if not table_exists("vlm_model_configs"):
        op.create_table(
            "vlm_model_configs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("space_id", sa.String(length=50), nullable=False),
            sa.Column("provider", sa.String(length=50), nullable=False),
            sa.Column("model_id", sa.String(length=100), nullable=False),
            sa.Column("api_key", sa.Text(), nullable=True),
            sa.Column("base_url", sa.String(length=500), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("tags", sa.JSON(), nullable=True),
            sa.Column("timeout", sa.Integer(), nullable=False),
            sa.Column("retry_count", sa.Integer(), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=True,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("(CURRENT_TIMESTAMP)"),
                nullable=True,
            ),
            sa.PrimaryKeyConstraint("id"),
        )

    with op.batch_alter_table("vlm_model_configs", schema=None) as batch_op:
        if not index_exists("vlm_model_configs", "ix_vlm_model_configs_id_vlm_model_configs"):
            batch_op.create_index(
                "ix_vlm_model_configs_id_vlm_model_configs",
                ["id"],
                unique=False,
            )
        if not index_exists("vlm_model_configs", "ix_vlm_model_configs_is_active_vlm_model_configs"):
            batch_op.create_index(
                "ix_vlm_model_configs_is_active_vlm_model_configs",
                ["is_active"],
                unique=False,
            )
        if not index_exists("vlm_model_configs", "ix_vlm_model_configs_model_id_vlm_model_configs"):
            batch_op.create_index(
                "ix_vlm_model_configs_model_id_vlm_model_configs",
                ["model_id"],
                unique=False,
            )
        if not index_exists("vlm_model_configs", "ix_vlm_model_configs_name_vlm_model_configs"):
            batch_op.create_index(
                "ix_vlm_model_configs_name_vlm_model_configs",
                ["name"],
                unique=False,
            )
        if not index_exists("vlm_model_configs", "ix_vlm_model_configs_provider_vlm_model_configs"):
            batch_op.create_index(
                "ix_vlm_model_configs_provider_vlm_model_configs",
                ["provider"],
                unique=False,
            )
        if not index_exists("vlm_model_configs", "ix_vlm_model_configs_space_id_vlm_model_configs"):
            batch_op.create_index(
                "ix_vlm_model_configs_space_id_vlm_model_configs",
                ["space_id"],
                unique=False,
            )


def downgrade() -> None:
    """Downgrade schema."""
    if table_exists("vlm_model_configs"):
        with op.batch_alter_table("vlm_model_configs", schema=None) as batch_op:
            if index_exists("vlm_model_configs", "ix_vlm_model_configs_space_id_vlm_model_configs"):
                batch_op.drop_index("ix_vlm_model_configs_space_id_vlm_model_configs")
            if index_exists("vlm_model_configs", "ix_vlm_model_configs_provider_vlm_model_configs"):
                batch_op.drop_index("ix_vlm_model_configs_provider_vlm_model_configs")
            if index_exists("vlm_model_configs", "ix_vlm_model_configs_name_vlm_model_configs"):
                batch_op.drop_index("ix_vlm_model_configs_name_vlm_model_configs")
            if index_exists("vlm_model_configs", "ix_vlm_model_configs_model_id_vlm_model_configs"):
                batch_op.drop_index("ix_vlm_model_configs_model_id_vlm_model_configs")
            if index_exists("vlm_model_configs", "ix_vlm_model_configs_is_active_vlm_model_configs"):
                batch_op.drop_index("ix_vlm_model_configs_is_active_vlm_model_configs")
            if index_exists("vlm_model_configs", "ix_vlm_model_configs_id_vlm_model_configs"):
                batch_op.drop_index("ix_vlm_model_configs_id_vlm_model_configs")

    if table_exists("vlm_model_configs"):
        op.drop_table("vlm_model_configs")
