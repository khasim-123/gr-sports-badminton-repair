"""drop email templates (the business doesn't use email)

Revision ID: c4a1d9e7f302
Revises: b2f8c4d6e901
Create Date: 2026-10-23 20:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c4a1d9e7f302"
down_revision: Union[str, Sequence[str], None] = "b2f8c4d6e901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("email_templates"):
        op.drop_table("email_templates")


def downgrade() -> None:
    # The feature was removed; recreate the empty table only so older code could start.
    if not sa.inspect(op.get_bind()).has_table("email_templates"):
        op.create_table(
            "email_templates",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("subject", sa.String(), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("category", sa.String(), nullable=False),
            sa.Column("variables", sa.JSON(), nullable=True),
        )
