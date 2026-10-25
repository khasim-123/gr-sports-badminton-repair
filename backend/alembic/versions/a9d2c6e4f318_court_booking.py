"""court booking: venues, courts, blocked times, bookings and the slot rows that stop double booking

Revision ID: a9d2c6e4f318
Revises: c8e4a2f6b917
Create Date: 2026-10-25 20:00:00

- court_venues (JSON photos / amenities)
- courts (FK venueId -> court_venues.id, indexed; unique name per venue)
- court_blocks (FK venueId -> court_venues.id, indexed; JSON weekdays)
- court_bookings (JSON timeline; indexes on venueId, courtId, date, customerMobile, status)
- court_booking_slots (FK bookingId -> court_bookings.id, indexed; unique courtId + date + startTime)

Tables that already exist (e.g. a database built by create_all from the current models)
are skipped.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a9d2c6e4f318"
down_revision: Union[str, Sequence[str], None] = "c8e4a2f6b917"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("court_venues"):
        op.create_table(
            "court_venues",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("address", sa.String(), nullable=False),
            sa.Column("area", sa.String(), nullable=True),
            sa.Column("mapsUrl", sa.String(), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("photos", sa.JSON(), nullable=True),
            sa.Column("amenities", sa.JSON(), nullable=True),
            sa.Column("rules", sa.Text(), nullable=True),
            sa.Column("openTime", sa.String(), nullable=False),
            sa.Column("closeTime", sa.String(), nullable=False),
            sa.Column("slotMinutes", sa.Integer(), nullable=False, default=60),
            sa.Column("pricePerHour", sa.Float(), nullable=False),
            sa.Column("peakPricePerHour", sa.Float(), nullable=True),
            sa.Column("peakStart", sa.String(), nullable=True),
            sa.Column("peakEnd", sa.String(), nullable=True),
            sa.Column("weekendPricePerHour", sa.Float(), nullable=True),
            sa.Column("advanceDays", sa.Integer(), nullable=False, default=14),
            sa.Column("maxSlotsPerBooking", sa.Integer(), nullable=False, default=4),
            sa.Column("cancellationHours", sa.Integer(), nullable=False, default=12),
            sa.Column("isActive", sa.Boolean(), default=True),
            sa.Column("sortOrder", sa.Integer(), default=0, index=True),
            sa.Column("createdAt", sa.String(), nullable=False),
        )
    if not inspector.has_table("courts"):
        op.create_table(
            "courts",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column(
                "venueId",
                sa.String(),
                sa.ForeignKey("court_venues.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("surface", sa.String(), nullable=True),
            sa.Column("isActive", sa.Boolean(), default=True),
            sa.Column("sortOrder", sa.Integer(), default=0),
            sa.UniqueConstraint("venueId", "name", name="uq_courts_venue_name"),
        )
    if not inspector.has_table("court_blocks"):
        op.create_table(
            "court_blocks",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column(
                "venueId",
                sa.String(),
                sa.ForeignKey("court_venues.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("courtId", sa.String(), nullable=True, index=True),
            sa.Column("date", sa.String(), nullable=True),
            sa.Column("weekdays", sa.JSON(), nullable=True),
            sa.Column("fromDate", sa.String(), nullable=True),
            sa.Column("toDate", sa.String(), nullable=True),
            sa.Column("startTime", sa.String(), nullable=False),
            sa.Column("endTime", sa.String(), nullable=False),
            sa.Column("reason", sa.String(), nullable=False),
            sa.Column("createdAt", sa.String(), nullable=False),
        )
    if not inspector.has_table("court_bookings"):
        op.create_table(
            "court_bookings",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("venueId", sa.String(), nullable=False, index=True),
            sa.Column("venueName", sa.String(), nullable=False),
            sa.Column("courtId", sa.String(), nullable=False, index=True),
            sa.Column("courtName", sa.String(), nullable=False),
            sa.Column("date", sa.String(), nullable=False, index=True),
            sa.Column("startTime", sa.String(), nullable=False),
            sa.Column("endTime", sa.String(), nullable=False),
            sa.Column("slots", sa.Integer(), nullable=False),
            sa.Column("price", sa.Float(), nullable=False),
            sa.Column("customerName", sa.String(), nullable=False),
            sa.Column("customerMobile", sa.String(), nullable=False, index=True),
            sa.Column("players", sa.Integer(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("status", sa.String(), nullable=False, index=True),
            sa.Column("paymentStatus", sa.String(), nullable=False, default="Pending"),
            sa.Column("paymentMethod", sa.String(), nullable=True),
            sa.Column("paidAmount", sa.Float(), nullable=True),
            sa.Column("paidAt", sa.String(), nullable=True),
            sa.Column("bookedBy", sa.String(), nullable=False, default="customer"),
            sa.Column("cancellationHours", sa.Integer(), nullable=False, default=0),
            sa.Column("cancelReason", sa.Text(), nullable=True),
            sa.Column("createdAt", sa.String(), nullable=False),
            sa.Column("timeline", sa.JSON(), nullable=True),
        )
    if not inspector.has_table("court_booking_slots"):
        op.create_table(
            "court_booking_slots",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column(
                "bookingId",
                sa.String(),
                sa.ForeignKey("court_bookings.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("courtId", sa.String(), nullable=False),
            sa.Column("date", sa.String(), nullable=False),
            sa.Column("startTime", sa.String(), nullable=False),
            sa.UniqueConstraint("courtId", "date", "startTime", name="uq_court_booking_slots_time"),
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table in ("court_booking_slots", "court_bookings", "court_blocks", "courts", "court_venues"):
        if inspector.has_table(table):
            op.drop_table(table)
