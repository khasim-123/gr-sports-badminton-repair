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
    RepairCategoryTierSchema
)
from app.services.pricing_service import haversine_distance, calculate_delivery_charge
from app.services.notification_service import log_audit

router = APIRouter(prefix="/config", tags=["Configuration & Dynamic Pricing"])

# 1. Distance Pricing
@router.get("/distance", response_model=DistancePricingConfigSchema)
def get_distance_config(db: Session = Depends(get_db)):
    config = db.query(DistanceConfigModel).first()
    if not config:
        raise HTTPException(status_code=404, detail="Distance configuration not found")
    return config


@router.put("/distance", response_model=DistancePricingConfigSchema)
def update_distance_config(payload: DistancePricingConfigSchema, db: Session = Depends(get_db)):
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
        dist_km = haversine_distance(
            config.shopLat, config.shopLng,
            payload.lat, payload.lng
        )

    if dist_km is None:
        dist_km = 0.0

    calc = calculate_delivery_charge(dist_km, config)
    return DistanceCalculationResponse(
        distanceKm=dist_km,
        charge=calc["charge"],
        isFree=calc["isFree"],
        chargeableKm=calc["chargeableKm"]
    )


# 2. Getting Service Tiers
@router.get("/getting-services", response_model=List[GettingServiceTierSchema])
def get_getting_services(db: Session = Depends(get_db)):
    return db.query(GettingServiceTierModel).filter(GettingServiceTierModel.isActive == True).all()


@router.post("/getting-services", response_model=GettingServiceTierSchema, status_code=status.HTTP_201_CREATED)
def add_getting_service(payload: GettingServiceTierSchema, db: Session = Depends(get_db)):
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
def update_getting_service(tier_id: str, payload: Dict[str, Any], db: Session = Depends(get_db)):
    tier = db.query(GettingServiceTierModel).filter(GettingServiceTierModel.id == tier_id).first()
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")

    if "name" in payload:
        tier.name = payload["name"]
    if "price" in payload:
        tier.price = float(payload["price"])
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
def add_repair_category(payload: RepairCategoryTierSchema, db: Session = Depends(get_db)):
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
def update_repair_category(cat_id: str, payload: Dict[str, Any], db: Session = Depends(get_db)):
    cat = db.query(RepairCategoryTierModel).filter(RepairCategoryTierModel.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    if "name" in payload:
        cat.name = payload["name"]
    if "basePrice" in payload:
        cat.basePrice = float(payload["basePrice"])
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
