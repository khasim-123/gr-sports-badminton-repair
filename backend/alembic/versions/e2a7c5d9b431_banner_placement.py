"""banner placement: top slideshow, promo banner or announcement

Revision ID: e2a7c5d9b431
Revises: a9d2c6e4f318
Create Date: 2026-10-26 10:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e2a7c5d9b431"
down_revision: Union[str, Sequence[str], None] = "a9d2c6e4f318"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_placement() -> bool:
    return any(c["name"] == "placement" for c in sa.inspect(op.get_bind()).get_columns("banners"))


def upgrade() -> None:
    # Existing banners stay in the top slideshow.
    if not _has_placement():
        op.add_column("banners", sa.Column("placement", sa.String(), nullable=False, server_default="hero"))


def downgrade() -> None:
    if _has_placement():
        with op.batch_alter_table("banners") as batch:
            batch.drop_column("placement")
