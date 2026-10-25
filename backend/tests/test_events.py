"""Events API: admin CRUD + validation, public listing, computed fields and registrations.

Shares the throwaway SQLite database and fixtures of tests/test_platform.py (importing it
first sets the test environment variables before the app is loaded).
"""
from datetime import timedelta

import pytest

from tests.test_platform import _reset_rate_limits, admin_token, auth, client, customer_token  # noqa: F401
from app.services.content_service import business_today

TODAY = business_today()


def day(offset: int) -> str:
    return (TODAY + timedelta(days=offset)).isoformat()


def event_payload(**extra):
    payload = {
        "title": "Test Doubles Open",
        "category": "tournament",
        "summary": "Weekend doubles",
        "startDate": day(10),
        "venue": "Indoor courts, MVP Colony",
        "entryFee": 600,
        "feeNote": "per pair",
        "categories": ["Men's Doubles", "Mixed Doubles"],
        "registrationMode": "form",
        "bannerImageUrl": "/images/site/events/tournament.webp",
        "showAsBanner": True,
        "isActive": True,
    }
    payload.update(extra)
    return payload


def create_event(client, token, **extra):
    r = client.post("/api/content/admin/events", headers=auth(token), json=event_payload(**extra))
    assert r.status_code == 201, r.text
    return r.json()


def register(client, event_id, mobile="9876500001", **extra):
    body = {"name": "Ravi Kumar", "mobile": mobile, "playCategory": "Men's Doubles", **extra}
    return client.post(f"/api/content/events/{event_id}/register", json=body)


def public_ids(client, include_past=False):
    url = "/api/content/events" + ("?include_past=true" if include_past else "")
    r = client.get(url)
    assert r.status_code == 200, r.text
    return [e["id"] for e in r.json()]


def admin_event(client, token, event_id):
    return next(e for e in client.get("/api/content/admin/events", headers=auth(token)).json() if e["id"] == event_id)


# ---------------- Demo data ----------------

def test_demo_events_seeded_as_upcoming_banners(client):
    events = {e["title"]: e for e in client.get("/api/content/events").json()}
    tournament = events["GR Sports Doubles Tournament"]
    camp = events["Junior Badminton Coaching Camp"]
    assert tournament["status"] == "upcoming" and tournament["registrationMode"] == "form"
    assert tournament["registrationOpen"] is True and tournament["capacity"] == 64
    assert tournament["spotsLeft"] == 64 - tournament["registrationCount"]
    assert tournament["bannerImageUrl"] == "/images/site/events/tournament.webp"
    assert camp["registrationMode"] == "whatsapp" and camp["registrationOpen"] is True and camp["spotsLeft"] is None
    assert tournament["startDate"] > TODAY.isoformat() and camp["startDate"] > tournament["startDate"]


# ---------------- Admin CRUD & validation ----------------

def test_admin_event_crud(client, admin_token):
    event = create_event(client, admin_token, capacity=32, registrationDeadline=day(8), endDate=day(11))
    assert event["id"].startswith("EVT-")
    assert event["status"] == "upcoming" and event["registrationOpen"] is True
    assert event["registrationCount"] == 0 and event["spotsLeft"] == 32
    assert event["categories"] == ["Men's Doubles", "Mixed Doubles"]
    assert any(e["id"] == event["id"] for e in client.get("/api/content/admin/events", headers=auth(admin_token)).json())

    # Partial update keeps the other fields.
    r = client.put(f"/api/content/admin/events/{event['id']}", headers=auth(admin_token),
                   json={"title": "  Renamed   Open ", "capacity": None, "categories": ["U-15 Singles", "u-15 singles", " "]})
    assert r.status_code == 200, r.text
    updated = r.json()
    assert updated["title"] == "Renamed Open" and updated["capacity"] is None and updated["spotsLeft"] is None
    assert updated["categories"] == ["U-15 Singles"]  # trimmed + de-duplicated
    assert updated["venue"] == event["venue"] and updated["endDate"] == day(11) and updated["entryFee"] == 600

    r = client.delete(f"/api/content/admin/events/{event['id']}", headers=auth(admin_token))
    assert r.status_code == 200 and r.json()["success"] is True
    assert client.put(f"/api/content/admin/events/{event['id']}", headers=auth(admin_token), json={"title": "x"}).status_code == 404
    assert client.delete(f"/api/content/admin/events/{event['id']}", headers=auth(admin_token)).status_code == 404


