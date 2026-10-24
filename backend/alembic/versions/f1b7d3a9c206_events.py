"""events (tournaments, coaching camps, clinics, store events) and event registrations

Revision ID: f1b7d3a9c206
Revises: e6f4c2a9b815
Create Date: 2026-10-24 18:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f1b7d3a9c206"
down_revision: Union[str, Sequence[str], None] = "e6f4c2a9b815"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("events"):
        op.create_table(
            "events",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("category", sa.String(), nullable=False, default="tournament"),
            sa.Column("summary", sa.Text(), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("startDate", sa.String(), nullable=False, index=True),
            sa.Column("endDate", sa.String(), nullable=True),
            sa.Column("timeText", sa.String(), nullable=True),
            sa.Column("venue", sa.String(), nullable=False),
            sa.Column("venueMapUrl", sa.String(), nullable=True),
            sa.Column("entryFee", sa.Float(), nullable=True),
            sa.Column("feeNote", sa.String(), nullable=True),
            sa.Column("categories", sa.JSON(), nullable=True),
            sa.Column("registrationMode", sa.String(), nullable=False, default="none"),
            sa.Column("registrationUrl", sa.String(), nullable=True),
            sa.Column("registrationDeadline", sa.String(), nullable=True),
            sa.Column("capacity", sa.Integer(), nullable=True),
            sa.Column("bannerImageUrl", sa.String(), nullable=False),
            sa.Column("mobileImageUrl", sa.String(), nullable=True),
            sa.Column("showAsBanner", sa.Boolean(), default=True),
            sa.Column("isActive", sa.Boolean(), default=True),
            sa.Column("sortOrder", sa.Integer(), default=0, index=True),
            sa.Column("createdAt", sa.String(), nullable=False),
        )
    if not inspector.has_table("event_registrations"):
        op.create_table(
            "event_registrations",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column(
                "eventId",
                sa.String(),
                sa.ForeignKey("events.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("mobile", sa.String(), nullable=False, index=True),
            sa.Column("partnerName", sa.String(), nullable=True),
            sa.Column("playCategory", sa.String(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("status", sa.String(), nullable=False, default="registered"),
            sa.Column("createdAt", sa.String(), nullable=False),
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("event_registrations"):
        op.drop_table("event_registrations")
    if inspector.has_table("events"):
        op.drop_table("events")
