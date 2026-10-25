"""Security & data-integrity regression tests (authorization, token revocation, rate-limit
keys, input validation, business rules).

Run from backend/:  python -m pytest -q tests/test_security.py
"""
import itertools
import json

import pytest

from tests.test_platform import client, admin_token, auth, customer_token, booking, ADMIN_PHONE  # noqa: F401
from tests.test_staff_flow import _new_staff
from app.security import rate_limiter

_phones = itertools.count(1)

JPEG_DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDKooor6w+VP//Z"  # a real 8x8 JPEG


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    rate_limiter._hits.clear()


def _phone():
    return f"931{next(_phones):07d}"


def _customer(client):
    phone = _phone()
    return phone, customer_token(client, phone, "Security Tester")


def _book(client, token, **extra):
    r = client.post("/api/requests", headers=auth(token), json=booking(**extra))
    assert r.status_code == 201, r.text
    return r.json()


# ---------------- Authorization matrix ----------------

def test_customers_only_see_and_act_on_their_own_requests(client, admin_token):
    _, tok_a = _customer(client)
    _, tok_b = _customer(client)
    req = _book(client, tok_a)
    rid = req["id"]

    # B can't read, list, search, approve, decline or review A's request.
    assert client.get(f"/api/requests/{rid}", headers=auth(tok_b)).status_code == 404
    assert rid not in [r["id"] for r in client.get("/api/requests", headers=auth(tok_b)).json()]
    assert client.get(f"/api/requests?search={rid}", headers=auth(tok_b)).json() == []
    for action in ("estimate/approve", "estimate/decline"):
        assert client.post(f"/api/requests/{rid}/{action}", headers=auth(tok_b)).status_code == 404
    r = client.post(f"/api/requests/{rid}/review", headers=auth(tok_b), json={"rating": 1, "comment": "fake review"})
    assert r.status_code == 404
    # ...nor their notifications.
    a_notes = {n["id"] for n in client.get("/api/notifications", headers=auth(tok_a)).json()}
    b_notes = {n["id"] for n in client.get("/api/notifications", headers=auth(tok_b)).json()}
    assert not (a_notes & b_notes)
    # Customers can't use any staff / admin endpoint.
    for path in ("/api/customers", "/api/audit-logs", "/api/auth/customers", "/api/employees",
                 "/api/analytics/summary", "/api/analytics/export", "/api/reviews/admin",
                 "/api/content/admin/events", "/api/stats", "/api/documents/admin"):
        assert client.get(path, headers=auth(tok_a)).status_code == 403, path
    for path in ("/api/customers", "/api/audit-logs", "/api/employees", "/api/requests", "/api/notifications"):
        assert client.get(path).status_code == 401, path
    # A customer can't move their own request along or record a payment.
    assert client.patch(f"/api/requests/{rid}/status", headers=auth(tok_a), json={"status": "Completed"}).status_code == 403
    r = client.post(f"/api/requests/{rid}/payment", headers=auth(tok_a), json={"amount": 1, "method": "Cash"})
    assert r.status_code == 403


def test_employee_list_never_exposes_password_hashes(client, admin_token):
    _, tok = _new_staff(client, admin_token, "Hash Checker")
    for token in (tok, admin_token):
        for emp in client.get("/api/employees?includeInactive=true", headers=auth(token)).json():
            assert "password" not in emp
    assert all("password" not in c for c in client.get("/api/auth/customers", headers=auth(admin_token)).json())


def test_employees_cant_post_notifications_to_customers(client, admin_token):
    _, tok = _new_staff(client, admin_token, "Notice Sender")
    r = client.post("/api/notifications", headers=auth(tok), json={
        "type": "system", "title": "Pay now", "message": "Send money to this UPI id", "requestId": "GET-12345",
        "targetRoles": ["CUSTOMER"],
    })
    assert r.status_code == 403


# ---------------- Tokens ----------------

