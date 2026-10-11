from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models import NotificationModel, AuditLogModel, EmailTemplateModel

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

    notif_id = f"NOTIF-{int(datetime.now().timestamp() * 1000) % 1000000:06d}"
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
    log_id = f"LOG-{int(datetime.now().timestamp() * 1000) % 10000:04d}"
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

def render_and_simulate_email(
    db: Session,
    template_id: str,
    recipient_email: str,
    variables: Dict[str, Any]
) -> Dict[str, Any]:
    template = db.query(EmailTemplateModel).filter(EmailTemplateModel.id == template_id).first()
    if not template:
        return {"success": False, "message": f"Template {template_id} not found"}

    subject = template.subject
    body = template.body

    for k, v in variables.items():
        placeholder = f"{{{k}}}"
        subject = subject.replace(placeholder, str(v))
        body = body.replace(placeholder, str(v))

    # Log email simulation audit
    log_audit(
        db=db,
        user="System Mailer",
        role="ADMIN",
        action=f"Dispatched simulated email: {template.name}",
        request_id=str(variables.get("request_id", "SYSTEM")),
        details=f"To: {recipient_email} | Subject: {subject}"
    )

    return {
        "success": True,
        "recipient": recipient_email,
        "subject": subject,
        "body": body,
        "templateId": template_id,
        "message": f"Email successfully simulated to {recipient_email}"
    }
