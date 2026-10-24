"""Admin extras: editable shop details and the customers list."""
from tests.test_platform import admin_token, auth, booking, client, customer_token  # noqa: F401

SHOP = {
    "name": "GR Sports",
    "tagline": "Badminton · Dondaparthy, Vizag",
    "phone": "98765 43210",
    "whatsapp": "+91 76758 31496",
    "email": "shop@example.com",
    "addressLine": "Beside Ramalayam Arch",
    "area": "Dondaparthy, Visakhapatnam",
    "pincode": "530016",
    "mapsUrl": "https://maps.google.com/?q=GR+Sports",
    "openingHours": "Mon–Sat 10 AM – 8 PM",
    "declinedRepairFee": 150,
}


def test_shop_settings_public_read_and_admin_update(client, admin_token):
    r = client.get("/api/config/shop")
    assert r.status_code == 200
    assert r.json()["name"]

    assert client.put("/api/config/shop", json=SHOP).status_code in (401, 403)
    cust = customer_token(client, "9000000101", "Shop Tester")
    assert client.put("/api/config/shop", headers=auth(cust), json=SHOP).status_code == 403

    r = client.put("/api/config/shop", headers=auth(admin_token), json=SHOP)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["phone"] == "+919876543210"
    assert body["whatsapp"] == "+917675831496"
    assert body["declinedRepairFee"] == 150
    assert client.get("/api/config/shop").json()["phone"] == "+919876543210"
    assert client.get("/api/content/site").json()["shop"]["phone"] == "+919876543210"

    logs = client.get("/api/audit-logs", headers=auth(admin_token)).json()
    assert any(log["action"] == "Updated Shop Details" for log in logs)


def test_shop_settings_validation(client, admin_token):
    bad = [
        {"name": "G"},
        {"phone": "12345"},
        {"whatsapp": ""},
        {"email": "not-an-email"},
        {"addressLine": "  "},
        {"area": ""},
        {"pincode": "53001"},
        {"mapsUrl": "javascript:alert(1)"},
        {"mapsUrl": "http://maps.example.com"},
        {"declinedRepairFee": 6000},
        {"declinedRepairFee": -1},
        {"tagline": "x" * 81},
    ]
    for change in bad:
        r = client.put("/api/config/shop", headers=auth(admin_token), json={**SHOP, **change})
        assert r.status_code == 422, (change, r.text)
    r = client.put("/api/config/shop", headers=auth(admin_token),
                   json={**SHOP, "email": "", "pincode": "", "mapsUrl": "", "declinedRepairFee": 0})
    assert r.status_code == 200, r.text
    assert r.json()["email"] is None and r.json()["mapsUrl"] is None and r.json()["declinedRepairFee"] == 0


def test_event_messages_use_shop_phone(client, admin_token):
    from app.database import SessionLocal
    from app.routers.events import _shop_phone

    r = client.put("/api/config/shop", headers=auth(admin_token), json={**SHOP, "phone": "9123456780"})
    assert r.status_code == 200
    db = SessionLocal()
    try:
        assert _shop_phone(db) == "+91 91234 56780"
    finally:
        db.close()


def test_customers_list_and_detail(client, admin_token):
    customer_token(client, "9000000102", "Karthik Varma")
    r = client.post("/api/requests", headers=auth(admin_token),
                    json=booking("9000000102", customerName="Karthik Varma"))
    assert r.status_code == 201, r.text
    req_id = r.json()["id"]

    cust = customer_token(client, "9000000103", "Other")
    assert client.get("/api/customers", headers=auth(cust)).status_code == 403
    assert client.get("/api/customers").status_code in (401, 403)

    rows = client.get("/api/customers", headers=auth(admin_token), params={"search": "karthik"}).json()
    assert [row["phone"] for row in rows] == ["+919000000102"]
    row = rows[0]
    assert row["bookings"] == 1 and row["openBookings"] == 1 and row["totalPaid"] == 0
    assert row["lastBookingAt"]

    by_mobile = client.get("/api/customers", headers=auth(admin_token), params={"search": "90000 00102"}).json()
    assert [x["id"] for x in by_mobile] == [row["id"]]

    everyone = client.get("/api/customers", headers=auth(admin_token)).json()
    assert len(everyone) >= 2
    last = [x["lastBookingAt"] or "" for x in everyone]
    assert last == sorted(last, reverse=True)

    detail = client.get(f"/api/customers/{row['id']}", headers=auth(admin_token)).json()
    assert detail["customer"]["name"] == "Karthik Varma"
    assert [x["id"] for x in detail["requests"]] == [req_id]
    assert detail["requests"][0]["batBrand"] == "Yonex"
    assert client.get("/api/customers/NOPE", headers=auth(admin_token)).status_code == 404
