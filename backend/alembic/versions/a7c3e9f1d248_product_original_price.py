"""original price (MRP) on rackets, strings and apparel

Revision ID: a7c3e9f1d248
Revises: f4b8d2e6a913
Create Date: 2026-10-26 20:00:00

- rackets.mrp, string_products.mrp, apparel_products.mrp: the original price shown struck through
  next to the shop's price (nullable; empty = not shown).

Columns that already exist (e.g. a database built by create_all from the current models) are
skipped.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a7c3e9f1d248"
down_revision: Union[str, Sequence[str], None] = "f4b8d2e6a913"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ("rackets", "string_products", "apparel_products")


def _has_mrp(table: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return inspector.has_table(table) and any(c["name"] == "mrp" for c in inspector.get_columns(table))


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table in TABLES:
        if inspector.has_table(table) and not _has_mrp(table):
            op.add_column(table, sa.Column("mrp", sa.Float(), nullable=True))


def downgrade() -> None:
    for table in TABLES:
        if _has_mrp(table):
            with op.batch_alter_table(table) as batch:
                batch.drop_column("mrp")
