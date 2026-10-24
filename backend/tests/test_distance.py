"""Pickup distance: computed on the server from the customer's location, corrected by staff
before payment, staff bookings for phone/walk-in customers, and the declined-repair fee.

Run from backend/:  python -m pytest -q tests/test_distance.py
"""
import itertools

import pytest

from tests.test_platform import client, admin_token, auth, customer_token, booking  # noqa: F401
from app.security import rate_limiter
from app.services.pricing_service import ROAD_FACTOR, haversine_distance, road_distance_km

_numbers = itertools.count(1)


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    rate_limiter._hits.clear()


def _new_staff(client, admin_token, name):
    phone = f"72{next(_numbers):08d}"
    r = client.post("/api/employees", headers=auth(admin_token),
                    json={"name": name, "phone": phone, "userRole": "EMPLOYEE", "password": "staff-pass-123"})
    assert r.status_code == 201, r.text
    emp = r.json()
    r = client.post("/api/auth/login", json={"phone": phone, "password": "staff-pass-123", "role": "EMPLOYEE"})
    assert r.status_code == 200, r.text
    return emp, r.json()["token"]


@pytest.fixture(scope="module")
def suresh(client, admin_token):
    return _new_staff(client, admin_token, "Suresh Rider")


@pytest.fixture(scope="module")
def other_staff(client, admin_token):
    return _new_staff(client, admin_token, "Other Rider")


@pytest.fixture(scope="module")
def config(client):
    return client.get("/api/config/distance").json()


def _address(**extra):
    return {"houseFlat": "7", "street": "Beach Rd", "area": "MVP Colony", "pincode": "530017", **extra}


def _offset_point(config, km_north):
    """A point roughly km_north straight-line km north of the shop."""
    return config["shopLat"] + km_north / 111.2, config["shopLng"]


def _set_declined_fee(value):
    from app.database import SessionLocal
    from app.services.shop_settings import save_shop_settings
    db = SessionLocal()
    try:
        save_shop_settings(db, {"declinedRepairFee": value})
    finally:
        db.close()


# ---------------- Booking: distance from the customer's location ----------------

def test_location_distance_is_computed_on_the_server(client, config):
    token = customer_token(client, "9000000401", "Location Customer")
    lat, lng = _offset_point(config, 4)
    # The browser claims 1 km; the server ignores it and uses the location.
    body = booking(pickupAddress=_address(lat=lat, lng=lng, distanceKm=1), distanceKm=1)
    r = client.post("/api/requests", headers=auth(token), json=body)
    assert r.status_code == 201, r.text
    req = r.json()
    expected = road_distance_km(config["shopLat"], config["shopLng"], lat, lng)
    assert abs(expected - 4 * ROAD_FACTOR) < 0.2
    assert req["distanceKm"] == expected
    assert req["pickupAddress"]["distanceKm"] == expected
    assert req["pickupAddress"]["distanceSource"] == "location"
    assert req["pickupAddress"]["lat"] == lat and req["pickupAddress"]["lng"] == lng


def test_location_beyond_free_radius_is_charged_even_if_client_says_free(client, config):
    token = customer_token(client, "9000000402", "Far Location Customer")
    straight_km = (config["freeRadiusKm"] + 5) / ROAD_FACTOR
    lat, lng = _offset_point(config, straight_km)
    r = client.post("/api/requests", headers=auth(token),
                    json=booking(pickupAddress=_address(lat=lat, lng=lng, distanceKm=2), distanceKm=2))
    assert r.status_code == 201, r.text
    req = r.json()
    assert req["distanceKm"] > config["freeRadiusKm"]
    assert req["pickupDeliveryCharge"] > 0 and req["isFreeDelivery"] is False
    assert req["totalAmount"] == req["serviceCharge"] + req["pickupDeliveryCharge"]


