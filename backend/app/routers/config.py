import math
import re
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import DistanceConfigModel, GettingServiceTierModel, RepairCategoryTierModel
from app.schemas import (
    DistancePricingConfigSchema,
    DistanceCalculationRequest,
    DistanceCalculationResponse,
    GettingServiceTierSchema,
    RepairCategoryTierSchema,
    ShopSettingsSchema,
)
from app.services.content_service import validate_link
from app.services.shop_settings import get_shop_settings, save_shop_settings
from app.services.sms_service import require_phone
from app.services.pricing_service import calculate_delivery_charge, road_distance_km
from app.services.notification_service import log_audit
from app.security import CurrentUser, require_admin

router = APIRouter(prefix="/config", tags=["Configuration & Dynamic Pricing"])

# 1. Distance Pricing
@router.get("/distance", response_model=DistancePricingConfigSchema)
def get_distance_config(db: Session = Depends(get_db)):
    config = db.query(DistanceConfigModel).first()
    if not config:
        raise HTTPException(status_code=404, detail="Distance configuration not found")
    return config


@router.put("/distance", response_model=DistancePricingConfigSchema)
def update_distance_config(payload: DistancePricingConfigSchema, db: Session = Depends(get_db),
    _admin: CurrentUser = Depends(require_admin)):
    config = db.query(DistanceConfigModel).first()
    if not config:
        config = DistanceConfigModel(id=1)
        db.add(config)

    config.shopLocationName = payload.shopLocationName
    config.shopLat = payload.shopLat
    config.shopLng = payload.shopLng
    config.freeRadiusKm = payload.freeRadiusKm
    config.perKmRateBeyondFree = payload.perKmRateBeyondFree
    config.pricingMethod = payload.pricingMethod
    config.maxServiceDistanceKm = payload.maxServiceDistanceKm
    config.slabs = [s.dict() for s in payload.slabs]

    db.commit()
    db.refresh(config)

    log_audit(
        db=db,
        user="Admin",
        role="ADMIN",
        action="Updated Distance Configuration",
        request_id="SYSTEM",
        details=f"Free Radius: {payload.freeRadiusKm} KM | Per KM: ₹{payload.perKmRateBeyondFree}"
    )

    return config


@router.post("/distance/calculate", response_model=DistanceCalculationResponse)
def calculate_distance(payload: DistanceCalculationRequest, db: Session = Depends(get_db)):
    config = db.query(DistanceConfigModel).first()
    if not config:
        raise HTTPException(status_code=404, detail="Distance configuration not found")

    dist_km = payload.distanceKm
    if dist_km is None and payload.lat is not None and payload.lng is not None:
        # Same estimate the server uses for bookings (straight line x road factor).
        dist_km = road_distance_km(config.shopLat, config.shopLng, payload.lat, payload.lng)

    if dist_km is None:
        dist_km = 0.0

    calc = calculate_delivery_charge(dist_km, config)
    return DistanceCalculationResponse(
        distanceKm=dist_km,
        charge=calc["charge"],
        isFree=calc["isFree"],
        chargeableKm=calc["chargeableKm"]
    )


