"""End-to-end API tests against a throwaway SQLite database.

Run from backend/:  python -m pytest -q

To run the same suite against PostgreSQL (the production database), point
TEST_DATABASE_URL at an EMPTY, disposable database. Every table in it is dropped at the
start of the run and the schema is rebuilt with `alembic upgrade head`, as on Render:

    TEST_DATABASE_URL=postgresql+psycopg2://postgres@localhost:5499/grsports_test python -m pytest -q
"""
import io
import os
import tempfile
from datetime import timedelta

_test_db_url = os.environ.get("TEST_DATABASE_URL", "").strip()
if _test_db_url:
    os.environ["DATABASE_URL"] = _test_db_url
else:
    _tmp = tempfile.mkdtemp()
    os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["ENVIRONMENT"] = "development"
os.environ["SEED_DEMO_DATA"] = "true"
os.environ["ADMIN_PHONE"] = "98480 22338"
os.environ["ADMIN_PASSWORD"] = "correct-horse-1"
os.environ["EXPOSE_OTP_IN_RESPONSE"] = "true"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402


def _reset_external_test_database():
    """Drop everything in TEST_DATABASE_URL and rebuild it with the Alembic migrations."""
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import MetaData

    from app.database import engine

    meta = MetaData()
    meta.reflect(bind=engine)
    meta.drop_all(bind=engine)
    with engine.begin() as conn:
        conn.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cfg = Config(os.path.join(backend_dir, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))
    command.upgrade(cfg, "head")


if _test_db_url:
    _reset_external_test_database()

from app.main import app  # noqa: E402
from app.security import rate_limiter  # noqa: E402
from app.services.content_service import business_today  # noqa: E402
from app.services.sms_service import normalize_phone  # noqa: E402

ADMIN_PHONE = "+919848022338"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    rate_limiter._hits.clear()


