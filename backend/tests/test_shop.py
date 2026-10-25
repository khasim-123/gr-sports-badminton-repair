"""Shop API: apparel catalogue (admin CRUD, validation, public listing), cart quotes, orders
(stock, race safety, status flow, payment, cancellation), customer isolation and the
notifications each side sees.

Shares the throwaway SQLite database and fixtures of tests/test_platform.py (importing it
first sets the test environment variables before the app is loaded).

Run from backend/:  python -m pytest -q tests/test_shop.py
"""
import itertools
import re

import pytest

from tests.test_platform import client, admin_token, auth, customer_token, booking, otp_login  # noqa: F401
from app.database import SessionLocal
from app.models import ApparelVariantModel, OrderModel
from app.routers import shop as shop_router
from app.security import rate_limiter
from app.services.pricing_service import road_distance_km
from app.services.shop_settings import display_phone as shop_display_phone, get_shop_settings

_numbers = itertools.count(1)


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    rate_limiter._hits.clear()


# ---------------- Helpers ----------------

def new_customer(client, name="Shop Customer"):
    phone = f"87{next(_numbers):08d}"
    return customer_token(client, phone, name), f"+91{phone}"


@pytest.fixture(scope="module")
def employee_token(client, admin_token):
    r = client.post("/api/employees", headers=auth(admin_token),
                    json={"name": "Shop Test Staff", "phone": "7300000001", "userRole": "EMPLOYEE", "password": "staff-pass-123"})
    assert r.status_code == 201, r.text
    r = client.post("/api/auth/login", json={"phone": "7300000001", "password": "staff-pass-123", "role": "EMPLOYEE"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_name(client):
    r = client.post("/api/auth/login", json={"phone": "+919848022338", "password": "correct-horse-1", "role": "ADMIN"})
    return r.json()["name"] or r.json()["mobile"]


@pytest.fixture(scope="module")
def pricing(client, admin_token):
    """A known delivery pricing config for this module (restored afterwards)."""
    original = client.get("/api/config/distance").json()
    config = {**original, "freeRadiusKm": 10, "perKmRateBeyondFree": 15, "pricingMethod": "PER_KM",
              "maxServiceDistanceKm": 35, "slabs": []}
    r = client.put("/api/config/distance", headers=auth(admin_token), json=config)
    assert r.status_code == 200, r.text
    yield r.json()
    client.put("/api/config/distance", headers=auth(admin_token), json=original)


def product_payload(**extra):
    payload = {
        "name": "Training T-shirt",
        "category": "t-shirt",
        "description": None,
        "fabric": "Polyester",
        "fit": "Regular fit",
        "price": 399,
        "images": ["/images/apparel/tee-white.webp"],
        "customisable": False,
        "isFeatured": False,
        "isActive": True,
    }
    payload.update(extra)
    return payload


def make_product(client, token, variants=(("M", "Navy", 5),), **extra):
    r = client.post("/api/shop/admin/apparel", headers=auth(token), json=product_payload(**extra))
    assert r.status_code == 201, r.text
    product = r.json()
    created = []
    for size, colour, stock in variants:
        r = client.post(f"/api/shop/admin/apparel/{product['id']}/variants", headers=auth(token),
                        json={"size": size, "colour": colour, "colourHex": "#1F2A44", "stock": stock})
        assert r.status_code == 201, r.text
        created.append(r.json())
    return product, created


def make_racket(client, token, **extra):
    body = {"brand": "Yonex", "name": "Shop Test Racket", "price": 4500, "inStock": True, "isActive": True,
            "images": ["/images/rackets/test.webp"], **extra}
    r = client.post("/api/content/admin/rackets", headers=auth(token), json=body)
    assert r.status_code == 201, r.text
    return r.json()


def make_string(client, token, price=650, colours=(("Black", True), ("Red", False))):
    r = client.post("/api/content/admin/strings", headers=auth(token),
                    json={"brand": "Hundred", "name": "Shop Test 66", "price": price})
    assert r.status_code == 201, r.text
    product = r.json()
    variants = []
    for colour, in_stock in colours:
        r = client.post(f"/api/content/admin/strings/{product['id']}/variants", headers=auth(token),
                        json={"colour": colour, "inStock": in_stock, "imageUrl": f"/images/strings/{colour.lower()}.webp"})
        assert r.status_code == 201, r.text
        variants.append(r.json())
    return product, variants


def line(kind, product_id, variant_id=None, quantity=1, **extra):
    return {"kind": kind, "productId": product_id, "variantId": variant_id, "quantity": quantity, **extra}


ADDRESS = {"houseFlat": "12-3", "street": "Beach Rd", "area": "MVP Colony", "city": "Visakhapatnam",
           "state": "Andhra Pradesh", "pincode": "530017", "distanceKm": 4}


def place(client, token, items, fulfilment="pickup", address=None, notes=None):
    body = {"items": items, "fulfilment": fulfilment}
    if address is not None:
        body["address"] = address
    if notes is not None:
        body["notes"] = notes
    return client.post("/api/orders", headers=auth(token), json=body)


def stock_of(variant_id):
    with SessionLocal() as db:
        return db.query(ApparelVariantModel.stock).filter(ApparelVariantModel.id == variant_id).scalar()


def set_status(client, token, order_id, status, notes=None):
    return client.patch(f"/api/orders/{order_id}/status", headers=auth(token), json={"status": status, "notes": notes})


def pay(client, token, order_id, amount, method="UPI", notes=None):
    return client.post(f"/api/orders/{order_id}/payment", headers=auth(token),
                       json={"amount": amount, "method": method, "notes": notes})


def notifications(client, token):
    r = client.get("/api/notifications", headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()


def shop_phone():
    with SessionLocal() as db:
        return shop_display_phone(get_shop_settings(db)["phone"])


# ---------------- Catalogue ----------------

def test_demo_apparel_is_seeded_for_local_preview(client):
    products = {p["name"]: p for p in client.get("/api/shop/apparel").json()}
    tee = products["Dry-fit round neck T-shirt"]
    assert tee["price"] == 349 and tee["category"] == "t-shirt"
    assert tee["images"] == ["/images/apparel/tee-white.webp", "/images/apparel/model-white.webp"]
    assert tee["sizes"] == ["S", "M", "L", "XL", "XXL"]
    assert [c["colour"] for c in tee["colours"]] == ["White", "Black", "Navy"]
    assert any(v["stock"] == 0 for v in tee["variants"]) and tee["inStock"] is True
    assert products["Cotton crew neck T-shirt"]["price"] == 299
    assert [c["colour"] for c in products["Sports polo T-shirt"]["colours"]] == ["Coral", "Green", "Grey"]
    jersey = products["Custom team jersey (name & number)"]
    assert jersey["category"] == "jersey" and jersey["customisable"] is True and jersey["price"] == 599
    assert jersey["sizes"] == ["S", "M", "L", "XL"] and [c["colour"] for c in jersey["colours"]] == ["Red"]


def test_apparel_crud_and_public_visibility(client, admin_token):
    product, variants = make_product(client, admin_token, variants=(("M", "Navy", 3), ("L", "Navy", 0), ("M", "White", 0)),
                                     name="Crud Test Tee", sortOrder=900)
    assert product["inStock"] is False and product["variants"] == []  # variants added after creation
    listed = next(p for p in client.get("/api/shop/admin/apparel", headers=auth(admin_token)).json() if p["id"] == product["id"])
    assert listed["inStock"] is True
    assert listed["sizes"] == ["M", "L"]
    assert listed["colours"] == [{"colour": "Navy", "colourHex": "#1F2A44"}, {"colour": "White", "colourHex": "#1F2A44"}]
    assert [v["stock"] for v in listed["variants"]] == [3, 0, 0]

    public = client.get("/api/shop/apparel").json()
    assert product["id"] in [p["id"] for p in public]

    # Featured products come first, whatever their sort order.
    featured, _ = make_product(client, admin_token, variants=(), name="Featured Test Tee", isFeatured=True, sortOrder=999)
    ids = [p["id"] for p in client.get("/api/shop/apparel").json()]
    first_plain = next(i for i, p in enumerate(client.get("/api/shop/apparel").json()) if not p["isFeatured"])
    assert ids.index(featured["id"]) < first_plain

    # Edit: partial update keeps the other fields.
    r = client.put(f"/api/shop/admin/apparel/{product['id']}", headers=auth(admin_token), json={"price": 425, "fit": "Slim fit"})
    assert r.status_code == 200, r.text
    assert r.json()["price"] == 425 and r.json()["fit"] == "Slim fit" and r.json()["name"] == "Crud Test Tee"
    assert len(r.json()["variants"]) == 3

    # Variant stock edit and delete.
    r = client.put(f"/api/shop/admin/apparel-variants/{variants[1]['id']}", headers=auth(admin_token), json={"stock": 7})
    assert r.status_code == 200 and r.json()["stock"] == 7 and r.json()["size"] == "L"
    r = client.delete(f"/api/shop/admin/apparel-variants/{variants[2]['id']}", headers=auth(admin_token))
    assert r.status_code == 200 and r.json() == {"success": True}
    listed = next(p for p in client.get("/api/shop/admin/apparel", headers=auth(admin_token)).json() if p["id"] == product["id"])
    assert listed["colours"] == [{"colour": "Navy", "colourHex": "#1F2A44"}]

    # Hidden products disappear from the website but stay in the admin list.
    r = client.put(f"/api/shop/admin/apparel/{product['id']}", headers=auth(admin_token), json={"isActive": False})
    assert r.status_code == 200 and r.json()["isActive"] is False
    assert product["id"] not in [p["id"] for p in client.get("/api/shop/apparel").json()]
    assert product["id"] in [p["id"] for p in client.get("/api/shop/admin/apparel", headers=auth(admin_token)).json()]

    r = client.delete(f"/api/shop/admin/apparel/{product['id']}", headers=auth(admin_token))
    assert r.status_code == 200 and r.json() == {"success": True}
    assert client.put(f"/api/shop/admin/apparel/{product['id']}", headers=auth(admin_token), json={"price": 1}).status_code == 404
    assert client.put(f"/api/shop/admin/apparel-variants/{variants[0]['id']}", headers=auth(admin_token), json={"stock": 1}).status_code == 404
    client.delete(f"/api/shop/admin/apparel/{featured['id']}", headers=auth(admin_token))


@pytest.mark.parametrize("extra,message", [
    ({"name": "A"}, "at least 2"),
    ({"name": "x" * 81}, "at most 80"),
    ({"name": "   "}, "Name is required"),
    ({"category": "hat"}, None),
    ({"price": 0}, "more than"),
    ({"price": -10}, "more than"),
    ({"price": 100_001}, "1,00,000"),
    ({"images": [f"/images/apparel/{i}.webp" for i in range(7)]}, "at most 6"),
    ({"images": ["javascript:alert(1)"]}, "https://"),
    ({"images": ["http://example.com/a.webp"]}, "https://"),
    ({"description": "x" * 1001}, "at most 1000"),
])
def test_apparel_product_validation(client, admin_token, extra, message):
    r = client.post("/api/shop/admin/apparel", headers=auth(admin_token), json=product_payload(**extra))
    assert r.status_code == 422, r.text
    if message:
        assert message in r.json()["detail"]


def test_apparel_rejects_non_finite_numbers(client, admin_token):
    body = '{"name": "NaN Tee", "category": "t-shirt", "price": NaN, "images": []}'
    r = client.post("/api/shop/admin/apparel", headers={**auth(admin_token), "Content-Type": "application/json"}, content=body)
    assert r.status_code == 422
    body = '{"name": "Inf Tee", "category": "t-shirt", "price": Infinity, "images": []}'
    r = client.post("/api/shop/admin/apparel", headers={**auth(admin_token), "Content-Type": "application/json"}, content=body)
    assert r.status_code == 422


def test_apparel_update_validation(client, admin_token):
    product, _ = make_product(client, admin_token, variants=(), name="Update Validation Tee")
    url = f"/api/shop/admin/apparel/{product['id']}"
    assert client.put(url, headers=auth(admin_token), json={"price": 0}).status_code == 422
    assert client.put(url, headers=auth(admin_token), json={"name": "B"}).status_code == 422
    assert client.put(url, headers=auth(admin_token), json={"images": ["data:text/html,hi"]}).status_code == 422
    # null for a required field is ignored rather than wiping it
    r = client.put(url, headers=auth(admin_token), json={"name": None, "price": None})
    assert r.status_code == 200 and r.json()["name"] == "Update Validation Tee" and r.json()["price"] == 399
    client.delete(url, headers=auth(admin_token))


@pytest.mark.parametrize("body,status_code", [
    ({"size": "", "colour": "Navy", "stock": 1}, 422),
    ({"size": "x" * 21, "colour": "Navy", "stock": 1}, 422),
    ({"size": "M", "colour": "", "stock": 1}, 422),
    ({"size": "M", "colour": "c" * 31, "stock": 1}, 422),
    ({"size": "M", "colour": "Navy", "stock": -1}, 422),
    ({"size": "M", "colour": "Navy", "stock": 10_001}, 422),
    ({"size": "M", "colour": "Navy", "stock": 2.5}, 422),
    ({"size": "M", "colour": "Navy", "stock": 1, "colourHex": "navy"}, 422),
    ({"size": "M", "colour": "Navy", "stock": 1, "colourHex": "#12345"}, 422),
    ({"size": "Kids 10-12", "colour": "Navy", "stock": 10_000, "colourHex": "#aabbcc"}, 201),
    ({"size": "Free size", "colour": "Navy", "stock": 0}, 201),
])
def test_apparel_variant_validation(client, admin_token, body, status_code):
    product, _ = make_product(client, admin_token, variants=(), name="Variant Validation Tee")
    r = client.post(f"/api/shop/admin/apparel/{product['id']}/variants", headers=auth(admin_token), json=body)
    assert r.status_code == status_code, r.text
    if status_code == 201 and body.get("colourHex"):
        assert r.json()["colourHex"] == "#AABBCC"
    client.delete(f"/api/shop/admin/apparel/{product['id']}", headers=auth(admin_token))


def test_apparel_variant_size_colour_must_be_unique(client, admin_token):
    product, variants = make_product(client, admin_token, variants=(("M", "Navy", 1), ("L", "Navy", 1)), name="Unique Tee")
    r = client.post(f"/api/shop/admin/apparel/{product['id']}/variants", headers=auth(admin_token),
                    json={"size": "m", "colour": "navy", "stock": 2})
    assert r.status_code == 409
    r = client.put(f"/api/shop/admin/apparel-variants/{variants[1]['id']}", headers=auth(admin_token), json={"size": "M"})
    assert r.status_code == 409
    # Same size in a different colour is fine; a variant can be saved unchanged.
    r = client.post(f"/api/shop/admin/apparel/{product['id']}/variants", headers=auth(admin_token),
                    json={"size": "M", "colour": "White", "stock": 2})
    assert r.status_code == 201
    r = client.put(f"/api/shop/admin/apparel-variants/{variants[0]['id']}", headers=auth(admin_token), json={"size": "M", "stock": 4})
    assert r.status_code == 200 and r.json()["stock"] == 4
    client.delete(f"/api/shop/admin/apparel/{product['id']}", headers=auth(admin_token))


def test_admin_routes_need_an_admin(client, admin_token, employee_token):
    product, variants = make_product(client, admin_token, variants=(("M", "Navy", 1),), name="Guarded Tee")
    customer, _ = new_customer(client)
    pid, vid = product["id"], variants[0]["id"]
    calls = [
        ("get", "/api/shop/admin/apparel", None),
        ("post", "/api/shop/admin/apparel", product_payload()),
        ("put", f"/api/shop/admin/apparel/{pid}", {"price": 1}),
        ("delete", f"/api/shop/admin/apparel/{pid}", None),
        ("post", f"/api/shop/admin/apparel/{pid}/variants", {"size": "S", "colour": "Navy", "stock": 1}),
        ("put", f"/api/shop/admin/apparel-variants/{vid}", {"stock": 0}),
        ("delete", f"/api/shop/admin/apparel-variants/{vid}", None),
        ("patch", "/api/orders/ORD-00000/status", {"status": "Confirmed"}),
        ("post", "/api/orders/ORD-00000/payment", {"amount": 100, "method": "Cash"}),
    ]
    for method, url, body in calls:
        kwargs = {"json": body} if body is not None else {}
        assert getattr(client, method)(url, **kwargs).status_code == 401, url
        for token in (customer, employee_token):
            assert getattr(client, method)(url, headers=auth(token), **kwargs).status_code == 403, url
    # Nothing changed.
    assert stock_of(vid) == 1
    client.delete(f"/api/shop/admin/apparel/{pid}", headers=auth(admin_token))


# ---------------- Quote ----------------

@pytest.fixture(scope="module")
def catalogue(client, admin_token):
    tee, tee_variants = make_product(client, admin_token, name="Quote Tee", price=399,
                                     variants=(("M", "Navy", 5), ("L", "Navy", 0), ("XL", "Navy", 2)))
    racket = make_racket(client, admin_token)
    racket_por = make_racket(client, admin_token, name="Price On Request Racket", price=None)
    racket_out = make_racket(client, admin_token, name="Sold Out Racket", inStock=False)
    string, string_variants = make_string(client, admin_token)
    string_por, string_por_variants = make_string(client, admin_token, price=None, colours=(("Black", True),))
    return {
        "tee": tee, "M": tee_variants[0], "L": tee_variants[1], "XL": tee_variants[2],
        "racket": racket, "racket_por": racket_por, "racket_out": racket_out,
        "string": string, "black": string_variants[0], "red": string_variants[1],
        "string_por": string_por, "string_por_black": string_por_variants[0],
    }


def test_quote_uses_database_prices_and_explains_unavailable_items(client, catalogue, pricing):
    c = catalogue
    items = [
        line("apparel", c["tee"]["id"], c["M"]["id"], 2, unitPrice=1, price=1),  # client prices are ignored
        line("apparel", c["tee"]["id"], c["L"]["id"], 1),
        line("apparel", c["tee"]["id"], c["XL"]["id"], 3),
        line("apparel", c["tee"]["id"], None, 1),
        line("racket", c["racket"]["id"], None, 1),
        line("racket", c["racket_por"]["id"], None, 1),
        line("racket", c["racket_out"]["id"], None, 1),
        line("string", c["string"]["id"], c["black"]["id"], 3),
        line("string", c["string"]["id"], c["red"]["id"], 1),
        line("string", c["string_por"]["id"], c["string_por_black"]["id"], 1),
        line("string", c["string"]["id"], None, 1),
        line("shuttle", "SHT-1", None, 1),
        line("apparel", "APP-missing", "AVR-missing", 1),
    ]
    r = client.post("/api/shop/quote", json={"items": items, "fulfilment": "pickup"})  # no login needed
    assert r.status_code == 200, r.text
    q = r.json()

    assert [(i["kind"], i["quantity"]) for i in q["items"]] == [("apparel", 2), ("racket", 1), ("string", 3)]
    tee_line, racket_line, string_line = q["items"]
    assert tee_line == {
        "kind": "apparel", "productId": c["tee"]["id"], "variantId": c["M"]["id"], "name": "Quote Tee",
        "detail": "M · Navy", "unitPrice": 399, "quantity": 2, "lineTotal": 798, "image": "/images/apparel/tee-white.webp",
    }
    assert racket_line["name"] == "Yonex Shop Test Racket" and racket_line["unitPrice"] == 4500
    assert racket_line["variantId"] is None and racket_line["image"] == "/images/rackets/test.webp"
    assert string_line["name"] == "Hundred Shop Test 66" and string_line["detail"] == "Black"
    assert string_line["unitPrice"] == 650 and string_line["lineTotal"] == 1950
    assert string_line["image"] == "/images/strings/black.webp"

    reasons = [u["reason"] for u in q["unavailable"]]
    assert reasons == [
        "Out of stock",
        "Only 2 left in XL",
        "Choose a size and colour",
        "Price on request — ask us on WhatsApp",
        "Out of stock",
        "Out of stock",
        "Price on request — ask us on WhatsApp",
        "Choose a colour",
        "This item can't be ordered online — ask us on WhatsApp",
        "No longer available",
    ]
    assert q["unavailable"][0]["name"] == "Quote Tee" and q["unavailable"][0]["variantId"] == c["L"]["id"]
    assert q["subtotal"] == 798 + 4500 + 1950
    assert q["deliveryCharge"] == 0 and q["distanceKm"] is None and q["outsideDeliveryArea"] is False
    assert q["total"] == q["subtotal"]


def test_quote_merges_repeated_lines_and_checks_limits(client, catalogue):
    c = catalogue
    r = client.post("/api/shop/quote", json={"fulfilment": "pickup", "items": [
        line("apparel", c["tee"]["id"], c["M"]["id"], 2), line("apparel", c["tee"]["id"], c["M"]["id"], 2)]})
    assert r.status_code == 200 and r.json()["items"][0]["quantity"] == 4
    r = client.post("/api/shop/quote", json={"fulfilment": "pickup", "items": [
        line("apparel", c["tee"]["id"], c["M"]["id"], 4), line("apparel", c["tee"]["id"], c["M"]["id"], 2)]})
    assert r.json()["unavailable"][0]["reason"] == "Only 5 left in M"
    r = client.post("/api/shop/quote", json={"fulfilment": "pickup", "items": [
        line("racket", c["racket"]["id"], None, 6), line("racket", c["racket"]["id"], None, 6)]})
    assert "at most 10" in r.json()["unavailable"][0]["reason"]

    for qty in (0, 11, -1):
        r = client.post("/api/shop/quote", json={"fulfilment": "pickup", "items": [line("racket", c["racket"]["id"], None, qty)]})
        assert r.status_code == 422, qty
    many = [line("racket", f"RKT-{i}", None, 1) for i in range(21)]
    assert client.post("/api/shop/quote", json={"fulfilment": "pickup", "items": many}).status_code == 422
    r = client.post("/api/shop/quote", json={"fulfilment": "pickup", "items": []})
    assert r.status_code == 200 and r.json()["items"] == [] and r.json()["total"] == 0
    assert client.post("/api/shop/quote", json={"fulfilment": "courier", "items": []}).status_code == 422


def test_quote_delivery_charge_distance_and_area(client, catalogue, pricing):
    c = catalogue
    items = [line("racket", c["racket"]["id"])]

    def quote(fulfilment="delivery", address=None):
        body = {"items": items, "fulfilment": fulfilment}
        if address is not None:
            body["address"] = address
        r = client.post("/api/shop/quote", json=body)
        assert r.status_code == 200, r.text
        return r.json()

    near = quote(address={**ADDRESS, "distanceKm": 4})
    assert near["deliveryCharge"] == 0 and near["distanceKm"] == 4 and near["outsideDeliveryArea"] is False
    far = quote(address={**ADDRESS, "distanceKm": 14})
    assert far["deliveryCharge"] == 60 and far["total"] == 4500 + 60  # (14 - 10 free) × ₹15
    outside = quote(address={**ADDRESS, "distanceKm": 50})
    assert outside["outsideDeliveryArea"] is True
    # Pickup is always free, whatever address is sent.
    pickup = quote("pickup", address={**ADDRESS, "distanceKm": 50})
    assert pickup["deliveryCharge"] == 0 and pickup["distanceKm"] is None and pickup["outsideDeliveryArea"] is False
    # No address yet: the charge isn't known.
    assert quote()["deliveryCharge"] == 0 and quote()["distanceKm"] is None

    # A phone location wins over the typed distance (computed on the server).
    lat, lng = pricing["shopLat"] + 0.1, pricing["shopLng"]
    located = quote(address={**ADDRESS, "distanceKm": 0, "lat": lat, "lng": lng})
    expected_km = road_distance_km(pricing["shopLat"], pricing["shopLng"], lat, lng)
    assert located["distanceKm"] == expected_km and expected_km > 10
    assert located["deliveryCharge"] == pytest.approx(round((expected_km - 10) * 15 + 1e-9), abs=1)

    for bad in ({**ADDRESS, "lat": 17.7}, {**ADDRESS, "lat": 0, "lng": 0}, {**ADDRESS, "lat": 95, "lng": 83}):
        r = client.post("/api/shop/quote", json={"items": items, "fulfilment": "delivery", "address": bad})
        assert r.status_code == 422, bad
    r = client.post("/api/shop/quote", json={"items": items, "fulfilment": "delivery", "address": {**ADDRESS, "distanceKm": -2}})
    assert r.status_code == 422
    r = client.post("/api/shop/quote", headers={"Content-Type": "application/json"},
                    content='{"items": [], "fulfilment": "delivery", "address": {"houseFlat": "1", "distanceKm": NaN}}')
    assert r.status_code == 422


def test_quote_is_rate_limited_per_ip(client):
    codes = [client.post("/api/shop/quote", json={"items": [], "fulfilment": "pickup"}).status_code for _ in range(121)]
    assert codes[:120] == [200] * 120 and codes[120] == 429


# ---------------- Placing orders ----------------

def test_place_pickup_order_takes_stock_and_snapshots_items(client, admin_token, pricing):
    product, variants = make_product(client, admin_token, variants=(("M", "Navy", 5),), name="Snapshot Tee", price=350)
    racket = make_racket(client, admin_token, name="Snapshot Racket", price=3000)
    token, mobile = new_customer(client, "Anil Kumar")

    r = place(client, token, [line("apparel", product["id"], variants[0]["id"], 2, unitPrice=1),
                              line("racket", racket["id"], None, 1)], notes="Please keep it ready by 6 PM")
    assert r.status_code == 201, r.text
    order = r.json()
    assert re.fullmatch(r"ORD-\d{5}", order["id"])
    assert order["status"] == "Placed" and order["paymentStatus"] == "Pending" and order["paymentMethod"] is None
    assert order["customerName"] == "Anil Kumar" and order["customerMobile"] == mobile
    assert order["fulfilment"] == "pickup" and order["address"] is None and order["distanceKm"] is None
    assert order["subtotal"] == 3700 and order["deliveryCharge"] == 0 and order["total"] == 3700
    assert order["notes"] == "Please keep it ready by 6 PM"
    assert order["items"][0] == {
        "kind": "apparel", "productId": product["id"], "variantId": variants[0]["id"], "name": "Snapshot Tee",
        "detail": "M · Navy", "unitPrice": 350, "quantity": 2, "lineTotal": 700, "image": "/images/apparel/tee-white.webp",
    }
    assert [t["status"] for t in order["timeline"]] == ["Placed"]
    assert order["timeline"][0]["actor"] == "Customer (Anil Kumar)"
    assert re.fullmatch(r"\d{2} \w{3} \d{4}, \d{2}:\d{2} [AP]M", order["timeline"][0]["timestamp"])
    assert stock_of(variants[0]["id"]) == 3

    # Later catalogue edits don't change the order.
    client.put(f"/api/shop/admin/apparel/{product['id']}", headers=auth(admin_token), json={"name": "Renamed Tee", "price": 999})
    again = client.get(f"/api/orders/{order['id']}", headers=auth(token)).json()
    assert again["items"][0]["name"] == "Snapshot Tee" and again["items"][0]["unitPrice"] == 350 and again["total"] == 3700
    # ...and deleting the product keeps the order intact.
    assert client.delete(f"/api/shop/admin/apparel/{product['id']}", headers=auth(admin_token)).status_code == 200
    again = client.get(f"/api/orders/{order['id']}", headers=auth(token)).json()
    assert again["items"][0]["name"] == "Snapshot Tee"
    q = client.post("/api/shop/quote", json={"fulfilment": "pickup", "items": [line("apparel", product["id"], variants[0]["id"])]}).json()
    assert q["unavailable"][0]["reason"] == "No longer available"


def test_place_delivery_order_checks_the_address(client, catalogue, pricing):
    token, _ = new_customer(client, "Delivery Customer")
    items = [line("racket", catalogue["racket"]["id"])]
    assert place(client, token, items, "delivery").status_code == 422
    for bad in ({**ADDRESS, "pincode": "5300"}, {**ADDRESS, "pincode": "53001A"}, {**ADDRESS, "houseFlat": " "},
                {**ADDRESS, "area": ""}):
        r = place(client, token, items, "delivery", bad)
        assert r.status_code == 422, bad

    r = place(client, token, items, "delivery", {**ADDRESS, "distanceKm": 14, "pincode": "530 017"})
    assert r.status_code == 201, r.text
    order = r.json()
    assert order["deliveryCharge"] == 60 and order["total"] == 4560 and order["distanceKm"] == 14
    assert order["address"]["distanceSource"] == "customer" and order["address"]["pincode"] == "530017"
    assert order["address"]["area"] == "MVP Colony"

    lat, lng = pricing["shopLat"] + 0.02, pricing["shopLng"]
    r = place(client, token, items, "delivery", {**ADDRESS, "distanceKm": 30, "lat": lat, "lng": lng})
    assert r.status_code == 201, r.text
    assert r.json()["address"]["distanceSource"] == "location"
    assert r.json()["distanceKm"] == road_distance_km(pricing["shopLat"], pricing["shopLng"], lat, lng)

    r = place(client, token, items, "delivery", {**ADDRESS, "distanceKm": 50})
    assert r.status_code == 422 and shop_phone() in r.json()["detail"]
    assert place(client, token, items, notes="x" * 301).status_code == 422


def test_order_rejections(client, admin_token, employee_token, catalogue):
    c = catalogue
    token, mobile = new_customer(client, "Rejected Customer")
    assert place(client, token, []).status_code == 422

    before = stock_of(c["M"]["id"])
    r = place(client, token, [line("apparel", c["tee"]["id"], c["M"]["id"], 1), line("racket", c["racket_por"]["id"])])
    assert r.status_code == 409
    assert "Price on request" in r.json()["detail"]
    assert r.json()["unavailable"][0]["productId"] == c["racket_por"]["id"]
    assert stock_of(c["M"]["id"]) == before

    # A verified number that hasn't registered (no name yet) can't order.
    session = otp_login(client, "8799999991")
    assert session["isNewCustomer"] is True
    r = place(client, session["token"], [line("racket", c["racket"]["id"])])
    assert r.status_code == 403

    # Staff don't place orders through the customer endpoint.
    assert place(client, admin_token, [line("racket", c["racket"]["id"])]).status_code == 403
    assert place(client, employee_token, [line("racket", c["racket"]["id"])]).status_code == 403
    assert client.post("/api/orders", json={"items": [line("racket", c["racket"]["id"])], "fulfilment": "pickup"}).status_code == 401
    with SessionLocal() as db:
        assert db.query(OrderModel).filter(OrderModel.customerMobile == mobile).count() == 0


def test_last_piece_goes_to_one_customer_only(client, admin_token):
    product, variants = make_product(client, admin_token, variants=(("S", "Black", 1),), name="Last Piece Tee")
    first, _ = new_customer(client, "First Buyer")
    second, _ = new_customer(client, "Second Buyer")
    cart = [line("apparel", product["id"], variants[0]["id"], 1)]
    assert place(client, first, cart).status_code == 201
    r = place(client, second, cart)
    assert r.status_code == 409 and r.json()["unavailable"][0]["reason"] == "Out of stock"
    assert stock_of(variants[0]["id"]) == 0


def test_stock_taken_between_check_and_order_is_not_oversold(client, admin_token, monkeypatch):
    """Another order takes the last piece after this order's availability check: the
    conditional stock UPDATE refuses, nothing is saved and stock never goes negative."""
    product, variants = make_product(client, admin_token, variants=(("M", "Black", 1),), name="Race Tee")
    variant_id = variants[0]["id"]
    token, mobile = new_customer(client, "Race Customer")
    original = shop_router._price_lines

    def price_then_sell_out(db, lines):
        result = original(db, lines)
        with SessionLocal() as other:  # a concurrent order commits first
            other.query(ApparelVariantModel).filter(ApparelVariantModel.id == variant_id).update({"stock": 0})
            other.commit()
        return result

    monkeypatch.setattr(shop_router, "_price_lines", price_then_sell_out)
    r = place(client, token, [line("apparel", product["id"], variant_id, 1)])
    assert r.status_code == 409, r.text
    assert "just sold out" in r.json()["detail"]
    assert stock_of(variant_id) == 0
    with SessionLocal() as db:
        assert db.query(OrderModel).filter(OrderModel.customerMobile == mobile).count() == 0


def test_a_failed_line_undoes_the_stock_taken_for_earlier_lines(client, admin_token, monkeypatch):
    product, variants = make_product(client, admin_token, variants=(("M", "Grey", 3), ("L", "Grey", 1)), name="Rollback Tee")
    m_id, l_id = variants[0]["id"], variants[1]["id"]
    token, _ = new_customer(client, "Rollback Customer")
    original = shop_router._price_lines

    def price_then_sell_out(db, lines):
        result = original(db, lines)
        with SessionLocal() as other:
            other.query(ApparelVariantModel).filter(ApparelVariantModel.id == l_id).update({"stock": 0})
            other.commit()
        return result

    monkeypatch.setattr(shop_router, "_price_lines", price_then_sell_out)
    r = place(client, token, [line("apparel", product["id"], m_id, 2), line("apparel", product["id"], l_id, 1)])
    assert r.status_code == 409
    assert stock_of(m_id) == 3 and stock_of(l_id) == 0


def test_order_placement_is_rate_limited_per_customer(client):
    token, _ = new_customer(client, "Busy Customer")
    codes = [place(client, token, []).status_code for _ in range(11)]
    assert codes[:10] == [422] * 10 and codes[10] == 429
    other, _ = new_customer(client, "Other Customer")
    assert place(client, other, []).status_code == 422  # a different customer isn't blocked


# ---------------- Access ----------------

def test_customers_only_see_their_own_orders(client, admin_token, employee_token, catalogue):
    a, _ = new_customer(client, "Customer A")
    b, _ = new_customer(client, "Customer B")
    order = place(client, a, [line("racket", catalogue["racket"]["id"])]).json()

    assert order["id"] in [o["id"] for o in client.get("/api/orders", headers=auth(a)).json()]
    assert order["id"] not in [o["id"] for o in client.get("/api/orders", headers=auth(b)).json()]
    assert client.get(f"/api/orders/{order['id']}", headers=auth(a)).status_code == 200
    assert client.get(f"/api/orders/{order['id']}", headers=auth(b)).status_code == 404
    assert client.post(f"/api/orders/{order['id']}/cancel", headers=auth(b), json={"reason": "not mine"}).status_code == 404
    assert client.get("/api/orders/ORD-NOPE", headers=auth(a)).status_code == 404

    admin_list = client.get("/api/orders", headers=auth(admin_token)).json()
    assert order["id"] in [o["id"] for o in admin_list]
    assert client.get(f"/api/orders/{order['id']}", headers=auth(admin_token)).status_code == 200

    assert client.get("/api/orders", headers=auth(employee_token)).status_code == 403
    assert client.get(f"/api/orders/{order['id']}", headers=auth(employee_token)).status_code == 403
    assert client.post(f"/api/orders/{order['id']}/cancel", headers=auth(employee_token), json={}).status_code == 403
    assert client.get("/api/orders").status_code == 401


# ---------------- Status flow & payment ----------------

def test_delivery_order_status_flow(client, admin_token, admin_name, catalogue, pricing):
    token, _ = new_customer(client, "Flow Customer")
    order = place(client, token, [line("racket", catalogue["racket"]["id"])], "delivery", ADDRESS).json()
    oid = order["id"]

    assert set_status(client, admin_token, oid, "Packed").status_code == 409  # can't skip Confirmed
    assert set_status(client, admin_token, oid, "Placed").status_code == 409
    assert set_status(client, admin_token, oid, "Shipped").status_code == 422
    r = set_status(client, admin_token, oid, "Confirmed", "Called the customer")
    assert r.status_code == 200 and r.json()["status"] == "Confirmed"
    assert r.json()["timeline"][-1]["actor"] == admin_name and r.json()["timeline"][-1]["notes"] == "Called the customer"
    assert set_status(client, admin_token, oid, "Packed").status_code == 200
    assert set_status(client, admin_token, oid, "Ready for Pickup").status_code == 409  # delivery order
    assert set_status(client, admin_token, oid, "Out for Delivery").status_code == 200
    r = set_status(client, admin_token, oid, "Delivered")
    assert r.status_code == 409 and "payment" in r.json()["detail"].lower()

    r = pay(client, admin_token, oid, order["total"], "Cash")
    assert r.status_code == 200, r.text
    done = r.json()
    assert done["status"] == "Delivered" and done["paymentStatus"] == "Paid" and done["paymentMethod"] == "Cash"
    assert done["paidAt"]
    assert [t["status"] for t in done["timeline"]] == [
        "Placed", "Confirmed", "Packed", "Out for Delivery", "Payment Received", "Delivered"]
    assert all(t["actor"] == admin_name for t in done["timeline"][1:])
    assert set_status(client, admin_token, oid, "Confirmed").status_code == 409
    assert client.post(f"/api/orders/{oid}/cancel", headers=auth(admin_token), json={"reason": "late"}).status_code == 409


def test_pickup_order_status_flow(client, admin_token, catalogue):
    token, _ = new_customer(client, "Pickup Customer")
    order = place(client, token, [line("string", catalogue["string"]["id"], catalogue["black"]["id"], 2)]).json()
    oid = order["id"]
    for step in ("Confirmed", "Packed"):
        assert set_status(client, admin_token, oid, step).status_code == 200
    assert set_status(client, admin_token, oid, "Out for Delivery").status_code == 409  # pickup order
    assert set_status(client, admin_token, oid, "Ready for Pickup").status_code == 200
    assert set_status(client, admin_token, oid, "Picked Up").status_code == 409  # not paid yet
    r = pay(client, admin_token, oid, 1300, "UPI")
    assert r.status_code == 200 and r.json()["status"] == "Picked Up" and r.json()["paymentStatus"] == "Paid"


def test_payment_rules(client, admin_token, catalogue):
    token, _ = new_customer(client, "Paying Customer")
    order = place(client, token, [line("racket", catalogue["racket"]["id"])]).json()
    oid = order["id"]
    set_status(client, admin_token, oid, "Confirmed")

    assert pay(client, admin_token, oid, 0).status_code == 422
    assert pay(client, admin_token, oid, -5).status_code == 422
    assert pay(client, admin_token, oid, 100, method="Card").status_code == 422
    r = client.post(f"/api/orders/{oid}/payment", headers={**auth(admin_token), "Content-Type": "application/json"},
                    content='{"amount": NaN, "method": "Cash"}')
    assert r.status_code == 422
    r = pay(client, admin_token, oid, 4000)
    assert r.status_code == 422 and "₹4,500" in r.json()["detail"]
    assert pay(client, admin_token, oid, 4500.6).status_code == 200  # within ₹1
    assert pay(client, admin_token, oid, 4500).status_code == 409  # already paid

    # Paid in advance (e.g. UPI at the counter): the status doesn't move until the order is handed over.
    after = client.get(f"/api/orders/{oid}", headers=auth(admin_token)).json()
    assert after["status"] == "Confirmed" and after["paymentStatus"] == "Paid"
    for step in ("Packed", "Ready for Pickup", "Picked Up"):
        assert set_status(client, admin_token, oid, step).status_code == 200, step

    # A different amount is accepted with a note (e.g. a discount).
    order2 = place(client, token, [line("racket", catalogue["racket"]["id"])]).json()
    r = pay(client, admin_token, order2["id"], 4300, "Cash", notes="₹200 festival discount")
    assert r.status_code == 200 and r.json()["timeline"][-1]["notes"] == "₹200 festival discount"

    # Nothing to collect on a cancelled order.
    order3 = place(client, token, [line("racket", catalogue["racket"]["id"])]).json()
    client.post(f"/api/orders/{order3['id']}/cancel", headers=auth(token), json={"reason": "Changed my mind"})
    assert pay(client, admin_token, order3["id"], 4500).status_code == 409
    assert pay(client, admin_token, "ORD-NOPE", 4500).status_code == 404


# ---------------- Cancellation ----------------

def test_customer_cancel_restores_stock_once(client, admin_token, admin_name):
    product, variants = make_product(client, admin_token, variants=(("L", "White", 4),), name="Cancel Tee")
    vid = variants[0]["id"]
    token, _ = new_customer(client, "Cancelling Customer")
    order = place(client, token, [line("apparel", product["id"], vid, 3)]).json()
    assert stock_of(vid) == 1

    set_status(client, admin_token, order["id"], "Confirmed")
    r = client.post(f"/api/orders/{order['id']}/cancel", headers=auth(token), json={"reason": "Ordered the wrong size"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "Cancelled" and r.json()["cancelReason"] == "Ordered the wrong size"
    assert r.json()["timeline"][-1]["actor"] == "Customer (Cancelling Customer)"
    assert stock_of(vid) == 4
    assert client.post(f"/api/orders/{order['id']}/cancel", headers=auth(token), json={"reason": "again"}).status_code == 409
    assert client.post(f"/api/orders/{order['id']}/cancel", headers=auth(admin_token), json={}).status_code == 409
    assert set_status(client, admin_token, order["id"], "Packed").status_code == 409
    assert stock_of(vid) == 4  # restored only once

    # Once packed, the customer has to call the shop; the admin can still cancel.
    order2 = place(client, token, [line("apparel", product["id"], vid, 2)]).json()
    set_status(client, admin_token, order2["id"], "Confirmed")
    set_status(client, admin_token, order2["id"], "Packed")
    r = client.post(f"/api/orders/{order2['id']}/cancel", headers=auth(token), json={"reason": "late"})
    assert r.status_code == 409 and shop_phone() in r.json()["detail"]
    assert stock_of(vid) == 2
    r = client.post(f"/api/orders/{order2['id']}/cancel", headers=auth(admin_token), json={"reason": "Customer called to cancel"})
    assert r.status_code == 200 and r.json()["status"] == "Cancelled"
    assert r.json()["timeline"][-1]["actor"] == admin_name
    assert stock_of(vid) == 4

    # PATCH status "Cancelled" works the same way for the admin; an empty reason is filled in.
    order3 = place(client, token, [line("apparel", product["id"], vid, 1)]).json()
    assert stock_of(vid) == 3
    r = set_status(client, admin_token, order3["id"], "Cancelled")
    assert r.status_code == 200 and r.json()["cancelReason"] == "Cancelled by the shop"
    assert stock_of(vid) == 4
    assert client.post(f"/api/orders/{order3['id']}/cancel", headers=auth(token), json={"reason": "x" * 301}).status_code == 422


# ---------------- Notifications ----------------

def test_order_notifications_reach_the_right_people(client, admin_token, employee_token, catalogue):
    a, mobile_a = new_customer(client, "Notified Customer")
    b, _ = new_customer(client, "Other Customer")
    order = place(client, a, [line("racket", catalogue["racket"]["id"]),
                              line("string", catalogue["string"]["id"], catalogue["black"]["id"], 2)]).json()
    oid = order["id"]

    admin_notes = [n for n in notifications(client, admin_token) if n["requestId"] == oid]
    assert len(admin_notes) == 1
    digits = mobile_a[3:]
    assert admin_notes[0]["message"] == f"New order {oid}: 3 items, ₹5,800 — Notified Customer, +91 {digits[:5]} {digits[5:]}"
    assert not [n for n in notifications(client, a) if n["requestId"] == oid]  # the admin notice isn't for the customer
    assert not [n for n in notifications(client, employee_token) if n["requestId"] == oid]

    set_status(client, admin_token, oid, "Confirmed")
    set_status(client, admin_token, oid, "Packed")
    set_status(client, admin_token, oid, "Ready for Pickup")
    mine = [n["message"] for n in notifications(client, a) if n["requestId"] == oid]
    assert f"Your order {oid} is confirmed." in mine
    assert f"Your order {oid} is ready for pickup at the shop." in mine
    assert not [n for n in notifications(client, b) if n["requestId"] == oid]
    assert not [n for n in notifications(client, employee_token) if n["requestId"] == oid]
    assert len([n for n in notifications(client, admin_token) if n["requestId"] == oid]) == 1  # no echo of own changes

    pay(client, admin_token, oid, 5800, "UPI")
    mine = [n["message"] for n in notifications(client, a) if n["requestId"] == oid]
    assert f"Payment of ₹5,800 received for order {oid}. Your order {oid} has been picked up. Thank you!" in mine

    # The customer can mark their own order notification read; another customer can't.
    note = next(n for n in notifications(client, a) if n["requestId"] == oid)
    assert client.patch(f"/api/notifications/{note['id']}/read", headers=auth(b)).status_code == 404
    assert client.patch(f"/api/notifications/{note['id']}/read", headers=auth(a)).status_code == 200

    # Out for delivery wording, and the admin hears about customer cancellations.
    order2 = place(client, a, [line("racket", catalogue["racket"]["id"])], "delivery", ADDRESS).json()
    for step in ("Confirmed", "Packed", "Out for Delivery"):
        set_status(client, admin_token, order2["id"], step)
    assert f"Your order {order2['id']} is out for delivery." in [n["message"] for n in notifications(client, a)]
    order3 = place(client, a, [line("racket", catalogue["racket"]["id"])]).json()
    client.post(f"/api/orders/{order3['id']}/cancel", headers=auth(a), json={"reason": "Bought it at the shop"})
    admin_msgs = [n["message"] for n in notifications(client, admin_token) if n["requestId"] == order3["id"]]
    assert f"Notified Customer cancelled order {order3['id']}: Bought it at the shop" in admin_msgs
