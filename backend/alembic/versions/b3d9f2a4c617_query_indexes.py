"""indexes for the columns the admin/staff lists sort and filter on

Revision ID: b3d9f2a4c617
Revises: a1c5e7b9d310
Create Date: 2026-10-25 10:05:00

- service_requests."createdAt"  (every request list is ORDER BY createdAt DESC)
- notifications."timestamp", notifications."requestId"
- audit_logs."timestamp", audit_logs."requestId"
- site_visits."createdAt"       (visitor report sorts by it)

Indexes that already exist (e.g. a database built by create_all from the current models)
are skipped.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b3d9f2a4c617"
down_revision: Union[str, Sequence[str], None] = "a1c5e7b9d310"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INDEXES = [
    ("service_requests", "createdAt"),
    ("notifications", "timestamp"),
    ("notifications", "requestId"),
    ("audit_logs", "timestamp"),
    ("audit_logs", "requestId"),
    ("site_visits", "createdAt"),
]


def upgrade() -> None:
    bind = op.get_bind()
    for table, column in INDEXES:
        if not sa.inspect(bind).has_table(table):
            continue
        existing = {ix["name"] for ix in sa.inspect(bind).get_indexes(table)}
        name = f"ix_{table}_{column}"
        if name not in existing:
            op.create_index(name, table, [column])


def downgrade() -> None:
    bind = op.get_bind()
    for table, column in INDEXES:
        if not sa.inspect(bind).has_table(table):
            continue
        existing = {ix["name"] for ix in sa.inspect(bind).get_indexes(table)}
        name = f"ix_{table}_{column}"
        if name in existing:
            op.drop_index(name, table_name=table)
