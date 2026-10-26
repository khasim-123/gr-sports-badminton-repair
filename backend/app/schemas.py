import re
from typing import Optional, List, Literal, Any
from pydantic import BaseModel, ConfigDict, Field, field_validator

# Numbers in request bodies must be real numbers: Python's JSON parser accepts NaN/Infinity,
# which would otherwise be stored and then break every response that includes them.
FINITE = ConfigDict(allow_inf_nan=False)
MAX_AMOUNT = 1_000_000  # ₹10 lakh: far above any real stringing / repair bill

# Racket / pickup photos: small images the browser resized (data: URLs) or https links.
# Anything else (javascript:, data:text/html, SVG...) could run script when staff open it.
_PHOTO_DATA_URL = re.compile(r"^data:image/(?:jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=\s]+$")
MAX_PHOTO_CHARS = 2_000_000


def check_photo_urls(photos: List[str], max_count: int) -> List[str]:
    if len(photos) > max_count:
        raise ValueError(f"Attach at most {max_count} photos")
    for photo in photos:
        p = (photo or "").strip()
        if len(p) > MAX_PHOTO_CHARS:
            raise ValueError("Photo is too large")
        if _PHOTO_DATA_URL.match(p) or p.startswith("https://") or (p.startswith("/") and not p.startswith("//")):
            continue
        raise ValueError("Photos must be JPG, PNG, WebP or GIF images")
    return photos

# User Roles
UserRole = Literal['CUSTOMER', 'EMPLOYEE', 'ADMIN']
ServiceType = Literal['GETTING', 'REPAIR']

RequestStatus = Literal[
    'Submitted',
    'Accepted',
    'Employee Assigned',
    'Pickup Scheduled',
    'Bat Picked Up',
    'Inspection',
    'Repair Estimate',
    'Awaiting Customer Approval',
    'Repair Approved',
    'Repair in Progress',
    'Getting in Progress',
    'Getting Completed',
    'Repair Completed',
    'Out for Delivery',
    'Delivered',
    'Payment Pending',
    'Payment Collected',
    'Completed',
    'Repair Declined',
    'Completed Without Repair',
    'Cancelled'
]

BatConditionAtPickup = Literal['Good', 'Minor Damage', 'Damaged', 'Broken', 'Other']
PaymentMethod = Literal['Cash', 'UPI', 'Other']

# Sub-schemas
class AddressSchema(BaseModel):
    model_config = FINITE
    id: Optional[str] = None
    label: Literal['Home', 'Office', 'Other'] = 'Home'
    houseFlat: str
    street: str
    area: str
    city: str = 'Visakhapatnam'
    state: str = 'Andhra Pradesh'
    pincode: str
    landmark: Optional[str] = None
    distanceKm: float = 0.0
    isDefault: Optional[bool] = False
    lat: Optional[float] = None
    lng: Optional[float] = None
    # How distanceKm was found: 'location' (server, from lat/lng), 'customer' (typed in),
    # 'staff' (corrected by the workshop). Always set by the server on bookings.
    distanceSource: Optional[Literal['location', 'customer', 'staff']] = None

class TimelineEventSchema(BaseModel):
    status: RequestStatus
    label: str
    timestamp: str
    actor: str
    notes: Optional[str] = None

class RepairEstimateSchema(BaseModel):
    model_config = FINITE
    labourCharge: float = 0.0
    materialsCharge: float = 0.0
    additionalCharges: float = 0.0
    pickupDeliveryCharge: float = 0.0
    discount: float = 0.0
    totalEstimate: float = 0.0
    expectedCompletionDate: str = ""
    inspectionNotes: str = ""
    isRevised: Optional[bool] = False
    originalEstimate: Optional[float] = None
    revisionReason: Optional[str] = None
    # Set when the customer declines: the shop's declined-repair fee at that moment.
    declinedRepairFee: Optional[float] = None

class PickupConditionSchema(BaseModel):
    condition: BatConditionAtPickup
    notes: str = ""
    photos: List[str] = []
    collectedAt: str = ""
    collectedBy: str = ""

class PaymentRecordSchema(BaseModel):
    amount: float
    method: PaymentMethod
    collectedAt: str
    collectedBy: str
    transactionNotes: Optional[str] = None

