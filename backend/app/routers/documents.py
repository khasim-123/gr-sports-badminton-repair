from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DocumentModel
from app.schemas import DocumentCreate, DocumentSchema, DocumentUpdate
from app.security import CurrentUser, require_admin, require_staff
from app.services.content_service import new_id, now_iso, validate_link
from app.services.notification_service import log_audit

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("", response_model=List[DocumentSchema])
def get_public_documents(db: Session = Depends(get_db)):
    return (
        db.query(DocumentModel)
        .filter(DocumentModel.isPublic == True)  # noqa: E712
        .order_by(DocumentModel.sortOrder, DocumentModel.title)
        .all()
    )


@router.get("/admin", response_model=List[DocumentSchema])
def list_documents(db: Session = Depends(get_db), _: CurrentUser = Depends(require_staff)):
    return db.query(DocumentModel).order_by(DocumentModel.category, DocumentModel.sortOrder, DocumentModel.title).all()


@router.post("/admin", response_model=DocumentSchema, status_code=status.HTTP_201_CREATED)
def create_document(payload: DocumentCreate, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    data = payload.model_dump()
    data["fileUrl"] = validate_link(data["fileUrl"], "File link")
    if data.get("sortOrder") is None:
        data["sortOrder"] = db.query(DocumentModel).count()
    doc = DocumentModel(id=new_id("DOC"), createdAt=now_iso(), **data)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    log_audit(db, admin.label, "ADMIN", f"Added document: {doc.title}", "CONTENT")
    return doc


@router.put("/admin/{doc_id}", response_model=DocumentSchema)
def update_document(
    doc_id: str,
    payload: DocumentUpdate,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    data = payload.model_dump(exclude_unset=True)
    if "fileUrl" in data:
        if not data["fileUrl"]:
            raise HTTPException(status_code=422, detail="File link is required")
        data["fileUrl"] = validate_link(data["fileUrl"], "File link")
    for key, value in data.items():
        if key in ("title", "category") and value is None:
            continue
        setattr(doc, key, value)
    db.commit()
    db.refresh(doc)
    log_audit(db, admin.label, "ADMIN", f"Updated document: {doc.title}", "CONTENT")
    return doc


@router.delete("/admin/{doc_id}")
def delete_document(doc_id: str, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
    log_audit(db, admin.label, "ADMIN", f"Deleted document: {doc.title}", "CONTENT")
    return {"success": True}
