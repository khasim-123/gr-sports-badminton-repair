from sqlalchemy import Column, String, Integer, Float, Boolean, Text, JSON, LargeBinary, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class ServiceRequestModel(Base):
    __tablename__ = "service_requests"

    id = Column(String, primary_key=True, index=True)
    serviceType = Column(String, nullable=False, index=True)
    customerName = Column(String, nullable=False)
    customerEmail = Column(String, nullable=True, index=True)  # legacy; no longer collected
    customerMobile = Column(String, nullable=False, index=True)  # +91XXXXXXXXXX, the customer's identity
    createdAt = Column(String, nullable=False, index=True)
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


class CustomerModel(Base):
    __tablename__ = "customers"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)  # legacy; no longer collected
    phone = Column(String, nullable=False, unique=True, index=True)  # +91XXXXXXXXXX, login identity
    address = Column(String, nullable=True)
    password = Column(String, nullable=True)
    createdAt = Column(String, nullable=False)


class EmployeeModel(Base):
    __tablename__ = "employees"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)  # optional
    phone = Column(String, nullable=False, unique=True, index=True)  # +91XXXXXXXXXX, login identity
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
    requestId = Column(String, nullable=True, index=True)
    timestamp = Column(String, nullable=False, index=True)
    isRead = Column(Boolean, default=False)
    targetRoles = Column(JSON, default=list)


class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, index=True)
    timestamp = Column(String, nullable=False, index=True)
    user = Column(String, nullable=False)
    role = Column(String, nullable=False)
    action = Column(String, nullable=False)
    requestId = Column(String, nullable=False, index=True)
    details = Column(Text, nullable=True)



# ---------------- Auth ----------------

class OtpCodeModel(Base):
    __tablename__ = "otp_codes"

    id = Column(String, primary_key=True)
    identifier = Column(String, nullable=False, index=True)
    codeHash = Column(String, nullable=False)
    expiresAt = Column(Float, nullable=False)  # epoch seconds
    attempts = Column(Integer, default=0)


# ---------------- Website content (admin managed) ----------------

class AppMetaModel(Base):
    """Small key/value store for one-off bookkeeping (e.g. which catalogue items were seeded)."""
    __tablename__ = "app_meta"

    key = Column(String, primary_key=True)
    value = Column(JSON, nullable=True)


class MediaModel(Base):
    """Uploaded images/documents stored in Postgres so they survive redeploys on
    hosts without a persistent disk."""
    __tablename__ = "media"

    id = Column(String, primary_key=True)
    fileName = Column(String, nullable=True)
    contentType = Column(String, nullable=False)
    size = Column(Integer, nullable=False)
    data = Column(LargeBinary, nullable=False)
    uploadedBy = Column(String, nullable=True)
    createdAt = Column(String, nullable=False)


class BannerModel(Base):
    __tablename__ = "banners"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    subtitle = Column(Text, nullable=True)
    badge = Column(String, nullable=True)
    ctaLabel = Column(String, nullable=True)
    ctaTarget = Column(String, default="none")
    ctaUrl = Column(String, nullable=True)
    desktopImageUrl = Column(String, nullable=False)
    mobileImageUrl = Column(String, nullable=True)
    isActive = Column(Boolean, default=True)
    sortOrder = Column(Integer, default=0, index=True)
    startsAt = Column(String, nullable=True)  # YYYY-MM-DD
    endsAt = Column(String, nullable=True)    # YYYY-MM-DD
    createdAt = Column(String, nullable=False)


class StringProductModel(Base):
    __tablename__ = "string_products"

    id = Column(String, primary_key=True)
    brand = Column(String, nullable=False, default="Hundred")
    code = Column(String, nullable=True, index=True)
    name = Column(String, nullable=False)
    gauge = Column(String, nullable=True)
    price = Column(Float, nullable=True)  # None = price on request
    description = Column(Text, nullable=True)
    isFeatured = Column(Boolean, default=False)
    isActive = Column(Boolean, default=True)
    sortOrder = Column(Integer, default=0, index=True)
    createdAt = Column(String, nullable=False)

    variants = relationship(
        "StringVariantModel",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="StringVariantModel.sortOrder",
    )


class StringVariantModel(Base):
    __tablename__ = "string_variants"

    id = Column(String, primary_key=True)
    productId = Column(String, ForeignKey("string_products.id", ondelete="CASCADE"), nullable=False, index=True)
    colour = Column(String, nullable=False)
    colourHex = Column(String, nullable=True)
    imageUrl = Column(String, nullable=True)
    inStock = Column(Boolean, default=True)
    sortOrder = Column(Integer, default=0)

    product = relationship("StringProductModel", back_populates="variants")