class ReviewSchema(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(max_length=1500)
    createdAt: Optional[str] = None

# Notification Schema
class AppNotificationSchema(BaseModel):
    id: str
    type: Literal['new_request', 'status_update', 'estimate_ready', 'payment', 'system']
    title: str
    message: str
    requestId: Optional[str] = None
    timestamp: str
    isRead: bool = False
    targetRoles: List[UserRole] = ['ADMIN', 'EMPLOYEE']

class NotificationCreate(BaseModel):
    type: Literal['new_request', 'status_update', 'estimate_ready', 'payment', 'system']
    title: str
    message: str
    requestId: Optional[str] = None
    targetRoles: List[UserRole] = ['ADMIN', 'EMPLOYEE']

# Employee Schema
class EmployeeSchema(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    phone: str
    role: str = 'Technician'
    userRole: UserRole = 'EMPLOYEE'
    activeJobsCount: int = 0
    avatar: Optional[str] = None
    isActive: bool = True

    class Config:
        from_attributes = True

class EmployeeCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: str
    role: str = 'Technician'
    userRole: UserRole = 'EMPLOYEE'
    password: Optional[str] = None

# Service Request Schema
class ServiceRequestSchema(BaseModel):
    id: str
    serviceType: ServiceType
    customerName: str
    customerEmail: Optional[str] = None
    customerMobile: str
    createdAt: str
    status: RequestStatus
    
    # Bat details
    batBrand: str
    batModel: str
    batType: str
    batPhotos: List[str] = []
    
    # Getting specific
    gettingType: Optional[str] = None
    stringPreference: Optional[str] = None
    stringType: Optional[str] = None
    stringTensionLbs: Optional[int] = None
    gettingPrice: Optional[float] = None
    colour: Optional[str] = None
    
    # Repair specific
    repairIssue: Optional[str] = None
    repairDescription: Optional[str] = None
    pickupDate: Optional[str] = None
    targetDate: Optional[str] = None
    expectedDeliveryDate: Optional[str] = None
    repairEstimate: Optional[RepairEstimateSchema] = None
    previousEstimate: Optional[RepairEstimateSchema] = None
    
    # Location & Distance
    pickupAddress: AddressSchema
    distanceKm: float
    pickupDeliveryCharge: float
    isFreeDelivery: bool
    
    # Staff & Pickup
    assignedEmployeeId: Optional[str] = None
    assignedEmployeeName: Optional[str] = None
    pickupCondition: Optional[PickupConditionSchema] = None
    
    # Financial & Payment
    serviceCharge: float
    discount: float = 0.0
    totalAmount: float
    paymentStatus: Literal['Pending', 'Paid', 'Not Applicable'] = 'Pending'
    paymentRecord: Optional[PaymentRecordSchema] = None
    
    # Audit & Timeline
    timeline: List[TimelineEventSchema] = []
    additionalNotes: Optional[str] = None
    review: Optional[ReviewSchema] = None

class RequestCreate(BaseModel):
    model_config = FINITE
    serviceType: ServiceType = 'GETTING'
    customerName: str = Field(max_length=80)
    customerEmail: Optional[str] = Field(default=None, max_length=200)  # ignored; customers are identified by mobile
    customerMobile: str = Field(max_length=40)
    batBrand: str = Field(max_length=60)
    batModel: str = Field(max_length=120)
    batType: str = Field(default='Even Balance (All-Round)', max_length=80)
    batPhotos: List[str] = []
    gettingType: Optional[str] = Field(default=None, max_length=120)
    stringPreference: Optional[str] = Field(default=None, max_length=120)
    stringType: Optional[str] = Field(default=None, max_length=120)
    stringTensionLbs: Optional[int] = Field(default=None, ge=10, le=40)
    gettingPrice: Optional[float] = None  # ignored; the server prices the package
    colour: Optional[str] = Field(default=None, max_length=60)
    repairIssue: Optional[str] = Field(default=None, max_length=200)
    repairDescription: Optional[str] = Field(default=None, max_length=2000)
    pickupAddress: AddressSchema
    distanceKm: float = 12.0
    serviceCharge: Optional[float] = None  # ignored
    additionalNotes: Optional[str] = Field(default=None, max_length=2000)
    pickupDate: Optional[str] = Field(default=None, max_length=30)  # YYYY-MM-DD, validated against availability

    @field_validator("batPhotos")
    @classmethod
    def _photos(cls, v: List[str]) -> List[str]:
        return check_photo_urls(v, 6)

    @field_validator("pickupAddress")
    @classmethod
    def _address_lengths(cls, a: AddressSchema) -> AddressSchema:
        limits = {"id": 60, "houseFlat": 200, "street": 200, "area": 120, "city": 80, "state": 80,
                  "pincode": 12, "landmark": 200}
        for field, limit in limits.items():
            if len(getattr(a, field) or "") > limit:
                raise ValueError(f"Address {field} must be at most {limit} characters")
        return a

class RequestStatusUpdate(BaseModel):
    status: RequestStatus
    actor: str = "Admin"
    notes: Optional[str] = None

class AssignEmployeeRequest(BaseModel):
    employeeId: str

class RecordPickupConditionRequest(BaseModel):
    condition: BatConditionAtPickup
    notes: str = Field(default="", max_length=2000)
    photos: List[str] = []
    collectedBy: Optional[str] = Field(default=None, max_length=80)

    @field_validator("photos")
    @classmethod
    def _photos(cls, v: List[str]) -> List[str]:
        return check_photo_urls(v, 10)

class PriceRevisionRequest(BaseModel):
    model_config = FINITE
    additionalAmount: float = Field(le=MAX_AMOUNT)
    newTotal: float
    reason: str = Field(max_length=500)

class RecordPaymentRequest(BaseModel):
    model_config = FINITE
    amount: float = Field(le=MAX_AMOUNT)
    method: PaymentMethod
    notes: Optional[str] = Field(default=None, max_length=500)
    collectedBy: Optional[str] = Field(default=None, max_length=80)

# Distance & Pricing Configuration
class SlabConfig(BaseModel):
    model_config = FINITE
    minKm: float
    maxKm: float
    price: float

class DistancePricingConfigSchema(BaseModel):
    model_config = FINITE
    shopLocationName: str
    shopLat: float
    shopLng: float
    freeRadiusKm: float = 10.0
    perKmRateBeyondFree: float = 15.0
    pricingMethod: Literal['PER_KM', 'SLAB'] = 'PER_KM'
    maxServiceDistanceKm: float = 35.0
    slabs: List[SlabConfig] = []

class DistanceCalculationRequest(BaseModel):
    model_config = FINITE
    distanceKm: Optional[float] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

class DistanceCalculationResponse(BaseModel):
    distanceKm: float
    charge: float
    isFree: bool
    chargeableKm: float

# Service Tiers
class GettingServiceTierSchema(BaseModel):
    model_config = FINITE
    id: str
    name: str
    price: float = Field(ge=0, le=MAX_AMOUNT)
    turnaround: str
    description: str
    features: List[str] = []
    isActive: bool = True

class RepairCategoryTierSchema(BaseModel):
    model_config = FINITE
    id: str
    name: str
    basePrice: float = Field(ge=0, le=MAX_AMOUNT)
    turnaround: str
    description: str
    slaDays: int = 7
    isActive: bool = True

# Audit
class AuditLogSchema(BaseModel):
    id: str
    timestamp: str
    user: str
    role: UserRole
    action: str
    requestId: str
    details: Optional[str] = None



# Auth Schemas
class LoginCredentials(BaseModel):
    phone: str  # 10-digit Indian mobile number (any common format)
    password: Optional[str] = None  # staff / admin
    otp: Optional[str] = None  # customers (SMS code)
    role: UserRole = 'CUSTOMER'

class AuthSessionResponse(BaseModel):
    isLoggedIn: bool
    token: str
    role: UserRole
    name: str
    mobile: str  # +91XXXXXXXXXX
    title: Optional[str] = None
    activeView: Optional[str] = None
    customerSubView: Optional[str] = None
    employeeSubView: Optional[str] = None
    adminSubView: Optional[str] = None
    isNewCustomer: bool = False

class OtpRequest(BaseModel):
    phone: str

class CustomerCreate(BaseModel):
    name: str = Field(max_length=80)
    address: Optional[str] = Field(default=None, max_length=300)

class CustomerResponse(BaseModel):
    id: str
    name: str
    phone: str
    address: Optional[str] = None
    createdAt: str


# ---------------- Website content ----------------

BannerCtaTarget = Literal['stringing', 'repair', 'strings', 'rackets', 'tshirts', 'courts', 'tournaments', 'url', 'none']
BannerPlacement = Literal['hero', 'promo', 'announcement']
ReviewStatus = Literal['pending', 'approved', 'hidden']
DocumentCategory = Literal['Price List', 'Terms & Conditions', 'Warranty', 'Policy', 'Guide', 'Internal', 'Other']
DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


class OrmModel(BaseModel):
    class Config:
        from_attributes = True


class MediaResponse(BaseModel):
    id: str
    url: str
    contentType: str
    size: int
    fileName: Optional[str] = None


class BannerBase(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    subtitle: Optional[str] = Field(default=None, max_length=300)
    badge: Optional[str] = Field(default=None, max_length=40)
    ctaLabel: Optional[str] = Field(default=None, max_length=40)
    ctaTarget: BannerCtaTarget = 'none'
    ctaUrl: Optional[str] = Field(default=None, max_length=500)
    # Required for slideshow and promo banners; announcements may be text only.
    desktopImageUrl: Optional[str] = Field(default=None, max_length=500)
    mobileImageUrl: Optional[str] = Field(default=None, max_length=500)
    placement: BannerPlacement = 'hero'
    isActive: bool = True
    startsAt: Optional[str] = Field(default=None, pattern=DATE_PATTERN)
    endsAt: Optional[str] = Field(default=None, pattern=DATE_PATTERN)


class BannerCreate(BannerBase):
    sortOrder: Optional[int] = None


class BannerUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    subtitle: Optional[str] = Field(default=None, max_length=300)
    badge: Optional[str] = Field(default=None, max_length=40)
    ctaLabel: Optional[str] = Field(default=None, max_length=40)
    ctaTarget: Optional[BannerCtaTarget] = None
    ctaUrl: Optional[str] = Field(default=None, max_length=500)
    desktopImageUrl: Optional[str] = Field(default=None, max_length=500)
    mobileImageUrl: Optional[str] = Field(default=None, max_length=500)
    placement: Optional[BannerPlacement] = None
    isActive: Optional[bool] = None
    sortOrder: Optional[int] = None
    startsAt: Optional[str] = Field(default=None, pattern=DATE_PATTERN)
    endsAt: Optional[str] = Field(default=None, pattern=DATE_PATTERN)


class BannerSchema(BannerBase, OrmModel):
    id: str
    sortOrder: int = 0
    createdAt: str


class ReorderRequest(BaseModel):
    ids: List[str]


class StringVariantBase(BaseModel):
    colour: str = Field(min_length=1, max_length=60)
    colourHex: Optional[str] = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    imageUrl: Optional[str] = Field(default=None, max_length=500)
    inStock: bool = True


class StringVariantCreate(StringVariantBase):
    sortOrder: Optional[int] = None


class StringVariantUpdate(BaseModel):
    colour: Optional[str] = Field(default=None, min_length=1, max_length=60)
    colourHex: Optional[str] = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    imageUrl: Optional[str] = Field(default=None, max_length=500)
    inStock: Optional[bool] = None
    sortOrder: Optional[int] = None


class StringVariantSchema(StringVariantBase, OrmModel):
    id: str
    productId: str
    sortOrder: int = 0


class StringProductBase(BaseModel):
    brand: str = Field(default="Hundred", min_length=1, max_length=60)
    code: Optional[str] = Field(default=None, max_length=40)
    name: str = Field(min_length=1, max_length=120)
    gauge: Optional[str] = Field(default=None, max_length=40)
    price: Optional[float] = Field(default=None, ge=0)
    description: Optional[str] = Field(default=None, max_length=1000)
    isFeatured: bool = False
    isActive: bool = True


class StringProductCreate(StringProductBase):
    sortOrder: Optional[int] = None


class StringProductUpdate(BaseModel):
    brand: Optional[str] = Field(default=None, min_length=1, max_length=60)
    code: Optional[str] = Field(default=None, max_length=40)
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    gauge: Optional[str] = Field(default=None, max_length=40)
    price: Optional[float] = Field(default=None, ge=0)
    description: Optional[str] = Field(default=None, max_length=1000)
    isFeatured: Optional[bool] = None
    isActive: Optional[bool] = None
    sortOrder: Optional[int] = None


class StringProductSchema(StringProductBase, OrmModel):
    id: str
    sortOrder: int = 0
    variants: List[StringVariantSchema] = []
    inStockCount: int = 0
    createdAt: str


class StockUpdate(BaseModel):
    inStock: bool


class RacketBase(BaseModel):
    brand: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=120)
    price: Optional[float] = Field(default=None, ge=0)
    tag: Optional[str] = Field(default=None, max_length=30)
    weight: Optional[str] = Field(default=None, max_length=40)
    balance: Optional[str] = Field(default=None, max_length=40)
    flex: Optional[str] = Field(default=None, max_length=40)
    maxTension: Optional[str] = Field(default=None, max_length=40)
    description: Optional[str] = Field(default=None, max_length=1500)
    images: List[str] = Field(default_factory=list, max_length=6)
    inStock: bool = True
    isFeatured: bool = False
    isActive: bool = True


class RacketCreate(RacketBase):
    sortOrder: Optional[int] = None


class RacketUpdate(BaseModel):
    brand: Optional[str] = Field(default=None, min_length=1, max_length=40)
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    price: Optional[float] = Field(default=None, ge=0)
    tag: Optional[str] = Field(default=None, max_length=30)
    weight: Optional[str] = Field(default=None, max_length=40)
    balance: Optional[str] = Field(default=None, max_length=40)
    flex: Optional[str] = Field(default=None, max_length=40)
    maxTension: Optional[str] = Field(default=None, max_length=40)
    description: Optional[str] = Field(default=None, max_length=1500)
    images: Optional[List[str]] = Field(default=None, max_length=6)
    inStock: Optional[bool] = None
    isFeatured: Optional[bool] = None
    isActive: Optional[bool] = None
    sortOrder: Optional[int] = None


class RacketSchema(RacketBase, OrmModel):
    id: str
    sortOrder: int = 0
    createdAt: str


class ReviewSubmission(BaseModel):
    authorName: str = Field(min_length=2, max_length=60)
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=10, max_length=1500)
    serviceType: Optional[str] = Field(default=None, max_length=40)
    location: Optional[str] = Field(default=None, max_length=60)


class ReviewModerationUpdate(BaseModel):
    status: Optional[ReviewStatus] = None
    isFeatured: Optional[bool] = None
    adminReply: Optional[str] = Field(default=None, max_length=1000)


class CustomerReviewSchema(OrmModel):
    id: str
    authorName: str
    rating: int
    comment: str
    serviceType: Optional[str] = None
    location: Optional[str] = None
    status: ReviewStatus
    isFeatured: bool = False
    isVerified: bool = False
    requestId: Optional[str] = None
    adminReply: Optional[str] = None
    createdAt: str


class ReviewSummary(BaseModel):
    average: float
    count: int
    distribution: dict


class PublicReviewsResponse(BaseModel):
    summary: ReviewSummary
    reviews: List[CustomerReviewSchema]


class DocumentBase(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    category: DocumentCategory = 'Other'
    fileUrl: str = Field(min_length=1, max_length=500)
    fileName: Optional[str] = Field(default=None, max_length=200)
    contentType: Optional[str] = Field(default=None, max_length=100)
    isPublic: bool = True


class DocumentCreate(DocumentBase):
    sortOrder: Optional[int] = None


class DocumentUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    category: Optional[DocumentCategory] = None
    fileUrl: Optional[str] = Field(default=None, min_length=1, max_length=500)
    fileName: Optional[str] = Field(default=None, max_length=200)
    contentType: Optional[str] = Field(default=None, max_length=100)
    isPublic: Optional[bool] = None
    sortOrder: Optional[int] = None


class DocumentSchema(DocumentBase, OrmModel):
    id: str
    sortOrder: int = 0
    createdAt: str


class ClosedDateSchema(BaseModel):
    date: str = Field(pattern=DATE_PATTERN)
    reason: Optional[str] = Field(default=None, max_length=80)


class AvailabilitySettingsSchema(OrmModel):
    openWeekdays: List[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4, 5])
    dailyPickupCapacity: int = Field(default=0, ge=0, le=500)
    leadTimeDays: int = Field(default=0, ge=0, le=30)
    bookingWindowDays: int = Field(default=30, ge=1, le=180)
    pickupSlots: List[str] = []
    closedDates: List[ClosedDateSchema] = []
    notice: Optional[str] = Field(default=None, max_length=300)


class AvailabilityDaySchema(BaseModel):
    date: str
    available: bool
    reason: Optional[str] = None
    remaining: Optional[int] = None


class PublicAvailabilitySchema(BaseModel):
    settings: AvailabilitySettingsSchema
    days: List[AvailabilityDaySchema]


# ---------------- Events ----------------
# Lengths here are generous hard caps; the router applies the friendlier, tighter limits
# (with readable error messages) in _clean_event / register_for_event.

SiteEventCategory = Literal['tournament', 'coaching_camp', 'clinic', 'store_event', 'other']
EventRegistrationMode = Literal['form', 'whatsapp', 'phone', 'url', 'none']
EventStatus = Literal['upcoming', 'ongoing', 'past']
EventRegistrationStatus = Literal['registered', 'cancelled']


class EventBase(BaseModel):
    title: str = Field(max_length=300)
    category: SiteEventCategory = 'tournament'
    summary: Optional[str] = Field(default=None, max_length=1000)
    description: Optional[str] = Field(default=None, max_length=10000)
    startDate: str = Field(max_length=20)
    endDate: Optional[str] = Field(default=None, max_length=20)
    timeText: Optional[str] = Field(default=None, max_length=300)
    venue: str = Field(max_length=500)
    venueMapUrl: Optional[str] = Field(default=None, max_length=1000)
    entryFee: Optional[float] = None
    feeNote: Optional[str] = Field(default=None, max_length=300)
    categories: List[str] = Field(default_factory=list, max_length=50)
    registrationMode: EventRegistrationMode = 'none'
    registrationUrl: Optional[str] = Field(default=None, max_length=1000)
    registrationDeadline: Optional[str] = Field(default=None, max_length=20)
    capacity: Optional[int] = None
    bannerImageUrl: str = Field(max_length=1000)
    mobileImageUrl: Optional[str] = Field(default=None, max_length=1000)
    showAsBanner: bool = True
    isActive: bool = True


class EventCreate(EventBase):
    sortOrder: Optional[int] = None


class EventUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=300)
    category: Optional[SiteEventCategory] = None
    summary: Optional[str] = Field(default=None, max_length=1000)
    description: Optional[str] = Field(default=None, max_length=10000)
    startDate: Optional[str] = Field(default=None, max_length=20)
    endDate: Optional[str] = Field(default=None, max_length=20)
    timeText: Optional[str] = Field(default=None, max_length=300)
    venue: Optional[str] = Field(default=None, max_length=500)
    venueMapUrl: Optional[str] = Field(default=None, max_length=1000)
    entryFee: Optional[float] = None
    feeNote: Optional[str] = Field(default=None, max_length=300)
    categories: Optional[List[str]] = Field(default=None, max_length=50)
    registrationMode: Optional[EventRegistrationMode] = None
    registrationUrl: Optional[str] = Field(default=None, max_length=1000)
    registrationDeadline: Optional[str] = Field(default=None, max_length=20)
    capacity: Optional[int] = None
    bannerImageUrl: Optional[str] = Field(default=None, max_length=1000)
    mobileImageUrl: Optional[str] = Field(default=None, max_length=1000)
    showAsBanner: Optional[bool] = None
    isActive: Optional[bool] = None
    sortOrder: Optional[int] = None