def test_location_beyond_max_radius_is_rejected_with_shop_phone(client, config):
    token = customer_token(client, "9000000403", "Too Far Customer")
    lat, lng = _offset_point(config, (config["maxServiceDistanceKm"] + 5) / ROAD_FACTOR)
    r = client.post("/api/requests", headers=auth(token),
                    json=booking(pickupAddress=_address(lat=lat, lng=lng, distanceKm=3), distanceKm=3))
    assert r.status_code == 422
    detail = r.json()["detail"]
    from app.database import SessionLocal
    from app.services.shop_settings import display_phone, get_shop_settings
    db = SessionLocal()
    try:
        phone = display_phone(get_shop_settings(db)["phone"])  # other tests may have edited it
    finally:
        db.close()
    assert "pickup is available within" in detail and phone in detail


@pytest.mark.parametrize("coords", [
    {"lat": 123.0, "lng": 83.3},
    {"lat": 17.7, "lng": 500.0},
    {"lat": 0.0, "lng": 0.0},
    {"lat": 17.7},
])
def test_absurd_coordinates_are_rejected(client, coords):
    token = customer_token(client, "9000000404", "Bad GPS")
    r = client.post("/api/requests", headers=auth(token), json=booking(pickupAddress=_address(**coords)))
    assert r.status_code == 422, r.text


def test_without_location_the_customer_distance_is_kept(client):
    token = customer_token(client, "9000000405", "Typed Distance")
    r = client.post("/api/requests", headers=auth(token),
                    json=booking(pickupAddress=_address(distanceKm=6.25), distanceKm=6.25))
    assert r.status_code == 201, r.text
    req = r.json()
    assert req["pickupAddress"]["distanceSource"] == "customer"
    assert req["distanceKm"] == req["pickupAddress"]["distanceKm"] == 6.2


def test_road_distance_formula():
    assert road_distance_km(17.7283, 83.3017, 17.7283, 83.3017) == 0.0
    straight = haversine_distance(17.7283, 83.3017, 17.80, 83.35)
    assert abs(road_distance_km(17.7283, 83.3017, 17.80, 83.35) - straight * ROAD_FACTOR) < 0.15


# ---------------- Staff booking for a phone / walk-in customer ----------------

def test_staff_booking_creates_customer_account_and_timeline(client, admin_token):
    mobile = "9000000406"
    body = booking(mobile=mobile, customerName="Walk-in Lakshmi", pickupAddress=_address(distanceKm=3), distanceKm=3)
    r = client.post("/api/requests", headers=auth(admin_token), json=body)
    assert r.status_code == 201, r.text
    req = r.json()
    first = req["timeline"][0]
    assert first["label"].startswith("Booked by ") and "for the customer (phone/walk-in)" in first["label"]

    # The customer signs in with OTP and sees the booking under their existing account.
    otp = client.post("/api/auth/otp/request", json={"phone": mobile}).json()["otp"]
    r = client.post("/api/auth/login", json={"phone": mobile, "otp": otp, "role": "CUSTOMER"})
    assert r.status_code == 200, r.text
    session = r.json()
    assert session["isNewCustomer"] is False
    mine = client.get("/api/requests", headers=auth(session["token"])).json()
    assert req["id"] in [m["id"] for m in mine]


def test_staff_booking_for_existing_customer_keeps_one_account(client, admin_token):
    mobile = "9000000407"
    customer_token(client, mobile, "Existing Person")
    r = client.post("/api/requests", headers=auth(admin_token),
                    json=booking(mobile=mobile, customerName="Existing Person"))
    assert r.status_code == 201, r.text
    customers = client.get("/api/customers", headers=auth(admin_token))
    if customers.status_code == 200:
        rows = customers.json()
        rows = rows.get("items", rows) if isinstance(rows, dict) else rows
        assert len([c for c in rows if c.get("phone") == "+91" + mobile]) <= 1


# ---------------- Staff correct the distance before payment ----------------

def _assigned_job(client, staff, phone, **extra):
    emp, tok = staff
    cust = customer_token(client, phone, "Correction Customer")
    r = client.post("/api/requests", headers=auth(cust), json=booking(**extra))
    assert r.status_code == 201, r.text
    req = r.json()
    r = client.post(f"/api/requests/{req['id']}/assign", headers=auth(tok), json={"employeeId": emp["id"]})
    assert r.status_code == 200, r.text
    return req, tok, cust