def test_deactivated_employee_token_stops_working(client, admin_token):
    emp, tok = _new_staff(client, admin_token, "Leaving Soon")
    assert client.get("/api/requests", headers=auth(tok)).status_code == 200
    assert client.delete(f"/api/employees/{emp['id']}", headers=auth(admin_token)).status_code == 200
    assert client.get("/api/requests", headers=auth(tok)).status_code == 401
    assert client.get("/api/employees", headers=auth(tok)).status_code == 401


def test_password_reset_revokes_existing_tokens(client, admin_token):
    emp, tok = _new_staff(client, admin_token, "Lost Phone")
    r = client.put(f"/api/employees/{emp['id']}/password", headers=auth(admin_token), json={"newPassword": "brand-new-pass-1"})
    assert r.status_code == 200
    assert client.get("/api/requests", headers=auth(tok)).status_code == 401
    fresh = client.post("/api/auth/login", json={"phone": emp["phone"], "password": "brand-new-pass-1", "role": "EMPLOYEE"})
    assert fresh.status_code == 200
    assert client.get("/api/requests", headers=auth(fresh.json()["token"])).status_code == 200


def test_own_password_change_returns_a_working_token(client, admin_token):
    emp, tok = _new_staff(client, admin_token, "Pw Rotator")
    r = client.post("/api/auth/change-password", headers=auth(tok),
                    json={"currentPassword": "staff-pass-123", "newPassword": "rotated-pass-9"})
    assert r.status_code == 200
    assert client.get("/api/requests", headers=auth(tok)).status_code == 401
    assert client.get("/api/requests", headers=auth(r.json()["token"])).status_code == 200


def test_employee_token_cannot_claim_admin_role(client, admin_token):
    from app.security import create_access_token

    emp, _ = _new_staff(client, admin_token, "Forger")
    forged = create_access_token(emp["id"], emp["phone"], "ADMIN", emp["name"])
    assert client.get("/api/audit-logs", headers=auth(forged)).status_code == 401


# ---------------- Rate limiting ----------------

def test_spoofed_x_forwarded_for_does_not_bypass_login_limit(client):
    codes = []
    for i in range(12):
        # Render's proxy appends the real client address; the first entry is whatever the client sent.
        headers = {"X-Forwarded-For": f"10.0.{i}.1, 203.0.113.9"}
        r = client.post("/api/auth/login", headers=headers,
                        json={"phone": "9123400001", "password": "guess-000" + str(i), "role": "EMPLOYEE"})
        codes.append(r.status_code)
    assert codes[-1] == 429, codes


def test_staff_password_guessing_is_limited_per_account(client):
    codes = []
    for i in range(12):
        headers = {"X-Forwarded-For": f"198.51.100.{i}"}
        r = client.post("/api/auth/login", headers=headers,
                        json={"phone": ADMIN_PHONE, "password": f"wrong-guess-{i}", "role": "ADMIN"})
        codes.append(r.status_code)
    assert codes[-1] == 429, codes


# ---------------- Input validation ----------------

@pytest.mark.parametrize("photo", [
    "javascript:alert(document.domain)",
    "JaVaScRiPt:alert(1)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    "vbscript:msgbox",
])
def test_booking_photos_must_be_images(client, photo):
    _, tok = _customer(client)
    r = client.post("/api/requests", headers=auth(tok), json=booking(batPhotos=[photo]))
    assert r.status_code == 422, r.text


def test_booking_accepts_photo_data_urls(client):
    _, tok = _customer(client)
    req = _book(client, tok, batPhotos=[JPEG_DATA_URL, "https://example.com/racket.jpg"])
    # Embedded photos are moved to the media store; links are kept as they are.
    assert "/api/media/PHO-" in req["batPhotos"][0]
    assert req["batPhotos"][1] == "https://example.com/racket.jpg"


def test_pickup_photos_must_be_images(client, admin_token):
    _, tok = _customer(client)
    rid = _book(client, tok)["id"]
    r = client.post(f"/api/requests/{rid}/pickup-condition", headers=auth(admin_token),
                    json={"condition": "Good", "photos": ["javascript:alert(1)"]})
    assert r.status_code == 422