class EventSchema(EventBase, OrmModel):
    id: str
    sortOrder: int = 0
    createdAt: str
    # Computed by the server (Asia/Kolkata dates)
    status: EventStatus
    registrationOpen: bool
    registrationCount: int = 0
    spotsLeft: Optional[int] = None


class EventRegistrationCreate(BaseModel):
    name: str = Field(max_length=300)
    mobile: str = Field(max_length=40)
    partnerName: Optional[str] = Field(default=None, max_length=300)
    playCategory: Optional[str] = Field(default=None, max_length=300)
    notes: Optional[str] = Field(default=None, max_length=3000)


class EventRegistrationUpdate(BaseModel):
    status: EventRegistrationStatus


class EventRegistrationSchema(OrmModel):
    id: str
    eventId: str
    name: str
    mobile: str
    partnerName: Optional[str] = None
    playCategory: Optional[str] = None
    notes: Optional[str] = None
    status: EventRegistrationStatus
    createdAt: str


class PublicSiteContent(BaseModel):
    events: List[EventSchema] = []
    banners: List[BannerSchema]
    strings: List[StringProductSchema]
    rackets: List[RacketSchema]
    reviews: PublicReviewsResponse
    documents: List[DocumentSchema]
    availability: PublicAvailabilitySchema


# ---------------- Shop settings (admin-editable shop details) ----------------

