import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import AvailabilitySettingsSchema, PublicAvailabilitySchema
from app.security import CurrentUser, require_admin
from app.services.content_service import compute_days, get_availability_settings
from app.services.notification_service import log_audit

router = APIRouter(prefix="/availability", tags=["Pickup Availability"])

SLOT_PATTERN = re.compile(r"^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$")


@router.get("", response_model=PublicAvailabilitySchema)
def get_availability(days: int = Query(30, ge=1, le=180), db: Session = Depends(get_db)):
    return {"settings": get_availability_settings(db), "days": compute_days(db, days)}


@router.get("/admin", response_model=AvailabilitySettingsSchema)
def get_settings(db: Session = Depends(get_db), _: CurrentUser = Depends(require_admin)):
    return get_availability_settings(db)


@router.put("/admin", response_model=AvailabilitySettingsSchema)
def update_settings(
    payload: AvailabilitySettingsSchema,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    weekdays = sorted(set(payload.openWeekdays))
    if any(d < 0 or d > 6 for d in weekdays):
        raise HTTPException(status_code=422, detail="Weekdays must be between 0 (Monday) and 6 (Sunday)")
    slots = [s.strip() for s in payload.pickupSlots if s.strip()]
    bad = [s for s in slots if not SLOT_PATTERN.match(s)]
    if bad:
        raise HTTPException(status_code=422, detail=f"Time slots must look like 10:00 - 13:00 (got: {', '.join(bad)})")
    closed = {}
    for c in payload.closedDates:
        closed[c.date] = {"date": c.date, "reason": (c.reason or "").strip() or None}

    settings = get_availability_settings(db)
    settings.openWeekdays = weekdays
    settings.dailyPickupCapacity = payload.dailyPickupCapacity
    settings.leadTimeDays = payload.leadTimeDays
    settings.bookingWindowDays = payload.bookingWindowDays
    settings.pickupSlots = slots
    settings.closedDates = sorted(closed.values(), key=lambda c: c["date"])
    settings.notice = (payload.notice or "").strip() or None
    db.commit()
    db.refresh(settings)
    log_audit(db, admin.label, "ADMIN", "Updated pickup availability", "SYSTEM",
              f"Open days: {weekdays} | Capacity: {payload.dailyPickupCapacity or 'unlimited'} | Closed dates: {len(closed)}")
    return settings