def test_assigned_employee_corrects_distance_and_charge(client, config, suresh, other_staff):
    req, tok, cust = _assigned_job(client, suresh, "9000000408", pickupAddress=_address(distanceKm=3), distanceKm=3)
    rid = req["id"]
    assert req["pickupDeliveryCharge"] == 0
    new_km = config["freeRadiusKm"] + 4

    # Someone else's job / customers can't correct it.
    _, other_tok = other_staff
    assert client.post(f"/api/requests/{rid}/distance", headers=auth(other_tok),
                       json={"distanceKm": new_km, "reason": "Checked on map"}).status_code == 403
    assert client.post(f"/api/requests/{rid}/distance", headers=auth(cust),
                       json={"distanceKm": new_km, "reason": "Checked on map"}).status_code == 403
    # Validation
    assert client.post(f"/api/requests/{rid}/distance", headers=auth(tok),
                       json={"distanceKm": 250, "reason": "Checked on map"}).status_code == 422
    assert client.post(f"/api/requests/{rid}/distance", headers=auth(tok),
                       json={"distanceKm": new_km, "reason": "x"}).status_code == 422

    r = client.post(f"/api/requests/{rid}/distance", headers=auth(tok),
                    json={"distanceKm": new_km, "reason": "Address is in Madhurawada"})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["distanceKm"] == new_km
    assert out["pickupAddress"]["distanceKm"] == new_km
    assert out["pickupAddress"]["distanceSource"] == "staff"
    expected_charge = round((new_km - config["freeRadiusKm"]) * config["perKmRateBeyondFree"])
    if config.get("pricingMethod") != "SLAB":
        assert out["pickupDeliveryCharge"] == expected_charge
    assert out["pickupDeliveryCharge"] > 0 and out["isFreeDelivery"] is False
    assert out["totalAmount"] == out["serviceCharge"] + out["pickupDeliveryCharge"]
    entry = out["timeline"][-1]
    assert entry["label"] == f"Distance corrected from 3 km to {new_km:g} km — Address is in Madhurawada"
    assert entry["actor"] == "Suresh Rider"

    notes = client.get("/api/notifications", headers=auth(cust)).json()
    assert any(n.get("requestId") == rid and "Pickup & delivery charge updated to ₹" in n["message"] for n in notes)


def test_admin_can_correct_and_repair_estimate_follows(client, admin_token, config, suresh):
    req, tok, cust = _assigned_job(client, suresh, "9000000409", serviceType="REPAIR", gettingType=None,
                                   repairIssue="Frame Crack", pickupAddress=_address(distanceKm=2), distanceKm=2)
    rid = req["id"]
    client.post(f"/api/requests/{rid}/pickup-condition", headers=auth(tok), json={"condition": "Damaged"})
    r = client.post(f"/api/requests/{rid}/estimate", headers=auth(tok),
                    json={"labourCharge": 400, "inspectionNotes": "Crack near T-joint"})
    assert r.status_code == 200, r.text
    r = client.post(f"/api/requests/{rid}/distance", headers=auth(admin_token),
                    json={"distanceKm": config["freeRadiusKm"] + 2, "reason": "Customer moved pickup point"})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["repairEstimate"]["pickupDeliveryCharge"] == out["pickupDeliveryCharge"] > 0
    assert out["totalAmount"] == 400 + out["pickupDeliveryCharge"]


def test_distance_cannot_change_after_payment(client, suresh):
    req, tok, _ = _assigned_job(client, suresh, "9000000410")
    rid = req["id"]
    client.post(f"/api/requests/{rid}/pickup-condition", headers=auth(tok), json={"condition": "Good"})
    for s in ("Getting in Progress", "Getting Completed", "Out for Delivery"):
        assert client.patch(f"/api/requests/{rid}/status", headers=auth(tok), json={"status": s}).status_code == 200
    r = client.post(f"/api/requests/{rid}/payment", headers=auth(tok), json={"amount": req["totalAmount"], "method": "Cash"})
    assert r.status_code == 200, r.text
    r = client.post(f"/api/requests/{rid}/distance", headers=auth(tok), json={"distanceKm": 20, "reason": "Too late"})
    assert r.status_code == 409


