import secrets
import time
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import CustomerModel, EmployeeModel, OtpCodeModel
from app.schemas import AuthSessionResponse, CustomerCreate, CustomerResponse, LoginCredentials, OtpRequest
from app.security import (
    CurrentUser,
    create_access_token,
    get_current_user,
    hash_password,
    is_password_hash,
    password_version,
    rate_limit,
    rate_limiter,
    require_admin,
    require_staff,
    validate_new_password,
    verify_password,
)
from app.services.notification_service import log_audit
from app.services.sms_service import require_phone, send_login_code

router = APIRouter(prefix="/auth", tags=["Authentication"])

INVALID_CREDENTIALS = "Invalid mobile number or password"


def _customer_session(customer: Optional[CustomerModel], phone: str) -> AuthSessionResponse:
    name = customer.name if customer else ""
    token = create_access_token(customer.id if customer else "", phone, "CUSTOMER", name)
    return AuthSessionResponse(
        isLoggedIn=True,
        token=token,
        role="CUSTOMER",
        name=name,
        mobile=phone,
        title="Registered Player" if customer else "",
        activeView="customer_portal",
        customerSubView="dashboard",
        employeeSubView="dashboard",
        adminSubView="dashboard",
        isNewCustomer=customer is None,
    )


def _staff_session(emp: EmployeeModel, role: str) -> AuthSessionResponse:
    token = create_access_token(emp.id, emp.phone, role, emp.name, pwv=password_version(emp.password))
    return AuthSessionResponse(
        isLoggedIn=True,
        token=token,
        role=role,
        name=emp.name,
        mobile=emp.phone,
        title=emp.role,
        activeView="employee_portal" if role == "EMPLOYEE" else "admin_portal",
        customerSubView="dashboard",
        employeeSubView="dashboard",
        adminSubView="dashboard",
    )


def _verify_and_upgrade(account, password: str, db: Session) -> bool:
    if not verify_password(password, account.password):
        return False
    if not is_password_hash(account.password):
        # Legacy plaintext password: replace with a hash now that we know it.
        account.password = hash_password(password)
        db.commit()
    return True


def _consume_otp(db: Session, phone: str, code: str) -> bool:
    otp = (
        db.query(OtpCodeModel)
        .filter(OtpCodeModel.identifier == phone)
        .order_by(OtpCodeModel.expiresAt.desc())
        .first()
    )
    if not otp or otp.expiresAt < time.time() or otp.attempts >= settings.OTP_MAX_ATTEMPTS:
        return False
    otp.attempts += 1
    if not verify_password(code.strip(), otp.codeHash):
        db.commit()
        return False
    db.query(OtpCodeModel).filter(OtpCodeModel.identifier == phone).delete()
    db.commit()
    return True


# Per-address limits are loose on purpose: Indian mobile networks put many customers behind one
# shared IP (CGNAT). The per-number limits and the daily SMS cap are the real protection.
@router.post("/otp/request", dependencies=[Depends(rate_limit("otp", limit=20, window_seconds=900))])
def request_otp(payload: OtpRequest, db: Session = Depends(get_db)):
    phone = require_phone(payload.phone)
    # Limit SMS spend: per number, then a daily cap across all numbers (protects against
    # bots triggering thousands of paid SMS).
    rate_limiter.check(f"otp-phone:{phone}", settings.OTP_PER_PHONE_LIMIT, 900)
    try:
        rate_limiter.check("otp-daily", settings.SMS_DAILY_LIMIT, 86400)
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Login codes are temporarily unavailable. Please call the shop to book.",
        )
    code = f"{secrets.randbelow(1_000_000):06d}"

    db.query(OtpCodeModel).filter(
        (OtpCodeModel.identifier == phone) | (OtpCodeModel.expiresAt < time.time())
    ).delete(synchronize_session=False)
    db.add(OtpCodeModel(
        id=uuid.uuid4().hex,
        identifier=phone,
        codeHash=hash_password(code),
        expiresAt=time.time() + settings.OTP_TTL_SECONDS,
        attempts=0,
    ))
    db.commit()

    sent = send_login_code(phone, code)
    response = {"success": True, "message": f"Verification code sent by SMS to {phone}", "smsSent": sent}
    # Never show codes on screen in production, whatever EXPOSE_OTP_IN_RESPONSE says: anyone
    # who knows a customer's number could then sign in as them.
    expose = "false" if settings.is_production else settings.EXPOSE_OTP_IN_RESPONSE
    if expose in ("1", "true", "yes") or (expose == "auto" and not sent):
        response["otp"] = code
    elif not sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="We couldn't send the SMS right now. Please try again in a few minutes or call the shop.",
        )
    return response


