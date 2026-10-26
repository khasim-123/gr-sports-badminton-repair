"""academies, enquiries (academy slots, tournament organizing, custom T-shirts), racket condition

Revision ID: f4b8d2e6a913
Revises: e2a7c5d9b431
Create Date: 2026-10-26 14:00:00

- rackets.condition: "new" | "used", NOT NULL, server default "new" (existing rackets are new)
- academies (JSON batches; index on sortOrder)
- enquiries (no foreign key to academies: the academy name is kept in `subject`; indexes on
  kind, mobile, academyId, status, createdAt)

Footer pages and the new shop settings live in app_meta (JSON), so they need no migration.
Tables / columns that already exist (e.g. a database built by create_all from the current
models) are skipped.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f4b8d2e6a913"
down_revision: Union[str, Sequence[str], None] = "e2a7c5d9b431"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_condition() -> bool:
    return any(c["name"] == "condition" for c in sa.inspect(op.get_bind()).get_columns("rackets"))


def upgrade() -> None:
    if not _has_condition():
        op.add_column("rackets", sa.Column("condition", sa.String(), nullable=False, server_default="new"))

    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("academies"):
        op.create_table(
            "academies",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("area", sa.String(), nullable=False),
            sa.Column("address", sa.String(), nullable=True),
            sa.Column("mapsUrl", sa.String(), nullable=True),
            sa.Column("phone", sa.String(), nullable=True),
            sa.Column("photoUrl", sa.String(), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("ageGroups", sa.String(), nullable=True),
            sa.Column("fee", sa.String(), nullable=True),
            sa.Column("batches", sa.JSON(), nullable=True),
            sa.Column("isActive", sa.Boolean(), default=True),
            sa.Column("sortOrder", sa.Integer(), default=0, index=True),
            sa.Column("createdAt", sa.String(), nullable=False),
        )
    if not inspector.has_table("enquiries"):
        op.create_table(
            "enquiries",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("kind", sa.String(), nullable=False, index=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("mobile", sa.String(), nullable=False, index=True),
            sa.Column("academyId", sa.String(), nullable=True, index=True),
            sa.Column("batch", sa.String(), nullable=True),
            sa.Column("department", sa.String(), nullable=True),
            sa.Column("location", sa.String(), nullable=True),
            sa.Column("date", sa.String(), nullable=True),
            sa.Column("quantity", sa.Integer(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("subject", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False, default="new", index=True),
            sa.Column("adminNote", sa.Text(), nullable=True),
            sa.Column("createdAt", sa.String(), nullable=False, index=True),
            sa.Column("updatedAt", sa.String(), nullable=False),
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("enquiries"):
        op.drop_table("enquiries")
    if inspector.has_table("academies"):
        op.drop_table("academies")
    if _has_condition():
        with op.batch_alter_table("rackets") as batch:
            batch.drop_column("condition")
