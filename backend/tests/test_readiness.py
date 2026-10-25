"""Production-readiness guards: photo-free request lists, exact payments, notification limits."""
from tests.test_platform import client, admin_token, auth, customer_token, booking  # noqa: F401
from app.security import rate_limiter

def _photo() -> str:
    import base64
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (64, 48), (200, 30, 30)).save(buf, "JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def _reset():
    rate_limiter._hits.clear()


def test_photos_are_stored_as_files_not_inline(client, admin_token):
    _reset()
    token = customer_token(client, "9000000401", "Photo Customer")
    r = client.post("/api/requests", headers=auth(token), json=booking(batPhotos=[_photo()]))
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    url = r.json()["batPhotos"][0]
    assert "/api/media/PHO-" in url and not url.startswith("data:")
    img = client.get(url[url.index("/api/media/"):])
    assert img.status_code == 200 and img.headers["content-type"] == "image/webp"
    # Lists carry the short link, so nothing heavy is sent.
    listed = next(x for x in client.get("/api/requests", headers=auth(admin_token)).json() if x["id"] == rid)
    assert listed["batPhotos"] == [url]
    # A non-image "photo" is refused.
    bad = "data:image/jpeg;base64," + "A" * 400
    r = client.post("/api/requests", headers=auth(token), json=booking(batPhotos=[bad]))
    assert r.status_code in (415, 422)


def test_lists_strip_old_inline_photos(client, admin_token):
    """Requests saved before photos moved to the media store may still hold data: URLs."""
    _reset()
    from app.database import SessionLocal
    from app.models import ServiceRequestModel

    token = customer_token(client, "9000000403", "Old Photo Customer")
    rid = client.post("/api/requests", headers=auth(token), json=booking()).json()["id"]
    inline = _photo()
    db = SessionLocal()
    try:
        db.query(ServiceRequestModel).filter(ServiceRequestModel.id == rid).update({"batPhotos": [inline]})
        db.commit()
    finally:
        db.close()
    listed = next(x for x in client.get("/api/requests", headers=auth(admin_token)).json() if x["id"] == rid)
    assert listed["batPhotos"] == []
    assert client.get(f"/api/requests/{rid}", headers=auth(admin_token)).json()["batPhotos"] == [inline]


def test_payment_must_match_amount_due(client, admin_token):
    _reset()
    token = customer_token(client, "9000000402", "Pay Customer")
    req = client.post("/api/requests", headers=auth(token), json=booking()).json()
    due = req["totalAmount"]
    # Admin recording a different amount needs a note; the exact amount always works.
    r = client.post(f"/api/requests/{req['id']}/payment", headers=auth(admin_token), json={"amount": 1, "method": "Cash"})
    assert r.status_code == 422 and "amount due" in r.json()["detail"]
    r = client.post(f"/api/requests/{req['id']}/payment", headers=auth(admin_token),
                    json={"amount": due - 50, "method": "Cash", "notes": "₹50 loyalty discount"})
    assert r.status_code == 200, r.text
    assert r.json()["paymentStatus"] == "Paid"


def test_notifications_are_limited(client, admin_token):
    _reset()
    r = client.get("/api/notifications?limit=2", headers=auth(admin_token))
    assert r.status_code == 200 and len(r.json()) <= 2


def test_large_responses_are_compressed(client, admin_token):
    r = client.get("/api/content/site", headers={"Accept-Encoding": "gzip"})
    assert r.status_code == 200 and r.headers.get("content-encoding") == "gzip"


def test_declined_fee_is_returned_so_staff_can_collect_it(client, admin_token):
    _reset()
    shop = client.get("/api/config/shop").json()
    assert client.put("/api/config/shop", headers=auth(admin_token), json={**shop, "declinedRepairFee": 50}).status_code == 200
    try:
        token = customer_token(client, "9000000404", "Decline Customer")
        req = client.post("/api/requests", headers=auth(token),
                          json=booking(serviceType="REPAIR", repairIssue="Frame Damage", distanceKm=12)).json()
        est = {"labourCharge": 300, "materialsCharge": 100, "additionalCharges": 0, "pickupDeliveryCharge": 0,
               "discount": 0, "totalEstimate": 0, "expectedCompletionDate": "2026-11-05", "inspectionNotes": "Crack"}
        assert client.post(f"/api/requests/{req['id']}/estimate", headers=auth(admin_token), json=est).status_code == 200
        declined = client.post(f"/api/requests/{req['id']}/estimate/decline", headers=auth(token), json={}).json()
        fee = declined["repairEstimate"]["declinedRepairFee"]
        assert fee == 50
        due = declined["pickupDeliveryCharge"] + fee
        assert declined["totalAmount"] == due
        r = client.post(f"/api/requests/{req['id']}/payment", headers=auth(admin_token), json={"amount": due, "method": "Cash"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "Completed Without Repair"
    finally:
        client.put("/api/config/shop", headers=auth(admin_token), json=shop)


def test_correcting_to_the_same_distance_is_refused(client, admin_token):
    _reset()
    token = customer_token(client, "9000000405", "Same Distance")
    req = client.post("/api/requests", headers=auth(token), json=booking(distanceKm=7)).json()
    r = client.post(f"/api/requests/{req['id']}/distance", headers=auth(admin_token), json={"distanceKm": 7, "reason": "checked"})
    assert r.status_code == 422
    r = client.post(f"/api/requests/{req['id']}/distance", headers=auth(admin_token), json={"distanceKm": 9, "reason": "checked"})
    assert r.status_code == 200 and r.json()["distanceKm"] == 9
