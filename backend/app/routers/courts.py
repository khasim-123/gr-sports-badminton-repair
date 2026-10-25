"""Court booking: venues & courts, blocked times, availability and bookings.

Public (no login):
  GET  /courts/venues                         active venues with their active courts
  GET  /courts/availability?venueId&date      every active court × every slot of the day
Customers (and the admin):
  POST /court-bookings                        customers book for themselves; the admin for a walk-in / phone customer
  GET  /court-bookings, GET /court-bookings/{id}
                                              customers see their own bookings, the admin every booking
  POST /court-bookings/{id}/cancel            customer until the venue's cut-off; admin until played / no-show
Admin:
  PATCH /court-bookings/{id}/status (Completed / No-show), POST /court-bookings/{id}/payment,
  venues, courts and blocked times under /courts/admin

All dates and times are India local time ("YYYY-MM-DD", "HH:MM"). A venue's day runs from
openTime to closeTime in slotMinutes steps (30 or 60). Prices always come from the database:
a slot costs the hourly rate × slotMinutes / 60, where the rate is the weekend price on Sat/Sun
(when set), else the peak price for slots starting inside the peak hours (when set), else the
base price.

Double booking is prevented by the database: each booking also writes one
court_booking_slots row per 30-minute piece of court time it holds, and (courtId, date,
startTime) is unique, so of two bookings for the same time only the first to commit is saved.
Cancelling a booking deletes its rows and frees the time. Courts are paid for at the venue
(Cash / UPI). Notifications about a booking use the booking id as their requestId, so the
customer who holds it (and only them) sees them.
"""
import math
import random
import re
from datetime import date, datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import (
    CourtBlockModel,
    CourtBookingModel,
    CourtBookingSlotModel,
    CourtModel,
    CourtVenueModel,
    CustomerModel,
)
from app.schemas import (
    CourtBlockCreate,
    CourtBlockSchema,
    CourtBookingCancelInput,
    CourtBookingCreate,
    CourtBookingPaymentInput,
    CourtBookingSchema,
    CourtBookingStatusUpdate,
    CourtCreate,
    CourtSchema,
    CourtUpdate,
    CourtVenueCreate,
    CourtVenueSchema,
    CourtVenueUpdate,
    VenueAvailabilitySchema,
)
from app.security import CurrentUser, get_current_user, rate_limit, rate_limiter, require_admin
from app.services.content_service import BUSINESS_TZ, new_id, now_iso, validate_link
from app.services.notification_service import create_notification, log_audit
from app.services.shop_settings import display_phone as shop_display_phone, get_shop_settings
from app.services.sms_service import display_phone, require_phone

router = APIRouter(tags=["Courts"])

# Venue / court limits
VENUE_NAME_MIN, VENUE_NAME_MAX = 2, 80
ADDRESS_MIN, ADDRESS_MAX = 3, 200
AREA_MAX = 80
DESCRIPTION_MAX = 1000
RULES_MAX = 500
LINK_MAX = 500
PHOTOS_MAX = 6
AMENITIES_MAX, AMENITY_MAX = 12, 40
PRICE_MAX = 10_000
SLOT_LENGTHS = (30, 60)
ADVANCE_DAYS = (1, 60)
MAX_SLOTS = (1, 8)
CANCELLATION_HOURS = (0, 72)
COURT_NAME_MAX = 40
SURFACE_MAX = 40
SORT_ORDER_MAX = 100_000
BLOCK_REASON_MIN, BLOCK_REASON_MAX = 2, 80

# Booking limits
CUSTOMER_NAME_MIN, CUSTOMER_NAME_MAX = 2, 80
NOTES_MAX = 300
PLAYERS_MAX = 12
CANCEL_REASON_MIN, CANCEL_REASON_MAX = 3, 200
BOOKINGS_PER_HOUR = 10  # per customer
MAX_UPCOMING_PER_CUSTOMER = 3

UNIT = 30  # minutes: every time is on a half-hour boundary; booked time is held in 30-minute pieces
TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})(?::00)?$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SLOT_TAKEN = "That time was just booked — pick another slot"

STATUS_LABELS = {
    "Confirmed": "Court booked",
    "Completed": "Played — booking completed",
    "No-show": "Marked as no-show",
    "Cancelled": "Booking cancelled",
}


# ---------------- Time & formatting helpers ----------------

def _now() -> datetime:
    """Current India time (tests replace this to fix the clock)."""
    return datetime.now(BUSINESS_TZ)


def _today() -> date:
    return _now().date()


def _bad(detail: str) -> HTTPException:
    return HTTPException(status_code=422, detail=detail)


def _conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=409, detail=detail)


def _text(value: Optional[str], label: str, max_len: int, required: bool = False, single_line: bool = True,
          min_len: int = 0) -> Optional[str]:
    v = (value or "").strip()
    if single_line:
        v = " ".join(v.split())
    if not v:
        if required:
            raise _bad(f"{label} is required")
        return None
    if len(v) < min_len:
        raise _bad(f"{label} must be at least {min_len} characters")
    if len(v) > max_len:
        raise _bad(f"{label} must be at most {max_len} characters")
    return v


def _mins(value: str) -> int:
    """Minutes since midnight of a stored "HH:MM" ("24:00" = midnight at the end of the day)."""
    h, m = value.split(":")[:2]
    return int(h) * 60 + int(m)


