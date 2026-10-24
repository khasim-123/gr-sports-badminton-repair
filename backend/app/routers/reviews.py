from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ReviewModel
from app.schemas import (
    CustomerReviewSchema,
    PublicReviewsResponse,
    ReviewModerationUpdate,
    ReviewStatus,
    ReviewSubmission,
)
from app.security import CurrentUser, get_optional_user, rate_limit, require_admin
from app.services.content_service import new_id, now_iso, review_summary
from app.services.notification_service import create_notification, log_audit

router = APIRouter(prefix="/reviews", tags=["Customer Reviews"])


@router.get("", response_model=PublicReviewsResponse)
def get_public_reviews(limit: int = Query(12, ge=1, le=50), db: Session = Depends(get_db)):
    reviews = (
        db.query(ReviewModel)
        .filter(ReviewModel.status == "approved")
        .order_by(ReviewModel.isFeatured.desc(), ReviewModel.createdAt.desc())
        .limit(limit)
        .all()
    )
    return {"summary": review_summary(db), "reviews": reviews}


@router.post(
    "",
    response_model=CustomerReviewSchema,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("review", limit=5, window_seconds=3600))],
)
def submit_review(
    payload: ReviewSubmission,
    db: Session = Depends(get_db),
    user: Optional[CurrentUser] = Depends(get_optional_user),
):
    review = ReviewModel(
        id=new_id("REV"),
        authorName=payload.authorName.strip(),
        authorPhone=user.phone if user and user.role == "CUSTOMER" else None,
        rating=payload.rating,
        comment=payload.comment.strip(),
        serviceType=payload.serviceType,
        location=payload.location,
        status="pending",
        isVerified=False,
        createdAt=now_iso(),
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    create_notification(
        db,
        type_="system",
        title="New review awaiting approval",
        message=f"{review.authorName} left a {review.rating}★ review. Approve it in Website Content → Reviews.",
        target_roles=["ADMIN"],
    )
    return review


# ---------------- Admin moderation ----------------

def _get_review(db: Session, review_id: str) -> ReviewModel:
    review = db.query(ReviewModel).filter(ReviewModel.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return review


@router.get("/admin", response_model=List[CustomerReviewSchema])
def list_reviews(
    status_filter: Optional[ReviewStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    query = db.query(ReviewModel)
    if status_filter:
        query = query.filter(ReviewModel.status == status_filter)
    return query.order_by(ReviewModel.createdAt.desc()).all()


@router.patch("/admin/{review_id}", response_model=CustomerReviewSchema)
def moderate_review(
    review_id: str,
    payload: ReviewModerationUpdate,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    review = _get_review(db, review_id)
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and data["status"] is not None:
        review.status = data["status"]
        if review.status != "approved":
            review.isFeatured = False
    if "isFeatured" in data and data["isFeatured"] is not None:
        if data["isFeatured"] and review.status != "approved":
            raise HTTPException(status_code=422, detail="Only approved reviews can be featured")
        review.isFeatured = data["isFeatured"]
    if "adminReply" in data:
        review.adminReply = (data["adminReply"] or "").strip() or None
    db.commit()
    db.refresh(review)
    log_audit(db, admin.label, "ADMIN", f"Review {review.id} → {review.status}", review.requestId or "CONTENT")
    return review


@router.delete("/admin/{review_id}")
def delete_review(review_id: str, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    review = _get_review(db, review_id)
    db.delete(review)
    db.commit()
    log_audit(db, admin.label, "ADMIN", f"Deleted review {review_id}", review.requestId or "CONTENT")
    return {"success": True}
