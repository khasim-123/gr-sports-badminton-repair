# GR Sports Badminton Service Platform — Python Backend

High-performance, enterprise-grade Python backend built with **FastAPI**, **Pydantic v2**, and **SQLAlchemy 2.0 (SQLite)**, fully aligned with the frontend data models, business rules, and service workflows.

---

## 🏸 Features & Parity with Frontend

1. **Authentication & Role-Based Access (`/api/auth`)**:
   - Customer, Employee, and Admin authentication.
   - Customers: mobile number + SMS login code (`/api/auth/otp/request`, MSG91). Staff/admin: mobile number + password.
   - JWT session generation (`/api/auth/login`).

2. **Badminton Service Requests (`/api/requests`)**:
   - Supports both **Getting (Stringing)** and **Structural Composite Repair**.
   - Manual entry for **Bat Brand** and **Bat Model** (any brand supported).
   - **4 Getting Service Tiers**:
     - Basic Getting (from ₹400)
     - Tournament Getting (from ₹600)
     - Durability Getting (from ₹500)
     - Custom Getting (from ₹750)
   - String preference and colour selection.
   - Comprehensive status lifecycle tracking with immutable timeline audit history.
   - **In-app notifications** to Admin and Employees when a request is created or updated.

3. **Doorstep Logistics & Dynamic Pricing (`/api/config/distance`)**:
   - Shop: Beside Ramalayam Arch, Near Diamond Park, Dondaparthy, Visakhapatnam (default `17.7283, 83.3017`, approximate — set the exact point in Admin → Distance & Free Radius).
   - **10 KM Free Pickup & Delivery Radius** with Haversine distance calculation.
   - Dynamic per-KM surcharge (₹15/KM) or configurable distance slab billing.

4. **Team & Staff Management (`/api/employees`)**:
   - Create new **Employees** and **Admins**.
   - Employee workload statistics (getting completed vs in-progress, repair received vs done, active jobs count).

5. **In-App Real-time Notification System (`/api/notifications`)**:
   - Notification creation, unread tracking, role-based filtering, and bulk mark-as-read.

6. **Customer Reviews (`/api/requests/{id}/review`)**:
   - 1 to 5 star rating with verified feedback comment on completed requests.


---

## 🚀 Quickstart

### 1. Requirements
- Python 3.10+ (tested on Python 3.12)
- Dependencies installed from `requirements.txt`

### 2. Run the Server
From the `backend` folder:
```powershell
python run.py
```
Or with Uvicorn directly:
```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Interactive API Documentation
- **Swagger UI (Interactive API Explorer):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check:** [http://localhost:8000/api/health](http://localhost:8000/api/health)
- **Platform Stats:** [http://localhost:8000/api/stats](http://localhost:8000/api/stats)

---

## 📁 Architecture Directory Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── config.py              # Application settings, CORS, constants
│   ├── database.py            # SQLAlchemy engine, session maker, Base
│   ├── models.py              # ORM models (ServiceRequest, Employee, Config, Notifications, etc.)
│   ├── schemas.py             # Pydantic v2 validation models matching TypeScript types
│   ├── seed_data.py           # Database initial seeder
│   ├── routers/
│   │   ├── auth.py            # Mobile login (SMS code / password), logout
│   │   ├── requests.py        # Service request CRUD, lifecycle, estimates, payments, reviews
│   │   ├── employees.py       # Staff & admin management, workload KPI calculations
│   │   ├── notifications.py   # In-app notifications
│   │   ├── config.py          # Distance pricing & service tiers
│   │   ├── audit.py           # Immutable audit trails
│   └── services/
│       ├── pricing_service.py # Haversine formula & delivery fee calculator
│       └── notification_service.py # In-app notifications & audit log
├── badminton.db               # SQLite database file (auto-created on startup)
├── requirements.txt           # Python dependencies
├── run.py                     # Convenience runner script
└── README.md                  # This documentation file
```

---

## 🔐 Configuration & Production Deployment

Copy `backend/.env.example` to `backend/.env` for local development. In production (Render) set these in the dashboard — never commit them:

| Variable | Purpose |
|---|---|
| `ENVIRONMENT=production` | Requires `SECRET_KEY`, hides `/docs`, refuses `CORS_ORIGINS=*`, skips demo seed data |
| `DATABASE_URL` | Postgres connection string |
| `SECRET_KEY` | Signs login tokens (Render generates one) |
| `ADMIN_PHONE`, `ADMIN_PASSWORD` | First admin account (mobile number + password); created on startup, password only set if the admin has none |
| `CORS_ORIGINS` | Comma-separated frontend URLs allowed to call the API |
| `PUBLIC_API_URL` | Base URL used in links to uploaded images |
| `MSG91_AUTH_KEY`, `MSG91_OTP_TEMPLATE_ID` | SMS delivery of customer login codes (MSG91, DLT-approved OTP template) |
| `EXPOSE_OTP_IN_RESPONSE` | `false` in production. `auto` shows codes on screen when no SMS could be sent (local development only) |

### Login
- **Customers:** mobile number + 6-digit SMS code (valid 10 minutes, 5 attempts). No passwords and no email.
- **Staff & admin:** mobile number + password. The admin sets or resets staff passwords in *Manage Staff & Admins*.
- Mobile numbers are stored as `+91XXXXXXXXXX`; any common format (`98765 43210`, `+91-98765-43210`, `09876543210`) is accepted.

### Access rules
- **Public:** website content (`/api/content/site`, banners, strings, approved reviews, public documents, availability), pricing config reads, review submission.
- **Customers:** only their own service requests and notifications.
- **Staff (EMPLOYEE/ADMIN):** all requests and workshop actions (status, assignment, estimates, payments).
- **Admin only:** website content management, uploads, team, pricing changes, audit logs, customer list.

### Website content (admin → Website Content)
- **Banners** — homepage carousel with desktop/mobile images, button target and optional start/end dates.
- **Strings & Stock** — the Hundred string range (22 models, 161 colours, photos in `public/images/strings/`) with per-colour in-stock toggles and prices (unset until the admin enters them).
- **Reviews** — every review starts as *pending*; only approved reviews appear on the site. Reviews from completed bookings are marked *verified*.
- **Documents** — PDFs/images or links, either public or staff-only.
- **Visitor reports** (Admin → Reports & Export) — daily visitors, pages, referrers, devices, logged-in customer activity, and CSV downloads (customer report, visit log). No IP addresses are stored; visits older than `VISIT_RETENTION_DAYS` (365) are deleted on startup; downloads are audit-logged.
- **Pickup Availability** — open weekdays, daily capacity, lead time, booking window, time slots, closed dates and a customer notice. Bookings on unavailable days are rejected by the API.

Uploaded files are stored in the database (`media` table), so they survive redeploys on hosts without a persistent disk.

### Tests
```powershell
cd backend
python -m pytest -q
```
