import random
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    ServiceRequestModel,
    DistanceConfigModel,
    EmployeeModel,
    GettingServiceTierModel
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
)
from app.services.pricing_service import calculate_delivery_charge
from app.services.notification_service import (
    create_notification,
    log_audit,
    get_current_formatted_time,
    render_and_simulate_email
)

router = APIRouter(prefix="/requests", tags=["Service Requests"])

@router.get("", response_model=List[ServiceRequestSchema])
def get_requests(
    status: Optional[str] = Query(None),
    serviceType: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    customerId: Optional[str] = Query(None),
    employeeId: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(ServiceRequestModel)

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
    return query.order_by(ServiceRequestModel.createdAt.desc()).all()


@router.get("/{request_id}", response_model=ServiceRequestSchema)
def get_request_by_id(request_id: str, db: Session = Depends(get_db)):
    req = db.query(ServiceRequestModel).filter(ServiceRequestModel.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail=f"Request {request_id} not found")
    return req


@router.post("", response_model=ServiceRequestSchema, status_code=status.HTTP_201_CREATED)
def create_request(payload: RequestCreate, db: Session = Depends(get_db)):
    is_getting = payload.serviceType == "GETTING"
    prefix = "GET" if is_getting else "REP"
    req_id = f"{prefix}-{random.randint(10000, 99999)}"

    # Get distance configuration
    dist_config = db.query(DistanceConfigModel).first()
    if not dist_config:
        # Fallback config
        dist_config = DistanceConfigModel(
            freeRadiusKm=10.0,
            perKmRateBeyondFree=15.0,
            pricingMethod="PER_KM"
        )

    calc = calculate_delivery_charge(payload.distanceKm, dist_config)
    delivery_charge = calc["charge"]
    is_free = calc["isFree"]

    # Calculate service charge
    if is_getting:
        service_charge = payload.gettingPrice or payload.serviceCharge or 400.0
    else:
        service_charge = payload.serviceCharge or 0.0

    total_amount = service_charge + delivery_charge

    now_iso = datetime.utcnow().isoformat() + "Z"
    formatted_time = get_current_formatted_time()

    timeline = [
        {
            "status": "Submitted",
            "label": "Request Submitted Online",
            "timestamp": formatted_time,
            "actor": f"Customer ({payload.customerName})",
            "notes": "Booking received. Free pickup applied." if is_free else f"Booking received. Delivery surcharge ₹{delivery_charge}."
        }
    ]

    new_request = ServiceRequestModel(
        id=req_id,
        serviceType=payload.serviceType,
        customerName=payload.customerName,
        customerEmail=payload.customerEmail,
        customerMobile=payload.customerMobile,
        createdAt=now_iso,
        status="Submitted",
        batBrand=payload.batBrand,
        batModel=payload.batModel,
        batType=payload.batType,
        batPhotos=payload.batPhotos or ["https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=600&q=80"],
        gettingType=payload.gettingType,
        stringPreference=payload.stringPreference,
        stringType=payload.stringType,
        stringTensionLbs=payload.stringTensionLbs,
        gettingPrice=payload.gettingPrice,
        colour=payload.colour,
        repairIssue=payload.repairIssue,
        repairDescription=payload.repairDescription,
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
        user=payload.customerName,
        role="CUSTOMER",
        action=f"Created {payload.serviceType} Request",
        request_id=req_id,
        details=f"{payload.batBrand} {payload.batModel} | Total: ₹{total_amount}"
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

    # 3. Simulate email to Employee & Admin as per user requirement
    # Send email to Admin
    render_and_simulate_email(
        db=db,
        template_id="TPL-02",
        recipient_email="admin@grsports.com",
        variables={
            "customer_name": payload.customerName,
            "request_id": req_id,
            "service_type": payload.serviceType,
            "bat_brand": payload.batBrand,
            "bat_model": payload.batModel,
            "pickup_address": f"{payload.pickupAddress.houseFlat}, {payload.pickupAddress.street}, {payload.pickupAddress.area}",
            "distance_km": payload.distanceKm,
            "pickup_charge_status": "Free Pickup (< 10 KM)" if is_free else f"₹{delivery_charge} delivery fee"
        }
    )

    # Send email to Employee / Operations Hub
    render_and_simulate_email(
        db=db,
        template_id="TPL-02",
        recipient_email="operations@grsports.in",
        variables={
            "customer_name": payload.customerName,
            "request_id": req_id,
            "service_type": payload.serviceType,
            "bat_brand": payload.batBrand,
            "bat_model": payload.batModel,
            "pickup_address": f"{payload.pickupAddress.houseFlat}, {payload.pickupAddress.street}, {payload.pickupAddress.area}",
            "distance_km": payload.distanceKm,
            "pickup_charge_status": "Free (< 10 KM)" if is_free else f"₹{delivery_charge} surcharge"
        }
    )

    return new_request


@router.patch("/{request_id}/status", response_model=ServiceRequestSchema)
def update_status(request_id: str, payload: RequestStatusUpdate, db: Session = Depends(get_db)):
    req = db.query(ServiceRequestModel).filter(ServiceRequestModel.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    req.status = payload.status
    formatted_time = get_current_formatted_time()

    timeline_event = {
        "status": payload.status,
        "label": f"Status updated to {payload.status}",
        "timestamp": formatted_time,
        "actor": payload.actor,
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
        user=payload.actor,
        role="EMPLOYEE" if "Emp" in payload.actor or "Tech" in payload.actor else "ADMIN",
        action=f"Updated status to {payload.status}",
        request_id=request_id,
        details=payload.notes
    )

    create_notification(
        db=db,
        type_="status_update",
        title=f"Request {request_id} Updated",
        message=f"Status changed to '{payload.status}' by {payload.actor}.",
        request_id=request_id,
        target_roles=["ADMIN", "EMPLOYEE", "CUSTOMER"]
    )

    # Trigger email if out for delivery or completed
    if payload.status == "Out for Delivery":
        render_and_simulate_email(
            db=db,
            template_id="TPL-05",
            recipient_email=req.customerEmail,
            variables={
                "customer_name": req.customerName,
                "request_id": req.id,
                "bat_brand": req.batBrand,
                "bat_model": req.batModel,
                "employee_name": req.assignedEmployeeName or "Our Field Agent",
                "employee_phone": "+91 98765 43210",
                "total_amount": req.totalAmount
            }
        )

    return req


@router.post("/{request_id}/assign", response_model=ServiceRequestSchema)
def assign_technician(request_id: str, payload: AssignEmployeeRequest, db: Session = Depends(get_db)):
    req = db.query(ServiceRequestModel).filter(ServiceRequestModel.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    emp = db.query(EmployeeModel).filter(EmployeeModel.id == payload.employeeId).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    req.assignedEmployeeId = emp.id
    req.assignedEmployeeName = emp.name
    if req.status == "Submitted" or req.status == "Accepted":
        req.status = "Employee Assigned"

    formatted_time = get_current_formatted_time()
    timeline_event = {
        "status": "Employee Assigned",
        "label": f"Assigned to {emp.name} ({emp.role})",
        "timestamp": formatted_time,
        "actor": "Admin",
        "notes": f"Field executive {emp.name} assigned to handle request."
    }

    current_timeline = list(req.timeline or [])
    current_timeline.append(timeline_event)
    req.timeline = current_timeline

    # Increment active jobs count
    emp.activeJobsCount = (emp.activeJobsCount or 0) + 1

    db.commit()
    db.refresh(req)

    log_audit(
        db=db,
        user="Admin",
        role="ADMIN",
        action=f"Assigned {emp.name} to {request_id}",
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
    db: Session = Depends(get_db)
):
    req = db.query(ServiceRequestModel).filter(ServiceRequestModel.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    formatted_time = get_current_formatted_time()
    collector = payload.collectedBy or req.assignedEmployeeName or "Field Agent"

    pickup_cond = {
        "condition": payload.condition,
        "notes": payload.notes,
        "photos": payload.photos,
        "collectedAt": datetime.utcnow().isoformat() + "Z",
        "collectedBy": collector
    }

    req.pickupCondition = pickup_cond
    req.status = "Bat Picked Up"

    current_timeline = list(req.timeline or [])
    current_timeline.append({
        "status": "Bat Picked Up",
        "label": f"Bat Picked Up & Doorstep Inspected ({payload.condition})",
        "timestamp": formatted_time,
        "actor": collector,
        "notes": payload.notes or f"Condition at handover: {payload.condition}"
    })
    req.timeline = current_timeline

    db.commit()
    db.refresh(req)

    log_audit(
        db=db,
        user=collector,
        role="EMPLOYEE",
        action=f"Recorded pickup condition: {payload.condition}",
        request_id=request_id,
        details=payload.notes
    )

    return req


@router.post("/{request_id}/estimate", response_model=ServiceRequestSchema)
def create_repair_estimate(
    request_id: str,
    estimate: RepairEstimateSchema,
    db: Session = Depends(get_db)
):
    req = db.query(ServiceRequestModel).filter(ServiceRequestModel.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    req.repairEstimate = estimate.dict()
    req.serviceCharge = estimate.totalEstimate
    req.totalAmount = estimate.totalEstimate + (req.pickupDeliveryCharge or 0.0)
    req.status = "Awaiting Customer Approval"

    formatted_time = get_current_formatted_time()
    current_timeline = list(req.timeline or [])
    current_timeline.append({
        "status": "Awaiting Customer Approval",
        "label": f"Repair Estimate ₹{estimate.totalEstimate} Created",
        "timestamp": formatted_time,
        "actor": req.assignedEmployeeName or "Workshop Technician",
        "notes": f"Inspection: {estimate.inspectionNotes}"
    })
    req.timeline = current_timeline

    db.commit()
    db.refresh(req)

    # Notify customer & simulate estimate email
    render_and_simulate_email(
        db=db,
        template_id="TPL-03",
        recipient_email=req.customerEmail,
        variables={
            "customer_name": req.customerName,
            "request_id": req.id,
            "bat_brand": req.batBrand,
            "bat_model": req.batModel,
            "inspection_findings": estimate.inspectionNotes or "Detailed composite inspection completed.",
            "labour_charge": estimate.labourCharge,
            "materials_charge": estimate.materialsCharge,
            "total_amount": estimate.totalEstimate,
            "action_link": f"http://localhost:3000/requests/{req.id}"
        }
    )

    create_notification(
        db=db,
        type_="estimate_ready",
        title=f"Repair Estimate Ready: {request_id}",
        message=f"Estimate of ₹{estimate.totalEstimate} generated for {req.customerName}. Customer approval requested.",
        request_id=request_id,
        target_roles=["ADMIN", "CUSTOMER"]
    )

    return req


@router.post("/{request_id}/estimate/approve", response_model=ServiceRequestSchema)
def approve_repair_estimate(request_id: str, db: Session = Depends(get_db)):
    req = db.query(ServiceRequestModel).filter(ServiceRequestModel.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    req.status = "Repair Approved"
    formatted_time = get_current_formatted_time()

    current_timeline = list(req.timeline or [])
    current_timeline.append({
        "status": "Repair Approved",
        "label": f"Estimate ₹{req.repairEstimate.get('totalEstimate', req.serviceCharge)} Approved by Customer",
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
def decline_repair_estimate(request_id: str, db: Session = Depends(get_db)):
    req = db.query(ServiceRequestModel).filter(ServiceRequestModel.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    req.status = "Repair Declined"
    formatted_time = get_current_formatted_time()

    current_timeline = list(req.timeline or [])
    current_timeline.append({
        "status": "Repair Declined",
        "label": "Repair Estimate Declined by Customer",
        "timestamp": formatted_time,
        "actor": f"Customer ({req.customerName})",
        "notes": "Customer opted out of repair. Racquet will be returned without repair."
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


@router.post("/{request_id}/estimate/revise", response_model=ServiceRequestSchema)
def request_price_revision(
    request_id: str,
    payload: PriceRevisionRequest,
    db: Session = Depends(get_db)
):
    req = db.query(ServiceRequestModel).filter(ServiceRequestModel.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    old_estimate = dict(req.repairEstimate or {})
    old_total = old_estimate.get("totalEstimate", 400.0)

    # Save previous estimate
    req.previousEstimate = old_estimate

    # Update current estimate
    new_estimate = {
        **old_estimate,
        "isRevised": True,
        "originalEstimate": old_total,
        "revisionReason": payload.reason,
        "totalEstimate": payload.newTotal,
        "labourCharge": old_estimate.get("labourCharge", 300.0) + (payload.additionalAmount * 0.6),
        "materialsCharge": old_estimate.get("materialsCharge", 100.0) + (payload.additionalAmount * 0.4),
    }

    req.repairEstimate = new_estimate
    req.serviceCharge = payload.newTotal
    req.totalAmount = payload.newTotal + (req.pickupDeliveryCharge or 0.0)
    req.status = "Awaiting Customer Approval"

    formatted_time = get_current_formatted_time()
    current_timeline = list(req.timeline or [])
    current_timeline.append({
        "status": "Awaiting Customer Approval",
        "label": f"Revised Estimate ₹{payload.newTotal} (Requires Approval)",
        "timestamp": formatted_time,
        "actor": req.assignedEmployeeName or "Workshop Technician",
        "notes": f"Reason: {payload.reason} (+₹{payload.additionalAmount})"
    })
    req.timeline = current_timeline

    db.commit()
    db.refresh(req)

    # Notify customer with updated estimate template
    render_and_simulate_email(
        db=db,
        template_id="TPL-04",
        recipient_email=req.customerEmail,
        variables={
            "customer_name": req.customerName,
            "request_id": req.id,
            "bat_brand": req.batBrand,
            "bat_model": req.batModel,
            "revision_reason": payload.reason,
            "original_estimate": old_total,
            "additional_charges": payload.additionalAmount,
            "new_total": payload.newTotal,
            "action_link": f"http://localhost:3000/requests/{req.id}"
        }
    )

    create_notification(
        db=db,
        type_="estimate_ready",
        title=f"Revised Estimate: {request_id}",
        message=f"Estimate updated from ₹{old_total} to ₹{payload.newTotal}. Sent to customer for approval.",
        request_id=request_id,
        target_roles=["ADMIN", "CUSTOMER"]
    )

    return req


@router.post("/{request_id}/payment", response_model=ServiceRequestSchema)
def record_payment(
    request_id: str,
    payload: RecordPaymentRequest,
    db: Session = Depends(get_db)
):
    req = db.query(ServiceRequestModel).filter(ServiceRequestModel.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    collector = payload.collectedBy or req.assignedEmployeeName or "Delivery Executive"
    now_iso = datetime.utcnow().isoformat() + "Z"
    formatted_time = get_current_formatted_time()

    req.paymentRecord = {
        "amount": payload.amount,
        "method": payload.method,
        "collectedAt": now_iso,
        "collectedBy": collector,
        "transactionNotes": payload.notes or f"Paid via {payload.method}"
    }
    req.paymentStatus = "Paid"
    req.status = "Completed"

    current_timeline = list(req.timeline or [])
    current_timeline.append({
        "status": "Payment Collected",
        "label": f"₹{payload.amount} Collected via {payload.method}",
        "timestamp": formatted_time,
        "actor": collector,
        "notes": payload.notes or f"Payment received at doorstep ({payload.method})"
    })
    current_timeline.append({
        "status": "Completed",
        "label": "Service Order Completed",
        "timestamp": formatted_time,
        "actor": collector,
        "notes": "Delivered and settled. Ready for play!"
    })
    req.timeline = current_timeline

    # Decrement employee active jobs count if assigned
    if req.assignedEmployeeId:
        emp = db.query(EmployeeModel).filter(EmployeeModel.id == req.assignedEmployeeId).first()
        if emp and emp.activeJobsCount > 0:
            emp.activeJobsCount -= 1

    db.commit()
    db.refresh(req)

    # Simulate payment receipt email
    render_and_simulate_email(
        db=db,
        template_id="TPL-06",
        recipient_email=req.customerEmail,
        variables={
            "customer_name": req.customerName,
            "request_id": req.id,
            "amount_paid": payload.amount,
            "collected_by": collector,
            "payment_method": payload.method
        }
    )

    log_audit(
        db=db,
        user=collector,
        role="EMPLOYEE",
        action=f"Recorded ₹{payload.amount} payment ({payload.method})",
        request_id=request_id,
        details=f"Status changed to Completed"
    )

    create_notification(
        db=db,
        type_="payment",
        title=f"Payment Collected: {request_id}",
        message=f"₹{payload.amount} collected by {collector} via {payload.method}. Request is now Completed.",
        request_id=request_id,
        target_roles=["ADMIN", "EMPLOYEE"]
    )

    return req


@router.post("/{request_id}/review", response_model=ServiceRequestSchema)
def submit_review(
    request_id: str,
    payload: ReviewSchema,
    db: Session = Depends(get_db)
):
    req = db.query(ServiceRequestModel).filter(ServiceRequestModel.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    review_data = {
        "rating": payload.rating,
        "comment": payload.comment,
        "createdAt": datetime.utcnow().isoformat() + "Z"
    }

    req.review = review_data
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
