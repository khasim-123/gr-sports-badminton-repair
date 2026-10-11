import urllib.parse
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import EmployeeModel, ServiceRequestModel
from app.schemas import EmployeeSchema, EmployeeCreate
from app.services.notification_service import create_notification, log_audit

router = APIRouter(prefix="/employees", tags=["Employees & Team Management"])

@router.get("", response_model=List[EmployeeSchema])
def get_employees(
    includeInactive: bool = Query(False),
    userRole: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(EmployeeModel)
    if not includeInactive:
        query = query.filter(EmployeeModel.isActive == True)
    if userRole:
        query = query.filter(EmployeeModel.userRole == userRole)
    return query.all()


@router.get("/{employee_id}", response_model=EmployeeSchema)
def get_employee_by_id(employee_id: str, db: Session = Depends(get_db)):
    emp = db.query(EmployeeModel).filter(EmployeeModel.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp


@router.post("", response_model=EmployeeSchema, status_code=status.HTTP_201_CREATED)
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db)):
    # Check if email already registered
    existing = db.query(EmployeeModel).filter(EmployeeModel.email.ilike(payload.email.strip())).first()
    if existing:
        raise HTTPException(status_code=400, detail="Employee or Admin with this email already exists")

    emp_id = f"EMP-{int(datetime.now().timestamp() * 1000) % 10000:04d}"
    avatar_url = f"https://ui-avatars.com/api/?name={urllib.parse.quote(payload.name)}&background=3b82f6&color=fff&size=200"

    new_emp = EmployeeModel(
        id=emp_id,
        name=payload.name,
        email=payload.email.lower().strip(),
        phone=payload.phone.strip(),
        role=payload.role or ("Platform Admin" if payload.userRole == "ADMIN" else "Technician"),
        userRole=payload.userRole,
        activeJobsCount=0,
        avatar=avatar_url,
        password=payload.password,
        isActive=True
    )

    db.add(new_emp)
    db.commit()
    db.refresh(new_emp)

    role_label = "Admin" if payload.userRole == "ADMIN" else "Employee"
    temp_password = payload.password.strip() if (payload.password and payload.password.strip()) else "Emp@2026"
    new_emp.password = temp_password
    db.commit()

    portal_url = "https://badminton-service-platform.onrender.com"
    email_subject = f"Welcome to GR Sports - Your {role_label} Account Credentials"
    email_body = f"""Hello {new_emp.name},

Welcome to the GR Sports Team! Your official {role_label} account has been created by the Administrator.

Here are your account credentials to access the platform:
--------------------------------------------------
Official Portal: {portal_url}
Registered Email: {new_emp.email}
Initial Password / PIN: {temp_password}
Role / Designation: {new_emp.role} ({role_label})
--------------------------------------------------

Instructions:
1. Navigate to the portal link above.
2. Sign in using your registered email and temporary password under the '{'Master Admin' if payload.userRole == 'ADMIN' else 'Operations Staff'}' tab.
3. For your security, please update your password after your first login.

Best regards,
GR Sports Operations & Management Team
"""

    from app.services.notification_service import send_email_via_smtp
    smtp_sent = send_email_via_smtp(new_emp.email, email_subject, email_body)

    log_audit(
        db=db,
        user="Admin",
        role="ADMIN",
        action=f"Created {role_label} & Dispatched Credentials Email: {payload.name}",
        request_id="SYSTEM",
        details=f"Email: {payload.email} | Phone: {payload.phone} | SMTP Delivered: {smtp_sent}"
    )

    create_notification(
        db=db,
        type_="system",
        title=f"New {role_label} Created",
        message=f"{payload.name} ({new_emp.email}) added as {payload.role}. Login credentials {'delivered via SMTP' if smtp_sent else 'simulated'} to {new_emp.email}.",
        request_id="SYSTEM",
        target_roles=["ADMIN"]
    )

    return new_emp


@router.delete("/{employee_id}")
def deactivate_employee(employee_id: str, db: Session = Depends(get_db)):
    emp = db.query(EmployeeModel).filter(EmployeeModel.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    emp.isActive = False
    db.commit()

    log_audit(
        db=db,
        user="Admin",
        role="ADMIN",
        action=f"Deactivated Employee: {emp.name}",
        request_id="SYSTEM",
        details=f"Employee ID: {employee_id}"
    )

    return {"success": True, "message": f"Employee {emp.name} has been deactivated"}


@router.get("/{employee_id}/workload")
def get_employee_workload(employee_id: str, db: Session = Depends(get_db)):
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
