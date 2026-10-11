from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import EmailTemplateModel
from app.schemas import EmailTemplateSchema, EmailSimulateRequest
from app.services.notification_service import render_and_simulate_email, log_audit

router = APIRouter(prefix="/emails", tags=["Email Templates & Dispatch"])

@router.get("/templates", response_model=List[EmailTemplateSchema])
def get_email_templates(db: Session = Depends(get_db)):
    return db.query(EmailTemplateModel).all()


@router.put("/templates/{template_id}", response_model=EmailTemplateSchema)
def update_email_template(
    template_id: str,
    payload: Dict[str, Any],
    db: Session = Depends(get_db)
):
    template = db.query(EmailTemplateModel).filter(EmailTemplateModel.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Email template not found")

    if "subject" in payload:
        template.subject = payload["subject"]
    if "body" in payload:
        template.body = payload["body"]

    db.commit()
    db.refresh(template)

    log_audit(
        db=db,
        user="Admin",
        role="ADMIN",
        action=f"Updated Email Template {template_id}",
        request_id="SYSTEM",
        details=f"Subject: {template.subject}"
    )

    return template


@router.post("/simulate")
def simulate_email(payload: EmailSimulateRequest, db: Session = Depends(get_db)):
    res = render_and_simulate_email(
        db=db,
        template_id=payload.templateId,
        recipient_email=payload.recipient,
        variables=payload.variables
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res
