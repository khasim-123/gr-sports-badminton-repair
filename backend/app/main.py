from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.config import settings
from app.database import engine, Base, get_db
from app.seed_data import seed_database
from app.models import ServiceRequestModel, EmployeeModel
from app.security import CurrentUser, require_admin
from app.routers import (
    auth,
    requests,
    employees,
    notifications,
    config,
    audit,
    media,
    content,
    events,
    reviews,
    documents,
    availability,
    analytics,
    customers,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and seed default data
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    try:
        seed_database(db)
        analytics.purge_old_visits(db)
    finally:
        db.close()
    yield
    # Shutdown logic (if any)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend REST API for GR Sports Badminton Bat Stringing & Structural Composite Repair Platform",
    version="1.0.0",
    lifespan=lifespan,
    # Interactive API docs are handy locally but advertise every endpoint in production.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

# Configure CORS (frontend origins come from the CORS_ORIGINS env var)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=False,  # auth uses Bearer tokens, not cookies
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    expose_headers=["Content-Disposition"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Frame-Options", "DENY")
    return response

# Include Routers under /api
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(requests.router, prefix=settings.API_V1_STR)
app.include_router(employees.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
app.include_router(config.router, prefix=settings.API_V1_STR)
app.include_router(audit.router, prefix=settings.API_V1_STR)
app.include_router(media.router, prefix=settings.API_V1_STR)
app.include_router(content.router, prefix=settings.API_V1_STR)
app.include_router(events.router, prefix=settings.API_V1_STR)
app.include_router(reviews.router, prefix=settings.API_V1_STR)
app.include_router(documents.router, prefix=settings.API_V1_STR)
app.include_router(availability.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(customers.router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "service": settings.PROJECT_NAME,
        "status": "online",
        "api": settings.API_V1_STR
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "platform": "GR Sports Badminton Service Platform",
        "database": engine.name
    }

@app.get("/api/stats")
def platform_stats(db: Session = Depends(get_db), _admin: CurrentUser = Depends(require_admin)):
    total_requests = db.query(ServiceRequestModel).count()
    getting_count = db.query(ServiceRequestModel).filter(ServiceRequestModel.serviceType == "GETTING").count()
    repair_count = db.query(ServiceRequestModel).filter(ServiceRequestModel.serviceType == "REPAIR").count()
    completed_count = db.query(ServiceRequestModel).filter(ServiceRequestModel.status == "Completed").count()
    active_employees = db.query(EmployeeModel).filter(EmployeeModel.isActive == True).count()

    all_reqs = db.query(ServiceRequestModel).all()
    total_revenue = sum(r.totalAmount for r in all_reqs if r.paymentStatus == "Paid")

    return {
        "totalRequests": total_requests,
        "gettingRequests": getting_count,
        "repairRequests": repair_count,
        "completedRequests": completed_count,
        "totalRevenue": total_revenue,
        "activeEmployees": active_employees
    }
