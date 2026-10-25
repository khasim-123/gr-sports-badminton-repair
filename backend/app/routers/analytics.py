"""Site visit tracking and admin visitor/customer reports (with CSV export)."""
import csv
import io
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import List, Literal, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, load_only

from app.config import settings
from app.database import get_db
from app.models import CustomerModel, ServiceRequestModel, VisitModel
from app.security import CurrentUser, get_optional_user, rate_limit, require_admin
from app.services.content_service import BUSINESS_TZ, business_today, new_id, now_iso
from app.services.notification_service import log_audit
from app.services.sms_service import display_phone

router = APIRouter(prefix="/analytics", tags=["Site Analytics"])

ID_PATTERN = r"^[A-Za-z0-9_-]{8,64}$"
MAX_RANGE_DAYS = 366


class VisitIn(BaseModel):
    visitorId: str = Field(pattern=ID_PATTERN)
    sessionId: str = Field(pattern=ID_PATTERN)
    page: str = Field(min_length=1, max_length=120)
    referrer: Optional[str] = Field(default=None, max_length=500)
    utmSource: Optional[str] = Field(default=None, max_length=60)


# ---------------- Helpers ----------------

def _device(user_agent: str) -> str:
    ua = user_agent.lower()
    if "ipad" in ua or "tablet" in ua or ("android" in ua and "mobile" not in ua):
        return "tablet"
    if "mobi" in ua or "iphone" in ua or "android" in ua:
        return "mobile"
    return "desktop"


def _browser(user_agent: str) -> str:
    ua = user_agent.lower()
    for needle, name in (("edg/", "Edge"), ("opr/", "Opera"), ("samsungbrowser", "Samsung Internet"),
                         ("chrome/", "Chrome"), ("crios", "Chrome"), ("firefox/", "Firefox"),
                         ("fxios", "Firefox"), ("safari/", "Safari")):
        if needle in ua:
            return name
    return "Other"


