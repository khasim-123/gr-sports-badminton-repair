"""website content (banners, strings, reviews, documents, availability, media) and OTP codes

Revision ID: 7c1e2f9a4b10
Revises: dbaede25c524
Create Date: 2026-10-23 12:00:00

The original schema is created by Base.metadata.create_all() at app startup, so this
migration creates only the new tables, skipping any that already exist.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "7c1e2f9a4b10"
down_revision: Union[str, Sequence[str], None] = "dbaede25c524"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _create(name: str, *columns) -> None:
    if not sa.inspect(op.get_bind()).has_table(name):
        op.create_table(name, *columns)


def upgrade() -> None:
    _create(
        "otp_codes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("identifier", sa.String(), nullable=False, index=True),
        sa.Column("codeHash", sa.String(), nullable=False),
        sa.Column("expiresAt", sa.Float(), nullable=False),
        sa.Column("attempts", sa.Integer(), default=0),
    )
    _create(
        "media",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("fileName", sa.String(), nullable=True),
        sa.Column("contentType", sa.String(), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column("uploadedBy", sa.String(), nullable=True),
        sa.Column("createdAt", sa.String(), nullable=False),
    )
    _create(
        "banners",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("subtitle", sa.Text(), nullable=True),
        sa.Column("badge", sa.String(), nullable=True),
        sa.Column("ctaLabel", sa.String(), nullable=True),
        sa.Column("ctaTarget", sa.String(), default="none"),
        sa.Column("ctaUrl", sa.String(), nullable=True),
        sa.Column("desktopImageUrl", sa.String(), nullable=False),
        sa.Column("mobileImageUrl", sa.String(), nullable=True),
        sa.Column("isActive", sa.Boolean(), default=True),
        sa.Column("sortOrder", sa.Integer(), default=0, index=True),
        sa.Column("startsAt", sa.String(), nullable=True),
        sa.Column("endsAt", sa.String(), nullable=True),
        sa.Column("createdAt", sa.String(), nullable=False),
    )
    _create(
        "string_products",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("brand", sa.String(), nullable=False),
        sa.Column("code", sa.String(), nullable=True, index=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("gauge", sa.String(), nullable=True),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("isFeatured", sa.Boolean(), default=False),
        sa.Column("isActive", sa.Boolean(), default=True),
        sa.Column("sortOrder", sa.Integer(), default=0, index=True),
        sa.Column("createdAt", sa.String(), nullable=False),
    )
    _create(
        "string_variants",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("productId", sa.String(), sa.ForeignKey("string_products.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("colour", sa.String(), nullable=False),
        sa.Column("colourHex", sa.String(), nullable=True),
        sa.Column("imageUrl", sa.String(), nullable=True),
        sa.Column("inStock", sa.Boolean(), default=True),
        sa.Column("sortOrder", sa.Integer(), default=0),
    )
    _create(
        "reviews",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("authorName", sa.String(), nullable=False),
        sa.Column("authorPhone", sa.String(), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.Column("serviceType", sa.String(), nullable=True),
        sa.Column("location", sa.String(), nullable=True),
        sa.Column("status", sa.String(), default="pending", index=True),
        sa.Column("isFeatured", sa.Boolean(), default=False),
        sa.Column("isVerified", sa.Boolean(), default=False),
        sa.Column("requestId", sa.String(), nullable=True, index=True),
        sa.Column("adminReply", sa.Text(), nullable=True),
        sa.Column("createdAt", sa.String(), nullable=False),
    )
    _create(
        "documents",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("fileUrl", sa.String(), nullable=False),
        sa.Column("fileName", sa.String(), nullable=True),
        sa.Column("contentType", sa.String(), nullable=True),
        sa.Column("isPublic", sa.Boolean(), default=True),
        sa.Column("sortOrder", sa.Integer(), default=0),
        sa.Column("createdAt", sa.String(), nullable=False),
    )
    _create(
        "availability_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("openWeekdays", sa.JSON(), nullable=True),
        sa.Column("dailyPickupCapacity", sa.Integer(), default=0),
        sa.Column("leadTimeDays", sa.Integer(), default=0),
        sa.Column("bookingWindowDays", sa.Integer(), default=30),
        sa.Column("pickupSlots", sa.JSON(), nullable=True),
        sa.Column("closedDates", sa.JSON(), nullable=True),
        sa.Column("notice", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    for name in ["availability_settings", "documents", "reviews", "string_variants", "string_products",
                 "banners", "media", "otp_codes"]:
        if sa.inspect(op.get_bind()).has_table(name):
            op.drop_table(name)
