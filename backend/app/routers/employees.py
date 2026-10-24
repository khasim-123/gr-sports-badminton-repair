import secrets
import urllib.parse
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import EmployeeModel, ServiceRequestModel
from pydantic import BaseModel
from app.schemas import EmployeeSchema, EmployeeCreate
from app.security import CurrentUser, hash_password, require_admin, require_staff, validate_new_password
from app.services.sms_service import require_phone
from app.services.notification_service import create_notification, log_audit


class EmployeeCreatedSchema(EmployeeSchema):
    # Only returned once, when the server generated the password itself.
    temporaryPassword: Optional[str] = None


class PasswordReset(BaseModel):
    newPassword: Optional[str] = None

router = APIRouter(prefix="/employees", tags=["Employees & Team Management"])

@router.get("", response_model=List[EmployeeSchema])
def get_employees(
    includeInactive: bool = Query(False),
    userRole: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _staff: CurrentUser = Depends(require_staff)
):
    query = db.query(EmployeeModel)
    if not includeInactive:
        query = query.filter(EmployeeModel.isActive == True)
    if userRole:
        query = query.filter(EmployeeModel.userRole == userRole)
    return query.all()


@router.get("/{employee_id}", response_model=EmployeeSchema)
def get_employee_by_id(employee_id: str, db: Session = Depends(get_db),
    _staff: CurrentUser = Depends(require_staff)):
    emp = db.query(EmployeeModel).filter(EmployeeModel.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp


@router.post("", response_model=EmployeeCreatedSchema, status_code=status.HTTP_201_CREATED)
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    phone = require_phone(payload.phone)
    if db.query(EmployeeModel).filter(EmployeeModel.phone == phone).first():
        raise HTTPException(status_code=400, detail="A staff member with this mobile number already exists")
    email = (payload.email or "").strip().lower() or None
    if email and db.query(EmployeeModel).filter(EmployeeModel.email.ilike(email)).first():
        raise HTTPException(status_code=400, detail="A staff member with this email already exists")

    emp_id = f"EMP-{uuid.uuid4().hex[:8]}"
    chosen_password = (payload.password or "").strip()
    generated_password = None
    if chosen_password:
        validate_new_password(chosen_password)
    else:
        generated_password = secrets.token_urlsafe(9)
        chosen_password = generated_password
    avatar_url = f"https://ui-avatars.com/api/?name={urllib.parse.quote(payload.name)}&background=3b82f6&color=fff&size=200"

    new_emp = EmployeeModel(
        id=emp_id,
        name=payload.name,
        email=email,
        phone=phone,
        role=payload.role or ("Platform Admin" if payload.userRole == "ADMIN" else "Technician"),
        userRole=payload.userRole,
        activeJobsCount=0,
        avatar=avatar_url,
        password=hash_password(chosen_password),
        isActive=True
    )

    db.add(new_emp)
    db.commit()
    db.refresh(new_emp)

    role_label = "Admin" if payload.userRole == "ADMIN" else "Employee"

    log_audit(
        db=db,
        user=admin.label,
        role="ADMIN",
        action=f"Created {role_label}: {payload.name}",
        request_id="SYSTEM",
        details=f"Mobile: {phone}"
    )

    create_notification(
        db=db,
        type_="system",
        title=f"New {role_label} Created",
        message=f"{payload.name} ({new_emp.phone}) added as {new_emp.role}. They sign in with their mobile number and the password you set.",
        request_id="SYSTEM",
        target_roles=["ADMIN"]
    )

    result = EmployeeCreatedSchema.model_validate(new_emp)
    result.temporaryPassword = generated_password
    return result


@router.put("/{employee_id}/password")
def reset_employee_password(
    employee_id: str,
    payload: PasswordReset,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    emp = db.query(EmployeeModel).filter(EmployeeModel.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    new_password = (payload.newPassword or "").strip()
    generated = None
    if new_password:
        validate_new_password(new_password)
    else:
        generated = new_password = secrets.token_urlsafe(9)
    emp.password = hash_password(new_password)
    db.commit()
    log_audit(db, admin.label, "ADMIN", f"Reset password for {emp.name}", "SYSTEM")
    return {"success": True, "temporaryPassword": generated}


@router.delete("/{employee_id}")
def deactivate_employee(employee_id: str, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    emp = db.query(EmployeeModel).filter(EmployeeModel.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    if emp.phone == admin.phone:
        raise HTTPException(status_code=400, detail="You can't deactivate your own account")
    emp.isActive = False
    db.commit()

    log_audit(
        db=db,
        user=admin.label,
        role="ADMIN",
        action=f"Deactivated Employee: {emp.name}",
        request_id="SYSTEM",
        details=f"Employee ID: {employee_id}"
    )

    return {"success": True, "message": f"Employee {emp.name} has been deactivated"}


@router.get("/{employee_id}/workload")
def get_employee_workload(employee_id: str, db: Session = Depends(get_db),
    _staff: CurrentUser = Depends(require_staff)):
    emp = db.query(EmployeeModel).filter(EmployeeModel.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    assigned_requests = db.query(ServiceRequestModel).filter(
        ServiceRequestModel.assignedEmployeeId == employee_id
    ).all()

    getting_done = sum(1 for r in assigned_requests if r.serviceType == "GETTING" and r.status in ["Getting Completed", "Delivered", "Completed"])
    getting_in_progress = sum(1 for r in assigned_requests if r.serviceType == "GETTING" and r.status in ["Getting in Progress", "Bat Picked Up", "Inspection", "Pickup Scheduled"])

    repair_received = sum(1 for r in assigned_requests if r.serviceType == "REPAIR")
    repair_done = sum(1 for r in assigned_requests if r.serviceType == "REPAIR" and r.status in ["Repair Completed", "Delivered", "Completed"])
    repair_in_progress = sum(1 for r in assigned_requests if r.serviceType == "REPAIR" and r.status in ["Repair in Progress", "Inspection", "Repair Approved", "Awaiting Customer Approval", "Bat Picked Up"])

    return {
        "employeeId": emp.id,
        "name": emp.name,
        "role": emp.role,
        "userRole": emp.userRole,
        "totalAssigned": len(assigned_requests),
        "gettingStats": {
            "completed": getting_done,
            "inProgress": getting_in_progress,
            "totalGetting": sum(1 for r in assigned_requests if r.serviceType == "GETTING")
        },
        "repairStats": {
            "received": repair_received,
            "completed": repair_done,
            "inProgress": repair_in_progress
        },
        "activeJobs": emp.activeJobsCount
    }
