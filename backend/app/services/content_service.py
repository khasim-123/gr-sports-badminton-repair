"""Shared helpers for admin-managed website content."""
import io
import math
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.models import (
    AvailabilitySettingsModel,
    ReviewModel,
    ServiceRequestModel,
    StringProductModel,
)
from app.schemas import StringProductSchema

# The shop operates in India; "today" for bookings is computed in IST.
BUSINESS_TZ = timezone(timedelta(hours=5, minutes=30))
WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

Image.MAX_IMAGE_PIXELS = 40_000_000  # refuse decompression bombs
MAX_IMAGE_EDGE = 2000


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def business_today() -> date:
    return datetime.now(BUSINESS_TZ).date()


# ---------- URLs ----------

def validate_link(value: Optional[str], field: str, allow_relative: bool = True) -> Optional[str]:
    """Only https links (http for localhost) or site-relative paths; blocks javascript:/data: etc."""
    if value is None or value == "":
        return None
    v = value.strip()
    if allow_relative and v.startswith("/") and not v.startswith("//"):
        return v
    if v.startswith("https://") or v.startswith(("http://localhost", "http://127.0.0.1")):
        return v
    raise HTTPException(status_code=422, detail=f"{field} must be an https:// link" + (" or a /path" if allow_relative else ""))


# ---------- Form text ----------

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def clean_text(
    value: Optional[str],
    label: str,
    max_len: int,
    required: bool = False,
    single_line: bool = True,
    min_len: int = 0,
) -> Optional[str]:
    """Trims (and, for single-line fields, collapses whitespace in) a form field.
    Empty -> None, or 422 when required; 422 when shorter than min_len or longer than max_len."""
    v = (value or "").replace("\r\n", "\n").strip()
    if single_line:
        v = " ".join(v.split())
    if not v:
        if required:
            raise HTTPException(status_code=422, detail=f"{label} is required")
        return None
    if len(v) < min_len:
        raise HTTPException(status_code=422, detail=f"{label} must be at least {min_len} characters")
    if len(v) > max_len:
        raise HTTPException(status_code=422, detail=f"{label} must be at most {max_len} characters")
    return v


def clean_date(value: Optional[str], label: str, required: bool = False) -> Optional[str]:
    """A YYYY-MM-DD date (or None when empty and not required)."""
    v = (value or "").strip()
    if not v:
        if required:
            raise HTTPException(status_code=422, detail=f"{label} is required")
        return None
    if not DATE_RE.match(v):
        raise HTTPException(status_code=422, detail=f"{label} must be a date in YYYY-MM-DD format")
    try:
        date.fromisoformat(v)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"{label} is not a valid date")
    return v


# ---------- Prices ----------

MRP_MAX = 1_000_000


def clean_mrp(mrp: Optional[float], price: Optional[float]) -> Optional[float]:
    """The original price (MRP) shown struck through next to the shop's price: empty / 0 = none.
    It needs a price, and must be more than it (otherwise there's no saving to show)."""
    if mrp is None or mrp == 0:
        return None
    mrp = float(mrp)
    if not math.isfinite(mrp) or mrp < 0 or mrp > MRP_MAX:
        raise HTTPException(status_code=422, detail="Original price must be between ₹1 and ₹10,00,000")
    if price is None or price <= 0:
        raise HTTPException(status_code=422, detail="Add your price before the original price")
    if mrp <= price:
        raise HTTPException(status_code=422, detail="The original price must be more than your price")
    return round(mrp, 2)


# ---------- Media ----------

def process_upload(data: bytes, declared_type: Optional[str]) -> tuple[bytes, str, str]:
    """Validates an upload by content (not by the client's claimed type).
    Images are orientation-fixed, downscaled and re-encoded to WebP; PDFs pass through.
    Returns (bytes, content_type, extension)."""
    if data[:5] == b"%PDF-":
        return data, "application/pdf", "pdf"
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(status_code=415, detail="Unsupported file. Upload a JPG, PNG, WebP or GIF image, or a PDF.")
    if img.format not in ("JPEG", "PNG", "WEBP", "GIF", "MPO"):
        raise HTTPException(status_code=415, detail="Unsupported image format. Use JPG, PNG, WebP or GIF.")
    img = ImageOps.exif_transpose(img)
    has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
    img = img.convert("RGBA" if has_alpha else "RGB")
    img.thumbnail((MAX_IMAGE_EDGE, MAX_IMAGE_EDGE))
    out = io.BytesIO()
    img.save(out, "WEBP", quality=82, method=4)
    return out.getvalue(), "image/webp", "webp"


