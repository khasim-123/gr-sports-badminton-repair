"""GR website map features: academies, enquiries (academy slots, tournament organizing, custom
T-shirts), footer pages, social links + footer highlights, second-hand rackets and the lower
banner spots.

Shares the throwaway SQLite database and fixtures of tests/test_platform.py (importing it first
sets the test environment variables before the app is loaded).

Run from backend/:  python -m pytest -q tests/test_website_map.py
"""
import itertools
from datetime import timedelta

from tests.test_platform import client, admin_token, auth  # noqa: F401
from app.services.content_service import business_today

_numbers = itertools.count(1)


def _mobile() -> str:
    return f"98{next(_numbers):08d}"


def _academy(client, admin_token, **extra):
    body = {"name": "Shuttle Stars Academy", "area": "MVP Colony", "batches": ["Mon–Fri 6:00–7:30 AM", "Sat–Sun 4:00–6:00 PM"], **extra}
    r = client.post("/api/content/admin/academies", headers=auth(admin_token), json=body)
    assert r.status_code == 201, r.text
    return r.json()


# ---------------- Academies ----------------

def test_academies_need_admin_and_show_only_when_active(client, admin_token):
    assert client.post("/api/content/admin/academies", json={"name": "X", "area": "Y"}).status_code in (401, 403)
    assert client.get("/api/content/admin/academies").status_code in (401, 403)

    shown = _academy(client, admin_token, name="Visible Academy")
    hidden = _academy(client, admin_token, name="Hidden Academy", isActive=False)
    public = {a["id"] for a in client.get("/api/content/academies").json()}
    assert shown["id"] in public and hidden["id"] not in public
    site = {a["id"] for a in client.get("/api/content/site").json()["academies"]}
    assert shown["id"] in site and hidden["id"] not in site

    r = client.put(f"/api/content/admin/academies/{hidden['id']}", headers=auth(admin_token), json={"isActive": True, "fee": "₹2,000 a month"})
    assert r.status_code == 200 and r.json()["isActive"] and r.json()["fee"] == "₹2,000 a month"
    for a in (shown, hidden):
        assert client.delete(f"/api/content/admin/academies/{a['id']}", headers=auth(admin_token)).status_code == 200


def test_academy_validation(client, admin_token):
    post = lambda body: client.post("/api/content/admin/academies", headers=auth(admin_token), json=body)
    assert post({"name": "A", "area": "MVP Colony"}).status_code == 422  # name too short
    assert post({"name": "Good Academy", "area": ""}).status_code == 422
    assert post({"name": "Good Academy", "area": "MVP", "mapsUrl": "javascript:alert(1)"}).status_code == 422
    assert post({"name": "Good Academy", "area": "MVP", "batches": ["x" * 81]}).status_code == 422
    assert post({"name": "Good Academy", "area": "MVP", "batches": [f"Batch {i}" for i in range(13)]}).status_code == 422
    # Duplicate batches (ignoring case and spaces) collapse into one.
    r = post({"name": "Good Academy", "area": "MVP", "batches": ["Morning  6 AM", "morning 6 am", " "]})
    assert r.status_code == 201 and r.json()["batches"] == ["Morning 6 AM"]
    client.delete(f"/api/content/admin/academies/{r.json()['id']}", headers=auth(admin_token))


# ---------------- Enquiries ----------------

