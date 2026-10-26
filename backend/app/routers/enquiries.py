"""Enquiries: requests visitors send from the website without logging in.

- kind "academy":       a slot at one of the listed academies (academyId + one of its batches)
- kind "tournament":    help organizing a tournament (department: umpires, dress, trophies, ...)
- kind "custom_tshirt": custom T-shirts (a quantity, or a description in the notes)

The admin sees them in an inbox (newest first), follows up by phone and marks them
contacted / closed. Every new enquiry notifies the admins.
"""
import random
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AcademyModel, EnquiryModel
from app.schemas import EnquiryCreate, EnquiryKind, EnquirySchema, EnquiryStatus, EnquiryUpdate
from app.security import CurrentUser, rate_limit, rate_limiter, require_admin
from app.services.content_service import business_today, clean_date, clean_text, new_id, now_iso
from app.services.notification_service import create_notification, log_audit
from app.services.shop_settings import display_phone as shop_display_phone, get_shop_settings
from app.services.sms_service import display_phone, require_phone

router = APIRouter(tags=["Enquiries"])

NAME_MIN, NAME_MAX = 2, 80
NOTES_MAX = 1000
LOCATION_MAX = 200
ADMIN_NOTE_MAX = 1000
QUANTITY_MAX = 5000
DATE_AHEAD_DAYS = 366  # dates further ahead are almost certainly typos
DUPLICATE_WINDOW_HOURS = 24  # an identical open enquiry sent within this window is refused
PER_NUMBER_LIMIT = 5  # enquiries per mobile number per hour

DEPARTMENT_LABELS = {
    "umpire": "Umpires",
    "dress": "Dress",
    "trophies": "Trophies",
    "refreshments": "Refreshments",
    "other": "Other",
}
KIND_LABELS = {"academy": "academy", "tournament": "tournament organizing", "custom_tshirt": "custom T-shirt"}
DATE_LABELS = {"academy": "Start date", "tournament": "Tournament date", "custom_tshirt": "Needed-by date"}
CUSTOM_TSHIRT_SUBJECT = "Custom T-shirts"


def _bad(detail: str) -> HTTPException:
    return HTTPException(status_code=422, detail=detail)


