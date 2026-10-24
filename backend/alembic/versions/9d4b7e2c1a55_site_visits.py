"""site visit tracking for admin visitor reports

Revision ID: 9d4b7e2c1a55
Revises: 7c1e2f9a4b10
Create Date: 2026-10-23 15:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "9d4b7e2c1a55"
down_revision: Union[str, Sequence[str], None] = "7c1e2f9a4b10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("site_visits"):
        return
    op.create_table(
        "site_visits",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("visitorId", sa.String(), nullable=False, index=True),
        sa.Column("sessionId", sa.String(), nullable=False, index=True),
        sa.Column("page", sa.String(), nullable=False),
        sa.Column("referrer", sa.String(), nullable=True),
        sa.Column("utmSource", sa.String(), nullable=True),
        sa.Column("device", sa.String(), nullable=True),
        sa.Column("browser", sa.String(), nullable=True),
        sa.Column("customerPhone", sa.String(), nullable=True, index=True),
        sa.Column("day", sa.String(), nullable=False, index=True),
        sa.Column("createdAt", sa.String(), nullable=False),
    )


def downgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("site_visits"):
        op.drop_table("site_visits")