class ShopSettingsSchema(BaseModel):
    model_config = FINITE
    name: str
    tagline: str = ""
    phone: str
    whatsapp: str
    email: Optional[str] = None
    addressLine: str
    area: str
    pincode: Optional[str] = None
    mapsUrl: Optional[str] = None
    openingHours: str = ""
    declinedRepairFee: float = 0


class PublicSiteContentWithShop(PublicSiteContent):
    shop: ShopSettingsSchema


# ---------------- Customers (admin) ----------------

class CustomerSummarySchema(BaseModel):
    id: str
    name: str
    phone: str
    address: Optional[str] = None
    createdAt: str
    bookings: int = 0
    openBookings: int = 0
    lastBookingAt: Optional[str] = None
    totalPaid: float = 0


class CustomerRequestSummarySchema(BaseModel):
    id: str
    serviceType: str
    status: str
    paymentStatus: Optional[str] = None
    totalAmount: float = 0
    createdAt: str
    batBrand: Optional[str] = None
    batModel: Optional[str] = None


class CustomerDetailSchema(BaseModel):
    customer: CustomerSummarySchema
    requests: List[CustomerRequestSummarySchema] = []


# ---------------- Shop: apparel catalogue, cart quotes and orders ----------------
# Mirrors src/types/shop.ts. Lengths here are generous hard caps; app/routers/shop.py applies
# the tighter limits with readable error messages.