def _price(value: Any) -> float:
    try:
        price = float(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Price must be a number")
    if not math.isfinite(price) or price < 0 or price > 1_000_000:
        raise HTTPException(status_code=422, detail="Price must be between ₹0 and ₹10,00,000")
    return price


# 2. Getting Service Tiers
@router.get("/getting-services", response_model=List[GettingServiceTierSchema])
def get_getting_services(db: Session = Depends(get_db)):
    return db.query(GettingServiceTierModel).filter(GettingServiceTierModel.isActive == True).all()


@router.post("/getting-services", response_model=GettingServiceTierSchema, status_code=status.HTTP_201_CREATED)
def add_getting_service(payload: GettingServiceTierSchema, db: Session = Depends(get_db),
    _admin: CurrentUser = Depends(require_admin)):
    tier = GettingServiceTierModel(
        id=payload.id,
        name=payload.name,
        price=payload.price,
        turnaround=payload.turnaround,
        description=payload.description,
        features=payload.features,
        isActive=payload.isActive
    )
    db.add(tier)
    db.commit()
    db.refresh(tier)
    return tier


@router.put("/getting-services/{tier_id}", response_model=GettingServiceTierSchema)
def update_getting_service(tier_id: str, payload: Dict[str, Any], db: Session = Depends(get_db),
    _admin: CurrentUser = Depends(require_admin)):
    tier = db.query(GettingServiceTierModel).filter(GettingServiceTierModel.id == tier_id).first()
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")

    if "name" in payload:
        tier.name = payload["name"]
    if "price" in payload:
        tier.price = _price(payload["price"])
    if "turnaround" in payload:
        tier.turnaround = payload["turnaround"]
    if "description" in payload:
        tier.description = payload["description"]
    if "features" in payload:
        tier.features = payload["features"]
    if "isActive" in payload:
        tier.isActive = payload["isActive"]

    db.commit()
    db.refresh(tier)
    return tier


# 3. Repair Categories
@router.get("/repair-categories", response_model=List[RepairCategoryTierSchema])
def get_repair_categories(db: Session = Depends(get_db)):
    return db.query(RepairCategoryTierModel).filter(RepairCategoryTierModel.isActive == True).all()


@router.post("/repair-categories", response_model=RepairCategoryTierSchema, status_code=status.HTTP_201_CREATED)
def add_repair_category(payload: RepairCategoryTierSchema, db: Session = Depends(get_db),
    _admin: CurrentUser = Depends(require_admin)):
    cat = RepairCategoryTierModel(
        id=payload.id,
        name=payload.name,
        basePrice=payload.basePrice,
        turnaround=payload.turnaround,
        description=payload.description,
        slaDays=payload.slaDays,
        isActive=payload.isActive
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/repair-categories/{cat_id}", response_model=RepairCategoryTierSchema)
def update_repair_category(cat_id: str, payload: Dict[str, Any], db: Session = Depends(get_db),
    _admin: CurrentUser = Depends(require_admin)):
    cat = db.query(RepairCategoryTierModel).filter(RepairCategoryTierModel.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    if "name" in payload:
        cat.name = payload["name"]
    if "basePrice" in payload:
        cat.basePrice = _price(payload["basePrice"])
    if "turnaround" in payload:
        cat.turnaround = payload["turnaround"]
    if "description" in payload:
        cat.description = payload["description"]
    if "slaDays" in payload:
        cat.slaDays = int(payload["slaDays"])
    if "isActive" in payload:
        cat.isActive = payload["isActive"]

    db.commit()
    db.refresh(cat)
    return cat


# 4. Shop details (name, phone, WhatsApp, address, hours, declined-repair fee)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PINCODE_RE = re.compile(r"^\d{6}$")


def _shop_text(value: Optional[str], field: str, max_len: int, min_len: int = 0, required: bool = False) -> str:
    v = " ".join((value or "").split())
    if required and not v:
        raise HTTPException(status_code=422, detail=f"{field} is required")
    if v and len(v) < min_len:
        raise HTTPException(status_code=422, detail=f"{field} must be at least {min_len} characters")
    if len(v) > max_len:
        raise HTTPException(status_code=422, detail=f"{field} must be at most {max_len} characters")
    return v


SOCIAL_FIELDS = {
    "instagramUrl": "Instagram link",
    "facebookUrl": "Facebook link",
    "xUrl": "X (Twitter) link",
    "youtubeUrl": "YouTube link",
}
SOCIAL_URL_MAX = 300
FOOTER_HIGHLIGHTS_MAX = 3
FOOTER_HIGHLIGHT_LEN = 120


def _social_url(value: Optional[str], label: str) -> Optional[str]:
    v = (value or "").strip()
    if not v:
        return None
    # https only (validate_link would also let http://localhost through).
    if not v.startswith("https://") or len(v) <= len("https://") or re.search(r"\s", v):
        raise HTTPException(status_code=422, detail=f"{label} must be an https:// link")
    if len(v) > SOCIAL_URL_MAX:
        raise HTTPException(status_code=422, detail=f"{label} must be at most {SOCIAL_URL_MAX} characters")
    return v


def _footer_highlights(values: List[str]) -> List[str]:
    cleaned: List[str] = []
    for raw in values:
        v = " ".join((raw or "").split())
        if not v:
            continue
        if len(v) > FOOTER_HIGHLIGHT_LEN:
            raise HTTPException(status_code=422,
                                detail=f"Keep each footer highlight to {FOOTER_HIGHLIGHT_LEN} characters or fewer")
        if v not in cleaned:
            cleaned.append(v)
    if len(cleaned) > FOOTER_HIGHLIGHTS_MAX:
        raise HTTPException(status_code=422, detail=f"Add at most {FOOTER_HIGHLIGHTS_MAX} footer highlights")
    return cleaned


@router.get("/shop", response_model=ShopSettingsSchema)
def get_shop(db: Session = Depends(get_db)):
    return get_shop_settings(db)


@router.put("/shop", response_model=ShopSettingsSchema)
def update_shop(payload: ShopSettingsSchema, db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin)):
    email = (payload.email or "").strip()
    if email and (len(email) > 120 or not EMAIL_RE.match(email)):
        raise HTTPException(status_code=422, detail="Email must look like name@example.com")
    pincode = (payload.pincode or "").strip()
    if pincode and not PINCODE_RE.match(pincode):
        raise HTTPException(status_code=422, detail="Pincode must be 6 digits")
    fee = float(payload.declinedRepairFee or 0)
    if fee < 0 or fee > 5000:
        raise HTTPException(status_code=422, detail="Declined repair fee must be between ₹0 and ₹5,000")
    maps_url = validate_link((payload.mapsUrl or "").strip() or None, "Google Maps link", allow_relative=False)

    values = {
        "name": _shop_text(payload.name, "Shop name", 60, min_len=2, required=True),
        "tagline": _shop_text(payload.tagline, "Tagline", 80),
        "phone": require_phone(payload.phone, "Phone number"),
        "whatsapp": require_phone(payload.whatsapp, "WhatsApp number"),
        "email": email or None,
        "addressLine": _shop_text(payload.addressLine, "Address", 120, required=True),
        "area": _shop_text(payload.area, "Area / city", 120, required=True),
        "pincode": pincode or None,
        "mapsUrl": maps_url,
        "openingHours": _shop_text(payload.openingHours, "Opening hours", 120),
        "declinedRepairFee": int(fee) if fee == int(fee) else round(fee, 2),
    }
    # Fields added later (socials, footer highlights) are only changed when sent, so a form that
    # doesn't know about them keeps the saved values. An empty / null link removes it.
    sent = payload.model_fields_set
    for field, label in SOCIAL_FIELDS.items():
        if field in sent:
            values[field] = _social_url(getattr(payload, field), label)
    if "footerHighlights" in sent and payload.footerHighlights is not None:
        values["footerHighlights"] = _footer_highlights(payload.footerHighlights)
    before = get_shop_settings(db)
    saved = save_shop_settings(db, values)
    changed = [k for k in values if before.get(k) != saved.get(k)]
    log_audit(
        db=db,
        user=admin.label,
        role="ADMIN",
        action="Updated Shop Details",
        request_id="SYSTEM",
        details=("Changed: " + ", ".join(changed)) if changed else "No changes",
    )
    return saved
