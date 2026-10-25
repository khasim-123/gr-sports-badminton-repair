import base64
import binascii
import random
import secrets
import time
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models import (
    ServiceRequestModel,
    DistanceConfigModel,
    EmployeeModel,
    GettingServiceTierModel,
    CustomerModel,
    MediaModel,
)
from app.schemas import (
    ServiceRequestSchema,
    RequestCreate,
    RequestStatusUpdate,
    AssignEmployeeRequest,
    RecordPickupConditionRequest,
    RepairEstimateSchema,
    PriceRevisionRequest,
    RecordPaymentRequest,
    ReviewSchema,
    MAX_AMOUNT,
)
from app.services.pricing_service import calculate_delivery_charge, road_distance_km, valid_coordinates
from app.services.shop_settings import get_shop_settings, display_phone
from app.services.content_service import assert_pickup_date_available, new_id, now_iso, process_upload
from app.routers.media import media_url
from app.models import ReviewModel
from app.security import CurrentUser, get_current_user, require_staff
from app.services.sms_service import require_phone
from app.services.notification_service import (
    create_notification,
    log_audit,
    get_current_formatted_time
)

router = APIRouter(prefix="/requests", tags=["Service Requests"])


# New bookings any employee may see (and accept) before they're assigned.
_OPEN_FOR_ACCEPT = ("Submitted", "Accepted")


def employee_visible_filter(user: CurrentUser):
    """Employees see their own jobs plus new unassigned bookings — not every customer's data."""
    unassigned = or_(ServiceRequestModel.assignedEmployeeId.is_(None), ServiceRequestModel.assignedEmployeeId == "")
    return or_(
        ServiceRequestModel.assignedEmployeeId == user.id,
        and_(unassigned, ServiceRequestModel.status.in_(_OPEN_FOR_ACCEPT)),
    )


def employee_can_see(req: ServiceRequestModel, user: CurrentUser) -> bool:
    if req.assignedEmployeeId == user.id:
        return True
    return not req.assignedEmployeeId and req.status in _OPEN_FOR_ACCEPT


def _load_request(db: Session, request_id: str, user: CurrentUser) -> ServiceRequestModel:
    """Fetches a request the user may access. Customers only see their own, employees their
    own jobs and new unassigned bookings (404 otherwise, so other ids aren't confirmed)."""
    req = db.query(ServiceRequestModel).filter(ServiceRequestModel.id == request_id).first()
    if not req or (not user.is_staff and req.customerMobile != user.phone):
        raise HTTPException(status_code=404, detail=f"Request {request_id} not found")
    if user.is_staff and not user.is_admin and not employee_can_see(req, user):
        raise HTTPException(status_code=404, detail=f"Request {request_id} not found")
    return req


