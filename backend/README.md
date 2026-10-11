# GR Sports Badminton Service Platform — Python Backend

High-performance, enterprise-grade Python backend built with **FastAPI**, **Pydantic v2**, and **SQLAlchemy 2.0 (SQLite)**, fully aligned with the frontend data models, business rules, and service workflows.

---

## 🏸 Features & Parity with Frontend

1. **Authentication & Role-Based Access (`/api/auth`)**:
   - Customer, Employee, and Admin authentication.
   - OTP request simulation (`/api/auth/otp/request`) with template rendering.
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
   - **Automatic Notification & Email Simulation**: Dispatches alerts to both Admin and Employee upon new request creation.

3. **Doorstep Logistics & Dynamic Pricing (`/api/config/distance`)**:
   - Master Hub Coordinates: 80 Feet Road, Indiranagar, Bengaluru (`12.9716, 77.6412`).
   - **10 KM Free Pickup & Delivery Radius** with Haversine distance calculation.
   - Dynamic per-KM surcharge (₹15/KM) or configurable distance slab billing.

4. **Team & Staff Management (`/api/employees`)**:
   - Create new **Employees** and **Admins**.
   - Employee workload statistics (getting completed vs in-progress, repair received vs done, active jobs count).

5. **In-App Real-time Notification System (`/api/notifications`)**:
   - Notification creation, unread tracking, role-based filtering, and bulk mark-as-read.

6. **Customer Reviews (`/api/requests/{id}/review`)**:
   - 1 to 5 star rating with verified feedback comment on completed requests.

7. **Email Simulation & Templates (`/api/emails`)**:
   - Pre-configured email templates (`TPL-01` to `TPL-06`) for OTP, booking confirmation, workshop repair estimates, price revisions, out-for-delivery, and payment receipts.

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
│   │   ├── auth.py            # Login, OTP, logout endpoints
│   │   ├── requests.py        # Service request CRUD, lifecycle, estimates, payments, reviews
│   │   ├── employees.py       # Staff & admin management, workload KPI calculations
│   │   ├── notifications.py   # In-app notifications
│   │   ├── config.py          # Distance pricing & service tiers
│   │   ├── audit.py           # Immutable audit trails
│   │   └── emails.py          # Email templates and simulation
│   └── services/
│       ├── pricing_service.py # Haversine formula & delivery fee calculator
│       └── notification_service.py # Notification dispatch & email template renderer
├── badminton.db               # SQLite database file (auto-created on startup)
├── requirements.txt           # Python dependencies
├── run.py                     # Convenience runner script
└── README.md                  # This documentation file
```