def _referrer_host(referrer: Optional[str], own_hosts: set[str]) -> Optional[str]:
    if not referrer:
        return None
    host = (urlparse(referrer).hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    if not host or host in own_hosts:
        return None
    return host[:120]


def _own_hosts() -> set[str]:
    hosts = set()
    for origin in settings.BACKEND_CORS_ORIGINS:
        h = (urlparse(origin).hostname or "").lower()
        if h:
            hosts.add(h[4:] if h.startswith("www.") else h)
    return hosts


def _date_range(start: Optional[str], end: Optional[str]) -> tuple[date, date]:
    try:
        end_d = date.fromisoformat(end) if end else business_today()
        start_d = date.fromisoformat(start) if start else end_d - timedelta(days=29)
    except ValueError:
        raise HTTPException(status_code=422, detail="Dates must be YYYY-MM-DD")
    if start_d > end_d:
        raise HTTPException(status_code=422, detail="Start date must be before end date")
    if (end_d - start_d).days >= MAX_RANGE_DAYS:
        raise HTTPException(status_code=422, detail="Please choose a range of one year or less")
    return start_d, end_d


def _visits(db: Session, start: date, end: date) -> List[VisitModel]:
    return (
        db.query(VisitModel)
        .filter(VisitModel.day >= start.isoformat(), VisitModel.day <= end.isoformat())
        .order_by(VisitModel.createdAt)
        .all()
    )


def _parse_customer_created(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    for fmt in ("%d %b %Y, %I:%M %p", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def _request_day(created_at: Optional[str]) -> Optional[date]:
    """Service requests store ISO UTC timestamps; report them on the IST calendar day."""
    if not created_at:
        return None
    try:
        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(BUSINESS_TZ).date()


def _local_time(created_at: str) -> str:
    try:
        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        return dt.astimezone(BUSINESS_TZ).strftime("%Y-%m-%d %H:%M")
    except ValueError:
        return created_at


_FORMULA_START = re.compile(r"^[=+\-@\t\r]")


def _csv_phone(phone: Optional[str]) -> str:
    """+919876543210 -> 98765 43210 (all customers are Indian; avoids a leading '+' that
    spreadsheets would treat as a formula)."""
    if phone and re.fullmatch(r"\+91\d{10}", phone):
        return f"{phone[3:8]} {phone[8:]}"
    return phone or ""


def _cell(value) -> str:
    """CSV cell that spreadsheet apps won't execute as a formula."""
    if value is None:
        return ""
    text = str(value)
    return "'" + text if _FORMULA_START.match(text) else text


def _csv_response(filename: str, header: list[str], rows: list[list]) -> Response:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    for row in rows:
        writer.writerow([_cell(v) for v in row])
    # UTF-8 BOM so Excel shows ₹ and non-English names correctly.
    return Response(
        content="﻿" + buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )


def purge_old_visits(db: Session) -> None:
    cutoff = (business_today() - timedelta(days=settings.VISIT_RETENTION_DAYS)).isoformat()
    db.query(VisitModel).filter(VisitModel.day < cutoff).delete(synchronize_session=False)
    db.commit()


# ---------------- Tracking ----------------

@router.post(
    "/visit",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(rate_limit("visit", limit=120, window_seconds=60))],
)
def record_visit(
    payload: VisitIn,
    request: Request,
    db: Session = Depends(get_db),
    user: Optional[CurrentUser] = Depends(get_optional_user),
):
    # Staff browsing the site would distort customer numbers.
    if user and user.is_staff:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    ua = request.headers.get("user-agent", "")[:400]
    if "bot" in ua.lower() or "spider" in ua.lower() or "crawl" in ua.lower():
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    db.add(VisitModel(
        id=new_id("VIS"),
        visitorId=payload.visitorId,
        sessionId=payload.sessionId,
        page=re.sub(r"[^A-Za-z0-9_/\- ]", "", payload.page)[:120] or "unknown",
        referrer=_referrer_host(payload.referrer, _own_hosts()),
        utmSource=re.sub(r"[^A-Za-z0-9_.\- ]", "", payload.utmSource or "")[:60] or None,
        device=_device(ua),
        browser=_browser(ua),
        customerPhone=user.phone if user and user.role == "CUSTOMER" else None,
        day=business_today().isoformat(),
        createdAt=now_iso(),
    ))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------- Admin reports ----------------

@router.get("/summary")
def visitor_summary(
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    start_d, end_d = _date_range(start, end)
    visits = _visits(db, start_d, end_d)

    customers = db.query(CustomerModel).all()
    customers_by_phone = {c.phone: c for c in customers}
    new_customers = [c for c in customers if (d := _parse_customer_created(c.createdAt)) and start_d <= d <= end_d]

    bookings_by_day: Counter = Counter()
    bookings_total = 0
    for (created_at,) in db.query(ServiceRequestModel.createdAt).all():
        d = _request_day(created_at)
        if d and start_d <= d <= end_d:
            bookings_by_day[d.isoformat()] += 1
            bookings_total += 1

    per_day_views: Counter = Counter()
    per_day_visitors: dict[str, set] = defaultdict(set)
    for v in visits:
        per_day_views[v.day] += 1
        per_day_visitors[v.day].add(v.visitorId)

    daily = []
    d = start_d
    while d <= end_d:
        key = d.isoformat()
        daily.append({
            "date": key,
            "pageViews": per_day_views.get(key, 0),
            "visitors": len(per_day_visitors.get(key, ())),
            "bookings": bookings_by_day.get(key, 0),
        })
        d += timedelta(days=1)

    unique_visitors = len({v.visitorId for v in visits})

    # Recent logged-in customer activity (latest visit per customer).
    latest: dict[str, VisitModel] = {}
    visit_counts: Counter = Counter()
    for v in visits:
        if v.customerPhone:
            visit_counts[v.customerPhone] += 1
            latest[v.customerPhone] = v
    recent_customers = []
    for phone, v in sorted(latest.items(), key=lambda kv: kv[1].createdAt, reverse=True)[:25]:
        c = customers_by_phone.get(phone)
        recent_customers.append({
            "name": c.name if c else "",
            "phone": display_phone(phone),
            "lastVisit": _local_time(v.createdAt),
            "lastPage": v.page,
            "pageViews": visit_counts[phone],
        })

    return {
        "start": start_d.isoformat(),
        "end": end_d.isoformat(),
        "totals": {
            "pageViews": len(visits),
            "uniqueVisitors": unique_visitors,
            "sessions": len({v.sessionId for v in visits}),
            "loggedInCustomers": len(latest),
            "newCustomers": len(new_customers),
            "bookings": bookings_total,
            "conversionRate": round(bookings_total / unique_visitors * 100, 1) if unique_visitors else 0.0,
        },
        "daily": daily,
        "topPages": [{"label": k, "count": n} for k, n in Counter(v.page for v in visits).most_common(8)],
        "topReferrers": [{"label": k, "count": n} for k, n in Counter(v.referrer or "Direct / unknown" for v in visits).most_common(8)],
        "devices": [{"label": k, "count": n} for k, n in Counter(v.device or "unknown" for v in visits).most_common()],
        "recentCustomers": recent_customers,
    }


@router.get("/export")
def export_report(
    report: Literal["customers", "visits"] = Query("customers", alias="type"),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    start_d, end_d = _date_range(start, end)
    span = f"{start_d.isoformat()}_to_{end_d.isoformat()}"

    # Downloading customer personal data is recorded in the audit log. Logged before the
    # rows are loaded: log_audit commits, which would otherwise expire every loaded row and
    # re-fetch each one with its own query (one query per visit/customer).
    log_audit(db, admin.label, "ADMIN", f"Downloaded {report} report", "REPORTS", span)

    visits = _visits(db, start_d, end_d)
    customers = db.query(CustomerModel).all()
    customers_by_phone = {c.phone: c for c in customers}

    if report == "visits":
        rows = []
        for v in visits:
            c = customers_by_phone.get(v.customerPhone or "")
            rows.append([
                _local_time(v.createdAt), v.page,
                c.name if c else ("Customer" if v.customerPhone else "Guest"),
                _csv_phone(v.customerPhone),
                v.device, v.browser, v.referrer or "Direct / unknown", v.utmSource or "",
                v.visitorId, v.sessionId,
            ])
        return _csv_response(
            f"gr-sports-visit-log_{span}.csv",
            ["Date & time (IST)", "Page", "Visitor", "Mobile (+91)", "Device", "Browser",
             "Came from", "Campaign", "Visitor ID", "Session ID"],
            rows,
        )

    # Customer report: every registered customer plus anyone who booked without an account.
    visit_stats: dict[str, dict] = defaultdict(lambda: {"views": 0, "sessions": set(), "first": None, "last": None})
    for v in visits:
        if not v.customerPhone:
            continue
        s = visit_stats[v.customerPhone]
        s["views"] += 1
        s["sessions"].add(v.sessionId)
        s["first"] = s["first"] or v.createdAt
        s["last"] = v.createdAt

    bookings: dict[str, list] = defaultdict(list)
    # Only the columns used below (skips photos/timeline JSON).
    request_cols = load_only(
        ServiceRequestModel.id, ServiceRequestModel.customerMobile, ServiceRequestModel.customerName,
        ServiceRequestModel.createdAt, ServiceRequestModel.status, ServiceRequestModel.paymentStatus,
        ServiceRequestModel.totalAmount,
    )
    for r in db.query(ServiceRequestModel).options(request_cols).all():
        bookings[r.customerMobile or ""].append(r)

    phones = sorted(set(customers_by_phone) | {p for p in bookings if p})
    rows = []
    for phone in phones:
        c = customers_by_phone.get(phone)
        reqs = sorted(bookings.get(phone, []), key=lambda r: r.createdAt or "")
        in_range = [r for r in reqs if (d := _request_day(r.createdAt)) and start_d <= d <= end_d]
        s = visit_stats.get(phone)
        paid = sum((r.totalAmount or 0) for r in reqs if r.paymentStatus == "Paid")
        last = reqs[-1] if reqs else None
        first_req = reqs[0] if reqs else None
        rows.append([
            c.name if c else (first_req.customerName if first_req else ""),
            _csv_phone(phone),
            (c.address if c else "") or "",
            c.createdAt if c else "No account",
            _local_time(s["first"]) if s else "",
            _local_time(s["last"]) if s else "",
            s["views"] if s else 0,
            len(s["sessions"]) if s else 0,
            len(in_range),
            len(reqs),
            sum(1 for r in reqs if r.status == "Completed"),
            round(paid, 2),
            _local_time(last.createdAt) if last else "",
            last.id if last else "",
        ])
    return _csv_response(
        f"gr-sports-customers_{span}.csv",
        ["Name", "Mobile (+91)", "Address", "Registered on", "First visit in period (IST)",
         "Last visit in period (IST)", "Page views in period", "Visits (sessions) in period",
         "Bookings in period", "Bookings (all time)", "Completed bookings", "Total paid (₹)",
         "Last booking (IST)", "Last booking ID"],
        rows,
    )
