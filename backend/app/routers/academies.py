"""Academies: badminton academies listed on the website (admin managed).

Public (no login): the active academies, sorted by sortOrder then name (also part of
GET /content/site). Visitors request a slot through POST /enquiries (kind "academy").
Admin: create / edit / hide / delete academies.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AcademyModel
from app.schemas import AcademyBase, AcademyCreate, AcademySchema, AcademyUpdate
from app.security import CurrentUser, require_admin
from app.services.content_service import clean_text, new_id, now_iso, validate_link
from app.services.notification_service import log_audit
from app.services.sms_service import require_phone

router = APIRouter(prefix="/content", tags=["Academies"])

NAME_MIN, NAME_MAX = 2, 80
AREA_MIN, AREA_MAX = 2, 80
ADDRESS_MAX = 200
DESCRIPTION_MAX = 2000
AGE_GROUPS_MAX = 80
FEE_MAX = 80
BATCH_MAX = 80
BATCHES_MAX = 12

ACADEMY_INPUT_FIELDS = tuple(AcademyBase.model_fields) + ("sortOrder",)


def public_academies(db: Session) -> List[AcademyModel]:
    return (
        db.query(AcademyModel)
        .filter(AcademyModel.isActive == True)  # noqa: E712
        .order_by(AcademyModel.sortOrder, AcademyModel.name)
        .all()
    )


# ---------------- Validation ----------------

def _bad(detail: str) -> HTTPException:
    return HTTPException(status_code=422, detail=detail)


def clean_batches(values: Optional[List[str]]) -> List[str]:
    """Trimmed, de-duplicated (ignoring case) slot options, at most BATCHES_MAX."""
    cleaned: List[str] = []
    seen = set()
    for raw in values or []:
        v = " ".join(str(raw or "").split())
        if not v:
            continue
        if len(v) > BATCH_MAX:
            raise _bad(f'Batch "{v[:24]}…" is too long (max {BATCH_MAX} characters)')
        if v.casefold() in seen:
            continue
        seen.add(v.casefold())
        cleaned.append(v)
    if len(cleaned) > BATCHES_MAX:
        raise _bad(f"Add at most {BATCHES_MAX} batches")
    return cleaned


def _clean_academy(data: dict) -> dict:
    """Validates a full set of academy fields (create, or update merged onto the stored academy)."""
    d = dict(data)
    d["name"] = clean_text(d.get("name"), "Academy name", NAME_MAX, required=True, min_len=NAME_MIN)
    d["area"] = clean_text(d.get("area"), "Area", AREA_MAX, required=True, min_len=AREA_MIN)
    d["address"] = clean_text(d.get("address"), "Address", ADDRESS_MAX)
    d["description"] = clean_text(d.get("description"), "Description", DESCRIPTION_MAX, single_line=False)
    d["ageGroups"] = clean_text(d.get("ageGroups"), "Age groups", AGE_GROUPS_MAX)
    d["fee"] = clean_text(d.get("fee"), "Fee", FEE_MAX)
    phone = (d.get("phone") or "").strip()
    d["phone"] = require_phone(phone, "Academy phone") if phone else None
    d["mapsUrl"] = validate_link((d.get("mapsUrl") or "").strip() or None, "Google Maps link", allow_relative=False)
    d["photoUrl"] = validate_link((d.get("photoUrl") or "").strip() or None, "Photo")
    d["batches"] = clean_batches(d.get("batches"))
    return d


def _get_academy(db: Session, academy_id: str) -> AcademyModel:
    academy = db.query(AcademyModel).filter(AcademyModel.id == academy_id).first()
    if not academy:
        raise HTTPException(status_code=404, detail="Academy not found")
    return academy


# ---------------- Public ----------------

@router.get("/academies", response_model=List[AcademySchema])
def get_public_academies(db: Session = Depends(get_db)):
    return public_academies(db)


# ---------------- Admin ----------------

@router.get("/admin/academies", response_model=List[AcademySchema])
def list_academies(db: Session = Depends(get_db), _: CurrentUser = Depends(require_admin)):
    return db.query(AcademyModel).order_by(AcademyModel.sortOrder, AcademyModel.name).all()


@router.post("/admin/academies", response_model=AcademySchema, status_code=status.HTTP_201_CREATED)
def create_academy(payload: AcademyCreate, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    data = _clean_academy(payload.model_dump())
    if data.get("sortOrder") is None:
        data["sortOrder"] = db.query(AcademyModel).count()
    academy = AcademyModel(id=new_id("ACD"), createdAt=now_iso(), **data)
    db.add(academy)
    db.commit()
    db.refresh(academy)
    log_audit(db, admin.label, "ADMIN", f"Added academy: {academy.name}", "CONTENT")
    return academy


@router.put("/admin/academies/{academy_id}", response_model=AcademySchema)
def update_academy(
    academy_id: str,
    payload: AcademyUpdate,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    academy = _get_academy(db, academy_id)
    data = payload.model_dump(exclude_unset=True)
    # Fields that can't be empty: an explicit null means "leave as is".
    for key in ("batches", "isActive", "sortOrder"):
        if key in data and data[key] is None:
            data.pop(key)
    merged = {key: getattr(academy, key) for key in ACADEMY_INPUT_FIELDS}
    merged.update(data)
    for key, value in _clean_academy(merged).items():
        setattr(academy, key, value)
    db.commit()
    db.refresh(academy)
    log_audit(db, admin.label, "ADMIN", f"Updated academy: {academy.name}", "CONTENT")
    return academy


@router.delete("/admin/academies/{academy_id}")
def delete_academy(academy_id: str, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    # Enquiries keep their academyId and the academy's name (subject), so they stay readable.
    academy = _get_academy(db, academy_id)
    name = academy.name
    db.delete(academy)
    db.commit()
    log_audit(db, admin.label, "ADMIN", f"Deleted academy: {name}", "CONTENT")
    return {"success": True}
