"""Staff (employee) workflow: accepting jobs, pickup, stringing, repair estimates,
delivery and payment — including the guards that stop out-of-order or duplicate actions.

Run from backend/:  python -m pytest -q tests/test_staff_flow.py
"""
import itertools

import pytest

from tests.test_platform import client, admin_token, auth, customer_token, booking  # noqa: F401
from app.security import rate_limiter

_numbers = itertools.count(1)


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    rate_limiter._hits.clear()


def _new_staff(client, admin_token, name):
    phone = f"71{next(_numbers):08d}"
    r = client.post("/api/employees", headers=auth(admin_token),
                    json={"name": name, "phone": phone, "userRole": "EMPLOYEE", "password": "staff-pass-123"})
    assert r.status_code == 201, r.text
    emp = r.json()
    r = client.post("/api/auth/login", json={"phone": phone, "password": "staff-pass-123", "role": "EMPLOYEE"})
    assert r.status_code == 200, r.text
    return emp, r.json()["token"]


@pytest.fixture(scope="module")
def ravi(client, admin_token):
    return _new_staff(client, admin_token, "Ravi Stringer")


@pytest.fixture(scope="module")
def kiran(client, admin_token):
    return _new_staff(client, admin_token, "Kiran Field")


def _book(client, phone, **extra):
    token = customer_token(client, phone, "Staff Flow Customer")
    r = client.post("/api/requests", headers=auth(token), json=booking(**extra))
    assert r.status_code == 201, r.text
    return r.json(), token


def _status(client, token, req_id, status):
    return client.patch(f"/api/requests/{req_id}/status", headers=auth(token), json={"status": status, "actor": "Someone Else"})