def _hhmm(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _parse_time(value: Optional[str], label: str, allow_midnight: bool = False) -> int:
    """A submitted time on a half-hour boundary, as minutes since midnight."""
    v = (value or "").strip()
    m = TIME_RE.match(v)
    if not m:
        raise _bad(f"{label} must be a time like 18:00")
    hours, minutes = int(m.group(1)), int(m.group(2))
    total = hours * 60 + minutes
    if allow_midnight and total == 24 * 60:
        return total
    if hours > 23 or minutes > 59:
        raise _bad(f"{label} must be a time like 18:00")
    if total % UNIT:
        raise _bad(f"{label} must be on the hour or half hour (like 18:00 or 18:30)")
    return total


def _parse_date(value: Optional[str], label: str = "Date") -> date:
    v = (value or "").strip()
    if not DATE_RE.match(v):
        raise _bad(f"{label} must be in YYYY-MM-DD format")
    try:
        return date.fromisoformat(v)
    except ValueError:
        raise _bad(f"{label} isn't a real date")


def _clock(minutes: int, with_period: bool = True) -> str:
    """18:30 -> "6:30 PM"."""
    h, m = divmod(minutes % (24 * 60), 60)
    text = f"{h % 12 or 12}:{m:02d}"
    return f"{text} {'AM' if h < 12 else 'PM'}" if with_period else text


def _time_range(start: int, end: int) -> str:
    """"6:00–7:00 PM", or "11:00 AM–1:00 PM" across noon."""
    same_half = ((start % 1440) < 720) == ((end % 1440) < 720)
    return f"{_clock(start, with_period=not same_half)}–{_clock(end)}"


def _day(d: date) -> str:
    """"Sat 14 Nov"."""
    return f"{d.strftime('%a')} {d.day} {d.strftime('%b')}"


def _starts_at(d: date, minutes: int) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=BUSINESS_TZ) + timedelta(minutes=minutes)


def _display_time() -> str:
    """Timeline time in India time, e.g. "25 Oct 2026, 04:30 PM" (same as shop orders)."""
    return _now().strftime("%d %b %Y, %I:%M %p")


def _rupees(amount: float) -> str:
    amount = float(amount or 0)
    return f"₹{amount:,.0f}" if amount.is_integer() else f"₹{amount:,.2f}"


def _plural(n: int, word: str) -> str:
    return f"{n} {word}" if n == 1 else f"{n} {word}s"


def _shop_phone(db: Session) -> str:
    return shop_display_phone(get_shop_settings(db).get("phone") or "")


# ---------------- Pricing, slot grid, blocks ----------------

def hourly_rate(venue: CourtVenueModel, day: date, start: int) -> float:
    if day.weekday() >= 5 and venue.weekendPricePerHour:
        return float(venue.weekendPricePerHour)
    if venue.peakPricePerHour and venue.peakStart and venue.peakEnd and \
            _mins(venue.peakStart) <= start < _mins(venue.peakEnd):
        return float(venue.peakPricePerHour)
    return float(venue.pricePerHour)


def slot_price(venue: CourtVenueModel, day: date, start: int) -> float:
    return round(hourly_rate(venue, day, start) * venue.slotMinutes / 60, 2)


def _slot_starts(venue: CourtVenueModel) -> List[int]:
    step = venue.slotMinutes
    return list(range(_mins(venue.openTime), _mins(venue.closeTime) - step + 1, step))


def _block_applies(block: CourtBlockModel, day: date, court_id: str) -> bool:
    if block.courtId and block.courtId != court_id:
        return False
    key = day.isoformat()
    if block.date:
        return block.date == key
    if not block.weekdays or day.weekday() not in block.weekdays:
        return False
    if block.fromDate and key < block.fromDate:
        return False
    if block.toDate and key > block.toDate:
        return False
    return True


def _venue_blocks(db: Session, venue_id: str) -> List[CourtBlockModel]:
    return db.query(CourtBlockModel).filter(CourtBlockModel.venueId == venue_id).all()


def _blocked_by(blocks: Iterable[CourtBlockModel], day: date, court_id: str, start: int, end: int) -> Optional[CourtBlockModel]:
    for block in blocks:
        if _block_applies(block, day, court_id) and _mins(block.startTime) < end and start < _mins(block.endTime):
            return block
    return None


def _taken_units(db: Session, court_ids: List[str], day: date) -> Set[Tuple[str, int]]:
    """(courtId, minutes) of every 30-minute piece held by an active booking on that day."""
    if not court_ids:
        return set()
    rows = (
        db.query(CourtBookingSlotModel.courtId, CourtBookingSlotModel.startTime)
        .filter(CourtBookingSlotModel.courtId.in_(court_ids), CourtBookingSlotModel.date == day.isoformat())
        .all()
    )
    return {(court_id, _mins(start)) for court_id, start in rows}


def _window_problem(venue: CourtVenueModel, day: date) -> Optional[str]:
    today = _today()
    if day < today:
        return "This date has passed — pick today or a later date."
    if (day - today).days > venue.advanceDays:
        last = today + timedelta(days=venue.advanceDays)
        return f"Courts can be booked up to {_plural(venue.advanceDays, 'day')} ahead (until {_day(last)})."
    return None


# ---------------- Venues: serialisation & validation ----------------

_VENUE_FIELDS = ("name", "address", "area", "mapsUrl", "description", "photos", "amenities", "rules",
                 "openTime", "closeTime", "slotMinutes", "pricePerHour", "peakPricePerHour", "peakStart",
                 "peakEnd", "weekendPricePerHour", "advanceDays", "maxSlotsPerBooking", "cancellationHours",
                 "isActive", "sortOrder")
# A null in an update means "leave as is" for these (the others can be cleared with null).
_VENUE_REQUIRED = ("name", "address", "photos", "amenities", "openTime", "closeTime", "slotMinutes",
                   "pricePerHour", "advanceDays", "maxSlotsPerBooking", "cancellationHours", "isActive", "sortOrder")
_COURT_FIELDS = ("name", "surface", "isActive", "sortOrder")


def serialize_venue(venue: CourtVenueModel, active_courts_only: bool = False) -> CourtVenueSchema:
    courts = [c for c in venue.courts if c.isActive or not active_courts_only]
    courts.sort(key=lambda c: (c.sortOrder or 0, c.name.casefold()))
    return CourtVenueSchema(
        id=venue.id,
        createdAt=venue.createdAt,
        courts=[CourtSchema.model_validate(c) for c in courts],
        **{k: getattr(venue, k) for k in _VENUE_FIELDS if k not in ("photos", "amenities", "isActive", "sortOrder")},
        photos=list(venue.photos or []),
        amenities=list(venue.amenities or []),
        isActive=bool(venue.isActive),
        sortOrder=venue.sortOrder or 0,
    )


def _sort_order(value: Optional[int]) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, bool) or not (-SORT_ORDER_MAX <= value <= SORT_ORDER_MAX):
        raise _bad("Sort order is out of range")
    return value


