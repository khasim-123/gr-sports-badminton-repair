from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import NotificationModel
from app.schemas import AppNotificationSchema, NotificationCreate
from app.services.notification_service import create_notification

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("", response_model=List[AppNotificationSchema])
def get_notifications(
    role: Optional[str] = Query(None),
    unreadOnly: bool = Query(False),
    db: Session = Depends(get_db)
):
    query = db.query(NotificationModel)

    if unreadOnly:
        query = query.filter(NotificationModel.isRead == False)

    notifications = query.all()

    # Filter by target role in JSON array if role provided
    if role:
        filtered = []
        for n in notifications:
            roles = n.targetRoles or []
            if role in roles or "ALL" in roles:
                filtered.append(n)
        return filtered[::-1]

    return notifications[::-1]


@router.post("", response_model=AppNotificationSchema, status_code=status.HTTP_201_CREATED)
def add_notification(payload: NotificationCreate, db: Session = Depends(get_db)):
    notif = create_notification(
        db=db,
        type_=payload.type,
        title=payload.title,
        message=payload.message,
        request_id=payload.requestId,
        target_roles=payload.targetRoles
    )
    return notif


@router.patch("/{notification_id}/read", response_model=AppNotificationSchema)
def mark_as_read(notification_id: str, db: Session = Depends(get_db)):
    notif = db.query(NotificationModel).filter(NotificationModel.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.isRead = True
    db.commit()
    db.refresh(notif)
    return notif


@router.post("/mark-all-read")
def mark_all_read(db: Session = Depends(get_db)):
    db.query(NotificationModel).update({NotificationModel.isRead: True})
    db.commit()
    return {"success": True, "message": "All notifications marked as read"}


@router.delete("/{notification_id}")
def delete_notification(notification_id: str, db: Session = Depends(get_db)):
    notif = db.query(NotificationModel).filter(NotificationModel.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.delete(notif)
    db.commit()
    return {"success": True, "message": "Notification deleted"}