def test_employee_accepts_only_unassigned_jobs_for_themselves(client, admin_token, ravi, kiran):
    (ravi_emp, ravi_tok), (kiran_emp, kiran_tok) = ravi, kiran
    req, _ = _book(client, "9000000201")

    # Can't hand a job to a colleague.
    r = client.post(f"/api/requests/{req['id']}/assign", headers=auth(ravi_tok), json={"employeeId": kiran_emp["id"]})
    assert r.status_code == 403

    r = client.post(f"/api/requests/{req['id']}/assign", headers=auth(ravi_tok), json={"employeeId": ravi_emp["id"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["assignedEmployeeId"] == ravi_emp["id"] and body["status"] == "Employee Assigned"
    last = body["timeline"][-1]
    assert last["label"] == "Accepted by Ravi Stringer" and last["actor"] == "Ravi Stringer"

    # A colleague can't take it over; only the admin reassigns.
    r = client.post(f"/api/requests/{req['id']}/assign", headers=auth(kiran_tok), json={"employeeId": kiran_emp["id"]})
    assert r.status_code == 409 and "Ravi Stringer" in r.json()["detail"]
    r = client.post(f"/api/requests/{req['id']}/assign", headers=auth(admin_token), json={"employeeId": kiran_emp["id"]})
    assert r.status_code == 200 and r.json()["assignedEmployeeName"] == "Kiran Field"

    emps = {e["id"]: e for e in client.get("/api/employees", headers=auth(admin_token)).json()}
    assert emps[ravi_emp["id"]]["activeJobsCount"] == 0  # moved away from Ravi
    assert emps[kiran_emp["id"]]["activeJobsCount"] == 1


def test_employee_cannot_work_on_someone_elses_job(client, admin_token, ravi, kiran):
    (ravi_emp, ravi_tok), (_, kiran_tok) = ravi, kiran
    req, _ = _book(client, "9000000202")
    pickup = {"condition": "Good", "notes": "", "photos": []}
    # Not accepted yet.
    r = client.post(f"/api/requests/{req['id']}/pickup-condition", headers=auth(ravi_tok), json=pickup)
    assert r.status_code == 403 and "Accept" in r.json()["detail"]
    client.post(f"/api/requests/{req['id']}/assign", headers=auth(ravi_tok), json={"employeeId": ravi_emp["id"]})
    # Assigned to Ravi: Kiran can't record the pickup or take payment.
    r = client.post(f"/api/requests/{req['id']}/pickup-condition", headers=auth(kiran_tok), json=pickup)
    assert r.status_code == 403 and "Ravi Stringer" in r.json()["detail"]
    r = client.post(f"/api/requests/{req['id']}/payment", headers=auth(kiran_tok), json={"amount": 10, "method": "Cash"})
    assert r.status_code == 403


def test_stringing_job_end_to_end(client, admin_token, ravi):
    ravi_emp, tok = ravi
    req, cust = _book(client, "9000000203")
    rid = req["id"]
    client.post(f"/api/requests/{rid}/assign", headers=auth(tok), json={"employeeId": ravi_emp["id"]})

    # Out-of-order steps are refused.
    assert _status(client, tok, rid, "Getting Completed").status_code == 409
    assert client.post(f"/api/requests/{rid}/payment", headers=auth(tok), json={"amount": req["totalAmount"], "method": "Cash"}).status_code == 409

    photo = "data:image/jpeg;base64,/9j/4AAQSkZJRg=="
    r = client.post(f"/api/requests/{rid}/pickup-condition", headers=auth(tok),
                    json={"condition": "Minor Damage", "notes": "Scuff on the frame", "photos": [photo], "collectedBy": "Fake Name"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "Bat Picked Up"
    assert r.json()["pickupCondition"]["collectedBy"] == "Ravi Stringer"
    assert r.json()["pickupCondition"]["photos"] == [photo]
    # Recording the pickup twice (e.g. from a second phone) is refused.
    r = client.post(f"/api/requests/{rid}/pickup-condition", headers=auth(tok), json={"condition": "Good"})
    assert r.status_code == 409

    # Estimates are for repairs only.
    est = {"labourCharge": 100, "materialsCharge": 0, "additionalCharges": 0, "totalEstimate": 100}
    assert client.post(f"/api/requests/{rid}/estimate", headers=auth(tok), json=est).status_code == 422

    r = _status(client, tok, rid, "Getting in Progress")
    assert r.status_code == 200 and r.json()["timeline"][-1]["actor"] == "Ravi Stringer"  # client-sent actor ignored
    assert _status(client, tok, rid, "Getting Completed").status_code == 200
    assert _status(client, tok, rid, "Completed").status_code == 409  # can't skip delivery + payment
    assert _status(client, tok, rid, "Out for Delivery").status_code == 200

    assert client.post(f"/api/requests/{rid}/payment", headers=auth(tok), json={"amount": 0, "method": "Cash"}).status_code == 422
    r = client.post(f"/api/requests/{rid}/payment", headers=auth(tok),
                    json={"amount": req["totalAmount"], "method": "UPI", "notes": "UPI ref 4321", "collectedBy": "Fake Name"})
    assert r.status_code == 200, r.text
    done = r.json()
    assert done["status"] == "Completed" and done["paymentStatus"] == "Paid"
    assert done["paymentRecord"]["collectedBy"] == "Ravi Stringer" and done["paymentRecord"]["method"] == "UPI"
    # No double payment.
    r = client.post(f"/api/requests/{rid}/payment", headers=auth(tok), json={"amount": 1, "method": "Cash"})
    assert r.status_code == 409
    r = client.post(f"/api/requests/{rid}/payment", headers=auth(admin_token), json={"amount": 1, "method": "Cash"})
    assert r.status_code == 409

    # The customer sees the finished job.
    mine = client.get(f"/api/requests/{rid}", headers=auth(cust)).json()
    assert mine["status"] == "Completed"


def test_repair_estimate_revision_and_completion(client, ravi):
    ravi_emp, tok = ravi
    req, cust = _book(client, "9000000204", serviceType="REPAIR", gettingType=None, repairIssue="Frame Damage")
    rid = req["id"]
    client.post(f"/api/requests/{rid}/assign", headers=auth(tok), json={"employeeId": ravi_emp["id"]})
    est = {"labourCharge": 300, "materialsCharge": 120, "additionalCharges": 30, "discount": 0,
           "totalEstimate": 1, "expectedCompletionDate": "2026-11-05", "inspectionNotes": "Crack near the throat"}
    # Not picked up yet.
    assert client.post(f"/api/requests/{rid}/estimate", headers=auth(tok), json=est).status_code == 409
    client.post(f"/api/requests/{rid}/pickup-condition", headers=auth(tok), json={"condition": "Damaged", "notes": "Cracked"})

    bad = {**est, "labourCharge": -5}
    assert client.post(f"/api/requests/{rid}/estimate", headers=auth(tok), json=bad).status_code == 422
    empty = {**est, "labourCharge": 0, "materialsCharge": 0, "additionalCharges": 0}
    assert client.post(f"/api/requests/{rid}/estimate", headers=auth(tok), json=empty).status_code == 422

    r = client.post(f"/api/requests/{rid}/estimate", headers=auth(tok), json=est)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "Awaiting Customer Approval"
    assert body["repairEstimate"]["totalEstimate"] == 450  # server adds the lines up
    assert body["totalAmount"] == 450 + body["pickupDeliveryCharge"]
    assert body["timeline"][-1]["actor"] == "Ravi Stringer"

    # Work can't start before the customer approves; revising is for after approval.
    assert _status(client, tok, rid, "Repair in Progress").status_code == 409
    rev = {"additionalAmount": 200, "newTotal": 1, "reason": "Second crack under the grommet strip"}
    assert client.post(f"/api/requests/{rid}/estimate/revise", headers=auth(tok), json=rev).status_code == 409

    assert client.post(f"/api/requests/{rid}/estimate/approve", headers=auth(cust)).status_code == 200
    assert _status(client, tok, rid, "Repair in Progress").status_code == 200
    assert client.post(f"/api/requests/{rid}/estimate/revise", headers=auth(tok),
                       json={**rev, "reason": "  "}).status_code == 422
    r = client.post(f"/api/requests/{rid}/estimate/revise", headers=auth(tok), json=rev)
    assert r.status_code == 200, r.text
    e = r.json()["repairEstimate"]
    assert e["totalEstimate"] == 650 and e["originalEstimate"] == 450 and e["additionalCharges"] == 230
    assert e["labourCharge"] == 300 and e["materialsCharge"] == 120
    assert r.json()["status"] == "Awaiting Customer Approval"

    assert client.post(f"/api/requests/{rid}/estimate/approve", headers=auth(cust)).status_code == 200
    assert _status(client, tok, rid, "Repair in Progress").status_code == 200
    assert _status(client, tok, rid, "Repair Completed").status_code == 200
    assert _status(client, tok, rid, "Out for Delivery").status_code == 200
    r = client.post(f"/api/requests/{rid}/payment", headers=auth(tok), json={"amount": 650, "method": "Cash"})
    assert r.status_code == 200 and r.json()["status"] == "Completed"


def test_declined_repair_is_returned_without_repair(client, ravi):
    ravi_emp, tok = ravi
    req, cust = _book(client, "9000000205", serviceType="REPAIR", gettingType=None, repairIssue="Shaft Damage")
    rid = req["id"]
    client.post(f"/api/requests/{rid}/assign", headers=auth(tok), json={"employeeId": ravi_emp["id"]})
    client.post(f"/api/requests/{rid}/pickup-condition", headers=auth(tok), json={"condition": "Broken"})
    est = {"labourCharge": 500, "materialsCharge": 300, "expectedCompletionDate": "2026-11-05", "inspectionNotes": "Shaft snapped"}
    assert client.post(f"/api/requests/{rid}/estimate", headers=auth(tok), json=est).status_code == 200
    assert client.post(f"/api/requests/{rid}/estimate/decline", headers=auth(cust)).status_code == 200

    assert _status(client, tok, rid, "Repair in Progress").status_code == 409
    assert _status(client, tok, rid, "Out for Delivery").status_code == 200
    # Free pickup: nothing to collect, so the return closes the request.
    r = _status(client, tok, rid, "Completed Without Repair")
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "Completed Without Repair"


def test_declined_repair_with_delivery_charge_closes_on_payment(client, admin_token, ravi):
    ravi_emp, tok = ravi
    token = customer_token(client, "9000000206", "Far Customer")
    far = {**booking(serviceType="REPAIR", gettingType=None, repairIssue="Grip Issue"),
           "distanceKm": 25, "pickupAddress": {"houseFlat": "4", "street": "NH16", "area": "Anakapalle", "pincode": "531001", "distanceKm": 25}}
    r = client.post("/api/requests", headers=auth(token), json=far)
    assert r.status_code == 201, r.text
    req = r.json()
    assert req["pickupDeliveryCharge"] > 0
    rid = req["id"]
    client.post(f"/api/requests/{rid}/assign", headers=auth(tok), json={"employeeId": ravi_emp["id"]})
    client.post(f"/api/requests/{rid}/pickup-condition", headers=auth(tok), json={"condition": "Good"})
    client.post(f"/api/requests/{rid}/estimate", headers=auth(tok), json={"labourCharge": 250, "inspectionNotes": "Regrip"})
    client.post(f"/api/requests/{rid}/estimate/decline", headers=auth(token))
    assert _status(client, tok, rid, "Out for Delivery").status_code == 200
    # There is a delivery charge to collect, so it can't be closed without a payment.
    assert _status(client, tok, rid, "Completed Without Repair").status_code == 409
    r = client.post(f"/api/requests/{rid}/payment", headers=auth(tok), json={"amount": req["pickupDeliveryCharge"], "method": "Cash"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "Completed Without Repair" and r.json()["paymentStatus"] == "Paid"


def test_admin_can_still_correct_any_status(client, admin_token, ravi):
    ravi_emp, tok = ravi
    req, _ = _book(client, "9000000207")
    rid = req["id"]
    client.post(f"/api/requests/{rid}/assign", headers=auth(tok), json={"employeeId": ravi_emp["id"]})
    r = client.patch(f"/api/requests/{rid}/status", headers=auth(admin_token), json={"status": "Getting Completed", "actor": "x"})
    assert r.status_code == 200
    r = client.patch(f"/api/requests/{rid}/status", headers=auth(admin_token), json={"status": "Cancelled"})
    assert r.status_code == 200
    # Nothing can be collected on a cancelled request.
    r = client.post(f"/api/requests/{rid}/payment", headers=auth(admin_token), json={"amount": 100, "method": "Cash"})
    assert r.status_code == 409


def test_employees_only_see_their_own_jobs_and_new_bookings(client, admin_token, ravi, kiran):
    (ravi_emp, ravi_tok), (kiran_emp, kiran_tok) = ravi, kiran
    mine, cust_tok = _book(client, "9000000301")
    theirs, _ = _book(client, "9000000302")
    new, _ = _book(client, "9000000303")
    assert client.post(f"/api/requests/{mine['id']}/assign", headers=auth(admin_token), json={"employeeId": ravi_emp["id"]}).status_code == 200
    assert client.post(f"/api/requests/{theirs['id']}/assign", headers=auth(admin_token), json={"employeeId": kiran_emp["id"]}).status_code == 200

    ids = {r["id"] for r in client.get("/api/requests", headers=auth(ravi_tok)).json()}
    assert mine["id"] in ids and new["id"] in ids and theirs["id"] not in ids
    assert client.get(f"/api/requests/{theirs['id']}", headers=auth(ravi_tok)).status_code == 404
    assert client.get(f"/api/requests/{mine['id']}", headers=auth(ravi_tok)).status_code == 200
    # The admin still sees everything.
    all_ids = {r["id"] for r in client.get("/api/requests", headers=auth(admin_token)).json()}
    assert {mine["id"], theirs["id"], new["id"]} <= all_ids

    # Pickup tells the customer; Kiran doesn't get notices about Ravi's job.
    pickup = {"condition": "Good", "notes": "", "photos": []}
    r = client.post(f"/api/requests/{mine['id']}/pickup-condition", headers=auth(ravi_tok), json=pickup)
    assert r.status_code == 200, r.text
    cust_notes = client.get("/api/notifications", headers=auth(cust_tok)).json()
    assert any(n["requestId"] == mine["id"] and "picked up" in n["title"].lower() for n in cust_notes)
    kiran_notes = client.get("/api/notifications", headers=auth(kiran_tok)).json()
    assert not any(n.get("requestId") == mine["id"] for n in kiran_notes)
