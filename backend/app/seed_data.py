from sqlalchemy.orm import Session
from app.models import (
    DistanceConfigModel,
    EmployeeModel,
    GettingServiceTierModel,
    RepairCategoryTierModel,
    EmailTemplateModel,
    ServiceRequestModel,
    AuditLogModel,
    NotificationModel,
)

def seed_database(db: Session):
    # 1. Distance Config
    if not db.query(DistanceConfigModel).first():
        distance_config = DistanceConfigModel(
            id=1,
            shopLocationName="GR Sports Master Hub, 80 Feet Road, Indiranagar, Bengaluru",
            shopLat=12.9716,
            shopLng=77.6412,
            freeRadiusKm=10.0,
            perKmRateBeyondFree=15.0,
            pricingMethod="PER_KM",
            maxServiceDistanceKm=35.0,
            slabs=[
                {"minKm": 0, "maxKm": 10, "price": 0},
                {"minKm": 10.1, "maxKm": 20, "price": 60},
                {"minKm": 20.1, "maxKm": 25, "price": 120},
                {"minKm": 25.1, "maxKm": 30, "price": 180},
                {"minKm": 30.1, "maxKm": 35, "price": 250},
            ]
        )
        db.add(distance_config)

    # 2. Employees & Admins
    if not db.query(EmployeeModel).first():
        employees = [
            EmployeeModel(
                id="EMP-01",
                name="Rajesh Kumar",
                email="rajesh.k@grsports.in",
                phone="+91 98451 22345",
                role="Master Stringer",
                userRole="EMPLOYEE",
                activeJobsCount=4,
                avatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80",
                isActive=True
            ),
            EmployeeModel(
                id="EMP-02",
                name="Amit Verma",
                email="amit.v@grsports.in",
                phone="+91 98765 43210",
                role="Pickup & Delivery Agent",
                userRole="EMPLOYEE",
                activeJobsCount=5,
                avatar="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&h=200&q=80",
                isActive=True
            ),
            EmployeeModel(
                id="EMP-03",
                name="Sneha Patel",
                email="sneha.p@grsports.in",
                phone="+91 98112 33445",
                role="Technician",
                userRole="EMPLOYEE",
                activeJobsCount=3,
                avatar="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&h=200&q=80",
                isActive=True
            ),
            EmployeeModel(
                id="EMP-04",
                name="Priya Anand",
                email="admin@grsports.com",
                phone="+91 98451 11223",
                role="Platform Admin & Operations Lead",
                userRole="ADMIN",
                activeJobsCount=0,
                avatar="https://ui-avatars.com/api/?name=Priya+Anand&background=3b82f6&color=fff&size=200",
                isActive=True
            ),
        ]
        db.add_all(employees)

    # 3. Getting Service Tiers
    if not db.query(GettingServiceTierModel).first():
        getting_tiers = [
            GettingServiceTierModel(
                id="basic",
                name="Basic Getting",
                price=400.0,
                turnaround="24 Hours",
                description="Standard synthetic gut stringing (20–24 lbs). Good durability & tension hold for casual and club play.",
                features=["Standard Synthetic Gut", "20-24 lbs Tension Range", "Grommet Inspection", "Free Vibration Dampener"],
                isActive=True
            ),
            GettingServiceTierModel(
                id="tournament",
                name="Tournament Getting",
                price=600.0,
                turnaround="24–36 Hours",
                description="Tournament-grade multifilament string (Yonex BG80 / Aerobite) with electronic constant-pull tensioning up to 30 lbs.",
                features=["Tournament Grade Strings", "Up to 30 lbs Electronic Tension", "Constant-Pull Machine", "Grommet Cleaning"],
                isActive=True
            ),
            GettingServiceTierModel(
                id="durability",
                name="Durability Getting",
                price=500.0,
                turnaround="24 Hours",
                description="Thick gauge high-abrasion strings (Yonex BG65 / Li-Ning No.7). Engineered for maximum string lifespan and endurance.",
                features=["0.70mm High-Durability String", "22-26 lbs Tension Range", "Pre-Stretch Treatment", "Reinforced Knot Ties"],
                isActive=True
            ),
            GettingServiceTierModel(
                id="custom",
                name="Custom Getting",
                price=750.0,
                turnaround="48 Hours",
                description="Bespoke hybrid tensioning (differential mains & crosses), premium grip overwrap, and dynamic balance calibration.",
                features=["Hybrid String Setup", "Independent Cross/Main Tension", "AC102EX Premium Grip Included", "Frame Stress Load Analysis"],
                isActive=True
            ),
        ]
        db.add_all(getting_tiers)

    # 4. Repair Category Tiers
    if not db.query(RepairCategoryTierModel).first():
        repair_tiers = [
            RepairCategoryTierModel(
                id="broken",
                name="Broken Bat (Frame Fracture)",
                basePrice=400.0,
                turnaround="5–7 Days",
                description="Full structural carbon fiber splice & high-grade epoxy curing. Restores structural integrity up to 28 lbs tension.",
                slaDays=7,
                isActive=True
            ),
            RepairCategoryTierModel(
                id="frame",
                name="Frame Damage",
                basePrice=350.0,
                turnaround="4–6 Days",
                description="Hairline crack reinforcement and internal graphite sleeve insertion at 10, 12, or 2 o’clock frame positions.",
                slaDays=7,
                isActive=True
            ),
            RepairCategoryTierModel(
                id="shaft",
                name="Shaft Damage",
                basePrice=450.0,
                turnaround="5–7 Days",
                description="Shaft carbon-braid compression sleeve rebuild and flex calibration.",
                slaDays=7,
                isActive=True
            ),
            RepairCategoryTierModel(
                id="handle",
                name="Handle Damage",
                basePrice=250.0,
                turnaround="3–4 Days",
                description="Internal wooden cone replacement, polyurethane handle rebuild, and factory staple re-anchoring.",
                slaDays=5,
                isActive=True
            ),
            RepairCategoryTierModel(
                id="joint",
                name="Joint Damage (T-Joint)",
                basePrice=300.0,
                turnaround="4–5 Days",
                description="Built-in T-Joint stabilizing resin weld and torsional twist correction.",
                slaDays=6,
                isActive=True
            ),
            RepairCategoryTierModel(
                id="grip",
                name="Grip & Cushion Issue",
                basePrice=150.0,
                turnaround="1–2 Days",
                description="Wood handle antiseptic cleaning, base cushion foam replacement, and sweat-resistant overgrip application.",
                slaDays=3,
                isActive=True
            ),
            RepairCategoryTierModel(
                id="other",
                name="Other / Custom Issue",
                basePrice=200.0,
                turnaround="5–7 Days",
                description="Custom composite restoration assessed upon workshop physical inspection.",
                slaDays=7,
                isActive=True
            ),
        ]
        db.add_all(repair_tiers)

    # 5. Email Templates
    if not db.query(EmailTemplateModel).first():
        templates = [
            EmailTemplateModel(
                id="TPL-01",
                name="OTP Email",
                category="Customer",
                subject="Your GR Sports Verification Code: {otp}",
                body="Hello {customer_name},\n\nYour one-time login code for GR Sports Badminton Services is {otp}. This code is valid for 10 minutes.\n\nDo not share this code with anyone.\n\nBest regards,\nTeam GR Sports",
                variables=["customer_name", "otp"]
            ),
            EmailTemplateModel(
                id="TPL-02",
                name="Request Submitted",
                category="Customer",
                subject="Service Booking Confirmed: {request_id} ({service_type})",
                body="Hello {customer_name},\n\nYour badminton bat {service_type} request {request_id} has been submitted successfully.\n\nBat: {bat_brand} {bat_model}\nPickup Address: {pickup_address}\nDistance: {distance_km} KM ({pickup_charge_status})\n\nNote: Payment will be collected after delivery. No advance payment is needed.\n\nBest regards,\nGR Sports Operations",
                variables=["customer_name", "request_id", "service_type", "bat_brand", "bat_model", "pickup_address", "distance_km", "pickup_charge_status"]
            ),
            EmailTemplateModel(
                id="TPL-03",
                name="Repair Estimate Ready",
                category="Customer",
                subject="Repair Estimate Ready for {request_id} — Approval Required",
                body="Hello {customer_name},\n\nOur workshop technicians have inspected your {bat_brand} {bat_model}.\n\nInspection Findings:\n{inspection_findings}\n\nEstimate Breakdown:\nLabour: ₹{labour_charge}\nMaterials: ₹{materials_charge}\nTotal Estimate: ₹{total_amount}\n\nPlease review and approve this estimate so our team can commence the repair:\n{action_link}\n\nBest regards,\nGR Sports Workshop Team",
                variables=["customer_name", "request_id", "bat_brand", "bat_model", "inspection_findings", "labour_charge", "materials_charge", "total_amount", "action_link"]
            ),
            EmailTemplateModel(
                id="TPL-04",
                name="Revised Estimate Notification",
                category="Customer",
                subject="UPDATED Repair Estimate for {request_id} — Approval Required",
                body="Hello {customer_name},\n\nDuring detailed repair preparation of your {bat_brand} {bat_model}, additional damage was discovered:\n\nReason: {revision_reason}\nPrevious Estimate: ₹{original_estimate}\nAdditional Repair: ₹{additional_charges}\nNew Total: ₹{new_total}\n\nRepair work will remain paused until you review and approve the revised estimate.\n\nApprove or Decline here:\n{action_link}",
                variables=["customer_name", "request_id", "bat_brand", "bat_model", "revision_reason", "original_estimate", "additional_charges", "new_total", "action_link"]
            ),
            EmailTemplateModel(
                id="TPL-05",
                name="Out for Delivery",
                category="Customer",
                subject="Your Badminton Bat is Out for Delivery ({request_id})",
                body="Hello {customer_name},\n\nYour serviced {bat_brand} {bat_model} is out for delivery with our executive {employee_name} ({employee_phone}).\n\nTotal to be collected on delivery: ₹{total_amount}\nAccepted Payment Methods: Cash, UPI, or Card at doorstep.\n\nThank you for choosing GR Sports!",
                variables=["customer_name", "request_id", "bat_brand", "bat_model", "employee_name", "employee_phone", "total_amount"]
            ),
            EmailTemplateModel(
                id="TPL-06",
                name="Payment Confirmation & Completed",
                category="Customer",
                subject="Service Completed & Payment Receipt ({request_id})",
                body="Hello {customer_name},\n\nThank you for your payment of ₹{amount_paid} collected by {collected_by} via {payment_method}.\n\nYour service {request_id} is marked as COMPLETED.\n\nHave a great game on court!\nGR Sports Team",
                variables=["customer_name", "request_id", "amount_paid", "collected_by", "payment_method"]
            ),
        ]
        db.add_all(templates)

    # 6. Initial Requests
    if not db.query(ServiceRequestModel).first():
        default_address_1 = {
            "id": "ADDR-1",
            "label": "Home",
            "houseFlat": "Flat 402, Green Glen Heights",
            "street": "Outer Ring Road, Bellandur",
            "area": "Bellandur",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560103",
            "landmark": "Near EcoSpace Tech Park",
            "distanceKm": 11.8,
            "isDefault": True,
            "lat": 12.9260,
            "lng": 77.6762,
        }
        default_address_2 = {
            "id": "ADDR-2",
            "label": "Office",
            "houseFlat": "Level 5, Tower B, Helios Business Park",
            "street": "Kadubeesanahalli",
            "area": "Marathahalli",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560103",
            "landmark": "Opposite Cisco",
            "distanceKm": 13.5,
            "isDefault": False,
            "lat": 12.9380,
            "lng": 77.6910,
        }
        default_address_3 = {
            "id": "ADDR-3",
            "label": "Other",
            "houseFlat": "Villa 18, Palm Meadows",
            "street": "Ramagondanahalli, Varthur Road",
            "area": "Whitefield",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560066",
            "landmark": "Near Forum Value Mall",
            "distanceKm": 22.4,
            "isDefault": False,
            "lat": 12.9698,
            "lng": 77.7499,
        }

        requests = [
            ServiceRequestModel(
                id="REP-00025",
                serviceType="REPAIR",
                customerName="Vikram Malhotra",
                customerEmail="vikram.m@example.com",
                customerMobile="+91 99887 76655",
                createdAt="2026-09-28T09:30:00Z",
                status="Awaiting Customer Approval",
                batBrand="Yonex",
                batModel="Arcsaber 11 Pro",
                batType="Even Balance (All-Round)",
                batPhotos=["https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=600&q=80"],
                repairIssue="Frame Damage",
                repairDescription="Crack near 2 o’clock grommet hole after a doubles racquet clash.",
                pickupDate="2026-09-29T10:00:00Z",
                targetDate="2026-10-06T18:00:00Z",
                pickupAddress=default_address_1,
                distanceKm=11.8,
                pickupDeliveryCharge=0.0,
                isFreeDelivery=True,
                assignedEmployeeId="EMP-03",
                assignedEmployeeName="Sneha Patel",
                pickupCondition={
                    "condition": "Damaged",
                    "notes": "Upper frame cracked. Existing strings loose. Shaft looks okay externally.",
                    "photos": ["https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=600&q=80"],
                    "collectedAt": "2026-09-29T10:30:00Z",
                    "collectedBy": "Amit Verma",
                },
                repairEstimate={
                    "labourCharge": 450.0,
                    "materialsCharge": 200.0,
                    "additionalCharges": 0.0,
                    "pickupDeliveryCharge": 0.0,
                    "discount": 0.0,
                    "totalEstimate": 650.0,
                    "expectedCompletionDate": "2026-10-05",
                    "inspectionNotes": "Additional micro-fracture found deep in upper shaft core during prep milling.",
                    "isRevised": True,
                    "originalEstimate": 400.0,
                    "revisionReason": "Additional frame and shaft damage identified during repair preparation.",
                },
                previousEstimate={
                    "labourCharge": 300.0,
                    "materialsCharge": 100.0,
                    "additionalCharges": 0.0,
                    "pickupDeliveryCharge": 0.0,
                    "discount": 0.0,
                    "totalEstimate": 400.0,
                    "expectedCompletionDate": "2026-10-04",
                    "inspectionNotes": "Initial estimate for top frame composite bonding.",
                },
                serviceCharge=650.0,
                discount=0.0,
                totalAmount=650.0,
                paymentStatus="Pending",
                timeline=[
                    {"status": "Submitted", "label": "Request Submitted", "timestamp": "28 Sep, 09:30 AM", "actor": "Customer"},
                    {"status": "Accepted", "label": "Request Accepted", "timestamp": "28 Sep, 10:15 AM", "actor": "Admin"},
                    {"status": "Employee Assigned", "label": "Assigned to Sneha Patel & Amit Verma", "timestamp": "28 Sep, 11:00 AM", "actor": "Admin"},
                    {"status": "Pickup Scheduled", "label": "Pickup scheduled for 29 Sep", "timestamp": "28 Sep, 11:30 AM", "actor": "Amit Verma"},
                    {"status": "Bat Picked Up", "label": "Bat Picked Up & Inspected at Doorstep", "timestamp": "29 Sep, 10:30 AM", "actor": "Amit Verma"},
                    {"status": "Inspection", "label": "Detailed Workshop Inspection", "timestamp": "29 Sep, 02:00 PM", "actor": "Sneha Patel"},
                    {"status": "Repair Estimate", "label": "Initial Estimate ₹400 Generated", "timestamp": "29 Sep, 03:00 PM", "actor": "Sneha Patel"},
                    {"status": "Awaiting Customer Approval", "label": "Revised Estimate ₹650 Requires Customer Approval", "timestamp": "30 Sep, 11:00 AM", "actor": "Sneha Patel"},
                ]
            ),
            ServiceRequestModel(
                id="REP-00026",
                serviceType="REPAIR",
                customerName="Ananya Sharma",
                customerEmail="ananya.s@example.com",
                customerMobile="+91 97766 55443",
                createdAt="2026-09-30T11:00:00Z",
                status="Awaiting Customer Approval",
                batBrand="Victor",
                batModel="Thruster K Falcon",
                batType="Head Heavy (Power / Smash)",
                batPhotos=["https://images.unsplash.com/photo-1521537634581-0dced2fee2ef?auto=format&fit=crop&w=600&q=80"],
                repairIssue="Shaft Damage",
                repairDescription="Hairline stress fracture midway through shaft.",
                pickupDate="2026-10-01T09:00:00Z",
                targetDate="2026-10-08T18:00:00Z",
                pickupAddress=default_address_2,
                distanceKm=13.5,
                pickupDeliveryCharge=0.0,
                isFreeDelivery=True,
                assignedEmployeeId="EMP-03",
                assignedEmployeeName="Sneha Patel",
                pickupCondition={
                    "condition": "Minor Damage",
                    "notes": "Shaft flexible, paint crack with carbon fiber splintering.",
                    "photos": [],
                    "collectedAt": "2026-10-01T09:45:00Z",
                    "collectedBy": "Amit Verma",
                },
                repairEstimate={
                    "labourCharge": 300.0,
                    "materialsCharge": 100.0,
                    "additionalCharges": 0.0,
                    "pickupDeliveryCharge": 0.0,
                    "discount": 0.0,
                    "totalEstimate": 400.0,
                    "expectedCompletionDate": "2026-10-06",
                    "inspectionNotes": "Shaft carbon sleeve reinforcement and resin vacuum infusion required.",
                    "isRevised": False,
                },
                serviceCharge=400.0,
                discount=0.0,
                totalAmount=400.0,
                paymentStatus="Pending",
                timeline=[
                    {"status": "Submitted", "label": "Request Submitted", "timestamp": "30 Sep, 11:00 AM", "actor": "Customer"},
                    {"status": "Accepted", "label": "Accepted by Admin", "timestamp": "30 Sep, 11:45 AM", "actor": "Admin"},
                    {"status": "Employee Assigned", "label": "Sneha Patel Assigned", "timestamp": "30 Sep, 12:00 PM", "actor": "Admin"},
                    {"status": "Bat Picked Up", "label": "Bat Picked Up", "timestamp": "01 Oct, 09:45 AM", "actor": "Amit Verma"},
                    {"status": "Inspection", "label": "Inspection Completed", "timestamp": "01 Oct, 02:00 PM", "actor": "Sneha Patel"},
                    {"status": "Awaiting Customer Approval", "label": "Estimate ₹400 Ready for Approval", "timestamp": "01 Oct, 03:00 PM", "actor": "Sneha Patel"},
                ]
            ),
            ServiceRequestModel(
                id="GET-00025",
                serviceType="GETTING",
                customerName="Pooja Hegde",
                customerEmail="pooja.h@example.com",
                customerMobile="+91 99166 77889",
                createdAt="2026-10-01T14:30:00Z",
                status="Pickup Scheduled",
                batBrand="Yonex",
                batModel="Astrox 88D Pro",
                batType="Head Heavy (Power / Smash)",
                batPhotos=["https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=600&q=80"],
                gettingType="Tournament Getting",
                stringPreference="Yonex BG80 Power",
                stringType="Yonex BG80 Power (Neon Orange)",
                stringTensionLbs=27,
                gettingPrice=600.0,
                colour="#f97316",
                pickupAddress=default_address_3,
                distanceKm=22.4,
                pickupDeliveryCharge=186.0,
                isFreeDelivery=False,
                serviceCharge=600.0,
                discount=0.0,
                totalAmount=786.0,
                paymentStatus="Pending",
                assignedEmployeeId="EMP-02",
                assignedEmployeeName="Amit Verma",
                timeline=[
                    {"status": "Submitted", "label": "Booking Confirmed", "timestamp": "01 Oct, 02:30 PM", "actor": "Customer"},
                    {"status": "Accepted", "label": "Accepted by Admin", "timestamp": "01 Oct, 03:00 PM", "actor": "Admin"},
                    {"status": "Employee Assigned", "label": "Amit Verma assigned for pickup", "timestamp": "01 Oct, 03:30 PM", "actor": "Admin"},
                    {"status": "Pickup Scheduled", "label": "Pickup scheduled for today 05:00 PM", "timestamp": "01 Oct, 04:00 PM", "actor": "Amit Verma"},
                ]
            ),
            ServiceRequestModel(
                id="GET-00021",
                serviceType="GETTING",
                customerName="Rohan Mehra",
                customerEmail="rohan.m@example.com",
                customerMobile="+91 98450 12345",
                createdAt="2026-09-28T10:00:00Z",
                status="Completed",
                batBrand="Li-Ning",
                batModel="Windstorm 72",
                batType="Head Light (Speed / Defense)",
                batPhotos=["https://images.unsplash.com/photo-1521537634581-0dced2fee2ef?auto=format&fit=crop&w=600&q=80"],
                gettingType="Basic Getting",
                stringPreference="Yonex BG65",
                stringType="Yonex BG65 (White)",
                stringTensionLbs=25,
                gettingPrice=400.0,
                colour="#ffffff",
                pickupAddress=default_address_1,
                distanceKm=11.8,
                pickupDeliveryCharge=0.0,
                isFreeDelivery=True,
                assignedEmployeeId="EMP-01",
                assignedEmployeeName="Rajesh Kumar",
                serviceCharge=400.0,
                discount=0.0,
                totalAmount=400.0,
                paymentStatus="Paid",
                paymentRecord={
                    "amount": 400.0,
                    "method": "UPI",
                    "collectedAt": "2026-09-30T16:45:00Z",
                    "collectedBy": "Amit Verma",
                    "transactionNotes": "UPI Ref: 429381002341 (Google Pay)",
                },
                review={
                    "rating": 5,
                    "comment": "Super fast stringing service, tension is accurate and great doorstep delivery!",
                    "createdAt": "2026-09-30T18:00:00Z"
                },
                timeline=[
                    {"status": "Submitted", "label": "Request Submitted", "timestamp": "28 Sep, 10:00 AM", "actor": "Customer"},
                    {"status": "Bat Picked Up", "label": "Picked Up", "timestamp": "28 Sep, 02:00 PM", "actor": "Amit Verma"},
                    {"status": "Getting in Progress", "label": "Electronic stringing at 25 lbs", "timestamp": "29 Sep, 11:00 AM", "actor": "Rajesh Kumar"},
                    {"status": "Getting Completed", "label": "Stringing completed & grommets replaced", "timestamp": "29 Sep, 04:00 PM", "actor": "Rajesh Kumar"},
                    {"status": "Out for Delivery", "label": "Out for Delivery", "timestamp": "30 Sep, 02:00 PM", "actor": "Amit Verma"},
                    {"status": "Delivered", "label": "Delivered to Customer", "timestamp": "30 Sep, 04:45 PM", "actor": "Amit Verma"},
                    {"status": "Payment Collected", "label": "₹400 Collected via UPI", "timestamp": "30 Sep, 04:45 PM", "actor": "Amit Verma"},
                    {"status": "Completed", "label": "Service Completed Successfully", "timestamp": "30 Sep, 04:50 PM", "actor": "Amit Verma"},
                ]
            )
        ]
        db.add_all(requests)

    # 7. Initial Audit Logs
    if not db.query(AuditLogModel).first():
        logs = [
            AuditLogModel(id="LOG-001", timestamp="2026-10-01 16:45", user="Amit Verma", role="EMPLOYEE", action="Recorded ₹400 payment via UPI", requestId="GET-00021", details="Delivered to customer doorstep"),
            AuditLogModel(id="LOG-002", timestamp="2026-10-01 15:30", user="Sneha Patel", role="EMPLOYEE", action="Requested revised estimate ₹650", requestId="REP-00025", details="Additional shaft micro-fracture found"),
            AuditLogModel(id="LOG-003", timestamp="2026-10-01 15:00", user="Priya Anand", role="ADMIN", action="Assigned Amit Verma", requestId="GET-00025", details="Pickup scheduled for Bellandur"),
            AuditLogModel(id="LOG-004", timestamp="2026-10-01 14:30", user="Pooja Hegde", role="CUSTOMER", action="Created new getting request", requestId="GET-00025", details="Yonex Astrox 88D Pro"),
            AuditLogModel(id="LOG-005", timestamp="2026-10-01 11:30", user="Sneha Patel", role="EMPLOYEE", action="Created initial estimate ₹400", requestId="REP-00026", details="Awaiting customer approval"),
            AuditLogModel(id="LOG-006", timestamp="2026-09-30 14:00", user="Priya Anand", role="ADMIN", action="Updated distance pricing config", requestId="SYSTEM", details="Free radius set to 10 KM"),
        ]
        db.add_all(logs)

    # 8. Initial Notification
    if not db.query(NotificationModel).first():
        notif = NotificationModel(
            id="NOTIF-000001",
            type="system",
            title="Platform Initialized",
            message="GR Sports Badminton Service Platform backend initialized with 10 KM free radius.",
            requestId="SYSTEM",
            timestamp="01 Oct, 10:00 AM",
            isRead=False,
            targetRoles=["ADMIN", "EMPLOYEE"]
        )
        db.add(notif)

    db.commit()
