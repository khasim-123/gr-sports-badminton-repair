from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import CourtBookingModel, NotificationModel, OrderModel, ServiceRequestModel
from app.schemas import AppNotificationSchema, NotificationCreate
from app.security import CurrentUser, get_current_user, require_admin, require_staff
from app.services.notification_service import create_notification

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _visible_notifications(db: Session, user: CurrentUser, unread_only: bool = False) -> List[NotificationModel]:
    """Staff see notifications targeted at their role. Customers only see customer-targeted
    notifications about their own service requests, shop orders and court bookings (an order /
    court booking notification's requestId is the order / booking id)."""
    query = db.query(NotificationModel)
    if unread_only:
        query = query.filter(NotificationModel.isRead == False)  # noqa: E712
    # Oldest first (reversed below). Without ORDER BY, PostgreSQL returns rows in physical
    # order, which changes after updates (e.g. marking one read), so the list would reshuffle.
    notifications = query.order_by(NotificationModel.timestamp, NotificationModel.id).all()

    own_request_ids = None
    if not user.is_staff:
        own_request_ids = {
            rid for (rid,) in db.query(ServiceRequestModel.id)
            .filter(ServiceRequestModel.customerMobile == user.phone)
            .all()
        }
        own_request_ids |= {
            oid for (oid,) in db.query(OrderModel.id).filter(OrderModel.customerMobile == user.phone).all()
        }
        own_request_ids |= {
            bid for (bid,) in db.query(CourtBookingModel.id).filter(CourtBookingModel.customerMobile == user.phone).all()
        }
    elif not user.is_admin:
        # Employees: general notices plus ones about their own jobs / new unassigned bookings.
        from app.routers.requests import employee_visible_filter

        own_request_ids = {
            rid for (rid,) in db.query(ServiceRequestModel.id).filter(employee_visible_filter(user)).all()
        }

    visible = []
    for n in notifications:
        roles = n.targetRoles or []
        if user.role not in roles and "ALL" not in roles:
            continue
        if own_request_ids is not None and n.requestId not in own_request_ids:
            if user.is_staff and not n.requestId:
                pass  # general staff notice (not about a specific request)
            else:
                continue
        visible.append(n)
    return visible[::-1]


@router.get("", response_model=List[AppNotificationSchema])
def get_notifications(
    role: Optional[str] = Query(None),  # kept for backwards compatibility; the token decides
    unreadOnly: bool = Query(False),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    # Newest first; older notifications aren't needed on screen.
    return _visible_notifications(db, user, unreadOnly)[:limit]


@router.post("", response_model=AppNotificationSchema, status_code=status.HTTP_201_CREATED)
def add_notification(payload: NotificationCreate, db: Session = Depends(get_db), _admin: CurrentUser = Depends(require_admin)):
    # Admin only: an employee could otherwise message any customer (e.g. fake payment requests).
    notif = create_notification(
        db=db,
        type_=payload.type,
        title=payload.title,
        message=payload.message,
        request_id=payload.requestId,
        target_roles=payload.targetRoles
    )
    return notif


def _get_visible(db: Session, user: CurrentUser, notification_id: str) -> NotificationModel:
    for n in _visible_notifications(db, user):
        if n.id == notification_id:
            return n
    raise HTTPException(status_code=404, detail="Notification not found")


@router.patch("/{notification_id}/read", response_model=AppNotificationSchema)
def mark_as_read(notification_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    notif = _get_visible(db, user, notification_id)
    notif.isRead = True
    db.commit()
    db.refresh(notif)
    return notif


@router.post("/mark-all-read")
def mark_all_read(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    for n in _visible_notifications(db, user, unread_only=True):
        n.isRead = True
    db.commit()
    return {"success": True, "message": "All notifications marked as read"}


@router.delete("/{notification_id}")
def delete_notification(notification_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(require_staff)):
    notif = _get_visible(db, user, notification_id)
    db.delete(notif)
    db.commit()
    return {"success": True, "message": "Notification deleted"}
