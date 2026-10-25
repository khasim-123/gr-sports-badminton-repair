"""core tables (requests, customers, staff, pricing, notifications, audit log)

Revision ID: a1c5e7b9d310
Revises: f1b7d3a9c206
Create Date: 2026-10-25 10:00:00

The original "initial" revision was empty: these tables were only ever created by the
app's Base.metadata.create_all() at startup. That meant `alembic upgrade head` on a fresh
database produced an incomplete schema, and `alembic check` reported them all as missing.
This revision creates any of them that don't exist yet, matching app/models.py. Existing
databases (where create_all already built them) are left untouched.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1c5e7b9d310"
down_revision: Union[str, Sequence[str], None] = "f1b7d3a9c206"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tables():
    return {
        "service_requests": [
            sa.Column("id", sa.String(), primary_key=True, index=True),
            sa.Column("serviceType", sa.String(), nullable=False, index=True),
            sa.Column("customerName", sa.String(), nullable=False),
            sa.Column("customerEmail", sa.String(), nullable=True, index=True),
            sa.Column("customerMobile", sa.String(), nullable=False, index=True),
            sa.Column("createdAt", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False, index=True),
            sa.Column("batBrand", sa.String(), nullable=False),
            sa.Column("batModel", sa.String(), nullable=False),
            sa.Column("batType", sa.String(), nullable=False),
            sa.Column("batPhotos", sa.JSON(), nullable=True),
            sa.Column("gettingType", sa.String(), nullable=True),
            sa.Column("stringPreference", sa.String(), nullable=True),
            sa.Column("stringType", sa.String(), nullable=True),
            sa.Column("stringTensionLbs", sa.Integer(), nullable=True),
            sa.Column("gettingPrice", sa.Float(), nullable=True),
            sa.Column("colour", sa.String(), nullable=True),
            sa.Column("repairIssue", sa.String(), nullable=True),
            sa.Column("repairDescription", sa.Text(), nullable=True),
            sa.Column("pickupDate", sa.String(), nullable=True),
            sa.Column("targetDate", sa.String(), nullable=True),
            sa.Column("expectedDeliveryDate", sa.String(), nullable=True),
            sa.Column("repairEstimate", sa.JSON(), nullable=True),
            sa.Column("previousEstimate", sa.JSON(), nullable=True),
            sa.Column("pickupAddress", sa.JSON(), nullable=False),
            sa.Column("distanceKm", sa.Float(), nullable=True),
            sa.Column("pickupDeliveryCharge", sa.Float(), nullable=True),
            sa.Column("isFreeDelivery", sa.Boolean(), nullable=True),
            sa.Column("assignedEmployeeId", sa.String(), nullable=True, index=True),
            sa.Column("assignedEmployeeName", sa.String(), nullable=True),
            sa.Column("pickupCondition", sa.JSON(), nullable=True),
            sa.Column("serviceCharge", sa.Float(), nullable=True),
            sa.Column("discount", sa.Float(), nullable=True),
            sa.Column("totalAmount", sa.Float(), nullable=True),
            sa.Column("paymentStatus", sa.String(), nullable=True),
            sa.Column("paymentRecord", sa.JSON(), nullable=True),
            sa.Column("timeline", sa.JSON(), nullable=True),
            sa.Column("additionalNotes", sa.Text(), nullable=True),
            sa.Column("review", sa.JSON(), nullable=True),
        ],
        "customers": [
            sa.Column("id", sa.String(), primary_key=True, index=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("email", sa.String(), nullable=True, unique=True, index=True),
            sa.Column("phone", sa.String(), nullable=False, unique=True, index=True),
            sa.Column("address", sa.String(), nullable=True),
            sa.Column("password", sa.String(), nullable=True),
            sa.Column("createdAt", sa.String(), nullable=False),
        ],
        "employees": [
            sa.Column("id", sa.String(), primary_key=True, index=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("email", sa.String(), nullable=True, unique=True, index=True),
            sa.Column("phone", sa.String(), nullable=False, unique=True, index=True),
            sa.Column("role", sa.String(), nullable=True),
            sa.Column("userRole", sa.String(), nullable=True),
            sa.Column("activeJobsCount", sa.Integer(), nullable=True),
            sa.Column("avatar", sa.String(), nullable=True),
            sa.Column("password", sa.String(), nullable=True),
            sa.Column("isActive", sa.Boolean(), nullable=True),
        ],
        "distance_config": [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("shopLocationName", sa.String(), nullable=False),
            sa.Column("shopLat", sa.Float(), nullable=False),
            sa.Column("shopLng", sa.Float(), nullable=False),
            sa.Column("freeRadiusKm", sa.Float(), nullable=True),
            sa.Column("perKmRateBeyondFree", sa.Float(), nullable=True),
            sa.Column("pricingMethod", sa.String(), nullable=True),
            sa.Column("maxServiceDistanceKm", sa.Float(), nullable=True),
            sa.Column("slabs", sa.JSON(), nullable=True),
        ],
        "getting_service_tiers": [
            sa.Column("id", sa.String(), primary_key=True, index=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("price", sa.Float(), nullable=False),
            sa.Column("turnaround", sa.String(), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("features", sa.JSON(), nullable=True),
            sa.Column("isActive", sa.Boolean(), nullable=True),
        ],
        "repair_category_tiers": [
            sa.Column("id", sa.String(), primary_key=True, index=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("basePrice", sa.Float(), nullable=False),
            sa.Column("turnaround", sa.String(), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("slaDays", sa.Integer(), nullable=True),
            sa.Column("isActive", sa.Boolean(), nullable=True),
        ],
        "notifications": [
            sa.Column("id", sa.String(), primary_key=True, index=True),
            sa.Column("type", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("requestId", sa.String(), nullable=True),
            sa.Column("timestamp", sa.String(), nullable=False),
            sa.Column("isRead", sa.Boolean(), nullable=True),
            sa.Column("targetRoles", sa.JSON(), nullable=True),
        ],
        "audit_logs": [
            sa.Column("id", sa.String(), primary_key=True, index=True),
            sa.Column("timestamp", sa.String(), nullable=False),
            sa.Column("user", sa.String(), nullable=False),
            sa.Column("role", sa.String(), nullable=False),
            sa.Column("action", sa.String(), nullable=False),
            sa.Column("requestId", sa.String(), nullable=False),
            sa.Column("details", sa.Text(), nullable=True),
        ],
    }


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for name, columns in _tables().items():
        if not inspector.has_table(name):
            op.create_table(name, *columns)


def downgrade() -> None:
    # Dropping these would delete every booking, customer and staff account; the tables
    # existed (via create_all) before this revision, so downgrade leaves them in place.
    pass