def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_token(client):
    r = client.post("/api/auth/login", json={"phone": ADMIN_PHONE, "password": "correct-horse-1", "role": "ADMIN"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def otp_login(client, phone):
    otp = client.post("/api/auth/otp/request", json={"phone": phone}).json()["otp"]
    r = client.post("/api/auth/login", json={"phone": phone, "otp": otp, "role": "CUSTOMER"})
    assert r.status_code == 200, r.text
    return r.json()


def customer_token(client, phone, name="Test Player"):
    session = otp_login(client, phone)
    if session["isNewCustomer"]:
        r = client.post("/api/auth/register-customer", headers=auth(session["token"]), json={"name": name})
        assert r.status_code == 200, r.text
        session = r.json()
    return session["token"]


ADDRESS = {"houseFlat": "12", "street": "Beach Rd", "area": "MVP Colony", "pincode": "530017", "distanceKm": 3}


def booking(mobile="9000000001", **extra):
    return {
        "serviceType": "GETTING", "gettingType": "Basic Stringing", "customerName": "Someone", "customerMobile": mobile,
        "batBrand": "Yonex", "batModel": "Astrox 88D", "pickupAddress": ADDRESS, "distanceKm": 3, **extra,
    }


# ---------------- Phone numbers ----------------

@pytest.mark.parametrize("raw,expected", [
    ("9876543210", "+919876543210"),
    ("+91 98765 43210", "+919876543210"),
    ("091-98765-43210", None),
    ("09876543210", "+919876543210"),
    ("919876543210", "+919876543210"),
    ("5876543210", None),  # Indian mobiles start with 6-9
    ("12345", None),
    ("", None),
])
def test_normalize_phone(raw, expected):
    assert normalize_phone(raw) == expected


# ---------------- Authentication ----------------

def test_admin_login_requires_correct_password(client):
    r = client.post("/api/auth/login", json={"phone": ADMIN_PHONE, "password": "wrong-password", "role": "ADMIN"})
    assert r.status_code == 401
    r = client.post("/api/auth/login", json={"phone": "9123456789", "password": "whatever1", "role": "ADMIN"})
    assert r.status_code == 401


def test_admin_login_accepts_any_phone_format(client):
    r = client.post("/api/auth/login", json={"phone": "+91 98480-22338", "password": "correct-horse-1", "role": "ADMIN"})
    assert r.status_code == 200 and r.json()["mobile"] == ADMIN_PHONE
    assert "email" not in r.json()


def test_seeded_demo_staff_without_password_cannot_log_in(client):
    r = client.post("/api/auth/login", json={"phone": "+91 98451 11223", "password": "", "role": "ADMIN"})
    assert r.status_code == 401


def test_forged_token_is_rejected(client):
    r = client.get("/api/auth/me", headers=auth("jwt_admin_123456"))
    assert r.status_code == 401


def test_invalid_phone_rejected(client):
    assert client.post("/api/auth/otp/request", json={"phone": "12345"}).status_code == 422


def test_wrong_otp_rejected(client):
    client.post("/api/auth/otp/request", json={"phone": "9000000099"})
    r = client.post("/api/auth/login", json={"phone": "9000000099", "otp": "000000", "role": "CUSTOMER"})
    assert r.status_code == 401


def test_customers_cannot_use_passwords(client):
    customer_token(client, "9000000098")
    r = client.post("/api/auth/login", json={"phone": "9000000098", "password": "player2026", "role": "CUSTOMER"})
    assert r.status_code == 401


def test_new_customer_registers_after_sms_code(client):
    session = otp_login(client, "9000000097")
    assert session["isNewCustomer"] is True and session["name"] == ""
    r = client.post("/api/auth/register-customer", headers=auth(session["token"]), json={"name": "Lakshmi", "address": "Vizag"})
    assert r.status_code == 200 and r.json()["name"] == "Lakshmi" and r.json()["isNewCustomer"] is False
    # Logging in again recognises the number.
    again = otp_login(client, "+91 90000 00097")
    assert again["isNewCustomer"] is False and again["name"] == "Lakshmi"


def test_otp_cannot_be_reused(client):
    otp = client.post("/api/auth/otp/request", json={"phone": "9000000096"}).json()["otp"]
    assert client.post("/api/auth/login", json={"phone": "9000000096", "otp": otp, "role": "CUSTOMER"}).status_code == 200
    assert client.post("/api/auth/login", json={"phone": "9000000096", "otp": otp, "role": "CUSTOMER"}).status_code == 401


def test_otp_limited_per_phone(client):
    codes = [client.post("/api/auth/otp/request", json={"phone": "9000000095"}).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]


def test_login_rate_limited(client):
    codes = [client.post("/api/auth/login", json={"phone": "9123456780", "password": "nope-nope", "role": "ADMIN"}).status_code
             for _ in range(11)]
    assert codes[-1] == 429


# ---------------- Authorization ----------------

def test_private_endpoints_require_login(client):
    for path in ["/api/requests", "/api/employees", "/api/audit-logs", "/api/auth/customers", "/api/stats"]:
        assert client.get(path).status_code == 401, path


def test_customer_cannot_use_admin_endpoints(client):
    token = customer_token(client, "9000000002")
    for path in ["/api/employees", "/api/audit-logs", "/api/auth/customers", "/api/content/admin/banners", "/api/reviews/admin"]:
        assert client.get(path, headers=auth(token)).status_code == 403, path
    r = client.put("/api/config/distance", headers=auth(token), json={})
    assert r.status_code in (403, 422)
    r = client.put("/api/config/getting-services/basic", headers=auth(token), json={"price": 1})
    assert r.status_code == 403


def test_employee_list_never_contains_passwords(client, admin_token):
    r = client.get("/api/employees", headers=auth(admin_token))
    assert r.status_code == 200
    assert all("password" not in e for e in r.json())


def test_customers_only_see_their_own_requests(client, admin_token):
    alice = customer_token(client, "9000000003", "Alice")
    bob = customer_token(client, "9000000004", "Bob")
    # Alice tries to book under Bob's number: the server uses her own verified number.
    r = client.post("/api/requests", headers=auth(alice), json=booking("9000000004"))
    assert r.status_code == 201, r.text
    req = r.json()
    assert req["customerMobile"] == "+919000000003"

    assert [x["id"] for x in client.get("/api/requests", headers=auth(alice)).json()] == [req["id"]]
    assert client.get("/api/requests", headers=auth(bob)).json() == []
    assert client.get(f"/api/requests/{req['id']}", headers=auth(bob)).status_code == 404
    assert any(x["id"] == req["id"] for x in client.get("/api/requests", headers=auth(admin_token)).json())

    # Customers can't move their own job through the workshop.
    r = client.patch(f"/api/requests/{req['id']}/status", headers=auth(alice), json={"status": "Completed"})
    assert r.status_code == 403
    r = client.post(f"/api/requests/{req['id']}/payment", headers=auth(alice), json={"amount": 1, "method": "Cash"})
    assert r.status_code == 403


def test_staff_booking_needs_valid_customer_mobile(client, admin_token):
    r = client.post("/api/requests", headers=auth(admin_token), json=booking("123"))
    assert r.status_code == 422
    r = client.post("/api/requests", headers=auth(admin_token), json=booking("98765 43210"))
    assert r.status_code == 201 and r.json()["customerMobile"] == "+919876543210"


def test_employee_creation_by_mobile(client, admin_token):
    r = client.post("/api/employees", headers=auth(admin_token),
                    json={"name": "New Stringer", "phone": "70000 11122", "userRole": "EMPLOYEE"})
    assert r.status_code == 201, r.text
    body = r.json()
    temp = body["temporaryPassword"]
    assert temp and "password" not in body and body["phone"] == "+917000011122" and body["email"] is None
    r = client.post("/api/auth/login", json={"phone": "7000011122", "password": temp, "role": "EMPLOYEE"})
    assert r.status_code == 200
    # An employee can't escalate to admin.
    r = client.post("/api/auth/login", json={"phone": "7000011122", "password": temp, "role": "ADMIN"})
    assert r.status_code == 401
    # Mobile numbers are unique.
    r = client.post("/api/employees", headers=auth(admin_token),
                    json={"name": "Duplicate", "phone": "+91 70000 11122", "userRole": "EMPLOYEE"})
    assert r.status_code == 400


def test_staff_change_password(client, admin_token):
    r = client.post("/api/employees", headers=auth(admin_token),
                    json={"name": "Pw Tester", "phone": "7000011133", "userRole": "EMPLOYEE", "password": "first-pass-1"})
    token = client.post("/api/auth/login", json={"phone": "7000011133", "password": "first-pass-1", "role": "EMPLOYEE"}).json()["token"]
    r = client.post("/api/auth/change-password", headers=auth(token), json={"currentPassword": "wrong", "newPassword": "second-pass-2"})
    assert r.status_code == 400
    r = client.post("/api/auth/change-password", headers=auth(token), json={"currentPassword": "first-pass-1", "newPassword": "second-pass-2"})
    assert r.status_code == 200
    assert client.post("/api/auth/login", json={"phone": "7000011133", "password": "second-pass-2", "role": "EMPLOYEE"}).status_code == 200


# ---------------- Strings catalogue & stock ----------------

def test_string_catalogue_seeded_with_client_photos(client):
    strings = client.get("/api/content/strings").json()
    assert len(strings) == 49
    assert sum(len(s["variants"]) for s in strings) == 310
    assert {s["brand"] for s in strings} == {"Hundred", "Yonex", "Li-Ning"}
    ultimax = next(s for s in strings if s["name"] == "BG66 Ultimax")
    assert ultimax["brand"] == "Yonex" and ultimax["gauge"] == "0.65 mm" and len(ultimax["variants"]) == 9
    boost = next(s for s in strings if s["name"] == "66X Boost")
    assert boost["price"] is None
    assert boost["variants"][0]["imageUrl"].startswith("/images/strings/hnd-66xb-")
    assert boost["inStockCount"] == len(boost["variants"])


def test_admin_toggles_colour_stock(client, admin_token):
    product = client.get("/api/content/strings").json()[0]
    variant = product["variants"][0]
    r = client.put(f"/api/content/admin/string-variants/{variant['id']}", headers=auth(admin_token), json={"inStock": False})
    assert r.status_code == 200 and r.json()["inStock"] is False
    updated = next(s for s in client.get("/api/content/strings").json() if s["id"] == product["id"])
    assert updated["inStockCount"] == len(product["variants"]) - 1

    r = client.post(f"/api/content/admin/strings/{product['id']}/stock", headers=auth(admin_token), json={"inStock": True})
    assert r.json()["inStockCount"] == len(product["variants"])

    r = client.put(f"/api/content/admin/strings/{product['id']}", headers=auth(admin_token), json={"price": 650})
    assert r.json()["price"] == 650


def test_inactive_strings_hidden_from_public(client, admin_token):
    r = client.post("/api/content/admin/strings", headers=auth(admin_token), json={"name": "Secret String", "isActive": False})
    assert r.status_code == 201
    assert all(s["name"] != "Secret String" for s in client.get("/api/content/strings").json())
    assert any(s["name"] == "Secret String" for s in client.get("/api/content/admin/strings", headers=auth(admin_token)).json())


# ---------------- Banners & media ----------------

def _png_bytes(size=(64, 32)):
    buf = io.BytesIO()
    Image.new("RGB", size, "orange").save(buf, "PNG")
    return buf.getvalue()


def test_media_upload_converts_to_webp_and_serves(client, admin_token):
    r = client.post("/api/media", headers=auth(admin_token), files={"file": ("banner.png", _png_bytes(), "image/png")})
    assert r.status_code == 201, r.text
    media = r.json()
    assert media["contentType"] == "image/webp"
    got = client.get(media["url"].split("testserver")[-1])
    assert got.status_code == 200 and got.headers["content-type"] == "image/webp"
    assert "immutable" in got.headers["cache-control"]


def test_media_upload_rejects_non_images_and_non_admins(client, admin_token):
    r = client.post("/api/media", headers=auth(admin_token), files={"file": ("x.svg", b"<svg onload=alert(1)>", "image/svg+xml")})
    assert r.status_code == 415
    customer = customer_token(client, "9000000005")
    r = client.post("/api/media", headers=auth(customer), files={"file": ("a.png", _png_bytes(), "image/png")})
    assert r.status_code == 403


def test_banner_lifecycle_and_schedule(client, admin_token):
    today = business_today()
    base = {"title": "Diwali offer", "desktopImageUrl": "https://cdn.example.com/a.webp", "ctaTarget": "strings", "ctaLabel": "Shop"}
    live = client.post("/api/content/admin/banners", headers=auth(admin_token), json=base).json()
    future = client.post("/api/content/admin/banners", headers=auth(admin_token),
                         json={**base, "title": "Next month", "startsAt": (today + timedelta(days=5)).isoformat()}).json()
    hidden = client.post("/api/content/admin/banners", headers=auth(admin_token), json={**base, "title": "Off", "isActive": False}).json()

    public_ids = [b["id"] for b in client.get("/api/content/banners").json()]
    assert live["id"] in public_ids and future["id"] not in public_ids and hidden["id"] not in public_ids

    r = client.post("/api/content/admin/banners/reorder", headers=auth(admin_token), json={"ids": [hidden["id"], future["id"], live["id"]]})
    assert [b["id"] for b in r.json()] == [hidden["id"], future["id"], live["id"]]

    assert client.delete(f"/api/content/admin/banners/{hidden['id']}", headers=auth(admin_token)).status_code == 200


def test_banner_rejects_script_links(client, admin_token):
    r = client.post("/api/content/admin/banners", headers=auth(admin_token),
                    json={"title": "x", "desktopImageUrl": "javascript:alert(1)"})
    assert r.status_code == 422
    r = client.post("/api/content/admin/banners", headers=auth(admin_token),
                    json={"title": "x", "desktopImageUrl": "/images/a.webp", "ctaTarget": "url", "ctaUrl": "javascript:alert(1)"})
    assert r.status_code == 422


# ---------------- Reviews ----------------

def test_public_reviews_need_approval(client, admin_token):
    r = client.post("/api/reviews", json={"authorName": "Ravi", "rating": 5, "comment": "Great stringing, quick turnaround!"})
    assert r.status_code == 201 and r.json()["status"] == "pending"
    review_id = r.json()["id"]
    assert all(x["id"] != review_id for x in client.get("/api/reviews").json()["reviews"])

    r = client.patch(f"/api/reviews/admin/{review_id}", headers=auth(admin_token),
                     json={"status": "approved", "isFeatured": True, "adminReply": "Thanks Ravi!"})
    assert r.status_code == 200
    public = client.get("/api/reviews").json()
    assert public["reviews"][0]["id"] == review_id
    assert public["summary"]["count"] >= 1
    assert "authorPhone" not in public["reviews"][0]


def test_completed_request_review_is_verified_and_moderated(client, admin_token):
    token = customer_token(client, "9000000006", "Priya")
    req = client.post("/api/requests", headers=auth(token), json=booking()).json()
    # Reviews are only accepted once the service is finished.
    assert client.patch(f"/api/requests/{req['id']}/status", headers=auth(admin_token), json={"status": "Completed"}).status_code == 200
    r = client.post(f"/api/requests/{req['id']}/review", headers=auth(token), json={"rating": 4, "comment": "Good job overall"})
    assert r.status_code == 200
    pending = client.get("/api/reviews/admin?status=pending", headers=auth(admin_token)).json()
    mine = next(x for x in pending if x["requestId"] == req["id"])
    assert mine["isVerified"] is True and mine["authorName"] == req["customerName"]


# ---------------- Documents ----------------

def test_documents_public_vs_staff_only(client, admin_token):
    pub = client.post("/api/documents/admin", headers=auth(admin_token),
                      json={"title": "Price list", "category": "Price List", "fileUrl": "https://example.com/p.pdf"}).json()
    internal = client.post("/api/documents/admin", headers=auth(admin_token),
                           json={"title": "Supplier sheet", "category": "Internal", "fileUrl": "/x.pdf", "isPublic": False}).json()
    public_ids = [d["id"] for d in client.get("/api/documents").json()]
    assert pub["id"] in public_ids and internal["id"] not in public_ids


# ---------------- Availability ----------------

def test_availability_blocks_closed_and_full_days(client, admin_token):
    today = business_today()
    closed_day = today + timedelta(days=2)
    settings = {
        "openWeekdays": [0, 1, 2, 3, 4, 5, 6], "dailyPickupCapacity": 1, "leadTimeDays": 0, "bookingWindowDays": 30,
        "pickupSlots": ["10:00 - 13:00"], "closedDates": [{"date": closed_day.isoformat(), "reason": "Diwali"}], "notice": "Closed for Diwali",
    }
    r = client.put("/api/availability/admin", headers=auth(admin_token), json=settings)
    assert r.status_code == 200, r.text

    days = {d["date"]: d for d in client.get("/api/availability?days=10").json()["days"]}
    assert days[closed_day.isoformat()]["available"] is False
    assert "Diwali" in days[closed_day.isoformat()]["reason"]

    token = customer_token(client, "9000000007")
    r = client.post("/api/requests", headers=auth(token), json=booking(pickupDate=closed_day.isoformat()))
    assert r.status_code == 422 and "Diwali" in r.json()["detail"]

    day = (today + timedelta(days=3)).isoformat()
    assert client.post("/api/requests", headers=auth(token), json=booking(pickupDate=day)).status_code == 201
    r = client.post("/api/requests", headers=auth(token), json=booking(pickupDate=day))
    assert r.status_code == 422 and "Fully booked" in r.json()["detail"]


def test_invalid_time_slot_rejected(client, admin_token):
    r = client.put("/api/availability/admin", headers=auth(admin_token), json={"pickupSlots": ["morning"]})
    assert r.status_code == 422


def test_public_site_bundle(client):
    r = client.get("/api/content/site")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"shop", "events", "banners", "strings", "rackets", "reviews", "documents", "availability"}
    assert body["availability"]["days"]


# ---------------- Visitor analytics & reports ----------------

def _visit(client, token=None, page="home", visitor="visitor-aaaaaaaa", session="session-aaaaaaaa", **extra):
    headers = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile Safari/604.1"}
    if token:
        headers.update(auth(token))
    return client.post("/api/analytics/visit", headers=headers,
                       json={"visitorId": visitor, "sessionId": session, "page": page, **extra})


def test_visits_recorded_and_linked_to_logged_in_customer(client, admin_token):
    assert _visit(client, page="home", referrer="https://www.google.com/search?q=stringing").status_code == 204
    cust = customer_token(client, "9000000008", "Vinay")
    assert _visit(client, cust, page="customer_portal/wizard", visitor="visitor-bbbbbbbb", session="session-bbbbbbbb").status_code == 204
    # Staff browsing is ignored.
    assert _visit(client, admin_token, page="admin_portal", visitor="visitor-cccccccc").status_code == 204

    summary = client.get("/api/analytics/summary", headers=auth(admin_token)).json()
    t = summary["totals"]
    assert t["pageViews"] == 2 and t["uniqueVisitors"] == 2 and t["loggedInCustomers"] == 1
    assert {"label": "google.com", "count": 1} in summary["topReferrers"]
    assert summary["devices"][0]["label"] == "mobile"
    assert summary["recentCustomers"][0]["name"] == "Vinay"
    assert len(summary["daily"]) == 30


def test_visit_payload_validated(client):
    assert _visit(client, visitor="bad id!").status_code == 422


def test_reports_admin_only(client):
    cust = customer_token(client, "9000000009")
    assert client.get("/api/analytics/summary", headers=auth(cust)).status_code == 403
    assert client.get("/api/analytics/export?type=customers", headers=auth(cust)).status_code == 403
    assert client.get("/api/analytics/export?type=customers").status_code == 401


def test_customer_report_csv(client, admin_token):
    cust = customer_token(client, "9000000010", "=HYPERLINK(\"x\")")
    _visit(client, cust, page="home", visitor="visitor-dddddddd", session="session-dddddddd")
    client.post("/api/requests", headers=auth(cust), json=booking())
    r = client.get("/api/analytics/export?type=customers", headers=auth(admin_token))
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert "attachment" in r.headers["content-disposition"]
    text = r.content.decode("utf-8-sig")
    assert text.splitlines()[0].startswith("Name,Mobile (+91),Address")
    assert "@" not in text.splitlines()[0]
    row = next(line for line in text.splitlines() if "90000 00010" in line)
    assert row.startswith("\"'=HYPERLINK")  # formula neutralised
    logs = client.get("/api/audit-logs", headers=auth(admin_token)).json()
    assert any(l["action"] == "Downloaded customers report" for l in logs)


def test_visit_log_csv(client, admin_token):
    r = client.get("/api/analytics/export?type=visits", headers=auth(admin_token))
    assert r.status_code == 200
    lines = r.content.decode("utf-8-sig").splitlines()
    assert lines[0].startswith("Date & time (IST),Page,Visitor")
    assert any("Guest" in l for l in lines[1:])


def test_report_range_validation(client, admin_token):
    r = client.get("/api/analytics/summary?start=2026-01-10&end=2026-01-01", headers=auth(admin_token))
    assert r.status_code == 422


def test_shop_location_is_visakhapatnam(client):
    config = client.get("/api/config/distance").json()
    assert "Visakhapatnam" in config["shopLocationName"]
    assert 17.6 < config["shopLat"] < 17.9 and 83.1 < config["shopLng"] < 83.4
    # A pickup 3 km away in MVP Colony is inside the free radius, not ~800 km away.
    r = client.post("/api/config/distance/calculate", json={"lat": 17.7417, "lng": 83.3346}).json()
    assert r["distanceKm"] < 6 and r["isFree"] is True


# ---------------- Rackets ----------------

def test_rackets_seeded_without_invented_prices(client):
    rackets = client.get("/api/content/rackets").json()
    assert len(rackets) == 8
    assert all(r["price"] is None and r["images"] == [] for r in rackets)
    assert sum(r["isFeatured"] for r in rackets) == 4


def test_admin_manages_rackets_with_photos(client, admin_token):
    r = client.post("/api/content/admin/rackets", headers=auth(admin_token), json={
        "brand": "Yonex", "name": "Astrox 99 Pro", "price": 15990, "balance": "Head Heavy",
        "images": ["/images/rackets/astrox-99.webp", "https://cdn.example.com/b.webp", "/images/rackets/astrox-99.webp"],
    })
    assert r.status_code == 201, r.text
    racket = r.json()
    assert racket["images"] == ["/images/rackets/astrox-99.webp", "https://cdn.example.com/b.webp"]  # de-duplicated
    assert any(x["id"] == racket["id"] for x in client.get("/api/content/rackets").json())

    r = client.put(f"/api/content/admin/rackets/{racket['id']}", headers=auth(admin_token), json={"inStock": False, "price": None})
    assert r.json()["inStock"] is False and r.json()["price"] is None

    r = client.put(f"/api/content/admin/rackets/{racket['id']}", headers=auth(admin_token), json={"isActive": False})
    assert all(x["id"] != racket["id"] for x in client.get("/api/content/rackets").json())
    assert any(x["id"] == racket["id"] for x in client.get("/api/content/site").json()["rackets"]) is False

    assert client.delete(f"/api/content/admin/rackets/{racket['id']}", headers=auth(admin_token)).status_code == 200


def test_racket_photo_links_validated(client, admin_token):
    r = client.post("/api/content/admin/rackets", headers=auth(admin_token),
                    json={"brand": "X", "name": "Y", "images": ["javascript:alert(1)"]})
    assert r.status_code == 422
    r = client.post("/api/content/admin/rackets", headers=auth(admin_token),
                    json={"brand": "X", "name": "Y", "images": [f"/p{i}.webp" for i in range(7)]})
    assert r.status_code == 422


def test_customers_cannot_manage_rackets(client):
    token = customer_token(client, "9000000011")
    assert client.get("/api/content/admin/rackets", headers=auth(token)).status_code == 403
    assert client.post("/api/content/admin/rackets", headers=auth(token), json={"brand": "X", "name": "Y"}).status_code == 403


def test_catalogue_seeding_adds_new_models_once(client, admin_token):
    from app.database import SessionLocal
    from app.seed_data import seed_string_catalogue

    strings = client.get("/api/content/admin/strings", headers=auth(admin_token)).json()
    exbolt = next(s for s in strings if s["name"] == "Exbolt 63")
    assert client.delete(f"/api/content/admin/strings/{exbolt['id']}", headers=auth(admin_token)).status_code == 200
    db = SessionLocal()
    try:
        seed_string_catalogue(db)  # what a restart does
    finally:
        db.close()
    names = [s["name"] for s in client.get("/api/content/admin/strings", headers=auth(admin_token)).json()]
    assert "Exbolt 63" not in names  # deleted by the admin: not resurrected
    assert len(names) == len(strings) - 1


# ---------------- Service radius & seeded wording ----------------

def test_booking_beyond_max_service_radius_rejected(client):
    config = client.get("/api/config/distance").json()
    token = customer_token(client, "9000000012")
    too_far = config["maxServiceDistanceKm"] + 5
    r = client.post("/api/requests", headers=auth(token), json=booking(distanceKm=too_far))
    assert r.status_code == 422 and "pickup is available within" in r.json()["detail"]
    r = client.post("/api/requests", headers=auth(token), json=booking(distanceKm=-1))
    assert r.status_code == 422
    r = client.post("/api/requests", headers=auth(token), json=booking(distanceKm=config["maxServiceDistanceKm"]))
    assert r.status_code == 201


def test_seeded_wording_is_plain_and_edits_are_kept(client, admin_token):
    from app.database import SessionLocal
    from app.models import GettingServiceTierModel, RepairCategoryTierModel
    from app.seed_data import CATEGORY_WORDING, PACKAGE_WORDING, refresh_seeded_wording

    tiers = {t["id"]: t for t in client.get("/api/config/getting-services").json()}
    assert "AC102EX" not in str(tiers) and "Frame Stress" not in str(tiers)
    cats = client.get("/api/config/repair-categories").json()
    assert all("Toray" not in c["description"] and "epoxy" not in c["description"] for c in cats)

    db = SessionLocal()
    try:
        # A database still holding the old template text gets upgraded...
        basic = db.query(GettingServiceTierModel).get("basic")
        basic.description, basic.features = PACKAGE_WORDING["basic"][0], PACKAGE_WORDING["basic"][1]
        # ...but text the admin wrote is left alone.
        shaft = db.query(RepairCategoryTierModel).get("shaft")
        shaft.description = "Our own shaft repair text"
        db.commit()
        refresh_seeded_wording(db)
        db.refresh(basic); db.refresh(shaft)
        assert basic.description == PACKAGE_WORDING["basic"][2] and basic.features == PACKAGE_WORDING["basic"][3]
        assert shaft.description == "Our own shaft repair text"
        shaft.description = CATEGORY_WORDING["shaft"][1]
        db.commit()
    finally:
        db.close()


def test_racket_model_is_optional(client):
    # Customers often don't know the exact model; the brand is enough to book.
    token = customer_token(client, "9000000032")
    r = client.post("/api/requests", headers=auth(token), json=booking(batBrand="Yonex", batModel=""))
    assert r.status_code == 201, r.text
    assert r.json()["batBrand"] == "Yonex" and r.json()["batModel"] == ""


def test_template_package_names_become_stringing(client, admin_token):
    from app.database import SessionLocal
    from app.models import GettingServiceTierModel, ServiceRequestModel
    from app.seed_data import refresh_seeded_wording

    names = {t["id"]: t["name"] for t in client.get("/api/config/getting-services").json()}
    assert names["basic"] == "Basic Stringing" and not any("Getting" in n for n in names.values())

    token = customer_token(client, "9000000031")
    r = client.post("/api/requests", headers=auth(token), json=booking(gettingType="Durability Stringing"))
    assert r.status_code == 201, r.text
    request_id = r.json()["id"]

    db = SessionLocal()
    try:
        # A database still holding the template names (and bookings that stored them) is upgraded...
        tiers = {t.id: t for t in db.query(GettingServiceTierModel).all()}
        tiers["durability"].name = "Durability Getting"
        db.query(ServiceRequestModel).filter(ServiceRequestModel.id == request_id).update({ServiceRequestModel.gettingType: "Durability Getting"})
        # ...but a name the admin chose is kept.
        tiers["custom"].name = "Hybrid special"
        db.commit()
        refresh_seeded_wording(db)
        db.expire_all()
        assert db.get(GettingServiceTierModel, "durability").name == "Durability Stringing"
        assert db.get(ServiceRequestModel, request_id).gettingType == "Durability Stringing"
        assert db.get(GettingServiceTierModel, "custom").name == "Hybrid special"
        db.get(GettingServiceTierModel, "custom").name = "Custom Stringing"
        db.commit()
    finally:
        db.close()


# ---------------- Pricing integrity, photos, revised estimates, profile ----------------

def test_stringing_price_comes_from_server_package(client):
    token = customer_token(client, "9000000013")
    packages = {t["name"]: t for t in client.get("/api/config/getting-services").json()}
    r = client.post("/api/requests", headers=auth(token),
                    json=booking(gettingType="Tournament Stringing", gettingPrice=1, serviceCharge=1))
    assert r.status_code == 201, r.text
    assert r.json()["serviceCharge"] == packages["Tournament Stringing"]["price"]  # browser price ignored
    assert r.json()["batPhotos"] == []  # no stock photo stored as the customer's racket
    r = client.post("/api/requests", headers=auth(token), json=booking(gettingType="Free Stringing"))
    assert r.status_code == 422
    r = client.post("/api/requests", headers=auth(token), json=booking(gettingType="basic"))  # id also accepted
    assert r.status_code == 201


def test_repair_starts_unpriced_and_revision_adds_one_line(client, admin_token):
    token = customer_token(client, "9000000014")
    req = client.post("/api/requests", headers=auth(token),
                      json=booking(serviceType="REPAIR", gettingType=None, repairIssue="Frame Damage", serviceCharge=5)).json()
    assert req["serviceCharge"] == 0
    est = {"labourCharge": 300, "materialsCharge": 100, "additionalCharges": 0, "pickupDeliveryCharge": 0,
           "discount": 0, "totalEstimate": 400, "expectedCompletionDate": "2026-11-01", "inspectionNotes": "Crack at 12 o'clock"}
    assert client.post(f"/api/requests/{req['id']}/estimate", headers=auth(admin_token), json=est).status_code == 200
    r = client.post(f"/api/requests/{req['id']}/estimate/revise", headers=auth(admin_token),
                    json={"additionalAmount": 150, "newTotal": 99999, "reason": "Second crack found"})
    assert r.status_code == 200, r.text
    e = r.json()["repairEstimate"]
    assert e["totalEstimate"] == 550 and e["labourCharge"] == 300 and e["materialsCharge"] == 100 and e["additionalCharges"] == 150
    r = client.post(f"/api/requests/{req['id']}/estimate/revise", headers=auth(admin_token),
                    json={"additionalAmount": 0, "newTotal": 550, "reason": "x"})
    assert r.status_code == 422


def test_customer_profile_update(client):
    token = customer_token(client, "9000000015", "Old Name")
    r = client.patch("/api/auth/profile", headers=auth(token), json={"name": "New Name", "address": "Siripuram"})
    assert r.status_code == 200 and r.json()["name"] == "New Name"
    assert client.get("/api/auth/me", headers=auth(token)).json()["name"] == "New Name"
    assert client.patch("/api/auth/profile", headers=auth(token), json={"name": "x"}).status_code == 422
