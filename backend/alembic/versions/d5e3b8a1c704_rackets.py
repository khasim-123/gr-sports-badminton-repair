"""admin-managed rackets catalogue

Revision ID: d5e3b8a1c704
Revises: c4a1d9e7f302
Create Date: 2026-10-23 22:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d5e3b8a1c704"
down_revision: Union[str, Sequence[str], None] = "c4a1d9e7f302"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("rackets"):
        return
    op.create_table(
        "rackets",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("brand", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("tag", sa.String(), nullable=True),
        sa.Column("weight", sa.String(), nullable=True),
        sa.Column("balance", sa.String(), nullable=True),
        sa.Column("flex", sa.String(), nullable=True),
        sa.Column("maxTension", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("images", sa.JSON(), nullable=True),
        sa.Column("inStock", sa.Boolean(), default=True),
        sa.Column("isFeatured", sa.Boolean(), default=False),
        sa.Column("isActive", sa.Boolean(), default=True),
        sa.Column("sortOrder", sa.Integer(), default=0, index=True),
        sa.Column("createdAt", sa.String(), nullable=False),
    )


def downgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("rackets"):
        op.drop_table("rackets")
