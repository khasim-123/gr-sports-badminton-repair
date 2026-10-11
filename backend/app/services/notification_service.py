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

from app.config import settings
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_email_via_resend_api(to_email: str, subject: str, body: str) -> bool:
    """Dispatches a real email using Resend REST API."""
    if not settings.RESEND_API_KEY:
        return False
    try:
        import urllib.request
        import json

        html_body = body.replace("\n", "<br/>") if ("<html" not in body and "<div" not in body and "<p" not in body) else body
        from_email = settings.SMTP_FROM_EMAIL or "onboarding@resend.dev"

        data = {
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "html": html_body
        }
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=json.dumps(data).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
                "User-Agent": "GRSportsPlatform/1.0"
            }
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status in [200, 201]
    except Exception as e:
        print(f"[Resend API Note] REST API dispatch result for {to_email}: {e}")
        return False

def send_email_via_smtp(to_email: str, subject: str, body: str) -> bool:
    """Dispatches a real email using Resend REST API or SMTP."""
    # Priority 1: Resend REST API
    if settings.RESEND_API_KEY:
        if send_email_via_resend_api(to_email, subject, body):
            return True

    # Priority 2: SMTP server
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = settings.SMTP_FROM_EMAIL
        msg["To"] = to_email
        msg["Subject"] = subject

        mime_type = "html" if ("<html" in body or "<div" in body or "<p" in body) else "plain"
        msg.attach(MIMEText(body, mime_type))

        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"[SMTP Warning] Failed to send email to {to_email}: {e}")
        return False

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

    # Attempt real SMTP send if configured
    smtp_sent = send_email_via_smtp(recipient_email, subject, body)

    # Log email audit
    status_label = "Dispatched real SMTP email" if smtp_sent else "Dispatched simulated email"
    log_audit(
        db=db,
        user="System Mailer",
        role="ADMIN",
        action=f"{status_label}: {template.name}",
        request_id=str(variables.get("request_id", "SYSTEM")),
        details=f"To: {recipient_email} | Subject: {subject} | SMTP Delivered: {smtp_sent}"
    )

    return {
        "success": True,
        "recipient": recipient_email,
        "subject": subject,
        "body": body,
        "templateId": template_id,
        "smtpSent": smtp_sent,
        "message": f"Email {'delivered via SMTP' if smtp_sent else 'simulated'} to {recipient_email}"
    }