ApparelCategory = Literal['t-shirt', 'jersey', 'shorts', 'track', 'accessory']
FulfilmentMethod = Literal['delivery', 'pickup']
OrderStatus = Literal[
    'Placed',
    'Confirmed',
    'Packed',
    'Out for Delivery',
    'Ready for Pickup',
    'Delivered',
    'Picked Up',
    'Cancelled',
]


class ApparelVariantCreate(BaseModel):
    model_config = FINITE
    size: str = Field(max_length=200)
    colour: str = Field(max_length=200)
    colourHex: Optional[str] = Field(default=None, max_length=20)
    stock: int = 0
    sku: Optional[str] = Field(default=None, max_length=200)
    sortOrder: Optional[int] = None


class ApparelVariantUpdate(BaseModel):
    model_config = FINITE
    size: Optional[str] = Field(default=None, max_length=200)
    colour: Optional[str] = Field(default=None, max_length=200)
    colourHex: Optional[str] = Field(default=None, max_length=20)
    stock: Optional[int] = None
    sku: Optional[str] = Field(default=None, max_length=200)
    sortOrder: Optional[int] = None


class ApparelVariantSchema(OrmModel):
    id: str
    productId: str
    size: str
    colour: str
    colourHex: Optional[str] = None
    stock: int = 0
    sku: Optional[str] = None
    sortOrder: int = 0


