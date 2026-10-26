"""Original price (MRP) shown struck through next to the shop's price: rackets, strings, apparel.

Shares the throwaway SQLite database and fixtures of tests/test_platform.py.

Run from backend/:  python -m pytest -q tests/test_original_price.py
"""
from tests.test_platform import client, admin_token, auth  # noqa: F401

RACKET = {"brand": "Yonex", "name": "MRP Check", "images": [], "inStock": True, "isFeatured": False, "isActive": True}


def test_racket_original_price(client, admin_token):
    post = lambda body: client.post("/api/content/admin/rackets", headers=auth(admin_token), json={**RACKET, **body})
    assert post({"price": 1500, "mrp": 1500}).status_code == 422  # must be more than the price
    assert post({"price": 1500, "mrp": 900}).status_code == 422
    assert post({"mrp": 2000}).status_code == 422  # needs a price
    r = post({"price": 1499, "mrp": 1999})
    assert r.status_code == 201 and r.json()["mrp"] == 1999 and r.json()["price"] == 1499
    racket = r.json()
    on_site = next(x for x in client.get("/api/content/site").json()["rackets"] if x["id"] == racket["id"])
    assert on_site["mrp"] == 1999

    put = lambda body: client.put(f"/api/content/admin/rackets/{racket['id']}", headers=auth(admin_token), json=body)
    assert put({"price": 2500}).status_code == 422  # would be above the original price
    assert put({"price": 1299}).json()["mrp"] == 1999  # the original price stays
    assert put({"mrp": 0}).json()["mrp"] is None  # 0 / empty removes it
    assert put({"mrp": 1799}).json()["mrp"] == 1799
    back = put({"price": None, "mrp": None}).json()  # back to "Ask for price"
    assert back["price"] is None and back["mrp"] is None
    assert put({"mrp": 1999}).status_code == 422  # no price to compare with
    client.delete(f"/api/content/admin/rackets/{racket['id']}", headers=auth(admin_token))


def test_string_original_price(client, admin_token):
    r = client.post("/api/content/admin/strings", headers=auth(admin_token), json={"brand": "Yonex", "name": "MRP String", "price": 750, "mrp": 950})
    assert r.status_code == 201 and r.json()["mrp"] == 950
    sid = r.json()["id"]
    put = lambda body: client.put(f"/api/content/admin/strings/{sid}", headers=auth(admin_token), json=body)
    assert put({"mrp": 700}).status_code == 422
    assert put({"price": 999}).status_code == 422
    assert put({"price": 800, "mrp": 1000}).json()["mrp"] == 1000
    assert client.post("/api/content/admin/strings", headers=auth(admin_token), json={"brand": "Yonex", "name": "Bad", "mrp": 950}).status_code == 422
    client.delete(f"/api/content/admin/strings/{sid}", headers=auth(admin_token))


def test_apparel_original_price(client, admin_token):
    body = {"name": "MRP Tee", "category": "t-shirt", "price": 349, "images": []}
    assert client.post("/api/shop/admin/apparel", headers=auth(admin_token), json={**body, "mrp": 300}).status_code == 422
    r = client.post("/api/shop/admin/apparel", headers=auth(admin_token), json={**body, "mrp": 499})
    assert r.status_code == 201 and r.json()["mrp"] == 499
    pid = r.json()["id"]
    put = lambda b: client.put(f"/api/shop/admin/apparel/{pid}", headers=auth(admin_token), json=b)
    assert put({"price": 599}).status_code == 422  # above the original price
    assert put({"price": 399}).json()["mrp"] == 499
    assert put({"mrp": None}).json()["mrp"] is None
    client.delete(f"/api/shop/admin/apparel/{pid}", headers=auth(admin_token))