@router.post(
    "/login",
    response_model=AuthSessionResponse,
    dependencies=[Depends(rate_limit("login", limit=30, window_seconds=900))],  # per number: 10
)
def login(credentials: LoginCredentials, db: Session = Depends(get_db)):
    role = credentials.role
    phone = require_phone(credentials.phone)

    if role in ("EMPLOYEE", "ADMIN"):
        # Per-account limit too: the per-IP limit alone can be dodged by rotating addresses.
        rate_limiter.check(f"login-phone:{phone}", 10, 900)
        emp = db.query(EmployeeModel).filter(EmployeeModel.phone == phone).first()
        allowed_role = emp and (emp.userRole == role or (role == "EMPLOYEE" and emp.userRole == "ADMIN"))
        if not emp or not emp.isActive or not allowed_role or not _verify_and_upgrade(emp, credentials.password or "", db):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS)
        log_audit(db, emp.name, role, f"{role.capitalize()} Login", "AUTH", f"Mobile: {phone}")
        return _staff_session(emp, role)

    # Customers sign in with an SMS code only.
    if not credentials.otp or not _consume_otp(db, phone, credentials.otp):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired verification code")
    customer = db.query(CustomerModel).filter(CustomerModel.phone == phone).first()
    if customer:
        log_audit(db, customer.name, "CUSTOMER", "Customer Login", "AUTH", f"Mobile: {phone}")
    return _customer_session(customer, phone)


@router.post("/register-customer", response_model=AuthSessionResponse)
def register_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Completes the profile of a mobile number that was just verified by SMS code."""
    if user.role != "CUSTOMER":
        raise HTTPException(status_code=403, detail="Verify your mobile number before creating an account")
    name = payload.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Please enter your name")

    customer = db.query(CustomerModel).filter(CustomerModel.phone == user.phone).first()
    if customer:
        customer.name = name
        if payload.address:
            customer.address = payload.address
    else:
        customer = CustomerModel(
            id=f"CUST-{uuid.uuid4().hex[:10]}",
            name=name,
            email=None,
            phone=user.phone,
            address=payload.address or "",
            password=None,
            createdAt=time.strftime("%d %b %Y, %I:%M %p"),
        )
        db.add(customer)
    db.commit()
    db.refresh(customer)

    log_audit(db, customer.name, "CUSTOMER", "Customer Registered", "AUTH", f"Mobile: {user.phone}")
    return _customer_session(customer, user.phone)


@router.get("/me", response_model=AuthSessionResponse)
def me(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role == "CUSTOMER":
        customer = db.query(CustomerModel).filter(CustomerModel.phone == user.phone).first()
        return _customer_session(customer, user.phone)
    emp = db.query(EmployeeModel).filter(EmployeeModel.phone == user.phone).first()
    if not emp or not emp.isActive:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is no longer active")
    return _staff_session(emp, user.role)


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None


@router.patch("/profile", response_model=AuthSessionResponse)
def update_profile(payload: ProfileUpdate, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "CUSTOMER":
        raise HTTPException(status_code=403, detail="Only customers can edit this profile")
    customer = db.query(CustomerModel).filter(CustomerModel.phone == user.phone).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Finish creating your account first")
    if payload.name is not None:
        name = payload.name.strip()
        if len(name) < 2 or len(name) > 80:
            raise HTTPException(status_code=422, detail="Please enter your name (2–80 characters)")
        customer.name = name
    if payload.address is not None:
        customer.address = payload.address.strip()[:300]
    db.commit()
    db.refresh(customer)
    return _customer_session(customer, user.phone)


class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str


@router.post("/change-password", dependencies=[Depends(rate_limit("password", limit=10, window_seconds=900))])
def change_password(payload: ChangePasswordRequest, user: CurrentUser = Depends(require_staff), db: Session = Depends(get_db)):
    validate_new_password(payload.newPassword)
    emp = db.query(EmployeeModel).filter(EmployeeModel.phone == user.phone).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Account not found")
    if not verify_password(payload.currentPassword, emp.password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    emp.password = hash_password(payload.newPassword)
    db.commit()
    # Older tokens (e.g. on a lost phone) stop working; this device continues with a new one.
    return {"success": True, "message": "Password updated", "token": _staff_session(emp, user.role).token}


@router.get("/customers", response_model=list[CustomerResponse])
def get_all_customers(db: Session = Depends(get_db), _: CurrentUser = Depends(require_admin)):
    return db.query(CustomerModel).all()


@router.post("/logout")
def logout():
    # Tokens are stateless; the client discards its copy.
    return {"success": True, "message": "Logged out successfully"}