@pytest.mark.parametrize("bad", [
    {"title": "   "},
    {"venue": ""},
    {"bannerImageUrl": ""},
    {"bannerImageUrl": "javascript:alert(1)"},
    {"mobileImageUrl": "data:image/png;base64,AAAA"},
    {"venueMapUrl": "javascript:alert(1)"},
    {"startDate": "14/11/2026"},
    {"startDate": "2026-13-40"},
    {"endDate": day(5)},  # before the start date (day 10)
    {"registrationDeadline": day(12)},  # after the (single) event day
    {"registrationMode": "url"},  # needs a link
    {"registrationMode": "url", "registrationUrl": "http://example.com/register"},  # not https
    {"registrationMode": "url", "registrationUrl": "/register"},  # must be a full link
    {"entryFee": -1},
    {"capacity": 0},
    {"categories": ["x" * 41]},
    {"categories": [f"Cat {i}" for i in range(13)]},
    {"title": "x" * 121},
    {"category": "party"},
    {"registrationMode": "email"},
])
def test_event_validation(client, admin_token, bad):
    r = client.post("/api/content/admin/events", headers=auth(admin_token), json=event_payload(**bad))
    assert r.status_code == 422, r.text


def test_event_accepts_site_paths_https_and_url_mode(client, admin_token):
    event = create_event(
        client, admin_token,
        bannerImageUrl="https://cdn.example.com/banner.webp",
        mobileImageUrl="/images/site/events/tournament-phone.webp",
        venueMapUrl="https://maps.google.com/?q=MVP+Colony",
        registrationMode="url", registrationUrl="https://forms.example.com/gr-open",
        endDate=day(10), registrationDeadline=day(10), entryFee=0,
    )
    assert event["registrationOpen"] is True and event["registrationUrl"] == "https://forms.example.com/gr-open"
    assert event["spotsLeft"] is None  # only website registrations are counted
    client.delete(f"/api/content/admin/events/{event['id']}", headers=auth(admin_token))


def test_update_validates_merged_event_and_keeps_old_values(client, admin_token):
    event = create_event(client, admin_token, endDate=day(11))
    path = f"/api/content/admin/events/{event['id']}"
    assert client.put(path, headers=auth(admin_token), json={"startDate": day(12)}).status_code == 422  # after endDate
    assert client.put(path, headers=auth(admin_token), json={"registrationMode": "url"}).status_code == 422
    assert client.put(path, headers=auth(admin_token), json={"bannerImageUrl": None}).status_code == 422
    assert client.put(path, headers=auth(admin_token), json={"title": None}).status_code == 422
    stored = admin_event(client, admin_token, event["id"])
    assert stored["startDate"] == day(10) and stored["registrationMode"] == "form" and stored["title"] == event["title"]
    # Explicit nulls for always-present fields are ignored rather than wiping them.
    r = client.put(path, headers=auth(admin_token), json={"isActive": None, "categories": None, "endDate": None})
    assert r.status_code == 200 and r.json()["isActive"] is True and r.json()["categories"] == event["categories"]
    assert r.json()["endDate"] is None
    client.delete(path, headers=auth(admin_token))


# ---------------- Public listing & computed fields ----------------

