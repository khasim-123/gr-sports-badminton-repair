from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import BannerModel, DocumentModel, RacketModel, ReviewModel, StringProductModel, StringVariantModel
from app.schemas import (
    BannerCreate,
    BannerSchema,
    BannerUpdate,
    DocumentSchema,
    PublicSiteContentWithShop,
    RacketCreate,
    RacketSchema,
    RacketUpdate,
    ReorderRequest,
    StockUpdate,
    StringProductCreate,
    StringProductSchema,
    StringProductUpdate,
    StringVariantCreate,
    StringVariantSchema,
    StringVariantUpdate,
)
from app.routers.events import public_events
from app.security import CurrentUser, require_admin
from app.services.content_service import (
    business_today,
    compute_days,
    get_availability_settings,
    new_id,
    now_iso,
    review_summary,
    serialize_product,
    validate_link,
)
from app.services.notification_service import log_audit
from app.services.shop_settings import get_shop_settings

router = APIRouter(prefix="/content", tags=["Website Content"])


# ---------------- Public ----------------

def _public_banners(db: Session) -> List[BannerModel]:
    today = business_today().isoformat()
    banners = (
        db.query(BannerModel)
        .filter(BannerModel.isActive == True)  # noqa: E712
        .order_by(BannerModel.sortOrder, BannerModel.createdAt)
        .all()
    )
    return [
        b for b in banners
        if (not b.startsAt or b.startsAt <= today) and (not b.endsAt or b.endsAt >= today)
    ]


def _public_strings(db: Session) -> List[StringProductSchema]:
    products = (
        db.query(StringProductModel)
        .options(selectinload(StringProductModel.variants))
        .filter(StringProductModel.isActive == True)  # noqa: E712
        .order_by(StringProductModel.sortOrder, StringProductModel.name)
        .all()
    )
    return [serialize_product(p) for p in products]


def _public_rackets(db: Session) -> List[RacketModel]:
    return (
        db.query(RacketModel)
        .filter(RacketModel.isActive == True)  # noqa: E712
        .order_by(RacketModel.sortOrder, RacketModel.brand, RacketModel.name)
        .all()
    )


@router.get("/rackets", response_model=List[RacketSchema])
def get_public_rackets(db: Session = Depends(get_db)):
    return _public_rackets(db)


@router.get("/banners", response_model=List[BannerSchema])
def get_public_banners(db: Session = Depends(get_db)):
    return _public_banners(db)


@router.get("/strings", response_model=List[StringProductSchema])
def get_public_strings(db: Session = Depends(get_db)):
    return _public_strings(db)


@router.get("/site", response_model=PublicSiteContentWithShop)
def get_public_site(
    reviews_limit: int = Query(9, ge=1, le=50),
    db: Session = Depends(get_db),
):
    reviews = (
        db.query(ReviewModel)
        .filter(ReviewModel.status == "approved")
        .order_by(ReviewModel.isFeatured.desc(), ReviewModel.createdAt.desc())
        .limit(reviews_limit)
        .all()
    )
    documents = (
        db.query(DocumentModel)
        .filter(DocumentModel.isPublic == True)  # noqa: E712
        .order_by(DocumentModel.sortOrder, DocumentModel.title)
        .all()
    )
    return {
        "shop": get_shop_settings(db),
        "events": public_events(db),
        "banners": _public_banners(db),
        "strings": _public_strings(db),
        "rackets": _public_rackets(db),
        "reviews": {"summary": review_summary(db), "reviews": reviews},
        "documents": documents,
        "availability": {"settings": get_availability_settings(db), "days": compute_days(db, 30)},
    }


# ---------------- Admin: banners ----------------

def _check_banner_links(data: dict) -> None:
    for field in ("desktopImageUrl", "mobileImageUrl"):
        if field in data:
            data[field] = validate_link(data[field], field)
    if "desktopImageUrl" in data and data["desktopImageUrl"] is None:
        data["desktopImageUrl"] = ""  # stored as "" (column is not nullable)
    if "ctaUrl" in data:
        data["ctaUrl"] = validate_link(data["ctaUrl"], "Button link", allow_relative=False)


def _check_banner_image(placement: str, image: Optional[str]) -> None:
    # Slideshow and promo banners are photos; an announcement can be text only.
    if placement != "announcement" and not image:
        raise HTTPException(status_code=422, detail="Add the wide image for this banner")


