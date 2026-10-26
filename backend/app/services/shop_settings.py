"""Shop details the admin can edit (name, phone, WhatsApp, address, hours, declined-repair fee,
social media links and the footer highlights).

Stored as one JSON document in the existing `app_meta` table (key "shop_settings"), so no
migration is needed. Missing keys fall back to DEFAULTS.
"""
import copy
from typing import Any, Dict

from sqlalchemy.orm import Session

from app.models import AppMetaModel

KEY = "shop_settings"

DEFAULTS: Dict[str, Any] = {
    "name": "GR Sports",
    "tagline": "Badminton · Dondaparthy, Vizag",
    "phone": "+917675831496",  # calls (E.164, +91XXXXXXXXXX)
    "whatsapp": "+917675831496",  # WhatsApp number (E.164)
    "email": "grsportshub@gmail.com",
    "addressLine": "Beside Ramalayam Arch, Near Diamond Park",
    "area": "Dondaparthy, Visakhapatnam",
    "pincode": "530016",
    "mapsUrl": "https://www.google.com/maps/search/?api=1&query=GR+Sports+Dondaparthy+Visakhapatnam",
    "openingHours": "Mon–Sat 10:00 AM – 8:00 PM · Sunday closed",
    # Charged when a customer declines a repair estimate and the racket is returned unrepaired,
    # on top of the pickup & delivery charge. 0 = only the pickup & delivery charge.
    "declinedRepairFee": 0,
    # Social media pages (https links); None = not shown in the footer.
    "instagramUrl": None,
    "facebookUrl": None,
    "xUrl": None,
    "youtubeUrl": None,
    # The footer's highlight lines, in the shop's own wording (GR website map).
    "footerHighlights": [
        "24-hour stringing SLA: electronic constant-pull machines",
        "7–10 day repair SLA: high-modulus internal carbon splicing",
        "100% genuine: authorised brand importer source",
    ],
}


def get_shop_settings(db: Session) -> Dict[str, Any]:
    row = db.query(AppMetaModel).filter(AppMetaModel.key == KEY).first()
    stored = dict(row.value or {}) if row else {}
    # Deep copy so callers can't change the shared default list.
    return copy.deepcopy({**DEFAULTS, **{k: v for k, v in stored.items() if k in DEFAULTS}})


def save_shop_settings(db: Session, values: Dict[str, Any]) -> Dict[str, Any]:
    """Saves already-validated values (unknown keys are ignored) and returns the full settings."""
    current = get_shop_settings(db)
    current.update({k: v for k, v in values.items() if k in DEFAULTS})
    row = db.query(AppMetaModel).filter(AppMetaModel.key == KEY).first()
    if row is None:
        row = AppMetaModel(key=KEY, value=current)
        db.add(row)
    else:
        row.value = current
    db.commit()
    return current


def display_phone(e164: str) -> str:
    """+917675831496 -> +91 76758 31496"""
    digits = "".join(ch for ch in (e164 or "") if ch.isdigit())
    if len(digits) == 12 and digits.startswith("91"):
        return f"+91 {digits[2:7]} {digits[7:]}"
    return e164
