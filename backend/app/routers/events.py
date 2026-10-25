"""Events: tournaments, coaching camps, clinics and store events.

Public (no login): list upcoming / ongoing events and register for events whose
registrationMode is "form". Admin: create / edit / hide / delete events, see the
registrations and cancel or restore them.

Every event response carries server-computed fields (dates in Asia/Kolkata):
status, registrationOpen, registrationCount and spotsLeft.
"""
import math
import re
from datetime import date, timedelta
from typing import Dict, Iterable, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import EventModel, EventRegistrationModel
from app.schemas import (
    EventBase,
    EventCreate,
    EventRegistrationCreate,
    EventRegistrationSchema,
    EventRegistrationUpdate,
    EventSchema,
    EventUpdate,
)
from app.security import CurrentUser, rate_limit, require_admin
from app.services.content_service import business_today, new_id, now_iso, validate_link
from app.services.notification_service import create_notification, log_audit
from app.services.shop_settings import display_phone as shop_display_phone, get_shop_settings
from app.services.sms_service import display_phone, require_phone

router = APIRouter(prefix="/content", tags=["Events"])

PAST_EVENTS_DAYS = 90  # how far back ?include_past=true reaches

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TITLE_MAX = 120
SUMMARY_MAX = 300
DESCRIPTION_MAX = 5000
TIME_TEXT_MAX = 80
VENUE_MAX = 200
FEE_NOTE_MAX = 40
FEE_MAX = 1_000_000
CATEGORY_MAX = 40
CATEGORIES_MAX = 12
CAPACITY_MAX = 10_000
NAME_MIN, NAME_MAX = 2, 80
PARTNER_MAX = 80
NOTES_MAX = 500

EVENT_INPUT_FIELDS = tuple(EventBase.model_fields) + ("sortOrder",)
EVENT_COLUMNS = tuple(c.name for c in EventModel.__table__.columns)


# ---------------- Computed fields ----------------

def event_status(event: EventModel, today: str) -> str:
    """'upcoming' before the start date, 'ongoing' from start to end (inclusive), else 'past'."""
    if today < event.startDate:
        return "upcoming"
    if today <= (event.endDate or event.startDate):
        return "ongoing"
    return "past"


def registration_open(event: EventModel, today: str, count: int) -> bool:
    if event.registrationMode == "none" or not event.isActive:
        return False
    if event_status(event, today) == "past":
        return False
    if today > (event.registrationDeadline or event.startDate):
        return False
    if event.registrationMode == "form" and event.capacity and count >= event.capacity:
        return False
    return True


def spots_left(event: EventModel, count: int) -> Optional[int]:
    """Only meaningful for website registrations; other modes aren't counted here."""
    if event.registrationMode != "form" or not event.capacity:
        return None
    return max(event.capacity - count, 0)


def serialize_event(event: EventModel, count: int, today: str) -> EventSchema:
    data = {name: getattr(event, name) for name in EVENT_COLUMNS}
    data["categories"] = list(event.categories or [])
    data["showAsBanner"] = bool(event.showAsBanner)
    data["isActive"] = bool(event.isActive)
    data["sortOrder"] = event.sortOrder or 0
    return EventSchema(
        **data,
        status=event_status(event, today),
        registrationOpen=registration_open(event, today, count),
        registrationCount=count,
        spotsLeft=spots_left(event, count),
    )


def active_registration_counts(db: Session, event_ids: Optional[Iterable[str]] = None) -> Dict[str, int]:
    query = (
        db.query(EventRegistrationModel.eventId, func.count(EventRegistrationModel.id))
        .filter(EventRegistrationModel.status == "registered")
    )
    if event_ids is not None:
        ids = list(event_ids)
        if not ids:
            return {}
        query = query.filter(EventRegistrationModel.eventId.in_(ids))
    return {event_id: n for event_id, n in query.group_by(EventRegistrationModel.eventId).all()}


def public_events(db: Session, include_past: bool = False) -> List[EventSchema]:
    """Published events that are upcoming or ongoing (plus the last 90 days of past
    events when include_past), soonest first."""
    today = business_today()
    today_s = today.isoformat()
    since = (today - timedelta(days=PAST_EVENTS_DAYS)).isoformat() if include_past else today_s
    events = (
        db.query(EventModel)
        .filter(EventModel.isActive == True)  # noqa: E712
        .filter(func.coalesce(EventModel.endDate, EventModel.startDate) >= since)
        .order_by(EventModel.startDate, EventModel.sortOrder, EventModel.createdAt)
        .all()
    )
    counts = active_registration_counts(db, [e.id for e in events])
    return [serialize_event(e, counts.get(e.id, 0), today_s) for e in events]


