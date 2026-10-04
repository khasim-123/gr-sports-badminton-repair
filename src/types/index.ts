export type UserRole = 'CUSTOMER' | 'EMPLOYEE' | 'ADMIN';

export type ServiceType = 'GETTING' | 'REPAIR';

export type RequestStatus =
  | 'Submitted'
  | 'Accepted'
  | 'Employee Assigned'
  | 'Pickup Scheduled'
  | 'Bat Picked Up'
  | 'Inspection'
  | 'Repair Estimate'
  | 'Awaiting Customer Approval'
  | 'Repair Approved'
  | 'Repair in Progress'
  | 'Getting in Progress'
  | 'Getting Completed'
  | 'Repair Completed'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Payment Pending'
  | 'Payment Collected'
  | 'Completed'
  | 'Repair Declined'
  | 'Completed Without Repair'
  | 'Cancelled';

export type BatBrand = 'Yonex' | 'Li-Ning' | 'Victor' | 'Apacs' | 'Carlton' | 'Other';

export type BatType =
  | 'Even Balance (All-Round)'
  | 'Head Heavy (Power / Smash)'
  | 'Head Light (Speed / Defense)'
  | 'Training Racket (120g+)'
  | 'Junior Racket';

export type GettingType =
  | 'Basic Getting'
  | 'Standard Getting'
  | 'Premium Getting'
  | 'Custom Getting';

export type RepairIssue =
  | 'Broken Bat'
  | 'Frame Damage'
  | 'Shaft Damage'
  | 'Handle Damage'
  | 'Joint Damage'
  | 'Grip Issue'
  | 'Other';

export type BatConditionAtPickup = 'Good' | 'Minor Damage' | 'Damaged' | 'Broken' | 'Other';

export type PaymentMethod = 'Cash' | 'UPI' | 'Other';

export interface RepairEstimate {
  labourCharge: number;
  materialsCharge: number;
  additionalCharges: number;
  pickupDeliveryCharge: number;
  discount: number;
  totalEstimate: number;
  expectedCompletionDate: string;
  inspectionNotes: string;
  isRevised?: boolean;
  originalEstimate?: number;
  revisionReason?: string;
}

export interface Address {
  id: string;
  label: 'Home' | 'Office' | 'Other';
  houseFlat: string;
  street: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  distanceKm: number;
  isDefault?: boolean;
  lat?: number;
  lng?: number;
}

export interface TimelineEvent {
  status: RequestStatus;
  label: string;
  timestamp: string;
  actor: string;
  notes?: string;
}

export interface ServiceRequest {
  id: string; // e.g. GET-00025 or REP-00025
  serviceType: ServiceType;
  customerName: string;
  customerEmail: string;
  customerMobile: string;
  createdAt: string;
  status: RequestStatus;
  
  // Bat details
  batBrand: BatBrand;
  batModel: string;
  batType: BatType;
  batPhotos: string[];
  
  // Getting specific
  gettingType?: GettingType;
  stringType?: string;
  stringTensionLbs?: number;
  gettingPrice?: number;
  
  // Repair specific
  repairIssue?: RepairIssue;
  repairDescription?: string;
  pickupDate?: string;
  targetDate?: string; // 7-day target
  expectedDeliveryDate?: string;
  repairEstimate?: RepairEstimate;
  previousEstimate?: RepairEstimate;
  
  // Location & Distance
  pickupAddress: Address;
  distanceKm: number;
  pickupDeliveryCharge: number;
  isFreeDelivery: boolean;
  
  // Staff & Pickup
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  pickupCondition?: {
    condition: BatConditionAtPickup;
    notes: string;
    photos: string[];
    collectedAt: string;
    collectedBy: string;
  };
  
  // Financial & Payment
  serviceCharge: number;
  discount: number;
  totalAmount: number;
  paymentStatus: 'Pending' | 'Paid' | 'Not Applicable';
  paymentRecord?: {
    amount: number;
    method: PaymentMethod;
    collectedAt: string;
    collectedBy: string;
    transactionNotes?: string;
  };
  
  // Audit & Timeline
  timeline: TimelineEvent[];
  additionalNotes?: string;
}

export interface DistancePricingConfig {
  shopLocationName: string;
  shopLat: number;
  shopLng: number;
  freeRadiusKm: number; // default 15, can be changed to 13 or any custom KM
  perKmRateBeyondFree: number; // e.g. 15
  pricingMethod: 'PER_KM' | 'SLAB';
  maxServiceDistanceKm: number; // e.g. 40
  slabs: {
    minKm: number;
    maxKm: number;
    price: number;
  }[];
}

export interface GettingServiceTier {
  id: string;
  name: string;
  price: number;
  turnaround: string;
  description: string;
  features: string[];
  isActive?: boolean;
}

export interface RepairCategoryTier {
  id: string;
  name: string;
  basePrice: number;
  turnaround: string;
  description: string;
  slaDays: number;
  isActive?: boolean;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'Technician' | 'Pickup & Delivery Agent' | 'Master Stringer';
  activeJobsCount: number;
  avatar: string;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  user: string;
  role: UserRole;
  action: string;
  requestId: string;
  details?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: 'Customer' | 'Employee' | 'Admin';
  variables: string[];
}
