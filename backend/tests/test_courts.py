"""Court booking API: venues / courts / blocked times (admin CRUD and validation), pricing,
availability, bookings (validation, race safety, walk-ins, limits), cancellation cut-offs,
status timing, payments, customer isolation and the notifications each side sees.

Shares the throwaway SQLite database and fixtures of tests/test_platform.py (importing it
first sets the test environment variables before the app is loaded). The router's clock is
fixed (Monday 9 Nov 2026, 09:00 India time) so "past" slots and cut-offs are deterministic.

Run from backend/:  python -m pytest -q tests/test_courts.py
"""
import itertools
from datetime import date, datetime, timedelta

import pytest

from tests.test_platform import client, admin_token, auth, customer_token, otp_login  # noqa: F401
from app.database import SessionLocal
from app.models import CourtBookingModel, CourtBookingSlotModel, CustomerModel
from app.routers import courts as courts_router
from app.security import rate_limiter
from app.services.content_service import BUSINESS_TZ
from app.services.shop_settings import DEFAULTS as SHOP_DEFAULTS, display_phone as shop_display_phone, get_shop_settings

_numbers = itertools.count(1)

MON = date(2026, 11, 9)  # the fixed "today"
TUE, WED, SAT = MON + timedelta(days=1), MON + timedelta(days=2), MON + timedelta(days=5)


class Clock:
    def __init__(self):
        self.now = datetime(2026, 11, 9, 9, 0, tzinfo=BUSINESS_TZ)

    def set(self, day: date, hhmm: str):
        h, m = map(int, hhmm.split(":"))
        self.now = datetime(day.year, day.month, day.day, h, m, tzinfo=BUSINESS_TZ)


@pytest.fixture(autouse=True)
def clock(monkeypatch):
    rate_limiter._hits.clear()
    c = Clock()
    monkeypatch.setattr(courts_router, "_now", lambda: c.now)
    return c


# ---------------- Helpers ----------------

def new_customer(client, name="Court Customer"):
    phone = f"76{next(_numbers):08d}"
    return customer_token(client, phone, name), f"+91{phone}"