# ---------------- Validation ----------------

def _bad(detail: str) -> HTTPException:
    return HTTPException(status_code=422, detail=detail)


def _text(value: Optional[str], label: str, max_len: int, required: bool = False, single_line: bool = True) -> Optional[str]:
    v = (value or "").strip()
    if single_line:
        v = " ".join(v.split())
    if not v:
        if required:
            raise _bad(f"{label} is required")
        return None
    if len(v) > max_len:
        raise _bad(f"{label} must be at most {max_len} characters")
    return v


def _date(value: Optional[str], label: str, required: bool = False) -> Optional[str]:
    v = (value or "").strip()
    if not v:
        if required:
            raise _bad(f"{label} is required")
        return None
    if not DATE_RE.match(v):
        raise _bad(f"{label} must be a date in YYYY-MM-DD format")
    try:
        date.fromisoformat(v)
    except ValueError:
        raise _bad(f"{label} is not a valid date")
    return v


def _link(value: Optional[str], label: str, allow_relative: bool) -> Optional[str]:
    return validate_link((value or "").strip() or None, label, allow_relative=allow_relative)


def _clean_categories(values: Optional[List[str]]) -> List[str]:
    cleaned: List[str] = []
    seen = set()
    for raw in values or []:
        v = " ".join(str(raw or "").split())
        if not v:
            continue
        if len(v) > CATEGORY_MAX:
            raise _bad(f'Category "{v[:24]}…" is too long (max {CATEGORY_MAX} characters)')
        if v.casefold() in seen:
            continue
        seen.add(v.casefold())
        cleaned.append(v)
    if len(cleaned) > CATEGORIES_MAX:
        raise _bad(f"Add at most {CATEGORIES_MAX} categories")
    return cleaned


def _clean_event(data: dict) -> dict:
    """Validates a full set of event fields (create, or update merged onto the stored event)."""
    d = dict(data)
    d["title"] = _text(d.get("title"), "Title", TITLE_MAX, required=True)
    d["summary"] = _text(d.get("summary"), "Summary", SUMMARY_MAX)
    d["description"] = _text(d.get("description"), "Description", DESCRIPTION_MAX, single_line=False)
    d["timeText"] = _text(d.get("timeText"), "Time", TIME_TEXT_MAX)
    d["venue"] = _text(d.get("venue"), "Venue", VENUE_MAX, required=True)
    d["feeNote"] = _text(d.get("feeNote"), "Fee note", FEE_NOTE_MAX)

    start = _date(d.get("startDate"), "Start date", required=True)
    end = _date(d.get("endDate"), "End date")
    if end and end < start:
        raise _bad("End date must be on or after the start date")
    deadline = _date(d.get("registrationDeadline"), "Registration deadline")
    if deadline and deadline > (end or start):
        raise _bad("Registration deadline must be on or before the last day of the event")
    d["startDate"], d["endDate"], d["registrationDeadline"] = start, end, deadline

    fee = d.get("entryFee")
    if fee is not None:
        if not math.isfinite(fee) or fee < 0:
            raise _bad("Entry fee can't be negative")
        if fee > FEE_MAX:
            raise _bad("Entry fee looks too large")
        d["entryFee"] = round(float(fee), 2)

    capacity = d.get("capacity")
    if capacity is not None and not (1 <= capacity <= CAPACITY_MAX):
        raise _bad("Capacity must be at least 1 (leave it empty for no limit)")

    d["categories"] = _clean_categories(d.get("categories"))

    d["registrationUrl"] = _link(d.get("registrationUrl"), "Registration link", allow_relative=False)
    if d.get("registrationMode") == "url" and not d["registrationUrl"]:
        raise _bad("Add the registration link (https://…) or choose another way to register")
    d["venueMapUrl"] = _link(d.get("venueMapUrl"), "Map link", allow_relative=False)
    d["bannerImageUrl"] = _link(d.get("bannerImageUrl"), "Banner image", allow_relative=True)
    if not d["bannerImageUrl"]:
        raise _bad("Banner image is required")
    d["mobileImageUrl"] = _link(d.get("mobileImageUrl"), "Phone image", allow_relative=True)
    return d