def test_public_list_hides_drafts_and_past(client, admin_token):
    live = create_event(client, admin_token, title="Live event")
    draft = create_event(client, admin_token, title="Draft event", isActive=False)
    recent_past = create_event(client, admin_token, title="Recent past", startDate=day(-10), endDate=day(-5))
    old_past = create_event(client, admin_token, title="Old past", startDate=day(-200))
    ongoing = create_event(client, admin_token, title="Ongoing camp", startDate=day(-1), endDate=day(1), sortOrder=-5)

    ids = public_ids(client)
    assert live["id"] in ids and ongoing["id"] in ids
    assert draft["id"] not in ids and recent_past["id"] not in ids and old_past["id"] not in ids

    with_past = public_ids(client, include_past=True)
    assert recent_past["id"] in with_past and old_past["id"] not in with_past and draft["id"] not in with_past

    events = client.get("/api/content/events?include_past=true").json()
    starts = [e["startDate"] for e in events]
    assert starts == sorted(starts)  # soonest first
    by_id = {e["id"]: e for e in events}
    assert by_id[recent_past["id"]]["status"] == "past" and by_id[recent_past["id"]]["registrationOpen"] is False
    assert by_id[ongoing["id"]]["status"] == "ongoing"
    assert by_id[live["id"]]["status"] == "upcoming"

    admin_ids = [e["id"] for e in client.get("/api/content/admin/events", headers=auth(admin_token)).json()]
    assert {live["id"], draft["id"], recent_past["id"], old_past["id"], ongoing["id"]} <= set(admin_ids)
    assert admin_event(client, admin_token, draft["id"])["registrationOpen"] is False

    for e in (live, draft, recent_past, old_past, ongoing):
        client.delete(f"/api/content/admin/events/{e['id']}", headers=auth(admin_token))


def test_computed_registration_open(client, admin_token):
    cases = [
        # (overrides, status, registrationOpen)
        ({"registrationDeadline": day(-1), "startDate": day(5)}, "upcoming", False),  # deadline passed
        ({"registrationMode": "none"}, "upcoming", False),
        ({"registrationMode": "whatsapp", "capacity": 10}, "upcoming", True),
        ({"registrationMode": "phone"}, "upcoming", True),
        ({"startDate": day(-1), "endDate": day(2)}, "ongoing", False),  # no deadline = until the start date
        ({"startDate": day(-1), "endDate": day(2), "registrationDeadline": day(2)}, "ongoing", True),
        ({"startDate": day(0)}, "ongoing", True),  # single-day event today
    ]
    for overrides, expected_status, expected_open in cases:
        event = create_event(client, admin_token, **overrides)
        assert (event["status"], event["registrationOpen"]) == (expected_status, expected_open), overrides
        if overrides.get("registrationMode") == "whatsapp":
            assert event["spotsLeft"] is None and event["capacity"] == 10
        client.delete(f"/api/content/admin/events/{event['id']}", headers=auth(admin_token))


def test_site_bundle_includes_public_events(client, admin_token):
    live = create_event(client, admin_token, title="Bundle live")
    draft = create_event(client, admin_token, title="Bundle draft", isActive=False)
    body = client.get("/api/content/site").json()
    ids = [e["id"] for e in body["events"]]
    assert live["id"] in ids and draft["id"] not in ids
    assert {"status", "registrationOpen", "registrationCount", "spotsLeft"} <= set(body["events"][0])
    assert ids == public_ids(client)
    for e in (live, draft):
        client.delete(f"/api/content/admin/events/{e['id']}", headers=auth(admin_token))


# ---------------- Registrations ----------------

def test_registration_happy_path_notifies_admin(client, admin_token):
    event = create_event(client, admin_token, title="Happy Path Open", capacity=3)
    r = register(client, event["id"], mobile="+91 98765-43210", name="  Lakshmi   Devi ",
                 partnerName="Sita", playCategory="mixed doubles", notes="Prefer Saturday\nmorning")
    assert r.status_code == 201, r.text
    reg = r.json()
    assert reg["mobile"] == "+919876543210" and reg["name"] == "Lakshmi Devi"
    assert reg["playCategory"] == "Mixed Doubles" and reg["status"] == "registered"
    assert reg["notes"] == "Prefer Saturday\nmorning" and reg["eventId"] == event["id"]

    updated = admin_event(client, admin_token, event["id"])
    assert updated["registrationCount"] == 1 and updated["spotsLeft"] == 2 and updated["registrationOpen"] is True

    regs = client.get(f"/api/content/admin/events/{event['id']}/registrations", headers=auth(admin_token)).json()
    assert [x["id"] for x in regs] == [reg["id"]]

    notes = client.get("/api/notifications", headers=auth(admin_token)).json()
    assert any(
        "New registration for Happy Path Open: Lakshmi Devi (+91 98765 43210)" in n["message"] and n["targetRoles"] == ["ADMIN"]
        for n in notes
    )
    client.delete(f"/api/content/admin/events/{event['id']}", headers=auth(admin_token))


