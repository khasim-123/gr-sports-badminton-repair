from sqlalchemy import Column, String, Integer, Float, Boolean, Text, JSON
from app.database import Base

class ServiceRequestModel(Base):
    __tablename__ = "service_requests"

    id = Column(String, primary_key=True, index=True)
    serviceType = Column(String, nullable=False, index=True)
    customerName = Column(String, nullable=False)
    customerEmail = Column(String, nullable=False, index=True)
    customerMobile = Column(String, nullable=False)
    createdAt = Column(String, nullable=False)
    status = Column(String, nullable=False, index=True)

    # Bat details
    batBrand = Column(String, nullable=False)
    batModel = Column(String, nullable=False)
    batType = Column(String, nullable=False)
    batPhotos = Column(JSON, default=list)

    # Getting specific
    gettingType = Column(String, nullable=True)
    stringPreference = Column(String, nullable=True)
    stringType = Column(String, nullable=True)
    stringTensionLbs = Column(Integer, nullable=True)
    gettingPrice = Column(Float, nullable=True)
    colour = Column(String, nullable=True)

    # Repair specific
    repairIssue = Column(String, nullable=True)
    repairDescription = Column(Text, nullable=True)
    pickupDate = Column(String, nullable=True)
    targetDate = Column(String, nullable=True)
    expectedDeliveryDate = Column(String, nullable=True)
    repairEstimate = Column(JSON, nullable=True)
    previousEstimate = Column(JSON, nullable=True)

    # Location & Distance
    pickupAddress = Column(JSON, nullable=False)
    distanceKm = Column(Float, default=0.0)
    pickupDeliveryCharge = Column(Float, default=0.0)
    isFreeDelivery = Column(Boolean, default=True)

    # Staff & Pickup
    assignedEmployeeId = Column(String, nullable=True, index=True)
    assignedEmployeeName = Column(String, nullable=True)
    pickupCondition = Column(JSON, nullable=True)

    # Financial & Payment
    serviceCharge = Column(Float, default=0.0)
    discount = Column(Float, default=0.0)
    totalAmount = Column(Float, default=0.0)
    paymentStatus = Column(String, default="Pending")
    paymentRecord = Column(JSON, nullable=True)

    # Audit & Timeline
    timeline = Column(JSON, default=list)
    additionalNotes = Column(Text, nullable=True)
    review = Column(JSON, nullable=True)


class EmployeeModel(Base):
    __tablename__ = "employees"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=False)
    role = Column(String, default="Technician")
    userRole = Column(String, default="EMPLOYEE")
    activeJobsCount = Column(Integer, default=0)
    avatar = Column(String, nullable=True)
    password = Column(String, nullable=True)
    isActive = Column(Boolean, default=True)


class DistanceConfigModel(Base):
    __tablename__ = "distance_config"

    id = Column(Integer, primary_key=True)
    shopLocationName = Column(String, nullable=False)
    shopLat = Column(Float, nullable=False)
    shopLng = Column(Float, nullable=False)
    freeRadiusKm = Column(Float, default=10.0)
    perKmRateBeyondFree = Column(Float, default=15.0)
    pricingMethod = Column(String, default="PER_KM")
    maxServiceDistanceKm = Column(Float, default=35.0)
    slabs = Column(JSON, default=list)


class GettingServiceTierModel(Base):
    __tablename__ = "getting_service_tiers"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    turnaround = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    features = Column(JSON, default=list)
    isActive = Column(Boolean, default=True)


class RepairCategoryTierModel(Base):
    __tablename__ = "repair_category_tiers"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    basePrice = Column(Float, nullable=False)
    turnaround = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    slaDays = Column(Integer, default=7)
    isActive = Column(Boolean, default=True)


class NotificationModel(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, index=True)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    requestId = Column(String, nullable=True)
    timestamp = Column(String, nullable=False)
    isRead = Column(Boolean, default=False)
    targetRoles = Column(JSON, default=list)


class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, index=True)
    timestamp = Column(String, nullable=False)
    user = Column(String, nullable=False)
    role = Column(String, nullable=False)
    action = Column(String, nullable=False)
    requestId = Column(String, nullable=False)
    details = Column(Text, nullable=True)


class EmailTemplateModel(Base):
    __tablename__ = "email_templates"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    category = Column(String, nullable=False)
    variables = Column(JSON, default=list)
