"""app_meta key/value table (catalogue seeding bookkeeping)

Revision ID: e6f4c2a9b815
Revises: d5e3b8a1c704
Create Date: 2026-10-24 10:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e6f4c2a9b815"
down_revision: Union[str, Sequence[str], None] = "d5e3b8a1c704"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if not sa.inspect(op.get_bind()).has_table("app_meta"):
        op.create_table(
            "app_meta",
            sa.Column("key", sa.String(), primary_key=True),
            sa.Column("value", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("app_meta"):
        op.drop_table("app_meta")