@pytest.fixture(scope="module")
def employee_token(client, admin_token):
    r = client.post("/api/employees", headers=auth(admin_token),
                    json={"name": "Court Test Staff", "phone": "7690000001", "userRole": "EMPLOYEE", "password": "staff-pass-123"})
    assert r.status_code == 201, r.text
    r = client.post("/api/auth/login", json={"phone": "7690000001", "password": "staff-pass-123", "role": "EMPLOYEE"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def venue_payload(**extra):
    payload = {
        "name": f"Test Courts {next(_numbers)}",
        "address": "Beach Road, Visakhapatnam",
        "area": "MVP Colony",
        "mapsUrl": "https://maps.google.com/?q=test",
        "description": None,
        "photos": ["/images/site/court-empty.webp"],
        "amenities": ["Parking", "Wooden floor"],
        "rules": "Non-marking shoes only",
        "openTime": "06:00",
        "closeTime": "22:00",
        "slotMinutes": 60,
        "pricePerHour": 300,
        "peakPricePerHour": 400,
        "peakStart": "17:00",
        "peakEnd": "21:00",
        "weekendPricePerHour": 500,
        "advanceDays": 14,
        "maxSlotsPerBooking": 3,
        "cancellationHours": 12,
        "isActive": True,
    }
    payload.update(extra)
    return payload


def make_venue(client, token, courts=("Court 1", "Court 2"), **extra):
    r = client.post("/api/courts/admin/venues", headers=auth(token), json=venue_payload(**extra))
    assert r.status_code == 201, r.text
    venue = r.json()
    for name in courts:
        r = client.post(f"/api/courts/admin/venues/{venue['id']}/courts", headers=auth(token),
                        json={"name": name, "surface": "Wooden", "isActive": True})
        assert r.status_code == 201, r.text
    return next(v for v in client.get("/api/courts/admin/venues", headers=auth(token)).json() if v["id"] == venue["id"])


def book(client, token, venue, day, start, slots=1, court=0, **extra):
    body = {"venueId": venue["id"], "courtId": venue["courts"][court]["id"], "date": day.isoformat(),
            "startTime": start, "slots": slots, **extra}
    return client.post("/api/court-bookings", headers=auth(token), json=body)


def availability(client, venue, day):
    r = client.get(f"/api/courts/availability?venueId={venue['id']}&date={day.isoformat()}")
    assert r.status_code == 200, r.text
    return r.json()


def cells(avail, court=0):
    return {c["start"]: c for c in avail["courts"][court]["cells"]}


def cancel(client, token, booking_id, reason="Can't make it"):
    return client.post(f"/api/court-bookings/{booking_id}/cancel", headers=auth(token), json={"reason": reason})


def set_status(client, token, booking_id, status, notes=None):
    return client.patch(f"/api/court-bookings/{booking_id}/status", headers=auth(token), json={"status": status, "notes": notes})


def pay(client, token, booking_id, amount, method="Cash", notes=None):
    return client.post(f"/api/court-bookings/{booking_id}/payment", headers=auth(token),
                       json={"amount": amount, "method": method, "notes": notes})


def notifications(client, token):
    r = client.get("/api/notifications", headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()


def spaced(mobile):
    return f"+91 {mobile[3:8]} {mobile[8:]}"


# ---------------- Demo data ----------------

def test_demo_venue_is_seeded_for_local_preview(client, admin_token):
    venue = next(v for v in client.get("/api/courts/venues").json() if v["name"] == "GR Sports Courts (demo)")
    # Seeded at startup from the shop settings of the fresh test database (other test modules
    # edit the shop settings later, so compare with the defaults it was seeded from).
    assert venue["address"] == SHOP_DEFAULTS["addressLine"] and venue["area"] == SHOP_DEFAULTS["area"]
    assert venue["mapsUrl"] == SHOP_DEFAULTS["mapsUrl"]
    assert venue["photos"] == ["/images/site/court-empty.webp", "/images/site/hall-players.webp"]
    assert venue["amenities"] == ["Wooden floor", "Floodlit", "Drinking water", "Parking"]
    assert (venue["openTime"], venue["closeTime"], venue["slotMinutes"]) == ("06:00", "22:00", 60)
    assert (venue["pricePerHour"], venue["peakPricePerHour"], venue["weekendPricePerHour"]) == (300, 400, 400)
    assert (venue["peakStart"], venue["peakEnd"]) == ("17:00", "21:00")
    assert (venue["advanceDays"], venue["maxSlotsPerBooking"], venue["cancellationHours"]) == (14, 3, 12)
    assert [(c["name"], c["surface"]) for c in venue["courts"]] == [("Court 1", "Wooden"), ("Court 2", "Wooden")]
    blocks = client.get(f"/api/courts/admin/venues/{venue['id']}/blocks", headers=auth(admin_token)).json()
    assert len(blocks) == 1
    block = blocks[0]
    assert block["reason"] == "Coaching batch" and block["weekdays"] == [0, 2, 4] and block["date"] is None
    assert (block["startTime"], block["endTime"], block["courtId"]) == ("06:00", "08:00", venue["courts"][0]["id"])


# ---------------- Pricing ----------------

def test_slot_prices_base_peak_and_weekend(client, admin_token):
    venue = make_venue(client, admin_token)
    tue = cells(availability(client, venue, TUE))
    assert len(tue) == 16 and tue["06:00"]["end"] == "07:00" and tue["21:00"]["end"] == "22:00"
    assert tue["06:00"]["price"] == 300 and tue["16:00"]["price"] == 300
    assert tue["17:00"]["price"] == 400 and tue["20:00"]["price"] == 400  # peak [17:00, 21:00)
    assert tue["21:00"]["price"] == 300
    sat = cells(availability(client, venue, SAT))
    assert {c["price"] for c in sat.values()} == {500}  # weekend beats peak

    # Booking price = sum of its slots (16:00 base + 17:00 and 18:00 peak), never from the client.
    token, _ = new_customer(client)
    r = book(client, token, venue, TUE, "16:00", slots=3, price=1)
    assert r.status_code == 201, r.text
    assert r.json()["price"] == 1100 and r.json()["endTime"] == "19:00"

    # Half-hour slots cost half the hourly rate; without peak / weekend prices it's the base rate.
    half = make_venue(client, admin_token, slotMinutes=30, peakPricePerHour=None, peakStart=None, peakEnd=None,
                      weekendPricePerHour=None)
    sat_half = cells(availability(client, half, SAT))
    assert len(sat_half) == 32 and sat_half["18:30"]["end"] == "19:00"
    assert {c["price"] for c in sat_half.values()} == {150}
    # Weekend price set, no peak: weekdays stay at the base price.
    weekend_only = make_venue(client, admin_token, peakPricePerHour=None, peakStart=None, peakEnd=None)
    assert cells(availability(client, weekend_only, TUE))["18:00"]["price"] == 300
    assert cells(availability(client, weekend_only, SAT))["18:00"]["price"] == 500


def test_hourly_rate_rules():
    class V:
        pricePerHour, peakPricePerHour, peakStart, peakEnd, weekendPricePerHour, slotMinutes = 300, 400, "17:00", "21:00", None, 60
    assert courts_router.hourly_rate(V, SAT, 18 * 60) == 400  # no weekend price: peak applies on Saturday too
    assert courts_router.hourly_rate(V, TUE, 17 * 60) == 400
    assert courts_router.hourly_rate(V, TUE, 21 * 60) == 300
    V.weekendPricePerHour = 450
    assert courts_router.hourly_rate(V, SAT, 18 * 60) == 450
    V.slotMinutes = 30
    assert courts_router.slot_price(V, TUE, 17 * 60 + 30) == 200


# ---------------- Availability ----------------

def test_availability_states_and_blocks(client, admin_token):
    venue = make_venue(client, admin_token)
    c1, c2 = venue["courts"][0]["id"], venue["courts"][1]["id"]
    token, _ = new_customer(client)
    assert book(client, token, venue, MON, "10:00", slots=2).status_code == 201

    # A single-date block on Court 2 (12:00–13:30 overlaps the 12:00 and 13:00 slots) and a weekly
    # Mon / Wed block on every court in the evening.
    r = client.post("/api/courts/admin/blocks", headers=auth(admin_token), json={
        "venueId": venue["id"], "courtId": c2, "date": MON.isoformat(), "startTime": "12:00", "endTime": "13:30",
        "reason": "Maintenance"})
    assert r.status_code == 201, r.text
    r = client.post("/api/courts/admin/blocks", headers=auth(admin_token), json={
        "venueId": venue["id"], "weekdays": [2, 0, 0], "fromDate": MON.isoformat(), "toDate": WED.isoformat(),
        "startTime": "19:00", "endTime": "20:00", "reason": "League night"})
    assert r.status_code == 201 and r.json()["weekdays"] == [0, 2] and r.json()["courtId"] is None

    avail = availability(client, venue, MON)
    assert avail["bookable"] is True and avail["message"] is None and avail["slotMinutes"] == 60
    assert [c["courtId"] for c in avail["courts"]] == [c1, c2]
    one, two = cells(avail, 0), cells(avail, 1)
    assert [one[t]["state"] for t in ("06:00", "08:00", "09:00")] == ["past"] * 3  # start <= 09:00 now
    assert one["10:00"]["state"] == "booked" and one["11:00"]["state"] == "booked" and one["12:00"]["state"] == "free"
    assert set(one["10:00"]) == {"start", "end", "state", "price"}  # never who booked it
    assert two["10:00"]["state"] == "free" and two["12:00"]["state"] == "blocked" and two["13:00"]["state"] == "blocked"
    assert two["14:00"]["state"] == "free"
    assert one["19:00"]["state"] == "blocked" and two["19:00"]["state"] == "blocked" and one["20:00"]["state"] == "free"
    assert cells(availability(client, venue, TUE))["19:00"]["state"] == "free"  # Tuesday isn't in the pattern
    assert cells(availability(client, venue, WED))["19:00"]["state"] == "blocked"
    assert cells(availability(client, venue, MON + timedelta(days=7)))["19:00"]["state"] == "free"  # after toDate

    # A weekly block that starts next week doesn't affect this week.
    client.post("/api/courts/admin/blocks", headers=auth(admin_token), json={
        "venueId": venue["id"], "courtId": c1, "weekdays": [1], "fromDate": (TUE + timedelta(days=7)).isoformat(),
        "startTime": "06:00", "endTime": "08:00", "reason": "Coaching batch"})
    assert cells(availability(client, venue, TUE))["06:00"]["state"] == "free"
    assert cells(availability(client, venue, TUE + timedelta(days=7)))["07:00"]["state"] == "blocked"


def test_availability_not_bookable_messages(client, admin_token):
    venue = make_venue(client, admin_token, advanceDays=3)
    past = availability(client, venue, MON - timedelta(days=1))
    assert past["bookable"] is False and "passed" in past["message"]
    assert {c["state"] for c in past["courts"][0]["cells"]} == {"past"}
    assert availability(client, venue, MON + timedelta(days=3))["bookable"] is True
    far = availability(client, venue, MON + timedelta(days=4))
    assert far["bookable"] is False and far["message"] == "Courts can be booked up to 3 days ahead (until Thu 12 Nov)."

    no_courts = make_venue(client, admin_token, courts=())
    empty = availability(client, no_courts, TUE)
    assert empty["bookable"] is False and empty["courts"] == [] and "No courts" in empty["message"]

    r = client.put(f"/api/courts/admin/venues/{venue['id']}", headers=auth(admin_token), json={"isActive": False})
    assert r.status_code == 200 and r.json()["isActive"] is False
    closed = availability(client, venue, TUE)
    assert closed["bookable"] is False and closed["courts"] == [] and "isn't taking bookings" in closed["message"]
    assert venue["id"] not in [v["id"] for v in client.get("/api/courts/venues").json()]

    assert client.get("/api/courts/availability?venueId=VEN-nope&date=2026-11-10").status_code == 404
    assert client.get(f"/api/courts/availability?venueId={venue['id']}&date=10-11-2026").status_code == 422
    assert client.get(f"/api/courts/availability?venueId={venue['id']}&date=2026-02-30").status_code == 422
    assert client.get(f"/api/courts/availability?venueId={venue['id']}").status_code == 422


def test_availability_is_rate_limited_per_ip(client, admin_token):
    venue = make_venue(client, admin_token, courts=("Court 1",))
    url = f"/api/courts/availability?venueId={venue['id']}&date={TUE.isoformat()}"
    codes = [client.get(url).status_code for _ in range(121)]
    assert codes[:120] == [200] * 120 and codes[120] == 429


# ---------------- Booking ----------------

def test_booking_is_saved_with_server_values(client, admin_token):
    venue = make_venue(client, admin_token)
    token, mobile = new_customer(client, "Ravi Kumar")
    r = book(client, token, venue, TUE, "18:00", slots=2, court=1, players=4, notes="  Bring   shuttles ",
             customerName="Someone Else", customerMobile="9999999999")
    assert r.status_code == 201, r.text
    b = r.json()
    assert b["id"].startswith("CRT-") and len(b["id"]) == 9 and b["id"][4:].isdigit()
    assert (b["venueId"], b["venueName"], b["courtId"], b["courtName"]) == (
        venue["id"], venue["name"], venue["courts"][1]["id"], "Court 2")
    assert (b["date"], b["startTime"], b["endTime"], b["slots"], b["price"]) == ("2026-11-10", "18:00", "20:00", 2, 800)
    assert (b["customerName"], b["customerMobile"]) == ("Ravi Kumar", mobile)  # customers only book for themselves
    assert (b["status"], b["paymentStatus"], b["bookedBy"], b["players"]) == ("Confirmed", "Pending", "customer", 4)
    assert b["notes"] == "Bring   shuttles" and b["canCancel"] is True and b["paymentMethod"] is None
    entry = b["timeline"][0]
    assert entry["status"] == "Confirmed" and entry["actor"] == "Customer (Ravi Kumar)"
    assert entry["timestamp"] == "09 Nov 2026, 09:00 AM"
    assert entry["notes"] == "Court 2, Tue 10 Nov 6:00–8:00 PM · ₹800"
    with SessionLocal() as db:
        slots = db.query(CourtBookingSlotModel).filter(CourtBookingSlotModel.bookingId == b["id"]).all()
        assert sorted(s.startTime for s in slots) == ["18:00", "18:30", "19:00", "19:30"]  # 30-minute pieces


@pytest.mark.parametrize("day,start,slots,code,text", [
    (MON - timedelta(days=1), "18:00", 1, 422, "passed"),
    (MON + timedelta(days=15), "18:00", 1, 422, "up to 14 days ahead"),
    (TUE, "06:30", 1, 422, "Pick a start time"),
    (TUE, "05:00", 1, 422, "Pick a start time"),
    (TUE, "22:00", 1, 422, "Pick a start time"),
    (TUE, "18:15", 1, 422, "hour or half hour"),
    (TUE, "6pm", 1, 422, "time like 18:00"),
    (TUE, "18:00", 0, 422, "Book 1 to 3 slots"),
    (TUE, "18:00", 4, 422, "Book 1 to 3 slots"),
    (TUE, "20:00", 3, 422, "closes at 10:00 PM"),
    (MON, "08:00", 1, 409, "already started"),
    (MON, "09:00", 1, 409, "already started"),
])
def test_booking_validation(client, admin_token, day, start, slots, code, text):
    venue = make_venue(client, admin_token)
    token, _ = new_customer(client)
    r = book(client, token, venue, day, start, slots=slots)
    assert r.status_code == code, r.text
    assert text in r.json()["detail"]


def test_booking_rejections(client, admin_token, employee_token):
    venue = make_venue(client, admin_token)
    token, _ = new_customer(client)
    other, _ = new_customer(client)
    assert book(client, token, venue, MON, "10:00").status_code == 201  # later today is fine
    assert book(client, token, venue, MON + timedelta(days=14), "10:00").status_code == 201  # last day of the window

    r = book(client, other, venue, MON, "10:00")
    assert r.status_code == 409 and r.json()["detail"] == "That time is already booked — pick another slot"
    assert book(client, other, venue, MON, "09:00", slots=2).status_code == 409  # 09:00 is past
    assert book(client, other, venue, MON, "11:00", slots=1).status_code == 201  # right after is free

    client.post("/api/courts/admin/blocks", headers=auth(admin_token), json={
        "venueId": venue["id"], "courtId": venue["courts"][0]["id"], "date": TUE.isoformat(),
        "startTime": "07:30", "endTime": "08:00", "reason": "Deep clean"})
    r = book(client, other, venue, TUE, "06:00", slots=2)
    assert r.status_code == 409 and r.json()["detail"] == "Court 1 isn't available at 7:00–8:00 AM on Tue 10 Nov — pick another time or court"
    r = book(client, admin_token, venue, TUE, "07:00", customerName="Walk In", customerMobile="7612345678")
    assert r.status_code == 409 and "(Deep clean)" in r.json()["detail"]  # the admin sees why
    assert book(client, other, venue, TUE, "07:00", court=1).status_code == 201  # Court 2 isn't blocked

    assert book(client, other, venue, TUE, "12:00", players=0).status_code == 422
    assert book(client, other, venue, TUE, "12:00", notes="x" * 301).status_code == 422
    r = client.post("/api/court-bookings", headers=auth(other),
                    json={"venueId": venue["id"], "courtId": "CRT-nope", "date": TUE.isoformat(), "startTime": "12:00", "slots": 1})
    assert r.status_code == 404
    r = client.post("/api/court-bookings", headers={**auth(other), "Content-Type": "application/json"},
                    content='{"venueId": "%s", "courtId": "%s", "date": "2026-11-10", "startTime": "12:00", "slots": NaN}'
                    % (venue["id"], venue["courts"][0]["id"]))
    assert r.status_code == 422

    # Inactive court / venue.
    court2 = venue["courts"][1]["id"]
    assert client.put(f"/api/courts/admin/courts/{court2}", headers=auth(admin_token), json={"isActive": False}).status_code == 200
    r = book(client, other, venue, WED, "12:00", court=1)
    assert r.status_code == 409 and "isn't open for booking" in r.json()["detail"]
    client.put(f"/api/courts/admin/venues/{venue['id']}", headers=auth(admin_token), json={"isActive": False})
    assert book(client, other, venue, WED, "12:00").status_code == 409

    # Who may book.
    body = {"venueId": venue["id"], "courtId": venue["courts"][0]["id"], "date": TUE.isoformat(), "startTime": "12:00", "slots": 1}
    assert client.post("/api/court-bookings", json=body).status_code == 401
    assert client.post("/api/court-bookings", headers=auth(employee_token), json=body).status_code == 403
    unnamed = otp_login(client, f"76{next(_numbers):08d}")
    assert unnamed["isNewCustomer"] is True
    r = client.post("/api/court-bookings", headers=auth(unnamed["token"]), json=body)
    assert r.status_code == 403 and "add your name" in r.json()["detail"]


def test_double_booking_race_is_refused_by_the_database(client, admin_token, monkeypatch):
    """Another booking for the same time commits after this one's availability check: the
    unique slot rows make the database refuse it, and nothing of the second booking is saved."""
    venue = make_venue(client, admin_token)
    first, _ = new_customer(client, "First Player")
    second, second_mobile = new_customer(client, "Second Player")
    assert book(client, first, venue, TUE, "18:00", slots=2).status_code == 201

    monkeypatch.setattr(courts_router, "_taken_units", lambda db, court_ids, day: set())  # the check saw it free
    r = book(client, second, venue, TUE, "18:00")
    assert r.status_code == 409 and r.json()["detail"] == "That time was just booked — pick another slot"
    r = book(client, second, venue, TUE, "17:00", slots=2)  # overlaps only the first hour
    assert r.status_code == 409 and r.json()["detail"] == "That time was just booked — pick another slot"
    with SessionLocal() as db:
        assert db.query(CourtBookingModel).filter(CourtBookingModel.customerMobile == second_mobile).count() == 0
        court_id = venue["courts"][0]["id"]
        rows = db.query(CourtBookingSlotModel).filter(CourtBookingSlotModel.courtId == court_id).all()
        assert sorted(s.startTime for s in rows) == ["18:00", "18:30", "19:00", "19:30"]
    assert book(client, second, venue, TUE, "16:00").status_code == 201  # free time still books fine


def test_slot_length_change_keeps_existing_bookings_safe(client, admin_token):
    """Bookings hold 30-minute pieces, so switching the venue to half-hour slots (or moving the
    opening time) can't let a new booking overlap an old one."""
    venue = make_venue(client, admin_token, courts=("Court 1",))
    token, _ = new_customer(client)
    assert book(client, token, venue, TUE, "18:00").status_code == 201
    r = client.put(f"/api/courts/admin/venues/{venue['id']}", headers=auth(admin_token), json={"slotMinutes": 30})
    assert r.status_code == 200, r.text
    grid = cells(availability(client, venue, TUE))
    assert grid["18:00"]["state"] == "booked" and grid["18:30"]["state"] == "booked" and grid["19:00"]["state"] == "free"
    other, _ = new_customer(client)
    assert book(client, other, venue, TUE, "18:30").status_code == 409
    assert book(client, other, venue, TUE, "17:30").status_code == 201


def test_admin_walk_in_booking_creates_the_customer(client, admin_token):
    venue = make_venue(client, admin_token)
    phone = f"76{next(_numbers):08d}"
    mobile = f"+91{phone}"
    body = {"venueId": venue["id"], "courtId": venue["courts"][0]["id"], "date": TUE.isoformat(), "startTime": "07:00", "slots": 1}
    r = client.post("/api/court-bookings", headers=auth(admin_token), json=body)
    assert r.status_code == 422 and "Customer name" in r.json()["detail"]
    r = client.post("/api/court-bookings", headers=auth(admin_token), json={**body, "customerName": "Walk In", "customerMobile": "12345"})
    assert r.status_code == 422 and "mobile" in r.json()["detail"]

    r = client.post("/api/court-bookings", headers=auth(admin_token),
                    json={**body, "customerName": "  Suresh   Babu ", "customerMobile": f"+91 {phone[:5]} {phone[5:]}"})
    assert r.status_code == 201, r.text
    b = r.json()
    assert (b["customerName"], b["customerMobile"], b["bookedBy"]) == ("Suresh Babu", mobile, "admin")
    assert b["canCancel"] is True and "walk-in" in b["timeline"][0]["notes"]
    with SessionLocal() as db:
        customer = db.query(CustomerModel).filter(CustomerModel.phone == mobile).one()
        assert customer.name == "Suresh Babu"

    # The customer can sign in with an SMS code and finds the booking and a note about it.
    session = otp_login(client, phone)
    assert session["isNewCustomer"] is False
    mine = client.get("/api/court-bookings", headers=auth(session["token"])).json()
    assert [x["id"] for x in mine] == [b["id"]]
    notes = [n["message"] for n in notifications(client, session["token"]) if n["requestId"] == b["id"]]
    assert notes == [f"{venue['name']} booked Court 1 for you on Tue 10 Nov 7:00–8:00 AM (₹300, pay at the venue)."]
    # No echo to the admin who made it.
    assert not [n for n in notifications(client, admin_token) if n["requestId"] == b["id"]]

    # The admin isn't held to the 3-upcoming limit for a customer.
    for start in ("08:00", "09:00", "10:00"):
        assert client.post("/api/court-bookings", headers=auth(admin_token),
                           json={**body, "startTime": start, "customerName": "Suresh Babu", "customerMobile": phone}).status_code == 201


def test_upcoming_booking_limit_per_customer(client, admin_token, clock):
    venue = make_venue(client, admin_token)
    token, _ = new_customer(client)
    ids = [book(client, token, venue, TUE, t).json()["id"] for t in ("06:00", "07:00", "08:00")]
    r = book(client, token, venue, TUE, "09:00")
    assert r.status_code == 409 and r.json()["detail"].startswith("You already have 3 upcoming court bookings")
    assert cancel(client, token, ids[0]).status_code == 200
    assert book(client, token, venue, TUE, "09:00").status_code == 201
    # Once a booking is over it no longer counts.
    clock.set(TUE, "07:30")  # 07:00–08:00 hasn't finished yet
    assert book(client, token, venue, WED, "06:00").status_code == 409
    clock.set(TUE, "08:00")
    assert book(client, token, venue, WED, "06:00").status_code == 201


def test_booking_is_rate_limited_per_customer(client, admin_token):
    venue = make_venue(client, admin_token, courts=("Court 1",))
    token, _ = new_customer(client)
    codes = [book(client, token, venue, TUE, "18:00", slots=0).status_code for _ in range(11)]
    assert codes[:10] == [422] * 10 and codes[10] == 429
    other, _ = new_customer(client)
    assert book(client, other, venue, TUE, "18:00").status_code == 201


# ---------------- Viewing ----------------

def test_customers_only_see_their_own_bookings(client, admin_token, employee_token, clock):
    venue = make_venue(client, admin_token)
    a, mobile_a = new_customer(client, "Player A")
    b, _ = new_customer(client, "Player B")
    later = book(client, a, venue, WED, "18:00").json()
    sooner = book(client, a, venue, TUE, "18:00").json()
    dropped = book(client, a, venue, TUE, "06:00").json()
    cancel(client, a, dropped["id"])
    theirs = book(client, b, venue, TUE, "19:00").json()

    mine = client.get("/api/court-bookings", headers=auth(a)).json()
    assert [x["id"] for x in mine] == [sooner["id"], later["id"], dropped["id"]]  # upcoming soonest first, then the rest
    assert all(x["customerMobile"] == mobile_a for x in mine)
    assert client.get(f"/api/court-bookings/{theirs['id']}", headers=auth(a)).status_code == 404
    assert cancel(client, a, theirs["id"]).status_code == 404
    assert client.get(f"/api/court-bookings/{sooner['id']}", headers=auth(a)).json()["id"] == sooner["id"]

    # Past bookings come after upcoming ones.
    clock.set(TUE, "20:00")
    assert [x["id"] for x in client.get("/api/court-bookings", headers=auth(a)).json()] == [
        later["id"], sooner["id"], dropped["id"]]

    assert client.get("/api/court-bookings", headers=auth(employee_token)).status_code == 403
    assert client.get(f"/api/court-bookings/{sooner['id']}", headers=auth(employee_token)).status_code == 403
    assert client.get("/api/court-bookings").status_code == 401
    assert client.get(f"/api/court-bookings/{sooner['id']}", headers=auth(admin_token)).status_code == 200
    assert client.get("/api/court-bookings/CRT-00000", headers=auth(admin_token)).status_code == 404


def test_admin_booking_list_filters(client, admin_token, clock):
    venue = make_venue(client, admin_token)
    other_venue = make_venue(client, admin_token, courts=("Court 1",))
    token, _ = new_customer(client)
    today = book(client, token, venue, MON, "18:00").json()
    tue = book(client, token, venue, TUE, "18:00", court=1).json()
    elsewhere = book(client, token, other_venue, WED, "18:00").json()

    def listed(query=""):
        r = client.get(f"/api/court-bookings{query}", headers=auth(admin_token))
        assert r.status_code == 200, r.text
        return [x["id"] for x in r.json()]

    everything = listed()
    assert everything.index(today["id"]) < everything.index(tue["id"]) < everything.index(elsewhere["id"])
    assert listed(f"?venueId={venue['id']}") == [today["id"], tue["id"]]
    assert listed(f"?venueId={venue['id']}&from={TUE.isoformat()}&to={TUE.isoformat()}") == [tue["id"]]
    assert listed(f"?from={WED.isoformat()}&venueId={other_venue['id']}") == [elsewhere["id"]]
    clock.set(TUE, "08:00")  # default: today onwards
    assert today["id"] not in listed(f"?venueId={venue['id']}")
    assert listed(f"?venueId={venue['id']}&from={MON.isoformat()}") == [today["id"], tue["id"]]
    assert client.get("/api/court-bookings?from=11/09/2026", headers=auth(admin_token)).status_code == 422
    assert client.get(f"/api/court-bookings?from={WED.isoformat()}&to={TUE.isoformat()}", headers=auth(admin_token)).status_code == 422


# ---------------- Cancelling ----------------

def test_cancel_cut_off_customer_vs_admin(client, admin_token, clock):
    venue = make_venue(client, admin_token)  # 12-hour cut-off
    token, _ = new_customer(client, "Late Canceller")
    booking = book(client, token, venue, TUE, "18:00").json()
    assert booking["canCancel"] is True

    r = client.post(f"/api/court-bookings/{booking['id']}/cancel", headers=auth(token), json={})
    assert r.status_code == 422 and "Reason" in r.json()["detail"]
    assert cancel(client, token, booking["id"], reason="no").status_code == 422
    assert cancel(client, token, booking["id"], reason="x" * 201).status_code == 422

    clock.set(TUE, "06:00")  # exactly 12 hours before: too late online
    assert client.get(f"/api/court-bookings/{booking['id']}", headers=auth(token)).json()["canCancel"] is False
    r = cancel(client, token, booking["id"])
    with SessionLocal() as db:
        phone = shop_display_phone(get_shop_settings(db)["phone"])
    assert r.status_code == 409
    assert r.json()["detail"] == (f"Bookings can be cancelled online until 12 hours before the start "
                                  f"(that was 6:00 AM on Tue 10 Nov). Please call us on {phone}.")
    assert client.get(f"/api/court-bookings/{booking['id']}", headers=auth(admin_token)).json()["canCancel"] is True

    r = cancel(client, admin_token, booking["id"], reason="  Court flooded ")
    assert r.status_code == 200, r.text
    done = r.json()
    assert done["status"] == "Cancelled" and done["cancelReason"] == "Court flooded" and done["canCancel"] is False
    assert done["timeline"][-1]["status"] == "Cancelled" and done["timeline"][-1]["notes"] == "Court flooded"
    assert cancel(client, admin_token, booking["id"]).status_code == 409  # already cancelled
    # The time is free again.
    assert cells(availability(client, venue, TUE))["18:00"]["state"] == "free"
    other, _ = new_customer(client)
    assert book(client, other, venue, TUE, "18:00").status_code == 201

    # Before the cut-off the customer can cancel; a zero-hour venue allows it until the start.
    clock.set(MON, "09:00")
    early = book(client, token, venue, WED, "18:00").json()
    r = cancel(client, token, early["id"])
    assert r.status_code == 200 and r.json()["timeline"][-1]["actor"] == "Customer (Late Canceller)"
    flexible = make_venue(client, admin_token, cancellationHours=0)
    late = book(client, token, flexible, MON, "12:00").json()
    clock.set(MON, "11:59")
    assert cancel(client, token, late["id"]).status_code == 200
    late2 = book(client, token, flexible, MON, "13:00").json()
    clock.set(MON, "13:00")
    r = cancel(client, token, late2["id"])
    assert r.status_code == 409 and r.json()["detail"].startswith("This booking has already started")


def test_venue_policy_change_does_not_change_existing_cut_offs(client, admin_token, clock):
    venue = make_venue(client, admin_token, cancellationHours=2)
    token, _ = new_customer(client)
    booking = book(client, token, venue, TUE, "18:00").json()
    client.put(f"/api/courts/admin/venues/{venue['id']}", headers=auth(admin_token), json={"cancellationHours": 48})
    clock.set(TUE, "15:00")
    assert cancel(client, token, booking["id"]).status_code == 200  # the 2-hour rule it was booked under


# ---------------- Status & payment ----------------

def test_status_only_after_the_start(client, admin_token, clock):
    venue = make_venue(client, admin_token)
    token, _ = new_customer(client)
    played = book(client, token, venue, MON, "11:00").json()
    missed = book(client, token, venue, MON, "12:00").json()

    r = set_status(client, admin_token, played["id"], "Completed")
    assert r.status_code == 409 and "once the time has started" in r.json()["detail"]
    assert set_status(client, token, played["id"], "Completed").status_code == 403
    assert set_status(client, admin_token, played["id"], "Cancelled").status_code == 422  # cancel has its own endpoint

    clock.set(MON, "11:00")
    r = set_status(client, admin_token, played["id"], "Completed", notes="Paid at the desk")
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "Completed" and r.json()["canCancel"] is False
    assert r.json()["timeline"][-1]["notes"] == "Paid at the desk"
    assert set_status(client, admin_token, played["id"], "No-show").status_code == 409
    assert cancel(client, admin_token, played["id"]).status_code == 409  # played: can't be cancelled

    clock.set(MON, "12:30")
    assert set_status(client, admin_token, missed["id"], "No-show").json()["status"] == "No-show"
    assert cancel(client, admin_token, missed["id"]).status_code == 409

    clock.set(MON, "09:00")
    gone = book(client, token, venue, TUE, "11:00").json()
    cancel(client, token, gone["id"])
    clock.set(TUE, "12:00")
    assert set_status(client, admin_token, gone["id"], "Completed").status_code == 409
    assert set_status(client, admin_token, "CRT-00000", "Completed").status_code == 404


def test_payment_rules(client, admin_token, clock):
    venue = make_venue(client, admin_token)
    token, _ = new_customer(client)
    booking = book(client, token, venue, TUE, "17:00", slots=2).json()  # 2 × ₹400 peak
    assert booking["price"] == 800

    r = pay(client, admin_token, booking["id"], 700)
    assert r.status_code == 422 and "₹800" in r.json()["detail"]
    assert pay(client, admin_token, booking["id"], 0).status_code == 422
    r = client.post(f"/api/court-bookings/{booking['id']}/payment", headers={**auth(admin_token), "Content-Type": "application/json"},
                    content='{"amount": NaN, "method": "Cash"}')
    assert r.status_code == 422
    assert pay(client, admin_token, booking["id"], 800, method="Card").status_code == 422
    assert pay(client, token, booking["id"], 800).status_code == 403

    r = pay(client, admin_token, booking["id"], 800.5, method="UPI")  # within ₹1
    assert r.status_code == 200, r.text
    paid = r.json()
    assert paid["paymentStatus"] == "Paid" and paid["paymentMethod"] == "UPI" and paid["paidAt"]
    assert paid["timeline"][-1]["label"] == "₹800.50 received via UPI"
    assert pay(client, admin_token, booking["id"], 800).status_code == 409  # already paid

    # A paid booking that is cancelled reminds the admin to refund.
    r = cancel(client, admin_token, booking["id"], reason="Rain")
    assert r.json()["timeline"][-1]["notes"] == "Rain ₹800.50 was already paid — refund it to the customer."

    discounted = book(client, token, venue, TUE, "06:00").json()
    assert pay(client, admin_token, discounted["id"], 250, notes="Regular player discount").status_code == 200
    cancelled = book(client, token, venue, TUE, "07:00").json()
    cancel(client, token, cancelled["id"])
    r = pay(client, admin_token, cancelled["id"], 300)
    assert r.status_code == 409 and "cancelled" in r.json()["detail"]

    # Payment can be recorded after the game too (Completed / No-show).
    later = book(client, token, venue, WED, "06:00").json()
    clock.set(WED, "07:00")
    assert set_status(client, admin_token, later["id"], "Completed").status_code == 200
    assert pay(client, admin_token, later["id"], 300).json()["paymentStatus"] == "Paid"


# ---------------- Notifications ----------------

def test_booking_notifications_reach_the_right_people(client, admin_token, employee_token):
    venue = make_venue(client, admin_token)
    a, mobile_a = new_customer(client, "Notified Player")
    b, _ = new_customer(client, "Other Player")
    booking = book(client, a, venue, SAT, "18:00").json()
    bid = booking["id"]

    admin_notes = [n for n in notifications(client, admin_token) if n["requestId"] == bid]
    assert len(admin_notes) == 1
    assert admin_notes[0]["message"] == f"Court booked: Court 1, Sat 14 Nov 6:00–7:00 PM — Notified Player, {spaced(mobile_a)}"
    assert not [n for n in notifications(client, a) if n["requestId"] == bid]  # the admin notice isn't for the customer
    assert not [n for n in notifications(client, employee_token) if n["requestId"] == bid]

    pay(client, admin_token, bid, 500)
    cancel(client, admin_token, bid, reason="Tournament moved here")
    mine = [n["message"] for n in notifications(client, a) if n["requestId"] == bid]
    assert f"Payment of ₹500 received for court booking {bid}. Thank you!" in mine
    assert f"Your court booking {bid} (Court 1, Sat 14 Nov 6:00–7:00 PM) has been cancelled: Tournament moved here" in mine
    assert not [n for n in notifications(client, b) if n["requestId"] == bid]
    assert not [n for n in notifications(client, employee_token) if n["requestId"] == bid]
    assert len([n for n in notifications(client, admin_token) if n["requestId"] == bid]) == 1  # no echo of own changes

    note = next(n for n in notifications(client, a) if n["requestId"] == bid)
    assert client.patch(f"/api/notifications/{note['id']}/read", headers=auth(b)).status_code == 404
    assert client.patch(f"/api/notifications/{note['id']}/read", headers=auth(a)).status_code == 200

    second = book(client, a, venue, SAT, "11:00").json()
    cancel(client, a, second["id"], reason="Exam that day")
    admin_msgs = [n["message"] for n in notifications(client, admin_token) if n["requestId"] == second["id"]]
    assert f"Notified Player cancelled court booking {second['id']} (Court 1, Sat 14 Nov 11:00 AM–12:00 PM): Exam that day" in admin_msgs


# ---------------- Admin: venues, courts, blocks ----------------

def test_venue_crud_and_public_listing(client, admin_token):
    venue = make_venue(client, admin_token, courts=("Court B", "Court A"), name="  Crud   Courts ",
                       amenities=["Parking", " parking ", "", "Floodlit"], photos=["/a.webp", "/a.webp", "https://x.test/b.webp"])
    assert venue["name"] == "Crud Courts" and venue["amenities"] == ["Parking", "Floodlit"]
    assert venue["photos"] == ["/a.webp", "https://x.test/b.webp"]
    assert [c["name"] for c in venue["courts"]] == ["Court B", "Court A"]  # added order
    assert [c["sortOrder"] for c in venue["courts"]] == [0, 1]

    r = client.put(f"/api/courts/admin/venues/{venue['id']}", headers=auth(admin_token),
                   json={"pricePerHour": 350, "peakPricePerHour": None, "peakStart": None, "peakEnd": None})
    assert r.status_code == 200, r.text
    updated = r.json()
    assert updated["pricePerHour"] == 350 and updated["peakPricePerHour"] is None and updated["peakStart"] is None
    assert updated["weekendPricePerHour"] == 500 and updated["name"] == "Crud Courts"  # untouched fields kept
    r = client.put(f"/api/courts/admin/venues/{venue['id']}", headers=auth(admin_token), json={"openTime": "23:00"})
    assert r.status_code == 422
    assert client.get("/api/courts/admin/venues", headers=auth(admin_token)).json()  # still fine
    stored = next(v for v in client.get("/api/courts/admin/venues", headers=auth(admin_token)).json() if v["id"] == venue["id"])
    assert stored["openTime"] == "06:00"

    court_b = venue["courts"][0]["id"]
    assert client.put(f"/api/courts/admin/courts/{court_b}", headers=auth(admin_token), json={"isActive": False}).status_code == 200
    public = next(v for v in client.get("/api/courts/venues").json() if v["id"] == venue["id"])
    assert [c["name"] for c in public["courts"]] == ["Court A"]
    assert [c["courtName"] for c in availability(client, venue, TUE)["courts"]] == ["Court A"]
    admin_view = next(v for v in client.get("/api/courts/admin/venues", headers=auth(admin_token)).json() if v["id"] == venue["id"])
    assert len(admin_view["courts"]) == 2

    assert client.put("/api/courts/admin/venues/VEN-nope", headers=auth(admin_token), json={"name": "Nope"}).status_code == 404
    assert client.delete(f"/api/courts/admin/venues/{venue['id']}", headers=auth(admin_token)).json() == {"success": True}
    assert venue["id"] not in [v["id"] for v in client.get("/api/courts/admin/venues", headers=auth(admin_token)).json()]
    assert client.delete(f"/api/courts/admin/courts/{court_b}", headers=auth(admin_token)).status_code == 404  # went with it


@pytest.mark.parametrize("extra,message", [
    ({"name": "A"}, "at least 2"),
    ({"name": "x" * 81}, "at most 80"),
    ({"address": "ab"}, "at least 3"),
    ({"address": "x" * 201}, "at most 200"),
    ({"photos": [f"/p{i}.webp" for i in range(7)]}, "at most 6 photos"),
    ({"photos": ["javascript:alert(1)"]}, "https"),
    ({"mapsUrl": "/relative"}, "https"),
    ({"amenities": [f"Amenity {i}" for i in range(13)]}, "at most 12"),
    ({"amenities": ["x" * 41]}, "at most 40"),
    ({"openTime": "22:00", "closeTime": "06:00"}, "before the closing time"),
    ({"openTime": "06:15"}, "hour or half hour"),
    ({"openTime": "25:00"}, "time like"),
    ({"slotMinutes": 45}, "30 or 60"),
    ({"openTime": "06:30"}, "whole hours"),
    ({"pricePerHour": 0}, "more than ₹0"),
    ({"pricePerHour": 10_001}, "at most ₹10,000"),
    ({"weekendPricePerHour": -5}, "more than ₹0"),
    ({"peakStart": None}, "start and the end"),
    ({"peakStart": "21:00", "peakEnd": "17:00"}, "start before"),
    ({"peakStart": "05:00"}, "within the opening hours"),
    ({"advanceDays": 0}, "1 to 60"),
    ({"advanceDays": 61}, "1 to 60"),
    ({"maxSlotsPerBooking": 9}, "1 to 8"),
    ({"cancellationHours": 73}, "0 to 72"),
    ({"cancellationHours": -1}, "0 to 72"),
])
def test_venue_validation(client, admin_token, extra, message):
    r = client.post("/api/courts/admin/venues", headers=auth(admin_token), json=venue_payload(**extra))
    assert r.status_code == 422, r.text
    assert message in r.json()["detail"]


def test_venue_validation_edge_cases(client, admin_token):
    r = client.post("/api/courts/admin/venues", headers={**auth(admin_token), "Content-Type": "application/json"},
                    content='{"name": "NaN Courts", "address": "Somewhere", "openTime": "06:00", "closeTime": "22:00", "pricePerHour": NaN}')
    assert r.status_code == 422
    r = client.post("/api/courts/admin/venues", headers=auth(admin_token), json=venue_payload(name="x" * 600))
    assert r.status_code == 422  # hard cap in the schema
    # Midnight close, half-hour slots on a half-hour opening, no peak.
    r = client.post("/api/courts/admin/venues", headers=auth(admin_token), json=venue_payload(
        openTime="6:30", closeTime="24:00", slotMinutes=30, peakPricePerHour=None, peakStart=None, peakEnd=None))
    assert r.status_code == 201, r.text
    assert (r.json()["openTime"], r.json()["closeTime"]) == ("06:30", "24:00")
    # Peak hours without a peak price are kept (harmless).
    r = client.post("/api/courts/admin/venues", headers=auth(admin_token), json=venue_payload(peakPricePerHour=None))
    assert r.status_code == 201 and r.json()["peakStart"] == "17:00"


def test_court_validation(client, admin_token):
    venue = make_venue(client, admin_token, courts=("Court 1",))
    url = f"/api/courts/admin/venues/{venue['id']}/courts"
    assert client.post(url, headers=auth(admin_token), json={"name": "  "}).status_code == 422
    assert client.post(url, headers=auth(admin_token), json={"name": "x" * 41}).status_code == 422
    assert client.post(url, headers=auth(admin_token), json={"name": "Court 2", "surface": "x" * 41}).status_code == 422
    r = client.post(url, headers=auth(admin_token), json={"name": "court 1"})
    assert r.status_code == 409 and "already has a court called Court 1" in r.json()["detail"]
    r = client.post(url, headers=auth(admin_token), json={"name": "Court 2", "surface": "Synthetic mat"})
    assert r.status_code == 201 and r.json()["sortOrder"] == 1 and r.json()["venueId"] == venue["id"]
    court2 = r.json()["id"]
    assert client.put(f"/api/courts/admin/courts/{court2}", headers=auth(admin_token), json={"name": "COURT 1"}).status_code == 409
    r = client.put(f"/api/courts/admin/courts/{court2}", headers=auth(admin_token), json={"name": "Centre Court", "surface": None})
    assert r.status_code == 200 and r.json()["name"] == "Centre Court" and r.json()["surface"] is None
    # Another venue may reuse the name.
    other = make_venue(client, admin_token, courts=("Court 1",))
    assert other["courts"][0]["name"] == "Court 1"
    assert client.post("/api/courts/admin/venues/VEN-nope/courts", headers=auth(admin_token), json={"name": "X"}).status_code == 404
    assert client.put("/api/courts/admin/courts/CRT-nope", headers=auth(admin_token), json={"name": "X"}).status_code == 404


def test_block_validation_and_lifecycle(client, admin_token):
    venue = make_venue(client, admin_token)
    other = make_venue(client, admin_token, courts=("Court 1",))
    base = {"venueId": venue["id"], "startTime": "06:00", "endTime": "08:00", "reason": "Coaching"}

    def create(**extra):
        return client.post("/api/courts/admin/blocks", headers=auth(admin_token), json={**base, **extra})

    assert "Choose a date" in create().json()["detail"]
    assert "not both" in create(date=TUE.isoformat(), weekdays=[1]).json()["detail"]
    assert create(date=TUE.isoformat(), startTime="08:00", endTime="08:00").status_code == 422
    assert create(date=TUE.isoformat(), startTime="09:00", endTime="08:00").status_code == 422
    assert create(date=TUE.isoformat(), reason="x").status_code == 422
    assert create(date=TUE.isoformat(), reason="x" * 81).status_code == 422
    assert create(weekdays=[7]).status_code == 422
    assert create(date=(MON - timedelta(days=1)).isoformat()).status_code == 422
    assert create(weekdays=[1], fromDate=WED.isoformat(), toDate=TUE.isoformat()).status_code == 422
    assert create(date=TUE.isoformat(), courtId=other["courts"][0]["id"]).status_code == 404
    assert create(date=TUE.isoformat(), venueId="VEN-nope").status_code == 404

    # Blocking over an existing booking is allowed (the admin deals with the booking).
    token, _ = new_customer(client)
    assert book(client, token, venue, TUE, "06:00").status_code == 201
    r = create(date=TUE.isoformat())
    assert r.status_code == 201, r.text
    single = r.json()
    assert single["courtId"] is None and single["weekdays"] is None and single["fromDate"] is None
    weekly = create(weekdays=[3], courtId=venue["courts"][1]["id"], endTime="24:00").json()
    assert weekly["fromDate"] == MON.isoformat() and weekly["toDate"] is None and weekly["endTime"] == "24:00"

    listed = client.get(f"/api/courts/admin/venues/{venue['id']}/blocks", headers=auth(admin_token)).json()
    assert {b["id"] for b in listed} == {single["id"], weekly["id"]}
    assert cells(availability(client, venue, TUE), 1)["06:00"]["state"] == "blocked"
    assert client.delete(f"/api/courts/admin/blocks/{single['id']}", headers=auth(admin_token)).json() == {"success": True}
    assert cells(availability(client, venue, TUE), 1)["06:00"]["state"] == "free"
    assert client.delete(f"/api/courts/admin/blocks/{single['id']}", headers=auth(admin_token)).status_code == 404
    assert client.get("/api/courts/admin/venues/VEN-nope/blocks", headers=auth(admin_token)).status_code == 404


def test_delete_with_upcoming_bookings_is_refused(client, admin_token, clock):
    venue = make_venue(client, admin_token)
    token, _ = new_customer(client)
    court1, court2 = venue["courts"][0]["id"], venue["courts"][1]["id"]
    booking = book(client, token, venue, TUE, "18:00").json()
    client.post("/api/courts/admin/blocks", headers=auth(admin_token), json={
        "venueId": venue["id"], "courtId": court1, "weekdays": [0], "startTime": "06:00", "endTime": "07:00", "reason": "Coaching"})

    r = client.delete(f"/api/courts/admin/courts/{court1}", headers=auth(admin_token))
    assert r.status_code == 409
    assert r.json()["detail"] == f"Court 1 has 1 upcoming booking (the next is {booking['id']} on Tue 10 Nov 6:00–7:00 PM). Cancel it first, then delete."
    r = client.delete(f"/api/courts/admin/venues/{venue['id']}", headers=auth(admin_token))
    assert r.status_code == 409 and "Cancel it first" in r.json()["detail"]
    assert client.delete(f"/api/courts/admin/courts/{court2}", headers=auth(admin_token)).json() == {"success": True}

    # Once the booking is over (even if never marked), the court can go; the booking stays.
    clock.set(TUE, "19:00")
    assert client.delete(f"/api/courts/admin/courts/{court1}", headers=auth(admin_token)).json() == {"success": True}
    assert client.get(f"/api/courts/admin/venues/{venue['id']}/blocks", headers=auth(admin_token)).json() == []
    assert client.delete(f"/api/courts/admin/venues/{venue['id']}", headers=auth(admin_token)).json() == {"success": True}
    kept = client.get(f"/api/court-bookings/{booking['id']}", headers=auth(admin_token)).json()
    assert kept["venueName"] == venue["name"] and kept["courtName"] == "Court 1"
    assert client.get(f"/api/court-bookings/{booking['id']}", headers=auth(token)).status_code == 200

    # A cancelled booking doesn't hold a delete back.
    clock.set(MON, "09:00")
    venue2 = make_venue(client, admin_token, courts=("Court 1",))
    b2 = book(client, token, venue2, TUE, "18:00").json()
    cancel(client, token, b2["id"])
    assert client.delete(f"/api/courts/admin/venues/{venue2['id']}", headers=auth(admin_token)).status_code == 200


def test_admin_routes_need_an_admin(client, admin_token, employee_token):
    venue = make_venue(client, admin_token, courts=("Court 1",))
    token, _ = new_customer(client)
    booking = book(client, token, venue, TUE, "18:00").json()
    court = venue["courts"][0]["id"]
    calls = [
        ("get", "/api/courts/admin/venues", None),
        ("post", "/api/courts/admin/venues", venue_payload()),
        ("put", f"/api/courts/admin/venues/{venue['id']}", {"name": "Hijacked"}),
        ("delete", f"/api/courts/admin/venues/{venue['id']}", None),
        ("post", f"/api/courts/admin/venues/{venue['id']}/courts", {"name": "Court 9"}),
        ("put", f"/api/courts/admin/courts/{court}", {"name": "Court 9"}),
        ("delete", f"/api/courts/admin/courts/{court}", None),
        ("get", f"/api/courts/admin/venues/{venue['id']}/blocks", None),
        ("post", "/api/courts/admin/blocks", {"venueId": venue["id"], "date": TUE.isoformat(), "startTime": "06:00",
                                              "endTime": "07:00", "reason": "Nope"}),
        ("delete", "/api/courts/admin/blocks/BLK-x", None),
        ("patch", f"/api/court-bookings/{booking['id']}/status", {"status": "Completed"}),
        ("post", f"/api/court-bookings/{booking['id']}/payment", {"amount": 400, "method": "Cash"}),
    ]
    for method, url, body in calls:
        kwargs = {"json": body} if body is not None else {}
        assert getattr(client, method)(url, **kwargs).status_code == 401, url
        assert getattr(client, method)(url, headers=auth(token), **kwargs).status_code == 403, url
        assert getattr(client, method)(url, headers=auth(employee_token), **kwargs).status_code == 403, url
    assert cancel(client, employee_token, booking["id"]).status_code == 403
    # Nothing changed.
    assert client.get(f"/api/court-bookings/{booking['id']}", headers=auth(token)).json()["status"] == "Confirmed"
    assert next(v for v in client.get("/api/courts/venues").json() if v["id"] == venue["id"])["name"] == venue["name"]
