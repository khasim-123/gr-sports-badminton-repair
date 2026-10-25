import os
from datetime import date, timedelta
from sqlalchemy.orm import Session
from app.config import settings
from app.security import hash_password
from app.services.content_service import business_today, get_availability_settings, new_id, now_iso
from app.string_catalogue import STRING_CATALOGUE
from app.services.sms_service import normalize_phone
from app.models import (
    DistanceConfigModel,
    EmployeeModel,
    GettingServiceTierModel,
    RepairCategoryTierModel,
    ServiceRequestModel,
    AuditLogModel,
    NotificationModel,
    CustomerModel,
    StringProductModel,
    StringVariantModel,
    RacketModel,
    AppMetaModel,
    EventModel,
    ApparelProductModel,
    ApparelVariantModel,
    CourtBlockModel,
    CourtModel,
    CourtVenueModel,
)
from app.services.shop_settings import get_shop_settings

def seed_database(db: Session):
    # 1. Distance Config
    if not db.query(DistanceConfigModel).first():
        distance_config = DistanceConfigModel(
            id=1,
            shopLocationName=settings.DEFAULT_SHOP_NAME,
            shopLat=settings.DEFAULT_SHOP_LAT,
            shopLng=settings.DEFAULT_SHOP_LNG,
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

    # Demo people/requests are for local development only; production starts clean.
    seed_demo = os.getenv("SEED_DEMO_DATA", "false" if settings.is_production else "true").lower() in ("1", "true", "yes")

    # 2. Employees & Admins
    if seed_demo and not db.query(EmployeeModel).first():
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
                description="Restringing with a standard, durable string at the tension you choose. Good for casual and club play.",
                features=["Standard durable string", "Tension of your choice", "Grommets checked before stringing"],
                isActive=True
            ),
            GettingServiceTierModel(
                id="tournament",
                name="Tournament Getting",
                price=600.0,
                turnaround="24–36 Hours",
                description="Restringing with a thinner, higher-performance string for more power and feel. Choose the exact string and colour when you book.",
                features=["Performance strings from our catalogue", "Tension of your choice", "Grommets checked before stringing"],
                isActive=True
            ),
            GettingServiceTierModel(
                id="durability",
                name="Durability Getting",
                price=500.0,
                turnaround="24 Hours",
                description="Restringing with a thicker, longer-lasting string (around 0.70 mm). A good choice if you break strings often.",
                features=["Thicker, longer-lasting string", "Tension of your choice", "Grommets checked before stringing"],
                isActive=True
            ),
            GettingServiceTierModel(
                id="custom",
                name="Custom Getting",
                price=750.0,
                turnaround="48 Hours",
                description="Special setups such as hybrid strings or different tensions for mains and crosses. Describe what you want in the booking notes.",
                features=["Hybrid string setups", "Separate main and cross tension", "Setup discussed with our stringer"],
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
                description="Repair of a broken or snapped frame. We inspect the racket first and confirm whether it can be repaired safely, and the final price, before starting work.",
                slaDays=7,
                isActive=True
            ),
            RepairCategoryTierModel(
                id="frame",
                name="Frame Damage",
                basePrice=350.0,
                turnaround="4–6 Days",
                description="Repair of cracks or damage on the racket head. Final price is confirmed after inspection.",
                slaDays=7,
                isActive=True
            ),
            RepairCategoryTierModel(
                id="shaft",
                name="Shaft Damage",
                basePrice=450.0,
                turnaround="5–7 Days",
                description="Repair of cracks or breaks in the shaft. Final price is confirmed after inspection.",
                slaDays=7,
                isActive=True
            ),
            RepairCategoryTierModel(
                id="handle",
                name="Handle Damage",
                basePrice=250.0,
                turnaround="3–4 Days",
                description="Repair of a loose, cracked or damaged handle. Final price is confirmed after inspection.",
                slaDays=5,
                isActive=True
            ),
            RepairCategoryTierModel(
                id="joint",
                name="Joint Damage (T-Joint)",
                basePrice=300.0,
                turnaround="4–5 Days",
                description="Repair of damage where the shaft meets the head (T-joint). Final price is confirmed after inspection.",
                slaDays=6,
                isActive=True
            ),
            RepairCategoryTierModel(
                id="grip",
                name="Grip & Cushion Issue",
                basePrice=150.0,
                turnaround="1–2 Days",
                description="Grip replacement and handle cushion repair.",
                slaDays=3,
                isActive=True
            ),
            RepairCategoryTierModel(
                id="other",
                name="Other / Custom Issue",
                basePrice=200.0,
                turnaround="5–7 Days",
                description="Any other problem — describe it when you book. We inspect the racket and confirm the work and price before starting.",
                slaDays=7,
                isActive=True
            ),
        ]
        db.add_all(repair_tiers)

    # 6. Initial Requests
    if seed_demo and not db.query(ServiceRequestModel).first():
        default_address_1 = {
            "id": "ADDR-1",
            "label": "Home",
            "houseFlat": "Flat 402, Sai Residency",
            "street": "Sector 4, MVP Colony",
            "area": "MVP Colony",
            "city": "Visakhapatnam",
            "state": "Andhra Pradesh",
            "pincode": "530017",
            "landmark": "Near MVP Rythu Bazar",
            "distanceKm": 11.8,
            "isDefault": True,
            "lat": 17.7417,
            "lng": 83.3346,
        }
        default_address_2 = {
            "id": "ADDR-2",
            "label": "Office",
            "houseFlat": "Door 9-1-24, Siripuram Towers",
            "street": "Siripuram Junction Road",
            "area": "Siripuram",
            "city": "Visakhapatnam",
            "state": "Andhra Pradesh",
            "pincode": "530003",
            "landmark": "Opposite Andhra University gate",
            "distanceKm": 13.5,
            "isDefault": False,
            "lat": 17.7206,
            "lng": 83.3170,
        }
        default_address_3 = {
            "id": "ADDR-3",
            "label": "Other",
            "houseFlat": "House 18, Old Gajuwaka",
            "street": "Gajuwaka Main Road",
            "area": "Gajuwaka",
            "city": "Visakhapatnam",
            "state": "Andhra Pradesh",
            "pincode": "530026",
            "landmark": "Near Gajuwaka Junction",
            "distanceKm": 22.4,
            "isDefault": False,
            "lat": 17.6868,
            "lng": 83.2185,
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
    if seed_demo and not db.query(AuditLogModel).first():
        logs = [
            AuditLogModel(id="LOG-001", timestamp="2026-10-01 16:45", user="Amit Verma", role="EMPLOYEE", action="Recorded ₹400 payment via UPI", requestId="GET-00021", details="Delivered to customer doorstep"),
            AuditLogModel(id="LOG-002", timestamp="2026-10-01 15:30", user="Sneha Patel", role="EMPLOYEE", action="Requested revised estimate ₹650", requestId="REP-00025", details="Additional shaft micro-fracture found"),
            AuditLogModel(id="LOG-003", timestamp="2026-10-01 15:00", user="Priya Anand", role="ADMIN", action="Assigned Amit Verma", requestId="GET-00025", details="Pickup scheduled for MVP Colony"),
            AuditLogModel(id="LOG-004", timestamp="2026-10-01 14:30", user="Pooja Hegde", role="CUSTOMER", action="Created new getting request", requestId="GET-00025", details="Yonex Astrox 88D Pro"),
            AuditLogModel(id="LOG-005", timestamp="2026-10-01 11:30", user="Sneha Patel", role="EMPLOYEE", action="Created initial estimate ₹400", requestId="REP-00026", details="Awaiting customer approval"),
            AuditLogModel(id="LOG-006", timestamp="2026-09-30 14:00", user="Priya Anand", role="ADMIN", action="Updated distance pricing config", requestId="SYSTEM", details="Free radius set to 10 KM"),
        ]
        db.add_all(logs)

    # 8. Initial Notification
    if seed_demo and not db.query(NotificationModel).first():
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

    # 9. Two upcoming demo events so a local preview shows how event banners look.
    # Demo branch only: production starts with no events.
    if seed_demo and not db.query(EventModel).first():
        db.add_all(demo_events(business_today()))

    # 10. Sample T-shirts so a local preview shows the shop (real photos in /images/apparel/).
    # Demo branch only: production starts with no products; the admin adds the real ones.
    if seed_demo and not db.query(ApparelProductModel).first():
        db.add_all(demo_apparel())

    # 11. A sample court venue so a local preview shows court booking (real photos in /images/site/).
    # Demo branch only: production starts with no venues; the admin adds the real one.
    if seed_demo and not db.query(CourtVenueModel).first():
        db.add_all(demo_court_venue(db, business_today()))

    db.commit()

    seed_string_catalogue(db)
    seed_rackets(db)
    refresh_seeded_wording(db)
    get_availability_settings(db)
    move_default_shop_to_visakhapatnam(db)
    normalize_existing_phones(db)
    ensure_bootstrap_admin(db)


def seed_string_catalogue(db: Session):
    """Adds catalogue models (no prices — the admin sets them) that haven't been seeded before.
    Each code is seeded only once, so a model the admin deletes doesn't come back on restart."""
    meta = db.query(AppMetaModel).filter(AppMetaModel.key == "seeded_string_codes").first()
    if meta is None:
        # Databases seeded before this bookkeeping existed: everything already present counts.
        existing = [code for (code,) in db.query(StringProductModel.code).all() if code]
        meta = AppMetaModel(key="seeded_string_codes", value=existing)
        db.add(meta)
    seeded = set(meta.value or [])
    present = {code for (code,) in db.query(StringProductModel.code).all() if code}
    next_order = db.query(StringProductModel).count()

    added = []
    for item in STRING_CATALOGUE:
        code = item["code"]
        if code in seeded or code in present:
            continue
        product = StringProductModel(
            id=new_id("STR"),
            brand=item.get("brand", "Hundred"),
            code=code,
            name=item["name"],
            gauge=item["gauge"],
            price=None,
            description=None,
            isFeatured=item["isFeatured"],
            isActive=True,
            sortOrder=next_order,
            createdAt=now_iso(),
        )
        next_order += 1
        for v_order, (colour, hex_code, image) in enumerate(sorted(item["variants"], key=lambda v: v[0])):
            product.variants.append(StringVariantModel(
                id=new_id("VAR"),
                colour=colour,
                colourHex=hex_code,
                imageUrl=image,
                inStock=True,
                sortOrder=v_order,
            ))
        db.add(product)
        added.append(code)
    meta.value = sorted(seeded | present | set(added))
    db.commit()


def ensure_bootstrap_admin(db: Session):
    """Creates the first admin from ADMIN_PHONE / ADMIN_PASSWORD, or sets the password of
    that admin if it has none yet. Never overwrites an existing password."""
    phone = normalize_phone(settings.ADMIN_PHONE)
    password = settings.ADMIN_PASSWORD
    if not settings.ADMIN_PHONE or not password:
        return
    if not phone:
        print("[bootstrap] ADMIN_PHONE must be a valid 10-digit Indian mobile number; admin not configured")
        return
    if len(password) < 8:
        print("[bootstrap] ADMIN_PASSWORD must be at least 8 characters; admin not configured")
        return
    admin = db.query(EmployeeModel).filter(EmployeeModel.phone == phone).first()
    if admin is None:
        db.add(EmployeeModel(
            id=new_id("EMP"),
            name=settings.ADMIN_NAME,
            email=None,
            phone=phone,
            role="Platform Admin",
            userRole="ADMIN",
            activeJobsCount=0,
            password=hash_password(password),
            isActive=True,
        ))
        db.commit()
    elif not admin.password:
        admin.password = hash_password(password)
        admin.userRole = "ADMIN"
        admin.isActive = True
        db.commit()


def normalize_existing_phones(db: Session):
    """Stores every mobile number as +91XXXXXXXXXX so logins and booking history match.
    Idempotent; numbers that aren't valid Indian mobiles are left untouched."""
    changed = False
    for model, column in ((CustomerModel, "phone"), (EmployeeModel, "phone"), (ServiceRequestModel, "customerMobile")):
        for row in db.query(model).all():
            current = getattr(row, column)
            normalized = normalize_phone(current)
            if normalized and normalized != current:
                setattr(row, column, normalized)
                changed = True
    if changed:
        db.commit()


OLD_BENGALURU_DEFAULT = (12.9716, 77.6412)


def move_default_shop_to_visakhapatnam(db: Session):
    """The original template shipped with a Bengaluru shop location, which made every
    Visakhapatnam pickup look ~800 km away. Replace it only if it's still that untouched default."""
    config = db.query(DistanceConfigModel).first()
    if config and (round(config.shopLat, 4), round(config.shopLng, 4)) == OLD_BENGALURU_DEFAULT:
        config.shopLocationName = settings.DEFAULT_SHOP_NAME
        config.shopLat = settings.DEFAULT_SHOP_LAT
        config.shopLng = settings.DEFAULT_SHOP_LNG
        db.commit()


# brand, name, tag, weight, balance, flex, max tension — the rackets from the original
# homepage. Prices and photos are left for the admin (no invented prices).
STARTER_RACKETS = [
    ("Yonex", "Astrox 88D Pro", "Bestseller", "3U / 4U", "Head Heavy", "Stiff", "Up to 28 lbs"),
    ("Yonex", "Nanoflare 1000Z", "Speed Flagship", None, "Head Light", "Extra Stiff", "Up to 29 lbs"),
    ("Li-Ning", "Axforce 90 Max Dragon", "Power Series", None, "Head Heavy", "Stiff", "Up to 31 lbs"),
    ("Victor", "Thruster Ryuga II Pro", "Attacking", None, "Head Heavy", "Medium Stiff", "Up to 32 lbs"),
    ("Apacs", "Z-Ziggler High Tension", "High Tension", None, "Head Heavy", "Medium", "Up to 38 lbs"),
    ("Hundred", "Atomic X Vigor", "Club Value", None, "Even Balance", "Flexible", "Up to 32 lbs"),
    ("Yonex", "Arcsaber 11 Pro", "Control", None, "Even Balance", "Stiff", "Up to 28 lbs"),
    ("Li-Ning", "Halbertec 8000", "Control", None, "Even Balance", "Medium", "Up to 30 lbs"),
]


def seed_rackets(db: Session):
    if db.query(RacketModel).first():
        return
    for order, (brand, name, tag, weight, balance, flex, tension) in enumerate(STARTER_RACKETS):
        db.add(RacketModel(
            id=new_id("RKT"), brand=brand, name=name, price=None, tag=tag, weight=weight,
            balance=balance, flex=flex, maxTension=tension, description=None, images=[],
            inStock=True, isFeatured=order < 4, isActive=True, sortOrder=order, createdAt=now_iso(),
        ))
    db.commit()


# Original template wording -> plain, verifiable wording. Only rows the admin hasn't edited
# (text still identical to the original seed) are updated.
PACKAGE_WORDING = {
    'basic': ('Standard synthetic gut stringing (20–24 lbs). Good durability & tension hold for casual and club play.', ['Standard Synthetic Gut', '20-24 lbs Tension Range', 'Grommet Inspection', 'Free Vibration Dampener'], 'Restringing with a standard, durable string at the tension you choose. Good for casual and club play.', ['Standard durable string', 'Tension of your choice', 'Grommets checked before stringing']),
    'tournament': ('Tournament-grade multifilament string (Yonex BG80 / Aerobite) with electronic constant-pull tensioning up to 30 lbs.', ['Tournament Grade Strings', 'Up to 30 lbs Electronic Tension', 'Constant-Pull Machine', 'Grommet Cleaning'], 'Restringing with a thinner, higher-performance string for more power and feel. Choose the exact string and colour when you book.', ['Performance strings from our catalogue', 'Tension of your choice', 'Grommets checked before stringing']),
    'durability': ('Thick gauge high-abrasion strings (Yonex BG65 / Li-Ning No.7). Engineered for maximum string lifespan and endurance.', ['0.70mm High-Durability String', '22-26 lbs Tension Range', 'Pre-Stretch Treatment', 'Reinforced Knot Ties'], 'Restringing with a thicker, longer-lasting string (around 0.70 mm). A good choice if you break strings often.', ['Thicker, longer-lasting string', 'Tension of your choice', 'Grommets checked before stringing']),
    'custom': ('Bespoke hybrid tensioning (differential mains & crosses), premium grip overwrap, and dynamic balance calibration.', ['Hybrid String Setup', 'Independent Cross/Main Tension', 'AC102EX Premium Grip Included', 'Frame Stress Load Analysis'], 'Special setups such as hybrid strings or different tensions for mains and crosses. Describe what you want in the booking notes.', ['Hybrid string setups', 'Separate main and cross tension', 'Setup discussed with our stringer']),
}
CATEGORY_WORDING = {
    'broken': ('Full structural carbon fiber splice & high-grade epoxy curing. Restores structural integrity up to 28 lbs tension.', 'Repair of a broken or snapped frame. We inspect the racket first and confirm whether it can be repaired safely, and the final price, before starting work.'),
    'frame': ('Hairline crack reinforcement and internal graphite sleeve insertion at 10, 12, or 2 o’clock frame positions.', 'Repair of cracks or damage on the racket head. Final price is confirmed after inspection.'),
    'shaft': ('Shaft carbon-braid compression sleeve rebuild and flex calibration.', 'Repair of cracks or breaks in the shaft. Final price is confirmed after inspection.'),
    'handle': ('Internal wooden cone replacement, polyurethane handle rebuild, and factory staple re-anchoring.', 'Repair of a loose, cracked or damaged handle. Final price is confirmed after inspection.'),
    'joint': ('Built-in T-Joint stabilizing resin weld and torsional twist correction.', 'Repair of damage where the shaft meets the head (T-joint). Final price is confirmed after inspection.'),
    'grip': ('Wood handle antiseptic cleaning, base cushion foam replacement, and sweat-resistant overgrip application.', 'Grip replacement and handle cushion repair.'),
    'other': ('Custom composite restoration assessed upon workshop physical inspection.', 'Any other problem — describe it when you book. We inspect the racket and confirm the work and price before starting.'),
}


def refresh_seeded_wording(db: Session):
    changed = False
    for tier in db.query(GettingServiceTierModel).all():
        wording = PACKAGE_WORDING.get(tier.id)
        if not wording:
            continue
        old_desc, old_feats, new_desc, new_feats = wording
        if tier.description == old_desc:
            tier.description = new_desc
            changed = True
        if list(tier.features or []) == old_feats:
            tier.features = new_feats
            changed = True
    for cat in db.query(RepairCategoryTierModel).all():
        wording = CATEGORY_WORDING.get(cat.id)
        if wording and cat.description == wording[0]:
            cat.description = wording[1]
            changed = True
    if changed:
        db.commit()


def _next_weekday(start: date, weekday: int) -> date:
    """First date on or after `start` that falls on `weekday` (0 = Monday)."""
    return start + timedelta(days=(weekday - start.weekday()) % 7)


def demo_events(today: date) -> list:
    """Local-development sample events (SEED_DEMO_DATA). Dates are relative to today."""
    tournament_start = _next_weekday(today + timedelta(days=21), 5)  # a Saturday ~3 weeks out
    camp_start = _next_weekday(today + timedelta(days=42), 0)  # a Monday ~6 weeks out
    return [
        EventModel(
            id=new_id("EVT"),
            title="GR Sports Doubles Tournament",
            category="tournament",
            summary="Men's, women's and mixed doubles, plus U-15 singles. Register online before the deadline.",
            description=(
                "Knockout matches for club and recreational players.\n\n"
                "Categories: Men's Doubles, Women's Doubles, Mixed Doubles and U-15 Singles.\n"
                "Entry: ₹600 per pair (₹600 per player for U-15 Singles).\n\n"
                "The venue, draws and match timings are shared on WhatsApp after registrations close. "
                "Please report 30 minutes before your first match.\n\n"
                "Questions? Call or WhatsApp GR Sports on +91 76758 31496."
            ),
            startDate=tournament_start.isoformat(),
            endDate=(tournament_start + timedelta(days=1)).isoformat(),
            timeText="7:00 AM onwards",
            venue="Indoor badminton courts, MVP Colony (venue confirmed on registration)",
            venueMapUrl=None,
            entryFee=600,
            feeNote="per pair",
            categories=["Men's Doubles", "Women's Doubles", "Mixed Doubles", "U-15 Singles"],
            registrationMode="form",
            registrationUrl=None,
            registrationDeadline=(tournament_start - timedelta(days=3)).isoformat(),
            capacity=64,
            bannerImageUrl="/images/site/events/tournament.webp",
            mobileImageUrl=None,
            showAsBanner=True,
            isActive=True,
            sortOrder=0,
            createdAt=now_iso(),
        ),
        EventModel(
            id=new_id("EVT"),
            title="Junior Badminton Coaching Camp",
            category="coaching_camp",
            summary="Two-week morning camp for players aged 8–15: grip, footwork, strokes and match play.",
            description=(
                "Morning sessions, Monday to Saturday, for beginners and junior players aged 8 to 15.\n\n"
                "Covers grip and basic strokes, footwork, serving and supervised match play. "
                "Players are grouped by age and level.\n\n"
                "Bring your own racket and non-marking shoes.\n\n"
                "To book a place, message GR Sports on WhatsApp (+91 76758 31496) with the player's name and age."
            ),
            startDate=camp_start.isoformat(),
            endDate=(camp_start + timedelta(days=12)).isoformat(),
            timeText="6:00 – 8:00 AM, Mon–Sat",
            venue="Indoor badminton courts, Dondaparthy (venue confirmed on WhatsApp)",
            venueMapUrl=None,
            entryFee=2500,
            feeNote="per player",
            categories=["Ages 8–11", "Ages 12–15"],
            registrationMode="whatsapp",
            registrationUrl=None,
            registrationDeadline=None,
            capacity=None,
            bannerImageUrl="/images/site/events/coaching-camp.webp",
            mobileImageUrl=None,
            showAsBanner=True,
            isActive=True,
            sortOrder=1,
            createdAt=now_iso(),
        ),
    ]


# (name, category, price, images, customisable, featured, [(size, colour, hex, stock)])
_DEMO_APPAREL = [
    (
        "Dry-fit round neck T-shirt", "t-shirt", 349,
        ["/images/apparel/tee-white.webp", "/images/apparel/model-white.webp"], False, True,
        [
            (size, colour, hex_code, stock)
            for colour, hex_code, stocks in (
                ("White", "#FFFFFF", (4, 8, 6, 3, 0)),
                ("Black", "#111111", (2, 6, 0, 5, 2)),
                ("Navy", "#1F2A44", (0, 3, 4, 2, 1)),
            )
            for size, stock in zip(("S", "M", "L", "XL", "XXL"), stocks)
        ],
    ),
    (
        "Cotton crew neck T-shirt", "t-shirt", 299,
        ["/images/apparel/tee-black.webp"], False, False,
        [(size, "Black", "#111111", stock) for size, stock in zip(("S", "M", "L", "XL", "XXL"), (3, 7, 5, 0, 2))],
    ),
    (
        "Sports polo T-shirt", "t-shirt", 449,
        ["/images/apparel/polo.webp"], False, True,
        [
            (size, colour, hex_code, stock)
            for colour, hex_code, stocks in (
                ("Coral", "#F26B5B", (2, 4, 3, 0)),
                ("Green", "#2E7D32", (1, 3, 0, 2)),
                ("Grey", "#8A8F98", (3, 5, 4, 2)),
            )
            for size, stock in zip(("S", "M", "L", "XL"), stocks)
        ],
    ),
    (
        "Custom team jersey (name & number)", "jersey", 599,
        ["/images/apparel/team.webp"], True, False,
        [(size, "Red", "#C62828", stock) for size, stock in zip(("S", "M", "L", "XL"), (10, 15, 15, 10))],
    ),
]


def demo_apparel() -> list:
    """Local-development sample apparel (SEED_DEMO_DATA). Plain names, no descriptions:
    the admin writes the real product details."""
    products = []
    for order, (name, category, price, images, customisable, featured, variants) in enumerate(_DEMO_APPAREL):
        product = ApparelProductModel(
            id=new_id("APP"), name=name, category=category, description=None, fabric=None, fit=None,
            price=float(price), images=images, customisable=customisable, isFeatured=featured,
            isActive=True, sortOrder=order, createdAt=now_iso(),
        )
        for v_order, (size, colour, hex_code, stock) in enumerate(variants):
            product.variants.append(ApparelVariantModel(
                id=new_id("AVR"), size=size, colour=colour, colourHex=hex_code, stock=stock, sku=None, sortOrder=v_order,
            ))
        products.append(product)
    return products


def demo_court_venue(db: Session, today: date) -> list:
    """Local-development sample court venue (SEED_DEMO_DATA) at the shop's address: two
    courts and a weekly coaching batch on Court 1. No description or rules: the admin
    writes the real venue details."""
    shop = get_shop_settings(db)
    venue = CourtVenueModel(
        id=new_id("VEN"),
        name="GR Sports Courts (demo)",
        address=shop.get("addressLine") or "GR Sports",
        area=shop.get("area") or None,
        mapsUrl=shop.get("mapsUrl") or None,
        description=None,
        photos=["/images/site/court-empty.webp", "/images/site/hall-players.webp"],
        amenities=["Wooden floor", "Floodlit", "Drinking water", "Parking"],
        rules=None,
        openTime="06:00",
        closeTime="22:00",
        slotMinutes=60,
        pricePerHour=300.0,
        peakPricePerHour=400.0,
        peakStart="17:00",
        peakEnd="21:00",
        weekendPricePerHour=400.0,
        advanceDays=14,
        maxSlotsPerBooking=3,
        cancellationHours=12,
        isActive=True,
        sortOrder=0,
        createdAt=now_iso(),
    )
    court1 = CourtModel(id=new_id("CRT"), venueId=venue.id, name="Court 1", surface="Wooden", isActive=True, sortOrder=0)
    court2 = CourtModel(id=new_id("CRT"), venueId=venue.id, name="Court 2", surface="Wooden", isActive=True, sortOrder=1)
    coaching = CourtBlockModel(
        id=new_id("BLK"), venueId=venue.id, courtId=court1.id, date=None, weekdays=[0, 2, 4],
        fromDate=today.isoformat(), toDate=None, startTime="06:00", endTime="08:00",
        reason="Coaching batch", createdAt=now_iso(),
    )
    return [venue, court1, court2, coaching]