def _get_banner(db: Session, banner_id: str) -> BannerModel:
    banner = db.query(BannerModel).filter(BannerModel.id == banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")
    return banner


@router.get("/admin/banners", response_model=List[BannerSchema])
def list_banners(db: Session = Depends(get_db), _: CurrentUser = Depends(require_admin)):
    return db.query(BannerModel).order_by(BannerModel.sortOrder, BannerModel.createdAt).all()


@router.post("/admin/banners", response_model=BannerSchema, status_code=status.HTTP_201_CREATED)
def create_banner(payload: BannerCreate, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    data = payload.model_dump()
    _check_banner_links(data)
    _check_banner_image(data["placement"], data["desktopImageUrl"])
    if data["ctaTarget"] == "url" and not data.get("ctaUrl"):
        raise HTTPException(status_code=422, detail="Add a link for the banner button")
    if data.get("sortOrder") is None:
        data["sortOrder"] = db.query(BannerModel).count()
    banner = BannerModel(id=new_id("BNR"), createdAt=now_iso(), **data)
    db.add(banner)
    db.commit()
    db.refresh(banner)
    log_audit(db, admin.label, "ADMIN", f"Created banner: {banner.title}", "CONTENT")
    return banner


@router.put("/admin/banners/{banner_id}", response_model=BannerSchema)
def update_banner(
    banner_id: str,
    payload: BannerUpdate,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    banner = _get_banner(db, banner_id)
    data = payload.model_dump(exclude_unset=True)
    _check_banner_links(data)
    for key, value in data.items():
        setattr(banner, key, value)
    _check_banner_image(banner.placement, banner.desktopImageUrl)
    if banner.ctaTarget == "url" and not banner.ctaUrl:
        raise HTTPException(status_code=422, detail="Add a link for the banner button")
    db.commit()
    db.refresh(banner)
    log_audit(db, admin.label, "ADMIN", f"Updated banner: {banner.title}", "CONTENT")
    return banner


@router.delete("/admin/banners/{banner_id}")
def delete_banner(banner_id: str, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    banner = _get_banner(db, banner_id)
    db.delete(banner)
    db.commit()
    log_audit(db, admin.label, "ADMIN", f"Deleted banner: {banner.title}", "CONTENT")
    return {"success": True}


@router.post("/admin/banners/reorder", response_model=List[BannerSchema])
def reorder_banners(payload: ReorderRequest, db: Session = Depends(get_db), _: CurrentUser = Depends(require_admin)):
    banners = {b.id: b for b in db.query(BannerModel).all()}
    if set(payload.ids) != set(banners):
        raise HTTPException(status_code=422, detail="Reorder must include every banner exactly once")
    for index, banner_id in enumerate(payload.ids):
        banners[banner_id].sortOrder = index
    db.commit()
    return [banners[i] for i in payload.ids]


# ---------------- Admin: strings & colour stock ----------------

def _get_product(db: Session, product_id: str) -> StringProductModel:
    product = (
        db.query(StringProductModel)
        .options(selectinload(StringProductModel.variants))
        .filter(StringProductModel.id == product_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="String not found")
    return product


def _get_variant(db: Session, variant_id: str) -> StringVariantModel:
    variant = db.query(StringVariantModel).filter(StringVariantModel.id == variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Colour not found")
    return variant


@router.get("/admin/strings", response_model=List[StringProductSchema])
def list_strings(db: Session = Depends(get_db), _: CurrentUser = Depends(require_admin)):
    products = (
        db.query(StringProductModel)
        .options(selectinload(StringProductModel.variants))
        .order_by(StringProductModel.sortOrder, StringProductModel.name)
        .all()
    )
    return [serialize_product(p) for p in products]


@router.post("/admin/strings", response_model=StringProductSchema, status_code=status.HTTP_201_CREATED)
def create_string(payload: StringProductCreate, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    data = payload.model_dump()
    if data.get("sortOrder") is None:
        data["sortOrder"] = db.query(StringProductModel).count()
    product = StringProductModel(id=new_id("STR"), createdAt=now_iso(), **data)
    db.add(product)
    db.commit()
    log_audit(db, admin.label, "ADMIN", f"Added string: {product.name}", "CONTENT")
    return serialize_product(_get_product(db, product.id))


@router.put("/admin/strings/{product_id}", response_model=StringProductSchema)
def update_string(
    product_id: str,
    payload: StringProductUpdate,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    product = _get_product(db, product_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        if key in ("name", "brand") and value is None:
            continue
        setattr(product, key, value)
    db.commit()
    if "price" in data:
        log_audit(db, admin.label, "ADMIN", f"Set price of {product.name}", "CONTENT",
                  f"₹{product.price}" if product.price is not None else "Price on request")
    return serialize_product(_get_product(db, product_id))


@router.delete("/admin/strings/{product_id}")
def delete_string(product_id: str, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    product = _get_product(db, product_id)
    db.delete(product)
    db.commit()
    log_audit(db, admin.label, "ADMIN", f"Deleted string: {product.name}", "CONTENT")
    return {"success": True}


@router.post("/admin/strings/{product_id}/stock", response_model=StringProductSchema)
def set_all_stock(
    product_id: str,
    payload: StockUpdate,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    product = _get_product(db, product_id)
    for variant in product.variants:
        variant.inStock = payload.inStock
    db.commit()
    log_audit(db, admin.label, "ADMIN",
              f"Marked all {product.name} colours {'in stock' if payload.inStock else 'out of stock'}", "CONTENT")
    return serialize_product(_get_product(db, product_id))


@router.post("/admin/strings/{product_id}/variants", response_model=StringVariantSchema, status_code=status.HTTP_201_CREATED)
def add_variant(
    product_id: str,
    payload: StringVariantCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    product = _get_product(db, product_id)
    data = payload.model_dump()
    data["imageUrl"] = validate_link(data.get("imageUrl"), "Image")
    if data.get("sortOrder") is None:
        data["sortOrder"] = len(product.variants)
    variant = StringVariantModel(id=new_id("VAR"), productId=product.id, **data)
    db.add(variant)
    db.commit()
    db.refresh(variant)
    return variant


@router.put("/admin/string-variants/{variant_id}", response_model=StringVariantSchema)
def update_variant(
    variant_id: str,
    payload: StringVariantUpdate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    variant = _get_variant(db, variant_id)
    data = payload.model_dump(exclude_unset=True)
    if "imageUrl" in data:
        data["imageUrl"] = validate_link(data["imageUrl"], "Image")
    for key, value in data.items():
        if key == "colour" and not value:
            continue
        setattr(variant, key, value)
    db.commit()
    db.refresh(variant)
    return variant


@router.delete("/admin/string-variants/{variant_id}")
def delete_variant(variant_id: str, db: Session = Depends(get_db), _: CurrentUser = Depends(require_admin)):
    variant = _get_variant(db, variant_id)
    db.delete(variant)
    db.commit()
    return {"success": True}


# ---------------- Admin: rackets ----------------

def _get_racket(db: Session, racket_id: str) -> RacketModel:
    racket = db.query(RacketModel).filter(RacketModel.id == racket_id).first()
    if not racket:
        raise HTTPException(status_code=404, detail="Racket not found")
    return racket


def _clean_images(images: List[str]) -> List[str]:
    cleaned = []
    for url in images:
        url = validate_link(url, "Photo")
        if url and url not in cleaned:
            cleaned.append(url)
    return cleaned


@router.get("/admin/rackets", response_model=List[RacketSchema])
def list_rackets(db: Session = Depends(get_db), _: CurrentUser = Depends(require_admin)):
    return db.query(RacketModel).order_by(RacketModel.sortOrder, RacketModel.brand, RacketModel.name).all()


@router.post("/admin/rackets", response_model=RacketSchema, status_code=status.HTTP_201_CREATED)
def create_racket(payload: RacketCreate, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    data = payload.model_dump()
    data["images"] = _clean_images(data["images"])
    if data.get("sortOrder") is None:
        data["sortOrder"] = db.query(RacketModel).count()
    racket = RacketModel(id=new_id("RKT"), createdAt=now_iso(), **data)
    db.add(racket)
    db.commit()
    db.refresh(racket)
    log_audit(db, admin.label, "ADMIN", f"Added racket: {racket.brand} {racket.name}", "CONTENT")
    return racket


@router.put("/admin/rackets/{racket_id}", response_model=RacketSchema)
def update_racket(
    racket_id: str,
    payload: RacketUpdate,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    racket = _get_racket(db, racket_id)
    data = payload.model_dump(exclude_unset=True)
    if "images" in data:
        data["images"] = _clean_images(data["images"] or [])
    for key, value in data.items():
        if key in ("brand", "name", "inStock", "isFeatured", "isActive", "sortOrder") and value is None:
            continue
        setattr(racket, key, value)
    db.commit()
    db.refresh(racket)
    if "price" in data:
        log_audit(db, admin.label, "ADMIN", f"Set price of {racket.brand} {racket.name}", "CONTENT",
                  f"₹{racket.price}" if racket.price is not None else "Price on request")
    return racket


@router.delete("/admin/rackets/{racket_id}")
def delete_racket(racket_id: str, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    racket = _get_racket(db, racket_id)
    db.delete(racket)
    db.commit()
    log_audit(db, admin.label, "ADMIN", f"Deleted racket: {racket.brand} {racket.name}", "CONTENT")
    return {"success": True}