def _whole_number(value: Any, label: str, low: int, high: int, unit: str = "") -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not (low <= value <= high):
        suffix = f" {unit}" if unit else ""
        raise _bad(f"{label} must be a whole number from {low} to {high}{suffix}")
    return value


def _price(value: Optional[float], label: str, required: bool = False) -> Optional[float]:
    if value is None:
        if required:
            raise _bad(f"{label} is required")
        return None
    price = float(value)
    if not math.isfinite(price) or price <= 0:
        raise _bad(f"{label} must be more than ₹0")
    if price > PRICE_MAX:
        raise _bad(f"{label} must be at most ₹{PRICE_MAX:,}")
    return round(price, 2)


def _clean_photos(photos: Optional[List[str]]) -> List[str]:
    photos = list(photos or [])
    if len(photos) > PHOTOS_MAX:
        raise _bad(f"Add at most {PHOTOS_MAX} photos")
    cleaned: List[str] = []
    for url in photos:
        url = (url or "").strip()
        if len(url) > LINK_MAX:
            raise _bad(f"Photo links must be at most {LINK_MAX} characters")
        url = validate_link(url or None, "Photo")
        if url and url not in cleaned:
            cleaned.append(url)
    return cleaned


def _clean_amenities(amenities: Optional[List[str]]) -> List[str]:
    cleaned: List[str] = []
    seen = set()
    for item in amenities or []:
        label = " ".join((item or "").split())
        if not label:
            continue
        if len(label) > AMENITY_MAX:
            raise _bad(f"Each amenity must be at most {AMENITY_MAX} characters")
        if label.casefold() not in seen:
            seen.add(label.casefold())
            cleaned.append(label)
    if len(cleaned) > AMENITIES_MAX:
        raise _bad(f"Add at most {AMENITIES_MAX} amenities")
    return cleaned


