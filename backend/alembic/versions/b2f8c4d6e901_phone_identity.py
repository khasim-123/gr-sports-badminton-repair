"""mobile number becomes the login identity; email no longer required

Revision ID: b2f8c4d6e901
Revises: 9d4b7e2c1a55
Create Date: 2026-10-23 18:00:00

- customers.email, employees.email and service_requests.customerEmail become nullable
- stored mobile numbers are normalised to +91XXXXXXXXXX
- unique indexes on customers.phone / employees.phone. If existing data has duplicate
  numbers, a non-unique index is created instead and a warning is printed, so the deploy
  doesn't fail; the app still blocks new duplicates. Merge the duplicates by hand.

Tables that don't exist yet are skipped: on a fresh database the app's create_all()
builds them from the current models.
"""
import re
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2f8c4d6e901"
down_revision: Union[str, Sequence[str], None] = "9d4b7e2c1a55"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _normalize(raw):
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) == 10 and digits[0] in "6789":
        return f"+91{digits}"
    return None


def _normalize_column(bind, table, id_col, phone_col):
    rows = bind.execute(sa.text(f'SELECT "{id_col}", "{phone_col}" FROM {table}')).fetchall()
    for row_id, phone in rows:
        normalized = _normalize(phone)
        if normalized and normalized != phone:
            bind.execute(sa.text(f'UPDATE {table} SET "{phone_col}" = :p WHERE "{id_col}" = :i'), {"p": normalized, "i": row_id})


def _unique_phone_index(bind, table):
    dupes = bind.execute(sa.text(f"SELECT phone FROM {table} GROUP BY phone HAVING COUNT(*) > 1")).fetchall()
    existing = {ix["name"] for ix in sa.inspect(bind).get_indexes(table)}
    name = f"ix_{table}_phone"
    if name in existing:
        return
    if dupes:
        print(f"[migration] WARNING {table}: these mobile numbers belong to more than one record: "
              f"{', '.join(d[0] for d in dupes)}. Logins for them match the first record only; merge the "
              f"duplicates by hand. New duplicates are blocked by the app.")
        op.create_index(f"{name}_nonunique", table, ["phone"], unique=False)
        return
    op.create_index(name, table, ["phone"], unique=True)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("customers"):
        with op.batch_alter_table("customers") as batch:
            batch.alter_column("email", existing_type=sa.String(), nullable=True)
        _normalize_column(bind, "customers", "id", "phone")
        _unique_phone_index(bind, "customers")

    if inspector.has_table("employees"):
        with op.batch_alter_table("employees") as batch:
            batch.alter_column("email", existing_type=sa.String(), nullable=True)
        _normalize_column(bind, "employees", "id", "phone")
        _unique_phone_index(bind, "employees")

    if inspector.has_table("service_requests"):
        with op.batch_alter_table("service_requests") as batch:
            batch.alter_column("customerEmail", existing_type=sa.String(), nullable=True)
        _normalize_column(bind, "service_requests", "id", "customerMobile")
        existing = {ix["name"] for ix in sa.inspect(bind).get_indexes("service_requests")}
        if "ix_service_requests_customerMobile" not in existing:
            op.create_index("ix_service_requests_customerMobile", "service_requests", ["customerMobile"])


def downgrade() -> None:
    # Normalised numbers and relaxed constraints are kept; only the indexes are dropped.
    bind = op.get_bind()
    for table, names in (("customers", ["ix_customers_phone", "ix_customers_phone_nonunique"]),
                         ("employees", ["ix_employees_phone", "ix_employees_phone_nonunique"]),
                         ("service_requests", ["ix_service_requests_customerMobile"])):
        if not sa.inspect(bind).has_table(table):
            continue
        existing = {ix["name"] for ix in sa.inspect(bind).get_indexes(table)}
        for name in names:
            if name in existing:
                op.drop_index(name, table_name=table)
