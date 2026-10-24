"""Indian mobile numbers and SMS login codes (MSG91)."""
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional

from fastapi import HTTPException

from app.config import settings

MSG91_OTP_URL = "https://control.msg91.com/api/v5/otp"


def normalize_phone(raw: Optional[str]) -> Optional[str]:
    """Returns +91XXXXXXXXXX for a valid Indian mobile number, else None.
    Accepts spaces, dashes, brackets and a leading +91 / 91 / 0."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) == 10 and digits[0] in "6789":
        return f"+91{digits}"
    return None


def require_phone(raw: Optional[str], field: str = "Mobile number") -> str:
    phone = normalize_phone(raw)
    if not phone:
        raise HTTPException(status_code=422, detail=f"{field} must be a valid 10-digit Indian mobile number")
    return phone


def display_phone(phone: Optional[str]) -> str:
    """+919876543210 -> +91 98765 43210 (anything else is returned unchanged)."""
    if phone and re.fullmatch(r"\+91\d{10}", phone):
        return f"+91 {phone[3:8]} {phone[8:]}"
    return phone or ""


def sms_configured() -> bool:
    return bool(settings.MSG91_AUTH_KEY and settings.MSG91_OTP_TEMPLATE_ID)


def send_login_code(phone: str, code: str) -> bool:
    """Sends the 6-digit login code by SMS through MSG91's OTP API, using the
    DLT-approved OTP template configured in MSG91. Returns True when MSG91 accepted it."""
    if not sms_configured():
        return False
    query = urllib.parse.urlencode({
        "template_id": settings.MSG91_OTP_TEMPLATE_ID,
        "mobile": phone.lstrip("+"),  # country code included, no plus sign
        "otp": code,
        "otp_expiry": max(1, settings.OTP_TTL_SECONDS // 60),
    })
    request = urllib.request.Request(
        f"{MSG91_OTP_URL}?{query}",
        method="POST",
        headers={"authkey": settings.MSG91_AUTH_KEY, "Content-Type": "application/json", "accept": "application/json"},
        data=b"{}",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            body = json.loads(response.read().decode("utf-8") or "{}")
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        print(f"[SMS] MSG91 request failed for {phone[:6]}****: {exc}")
        return False
    if body.get("type") != "success":
        print(f"[SMS] MSG91 rejected the message: {body.get('message') or body}")
        return False
    return True