def _clean_venue(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validates a full set of venue fields (create, or an update merged onto the stored venue)."""
    d = dict(data)
    d["name"] = _text(d.get("name"), "Venue name", VENUE_NAME_MAX, required=True, min_len=VENUE_NAME_MIN)
    d["address"] = _text(d.get("address"), "Address", ADDRESS_MAX, required=True, min_len=ADDRESS_MIN)
    d["area"] = _text(d.get("area"), "Area", AREA_MAX)
    maps = _text(d.get("mapsUrl"), "Map link", LINK_MAX)
    d["mapsUrl"] = validate_link(maps, "Map link", allow_relative=False)
    d["description"] = _text(d.get("description"), "Description", DESCRIPTION_MAX, single_line=False)
    d["rules"] = _text(d.get("rules"), "Rules", RULES_MAX, single_line=False)
    d["photos"] = _clean_photos(d.get("photos"))
    d["amenities"] = _clean_amenities(d.get("amenities"))

    open_ = _parse_time(d.get("openTime"), "Opening time")
    close = _parse_time(d.get("closeTime"), "Closing time", allow_midnight=True)
    if open_ >= close:
        raise _bad("Opening time must be before the closing time")
    slot = d.get("slotMinutes")
    if isinstance(slot, bool) or slot not in SLOT_LENGTHS:
        raise _bad("Slot length must be 30 or 60 minutes")
    if (close - open_) % slot:
        raise _bad(f"With {slot}-minute slots the opening hours must be whole hours "
                   f"({_clock(open_)} to {_clock(close)} leaves half an hour over)")
    d["openTime"], d["closeTime"] = _hhmm(open_), _hhmm(close)

    d["pricePerHour"] = _price(d.get("pricePerHour"), "Price per hour", required=True)
    d["peakPricePerHour"] = _price(d.get("peakPricePerHour"), "Peak price per hour")
    d["weekendPricePerHour"] = _price(d.get("weekendPricePerHour"), "Weekend price per hour")
    peak_start_raw, peak_end_raw = (d.get("peakStart") or "").strip(), (d.get("peakEnd") or "").strip()
    if peak_start_raw or peak_end_raw or d["peakPricePerHour"] is not None:
        if not peak_start_raw or not peak_end_raw:
            raise _bad("Set both the start and the end of the peak hours")
        peak_start = _parse_time(peak_start_raw, "Peak start")
        peak_end = _parse_time(peak_end_raw, "Peak end", allow_midnight=True)
        if peak_start >= peak_end:
            raise _bad("Peak hours must start before they end")
        if peak_start < open_ or peak_end > close:
            raise _bad(f"Peak hours must be within the opening hours ({_clock(open_)} to {_clock(close)})")
        d["peakStart"], d["peakEnd"] = _hhmm(peak_start), _hhmm(peak_end)
    else:
        d["peakStart"] = d["peakEnd"] = None

    d["advanceDays"] = _whole_number(d.get("advanceDays"), "Booking window", *ADVANCE_DAYS, unit="days")
    d["maxSlotsPerBooking"] = _whole_number(d.get("maxSlotsPerBooking"), "Slots per booking", *MAX_SLOTS)
    d["cancellationHours"] = _whole_number(d.get("cancellationHours"), "Cancellation cut-off", *CANCELLATION_HOURS, unit="hours")
    d["isActive"] = bool(d.get("isActive"))
    d["sortOrder"] = _sort_order(d.get("sortOrder"))
    return d


def _clean_court(data: Dict[str, Any]) -> Dict[str, Any]:
    d = dict(data)
    d["name"] = _text(d.get("name"), "Court name", COURT_NAME_MAX, required=True)
    d["surface"] = _text(d.get("surface"), "Surface", SURFACE_MAX)
    d["isActive"] = bool(d.get("isActive"))
    d["sortOrder"] = _sort_order(d.get("sortOrder"))
    return d


def _get_venue(db: Session, venue_id: str) -> CourtVenueModel:
    venue = (
        db.query(CourtVenueModel)
        .options(selectinload(CourtVenueModel.courts))
        .filter(CourtVenueModel.id == venue_id)
        .first()
    )
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    return venue


def _get_court(db: Session, court_id: str) -> CourtModel:
    court = db.query(CourtModel).filter(CourtModel.id == court_id).first()
    if not court:
        raise HTTPException(status_code=404, detail="Court not found")
    return court


def _assert_unique_court(venue: CourtVenueModel, name: str, exclude_id: Optional[str] = None) -> None:
    for court in venue.courts:
        if court.id != exclude_id and court.name.casefold() == name.casefold():
            raise _conflict(f"{venue.name} already has a court called {court.name}")


def _commit_court(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:  # the same name saved at the same moment by another admin tab
        db.rollback()
        raise _conflict("This venue already has a court with that name")


def _upcoming_confirmed(db: Session, *criteria) -> List[CourtBookingModel]:
    """Confirmed bookings (matching the criteria) that haven't finished yet."""
    now = _now()
    rows = (
        db.query(CourtBookingModel)
        .filter(CourtBookingModel.status == "Confirmed", CourtBookingModel.date >= now.date().isoformat(), *criteria)
        .all()
    )
    return [b for b in rows if _starts_at(date.fromisoformat(b.date), _mins(b.endTime)) > now]


# ---------------- Public ----------------

@router.get("/courts/venues", response_model=List[CourtVenueSchema])
def public_venues(db: Session = Depends(get_db)):
    venues = (
        db.query(CourtVenueModel)
        .options(selectinload(CourtVenueModel.courts))
        .filter(CourtVenueModel.isActive == True)  # noqa: E712
        .all()
    )
    venues.sort(key=lambda v: (v.sortOrder or 0, v.name.casefold()))
    return [serialize_venue(v, active_courts_only=True) for v in venues]


def venue_availability(db: Session, venue: CourtVenueModel, day: date) -> Dict[str, Any]:
    base = {"venueId": venue.id, "date": day.isoformat(), "slotMinutes": venue.slotMinutes}
    if not venue.isActive:
        return {**base, "bookable": False, "message": "This venue isn't taking bookings right now.", "courts": []}
    courts = sorted((c for c in venue.courts if c.isActive), key=lambda c: (c.sortOrder or 0, c.name.casefold()))
    if not courts:
        return {**base, "bookable": False, "message": "No courts are open for booking at this venue right now.", "courts": []}

    message = _window_problem(venue, day)
    now = _now()
    blocks = _venue_blocks(db, venue.id)
    taken = _taken_units(db, [c.id for c in courts], day)
    step = venue.slotMinutes
    starts = _slot_starts(venue)
    prices = {s: slot_price(venue, day, s) for s in starts}
    result = []
    for court in courts:
        cells = []
        for s in starts:
            e = s + step
            if _starts_at(day, s) <= now:
                state = "past"
            elif _blocked_by(blocks, day, court.id, s, e):
                state = "blocked"
            elif any((court.id, u) in taken for u in range(s, e, UNIT)):
                state = "booked"  # who booked it is never shown
            else:
                state = "free"
            cells.append({"start": _hhmm(s), "end": _hhmm(e), "state": state, "price": prices[s]})
        result.append({"courtId": court.id, "courtName": court.name, "surface": court.surface, "cells": cells})
    return {**base, "bookable": message is None, "message": message, "courts": result}


@router.get(
    "/courts/availability",
    response_model=VenueAvailabilitySchema,
    dependencies=[Depends(rate_limit("court-availability", limit=120, window_seconds=60))],  # loose: shared mobile IPs
)
def availability(
    venueId: str = Query(..., min_length=1, max_length=80),
    day: str = Query(..., alias="date", max_length=20),
    db: Session = Depends(get_db),
):
    venue = _get_venue(db, venueId)
    return venue_availability(db, venue, _parse_date(day))


# ---------------- Bookings ----------------

def _require_booking_access(user: CurrentUser) -> None:
    if user.is_staff and not user.is_admin:
        raise HTTPException(status_code=403, detail="Court bookings are handled by the admin")


def _booking_start(booking: CourtBookingModel) -> datetime:
    return _starts_at(date.fromisoformat(booking.date), _mins(booking.startTime))


def _booking_end(booking: CourtBookingModel) -> datetime:
    return _starts_at(date.fromisoformat(booking.date), _mins(booking.endTime))


def _cancel_cutoff(booking: CourtBookingModel) -> datetime:
    return _booking_start(booking) - timedelta(hours=booking.cancellationHours or 0)


def _when(booking: CourtBookingModel) -> str:
    """"Sat 14 Nov 6:00–7:00 PM"."""
    return f"{_day(date.fromisoformat(booking.date))} {_time_range(_mins(booking.startTime), _mins(booking.endTime))}"


def _can_cancel(booking: CourtBookingModel, user: CurrentUser) -> bool:
    if booking.status != "Confirmed":
        return False
    return user.is_admin or _now() < _cancel_cutoff(booking)


_BOOKING_FIELDS = ("id", "venueId", "venueName", "courtId", "courtName", "date", "startTime", "endTime", "slots",
                   "price", "customerName", "customerMobile", "players", "notes", "status", "paymentStatus",
                   "paymentMethod", "paidAt", "bookedBy", "cancelReason", "createdAt")


def serialize_booking(booking: CourtBookingModel, user: CurrentUser) -> CourtBookingSchema:
    return CourtBookingSchema(
        **{k: getattr(booking, k) for k in _BOOKING_FIELDS},
        canCancel=_can_cancel(booking, user),
        timeline=list(booking.timeline or []),
    )


def _new_booking_id(db: Session) -> str:
    for attempt in range(60):
        digits = 5 if attempt < 40 else 6
        candidate = f"CRT-{random.randint(10 ** (digits - 1), 10 ** digits - 1)}"
        if not db.query(CourtBookingModel.id).filter(CourtBookingModel.id == candidate).first():
            return candidate
    return f"CRT-{new_id('X')[2:]}"


def _load_booking(db: Session, booking_id: str, user: CurrentUser) -> CourtBookingModel:
    """A booking the user may see: customers only their own (404 otherwise), the admin any."""
    _require_booking_access(user)
    booking = db.query(CourtBookingModel).filter(CourtBookingModel.id == booking_id).first()
    if not booking or (not user.is_admin and booking.customerMobile != user.phone):
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


def _append_timeline(booking: CourtBookingModel, status_: str, label: str, actor: str, notes: Optional[str] = None) -> None:
    timeline = list(booking.timeline or [])
    timeline.append({"status": status_, "label": label, "timestamp": _display_time(), "actor": actor, "notes": notes})
    booking.timeline = timeline


def _notify_customer(db: Session, booking: CourtBookingModel, type_: str, title: str, message: str) -> None:
    create_notification(db=db, type_=type_, title=title, message=message, request_id=booking.id, target_roles=["CUSTOMER"])


def _notify_admin(db: Session, booking: CourtBookingModel, type_: str, title: str, message: str) -> None:
    create_notification(db=db, type_=type_, title=title, message=message, request_id=booking.id, target_roles=["ADMIN"])


def _stale(booking_id: str) -> HTTPException:
    return _conflict(f"{booking_id} was just changed by someone else. Refresh to see the latest status.")


def _ensure_customer_account(db: Session, mobile: str, name: str) -> None:
    """Walk-in / phone booking by the admin: make sure the customer has an account, so they
    can sign in with an SMS code later and see the booking (like staff service bookings)."""
    if db.query(CustomerModel.id).filter(CustomerModel.phone == mobile).first():
        return
    db.add(CustomerModel(
        id=new_id("CUST")[:15],
        name=name,
        email=None,
        phone=mobile,
        address=None,
        password=None,
        createdAt=_now().strftime("%d %b %Y, %I:%M %p"),
    ))
    try:
        db.commit()
    except IntegrityError:  # created at the same moment (e.g. the customer just signed up)
        db.rollback()


@router.post("/court-bookings", response_model=CourtBookingSchema, status_code=status.HTTP_201_CREATED)
def create_booking(payload: CourtBookingCreate, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    _require_booking_access(user)
    by_admin = user.is_admin
    if by_admin:
        customer_name = _text(payload.customerName, "Customer name", CUSTOMER_NAME_MAX, required=True,
                              min_len=CUSTOMER_NAME_MIN)
        mobile = require_phone(payload.customerMobile, "Customer mobile number")
    else:
        rate_limiter.check(f"court-booking:{user.phone}", BOOKINGS_PER_HOUR, 3600)
        customer = db.query(CustomerModel).filter(CustomerModel.phone == user.phone).first()
        customer_name = " ".join((customer.name or "").split()) if customer else ""
        if not customer_name:
            raise HTTPException(status_code=403, detail="Please add your name to your account before booking a court")
        mobile = user.phone
    notes = _text(payload.notes, "Note", NOTES_MAX, single_line=False)
    players = payload.players
    if players is not None:
        players = _whole_number(players, "Players", 1, PLAYERS_MAX)

    venue = _get_venue(db, payload.venueId)
    if not venue.isActive:
        raise _conflict("This venue isn't taking bookings right now")
    court = next((c for c in venue.courts if c.id == payload.courtId), None)
    if not court:
        raise HTTPException(status_code=404, detail="Court not found")
    if not court.isActive:
        raise _conflict(f"{court.name} isn't open for booking right now — pick another court")

    day = _parse_date(payload.date)
    problem = _window_problem(venue, day)
    if problem:
        raise _bad(problem)
    step = venue.slotMinutes
    open_, close = _mins(venue.openTime), _mins(venue.closeTime)
    start = _parse_time(payload.startTime, "Start time")
    if start < open_ or start >= close or (start - open_) % step:
        raise _bad(f"Pick a start time from the list: {venue.name} has {step}-minute slots "
                   f"from {_clock(open_)} to {_clock(close)}")
    slots = payload.slots
    if isinstance(slots, bool) or not (1 <= slots <= venue.maxSlotsPerBooking):
        raise _bad(f"Book 1 to {_plural(venue.maxSlotsPerBooking, 'slot')} at a time")
    end = start + slots * step
    if end > close:
        raise _bad(f"{venue.name} closes at {_clock(close)} — pick an earlier start or fewer slots")
    if _starts_at(day, start) <= _now():
        raise _conflict("That time has already started — pick a later slot")

    if not by_admin:
        upcoming = _upcoming_confirmed(db, CourtBookingModel.customerMobile == mobile)
        if len(upcoming) >= MAX_UPCOMING_PER_CUSTOMER:
            raise _conflict(
                f"You already have {len(upcoming)} upcoming court bookings. You can book again once one of them "
                f"is over or cancelled."
            )

    blocks = _venue_blocks(db, venue.id)
    for s in range(start, end, step):
        block = _blocked_by(blocks, day, court.id, s, s + step)
        if block:
            when = f"{_time_range(s, s + step)} on {_day(day)}"
            if by_admin:
                raise _conflict(f"{court.name} is blocked at {when} ({block.reason})")
            raise _conflict(f"{court.name} isn't available at {when} — pick another time or court")
    taken = _taken_units(db, [court.id], day)
    if any((court.id, u) in taken for u in range(start, end, UNIT)):
        raise _conflict("That time is already booked — pick another slot")

    price = round(sum(slot_price(venue, day, s) for s in range(start, end, step)), 2)
    if by_admin:
        _ensure_customer_account(db, mobile, customer_name)

    booking_id = _new_booking_id(db)
    when = f"{_day(day)} {_time_range(start, end)}"
    booking = CourtBookingModel(
        id=booking_id,
        venueId=venue.id,
        venueName=venue.name,
        courtId=court.id,
        courtName=court.name,
        date=day.isoformat(),
        startTime=_hhmm(start),
        endTime=_hhmm(end),
        slots=slots,
        price=price,
        customerName=customer_name,
        customerMobile=mobile,
        players=players,
        notes=notes,
        status="Confirmed",
        paymentStatus="Pending",
        bookedBy="admin" if by_admin else "customer",
        cancellationHours=venue.cancellationHours or 0,
        createdAt=now_iso(),
        timeline=[{
            "status": "Confirmed",
            "label": STATUS_LABELS["Confirmed"],
            "timestamp": _display_time(),
            "actor": user.label if by_admin else f"Customer ({customer_name})",
            "notes": f"{court.name}, {when} · {_rupees(price)}" + (" · walk-in / phone booking" if by_admin else ""),
        }],
    )
    # One row per 30-minute piece: the unique (courtId, date, startTime) refuses a second
    # booking of the same time, even one saved a moment earlier by another request.
    try:
        db.add(booking)
        db.flush()
        db.add_all([
            CourtBookingSlotModel(id=new_id("CBS"), bookingId=booking_id, courtId=court.id, date=day.isoformat(),
                                  startTime=_hhmm(u))
            for u in range(start, end, UNIT)
        ])
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _conflict(SLOT_TAKEN)
    db.refresh(booking)

    log_audit(db, user.label if by_admin else customer_name, user.role, f"Booked {court.name} for {when}",
              booking.id, f"{venue.name} · {_rupees(price)}" + (f" · for {customer_name}" if by_admin else ""))
    if by_admin:
        _notify_customer(db, booking, "new_request", f"Court booked: {booking.id}",
                         f"{venue.name} booked {court.name} for you on {when} ({_rupees(price)}, pay at the venue).")
    else:
        _notify_admin(db, booking, "new_request", f"Court booking {booking.id}",
                      f"Court booked: {court.name}, {when} — {customer_name}, {display_phone(mobile)}")
    return serialize_booking(booking, user)


@router.get("/court-bookings", response_model=List[CourtBookingSchema])
def list_bookings(
    from_: Optional[str] = Query(None, alias="from", max_length=20),
    to: Optional[str] = Query(None, max_length=20),
    venueId: Optional[str] = Query(None, max_length=80),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    _require_booking_access(user)
    if not user.is_admin:
        # The customer's own bookings: upcoming ones first (soonest first), then the rest, latest first.
        bookings = db.query(CourtBookingModel).filter(CourtBookingModel.customerMobile == user.phone).all()
        now = _now()
        upcoming = [b for b in bookings if b.status == "Confirmed" and _booking_end(b) > now]
        upcoming_ids = {b.id for b in upcoming}
        rest = [b for b in bookings if b.id not in upcoming_ids]
        upcoming.sort(key=lambda b: (b.date, b.startTime, b.id))
        rest.sort(key=lambda b: (b.date, b.startTime, b.id), reverse=True)
        return [serialize_booking(b, user) for b in upcoming + rest]

    start = _parse_date(from_, "From date") if from_ else _today()
    query = db.query(CourtBookingModel).filter(CourtBookingModel.date >= start.isoformat())
    if to:
        end = _parse_date(to, "To date")
        if end < start:
            raise _bad("The 'to' date must be on or after the 'from' date")
        query = query.filter(CourtBookingModel.date <= end.isoformat())
    if venueId:
        query = query.filter(CourtBookingModel.venueId == venueId)
    bookings = query.order_by(CourtBookingModel.date, CourtBookingModel.startTime, CourtBookingModel.courtName,
                              CourtBookingModel.id).all()
    return [serialize_booking(b, user) for b in bookings]


@router.get("/court-bookings/{booking_id}", response_model=CourtBookingSchema)
def get_booking(booking_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    return serialize_booking(_load_booking(db, booking_id, user), user)


@router.post("/court-bookings/{booking_id}/cancel", response_model=CourtBookingSchema)
def cancel_booking(booking_id: str, payload: CourtBookingCancelInput, db: Session = Depends(get_db),
                   user: CurrentUser = Depends(get_current_user)):
    booking = _load_booking(db, booking_id, user)
    reason = _text(payload.reason, "Reason", CANCEL_REASON_MAX, required=True, single_line=False,
                   min_len=CANCEL_REASON_MIN)
    if booking.status == "Cancelled":
        raise _conflict(f"{booking.id} is already cancelled")
    if booking.status != "Confirmed":
        raise _conflict(f"{booking.id} is already marked {booking.status}, so it can't be cancelled")
    by_customer = not user.is_admin
    if by_customer and _now() >= _cancel_cutoff(booking):
        start = _booking_start(booking)
        if booking.cancellationHours:
            cutoff = _cancel_cutoff(booking)
            detail = (f"Bookings can be cancelled online until {_plural(booking.cancellationHours, 'hour')} before "
                      f"the start (that was {_clock(cutoff.hour * 60 + cutoff.minute)} on {_day(cutoff.date())}).")
        elif _now() >= start:
            detail = "This booking has already started, so it can't be cancelled online."
        else:
            detail = "This booking can't be cancelled online any more."
        raise _conflict(f"{detail} Please call us on {_shop_phone(db)}.")

    claimed = (
        db.query(CourtBookingModel)
        .filter(CourtBookingModel.id == booking.id, CourtBookingModel.status == "Confirmed")
        .update({CourtBookingModel.status: "Cancelled"}, synchronize_session=False)
    )
    if not claimed:
        db.rollback()
        raise _stale(booking.id)
    # Free the court time.
    db.query(CourtBookingSlotModel).filter(CourtBookingSlotModel.bookingId == booking.id).delete(synchronize_session=False)
    booking.status = "Cancelled"
    booking.cancelReason = reason
    notes = reason
    if booking.paymentStatus == "Paid":
        notes = f"{reason} {_rupees(booking.paidAmount or booking.price)} was already paid — refund it to the customer."
    _append_timeline(booking, "Cancelled", STATUS_LABELS["Cancelled"],
                     f"Customer ({booking.customerName})" if by_customer else user.label, notes)
    db.commit()
    db.refresh(booking)

    log_audit(db, booking.customerName if by_customer else user.label, user.role, "Cancelled court booking",
              booking.id, reason)
    summary = f"{booking.courtName}, {_when(booking)}"
    if by_customer:
        _notify_admin(db, booking, "status_update", f"Court booking {booking.id} cancelled",
                      f"{booking.customerName} cancelled court booking {booking.id} ({summary}): {reason}")
    else:
        _notify_customer(db, booking, "status_update", f"Court booking {booking.id} cancelled",
                         f"Your court booking {booking.id} ({summary}) has been cancelled: {reason}")
    return serialize_booking(booking, user)


def _get_booking_for_admin(db: Session, booking_id: str) -> CourtBookingModel:
    booking = db.query(CourtBookingModel).filter(CourtBookingModel.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


@router.patch("/court-bookings/{booking_id}/status", response_model=CourtBookingSchema)
def update_booking_status(booking_id: str, payload: CourtBookingStatusUpdate, db: Session = Depends(get_db),
                          admin: CurrentUser = Depends(require_admin)):
    booking = _get_booking_for_admin(db, booking_id)
    notes = _text(payload.notes, "Note", NOTES_MAX, single_line=False)
    new_status = payload.status
    if booking.status == "Cancelled":
        raise _conflict(f"{booking.id} was cancelled")
    if booking.status != "Confirmed":
        raise _conflict(f"{booking.id} is already marked {booking.status}")
    start = _booking_start(booking)
    if _now() < start:
        raise _conflict(f"{booking.id} starts at {_clock(_mins(booking.startTime))} on "
                        f"{_day(start.date())} — you can mark it {new_status} once the time has started.")

    claimed = (
        db.query(CourtBookingModel)
        .filter(CourtBookingModel.id == booking.id, CourtBookingModel.status == "Confirmed")
        .update({CourtBookingModel.status: new_status}, synchronize_session=False)
    )
    if not claimed:
        db.rollback()
        raise _stale(booking.id)
    booking.status = new_status
    _append_timeline(booking, new_status, STATUS_LABELS[new_status], admin.label, notes)
    db.commit()
    db.refresh(booking)
    log_audit(db, admin.label, admin.role, f"Court booking marked {new_status}", booking.id, notes)
    return serialize_booking(booking, admin)


@router.post("/court-bookings/{booking_id}/payment", response_model=CourtBookingSchema)
def record_booking_payment(booking_id: str, payload: CourtBookingPaymentInput, db: Session = Depends(get_db),
                           admin: CurrentUser = Depends(require_admin)):
    booking = _get_booking_for_admin(db, booking_id)
    if booking.status == "Cancelled":
        raise _conflict(f"{booking.id} was cancelled — there is nothing to collect")
    if booking.paymentStatus == "Paid":
        raise _conflict(f"Payment for {booking.id} has already been recorded")
    amount = float(payload.amount)
    if amount <= 0:
        raise _bad("Enter the amount received (more than ₹0)")
    notes = _text(payload.notes, "Note", NOTES_MAX, single_line=False)
    price = round(float(booking.price or 0), 2)
    if abs(amount - price) > 1 and not notes:  # ₹1 tolerance for rounding
        raise _bad(f"The booking price is {_rupees(price)}. Record exactly that amount, or add a note explaining "
                   f"the difference (e.g. a discount).")

    # Two admin tabs recording the same payment: only one conditional UPDATE can match.
    claimed = (
        db.query(CourtBookingModel)
        .filter(CourtBookingModel.id == booking.id, CourtBookingModel.status != "Cancelled",
                CourtBookingModel.paymentStatus != "Paid")
        .update({CourtBookingModel.paymentStatus: "Paid"}, synchronize_session=False)
    )
    if not claimed:
        db.rollback()
        raise _stale(booking.id)
    amount = round(amount, 2)
    booking.paymentStatus = "Paid"
    booking.paymentMethod = payload.method
    booking.paidAmount = amount
    booking.paidAt = now_iso()
    _append_timeline(booking, "Payment Received", f"{_rupees(amount)} received via {payload.method}", admin.label, notes)
    db.commit()
    db.refresh(booking)

    log_audit(db, admin.label, admin.role, f"Recorded {_rupees(amount)} court payment ({payload.method})", booking.id, notes)
    _notify_customer(db, booking, "payment", f"Court booking {booking.id}: payment received",
                     f"Payment of {_rupees(amount)} received for court booking {booking.id}. Thank you!")
    return serialize_booking(booking, admin)


# ---------------- Admin: venues & courts ----------------

@router.get("/courts/admin/venues", response_model=List[CourtVenueSchema])
def admin_list_venues(db: Session = Depends(get_db), _: CurrentUser = Depends(require_admin)):
    venues = db.query(CourtVenueModel).options(selectinload(CourtVenueModel.courts)).all()
    venues.sort(key=lambda v: (v.sortOrder or 0, v.name.casefold()))
    return [serialize_venue(v) for v in venues]


@router.post("/courts/admin/venues", response_model=CourtVenueSchema, status_code=status.HTTP_201_CREATED)
def admin_create_venue(payload: CourtVenueCreate, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    data = _clean_venue(payload.model_dump())
    if data.get("sortOrder") is None:
        data["sortOrder"] = db.query(CourtVenueModel).count()
    venue = CourtVenueModel(id=new_id("VEN"), createdAt=now_iso(), **{k: data[k] for k in _VENUE_FIELDS})
    db.add(venue)
    db.commit()
    log_audit(db, admin.label, "ADMIN", f"Added court venue: {venue.name}", "CONTENT",
              f"{venue.openTime}–{venue.closeTime}, {_rupees(venue.pricePerHour)}/hour")
    return serialize_venue(_get_venue(db, venue.id))


@router.put("/courts/admin/venues/{venue_id}", response_model=CourtVenueSchema)
def admin_update_venue(venue_id: str, payload: CourtVenueUpdate, db: Session = Depends(get_db),
                       admin: CurrentUser = Depends(require_admin)):
    venue = _get_venue(db, venue_id)
    changes = {k: v for k, v in payload.model_dump(exclude_unset=True).items()
               if not (k in _VENUE_REQUIRED and v is None)}
    current = {k: getattr(venue, k) for k in _VENUE_FIELDS}
    data = _clean_venue({**current, **changes})
    if data.get("sortOrder") is None:
        data["sortOrder"] = venue.sortOrder or 0
    for key in _VENUE_FIELDS:
        setattr(venue, key, data[key])
    db.commit()
    log_audit(db, admin.label, "ADMIN", f"Updated court venue: {venue.name}", "CONTENT")
    return serialize_venue(_get_venue(db, venue_id))


def _refuse_if_upcoming(bookings: List[CourtBookingModel], what: str) -> None:
    if bookings:
        first = min(bookings, key=lambda b: (b.date, b.startTime))
        raise _conflict(
            f"{what} has {_plural(len(bookings), 'upcoming booking')} (the next is {first.id} on {_when(first)}). "
            f"Cancel {'it' if len(bookings) == 1 else 'them'} first, then delete."
        )


@router.delete("/courts/admin/venues/{venue_id}")
def admin_delete_venue(venue_id: str, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    # Past bookings keep their own venue / court names, so deleting the venue doesn't change them.
    venue = _get_venue(db, venue_id)
    _refuse_if_upcoming(_upcoming_confirmed(db, CourtBookingModel.venueId == venue.id), venue.name)
    name = venue.name
    db.delete(venue)  # courts and blocked times go with it
    db.commit()
    log_audit(db, admin.label, "ADMIN", f"Deleted court venue: {name}", "CONTENT")
    return {"success": True}


@router.post("/courts/admin/venues/{venue_id}/courts", response_model=CourtSchema, status_code=status.HTTP_201_CREATED)
def admin_add_court(venue_id: str, payload: CourtCreate, db: Session = Depends(get_db),
                    admin: CurrentUser = Depends(require_admin)):
    venue = _get_venue(db, venue_id)
    data = _clean_court(payload.model_dump())
    _assert_unique_court(venue, data["name"])
    if data.get("sortOrder") is None:
        data["sortOrder"] = max([c.sortOrder or 0 for c in venue.courts], default=-1) + 1
    # "CT-" so court ids never look like booking ids ("CRT-12345"), which notifications route on.
    court = CourtModel(id=new_id("CT"), venueId=venue.id, **{k: data[k] for k in _COURT_FIELDS})
    db.add(court)
    _commit_court(db)
    db.refresh(court)
    log_audit(db, admin.label, "ADMIN", f"Added {court.name} at {venue.name}", "CONTENT")
    return court


@router.put("/courts/admin/courts/{court_id}", response_model=CourtSchema)
def admin_update_court(court_id: str, payload: CourtUpdate, db: Session = Depends(get_db),
                       admin: CurrentUser = Depends(require_admin)):
    court = _get_court(db, court_id)
    venue = _get_venue(db, court.venueId)
    changes = {k: v for k, v in payload.model_dump(exclude_unset=True).items()
               if not (k in ("name", "isActive", "sortOrder") and v is None)}
    current = {k: getattr(court, k) for k in _COURT_FIELDS}
    data = _clean_court({**current, **changes})
    if data.get("sortOrder") is None:
        data["sortOrder"] = court.sortOrder or 0
    _assert_unique_court(venue, data["name"], exclude_id=court.id)
    for key in _COURT_FIELDS:
        setattr(court, key, data[key])
    _commit_court(db)
    db.refresh(court)
    log_audit(db, admin.label, "ADMIN", f"Updated {court.name} at {venue.name}", "CONTENT")
    return court


@router.delete("/courts/admin/courts/{court_id}")
def admin_delete_court(court_id: str, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    court = _get_court(db, court_id)
    _refuse_if_upcoming(_upcoming_confirmed(db, CourtBookingModel.courtId == court.id), court.name)
    name = court.name
    db.query(CourtBlockModel).filter(CourtBlockModel.courtId == court.id).delete(synchronize_session=False)
    db.delete(court)
    db.commit()
    log_audit(db, admin.label, "ADMIN", f"Deleted {name}", "CONTENT")
    return {"success": True}


# ---------------- Admin: blocked times ----------------

@router.get("/courts/admin/venues/{venue_id}/blocks", response_model=List[CourtBlockSchema])
def admin_list_blocks(venue_id: str, db: Session = Depends(get_db), _: CurrentUser = Depends(require_admin)):
    venue = _get_venue(db, venue_id)
    blocks = _venue_blocks(db, venue.id)
    blocks.sort(key=lambda b: (b.date or b.fromDate or "", b.startTime, b.createdAt))
    return blocks


@router.post("/courts/admin/blocks", response_model=CourtBlockSchema, status_code=status.HTTP_201_CREATED)
def admin_create_block(payload: CourtBlockCreate, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    venue = _get_venue(db, payload.venueId)
    court_id = (payload.courtId or "").strip() or None
    court = None
    if court_id:
        court = next((c for c in venue.courts if c.id == court_id), None)
        if not court:
            raise HTTPException(status_code=404, detail="Court not found at this venue")
    start = _parse_time(payload.startTime, "Start time")
    end = _parse_time(payload.endTime, "End time", allow_midnight=True)
    if start >= end:
        raise _bad("The start time must be before the end time")
    reason = _text(payload.reason, "Reason", BLOCK_REASON_MAX, required=True, min_len=BLOCK_REASON_MIN)

    today = _today()
    has_date = bool((payload.date or "").strip())
    has_weekdays = bool(payload.weekdays)
    if has_date and has_weekdays:
        raise _bad("Choose either a single date or days of the week, not both")
    if not has_date and not has_weekdays:
        raise _bad("Choose a date, or the days of the week this time is blocked")
    block_date = from_date = to_date = None
    weekdays = None
    if has_date:
        block_date = _parse_date(payload.date)
        if block_date < today:
            raise _bad("That date has already passed")
    else:
        if any(isinstance(d, bool) or not (0 <= d <= 6) for d in payload.weekdays):
            raise _bad("Days of the week must be numbers from 0 (Monday) to 6 (Sunday)")
        weekdays = sorted(set(payload.weekdays))
        from_date = _parse_date(payload.fromDate, "From date") if (payload.fromDate or "").strip() else today
        if (payload.toDate or "").strip():
            to_date = _parse_date(payload.toDate, "Until date")
            if to_date < from_date:
                raise _bad("The 'until' date must be on or after the 'from' date")
            if to_date < today:
                raise _bad("The 'until' date has already passed")

    block = CourtBlockModel(
        id=new_id("BLK"),
        venueId=venue.id,
        courtId=court.id if court else None,
        date=block_date.isoformat() if block_date else None,
        weekdays=weekdays,
        fromDate=from_date.isoformat() if from_date else None,
        toDate=to_date.isoformat() if to_date else None,
        startTime=_hhmm(start),
        endTime=_hhmm(end),
        reason=reason,
        createdAt=now_iso(),
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    where = court.name if court else f"all courts at {venue.name}"
    log_audit(db, admin.label, "ADMIN", f"Blocked {where}", "CONTENT",
              f"{reason}: {block.date or 'weekly'} {_time_range(start, end)}")
    return block


@router.delete("/courts/admin/blocks/{block_id}")
def admin_delete_block(block_id: str, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    block = db.query(CourtBlockModel).filter(CourtBlockModel.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Blocked time not found")
    reason = block.reason
    db.delete(block)
    db.commit()
    log_audit(db, admin.label, "ADMIN", f"Removed blocked time: {reason}", "CONTENT")
    return {"success": True}