def test_distance_cannot_change_on_cancelled_request(client, admin_token, suresh):
    req, tok, _ = _assigned_job(client, suresh, "9000000411")
    rid = req["id"]
    assert client.patch(f"/api/requests/{rid}/status", headers=auth(admin_token),
                        json={"status": "Cancelled"}).status_code == 200
    r = client.post(f"/api/requests/{rid}/distance", headers=auth(admin_token), json={"distanceKm": 5, "reason": "Typo fix"})
    assert r.status_code == 409


# ---------------- Declined repair fee ----------------

def test_declined_repair_fee_is_added_to_amount_due(client, admin_token, config, suresh):
    _set_declined_fee(150)
    try:
        far_km = config["freeRadiusKm"] + 3
        req, tok, cust = _assigned_job(client, suresh, "9000000412", serviceType="REPAIR", gettingType=None,
                                       repairIssue="Shaft Damage", pickupAddress=_address(distanceKm=far_km), distanceKm=far_km)
        rid = req["id"]
        pickup = req["pickupDeliveryCharge"]
        assert pickup > 0
        client.post(f"/api/requests/{rid}/pickup-condition", headers=auth(tok), json={"condition": "Broken"})
        client.post(f"/api/requests/{rid}/estimate", headers=auth(tok), json={"labourCharge": 900, "inspectionNotes": "Shaft"})
        r = client.post(f"/api/requests/{rid}/estimate/decline", headers=auth(cust))
        assert r.status_code == 200, r.text
        out = r.json()
        assert out["serviceCharge"] == 150 and out["totalAmount"] == 150 + pickup
        assert "Declined-repair fee ₹150" in out["timeline"][-1]["notes"]

        assert client.patch(f"/api/requests/{rid}/status", headers=auth(tok), json={"status": "Out for Delivery"}).status_code == 200
        # There is money to collect, so it can't be closed without a payment.
        assert client.patch(f"/api/requests/{rid}/status", headers=auth(tok),
                            json={"status": "Completed Without Repair"}).status_code == 409
        # A distance correction keeps the fee in the total.
        r = client.post(f"/api/requests/{rid}/distance", headers=auth(tok), json={"distanceKm": 2, "reason": "Pickup was nearby"})
        assert r.status_code == 200, r.text
        assert r.json()["totalAmount"] == 150 and r.json()["pickupDeliveryCharge"] == 0
        r = client.post(f"/api/requests/{rid}/payment", headers=auth(tok), json={"amount": 150, "method": "UPI"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "Completed Without Repair" and r.json()["paymentStatus"] == "Paid"
    finally:
        _set_declined_fee(0)


def test_declined_repair_without_fee_and_free_pickup_closes_without_payment(client, suresh):
    req, tok, cust = _assigned_job(client, suresh, "9000000413", serviceType="REPAIR", gettingType=None,
                                   repairIssue="Grip Issue", pickupAddress=_address(distanceKm=2), distanceKm=2)
    rid = req["id"]
    client.post(f"/api/requests/{rid}/pickup-condition", headers=auth(tok), json={"condition": "Good"})
    client.post(f"/api/requests/{rid}/estimate", headers=auth(tok), json={"labourCharge": 200, "inspectionNotes": "Regrip"})
    out = client.post(f"/api/requests/{rid}/estimate/decline", headers=auth(cust)).json()
    assert out["totalAmount"] == 0
    assert client.patch(f"/api/requests/{rid}/status", headers=auth(tok), json={"status": "Out for Delivery"}).status_code == 200
    r = client.patch(f"/api/requests/{rid}/status", headers=auth(tok), json={"status": "Completed Without Repair"})
    assert r.status_code == 200, r.text