def test_booking_rejects_oversized_and_out_of_range_fields(client):
    _, tok = _customer(client)
    for extra in (
        {"customerName": "x" * 5000},
        {"additionalNotes": "x" * 20000},
        {"batModel": "x" * 1000},
        {"stringTensionLbs": 5000},
        {"stringTensionLbs": -3},
        {"batPhotos": [JPEG_DATA_URL] * 20},
    ):
        r = client.post("/api/requests", headers=auth(tok), json=booking(**extra))
        assert r.status_code == 422, (extra.keys(), r.status_code)


def test_nan_and_infinite_numbers_are_rejected(client, admin_token):
    _, tok = _customer(client)
    # Python's json emits NaN / Infinity literals, which FastAPI's parser accepts.
    for value in (float("nan"), float("inf")):
        r = client.post("/api/requests", headers={**auth(tok), "Content-Type": "application/json"},
                        content=json.dumps(booking(distanceKm=value, pickupAddress={**booking()["pickupAddress"], "distanceKm": 3})))
        assert r.status_code == 422, r.text

    rid = _book(client, tok, serviceType="REPAIR", gettingType=None, repairIssue="Frame crack")["id"]
    body = {"labourCharge": float("nan"), "materialsCharge": 100, "additionalCharges": 0, "discount": 0}
    r = client.post(f"/api/requests/{rid}/estimate", headers={**auth(admin_token), "Content-Type": "application/json"},
                    content=json.dumps(body))
    assert r.status_code == 422
    r = client.post(f"/api/requests/{rid}/payment", headers={**auth(admin_token), "Content-Type": "application/json"},
                    content=json.dumps({"amount": float("inf"), "method": "Cash"}))
    assert r.status_code == 422
    # The request (and the admin's list) still load.
    assert client.get(f"/api/requests/{rid}", headers=auth(admin_token)).status_code == 200
    assert client.get("/api/requests", headers=auth(admin_token)).status_code == 200


def test_oversized_request_bodies_are_refused(client):
    body = json.dumps({"phone": "9123400002", "padding": "x" * (12 * 1024 * 1024)})
    r = client.post("/api/auth/otp/request", content=body, headers={"Content-Type": "application/json"})
    assert r.status_code == 413


def test_register_customer_limits_name_and_address(client):
    from tests.test_platform import otp_login

    session = otp_login(client, _phone())
    r = client.post("/api/auth/register-customer", headers=auth(session["token"]),
                    json={"name": "Valid Name", "address": "x" * 10000})
    assert r.status_code == 422
    r = client.post("/api/auth/register-customer", headers=auth(session["token"]), json={"name": "y" * 500})
    assert r.status_code == 422