class ApparelColourOption(BaseModel):
    colour: str
    colourHex: Optional[str] = None


class ApparelProductCreate(BaseModel):
    model_config = FINITE
    name: str = Field(max_length=500)
    category: ApparelCategory = 't-shirt'
    description: Optional[str] = Field(default=None, max_length=5000)
    fabric: Optional[str] = Field(default=None, max_length=500)
    fit: Optional[str] = Field(default=None, max_length=500)
    price: float
    images: List[str] = Field(default_factory=list, max_length=50)
    customisable: bool = False
    isFeatured: bool = False
    isActive: bool = True
    sortOrder: Optional[int] = None


class ApparelProductUpdate(BaseModel):
    model_config = FINITE
    name: Optional[str] = Field(default=None, max_length=500)
    category: Optional[ApparelCategory] = None
    description: Optional[str] = Field(default=None, max_length=5000)
    fabric: Optional[str] = Field(default=None, max_length=500)
    fit: Optional[str] = Field(default=None, max_length=500)
    price: Optional[float] = None
    images: Optional[List[str]] = Field(default=None, max_length=50)
    customisable: Optional[bool] = None
    isFeatured: Optional[bool] = None
    isActive: Optional[bool] = None
    sortOrder: Optional[int] = None


class ApparelProductSchema(BaseModel):
    id: str
    name: str
    category: ApparelCategory
    description: Optional[str] = None
    fabric: Optional[str] = None
    fit: Optional[str] = None
    price: float
    images: List[str] = []
    customisable: bool = False
    isFeatured: bool = False
    isActive: bool = True
    sortOrder: int = 0
    createdAt: str
    variants: List[ApparelVariantSchema] = []
    # Computed by the server
    inStock: bool = False
    sizes: List[str] = []
    colours: List[ApparelColourOption] = []


class OrderAddressSchema(BaseModel):
    """Delivery address (same shape as Address in src/types/index.ts). Every field has a
    default so a half-filled address can still be quoted; placing an order checks the
    required parts (house / flat, area, 6-digit pincode)."""
    model_config = FINITE
    id: Optional[str] = Field(default=None, max_length=60)
    label: Literal['Home', 'Office', 'Other'] = 'Home'
    houseFlat: str = Field(default="", max_length=200)
    street: str = Field(default="", max_length=200)
    area: str = Field(default="", max_length=120)
    city: str = Field(default='Visakhapatnam', max_length=80)
    state: str = Field(default='Andhra Pradesh', max_length=80)
    pincode: str = Field(default="", max_length=12)
    landmark: Optional[str] = Field(default=None, max_length=200)
    distanceKm: float = 0.0
    isDefault: Optional[bool] = False
    lat: Optional[float] = None
    lng: Optional[float] = None
    distanceSource: Optional[Literal['location', 'customer', 'staff']] = None