# ---------- Strings ----------

def serialize_product(product: StringProductModel) -> StringProductSchema:
    schema = StringProductSchema.model_validate(product)
    schema.inStockCount = sum(1 for v in product.variants if v.inStock)
    return schema


# ---------- Reviews ----------

def review_summary(db: Session) -> dict:
    approved = db.query(ReviewModel.rating).filter(ReviewModel.status == "approved").all()
    distribution = {str(i): 0 for i in range(1, 6)}
    for (rating,) in approved:
        distribution[str(rating)] += 1
    count = len(approved)
    average = round(sum(r for (r,) in approved) / count, 2) if count else 0.0
    return {"average": average, "count": count, "distribution": distribution}


# ---------- Availability ----------

def get_availability_settings(db: Session) -> AvailabilitySettingsModel:
    settings = db.query(AvailabilitySettingsModel).first()
    if not settings:
        settings = AvailabilitySettingsModel(
            id=1,
            openWeekdays=[0, 1, 2, 3, 4, 5],
            dailyPickupCapacity=0,
            leadTimeDays=0,
            bookingWindowDays=30,
            pickupSlots=["10:00 - 13:00", "16:00 - 19:00"],
            closedDates=[],
            notice=None,
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _bookings_per_day(db: Session, start: date, end: date) -> dict[str, int]:
    rows = (
        db.query(ServiceRequestModel.pickupDate)
        .filter(ServiceRequestModel.pickupDate >= start.isoformat())
        .filter(ServiceRequestModel.pickupDate <= end.isoformat())
        .filter(ServiceRequestModel.status != "Cancelled")
        .all()
    )
    counts: dict[str, int] = {}
    for (d,) in rows:
        if d:
            counts[d[:10]] = counts.get(d[:10], 0) + 1
    return counts


def compute_days(db: Session, days: int) -> list[dict]:
    s = get_availability_settings(db)
    today = business_today()
    horizon = min(days, s.bookingWindowDays + s.leadTimeDays)
    end = today + timedelta(days=max(horizon - 1, 0))
    counts = _bookings_per_day(db, today, end) if s.dailyPickupCapacity else {}
    closed = {c["date"]: c.get("reason") for c in (s.closedDates or [])}
    open_days = set(s.openWeekdays or [])

    result = []
    for i in range(horizon):
        d = today + timedelta(days=i)
        key = d.isoformat()
        reason = None
        remaining = None
        if i < s.leadTimeDays:
            reason = "Too soon to book"
        elif key in closed:
            reason = f"Closed – {closed[key]}" if closed[key] else "Closed"
        elif d.weekday() not in open_days:
            reason = f"Closed on {WEEKDAY_NAMES[d.weekday()]}s"
        elif s.dailyPickupCapacity:
            remaining = max(s.dailyPickupCapacity - counts.get(key, 0), 0)
            if remaining == 0:
                reason = "Fully booked"
        result.append({"date": key, "available": reason is None, "reason": reason, "remaining": remaining})
    return result


def assert_pickup_date_available(db: Session, pickup_date: str) -> None:
    try:
        d = date.fromisoformat(pickup_date[:10])
    except ValueError:
        raise HTTPException(status_code=422, detail="Pickup date must be in YYYY-MM-DD format")
    s = get_availability_settings(db)
    offset = (d - business_today()).days
    if offset < 0:
        raise HTTPException(status_code=422, detail="Pickup date cannot be in the past")
    if offset >= s.bookingWindowDays + s.leadTimeDays:
        raise HTTPException(status_code=422, detail=f"Pickups can be booked up to {s.bookingWindowDays} days ahead")
    day = compute_days(db, offset + 1)[offset]
    if not day["available"]:
        raise HTTPException(status_code=422, detail=f"{d.strftime('%d %b %Y')} is not available for pickup: {day['reason']}")
