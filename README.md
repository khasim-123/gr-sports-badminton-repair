# GR Sports — Badminton / Shuttle Bat Getting & Repair Service Platform (Phase 1)

A modern, production-ready responsive web application and clickable prototype designed exclusively for a professional **Badminton / Shuttle Bat Getting and Repair Service business**.

> **IMPORTANT**: This is strictly a **BADMINTON / SHUTTLE BAT SERVICE PLATFORM** (NOT a cricket or generic e-commerce app). Phase 1 features **No Online Payment Gateway** — all payments are collected manually in-person after doorstep delivery (Cash or UPI).

---

## 🏸 Live Development Server

- **Local URL**: [http://localhost:3000/](http://localhost:3000/)
- **Built With**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Canvas Confetti, Vite 6

---

## 🌟 Core Highlights & Business Rules

1. **Email OTP Authentication**:
   - Passwordless login using 6-digit email OTP.
   - Demo verification code prefilled: `849201`.
   - First-time player profile configuration (Name, Mobile, Default Address).

2. **Phase 1 Primary Services**:
   - **Service 1: Bat Getting (Stringing)**:
     - 4 Tiers: Basic (₹250), Standard (₹450), Premium (₹750), Custom (₹950).
     - Tension selection: 20–32 lbs digital tensioning.
     - Strings: Yonex BG65, BG80 Power, Aerobite, Exbolt 65, Li-Ning No.1.
     - Grommet checking & pre-stretching included.
   - **Service 2: Bat Repair (Structural Carbon Composite)**:
     - Issues: Broken Bat, Frame Damage, Shaft Damage, Handle Damage, Joint Damage, Grip Issue.
     - Inspection-based pricing: Repair cost confirmed after workshop physical inspection.

3. **15 KM Free Pickup & Delivery**:
   - **Within 15 KM**: 100% Free pickup and delivery.
   - **Beyond 15 KM**: Distance-based surcharge (configured via distance slabs or ₹15/chargeable KM).
   - Interactive SVG map simulation with 15 KM radius ring and live distance tester.

4. **Zero Advance Payment / Doorstep Manual Payment**:
   - Payment is collected only **after service and delivery**.
   - Delivery executive records amount, payment method (Cash, UPI, Other), and timestamp.

5. **Inspection & Approval Workflow (Critical Business Feature)**:
   - **Standard Estimate Flow**: Technician inspects bat -> Generates estimate (Labour ₹300, Materials ₹100 = ₹400) -> Customer approves/declines.
   - **Revised Estimate Flow**: During repair preparation, additional damage is identified -> Technician requests revision -> Customer receives alert with before/after breakdown (Original ₹400 + Additional ₹250 = New Total ₹650) -> Repair remains paused until customer approval.

6. **7-Day Repair SLA Guarantee**:
   - Color-coded monitoring badges:
     - 🟢 **Normal**: Days 1–4
     - 🟡 **Approaching Deadline**: Days 5–6
     - 🔴 **Delayed (SLA Breach)**: Day 7+

---

## 👥 Three Dedicated Ecosystem Roles

- **Customer Web App**:
  - Home & Marketing website
  - 5-Step Service Booking Wizard (Service -> Bat Details & Photos -> Location & 15km calc -> Review -> Confirmation)
  - Live 10-12 stage timeline tracker
  - Dedicated modals for Estimate Approval and Revised Estimate Approval
  - Saved addresses & profile
- **Employee Operational Portal (Mobile-First)**:
  - Today's pickup tasks with doorstep condition logging (Good, Minor, Damaged, Broken) & confirmation checkbox
  - Bat getting stringing queue
  - Repair workshop inspection form & price revision request modal
  - Doorstep delivery run & manual Cash/UPI payment collection
- **Admin Management Console (Desktop-First)**:
  - KPI & financial overview (Total requests, Revenue, Collections, Pending dues)
  - Service requests table with search and multi-filtering
  - 7-Day Repair SLA dashboard
  - 15 KM & distance pricing config with live calculator
  - Getting pricing & repair categories management
  - Reconciled payment register
  - Exportable CSV reports and printable PDF view
  - 15 Email notification templates with placeholder tokens (`{customer_name}`, `{request_id}`, etc.)
  - Full system audit trail

---

## 🎨 Complete 16-Page Figma File Structure (Figma Navigator)

The sticky bottom toolbar allows instant jumping to any of the 16 Figma pages:
- **01** — Cover & Product Overview
- **02** — Design System
- **03** — Components
- **04** — Public Website
- **05** — Customer Authentication
- **06** — Customer Portal
- **07** — Getting Service Flow
- **08** — Repair Service Flow
- **09** — Employee Portal
- **10** — Admin Portal
- **11** — Reports & Analytics
- **12** — Notifications & Email Templates
- **13** — Settings & Distance Rules
- **14** — Mobile Responsive (390px Viewport)
- **15** — Prototype User Flows & 1-Click Test Scenarios
- **16** — Future Phase 2 Placeholder (Pro Shop Coming Soon)

---

## 📱 Responsive Device Simulation

Toggle between viewports in the top navigation bar:
- **Fluid 100%**: Native responsive layout
- **Desktop (1440px)**: Enterprise dashboard layout
- **Tablet (1024px)**: iPad Pro viewport
- **Mobile First (390px)**: iPhone smartphone frame with touch-friendly actions