class CartLineInput(BaseModel):
    model_config = FINITE
    kind: str = Field(max_length=20)  # 'apparel' | 'racket' | 'string'; anything else is reported as unavailable
    productId: str = Field(min_length=1, max_length=80)
    variantId: Optional[str] = Field(default=None, max_length=80)
    quantity: int


class QuoteInput(BaseModel):
    model_config = FINITE
    items: List[CartLineInput] = Field(default_factory=list, max_length=100)
    fulfilment: FulfilmentMethod = 'pickup'
    address: Optional[OrderAddressSchema] = None


class PlaceOrderInput(QuoteInput):
    notes: Optional[str] = Field(default=None, max_length=300)


class OrderLineSchema(BaseModel):
    kind: str
    productId: str
    variantId: Optional[str] = None
    name: str
    detail: Optional[str] = None
    unitPrice: float
    quantity: int
    lineTotal: float
    image: Optional[str] = None


class UnavailableLineSchema(BaseModel):
    kind: str
    productId: str
    variantId: Optional[str] = None
    name: Optional[str] = None
    reason: str


class OrderQuoteSchema(BaseModel):
    items: List[OrderLineSchema] = []
    unavailable: List[UnavailableLineSchema] = []
    subtotal: float = 0.0
    deliveryCharge: float = 0.0
    distanceKm: Optional[float] = None
    total: float = 0.0
    outsideDeliveryArea: bool = False


class OrderTimelineEntrySchema(BaseModel):
    status: str
    label: str
    timestamp: str
    actor: str
    notes: Optional[str] = None


class ShopOrderSchema(OrmModel):
    id: str
    customerName: str
    customerMobile: str
    createdAt: str
    status: OrderStatus
    fulfilment: FulfilmentMethod
    address: Optional[OrderAddressSchema] = None
    distanceKm: Optional[float] = None
    items: List[OrderLineSchema] = []
    subtotal: float = 0.0
    deliveryCharge: float = 0.0
    total: float = 0.0
    paymentStatus: Literal['Pending', 'Paid'] = 'Pending'
    paymentMethod: Optional[PaymentMethod] = None
    paidAt: Optional[str] = None
    notes: Optional[str] = None
    cancelReason: Optional[str] = None
    timeline: List[OrderTimelineEntrySchema] = []


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    notes: Optional[str] = Field(default=None, max_length=300)


class OrderPaymentInput(BaseModel):
    model_config = FINITE
    amount: float = Field(le=MAX_AMOUNT)
    method: PaymentMethod
    notes: Optional[str] = Field(default=None, max_length=300)


class OrderCancelInput(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=300)


# ---------------- Court booking: venues, courts, blocked times, availability, bookings ----------------
# Mirrors src/types/courts.ts. Lengths here are generous hard caps; app/routers/courts.py applies
# the tighter limits with readable error messages.

CourtBookingStatus = Literal['Confirmed', 'Completed', 'No-show', 'Cancelled']
SlotState = Literal['free', 'booked', 'blocked', 'past']


class CourtSchema(OrmModel):
    id: str
    venueId: str
    name: str
    surface: Optional[str] = None
    isActive: bool = True
    sortOrder: int = 0


class CourtCreate(BaseModel):
    model_config = FINITE
    name: str = Field(max_length=200)
    surface: Optional[str] = Field(default=None, max_length=200)
    isActive: bool = True
    sortOrder: Optional[int] = None


class CourtUpdate(BaseModel):
    model_config = FINITE
    name: Optional[str] = Field(default=None, max_length=200)
    surface: Optional[str] = Field(default=None, max_length=200)
    isActive: Optional[bool] = None
    sortOrder: Optional[int] = None


class CourtVenueSchema(BaseModel):
    id: str
    name: str
    address: str
    area: Optional[str] = None
    mapsUrl: Optional[str] = None
    description: Optional[str] = None
    photos: List[str] = []
    amenities: List[str] = []
    rules: Optional[str] = None
    openTime: str
    closeTime: str
    slotMinutes: int
    pricePerHour: float
    peakPricePerHour: Optional[float] = None
    peakStart: Optional[str] = None
    peakEnd: Optional[str] = None
    weekendPricePerHour: Optional[float] = None
    advanceDays: int
    maxSlotsPerBooking: int
    cancellationHours: int
    isActive: bool = True
    sortOrder: int = 0
    createdAt: str
    courts: List[CourtSchema] = []


