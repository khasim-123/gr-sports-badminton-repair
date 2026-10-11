import random
import time
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import EmployeeModel, CustomerModel
from app.schemas import LoginCredentials, AuthSessionResponse, OtpRequest, CustomerCreate, CustomerResponse
from app.services.notification_service import log_audit, render_and_simulate_email

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register-customer", response_model=AuthSessionResponse)
def register_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    existing = db.query(CustomerModel).filter(CustomerModel.email.ilike(email)).first()
    if existing:
        customer = existing
        customer.name = payload.name
        customer.phone = payload.phone
        if payload.address:
            customer.address = payload.address
    else:
        cust_id = f"CUST-{int(time.time() * 1000) % 1000000:06d}"
        customer = CustomerModel(
            id=cust_id,
            name=payload.name,
            email=email,
            phone=payload.phone,
            address=payload.address or "",
            password=payload.password or "player2026",
            createdAt=time.strftime("%d %b %Y, %I:%M %p")
        )
        db.add(customer)
    db.commit()
    db.refresh(customer)

    # Log audit
    log_audit(
        db=db,
        user=customer.name,
        role="CUSTOMER",
        action="Customer Registered & Logged In",
        request_id="AUTH",
        details=f"Email: {email} | Mobile: {customer.phone}"
    )

    token = f"jwt_customer_{int(time.time())}"
    return AuthSessionResponse(
        isLoggedIn=True,
        token=token,
        role="CUSTOMER",
        email=customer.email,
        name=customer.name,
        mobile=customer.phone,
        title="Valued Customer",
        activeView="customer_portal",
        customerSubView="dashboard",
        employeeSubView="dashboard",
        adminSubView="dashboard"
    )

@router.get("/customers", response_model=list[CustomerResponse])
def get_all_customers(db: Session = Depends(get_db)):
    return db.query(CustomerModel).all()

@router.post("/login", response_model=AuthSessionResponse)
def login(credentials: LoginCredentials, db: Session = Depends(get_db)):
    role = credentials.role
    email = credentials.email.lower().strip()
    token = f"jwt_{role.lower()}_{int(time.time())}"

    name = ""
    mobile = ""
    title = ""

    if role in ["EMPLOYEE", "ADMIN"]:
        # Check if matching employee exists in DB
        emp = db.query(EmployeeModel).filter(EmployeeModel.email.ilike(email)).first()
        if emp:
            name = emp.name
            mobile = emp.phone
            title = emp.role
        else:
            if role == "ADMIN":
                name = "Priya Anand"
                mobile = "+91 98451 11223"
                title = "Platform Admin & Operations Lead"
            else:
                name = "Rahul Sharma"
                mobile = "+91 98765 43210"
                title = "Field Operations & Workshop Technician"
    else:
        # Check if registered customer exists in DB
        cust = db.query(CustomerModel).filter(CustomerModel.email.ilike(email)).first()
        if cust:
            name = cust.name
            mobile = cust.phone
            title = "Registered Player"
        else:
            name = "Valued Player"
            mobile = "+91 99887 76655"
            title = "Tournament Player"

    # Audit log
    log_audit(
        db=db,
        user=name,
        role=role,
        action=f"{role.capitalize()} Login",
        request_id="AUTH",
        details=f"Email: {email}"
    )

    return AuthSessionResponse(
        isLoggedIn=True,
        token=token,
        role=role,
        email=email,
        name=name,
        mobile=mobile,
        title=title,
        activeView="customer_portal" if role == "CUSTOMER" else ("employee_portal" if role == "EMPLOYEE" else "admin_portal"),
        customerSubView="dashboard",
        employeeSubView="dashboard",
        adminSubView="dashboard"
    )

@router.post("/otp/request")
def request_otp(payload: OtpRequest, db: Session = Depends(get_db)):
    identifier = payload.identifier.strip()
    generated_otp = str(random.randint(100000, 999999))

    # Simulate email
    render_and_simulate_email(
        db=db,
        template_id="TPL-01",
        recipient_email=identifier,
        variables={
            "customer_name": "Valued Player",
            "otp": generated_otp
        }
    )

    return {
        "success": True,
        "message": f"Verification code sent to {identifier}",
        "otp": generated_otp  # returned for testing/development convenience
    }

@router.post("/logout")
def logout():
    return {"success": True, "message": "Logged out successfully"}
