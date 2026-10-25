from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import func
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
    shop,
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
# Compress JSON responses (request lists no longer carry photo data, so this is cheap).
app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=5)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=False,  # auth uses Bearer tokens, not cookies
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    expose_headers=["Content-Disposition"],
)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    """FastAPI's default 422 echoes the submitted values back ("input"): a NaN/Infinity there
    can't be encoded (turning the 422 into a 500) and big photo uploads would be sent back."""
    errors = [{k: v for k, v in e.items() if k not in ("input", "ctx", "url")} for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": jsonable_encoder(errors)})


# Largest request body accepted: a media upload (8 MB) plus multipart overhead. JSON bodies
# (bookings with a few resized photos) are far smaller. Refused before the body is read.
MAX_REQUEST_BYTES = settings.MAX_UPLOAD_BYTES + 1024 * 1024


@app.middleware("http")
async def security_headers(request: Request, call_next):
    length = request.headers.get("content-length")
    if length is not None and (not length.isdigit() or int(length) > MAX_REQUEST_BYTES):
        return JSONResponse(status_code=413, content={"detail": "Request is too large"})
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
app.include_router(shop.router, prefix=settings.API_V1_STR)

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

    # Summed in SQL: loading every request would also load all their photos.
    total_revenue = (
        db.query(func.coalesce(func.sum(ServiceRequestModel.totalAmount), 0.0))
        .filter(ServiceRequestModel.paymentStatus == "Paid")
        .scalar()
    )

    return {
        "totalRequests": total_requests,
        "gettingRequests": getting_count,
        "repairRequests": repair_count,
        "completedRequests": completed_count,
        "totalRevenue": total_revenue,
        "activeEmployees": active_employees
    }