def test_duplicate_mobile_rejected(client, admin_token):
    event = create_event(client, admin_token)
    assert register(client, event["id"], mobile="9000011111").status_code == 201
    r = register(client, event["id"], mobile="+91 90000 11111", name="Someone Else")  # same category
    assert r.status_code == 409 and "already registered" in r.json()["detail"]
    # The same player may also enter a different category.
    other = register(client, event["id"], mobile="9000011111", playCategory="Mixed Doubles")
    assert other.status_code == 201, other.text
    client.patch(f"/api/content/admin/event-registrations/{other.json()['id']}", headers=auth(admin_token), json={"status": "cancelled"})
    # A cancelled registration doesn't block registering again.
    first = client.get(f"/api/content/admin/events/{event['id']}/registrations", headers=auth(admin_token)).json()[0]
    r = client.patch(f"/api/content/admin/event-registrations/{first['id']}", headers=auth(admin_token), json={"status": "cancelled"})
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    assert register(client, event["id"], mobile="9000011111").status_code == 201
    # ...but the old one can't then be restored alongside the new one.
    r = client.patch(f"/api/content/admin/event-registrations/{first['id']}", headers=auth(admin_token), json={"status": "registered"})
    assert r.status_code == 409
    client.delete(f"/api/content/admin/events/{event['id']}", headers=auth(admin_token))


def test_full_event_rejects_and_reopens_after_cancel(client, admin_token):
    event = create_event(client, admin_token, capacity=1)
    first = register(client, event["id"], mobile="9000022221")
    assert first.status_code == 201
    r = register(client, event["id"], mobile="9000022222")
    assert r.status_code == 409 and r.json()["detail"] == "Registrations are full"
    full = admin_event(client, admin_token, event["id"])
    assert full["registrationOpen"] is False and full["spotsLeft"] == 0 and full["registrationCount"] == 1

    r = client.patch(f"/api/content/admin/event-registrations/{first.json()['id']}", headers=auth(admin_token),
                     json={"status": "cancelled"})
    assert r.status_code == 200
    reopened = admin_event(client, admin_token, event["id"])
    assert reopened["registrationOpen"] is True and reopened["spotsLeft"] == 1 and reopened["registrationCount"] == 0
    assert register(client, event["id"], mobile="9000022222").status_code == 201

    assert client.patch("/api/content/admin/event-registrations/REG-missing", headers=auth(admin_token),
                        json={"status": "cancelled"}).status_code == 404
    assert client.patch(f"/api/content/admin/event-registrations/{first.json()['id']}", headers=auth(admin_token),
                        json={"status": "maybe"}).status_code == 422
    client.delete(f"/api/content/admin/events/{event['id']}", headers=auth(admin_token))


def test_closed_past_and_hidden_events_reject_registration(client, admin_token):
    closed = create_event(client, admin_token, registrationDeadline=day(-1), startDate=day(3))
    r = register(client, closed["id"])
    assert r.status_code == 409 and "closed" in r.json()["detail"]

    past = create_event(client, admin_token, startDate=day(-3))
    assert register(client, past["id"]).status_code == 409

    hidden = create_event(client, admin_token, isActive=False)
    assert register(client, hidden["id"]).status_code == 404
    assert register(client, "EVT-does-not-exist").status_code == 404

    for e in (closed, past, hidden):
        client.delete(f"/api/content/admin/events/{e['id']}", headers=auth(admin_token))