def test_academy_enquiry_checks_the_academy_and_batch(client, admin_token):
    academy = _academy(client, admin_token)
    post = lambda body: client.post("/api/enquiries", json={"kind": "academy", "name": "Ravi Kumar", **body})
    assert post({"mobile": _mobile(), "academyId": "ACD-missing", "batch": "Sat–Sun 4:00–6:00 PM"}).status_code == 404
    assert post({"mobile": _mobile(), "academyId": academy["id"], "batch": "Midnight"}).status_code == 422
    past = (business_today() - timedelta(days=1)).isoformat()
    assert post({"mobile": _mobile(), "academyId": academy["id"], "batch": "Sat–Sun 4:00–6:00 PM", "date": past}).status_code == 422

    mobile = _mobile()
    soon = (business_today() + timedelta(days=3)).isoformat()
    r = post({"mobile": mobile, "academyId": academy["id"], "batch": "sat–sun 4:00–6:00 pm", "date": soon, "department": "trophies"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["subject"] == "Shuttle Stars Academy" and body["batch"] == "Sat–Sun 4:00–6:00 PM"  # stored as listed
    assert body["status"] == "new" and body["department"] is None  # fields of other kinds are dropped
    assert body["mobile"].endswith(mobile)

    # The same request again is refused politely.
    again = post({"mobile": mobile, "academyId": academy["id"], "batch": "Sat–Sun 4:00–6:00 PM"})
    assert again.status_code == 409 and body["id"] in again.json()["detail"]
    client.delete(f"/api/content/admin/academies/{academy['id']}", headers=auth(admin_token))


def test_tournament_and_custom_tshirt_enquiries(client):
    post = lambda body: client.post("/api/enquiries", json={"name": "Anitha", "mobile": _mobile(), **body})
    assert post({"kind": "tournament"}).status_code == 422  # department needed
    r = post({"kind": "tournament", "department": "umpire", "location": "Port Stadium", "notes": "Two courts, one day"})
    assert r.status_code == 201 and r.json()["subject"] == "Umpires" and r.json()["location"] == "Port Stadium"

    assert post({"kind": "custom_tshirt"}).status_code == 422  # a quantity or a description
    assert post({"kind": "custom_tshirt", "quantity": 0}).status_code == 422
    assert post({"kind": "custom_tshirt", "quantity": 5001}).status_code == 422
    r = post({"kind": "custom_tshirt", "quantity": 25, "notes": "Names on the back"})
    assert r.status_code == 201 and r.json()["subject"] == "Custom T-shirts" and r.json()["quantity"] == 25
    assert post({"kind": "custom_tshirt", "notes": "About 40, sizes to follow"}).status_code == 201


def test_enquiry_form_rules(client):
    post = lambda body: client.post("/api/enquiries", json={"kind": "tournament", "department": "dress", **body})
    assert post({"name": "A", "mobile": _mobile()}).status_code == 422  # name too short
    assert post({"name": "Anitha", "mobile": "12345"}).status_code == 422
    assert post({"name": "Anitha", "mobile": _mobile(), "notes": "x" * 1001}).status_code == 422
    far = (business_today() + timedelta(days=400)).isoformat()
    assert post({"name": "Anitha", "mobile": _mobile(), "date": far}).status_code == 422
    assert client.post("/api/enquiries", json={"kind": "resell", "name": "Anitha", "mobile": _mobile()}).status_code == 422


def test_enquiries_are_limited_per_number(client):
    mobile = _mobile()
    departments = ["umpire", "dress", "trophies", "refreshments", "other"]
    for dep in departments:
        assert client.post("/api/enquiries", json={"kind": "tournament", "department": dep, "name": "Anitha", "mobile": mobile}).status_code == 201
    r = client.post("/api/enquiries", json={"kind": "custom_tshirt", "quantity": 10, "name": "Anitha", "mobile": mobile})
    assert r.status_code == 429


def test_admin_inbox_filters_and_updates(client, admin_token):
    assert client.get("/api/admin/enquiries").status_code in (401, 403)
    r = client.post("/api/enquiries", json={"kind": "custom_tshirt", "quantity": 12, "name": "Inbox Test", "mobile": _mobile()})
    enquiry = r.json()

    shirts = client.get("/api/admin/enquiries?kind=custom_tshirt", headers=auth(admin_token)).json()
    assert shirts and all(e["kind"] == "custom_tshirt" for e in shirts) and shirts[0]["id"] == enquiry["id"]  # newest first

    r = client.patch(f"/api/admin/enquiries/{enquiry['id']}", headers=auth(admin_token), json={"status": "contacted", "adminNote": "Called, sending designs"})
    assert r.status_code == 200 and r.json()["status"] == "contacted" and r.json()["adminNote"] == "Called, sending designs"
    contacted = client.get("/api/admin/enquiries?status=contacted", headers=auth(admin_token)).json()
    assert enquiry["id"] in {e["id"] for e in contacted}
    assert client.patch("/api/admin/enquiries/ENQ-0", headers=auth(admin_token), json={"status": "closed"}).status_code == 404
    assert client.patch(f"/api/admin/enquiries/{enquiry['id']}", headers=auth(admin_token), json={"status": "lost"}).status_code == 422

    # Admins are told about new enquiries.
    notes = client.get("/api/notifications", headers=auth(admin_token)).json()
    items = notes["items"] if isinstance(notes, dict) else notes
    assert any(enquiry["id"] in (n.get("message") or "") for n in items)


# ---------------- Footer pages ----------------

def test_footer_pages_show_only_with_text(client, admin_token):
    assert client.get("/api/content/admin/pages").status_code in (401, 403)
    pages = client.get("/api/content/admin/pages", headers=auth(admin_token)).json()
    assert [p["slug"] for p in pages] == [
        "about", "promise", "local-pickup", "express-stringing", "shuttlers-talk",
        "shipping", "returns", "terms", "payments", "stringing-guide",
    ]
    assert all(p["body"] == "" for p in pages)  # nothing is written for the shop
    assert client.get("/api/content/site").json()["pages"] == []

    r = client.put("/api/content/admin/pages/shipping", headers=auth(admin_token), json={"title": "Shipping", "body": "We deliver in Visakhapatnam.\n\nOrders ship in 2 days."})
    assert r.status_code == 200
    public = client.get("/api/content/site").json()["pages"]
    assert [p["slug"] for p in public] == ["shipping"] and "Orders ship" in public[0]["body"]

    assert client.put("/api/content/admin/pages/blog", headers=auth(admin_token), json={"title": "Blog", "body": "x"}).status_code == 404
    assert client.put("/api/content/admin/pages/terms", headers=auth(admin_token), json={"title": "", "body": "x"}).status_code == 422
    client.put("/api/content/admin/pages/shipping", headers=auth(admin_token), json={"title": "Shipping", "body": ""})
    assert client.get("/api/content/site").json()["pages"] == []


# ---------------- Shop settings: social links and footer highlights ----------------

def test_social_links_and_footer_highlights(client, admin_token):
    shop = client.get("/api/config/shop").json()
    assert len(shop["footerHighlights"]) == 3 and shop["instagramUrl"] in (None, "")
    put = lambda extra: client.put("/api/config/shop", headers=auth(admin_token), json={**shop, **extra})
    r = put({"instagramUrl": "https://instagram.com/grsports", "footerHighlights": ["Same-day stringing on weekdays"]})
    assert r.status_code == 200 and r.json()["instagramUrl"] == "https://instagram.com/grsports"
    assert client.get("/api/content/site").json()["shop"]["footerHighlights"] == ["Same-day stringing on weekdays"]
    assert put({"youtubeUrl": "http://youtube.com/x"}).status_code == 422  # https only
    assert put({"footerHighlights": ["a", "b", "c", "d"]}).status_code == 422
    assert put({"footerHighlights": ["x" * 121]}).status_code == 422
    put({})  # restore


# ---------------- Second-hand rackets and the lower banner spots ----------------

def test_second_hand_rackets(client, admin_token):
    base = {"brand": "Yonex", "images": [], "inStock": True, "isFeatured": False, "isActive": True}
    new = client.post("/api/content/admin/rackets", headers=auth(admin_token), json={**base, "name": "Brand New"}).json()
    used = client.post("/api/content/admin/rackets", headers=auth(admin_token), json={**base, "name": "Used One", "condition": "used"}).json()
    assert new["condition"] == "new" and used["condition"] == "used"
    assert client.post("/api/content/admin/rackets", headers=auth(admin_token), json={**base, "name": "Bad", "condition": "refurb"}).status_code == 422
    conditions = {r["id"]: r["condition"] for r in client.get("/api/content/rackets").json()}
    assert conditions[new["id"]] == "new" and conditions[used["id"]] == "used"
    for r in (new, used):
        client.delete(f"/api/content/admin/rackets/{r['id']}", headers=auth(admin_token))


def test_lower_promo_and_announcement_spots(client, admin_token):
    post = lambda body: client.post("/api/content/admin/banners", headers=auth(admin_token), json=body)
    assert post({"title": "Lower promo", "placement": "promo2"}).status_code == 422  # photo needed
    promo = post({"title": "Lower promo", "placement": "promo2", "desktopImageUrl": "/images/site/hero.webp"})
    note = post({"title": "Lower notice", "placement": "announcement2"})  # text only is fine
    assert promo.status_code == 201 and note.status_code == 201
    placements = {b["id"]: b["placement"] for b in client.get("/api/content/site").json()["banners"]}
    assert placements[promo.json()["id"]] == "promo2" and placements[note.json()["id"]] == "announcement2"
    for b in (promo, note):
        client.delete(f"/api/content/admin/banners/{b.json()['id']}", headers=auth(admin_token))
