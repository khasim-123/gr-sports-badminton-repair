"""shop: apparel catalogue (products + size/colour variants with stock) and online orders

Revision ID: c8e4a2f6b917
Revises: b3d9f2a4c617
Create Date: 2026-10-25 18:00:00

- apparel_products
- apparel_variants (FK productId -> apparel_products.id, indexed; unique size + colour per product)
- orders (JSON items / address / timeline; indexes on customerMobile, createdAt, status)

Tables that already exist (e.g. a database built by create_all from the current models)
are skipped.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c8e4a2f6b917"
down_revision: Union[str, Sequence[str], None] = "b3d9f2a4c617"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("apparel_products"):
        op.create_table(
            "apparel_products",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("category", sa.String(), nullable=False, default="t-shirt"),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("fabric", sa.String(), nullable=True),
            sa.Column("fit", sa.String(), nullable=True),
            sa.Column("price", sa.Float(), nullable=False),
            sa.Column("images", sa.JSON(), nullable=True),
            sa.Column("customisable", sa.Boolean(), default=False),
            sa.Column("isFeatured", sa.Boolean(), default=False),
            sa.Column("isActive", sa.Boolean(), default=True),
            sa.Column("sortOrder", sa.Integer(), default=0, index=True),
            sa.Column("createdAt", sa.String(), nullable=False),
        )
    if not inspector.has_table("apparel_variants"):
        op.create_table(
            "apparel_variants",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column(
                "productId",
                sa.String(),
                sa.ForeignKey("apparel_products.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("size", sa.String(), nullable=False),
            sa.Column("colour", sa.String(), nullable=False),
            sa.Column("colourHex", sa.String(), nullable=True),
            sa.Column("stock", sa.Integer(), nullable=False, default=0),
            sa.Column("sku", sa.String(), nullable=True),
            sa.Column("sortOrder", sa.Integer(), default=0),
            sa.UniqueConstraint("productId", "size", "colour", name="uq_apparel_variants_size_colour"),
        )
    if not inspector.has_table("orders"):
        op.create_table(
            "orders",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("customerName", sa.String(), nullable=False),
            sa.Column("customerMobile", sa.String(), nullable=False, index=True),
            sa.Column("createdAt", sa.String(), nullable=False, index=True),
            sa.Column("status", sa.String(), nullable=False, index=True),
            sa.Column("fulfilment", sa.String(), nullable=False),
            sa.Column("address", sa.JSON(), nullable=True),
            sa.Column("distanceKm", sa.Float(), nullable=True),
            sa.Column("items", sa.JSON(), nullable=True),
            sa.Column("subtotal", sa.Float(), nullable=False, default=0.0),
            sa.Column("deliveryCharge", sa.Float(), nullable=False, default=0.0),
            sa.Column("total", sa.Float(), nullable=False, default=0.0),
            sa.Column("paymentStatus", sa.String(), nullable=False, default="Pending"),
            sa.Column("paymentMethod", sa.String(), nullable=True),
            sa.Column("paidAmount", sa.Float(), nullable=True),
            sa.Column("paidAt", sa.String(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("cancelReason", sa.Text(), nullable=True),
            sa.Column("timeline", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("orders"):
        op.drop_table("orders")
    if inspector.has_table("apparel_variants"):
        op.drop_table("apparel_variants")
    if inspector.has_table("apparel_products"):
        op.drop_table("apparel_products")
