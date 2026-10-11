from typing import Optional, List, Literal, Any
from pydantic import BaseModel, Field

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
    id: Optional[str] = None
    label: Literal['Home', 'Office', 'Other'] = 'Home'
    houseFlat: str
    street: str
    area: str
    city: str = 'Bengaluru'
    state: str = 'Karnataka'
    pincode: str
    landmark: Optional[str] = None
    distanceKm: float = 0.0
    isDefault: Optional[bool] = False
    lat: Optional[float] = None
    lng: Optional[float] = None

class TimelineEventSchema(BaseModel):
    status: RequestStatus
    label: str
    timestamp: str
    actor: str
    notes: Optional[str] = None

class RepairEstimateSchema(BaseModel):
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
    comment: str
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
    email: str
    phone: str
    role: str = 'Technician'
    userRole: UserRole = 'EMPLOYEE'
    activeJobsCount: int = 0
    avatar: Optional[str] = None
    password: Optional[str] = None
    isActive: bool = True

class EmployeeCreate(BaseModel):
    name: str
    email: str
    phone: str
    role: str = 'Technician'
    userRole: UserRole = 'EMPLOYEE'
    password: Optional[str] = None

# Service Request Schema
class ServiceRequestSchema(BaseModel):
    id: str
    serviceType: ServiceType
    customerName: str
    customerEmail: str
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
    serviceType: ServiceType = 'GETTING'
    customerName: str
    customerEmail: str
    customerMobile: str
    batBrand: str
    batModel: str
    batType: str = 'Even Balance (All-Round)'
    batPhotos: List[str] = []
    gettingType: Optional[str] = None
    stringPreference: Optional[str] = None
    stringType: Optional[str] = None
    stringTensionLbs: Optional[int] = None
    gettingPrice: Optional[float] = None
    colour: Optional[str] = None
    repairIssue: Optional[str] = None
    repairDescription: Optional[str] = None
    pickupAddress: AddressSchema
    distanceKm: float = 12.0
    serviceCharge: Optional[float] = None
    additionalNotes: Optional[str] = None

class RequestStatusUpdate(BaseModel):
    status: RequestStatus
    actor: str = "Admin"
    notes: Optional[str] = None

class AssignEmployeeRequest(BaseModel):
    employeeId: str

class RecordPickupConditionRequest(BaseModel):
    condition: BatConditionAtPickup
    notes: str = ""
    photos: List[str] = []
    collectedBy: Optional[str] = None

class PriceRevisionRequest(BaseModel):
    additionalAmount: float
    newTotal: float
    reason: str

class RecordPaymentRequest(BaseModel):
    amount: float
    method: PaymentMethod
    notes: Optional[str] = None
    collectedBy: Optional[str] = None

# Distance & Pricing Configuration
class SlabConfig(BaseModel):
    minKm: float
    maxKm: float
    price: float

class DistancePricingConfigSchema(BaseModel):
    shopLocationName: str
    shopLat: float
    shopLng: float
    freeRadiusKm: float = 10.0
    perKmRateBeyondFree: float = 15.0
    pricingMethod: Literal['PER_KM', 'SLAB'] = 'PER_KM'
    maxServiceDistanceKm: float = 35.0
    slabs: List[SlabConfig] = []

class DistanceCalculationRequest(BaseModel):
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
    id: str
    name: str
    price: float
    turnaround: str
    description: str
    features: List[str] = []
    isActive: bool = True

class RepairCategoryTierSchema(BaseModel):
    id: str
    name: str
    basePrice: float
    turnaround: str
    description: str
    slaDays: int = 7
    isActive: bool = True

# Audit & Email
class AuditLogSchema(BaseModel):
    id: str
    timestamp: str
    user: str
    role: UserRole
    action: str
    requestId: str
    details: Optional[str] = None

class EmailTemplateSchema(BaseModel):
    id: str
    name: str
    subject: str
    body: str
    category: Literal['Customer', 'Employee', 'Admin']
    variables: List[str] = []

class EmailSimulateRequest(BaseModel):
    templateId: str
    recipient: str
    variables: dict[str, Any]

# Auth Schemas
class LoginCredentials(BaseModel):
    email: str
    password: Optional[str] = None
    otp: Optional[str] = None
    role: UserRole = 'CUSTOMER'

class AuthSessionResponse(BaseModel):
    isLoggedIn: bool
    token: str
    role: UserRole
    email: str
    name: str
    mobile: str
    title: Optional[str] = None
    activeView: Optional[str] = None
    customerSubView: Optional[str] = None
    employeeSubView: Optional[str] = None
    adminSubView: Optional[str] = None

class OtpRequest(BaseModel):
    identifier: str