def test_registration_category_rules(client, admin_token):
    event = create_event(client, admin_token)
    r = register(client, event["id"], playCategory="Women's Doubles")
    assert r.status_code == 422 and "Men's Doubles" in r.json()["detail"]
    assert register(client, event["id"], playCategory=None).status_code == 422
    assert register(client, event["id"], playCategory="").status_code == 422

    open_event = create_event(client, admin_token, categories=[])
    r = register(client, open_event["id"], playCategory="Anything")
    assert r.status_code == 201 and r.json()["playCategory"] is None
    for e in (event, open_event):
        client.delete(f"/api/content/admin/events/{e['id']}", headers=auth(admin_token))


@pytest.mark.parametrize("mode,phrase", [("whatsapp", "WhatsApp"), ("phone", "call"), ("url", "link"), ("none", "doesn't need")])
def test_registration_only_for_form_mode(client, admin_token, mode, phrase):
    extra = {"registrationUrl": "https://forms.example.com/x"} if mode == "url" else {}
    event = create_event(client, admin_token, registrationMode=mode, **extra)
    r = register(client, event["id"])
    assert r.status_code == 409 and phrase in r.json()["detail"]
    client.delete(f"/api/content/admin/events/{event['id']}", headers=auth(admin_token))


@pytest.mark.parametrize("bad", [
    {"name": "R"},
    {"name": "   "},
    {"name": "x" * 81},
    {"mobile": "12345"},
    {"mobile": "5876543210"},
    {"partnerName": "p" * 81},
    {"notes": "n" * 501},
])
def test_registration_field_validation(client, admin_token, bad):
    event = create_event(client, admin_token)
    r = register(client, event["id"], **bad)
    assert r.status_code == 422, r.text
    client.delete(f"/api/content/admin/events/{event['id']}", headers=auth(admin_token))


def test_registration_rate_limited_per_ip(client, admin_token):
    event = create_event(client, admin_token, categories=[])
    codes = [register(client, event["id"], mobile=f"90000333{i:02d}").status_code for i in range(31)]
    assert codes[:30] == [201] * 30 and codes[30] == 429
    client.delete(f"/api/content/admin/events/{event['id']}", headers=auth(admin_token))


def test_delete_event_cascades_registrations(client, admin_token):
    from app.database import SessionLocal
    from app.models import EventRegistrationModel

    event = create_event(client, admin_token)
    assert register(client, event["id"], mobile="9000044441").status_code == 201
    assert register(client, event["id"], mobile="9000044442").status_code == 201
    r = client.delete(f"/api/content/admin/events/{event['id']}", headers=auth(admin_token))
    assert r.status_code == 200 and r.json() == {"success": True, "deletedRegistrations": 2}
    db = SessionLocal()
    try:
        assert db.query(EventRegistrationModel).filter(EventRegistrationModel.eventId == event["id"]).count() == 0
    finally:
        db.close()
    assert client.get(f"/api/content/admin/events/{event['id']}/registrations", headers=auth(admin_token)).status_code == 404


# ---------------- Access control ----------------

def test_event_admin_endpoints_need_admin(client, admin_token):
    event = create_event(client, admin_token)
    reg = register(client, event["id"], mobile="9000055551").json()
    endpoints = [
        ("get", "/api/content/admin/events", None),
        ("post", "/api/content/admin/events", event_payload()),
        ("put", f"/api/content/admin/events/{event['id']}", {"title": "Hacked"}),
        ("delete", f"/api/content/admin/events/{event['id']}", None),
        ("get", f"/api/content/admin/events/{event['id']}/registrations", None),
        ("patch", f"/api/content/admin/event-registrations/{reg['id']}", {"status": "cancelled"}),
    ]
    customer = customer_token(client, "9000055552")
    for method, url, body in endpoints:
        kwargs = {"json": body} if body is not None else {}
        assert getattr(client, method)(url, **kwargs).status_code == 401, url
        assert getattr(client, method)(url, headers=auth(customer), **kwargs).status_code == 403, url
    # Nothing changed.
    stored = admin_event(client, admin_token, event["id"])
    assert stored["title"] == event["title"] and stored["registrationCount"] == 1
    client.delete(f"/api/content/admin/events/{event['id']}", headers=auth(admin_token))
