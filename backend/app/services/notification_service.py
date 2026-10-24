import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models import NotificationModel, AuditLogModel

def get_current_formatted_time() -> str:
    now = datetime.now()
    return now.strftime("%d %b, %I:%M %p")

def get_current_audit_time() -> str:
    now = datetime.now()
    return now.strftime("%Y-%m-%d %H:%M")

def create_notification(
    db: Session,
    type_: str,
    title: str,
    message: str,
    request_id: Optional[str] = None,
    target_roles: Optional[List[str]] = None
) -> NotificationModel:
    if target_roles is None:
        target_roles = ["ADMIN", "EMPLOYEE"]

    notif_id = f"NOTIF-{uuid.uuid4().hex[:12]}"
    notif = NotificationModel(
        id=notif_id,
        type=type_,
        title=title,
        message=message,
        requestId=request_id,
        timestamp=get_current_formatted_time(),
        isRead=False,
        targetRoles=target_roles
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif

def log_audit(
    db: Session,
    user: str,
    role: str,
    action: str,
    request_id: str,
    details: Optional[str] = None
) -> AuditLogModel:
    log_id = f"LOG-{uuid.uuid4().hex[:12]}"
    log = AuditLogModel(
        id=log_id,
        timestamp=get_current_audit_time(),
        user=user,
        role=role,
        action=action,
        requestId=request_id,
        details=details
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log