class RacketModel(Base):
    __tablename__ = "rackets"

    id = Column(String, primary_key=True)
    brand = Column(String, nullable=False)
    name = Column(String, nullable=False)
    price = Column(Float, nullable=True)  # None = price on request
    tag = Column(String, nullable=True)
    weight = Column(String, nullable=True)
    balance = Column(String, nullable=True)
    flex = Column(String, nullable=True)
    maxTension = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    images = Column(JSON, default=list)  # photo URLs, first = main
    inStock = Column(Boolean, default=True)
    isFeatured = Column(Boolean, default=False)
    isActive = Column(Boolean, default=True)
    sortOrder = Column(Integer, default=0, index=True)
    createdAt = Column(String, nullable=False)


class ReviewModel(Base):
    __tablename__ = "reviews"

    id = Column(String, primary_key=True)
    authorName = Column(String, nullable=False)
    authorPhone = Column(String, nullable=True)  # never exposed publicly
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=False)
    serviceType = Column(String, nullable=True)
    location = Column(String, nullable=True)
    status = Column(String, default="pending", index=True)  # pending | approved | hidden
    isFeatured = Column(Boolean, default=False)
    isVerified = Column(Boolean, default=False)
    requestId = Column(String, nullable=True, index=True)
    adminReply = Column(Text, nullable=True)
    createdAt = Column(String, nullable=False)


class DocumentModel(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=False, default="Other")
    fileUrl = Column(String, nullable=False)
    fileName = Column(String, nullable=True)
    contentType = Column(String, nullable=True)
    isPublic = Column(Boolean, default=True)
    sortOrder = Column(Integer, default=0)
    createdAt = Column(String, nullable=False)


class EventModel(Base):
    """Tournaments, coaching camps, clinics and store events shown on the website
    (and, when showAsBanner, in the homepage hero carousel)."""
    __tablename__ = "events"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    category = Column(String, nullable=False, default="tournament")  # tournament | coaching_camp | clinic | store_event | other
    summary = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    startDate = Column(String, nullable=False, index=True)  # YYYY-MM-DD
    endDate = Column(String, nullable=True)  # YYYY-MM-DD inclusive; None = single day
    timeText = Column(String, nullable=True)
    venue = Column(String, nullable=False)
    venueMapUrl = Column(String, nullable=True)
    entryFee = Column(Float, nullable=True)  # rupees; None/0 = free
    feeNote = Column(String, nullable=True)
    categories = Column(JSON, default=list)  # play categories, e.g. ["Men's Doubles"]
    registrationMode = Column(String, nullable=False, default="none")  # form | whatsapp | phone | url | none
    registrationUrl = Column(String, nullable=True)
    registrationDeadline = Column(String, nullable=True)  # YYYY-MM-DD inclusive
    capacity = Column(Integer, nullable=True)  # max active registrations for mode "form"
    bannerImageUrl = Column(String, nullable=False)
    mobileImageUrl = Column(String, nullable=True)
    showAsBanner = Column(Boolean, default=True)
    isActive = Column(Boolean, default=True)
    sortOrder = Column(Integer, default=0, index=True)
    createdAt = Column(String, nullable=False)


class EventRegistrationModel(Base):
    __tablename__ = "event_registrations"

    id = Column(String, primary_key=True)
    eventId = Column(String, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    mobile = Column(String, nullable=False, index=True)  # +91XXXXXXXXXX
    partnerName = Column(String, nullable=True)
    playCategory = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="registered")  # registered | cancelled
    createdAt = Column(String, nullable=False)


class AvailabilitySettingsModel(Base):
    __tablename__ = "availability_settings"

    id = Column(Integer, primary_key=True)
    openWeekdays = Column(JSON, default=list)
    dailyPickupCapacity = Column(Integer, default=0)
    leadTimeDays = Column(Integer, default=0)
    bookingWindowDays = Column(Integer, default=30)
    pickupSlots = Column(JSON, default=list)
    closedDates = Column(JSON, default=list)
    notice = Column(Text, nullable=True)


# ---------------- Site analytics ----------------

class VisitModel(Base):
    """One page view. No IP address is stored; anonymous visitors are a random
    first-party id. customerPhone is set only when a logged-in customer visits."""
    __tablename__ = "site_visits"

    id = Column(String, primary_key=True)
    visitorId = Column(String, nullable=False, index=True)
    sessionId = Column(String, nullable=False, index=True)
    page = Column(String, nullable=False)
    referrer = Column(String, nullable=True)  # host only, e.g. "google.com"
    utmSource = Column(String, nullable=True)
    device = Column(String, nullable=True)  # mobile | tablet | desktop
    browser = Column(String, nullable=True)
    customerPhone = Column(String, nullable=True, index=True)
    day = Column(String, nullable=False, index=True)  # YYYY-MM-DD in IST
    createdAt = Column(String, nullable=False, index=True)  # ISO UTC