def _upcoming_date(value: Optional[str], label: str) -> Optional[str]:
    v = clean_date(value, label)
    if v:
        d = date.fromisoformat(v)
        today = business_today()
        if d < today:
            raise _bad(f"{label} can't be in the past")
        if d > today + timedelta(days=DATE_AHEAD_DAYS):
            raise _bad(f"{label} must be within the next 12 months")
    return v


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    try:
        parsed = datetime.fromisoformat((value or "").replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _new_enquiry_id(db: Session) -> str:
    """Short, easy to read out on the phone: ENQ-12345."""
    for attempt in range(60):
        digits = 5 if attempt < 40 else 6
        candidate = f"ENQ-{random.randint(10 ** (digits - 1), 10 ** digits - 1)}"
        if not db.query(EnquiryModel.id).filter(EnquiryModel.id == candidate).first():
            return candidate
    return f"ENQ-{new_id('X')[2:]}"


def _shop_phone(db: Session) -> str:
    return shop_display_phone(get_shop_settings(db)["phone"])


# ---------------- Public ----------------

@router.post(
    "/enquiries",
    response_model=EnquirySchema,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("enquiry", limit=30, window_seconds=900))],  # loose: shared mobile IPs
)
def submit_enquiry(payload: EnquiryCreate, db: Session = Depends(get_db)):
    name = clean_text(payload.name, "Name", NAME_MAX)
    if not name or len(name) < NAME_MIN:
        raise _bad(f"Please enter your name ({NAME_MIN}–{NAME_MAX} characters)")
    mobile = require_phone(payload.mobile)
    notes = clean_text(payload.notes, "Notes", NOTES_MAX, single_line=False)
    kind = payload.kind

    # Only the fields that belong to the kind are kept.
    fields = {"academyId": None, "batch": None, "department": None, "location": None, "quantity": None}
    if kind == "academy":
        academy_id = (payload.academyId or "").strip()
        if not academy_id:
            raise _bad("Choose an academy")
        academy = (
            db.query(AcademyModel)
            .filter(AcademyModel.id == academy_id, AcademyModel.isActive == True)  # noqa: E712
            .first()
        )
        if not academy:
            raise HTTPException(status_code=404, detail="Academy not found")
        batches = list(academy.batches or [])
        batch = None
        if batches:
            chosen = " ".join((payload.batch or "").split()).casefold()
            batch = next((b for b in batches if b.casefold() == chosen), None)
            if not batch:
                raise _bad(f"Choose a batch: {', '.join(batches)}")
        fields.update(academyId=academy.id, batch=batch)
        subject = academy.name
    elif kind == "tournament":
        if not payload.department:
            raise _bad("Choose what you need: " + ", ".join(DEPARTMENT_LABELS.values()))
        fields["department"] = payload.department
        fields["location"] = clean_text(payload.location, "Tournament location", LOCATION_MAX)
        subject = DEPARTMENT_LABELS[payload.department]
    else:  # custom_tshirt
        quantity = payload.quantity
        if quantity is not None and not (1 <= quantity <= QUANTITY_MAX):
            raise _bad(f"Number of T-shirts must be between 1 and {QUANTITY_MAX:,}")
        if quantity is None and not notes:
            raise _bad("Tell us how many T-shirts you need, or describe them in the notes")
        fields["quantity"] = quantity
        subject = CUSTOM_TSHIRT_SUBJECT
    when = _upcoming_date(payload.date, DATE_LABELS[kind])

    # Strict per-number limit (the per-address one above is loose: shared mobile IPs).
    rate_limiter.check(f"enquiry-phone:{mobile}", PER_NUMBER_LIMIT, 3600)

    # Refuse an identical open enquiry sent recently (double taps, impatient resends).
    same = db.query(EnquiryModel).filter(
        EnquiryModel.kind == kind,
        EnquiryModel.mobile == mobile,
        EnquiryModel.status != "closed",
    )
    if kind == "academy":
        same = same.filter(EnquiryModel.academyId == fields["academyId"])
    elif kind == "tournament":
        same = same.filter(EnquiryModel.department == fields["department"])
    cutoff = datetime.now(timezone.utc) - timedelta(hours=DUPLICATE_WINDOW_HOURS)
    for existing in same.order_by(EnquiryModel.createdAt.desc()).limit(20).all():
        created = _parse_iso(existing.createdAt)
        if created and created >= cutoff:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"We already have your request for {subject} from {display_phone(mobile)} "
                    f"({existing.id}). GR Sports will call you soon. To change it, call or WhatsApp "
                    f"GR Sports on {_shop_phone(db)}."
                ),
            )

    now = now_iso()
    enquiry = EnquiryModel(
        id=_new_enquiry_id(db),
        kind=kind,
        name=name,
        mobile=mobile,
        date=when,
        notes=notes,
        subject=subject,
        status="new",
        createdAt=now,
        updatedAt=now,
        **fields,
    )
    db.add(enquiry)
    db.commit()
    db.refresh(enquiry)

    details = [
        x for x in (
            enquiry.batch,
            enquiry.location,
            f"{enquiry.quantity} pcs" if enquiry.quantity else None,
            f"date {enquiry.date}" if enquiry.date else None,
        ) if x
    ]
    log_audit(db, name, "CUSTOMER", f"Sent {KIND_LABELS[kind]} enquiry", enquiry.id, subject)
    create_notification(
        db,
        type_="new_request",
        title=f"New {KIND_LABELS[kind]} enquiry",
        message=f"New {KIND_LABELS[kind]} enquiry {enquiry.id}: {subject} – {name} ({display_phone(mobile)})"
        + (f" – {', '.join(details)}" if details else "")
        + ".",
        request_id=enquiry.id,
        target_roles=["ADMIN"],
    )
    return enquiry


# ---------------- Admin ----------------

@router.get("/admin/enquiries", response_model=List[EnquirySchema])
def list_enquiries(
    kind: Optional[EnquiryKind] = Query(None),
    status_filter: Optional[EnquiryStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    query = db.query(EnquiryModel)
    if kind:
        query = query.filter(EnquiryModel.kind == kind)
    if status_filter:
        query = query.filter(EnquiryModel.status == status_filter)
    return query.order_by(EnquiryModel.createdAt.desc(), EnquiryModel.id.desc()).all()


@router.patch("/admin/enquiries/{enquiry_id}", response_model=EnquirySchema)
def update_enquiry(
    enquiry_id: str,
    payload: EnquiryUpdate,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    enquiry = db.query(EnquiryModel).filter(EnquiryModel.id == enquiry_id).first()
    if not enquiry:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    data = payload.model_dump(exclude_unset=True)
    changes = []
    if data.get("status") and data["status"] != enquiry.status:
        changes.append(f"Status: {enquiry.status} → {data['status']}")
        enquiry.status = data["status"]
    if "adminNote" in data:
        note = clean_text(data["adminNote"], "Note", ADMIN_NOTE_MAX, single_line=False)
        if note != enquiry.adminNote:
            changes.append("Note updated" if note else "Note removed")
            enquiry.adminNote = note
    if changes:
        enquiry.updatedAt = now_iso()
        db.commit()
        db.refresh(enquiry)
        log_audit(db, admin.label, "ADMIN", f"Updated enquiry: {enquiry.subject}", enquiry.id, "; ".join(changes))
    return enquiry