class CourtVenueCreate(BaseModel):
    model_config = FINITE
    name: str = Field(max_length=500)
    address: str = Field(max_length=1000)
    area: Optional[str] = Field(default=None, max_length=500)
    mapsUrl: Optional[str] = Field(default=None, max_length=1000)
    description: Optional[str] = Field(default=None, max_length=5000)
    photos: List[str] = Field(default_factory=list, max_length=50)
    amenities: List[str] = Field(default_factory=list, max_length=50)
    rules: Optional[str] = Field(default=None, max_length=5000)
    openTime: str = Field(max_length=10)
    closeTime: str = Field(max_length=10)
    slotMinutes: int = 60
    pricePerHour: float
    peakPricePerHour: Optional[float] = None
    peakStart: Optional[str] = Field(default=None, max_length=10)
    peakEnd: Optional[str] = Field(default=None, max_length=10)
    weekendPricePerHour: Optional[float] = None
    advanceDays: int = 14
    maxSlotsPerBooking: int = 4
    cancellationHours: int = 12
    isActive: bool = True
    sortOrder: Optional[int] = None


class CourtVenueUpdate(BaseModel):
    model_config = FINITE
    name: Optional[str] = Field(default=None, max_length=500)
    address: Optional[str] = Field(default=None, max_length=1000)
    area: Optional[str] = Field(default=None, max_length=500)
    mapsUrl: Optional[str] = Field(default=None, max_length=1000)
    description: Optional[str] = Field(default=None, max_length=5000)
    photos: Optional[List[str]] = Field(default=None, max_length=50)
    amenities: Optional[List[str]] = Field(default=None, max_length=50)
    rules: Optional[str] = Field(default=None, max_length=5000)
    openTime: Optional[str] = Field(default=None, max_length=10)
    closeTime: Optional[str] = Field(default=None, max_length=10)
    slotMinutes: Optional[int] = None
    pricePerHour: Optional[float] = None
    peakPricePerHour: Optional[float] = None
    peakStart: Optional[str] = Field(default=None, max_length=10)
    peakEnd: Optional[str] = Field(default=None, max_length=10)
    weekendPricePerHour: Optional[float] = None
    advanceDays: Optional[int] = None
    maxSlotsPerBooking: Optional[int] = None
    cancellationHours: Optional[int] = None
    isActive: Optional[bool] = None
    sortOrder: Optional[int] = None


class CourtBlockSchema(OrmModel):
    id: str
    venueId: str
    courtId: Optional[str] = None
    date: Optional[str] = None
    weekdays: Optional[List[int]] = None
    fromDate: Optional[str] = None
    toDate: Optional[str] = None
    startTime: str
    endTime: str
    reason: str
    createdAt: str


class CourtBlockCreate(BaseModel):
    model_config = FINITE
    venueId: str = Field(max_length=80)
    courtId: Optional[str] = Field(default=None, max_length=80)
    date: Optional[str] = Field(default=None, max_length=20)
    weekdays: Optional[List[int]] = Field(default=None, max_length=7)
    fromDate: Optional[str] = Field(default=None, max_length=20)
    toDate: Optional[str] = Field(default=None, max_length=20)
    startTime: str = Field(max_length=10)
    endTime: str = Field(max_length=10)
    reason: str = Field(max_length=500)


class AvailabilityCellSchema(BaseModel):
    start: str
    end: str
    state: SlotState
    price: float


class CourtAvailabilitySchema(BaseModel):
    courtId: str
    courtName: str
    surface: Optional[str] = None
    cells: List[AvailabilityCellSchema] = []


class VenueAvailabilitySchema(BaseModel):
    venueId: str
    date: str
    slotMinutes: int
    bookable: bool
    message: Optional[str] = None
    courts: List[CourtAvailabilitySchema] = []


class CourtBookingSchema(BaseModel):
    id: str
    venueId: str
    venueName: str
    courtId: str
    courtName: str
    date: str
    startTime: str
    endTime: str
    slots: int
    price: float
    customerName: str
    customerMobile: str
    players: Optional[int] = None
    notes: Optional[str] = None
    status: CourtBookingStatus
    paymentStatus: Literal['Pending', 'Paid'] = 'Pending'
    paymentMethod: Optional[PaymentMethod] = None
    paidAt: Optional[str] = None
    bookedBy: Literal['customer', 'admin'] = 'customer'
    cancelReason: Optional[str] = None
    canCancel: bool = False
    createdAt: str
    timeline: List[OrderTimelineEntrySchema] = []


class CourtBookingCreate(BaseModel):
    model_config = FINITE
    venueId: str = Field(max_length=80)
    courtId: str = Field(max_length=80)
    date: str = Field(max_length=20)
    startTime: str = Field(max_length=10)
    slots: int
    players: Optional[int] = None
    notes: Optional[str] = Field(default=None, max_length=1000)
    # Admin walk-in / phone bookings only (ignored for customers):
    customerName: Optional[str] = Field(default=None, max_length=200)
    customerMobile: Optional[str] = Field(default=None, max_length=40)


class CourtBookingCancelInput(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=1000)


class CourtBookingStatusUpdate(BaseModel):
    status: Literal['Completed', 'No-show']
    notes: Optional[str] = Field(default=None, max_length=300)


class CourtBookingPaymentInput(BaseModel):
    model_config = FINITE
    amount: float = Field(le=MAX_AMOUNT)
    method: PaymentMethod
    notes: Optional[str] = Field(default=None, max_length=300)