def _load_for_staff(db: Session, request_id: str, user: CurrentUser) -> ServiceRequestModel:
    """Fetches a request for a workshop action. Employees may only work on jobs assigned
    to them (admins can act on any request, e.g. to correct a mistake)."""
    req = db.query(ServiceRequestModel).filter(ServiceRequestModel.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if not user.is_admin and req.assignedEmployeeId != user.id:
        if req.assignedEmployeeId:
            detail = f"{request_id} is assigned to {req.assignedEmployeeName or 'another staff member'}. Ask the admin to reassign it to you."
        else:
            detail = f"Accept {request_id} before working on it."
        raise HTTPException(status_code=403, detail=detail)
    return req


def _require_status(req: ServiceRequestModel, allowed, action: str) -> None:
    """Rejects an action that doesn't fit the request's current status (e.g. a second phone
    showing an out-of-date screen)."""
    if req.status not in allowed:
        raise HTTPException(
            status_code=409,
            detail=f"Can't {action}: {req.id} is now '{req.status}'. Refresh to see the latest status.",
        )


def _require_customer(user: CurrentUser, action: str) -> None:
    """Estimate approval is the customer's consent to be charged; staff can't give it for them
    (an admin who takes approval by phone records it with a status change instead)."""
    if user.is_staff:
        raise HTTPException(status_code=403, detail=f"Only the customer can {action} the estimate")


def _was_declined(req: ServiceRequestModel) -> bool:
    return req.status == "Repair Declined" or any(
        (e or {}).get("status") == "Repair Declined" for e in (req.timeline or [])
    )


def _declined_fee(req: ServiceRequestModel) -> float:
    """The declined-repair fee fixed when the customer declined (0 for older requests)."""
    return float((req.repairEstimate or {}).get("declinedRepairFee") or 0.0)


def _amount_due(req: ServiceRequestModel) -> float:
    """What the customer pays on delivery. A declined repair is returned unrepaired: the
    pickup & delivery charge plus the shop's declined-repair fee (if any) applies."""
    if _was_declined(req):
        return float(req.pickupDeliveryCharge or 0.0) + _declined_fee(req)
    return float(req.totalAmount or 0.0)


def _distance_config(db: Session) -> DistanceConfigModel:
    config = db.query(DistanceConfigModel).first()
    if config:
        return config
    return DistanceConfigModel(  # fallback when nothing is configured yet
        shopLat=settings.DEFAULT_SHOP_LAT,
        shopLng=settings.DEFAULT_SHOP_LNG,
        freeRadiusKm=10.0,
        perKmRateBeyondFree=15.0,
        pricingMethod="PER_KM",
        maxServiceDistanceKm=35.0,
    )


class DistanceCorrectionRequest(BaseModel):
    distanceKm: float = Field(..., ge=0, le=200)
    reason: str = Field(..., min_length=3, max_length=200)


def _km(value: float) -> str:
    return f"{float(value or 0):g}"


# Status changes an employee may make through PATCH /status (admins may set any status).
_PICKUP_STATUSES = ("Submitted", "Accepted", "Employee Assigned", "Pickup Scheduled")
# How a status reads in the request history customers and staff see (values themselves are unchanged).
_STATUS_WORDING = {
    "Submitted": "Booked",
    "Accepted": "Accepted",
    "Employee Assigned": "Assigned to our team",
    "Pickup Scheduled": "Pickup scheduled",
    "Bat Picked Up": "Racket picked up",
    "Getting in Progress": "Stringing started",
    "Getting Completed": "Stringing done",
    "Inspection": "Being inspected",
    "Repair Estimate": "Estimate being prepared",
    "Awaiting Customer Approval": "Waiting for approval",
    "Repair Approved": "Repair approved",
    "Repair in Progress": "Repair started",
    "Repair Completed": "Repair done",
    "Repair Declined": "Repair declined",
    "Out for Delivery": "Out for delivery",
    "Delivered": "Delivered",
    "Payment Pending": "Payment due",
    "Payment Collected": "Paid",
    "Completed": "Completed",
    "Completed Without Repair": "Returned without repair",
    "Cancelled": "Cancelled",
}


def _status_wording(status: str) -> str:
    return _STATUS_WORDING.get(status, status)


_ESTIMATE_STATUSES = ("Bat Picked Up", "Inspection", "Repair Estimate")
_REVISE_STATUSES = ("Repair Approved", "Repair in Progress")
_PAYMENT_STATUSES = ("Out for Delivery", "Delivered", "Payment Pending")
_REVIEWABLE_STATUSES = ("Delivered", "Payment Collected", "Completed", "Completed Without Repair")
_EMPLOYEE_MOVES = {
    ("GETTING", "Bat Picked Up"): {"Getting in Progress"},
    ("GETTING", "Getting in Progress"): {"Getting Completed"},
    ("GETTING", "Getting Completed"): {"Out for Delivery"},
    ("REPAIR", "Bat Picked Up"): {"Inspection"},
    ("REPAIR", "Repair Approved"): {"Repair in Progress"},
    ("REPAIR", "Repair in Progress"): {"Repair Completed"},
    ("REPAIR", "Repair Completed"): {"Out for Delivery"},
    ("REPAIR", "Repair Declined"): {"Out for Delivery"},
}


def _new_request_id(db: Session, prefix: str) -> str:
    for _ in range(20):
        candidate = f"{prefix}-{random.randint(10000, 99999)}"
        if not db.query(ServiceRequestModel.id).filter(ServiceRequestModel.id == candidate).first():
            return candidate
    return f"{prefix}-{new_id('X')[2:]}"

@router.get("", response_model=List[ServiceRequestSchema])
def get_requests(
    status: Optional[str] = Query(None),
    serviceType: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    customerId: Optional[str] = Query(None),
    employeeId: Optional[str] = Query(None),
    includePhotos: bool = Query(False),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    query = db.query(ServiceRequestModel)
    if not user.is_staff:
        query = query.filter(ServiceRequestModel.customerMobile == user.phone)
    elif not user.is_admin:
        query = query.filter(employee_visible_filter(user))

    if status and status != "All":
        query = query.filter(ServiceRequestModel.status == status)

    if serviceType and serviceType != "All":
        query = query.filter(ServiceRequestModel.serviceType == serviceType)

    if employeeId:
        query = query.filter(ServiceRequestModel.assignedEmployeeId == employeeId)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (ServiceRequestModel.id.ilike(search_filter)) |
            (ServiceRequestModel.customerName.ilike(search_filter)) |
            (ServiceRequestModel.customerMobile.ilike(search_filter)) |
            (ServiceRequestModel.batBrand.ilike(search_filter)) |
            (ServiceRequestModel.batModel.ilike(search_filter))
        )

    # Return descending by creation
    rows = query.order_by(ServiceRequestModel.createdAt.desc()).all()
    if includePhotos:
        return rows
    # Phone photos are stored as ~150 KB data URLs; a list with all of them runs to many MB.
    # Lists leave the photo data out — screens fetch GET /requests/{id} when a request is opened.
    return [_without_photo_data(r) for r in rows]


def _is_embedded(photo: str) -> bool:
    return isinstance(photo, str) and photo.startswith("data:")


def _store_photos(db: Session, http_request: Request, photos: Optional[List[str]], uploaded_by: str) -> List[str]:
    """Saves photos sent as data: URLs in the media store and returns their links, so a request
    row (and every list of requests) holds short URLs instead of ~150 KB of image data each.
    Photo ids are long and random: the media endpoint is public, the links are not guessable."""
    stored: List[str] = []
    for photo in photos or []:
        if not _is_embedded(photo):
            stored.append(photo)
            continue
        header, _, encoded = photo.partition(",")
        try:
            raw = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(status_code=422, detail="A photo could not be read. Please attach it again.")
        body, content_type, ext = process_upload(raw, header[5:].split(";")[0])
        if not content_type.startswith("image/"):
            raise HTTPException(status_code=415, detail="Photos must be JPG, PNG, WebP or GIF images.")
        media = MediaModel(
            id=f"PHO-{secrets.token_urlsafe(18)}",
            fileName=f"racket-photo.{ext}",
            contentType=content_type,
            size=len(body),
            data=body,
            uploadedBy=uploaded_by,
            createdAt=now_iso(),
        )
        db.add(media)
        stored.append(media_url(http_request, media.id))
    return stored


def _without_photo_data(req: ServiceRequestModel) -> ServiceRequestSchema:
    item = ServiceRequestSchema.model_validate(req, from_attributes=True)
    update = {"batPhotos": [p for p in item.batPhotos if not _is_embedded(p)]}
    if item.pickupCondition is not None:
        update["pickupCondition"] = item.pickupCondition.model_copy(
            update={"photos": [p for p in (item.pickupCondition.photos or []) if not _is_embedded(p)]}
        )
    return item.model_copy(update=update)


@router.get("/{request_id}", response_model=ServiceRequestSchema)
def get_request_by_id(request_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    return _load_request(db, request_id, user)


@router.post("", response_model=ServiceRequestSchema, status_code=status.HTTP_201_CREATED)
def create_request(
    payload: RequestCreate,
    http_request: Request,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    if not user.is_staff:
        # Customers can only book for their own account.
        payload.customerMobile = user.phone
    else:
        payload.customerMobile = require_phone(payload.customerMobile, "Customer mobile number")
    if payload.pickupDate:
        assert_pickup_date_available(db, payload.pickupDate)
    is_getting = payload.serviceType == "GETTING"
    prefix = "GET" if is_getting else "REP"
    req_id = _new_request_id(db, prefix)

    dist_config = _distance_config(db)

    # The distance decides the delivery charge, so it comes from the customer's location
    # whenever we have one (never from a number the browser sends).
    addr = payload.pickupAddress
    if addr.lat is not None or addr.lng is not None:
        if addr.lat is None or addr.lng is None or not valid_coordinates(addr.lat, addr.lng):
            raise HTTPException(
                status_code=422,
                detail="Your location couldn't be read. Try 'Use my current location' again or enter the distance instead.",
            )
        payload.distanceKm = road_distance_km(dist_config.shopLat, dist_config.shopLng, addr.lat, addr.lng)
        addr.distanceSource = "location"
    else:
        if payload.distanceKm is None or payload.distanceKm < 0:
            raise HTTPException(status_code=422, detail="Distance can't be negative")
        payload.distanceKm = round(float(payload.distanceKm), 1)
        addr.distanceSource = "customer"
    addr.distanceKm = payload.distanceKm

    max_km = dist_config.maxServiceDistanceKm or 0
    if max_km and payload.distanceKm > max_km:
        shop_phone = display_phone(get_shop_settings(db).get("phone") or "")
        raise HTTPException(
            status_code=422,
            detail=(
                f"Sorry, doorstep pickup is available within {max_km:g} KM of our Dondaparthy workshop "
                f"(your address is about {payload.distanceKm:g} KM away). Please call {shop_phone} or drop your racket at the store."
            ),
        )

    # Staff booking for a phone / walk-in customer: make sure the customer has an account so
    # they can sign in with OTP later and follow the request.
    booked_by_staff = user.is_staff
    if booked_by_staff:
        existing = db.query(CustomerModel).filter(CustomerModel.phone == payload.customerMobile).first()
        if not existing:
            db.add(CustomerModel(
                id=f"CUST-{uuid.uuid4().hex[:10]}",
                name=(payload.customerName or "").strip() or "Customer",
                email=None,
                phone=payload.customerMobile,
                address=", ".join(p for p in (addr.houseFlat, addr.street, addr.area) if p),
                password=None,
                createdAt=time.strftime("%d %b %Y, %I:%M %p"),
            ))

    calc = calculate_delivery_charge(payload.distanceKm, dist_config)
    delivery_charge = calc["charge"]
    is_free = calc["isFree"]

    # Calculate service charge
    if is_getting:
        tier = None
        if payload.gettingType:
            tier = (
                db.query(GettingServiceTierModel)
                # The booking form sends the package name; older clients/tests send the id.
                .filter(
                    (GettingServiceTierModel.id == payload.gettingType) | (GettingServiceTierModel.name == payload.gettingType),
                    GettingServiceTierModel.isActive == True,  # noqa: E712
                )
                .first()
            )
        if tier is None:
            raise HTTPException(status_code=422, detail="Please choose one of our stringing packages")
        service_charge = float(tier.price)
        payload.gettingPrice = service_charge
    else:
        # Repairs are priced by the workshop estimate after inspection.
        service_charge = 0.0

    total_amount = service_charge + delivery_charge

    now_iso = datetime.utcnow().isoformat() + "Z"
    formatted_time = get_current_formatted_time()

    distance_note = (
        f"{_km(payload.distanceKm)} KM from the shop (from the customer's location)."
        if addr.distanceSource == "location"
        else f"{_km(payload.distanceKm)} KM from the shop (entered by the customer — check at pickup)."
    )
    charge_note = "Free pickup applied." if is_free else f"Delivery surcharge ₹{delivery_charge:g}."
    timeline = [
        {
            "status": "Submitted",
            "label": (
                f"Booked by {user.label} for the customer (phone/walk-in)"
                if booked_by_staff else "Booked online"
            ),
            "timestamp": formatted_time,
            "actor": user.label if booked_by_staff else f"Customer ({payload.customerName})",
            "notes": f"Booking received. {charge_note} {distance_note}",
        }
    ]

    new_request = ServiceRequestModel(
        id=req_id,
        serviceType=payload.serviceType,
        customerName=payload.customerName,
        customerEmail=None,
        customerMobile=payload.customerMobile,
        createdAt=now_iso,
        status="Submitted",
        batBrand=payload.batBrand,
        batModel=payload.batModel,
        batType=payload.batType,
        batPhotos=_store_photos(db, http_request, payload.batPhotos, user.label),
        gettingType=payload.gettingType,
        stringPreference=payload.stringPreference,
        stringType=payload.stringType,
        stringTensionLbs=payload.stringTensionLbs,
        gettingPrice=payload.gettingPrice,
        colour=payload.colour,
        repairIssue=payload.repairIssue,
        repairDescription=payload.repairDescription,
        pickupDate=payload.pickupDate,
        pickupAddress=payload.pickupAddress.dict(),
        distanceKm=payload.distanceKm,
        pickupDeliveryCharge=delivery_charge,
        isFreeDelivery=is_free,
        serviceCharge=service_charge,
        discount=0.0,
        totalAmount=total_amount,
        paymentStatus="Pending",
        timeline=timeline,
        additionalNotes=payload.additionalNotes
    )

    db.add(new_request)
    db.commit()
    db.refresh(new_request)

    # 1. Audit log
    log_audit(
        db=db,
        user=user.label if booked_by_staff else payload.customerName,
        role=user.role if booked_by_staff else "CUSTOMER",
        action=f"Created {payload.serviceType} Request" + (f" for {payload.customerName}" if booked_by_staff else ""),
        request_id=req_id,
        details=f"{payload.batBrand} {payload.batModel} | Total: ₹{total_amount} | {_km(payload.distanceKm)} KM ({addr.distanceSource})"
    )

    # 2. In-app notification for Admin and Employee
    create_notification(
        db=db,
        type_="new_request",
        title=f"New {payload.serviceType.capitalize()} Request Placed",
        message=f"{payload.customerName} submitted {req_id} ({payload.batBrand} {payload.batModel}). Pickup: {payload.pickupAddress.area} ({payload.distanceKm} KM).",
        request_id=req_id,
        target_roles=["ADMIN", "EMPLOYEE"]
    )

    return new_request


@router.patch("/{request_id}/status", response_model=ServiceRequestSchema)
def update_status(request_id: str, payload: RequestStatusUpdate, db: Session = Depends(get_db),
    staff: CurrentUser = Depends(require_staff)):
    req = _load_for_staff(db, request_id, staff)
    if not staff.is_admin:
        allowed = set(_EMPLOYEE_MOVES.get((req.serviceType, req.status), set()))
        # A declined repair that is handed back with nothing to pay is closed here
        # (with a charge, recording the payment closes it).
        if req.status == "Out for Delivery" and _was_declined(req) and _amount_due(req) <= 0:
            allowed.add("Completed Without Repair")
        if payload.status not in allowed:
            raise HTTPException(
                status_code=409,
                detail=f"Can't change {request_id} from '{req.status}' to '{payload.status}'. Refresh to see the latest status.",
            )

    req.status = payload.status
    formatted_time = get_current_formatted_time()
    actor = staff.label  # who really made the change (not a name sent by the client)

    timeline_event = {
        "status": payload.status,
        "label": _status_wording(payload.status),
        "timestamp": formatted_time,
        "actor": actor,
        "notes": payload.notes or ""
    }

    current_timeline = list(req.timeline or [])
    current_timeline.append(timeline_event)
    req.timeline = current_timeline

    db.commit()
    db.refresh(req)

    # Audit & Notification
    log_audit(
        db=db,
        user=actor,
        role=staff.role,
        action=f"Updated status to {payload.status}",
        request_id=request_id,
        details=payload.notes
    )

    create_notification(
        db=db,
        type_="status_update",
        title=f"Request {request_id} Updated",
        message=f"Status changed to '{payload.status}' by {actor}.",
        request_id=request_id,
        target_roles=["ADMIN", "EMPLOYEE", "CUSTOMER"]
    )


    return req


@router.post("/{request_id}/assign", response_model=ServiceRequestSchema)
def assign_technician(request_id: str, payload: AssignEmployeeRequest, db: Session = Depends(get_db),
    staff: CurrentUser = Depends(require_staff)):
    req = db.query(ServiceRequestModel).filter(ServiceRequestModel.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    emp = db.query(EmployeeModel).filter(EmployeeModel.id == payload.employeeId).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    if emp.isActive is False:
        raise HTTPException(status_code=422, detail=f"{emp.name}'s account is deactivated")

    self_accept = not staff.is_admin
    if self_accept:
        # Employees can only accept a new, unassigned request for themselves.
        if emp.id != staff.id:
            raise HTTPException(status_code=403, detail="Only the admin can assign jobs to other staff")
        if req.assignedEmployeeId and req.assignedEmployeeId != staff.id:
            raise HTTPException(
                status_code=409,
                detail=f"{request_id} was already accepted by {req.assignedEmployeeName or 'another staff member'}.",
            )
        _require_status(req, ("Submitted", "Accepted"), "accept this job")
        # Two employees tapping "Accept" at the same time: only one UPDATE can match the
        # still-unassigned row (the database re-checks the condition under its row lock).
        claimed = (
            db.query(ServiceRequestModel)
            .filter(
                ServiceRequestModel.id == request_id,
                or_(
                    ServiceRequestModel.assignedEmployeeId.is_(None),
                    ServiceRequestModel.assignedEmployeeId == "",
                    ServiceRequestModel.assignedEmployeeId == staff.id,
                ),
                ServiceRequestModel.status.in_(("Submitted", "Accepted")),
            )
            .update({ServiceRequestModel.assignedEmployeeId: emp.id}, synchronize_session=False)
        )
        if not claimed:
            db.rollback()
            raise HTTPException(status_code=409, detail=f"{request_id} was just accepted by another staff member.")

    previous_id = req.assignedEmployeeId
    req.assignedEmployeeId = emp.id
    req.assignedEmployeeName = emp.name
    if req.status == "Submitted" or req.status == "Accepted":
        req.status = "Employee Assigned"

    formatted_time = get_current_formatted_time()
    timeline_event = {
        "status": "Employee Assigned",
        "label": f"Accepted by {emp.name}" if self_accept else f"Assigned to {emp.name} ({emp.role})",
        "timestamp": formatted_time,
        "actor": staff.label,
        "notes": f"{emp.name} is handling this request."
    }

    current_timeline = list(req.timeline or [])
    current_timeline.append(timeline_event)
    req.timeline = current_timeline

    # Keep the active-job counters right when a job moves between staff.
    if previous_id != emp.id:
        if previous_id:
            prev = db.query(EmployeeModel).filter(EmployeeModel.id == previous_id).first()
            if prev and (prev.activeJobsCount or 0) > 0:
                prev.activeJobsCount -= 1
        emp.activeJobsCount = (emp.activeJobsCount or 0) + 1

    db.commit()
    db.refresh(req)

    log_audit(
        db=db,
        user=staff.label,
        role=staff.role,
        action=f"{'Accepted' if self_accept else 'Assigned ' + emp.name + ' to'} {request_id}",
        request_id=request_id,
        details=f"Employee ID: {emp.id}"
    )

    create_notification(
        db=db,
        type_="status_update",
        title=f"New Task Assigned: {request_id}",
        message=f"{emp.name} has been assigned to {req.serviceType} request {request_id} ({req.batBrand} {req.batModel}).",
        request_id=request_id,
        target_roles=["EMPLOYEE", "ADMIN"]
    )

    return req


@router.post("/{request_id}/pickup-condition", response_model=ServiceRequestSchema)
def record_pickup_condition(
    request_id: str,
    payload: RecordPickupConditionRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    staff: CurrentUser = Depends(require_staff)
):
    req = _load_for_staff(db, request_id, staff)
    if not staff.is_admin:
        _require_status(req, _PICKUP_STATUSES, "record the pickup")

    formatted_time = get_current_formatted_time()
    # Employees record their own pickups; an admin may record one on behalf of the assignee.
    collector = staff.label if not staff.is_admin else (payload.collectedBy or req.assignedEmployeeName or staff.label)

    pickup_cond = {
        "condition": payload.condition,
        "notes": payload.notes,
        "photos": _store_photos(db, http_request, payload.photos, staff.label),
        "collectedAt": datetime.utcnow().isoformat() + "Z",
        "collectedBy": collector
    }

    req.pickupCondition = pickup_cond
    req.status = "Bat Picked Up"

    current_timeline = list(req.timeline or [])
    current_timeline.append({
        "status": "Bat Picked Up",
        "label": f"Racket picked up — condition: {payload.condition.lower()}",
        "timestamp": formatted_time,
        "actor": collector,
        "notes": payload.notes or f"Condition at handover: {payload.condition}"
    })
    req.timeline = current_timeline

    db.commit()
    db.refresh(req)

    log_audit(
        db=db,
        user=staff.label,
        role=staff.role,
        action=f"Recorded pickup condition: {payload.condition}",
        request_id=request_id,
        details=payload.notes
    )

    racket = " ".join(p for p in (req.batBrand, req.batModel) if p) or "racket"
    next_step = (
        "We'll inspect it and send you a repair estimate to approve before any work starts."
        if req.serviceType == "REPAIR"
        else "We'll string it and let you know when it's on the way back."
    )
    create_notification(
        db=db,
        type_="status_update",
        title=f"Racket picked up: {request_id}",
        message=f"{collector} collected your {racket}. {next_step}",
        request_id=request_id,
        target_roles=["ADMIN", "CUSTOMER"],
    )

    return req


@router.post("/{request_id}/estimate", response_model=ServiceRequestSchema)
def create_repair_estimate(
    request_id: str,
    estimate: RepairEstimateSchema,
    db: Session = Depends(get_db),
    staff: CurrentUser = Depends(require_staff)
):
    req = _load_for_staff(db, request_id, staff)
    if req.serviceType != "REPAIR":
        raise HTTPException(status_code=422, detail="Estimates are only for repair requests")
    if not staff.is_admin:
        _require_status(req, _ESTIMATE_STATUSES, "send an estimate")

    parts = (estimate.labourCharge, estimate.materialsCharge, estimate.additionalCharges, estimate.discount)
    if any(v is None or v < 0 for v in parts):
        raise HTTPException(status_code=422, detail="Charges can't be negative")
    if any(v > MAX_AMOUNT for v in parts):
        raise HTTPException(status_code=422, detail="Charges look too large")
    # The total is always the sum of the lines (never trust a total sent by the client).
    total = round(max(0.0, estimate.labourCharge + estimate.materialsCharge + estimate.additionalCharges - estimate.discount), 2)
    if total <= 0:
        raise HTTPException(status_code=422, detail="Enter the repair charges before sending the estimate")
    estimate.totalEstimate = total
    estimate.pickupDeliveryCharge = float(req.pickupDeliveryCharge or 0.0)
    estimate.isRevised = False
    estimate.originalEstimate = None
    estimate.revisionReason = None

    req.repairEstimate = estimate.dict()
    req.serviceCharge = estimate.totalEstimate
    req.totalAmount = estimate.totalEstimate + (req.pickupDeliveryCharge or 0.0)
    req.status = "Awaiting Customer Approval"

    formatted_time = get_current_formatted_time()
    current_timeline = list(req.timeline or [])
    current_timeline.append({
        "status": "Awaiting Customer Approval",
        "label": f"Repair estimate of ₹{estimate.totalEstimate:,.0f} sent for approval",
        "timestamp": formatted_time,
        "actor": staff.label,
        "notes": f"Inspection: {estimate.inspectionNotes}"
    })
    req.timeline = current_timeline

    db.commit()
    db.refresh(req)


    create_notification(
        db=db,
        type_="estimate_ready",
        title=f"Repair Estimate Ready: {request_id}",
        message=f"Estimate of ₹{estimate.totalEstimate:,.0f} generated for {req.customerName}. Customer approval requested.",
        request_id=request_id,
        target_roles=["ADMIN", "CUSTOMER"]
    )

    return req


@router.post("/{request_id}/estimate/approve", response_model=ServiceRequestSchema)
def approve_repair_estimate(request_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    _require_customer(user, "approve")
    req = _load_request(db, request_id, user)
    if req.status not in ("Awaiting Customer Approval", "Repair Estimate"):
        raise HTTPException(status_code=409, detail="There is no estimate waiting for approval on this request")

    req.status = "Repair Approved"
    formatted_time = get_current_formatted_time()

    current_timeline = list(req.timeline or [])
    current_timeline.append({
        "status": "Repair Approved",
        "label": f"Customer approved the estimate of ₹{float(req.repairEstimate.get('totalEstimate', req.serviceCharge) or 0):,.0f}",
        "timestamp": formatted_time,
        "actor": f"Customer ({req.customerName})",
        "notes": "Work order authorized to proceed with composite rebuilding."
    })
    req.timeline = current_timeline

    db.commit()
    db.refresh(req)

    create_notification(
        db=db,
        type_="status_update",
        title=f"Repair Approved: {request_id}",
        message=f"{req.customerName} approved estimate ₹{req.totalAmount}. Technicians can proceed.",
        request_id=request_id,
        target_roles=["EMPLOYEE", "ADMIN"]
    )

    return req


@router.post("/{request_id}/estimate/decline", response_model=ServiceRequestSchema)
def decline_repair_estimate(request_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    _require_customer(user, "decline")
    req = _load_request(db, request_id, user)
    if req.status not in ("Awaiting Customer Approval", "Repair Estimate"):
        raise HTTPException(status_code=409, detail="There is no estimate waiting for approval on this request")

    req.status = "Repair Declined"
    formatted_time = get_current_formatted_time()

    # Returned unrepaired: the customer pays the pickup & delivery charge plus the shop's
    # declined-repair fee (fixed now, so a later change to the setting doesn't affect it).
    try:
        fee = max(0.0, float(get_shop_settings(db).get("declinedRepairFee") or 0))
    except (TypeError, ValueError):
        fee = 0.0
    pickup_charge = float(req.pickupDeliveryCharge or 0.0)
    req.repairEstimate = {**(req.repairEstimate or {}), "declinedRepairFee": fee}
    req.serviceCharge = fee
    req.totalAmount = fee + pickup_charge
    notes = "Customer opted out of repair. Racquet will be returned without repair."
    if fee > 0:
        notes += f" Declined-repair fee ₹{fee:g} + pickup & delivery ₹{pickup_charge:g} = ₹{fee + pickup_charge:g} to pay on return."

    current_timeline = list(req.timeline or [])
    current_timeline.append({
        "status": "Repair Declined",
        "label": "Customer declined the repair estimate",
        "timestamp": formatted_time,
        "actor": f"Customer ({req.customerName})",
        "notes": notes,
    })
    req.timeline = current_timeline

    db.commit()
    db.refresh(req)

    create_notification(
        db=db,
        type_="status_update",
        title=f"Repair Declined: {request_id}",
        message=f"{req.customerName} declined estimate for {request_id}. Scheduled for return.",
        request_id=request_id,
        target_roles=["ADMIN", "EMPLOYEE"]
    )

    return req


@router.post("/{request_id}/distance", response_model=ServiceRequestSchema)
def correct_distance(
    request_id: str,
    payload: DistanceCorrectionRequest,
    db: Session = Depends(get_db),
    staff: CurrentUser = Depends(require_staff),
):
    """The assigned employee (or an admin) corrects the pickup distance — e.g. the customer
    typed a wrong number — before the customer pays. The delivery charge is recalculated."""
    req = _load_for_staff(db, request_id, staff)
    if req.paymentStatus == "Paid":
        raise HTTPException(status_code=409, detail=f"Payment for {request_id} has already been recorded — the distance can't be changed now")
    if req.status in ("Cancelled", "Completed", "Completed Without Repair"):
        raise HTTPException(status_code=409, detail=f"{request_id} is '{req.status}' — the distance can't be changed now")
    reason = payload.reason.strip()
    if len(reason) < 3:
        raise HTTPException(status_code=422, detail="Say why the distance is being corrected")

    new_km = round(float(payload.distanceKm), 1)
    old_km = float(req.distanceKm or (req.pickupAddress or {}).get("distanceKm") or 0.0)
    if abs(new_km - old_km) < 0.05:
        raise HTTPException(status_code=422, detail=f"The distance is already {old_km:g} km")
    old_charge = float(req.pickupDeliveryCharge or 0.0)
    calc = calculate_delivery_charge(new_km, _distance_config(db))
    new_charge = float(calc["charge"])

    req.distanceKm = new_km
    req.pickupAddress = {**(req.pickupAddress or {}), "distanceKm": new_km, "distanceSource": "staff"}
    req.pickupDeliveryCharge = new_charge
    req.isFreeDelivery = bool(calc["isFree"])
    req.totalAmount = float(req.serviceCharge or 0.0) + new_charge
    if req.repairEstimate:
        req.repairEstimate = {**req.repairEstimate, "pickupDeliveryCharge": new_charge}

    charge_text = f"₹{new_charge:g}" if new_charge > 0 else "free"
    current_timeline = list(req.timeline or [])
    current_timeline.append({
        "status": req.status,
        "label": f"Distance corrected from {_km(old_km)} km to {_km(new_km)} km — {reason}",
        "timestamp": get_current_formatted_time(),
        "actor": staff.label,
        "notes": f"Pickup & delivery: {charge_text}" + (f" (was ₹{old_charge:g})" if new_charge != old_charge else " (unchanged)"),
    })
    req.timeline = current_timeline

    db.commit()
    db.refresh(req)

    log_audit(
        db=db,
        user=staff.label,
        role=staff.role,
        action=f"Corrected distance {_km(old_km)} → {_km(new_km)} KM",
        request_id=request_id,
        details=f"{reason} | Pickup & delivery ₹{old_charge:g} → ₹{new_charge:g}",
    )

    if new_charge != old_charge:
        create_notification(
            db=db,
            type_="status_update",
            title=f"Delivery charge updated: {request_id}",
            message=(
                f"Pickup & delivery charge updated to ₹{new_charge:g} — the distance to your address is "
                f"{_km(new_km)} KM ({reason}). Amount to pay: ₹{_amount_due(req):g}."
            ),
            request_id=request_id,
            target_roles=["ADMIN", "CUSTOMER"],
        )

    return req


@router.post("/{request_id}/estimate/revise", response_model=ServiceRequestSchema)
def request_price_revision(
    request_id: str,
    payload: PriceRevisionRequest,
    db: Session = Depends(get_db),
    staff: CurrentUser = Depends(require_staff)
):
    req = _load_for_staff(db, request_id, staff)

    old_estimate = dict(req.repairEstimate or {})
    if not old_estimate:
        raise HTTPException(status_code=409, detail="Send an estimate before revising it")
    if not staff.is_admin:
        # Revisions are for extra damage found while doing the approved work.
        _require_status(req, _REVISE_STATUSES, "revise the estimate")
    if payload.additionalAmount <= 0:
        raise HTTPException(status_code=422, detail="The additional amount must be more than ₹0")
    if not (payload.reason or "").strip():
        raise HTTPException(status_code=422, detail="Tell the customer why the price has changed")
    old_total = float(old_estimate.get("totalEstimate") or 0.0)
    new_total = round(old_total + payload.additionalAmount, 2)

    # Save previous estimate
    req.previousEstimate = old_estimate

    # Update current estimate
    new_estimate = {
        **old_estimate,
        "isRevised": True,
        "originalEstimate": old_total,
        "revisionReason": payload.reason,
        "totalEstimate": new_total,
        "additionalCharges": float(old_estimate.get("additionalCharges") or 0.0) + payload.additionalAmount,
    }

    req.repairEstimate = new_estimate
    req.serviceCharge = new_total
    req.totalAmount = new_total + (req.pickupDeliveryCharge or 0.0)
    req.status = "Awaiting Customer Approval"

    formatted_time = get_current_formatted_time()
    current_timeline = list(req.timeline or [])
    current_timeline.append({
        "status": "Awaiting Customer Approval",
        "label": f"Revised estimate of ₹{new_total:,.0f} sent for approval",
        "timestamp": formatted_time,
        "actor": staff.label,
        "notes": f"Reason: {payload.reason} (+₹{payload.additionalAmount:,.0f})"
    })
    req.timeline = current_timeline

    db.commit()
    db.refresh(req)


    create_notification(
        db=db,
        type_="estimate_ready",
        title=f"Revised Estimate: {request_id}",
        message=f"Estimate updated from ₹{old_total:,.0f} to ₹{new_total:,.0f}. Sent to customer for approval.",
        request_id=request_id,
        target_roles=["ADMIN", "CUSTOMER"]
    )

    return req


@router.post("/{request_id}/payment", response_model=ServiceRequestSchema)
def record_payment(
    request_id: str,
    payload: RecordPaymentRequest,
    db: Session = Depends(get_db),
    staff: CurrentUser = Depends(require_staff)
):
    req = _load_for_staff(db, request_id, staff)
    if req.paymentStatus == "Paid":
        raise HTTPException(status_code=409, detail=f"Payment for {request_id} has already been recorded")
    if req.status == "Cancelled":
        raise HTTPException(status_code=409, detail=f"{request_id} was cancelled — there is nothing to collect")
    if payload.amount is None or payload.amount <= 0:
        raise HTTPException(status_code=422, detail="Enter the amount received (more than ₹0)")
    if not staff.is_admin:
        _require_status(req, _PAYMENT_STATUSES, "record the payment")
    due = round(_amount_due(req), 2)
    if abs(float(payload.amount) - due) > 1:  # ₹1 tolerance for rounding
        if not staff.is_admin:
            raise HTTPException(
                status_code=422,
                detail=f"The amount due is ₹{due:,.0f}. Record exactly that amount, or ask the admin to record a different amount.",
            )
        if not (payload.notes or "").strip():
            raise HTTPException(
                status_code=422,
                detail=f"The amount due is ₹{due:,.0f}. Add a note explaining the different amount (e.g. discount).",
            )

    # Employees record what they collected themselves; the admin may record it for someone else.
    collector = staff.label if not staff.is_admin else (payload.collectedBy or staff.label)
    declined = _was_declined(req)
    final_status = "Completed Without Repair" if declined else "Completed"
    now_iso = datetime.utcnow().isoformat() + "Z"
    formatted_time = get_current_formatted_time()
    amount_text = f"₹{payload.amount:,.0f}" if float(payload.amount).is_integer() else f"₹{payload.amount:,.2f}"

    req.paymentRecord = {
        "amount": payload.amount,
        "method": payload.method,
        "collectedAt": now_iso,
        "collectedBy": collector,
        "transactionNotes": payload.notes or f"Paid via {payload.method}"
    }
    # Two phones recording the same payment: only one conditional UPDATE can succeed.
    claimed = (
        db.query(ServiceRequestModel)
        .filter(ServiceRequestModel.id == req.id, ServiceRequestModel.paymentStatus != "Paid")
        .update({ServiceRequestModel.paymentStatus: "Paid"}, synchronize_session=False)
    )
    if not claimed:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"Payment for {request_id} has already been recorded")
    req.paymentStatus = "Paid"
    req.status = final_status

    current_timeline = list(req.timeline or [])
    current_timeline.append({
        "status": "Payment Collected",
        "label": f"{amount_text} received by {payload.method}",
        "timestamp": formatted_time,
        "actor": collector,
        "notes": payload.notes or f"Payment received at doorstep ({payload.method})"
    })
    current_timeline.append({
        "status": final_status,
        "label": "Returned without repair" if declined else "Completed",
        "timestamp": formatted_time,
        "actor": collector,
        "notes": "Returned to the customer and settled." if declined else "Delivered and settled."
    })
    req.timeline = current_timeline

    # Decrement employee active jobs count if assigned
    if req.assignedEmployeeId:
        emp = db.query(EmployeeModel).filter(EmployeeModel.id == req.assignedEmployeeId).first()
        if emp and (emp.activeJobsCount or 0) > 0:
            emp.activeJobsCount -= 1

    db.commit()
    db.refresh(req)

    log_audit(
        db=db,
        user=staff.label,
        role=staff.role,
        action=f"Recorded {amount_text} payment ({payload.method})",
        request_id=request_id,
        details=f"Collected by {collector}. Status changed to {final_status}"
    )

    create_notification(
        db=db,
        type_="payment",
        title=f"Payment Collected: {request_id}",
        message=f"{amount_text} collected by {collector} via {payload.method}. Request is now {final_status}.",
        request_id=request_id,
        target_roles=["ADMIN", "EMPLOYEE"]
    )

    return req


@router.post("/{request_id}/review", response_model=ServiceRequestSchema)
def submit_review(
    request_id: str,
    payload: ReviewSchema,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    req = _load_request(db, request_id, user)
    if user.is_staff:
        raise HTTPException(status_code=403, detail="Only the customer can review their service")
    if req.status not in _REVIEWABLE_STATUSES:
        raise HTTPException(status_code=409, detail="You can review this service once it has been completed")

    review_data = {
        "rating": payload.rating,
        "comment": payload.comment,
        "createdAt": datetime.utcnow().isoformat() + "Z"
    }

    req.review = review_data
    site_review = db.query(ReviewModel).filter(ReviewModel.requestId == req.id).first()
    if not site_review:
        site_review = ReviewModel(id=new_id("REV"), requestId=req.id, createdAt=now_iso())
        db.add(site_review)
    site_review.authorName = req.customerName
    site_review.authorPhone = req.customerMobile
    site_review.rating = payload.rating
    site_review.comment = payload.comment
    site_review.serviceType = "Stringing" if req.serviceType == "GETTING" else "Repair"
    site_review.location = (req.pickupAddress or {}).get("area") or (req.pickupAddress or {}).get("city")
    site_review.status = "pending"
    site_review.isFeatured = False
    site_review.isVerified = True
    db.commit()
    db.refresh(req)

    log_audit(
        db=db,
        user=req.customerName,
        role="CUSTOMER",
        action=f"Submitted {payload.rating}★ Review",
        request_id=request_id,
        details=payload.comment
    )

    create_notification(
        db=db,
        type_="system",
        title="New Customer Review",
        message=f"{req.customerName} gave {payload.rating}★ for {request_id}: \"{payload.comment[:60]}...\"",
        request_id=request_id,
        target_roles=["ADMIN", "EMPLOYEE"]
    )

    return req
