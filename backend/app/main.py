from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.config import settings
from app.database import engine, Base, get_db
from app.seed_data import seed_database
from app.models import ServiceRequestModel, EmployeeModel
from app.routers import (
    auth,
    requests,
    employees,
    notifications,
    config,
    audit,
    emails
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and seed default data
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    try:
        seed_database(db)
    finally:
        db.close()
    yield
    # Shutdown logic (if any)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend REST API for GR Sports Badminton Bat Stringing & Structural Composite Repair Platform",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers under /api
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(requests.router, prefix=settings.API_V1_STR)
app.include_router(employees.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
app.include_router(config.router, prefix=settings.API_V1_STR)
app.include_router(audit.router, prefix=settings.API_V1_STR)
app.include_router(emails.router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "service": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs",
        "redoc": "/redoc",
        "api": settings.API_V1_STR
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "platform": "GR Sports Badminton Service Platform",
        "database": "SQLite / SQLAlchemy connected"
    }

@app.get("/api/stats")
def platform_stats(db: Session = Depends(get_db)):
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