def _get_event(db: Session, event_id: str) -> EventModel:
    event = db.query(EventModel).filter(EventModel.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


def _serialize_one(db: Session, event: EventModel) -> EventSchema:
    count = active_registration_counts(db, [event.id]).get(event.id, 0)
    return serialize_event(event, count, business_today().isoformat())


# ---------------- Public ----------------

@router.get("/events", response_model=List[EventSchema])
def get_public_events(include_past: bool = Query(False), db: Session = Depends(get_db)):
    return public_events(db, include_past)


def _shop_phone(db: Session) -> str:
    """The shop's phone for customer-facing messages (editable in Shop Settings)."""
    return shop_display_phone(get_shop_settings(db)["phone"])


def _register_elsewhere_message(event: EventModel, shop_phone: str) -> str:
    mode = event.registrationMode
    if mode == "whatsapp":
        return f"Registration for this event is on WhatsApp. Message GR Sports on {shop_phone}."
    if mode == "phone":
        return f"To register for this event, call GR Sports on {shop_phone}."
    if mode == "url":
        return "Register for this event using its registration link."
    return "This event doesn't need registration."


@router.post(
    "/events/{event_id}/register",
    response_model=EventRegistrationSchema,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("event-register", limit=30, window_seconds=900))],  # loose: shared mobile IPs
)
def register_for_event(event_id: str, payload: EventRegistrationCreate, db: Session = Depends(get_db)):
    # Lock the event row (PostgreSQL) so two registrations at once can't both take the last place.
    event = (
        db.query(EventModel)
        .filter(EventModel.id == event_id, EventModel.isActive == True)  # noqa: E712
        .with_for_update()
        .first()
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.registrationMode != "form":
        raise HTTPException(status_code=409, detail=_register_elsewhere_message(event, _shop_phone(db)))

    today = business_today().isoformat()
    if event_status(event, today) == "past" or today > (event.registrationDeadline or event.startDate):
        raise HTTPException(status_code=409, detail="Registration for this event has closed")

    name = _text(payload.name, "Name", NAME_MAX)
    if not name or len(name) < NAME_MIN:
        raise _bad(f"Please enter your name ({NAME_MIN}–{NAME_MAX} characters)")
    mobile = require_phone(payload.mobile)
    partner = _text(payload.partnerName, "Partner's name", PARTNER_MAX)
    notes = _text(payload.notes, "Notes", NOTES_MAX, single_line=False)

    categories = list(event.categories or [])
    play_category = None
    if categories:
        chosen = " ".join((payload.playCategory or "").split()).casefold()
        play_category = next((c for c in categories if c.casefold() == chosen), None)
        if not play_category:
            raise _bad(f"Choose a category: {', '.join(categories)}")

    existing = (
        db.query(EventRegistrationModel)
        .filter(
            EventRegistrationModel.eventId == event.id,
            EventRegistrationModel.mobile == mobile,
            # One entry per category: a player may enter e.g. Men's Doubles and Mixed Doubles.
            EventRegistrationModel.playCategory == play_category,
            EventRegistrationModel.status == "registered",
        )
        .first()
    )
    if existing:
        entered = f" in {existing.playCategory}" if existing.playCategory else ""
        raise HTTPException(
            status_code=409,
            detail=(
                f"{display_phone(mobile)} is already registered for {event.title}{entered}. "
                f"To change your entry, call or WhatsApp GR Sports on {_shop_phone(db)}."
            ),
        )

    count = active_registration_counts(db, [event.id]).get(event.id, 0)
    if event.capacity and count >= event.capacity:
        raise HTTPException(status_code=409, detail="Registrations are full")

    registration = EventRegistrationModel(
        id=new_id("REG"),
        eventId=event.id,
        name=name,
        mobile=mobile,
        partnerName=partner,
        playCategory=play_category,
        notes=notes,
        status="registered",
        createdAt=now_iso(),
    )
    db.add(registration)
    db.commit()
    db.refresh(registration)

    details = [x for x in (play_category, f"partner: {partner}" if partner else None) if x]
    create_notification(
        db,
        type_="system",
        title="New event registration",
        message=f"New registration for {event.title}: {name} ({display_phone(mobile)})"
        + (f" – {', '.join(details)}" if details else "")
        + ". See Website Content → Events.",
        target_roles=["ADMIN"],
    )
    return registration


# ---------------- Admin: events ----------------

@router.get("/admin/events", response_model=List[EventSchema])
def list_events(db: Session = Depends(get_db), _: CurrentUser = Depends(require_admin)):
    events = db.query(EventModel).order_by(EventModel.startDate, EventModel.sortOrder, EventModel.createdAt).all()
    counts = active_registration_counts(db)
    today = business_today().isoformat()
    return [serialize_event(e, counts.get(e.id, 0), today) for e in events]


@router.post("/admin/events", response_model=EventSchema, status_code=status.HTTP_201_CREATED)
def create_event(payload: EventCreate, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    data = _clean_event(payload.model_dump())
    if data.get("sortOrder") is None:
        data["sortOrder"] = db.query(EventModel).count()
    event = EventModel(id=new_id("EVT"), createdAt=now_iso(), **data)
    db.add(event)
    db.commit()
    db.refresh(event)
    log_audit(db, admin.label, "ADMIN", f"Created event: {event.title}", "CONTENT", f"Starts {event.startDate}")
    return _serialize_one(db, event)


@router.put("/admin/events/{event_id}", response_model=EventSchema)
def update_event(
    event_id: str,
    payload: EventUpdate,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    event = _get_event(db, event_id)
    data = payload.model_dump(exclude_unset=True)
    # Fields that can't be empty: an explicit null means "leave as is".
    for key in ("category", "registrationMode", "categories", "showAsBanner", "isActive", "sortOrder"):
        if key in data and data[key] is None:
            data.pop(key)
    merged = {key: getattr(event, key) for key in EVENT_INPUT_FIELDS}
    merged.update(data)
    cleaned = _clean_event(merged)
    for key, value in cleaned.items():
        setattr(event, key, value)
    db.commit()
    db.refresh(event)
    log_audit(db, admin.label, "ADMIN", f"Updated event: {event.title}", "CONTENT")
    return _serialize_one(db, event)


@router.delete("/admin/events/{event_id}")
def delete_event(event_id: str, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    event = _get_event(db, event_id)
    title = event.title
    removed = (
        db.query(EventRegistrationModel)
        .filter(EventRegistrationModel.eventId == event.id)
        .delete(synchronize_session=False)
    )
    db.delete(event)
    db.commit()
    log_audit(db, admin.label, "ADMIN", f"Deleted event: {title}", "CONTENT",
              f"{removed} registration(s) deleted with it" if removed else None)
    return {"success": True, "deletedRegistrations": removed}


# ---------------- Admin: registrations ----------------

@router.get("/admin/events/{event_id}/registrations", response_model=List[EventRegistrationSchema])
def list_event_registrations(event_id: str, db: Session = Depends(get_db), _: CurrentUser = Depends(require_admin)):
    _get_event(db, event_id)
    return (
        db.query(EventRegistrationModel)
        .filter(EventRegistrationModel.eventId == event_id)
        .order_by(EventRegistrationModel.createdAt, EventRegistrationModel.id)
        .all()
    )


@router.patch("/admin/event-registrations/{registration_id}", response_model=EventRegistrationSchema)
def update_event_registration(
    registration_id: str,
    payload: EventRegistrationUpdate,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    registration = db.query(EventRegistrationModel).filter(EventRegistrationModel.id == registration_id).first()
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    if registration.status == payload.status:
        return registration
    if payload.status == "registered":
        # Restoring: keep at most one active registration per mobile number per event category.
        clash = (
            db.query(EventRegistrationModel)
            .filter(
                EventRegistrationModel.eventId == registration.eventId,
                EventRegistrationModel.mobile == registration.mobile,
                EventRegistrationModel.playCategory == registration.playCategory,
                EventRegistrationModel.status == "registered",
                EventRegistrationModel.id != registration.id,
            )
            .first()
        )
        if clash:
            raise HTTPException(
                status_code=409,
                detail=f"{display_phone(registration.mobile)} already has an active registration in this category",
            )
    registration.status = payload.status
    db.commit()
    db.refresh(registration)
    event = db.query(EventModel).filter(EventModel.id == registration.eventId).first()
    action = "Cancelled" if payload.status == "cancelled" else "Restored"
    log_audit(db, admin.label, "ADMIN", f"{action} event registration: {registration.name}", "CONTENT",
              event.title if event else registration.eventId)
    return registration
