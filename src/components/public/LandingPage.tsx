import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Button } from '../common/Button';
import { MapSimulation } from '../common/MapSimulation';
import {
  Wrench,
  Truck,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  MapPin,
  ChevronRight,
  Phone,
  Mail,
  QrCode,
  AlertTriangle,
  User,
  Shield,
  Layers,
  Award,
  Zap,
  HelpCircle,
  Star,
  Lock
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const {
    setActiveView,
    setCustomerSubView,
    setQrModalOpen,
    isLoggedIn,
    openLoginWithRole,
    openWizardWithService,
    distanceConfig,
    gettingServices,
    repairCategories,
  } = useApp();

  const minGettingPrice = gettingServices.length > 0 ? Math.min(...gettingServices.map((g) => g.price)) : 250;
  const maxGettingPrice = gettingServices.length > 0 ? Math.max(...gettingServices.map((g) => g.price)) : 950;
  const minRepairPrice = repairCategories.length > 0 ? Math.min(...repairCategories.map((r) => r.basePrice)) : 150;

  const [interactiveDistance, setInteractiveDistance] = useState<number>(11.5);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleStartBooking = (type: 'getting' | 'repair') => {
    openWizardWithService(type === 'getting' ? 'GETTING' : 'REPAIR');
  };

  const faqs = [
    {
      q: `How does the ${distanceConfig.freeRadiusKm} KM Free Pickup & Delivery policy work?`,
      a: `Any address within a ${distanceConfig.freeRadiusKm} KM road radius of our master Indiranagar hub qualifies for 100% free doorstep pickup and return delivery. For locations beyond ${distanceConfig.freeRadiusKm} KM, a transparent nominal distance surcharge is applied. You can test your distance right on this page!`
    },
    {
      q: 'Do I have to pay anything in advance when booking a bat service?',
      a: 'No! Phase 1 operates strictly on Zero Advance Payment. Whether it is stringing (bat getting) or a major graphite structural repair, payment is collected in-person only after your repaired racket is delivered back to your hands. You can pay via Cash or UPI QR scan.'
    },
    {
      q: 'What is the Inspection & Revised Estimate process for damaged bats?',
      a: 'When you submit a repair request, our executive collects the bat and logs its exterior condition at your doorstep. At our workshop, technicians conduct a physical carbon composite inspection and issue an itemized estimate. If additional hidden micro-fractures are discovered during prep milling, a Revised Estimate is sent to your portal. Repair work is paused until you review and approve the revised price!'
    },
    {
      q: 'What is the 7-Day Repair SLA Guarantee?',
      a: 'All bat structural repairs are backed by a strict 7-day completion target. Our internal admin dashboard and operations queue monitor every job with color-coded alerts (Normal: Days 1–4, Approaching: Days 5–6, SLA Breach: Day 7+) to guarantee rapid turnaround.'
    },
    {
      q: 'What strings and tensions are available for Bat Getting?',
      a: 'We stock genuine Yonex (BG65, BG65 Titanium, BG80 Power, Aerobite, Exbolt 65) and Li-Ning (No. 1, No. 7) tournament strings. We offer digital constant-pull electronic stringing with custom tensions from 20 lbs to 32 lbs, including grommet check & pre-stretching.'
    }
  ];

  return (
    <div className="space-y-16 sm:space-y-24 pb-16">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-10 sm:pt-20 pb-16 bg-gradient-to-b from-blue-950 via-slate-900 to-slate-950 text-white">
        {/* Glow backdrop decorative elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-blue-500/15 blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold shadow-lg shadow-emerald-500/10">
            <Sparkles className="w-3.5 h-3.5" />
            <span>EXCLUSIVELY FOR BADMINTON &amp; SHUTTLE RACQUET PLAYERS</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto leading-tight">
            Professional Badminton Bat Getting &amp; Structural Repair Services
          </h1>

          <p className="text-base sm:text-xl text-blue-200 max-w-2xl mx-auto leading-relaxed">
            Electronic constant-pull stringing (20–32 lbs) and aerospace carbon composite fracture repair with <span className="text-emerald-400 font-bold">100% Free Doorstep Pickup within {distanceConfig.freeRadiusKm} KM</span>. Zero advance payment required.
          </p>

          {/* Action CTAs: Distinct Non-Duplicate Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
            <Button
              onClick={() => {
                const el = document.getElementById('services');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              size="lg"
              variant="primary"
              className="w-full sm:w-auto font-black px-8 py-4 shadow-xl bg-blue-600 hover:bg-blue-500 text-base"
              rightIcon={<ArrowRight className="w-5 h-5" />}
            >
              Explore Services &amp; {distanceConfig.freeRadiusKm} KM Map
            </Button>
            <Button
              onClick={() => openLoginWithRole('CUSTOMER')}
              size="lg"
              variant="dark"
              className="w-full sm:w-auto font-bold px-8 py-4 text-base"
              leftIcon={<Lock className="w-4 h-4 text-emerald-400" />}
            >
              Sign In to Portal
            </Button>
          </div>

          {/* Hero Visual Showcase Photo */}
          <div className="relative pt-6 max-w-4xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden border-2 border-white/15 shadow-2xl bg-slate-900 group">
              <img
                src="/images/stringing-machine.jpg"
                alt="Professional Badminton Bat Getting on Electronic Constant-Pull Machine"
                className="w-full h-64 sm:h-96 object-cover object-center group-hover:scale-102 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

              {/* Floating Glassmorphism Badges */}
              <div className="absolute top-4 left-4 sm:top-6 sm:left-6 bg-slate-900/85 backdrop-blur-md border border-white/20 text-white px-3.5 py-1.5 rounded-2xl flex items-center gap-2 text-xs font-bold shadow-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>28.5 LBS Constant-Pull Calibration</span>
              </div>

              <div className="absolute top-4 right-4 sm:top-6 sm:right-6 bg-blue-600/90 backdrop-blur-md border border-blue-400/30 text-white px-3.5 py-1.5 rounded-2xl flex items-center gap-1.5 text-xs font-bold shadow-lg hidden sm:flex">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Tournament Grade Multifilaments</span>
              </div>

              <div className="absolute bottom-4 inset-x-4 sm:bottom-6 sm:inset-x-6 flex items-center justify-between text-left">
                <div>
                  <p className="text-xs uppercase tracking-wider text-emerald-400 font-extrabold">Master Workshop Indiranagar</p>
                  <h4 className="text-sm sm:text-base font-bold text-white">Precision Electronic Stringing &amp; Carbon Splice Lab</h4>
                </div>
                <div className="hidden sm:block text-right">
                  <span className="text-xs font-bold text-slate-200 bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/15">
                    Zero Advance Risk • Pay at Doorstep
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Key Value Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 max-w-4xl mx-auto">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs flex items-center justify-center gap-3 text-xs font-semibold text-slate-200 shadow-sm">
              <Wrench className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Digital Stringing &amp; Repair</span>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs flex items-center justify-center gap-3 text-xs font-semibold text-slate-200 shadow-sm">
              <Truck className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Doorstep Pickup &amp; Delivery</span>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs flex items-center justify-center gap-3 text-xs font-semibold text-slate-200 shadow-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-emerald-300 font-bold">Free Within {distanceConfig.freeRadiusKm} KM</span>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs flex items-center justify-center gap-3 text-xs font-semibold text-slate-200 shadow-sm">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>7-Day Repair SLA Target</span>
            </div>
          </div>
        </div>
      </section>

      {/* THREE DEDICATED ECOSYSTEM PORTALS GATEWAY (Prompt Focus: Centralized Login & Navigation) */}
      <section id="portals" className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-3.5 py-1 rounded-full border border-blue-200">
            ENTERPRISE ROLE-BASED ECOSYSTEM
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900">
            Three Dedicated Operational Portals
          </h2>
          <p className="text-sm text-slate-600 max-w-2xl mx-auto">
            GR Sports operates on a unified centralized authentication architecture. Log in once with your credentials to enter your role-specific dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Portal 1: Customer */}
          <div className="bg-white rounded-3xl border-2 border-slate-200 p-6 sm:p-7 shadow-xs hover:border-blue-500 hover:shadow-xl transition-all flex flex-col justify-between space-y-6 group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <User className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  Player &amp; Customer
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1.5">Customer Web App</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Tailored for badminton players and racket owners. Book services in 2 minutes, monitor racket progress, and authorize workshop price estimates.
                </p>
              </div>

              <div className="space-y-2 pt-2 text-xs text-slate-600 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>5-Step Service Booking Wizard</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Live 10–12 Stage Timeline Tracker</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Interactive Estimate Approval Modals</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Saved Doorstep &amp; Court Addresses</span>
                </div>
              </div>
            </div>

            <Button
              onClick={() => openLoginWithRole('CUSTOMER')}
              variant="primary"
              size="md"
              className="w-full font-bold bg-blue-600 hover:bg-blue-700 shadow-md"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Access Customer Portal
            </Button>
          </div>

          {/* Portal 2: Employee */}
          <div className="bg-white rounded-3xl border-2 border-slate-200 p-6 sm:p-7 shadow-xs hover:border-emerald-500 hover:shadow-xl transition-all flex flex-col justify-between space-y-6 group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <Wrench className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                  Operations &amp; Tech Staff
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1.5">Employee Ops Portal</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Mobile-optimized for field pickup agents, master stringers, and carbon composite technicians. Seamlessly log racket condition and collect payments.
                </p>
              </div>

              <div className="space-y-2 pt-2 text-xs text-slate-600 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Doorstep Bat Condition Logging (4 Tiers)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Electronic Bat Getting Tension Queue</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Workshop Inspection &amp; Revision Builder</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Doorstep Cash &amp; UPI Payment Collection</span>
                </div>
              </div>
            </div>

            <Button
              onClick={() => openLoginWithRole('EMPLOYEE')}
              variant="primary"
              size="md"
              className="w-full font-bold bg-emerald-600 hover:bg-emerald-700 shadow-md text-white"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Access Operations Portal
            </Button>
          </div>

          {/* Portal 3: Admin */}
          <div className="bg-white rounded-3xl border-2 border-slate-200 p-6 sm:p-7 shadow-xs hover:border-purple-500 hover:shadow-xl transition-all flex flex-col justify-between space-y-6 group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-800 bg-purple-50 px-2 py-0.5 rounded">
                  Store Operations &amp; Management
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1.5">Admin Management Console</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Desktop-first administrative command center for business KPIs, SLA breach monitoring, distance rule configurations, and shop settings.
                </p>
              </div>

              <div className="space-y-2 pt-2 text-xs text-slate-600 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>Financial KPIs &amp; Payment Reconciliations</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>7-Day Repair SLA Dashboard &amp; Badges</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>{distanceConfig.freeRadiusKm} KM Free Radius &amp; Pricing Rules</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>15 Email Notification Templates</span>
                </div>
              </div>
            </div>

            <Button
              onClick={() => openLoginWithRole('ADMIN')}
              variant="primary"
              size="md"
              className="w-full font-bold bg-purple-600 hover:bg-purple-700 shadow-md text-white"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Access Admin Console
            </Button>
          </div>
        </div>
      </section>

      {/* CORE 2 SERVICES BREAKDOWN */}
      <section id="services" className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            BADMINTON SERVICE SUITE
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900">
            Core Specialized Offerings
          </h2>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Strictly engineered for tournament racquets, badminton clubs, and casual shuttle enthusiasts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card 1: BAT GETTING */}
          <div className="bg-white rounded-3xl border-2 border-slate-200 p-6 sm:p-8 shadow-sm hover:border-blue-400 hover:shadow-xl transition-all flex flex-col justify-between space-y-6 group">
            <div className="space-y-4">
              {/* Service Visual Image */}
              <div className="relative h-48 sm:h-56 w-full rounded-2xl overflow-hidden border border-slate-200">
                <img
                  src="/images/stringing-machine.jpg"
                  alt="Electronic Badminton Stringing Machine"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
                  <span className="font-extrabold bg-blue-600/90 backdrop-blur-xs px-2.5 py-1 rounded-xl">
                    Electronic Load-Cell Precision
                  </span>
                  <span className="bg-slate-900/80 backdrop-blur-xs px-2 py-0.5 rounded-lg text-[10px] font-bold">
                    20–32 LBS
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md">
                  Service 1
                </span>
                <h3 className="text-2xl font-black text-slate-900 mt-2">Bat Getting (Stringing)</h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  Professional bat getting service with convenient pickup and delivery. High-precision constant-pull electronic stringing with Yonex, Li-Ning, and Victor tournament multifilament strings.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-2">
                <p className="font-bold text-slate-800">Key Getting Highlights:</p>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 20–32 lbs Digital Tension</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Free Grommet Check</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Hybrid String Setup</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 24–48h Turnaround</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Tiers ({gettingServices.length} Packages)</span>
                <p className="text-xl font-extrabold text-blue-900">From ₹{minGettingPrice} to ₹{maxGettingPrice}</p>
              </div>
              <Button
                onClick={() => handleStartBooking('getting')}
                variant="primary"
                size="md"
                className="font-bold bg-blue-600 hover:bg-blue-700"
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                Book Getting
              </Button>
            </div>
          </div>

          {/* Card 2: BAT REPAIR */}
          <div className="bg-white rounded-3xl border-2 border-slate-200 p-6 sm:p-8 shadow-sm hover:border-amber-400 hover:shadow-xl transition-all flex flex-col justify-between space-y-6 group">
            <div className="space-y-4">
              {/* Service Visual Image */}
              <div className="relative h-48 sm:h-56 w-full rounded-2xl overflow-hidden border border-slate-200">
                <img
                  src="/images/racket-repair.jpg"
                  alt="Badminton Carbon Composite Frame Repair"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
                  <span className="font-extrabold bg-amber-600/90 backdrop-blur-xs px-2.5 py-1 rounded-xl">
                    Aerospace Carbon Splice Bonding
                  </span>
                  <span className="bg-slate-900/80 backdrop-blur-xs px-2 py-0.5 rounded-lg text-[10px] font-bold">
                    7-Day Target
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md">
                  Service 2
                </span>
                <h3 className="text-2xl font-black text-slate-900 mt-2">Bat Repair (Carbon Composite)</h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  Damaged or broken bat? We pick it up, inspect it, repair it and deliver it back. Aerospace-grade graphite splice bonding restores frame structural stiffness up to high-tension play.
                </p>
              </div>

              <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200 text-xs space-y-2">
                <p className="font-bold text-amber-900">Inspection &amp; Approval Process:</p>
                <div className="space-y-1.5 text-amber-950">
                  <p className="flex items-start gap-1.5">
                    <span className="font-bold shrink-0">1.</span> Doorstep pickup &amp; workshop physical inspection.
                  </p>
                  <p className="flex items-start gap-1.5">
                    <span className="font-bold shrink-0">2.</span> Itemized estimate created &amp; sent for player approval.
                  </p>
                  <p className="flex items-start gap-1.5">
                    <span className="font-bold shrink-0">3.</span> Revised estimate alert if hidden micro-fracture found.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Base Rates ({repairCategories.length} Categories)</span>
                <p className="text-xl font-extrabold text-amber-700">From ₹{minRepairPrice}</p>
              </div>
              <Button
                onClick={() => handleStartBooking('repair')}
                variant="secondary"
                size="md"
                className="font-bold bg-amber-600 hover:bg-amber-700 text-white"
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                Request Repair
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS (6 STEPS) */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            TRANSPARENT 5–6 STEP CYCLE
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900">How It Works</h2>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            From doorstep collection to master craftsmanship and final return delivery at your doorstep.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { step: '1', title: 'Book Online', desc: 'Select getting or repair, choose racquet model, upload damage photos, and pick a pickup slot.' },
            { step: '2', title: 'Doorstep Condition Check', desc: 'Our logistics executive collects the bat and logs its exterior condition (Good/Minor/Damaged/Broken).' },
            { step: '3', title: 'Workshop Inspection', desc: 'For repairs, our carbon composite team inspects frame/shaft integrity and generates a transparent estimate.' },
            { step: '4', title: 'Digital Approval', desc: 'Review the itemized quote in your customer portal. Work commences only upon your explicit authorization!' },
            { step: '5', title: 'Stringing & Repair', desc: 'Constant-pull electronic stringing or vacuum resin infusion carbon splinting performed to exact specs.' },
            { step: '6', title: 'Delivery & Manual Payment', desc: 'We deliver your renewed bat. Pay safely at your doorstep via Cash or UPI QR scan. Zero advance risk!' },
          ].map((item, idx) => (
            <div
              key={idx}
              className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs hover:shadow-md transition-shadow relative overflow-hidden"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center text-sm mb-4 shadow-sm">
                {item.step}
              </div>
              <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* VISUAL CRAFTSMANSHIP & EXPERIENCE GALLERY */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3.5 py-1 rounded-full border border-emerald-200">
            WHITE-GLOVE ATHLETIC SERVICE
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900">
            From Your Doorstep to Court Domination
          </h2>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Experience tournament-grade racket servicing handled by certified stringers and carbon composite engineers.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Doorstep Pickup */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-xl transition-all group flex flex-col">
            <div className="h-48 overflow-hidden relative">
              <img
                src="/images/doorstep-delivery.jpg"
                alt="Doorstep Pickup and Delivery Concierge"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <span className="absolute top-3 left-3 bg-blue-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-xs">
                Step 1 &amp; 6
              </span>
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between space-y-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Doorstep Concierge</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Scheduled pickup and delivery in protective racket cases. Cash or UPI at doorstep.
                </p>
              </div>
              <p className="text-[11px] font-bold text-emerald-600">Free within {distanceConfig.freeRadiusKm} KM</p>
            </div>
          </div>

          {/* Card 2: Precision Carbon Repair */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-xl transition-all group flex flex-col">
            <div className="h-48 overflow-hidden relative">
              <img
                src="/images/racket-repair.jpg"
                alt="Aerospace Carbon Fiber Composite Repair"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <span className="absolute top-3 left-3 bg-amber-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-xs">
                Step 3 &amp; 4
              </span>
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between space-y-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Carbon Splice Lab</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Vacuum resin infusion and graphite splints restore broken frames to tournament rigidity.
                </p>
              </div>
              <p className="text-[11px] font-bold text-amber-600">7-Day SLA Guarantee</p>
            </div>
          </div>

          {/* Card 3: Electronic Stringing */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-xl transition-all group flex flex-col">
            <div className="h-48 overflow-hidden relative">
              <img
                src="/images/stringing-machine.jpg"
                alt="Constant-Pull Electronic Stringing Machine"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <span className="absolute top-3 left-3 bg-emerald-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-xs">
                Step 5
              </span>
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between space-y-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Electronic Tensioning</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Constant-pull digital machines guarantee exact poundage (20–32 lbs) with genuine tournament strings.
                </p>
              </div>
              <p className="text-[11px] font-bold text-blue-600">Free Grommet Check</p>
            </div>
          </div>

          {/* Card 4: Tournament Power */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-xl transition-all group flex flex-col">
            <div className="h-48 overflow-hidden relative">
              <img
                src="/images/jump-smash.jpg"
                alt="Tournament Jump Smash on Badminton Court"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <span className="absolute top-3 left-3 bg-purple-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-xs">
                Result
              </span>
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between space-y-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Tournament Smash Ready</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Deliver explosive smashes, pin-point drop shots, and crisp net play with guaranteed confidence.
                </p>
              </div>
              <p className="text-[11px] font-bold text-purple-600">Full Structural Warranty</p>
            </div>
          </div>
        </div>
      </section>

      {/* FREE RADIUS PROMOTIONAL SECTION WITH MAP */}
      <section id="distance-map" className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl p-6 sm:p-10 border border-slate-800 shadow-2xl space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black border border-emerald-500/30">
              UNBEATABLE CONVENIENCE
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              FREE PICKUP &amp; DELIVERY WITHIN {distanceConfig.freeRadiusKm} KM
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Locations beyond {distanceConfig.freeRadiusKm} KM are serviced with transparent distance-based charges. Use the interactive calculator below to test your address.
            </p>
          </div>

          {/* Interactive Map Visualizer */}
          <div className="max-w-3xl mx-auto">
            <MapSimulation
              distanceKm={interactiveDistance}
              onDistanceChange={(d) => setInteractiveDistance(d)}
            />
          </div>
        </div>
      </section>

      {/* REPAIR PROMOTION BANNER WITH ACTION BACKGROUND */}
      <section id="pricing-sla" className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
          <img
            src="/images/jump-smash.jpg"
            alt="Badminton Match Action"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-amber-950/75" />

          <div className="relative z-10 p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-3 max-w-xl text-white">
              <span className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black uppercase tracking-wider border border-amber-400/30">
                7-DAY STRUCTURAL SLA GUARANTEE
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white">
                Bat Damaged or Broken?
              </h2>
              <p className="text-sm text-slate-200 leading-relaxed">
                Don't discard your favorite badminton racquet! We handle doorstep pickup, precision carbon composite bonding, electronic stringing, and return delivery.
              </p>
            </div>

            <div className="shrink-0">
              <Button
                onClick={() => handleStartBooking('repair')}
                variant="white"
                size="lg"
                className="font-extrabold shadow-2xl text-base px-8 py-4 !text-slate-900 !bg-white hover:!bg-slate-100 hover:!text-black"
                rightIcon={<ArrowRight className="w-5 h-5 text-amber-600" />}
              >
                Request Repair Now
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* FREQUENTLY ASKED QUESTIONS */}
      <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            TRANSPARENCY FIRST
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Clear answers regarding pickup radius, estimates, doorstep payment, and repair warranties.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs transition-all"
            >
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 font-bold text-slate-900 text-sm hover:bg-slate-50 transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${openFaq === idx ? 'rotate-90' : ''}`} />
              </button>
              {openFaq === idx && (
                <div className="px-5 pb-5 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* QUICK MARKETING QR CODE ENTRY */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="p-8 bg-slate-100 rounded-3xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-6 text-left">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-600" /> Academy &amp; Club QR Scanning
            </h3>
            <p className="text-xs text-slate-600">
              Coaches and tournament players can scan our physical court poster for instant 1-click booking on mobile.
            </p>
          </div>
          <Button
            onClick={() => setQrModalOpen(true)}
            variant="outline"
            size="md"
            className="shrink-0 font-bold bg-white"
          >
            Preview Marketing QR Poster
          </Button>
        </div>
      </section>
    </div>
  );
};
