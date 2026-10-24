"""Customers (admin only): who has booked with us, how often, and what they've paid.

Booking counts are computed from service requests by the customer's mobile number
(+91XXXXXXXXXX), so requests staff booked over the phone are included too.
"""
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CustomerModel, ServiceRequestModel
from app.schemas import CustomerDetailSchema, CustomerSummarySchema
from app.security import CurrentUser, require_admin

router = APIRouter(prefix="/customers", tags=["Customers"])

CLOSED_STATUSES = {"Payment Collected", "Completed", "Completed Without Repair", "Cancelled"}


def _paid_amount(r: ServiceRequestModel) -> float:
    if r.paymentStatus != "Paid":
        return 0.0
    record = r.paymentRecord if isinstance(r.paymentRecord, dict) else {}
    amount = record.get("amount")
    try:
        return float(amount) if amount is not None else float(r.totalAmount or 0)
    except (TypeError, ValueError):
        return float(r.totalAmount or 0)


def _summary(c: CustomerModel, reqs: List[ServiceRequestModel]) -> Dict:
    last = max((r.createdAt for r in reqs if r.createdAt), default=None)
    return {
        "id": c.id,
        "name": c.name,
        "phone": c.phone,
        "address": c.address,
        "createdAt": c.createdAt,
        "bookings": len(reqs),
        "openBookings": sum(1 for r in reqs if r.status not in CLOSED_STATUSES),
        "lastBookingAt": last,
        "totalPaid": round(sum(_paid_amount(r) for r in reqs), 2),
    }


def _requests_by_mobile(db: Session, mobiles: Optional[List[str]] = None) -> Dict[str, List[ServiceRequestModel]]:
    q = db.query(ServiceRequestModel)
    if mobiles is not None:
        if not mobiles:
            return {}
        q = q.filter(ServiceRequestModel.customerMobile.in_(mobiles))
    grouped: Dict[str, List[ServiceRequestModel]] = {}
    for r in q.all():
        grouped.setdefault(r.customerMobile, []).append(r)
    return grouped


@router.get("", response_model=List[CustomerSummarySchema])
def list_customers(
    search: Optional[str] = Query(None, max_length=80),
    db: Session = Depends(get_db),
    _admin: CurrentUser = Depends(require_admin),
):
    customers = db.query(CustomerModel).all()
    term = " ".join((search or "").split()).casefold()
    if term:
        digits = "".join(ch for ch in term if ch.isdigit())
        customers = [
            c for c in customers
            if term in (c.name or "").casefold()
            or (digits and digits in "".join(ch for ch in (c.phone or "") if ch.isdigit()))
        ]
    grouped = _requests_by_mobile(db, [c.phone for c in customers])
    rows = [_summary(c, grouped.get(c.phone, [])) for c in customers]
    # Most recent booking first; customers who never booked go last (newest sign-ups first).
    rows.sort(key=lambda row: (row["lastBookingAt"] or "", row["createdAt"] or ""), reverse=True)
    return rows


@router.get("/{customer_id}", response_model=CustomerDetailSchema)
def get_customer(customer_id: str, db: Session = Depends(get_db), _admin: CurrentUser = Depends(require_admin)):
    c = db.query(CustomerModel).filter(CustomerModel.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    reqs = _requests_by_mobile(db, [c.phone]).get(c.phone, [])
    reqs.sort(key=lambda r: r.createdAt or "", reverse=True)
    return {
        "customer": _summary(c, reqs),
        "requests": [
            {
                "id": r.id,
                "serviceType": r.serviceType,
                "status": r.status,
                "paymentStatus": r.paymentStatus,
                "totalAmount": float(r.totalAmount or 0),
                "createdAt": r.createdAt,
                "batBrand": r.batBrand,
                "batModel": r.batModel,
            }
            for r in reqs
        ],
    }
