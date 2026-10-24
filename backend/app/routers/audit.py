from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import AuditLogModel
from app.schemas import AuditLogSchema
from app.security import CurrentUser, require_admin

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])

@router.get("", response_model=List[AuditLogSchema])
def get_audit_logs(db: Session = Depends(get_db), _admin: CurrentUser = Depends(require_admin)):
    return db.query(AuditLogModel).order_by(AuditLogModel.timestamp.desc()).all()