def test_svg_and_html_uploads_are_rejected(client, admin_token):
    for name, data, ctype in (
        ("x.svg", b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>", "image/svg+xml"),
        ("x.html", b"<html><script>alert(1)</script></html>", "image/png"),
    ):
        r = client.post("/api/media", headers=auth(admin_token), files={"file": (name, data, ctype)})
        assert r.status_code == 415, name


# ---------------- Business rules ----------------

def test_reviews_only_for_finished_requests(client, admin_token):
    _, tok = _customer(client)
    rid = _book(client, tok)["id"]
    r = client.post(f"/api/requests/{rid}/review", headers=auth(tok), json={"rating": 5, "comment": "Great service"})
    assert r.status_code == 409
    assert client.patch(f"/api/requests/{rid}/status", headers=auth(admin_token), json={"status": "Completed"}).status_code == 200
    r = client.post(f"/api/requests/{rid}/review", headers=auth(tok), json={"rating": 5, "comment": "Great service"})
    assert r.status_code == 200


def test_staff_cannot_approve_an_estimate_on_the_customers_behalf(client, admin_token):
    _, tok = _customer(client)
    rid = _book(client, tok, serviceType="REPAIR", gettingType=None, repairIssue="Frame crack")["id"]
    emp, emp_tok = _new_staff(client, admin_token, "Self Approver")
    assert client.post(f"/api/requests/{rid}/assign", headers=auth(emp_tok), json={"employeeId": emp["id"]}).status_code == 200
    r = client.post(f"/api/requests/{rid}/estimate", headers=auth(admin_token),
                    json={"labourCharge": 500, "materialsCharge": 0, "additionalCharges": 0, "discount": 0})
    assert r.status_code == 200, r.text
    for staff_tok in (emp_tok, admin_token):
        assert client.post(f"/api/requests/{rid}/estimate/approve", headers=auth(staff_tok)).status_code == 403
        assert client.post(f"/api/requests/{rid}/estimate/decline", headers=auth(staff_tok)).status_code == 403
    assert client.post(f"/api/requests/{rid}/estimate/approve", headers=auth(tok)).status_code == 200


def test_two_employees_accepting_at_once_only_one_wins(client, admin_token, monkeypatch):
    """Simulates the race: a colleague's accept commits after this request read the job as
    unassigned but before it saved."""
    from app.database import SessionLocal
    from app.models import ServiceRequestModel
    from app.routers import requests as requests_router

    _, tok = _customer(client)
    rid = _book(client, tok)["id"]
    ravi, ravi_tok = _new_staff(client, admin_token, "Race Ravi")
    kiran, _ = _new_staff(client, admin_token, "Race Kiran")
    original = requests_router._require_status

    def colleague_accepts_first(req, allowed, action):
        original(req, allowed, action)
        other = SessionLocal()
        try:
            row = other.query(ServiceRequestModel).filter(ServiceRequestModel.id == rid).first()
            row.assignedEmployeeId, row.assignedEmployeeName = kiran["id"], kiran["name"]
            other.commit()
        finally:
            other.close()

    monkeypatch.setattr(requests_router, "_require_status", colleague_accepts_first)
    r = client.post(f"/api/requests/{rid}/assign", headers=auth(ravi_tok), json={"employeeId": ravi["id"]})
    assert r.status_code == 409, r.text
    monkeypatch.undo()
    assert client.get(f"/api/requests/{rid}", headers=auth(admin_token)).json()["assignedEmployeeId"] == kiran["id"]


def test_cancelled_or_paid_requests_cannot_be_paid_again(client, admin_token):
    _, tok = _customer(client)
    booked = _book(client, tok)
    rid = booked["id"]
    pay = {"amount": booked["totalAmount"], "method": "Cash"}  # the exact amount due
    assert client.post(f"/api/requests/{rid}/payment", headers=auth(admin_token), json=pay).status_code == 200
    assert client.post(f"/api/requests/{rid}/payment", headers=auth(admin_token), json=pay).status_code == 409
    rid2 = _book(client, tok)["id"]
    assert client.patch(f"/api/requests/{rid2}/status", headers=auth(admin_token), json={"status": "Cancelled"}).status_code == 200
    assert client.post(f"/api/requests/{rid2}/payment", headers=auth(admin_token), json=pay).status_code == 409


def test_client_sent_prices_are_ignored(client):
    _, tok = _customer(client)
    req = _book(client, tok, gettingPrice=1, serviceCharge=1, distanceKm=3)
    assert req["serviceCharge"] > 1 and req["totalAmount"] == req["serviceCharge"] + req["pickupDeliveryCharge"]


def test_negative_service_price_rejected(client, admin_token):
    tiers = client.get("/api/config/getting-services").json()
    r = client.put(f"/api/config/getting-services/{tiers[0]['id']}", headers=auth(admin_token), json={"price": -50})
    assert r.status_code == 422


def test_login_codes_are_never_returned_in_production(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "EXPOSE_OTP_IN_RESPONSE", "true")
    r = client.post("/api/auth/otp/request", json={"phone": "9123400003"})
    assert "otp" not in r.json()
