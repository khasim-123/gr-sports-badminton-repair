import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Button } from '../common/Button';
import { MapSimulation } from '../common/MapSimulation';
import { StatusBadge } from '../common/Badge';
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
  Star,
  Search,
  Zap,
  Check,
  Award,
  Flame,
  Layers,
  HelpCircle,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const {
    setActiveView,
    setCustomerSubView,
    setQrModalOpen,
    openLoginWithRole,
    openWizardWithService,
    openRequestDetail,
    distanceConfig,
    gettingServices,
    repairCategories,
    requests,
  } = useApp();

  const minGettingPrice = gettingServices.length > 0 ? Math.min(...gettingServices.map((g) => g.price)) : 250;
  const maxGettingPrice = gettingServices.length > 0 ? Math.max(...gettingServices.map((g) => g.price)) : 950;
  const minRepairPrice = repairCategories.length > 0 ? Math.min(...repairCategories.map((r) => r.basePrice)) : 150;

  // Interactive Hero Quick Booking Widget State
  const [heroService, setHeroService] = useState<'GETTING' | 'REPAIR'>('GETTING');
  const [heroBrand, setHeroBrand] = useState('Yonex');
  const [heroString, setHeroString] = useState('Yonex BG65');
  const [heroTension, setHeroTension] = useState(26);
  const [heroRepairIssue, setHeroRepairIssue] = useState('Upper Frame Crack (10–2 o\'clock)');

  // Interactive Live Tracker State
  const [trackQuery, setTrackQuery] = useState('GET-00025');
  const [trackedRequest, setTrackedRequest] = useState(() => requests.find(r => r.id === 'GET-00025') || requests[0] || null);

  // Interactive Tension Cost Estimator
  const [estimatorTension, setEstimatorTension] = useState(26);
  const [estimatorString, setEstimatorString] = useState('Yonex BG80 Power');
  const [interactiveDistance, setInteractiveDistance] = useState<number>(11.5);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleStartBooking = (type: 'getting' | 'repair') => {
    openWizardWithService(type === 'getting' ? 'GETTING' : 'REPAIR');
  };

  const handleHeroBookingSubmit = () => {
    openWizardWithService(heroService);
  };

  const handleTrackSearch = (idToSearch?: string) => {
    const id = (idToSearch || trackQuery).trim().toUpperCase();
    const found = requests.find(r => r.id.toUpperCase() === id);
    if (found) {
      setTrackedRequest(found);
      setTrackQuery(found.id);
    } else {
      setTrackedRequest(null);
    }
  };

  const faqs = [
    {
      q: `How does the ${distanceConfig.freeRadiusKm} KM Free Pickup & Delivery policy work?`,
      a: `Any address within a ${distanceConfig.freeRadiusKm} KM road radius of our master Indiranagar workshop hub qualifies for 100% free doorstep pickup and return delivery. For locations beyond ${distanceConfig.freeRadiusKm} KM, a transparent nominal distance fee (₹${distanceConfig.perKmRateBeyondFree}/KM) is applied. You can test your exact distance using the interactive map on this page!`
    },
    {
      q: 'Do I have to pay anything in advance when booking?',
      a: 'Absolutely not! GR Sports operates strictly on Zero Advance Payment. Whether it is electronic stringing or a major carbon composite frame restoration, payment is collected in-person only after your repaired racket is delivered back to your hands. You can inspect your bat first and pay via Cash or UPI QR scan.'
    },
    {
      q: 'What happens if hidden cracks are found during bat inspection?',
      a: 'When you submit a repair request, our executive collects the bat and logs its exterior condition at your doorstep. At our workshop, our carbon composite technicians conduct a micro-inspection. If additional hidden micro-fractures are discovered, an updated itemized estimate is sent to your portal. Repair work commences ONLY upon your explicit approval!'
    },
    {
      q: 'What is the 7-Day Repair SLA Guarantee?',
      a: 'All bat structural repairs are backed by a strict 7-day completion commitment. From the day of doorstep pickup, our composite curing and tension proofing are scheduled to deliver your racket back within 7 calendar days.'
    },
    {
      q: 'What strings and tensions are available for Bat Getting?',
      a: 'We stock 100% genuine Yonex (BG65, BG65 Titanium, BG80 Power, Aerobite, Exbolt 65, Nanogy 95) and Li-Ning (No. 1, No. 7) tournament strings. We offer digital constant-pull electronic stringing with custom tensions from 20 lbs to 32 lbs, including free grommet inspection and pre-stretching.'
    }
  ];

  // Customer Testimonials
  const testimonials = [
    {
      name: 'Vikram Shenoy',
      role: 'State Tournament Player • Whitefield Arena',
      rating: 5,
      racket: 'Yonex Astrox 99 Pro (28 LBS)',
      comment: 'Snapped my frame at 11 o’clock during a weekend tournament. Thought it was dead. GR Sports collected it from my apartment, repaired the carbon splice, and restrung to 28 lbs. Playing with it for 3 weeks now with full match power!'
    },
    {
      name: 'Priya Raman',
      role: 'Head Coach • Indiranagar Shuttle Academy',
      rating: 5,
      racket: 'Li-Ning Aeronaut 9000C (27 LBS)',
      comment: 'I get all my academy students’ racquets restrung here. Traditional manual crank stringers in local shops lose tension during clamping. The digital constant-pull accuracy here is obvious — net drops and smashes feel crisp!'
    },
    {
      name: 'Arjun Mehta',
      role: 'Weekend Club Shuttler • Koramangala',
      rating: 5,
      racket: 'Yonex Nanoflare 800 (Yonex BG80)',
      comment: 'The convenience is unbeatable. Booked online in 1 minute, executive collected it Saturday morning, and delivered it back Sunday afternoon in a protective case. Paid ₹450 via UPI at my door. Never driving to sports shops again!'
    }
  ];

  return (
    <div className="space-y-16 sm:space-y-24 pb-16">
      {/* 1. CUSTOMER HERO SECTION WITH LIVE INSTANT BOOKING LAUNCHER (LIGHT THEME) */}
      <section className="relative overflow-hidden pt-8 sm:pt-16 pb-16 bg-gradient-to-b from-blue-50/60 via-slate-50 to-white text-slate-900 border-b border-slate-200/60">
        {/* Soft atmospheric gradient accents */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[450px] bg-blue-400/10 blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-10 w-80 h-80 bg-emerald-400/10 blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10 space-y-8">
          {/* Top Badge & Customer Headline */}
          <div className="text-center space-y-4 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>DOORSTEP BADMINTON RACQUET RESTORATION &amp; STRINGING</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-950 leading-tight">
              Professional Bat Getting &amp; Structural Repair — Delivered to Your Doorstep
            </h1>

            <p className="text-base sm:text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
              Never waste hours driving to sports shops again. We pick up your badminton racquet, string it to exact tournament tension (20–32 lbs) or composite-repair frame fractures, and deliver it back — <span className="text-blue-700 font-bold">100% Free Doorstep Pickup within {distanceConfig.freeRadiusKm} KM</span> with <span className="text-emerald-700 font-bold">Zero Advance Payment</span>.
            </p>
          </div>

          {/* CUSTOMER 1-CLICK INSTANT BOOKING LAUNCHER CARD */}
          <div className="max-w-3xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 ring-1 ring-slate-900/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-500" /> Quick Doorstep Booking
                </h3>
                <p className="text-xs text-slate-500">Choose your service, see instant upfront pricing, and book in 60 seconds</p>
              </div>

              {/* Service Toggle Switch */}
              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setHeroService('GETTING')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                    heroService === 'GETTING'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>Bat Getting</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHeroService('REPAIR')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                    heroService === 'REPAIR'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5 text-white" />
                  <span>Bat Repair</span>
                </button>
              </div>
            </div>

            {/* Dynamic Form Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              {/* Field 1: Racquet Brand */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Racquet Brand
                </label>
                <select
                  value={heroBrand}
                  onChange={(e) => setHeroBrand(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl p-3 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                >
                  <option value="Yonex">Yonex (Japan)</option>
                  <option value="Li-Ning">Li-Ning (China)</option>
                  <option value="Victor">Victor (Taiwan)</option>
                  <option value="Apacs">Apacs</option>
                  <option value="Hundred">Hundred</option>
                  <option value="Carlton">Carlton</option>
                  <option value="Other">Other Brand</option>
                </select>
              </div>

              {/* Field 2 & 3: Service Specifics */}
              {heroService === 'GETTING' ? (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Tournament String
                    </label>
                    <select
                      value={heroString}
                      onChange={(e) => setHeroString(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl p-3 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                    >
                      <option value="Yonex BG65">Yonex BG65 (All-Round Durability)</option>
                      <option value="Yonex BG80 Power">Yonex BG80 Power (Hard Smashing)</option>
                      <option value="Yonex Aerobite">Yonex Aerobite (Spin &amp; Net Control)</option>
                      <option value="Yonex Nanogy 95">Yonex Nanogy 95 (High Repulsion)</option>
                      <option value="Li-Ning No. 1">Li-Ning No. 1 (Crisp Explosive Hit)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex justify-between">
                      <span>Target Tension</span>
                      <span className="text-blue-700 font-mono font-bold">{heroTension} LBS</span>
                    </label>
                    <select
                      value={heroTension}
                      onChange={(e) => setHeroTension(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl p-3 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                    >
                      <option value={22}>22 lbs (Beginner / Power Trampoline)</option>
                      <option value={24}>24 lbs (Club Intermediate)</option>
                      <option value={26}>26 lbs (Balanced Tournament)</option>
                      <option value={28}>28 lbs (Advanced Shuttler)</option>
                      <option value={30}>30 lbs (Tournament Pro Only)</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Reported Damage / Fracture Issue
                    </label>
                    <select
                      value={heroRepairIssue}
                      onChange={(e) => setHeroRepairIssue(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl p-3 outline-none focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-100 transition-all"
                    >
                      <option value="Upper Frame Crack (10–2 o'clock)">Upper Frame Crack (10–2 o'clock) • Toray Carbon Splice</option>
                      <option value="Full Frame Fracture / Snapped">Full Frame Fracture • Heavy Aerospace Splinting</option>
                      <option value="Shaft Structural Crack">Shaft Structural Crack • High-Modulus Resin Sleeve</option>
                      <option value="Handle / Cone Joint Loosened">Handle / Cone Joint Loosened • Core Re-bonding</option>
                      <option value="Multiple Cracks & Chips">Multiple Cracks &amp; Grommet Strip Damage</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Upfront Transparency Pill Box */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Service Fee</span>
                <span className="text-base font-black text-slate-900">
                  {heroService === 'GETTING' ? '₹450' : 'From ₹350'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Doorstep Pickup</span>
                <span className="text-base font-black text-emerald-700">₹0 FREE</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Turnaround SLA</span>
                <span className="text-base font-black text-blue-700">
                  {heroService === 'GETTING' ? '24–48 Hours' : 'Within 7 Days'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Advance Required</span>
                <span className="text-base font-black text-emerald-700">₹0 (Zero Advance)</span>
              </div>
            </div>

            {/* Launch Button */}
            <Button
              onClick={handleHeroBookingSubmit}
              size="lg"
              variant="primary"
              className={`w-full font-black text-base py-4 shadow-lg text-white ${
                heroService === 'GETTING'
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                  : 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
              }`}
              rightIcon={<ArrowRight className="w-5 h-5" />}
            >
              {heroService === 'GETTING'
                ? `Book Doorstep Bat Getting (${heroBrand} • ${heroString} @ ${heroTension} lbs)`
                : `Book Doorstep Bat Repair (${heroBrand} • 7-Day Guarantee)`}
            </Button>
          </div>

          {/* Customer Trust Value Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 max-w-4xl mx-auto">
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center gap-2 text-xs font-semibold text-slate-700">
              <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>100% Free Pickup ({distanceConfig.freeRadiusKm} KM)</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center gap-2 text-xs font-semibold text-slate-700">
              <Zap className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Zero Advance Payment</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center gap-2 text-xs font-semibold text-slate-700">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>7-Day Repair Warranty</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center gap-2 text-xs font-semibold text-slate-700">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
              <span>4.9 / 5 by 1,200+ Players</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CUSTOMER SELF-SERVICE: LIVE RACKET STATUS TRACKER */}
      <section id="track" className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="bg-white rounded-3xl border-2 border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md">
                CUSTOMER SELF-SERVICE
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-1">
                Track Your Racket Status Live
              </h3>
              <p className="text-xs text-slate-500">
                Already booked? Enter your Ticket ID to see real-time workshop progress:
              </p>
            </div>

            {/* Quick Demo Sample Badges */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] text-slate-400 font-semibold">Try sample:</span>
              <button
                type="button"
                onClick={() => handleTrackSearch('GET-00025')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-mono text-[11px] font-bold text-blue-700"
              >
                GET-00025
              </button>
              <button
                type="button"
                onClick={() => handleTrackSearch('REP-00025')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-mono text-[11px] font-bold text-amber-700"
              >
                REP-00025
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={trackQuery}
                onChange={(e) => setTrackQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTrackSearch()}
                placeholder="Enter Ticket ID (e.g. GET-00025 or REP-00025)..."
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
            <Button
              onClick={() => handleTrackSearch()}
              variant="primary"
              size="md"
              className="px-6 font-bold"
            >
              Track Racket
            </Button>
          </div>

          {/* Result Card */}
          {trackedRequest ? (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4 animate-in fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-blue-900 bg-blue-100 px-2.5 py-1 rounded-md">
                    {trackedRequest.id}
                  </span>
                  <h4 className="text-base font-bold text-slate-900">
                    {trackedRequest.batBrand} {trackedRequest.batModel}
                  </h4>
                </div>
                <StatusBadge status={trackedRequest.status} size="md" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 block">Service</span>
                  <span className="font-bold text-slate-800">
                    {trackedRequest.serviceType === 'GETTING' ? 'Bat Getting (Stringing)' : 'Carbon Composite Repair'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Tension / Issue</span>
                  <span className="font-bold text-blue-700">
                    {trackedRequest.serviceType === 'GETTING'
                      ? `${trackedRequest.stringTensionLbs || 26} lbs • ${trackedRequest.stringType || 'Yonex BG65'}`
                      : trackedRequest.repairIssue || 'Frame Repair'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Doorstep Pickup</span>
                  <span className="font-bold text-emerald-700">
                    {trackedRequest.isFreeDelivery ? 'Free (Within 15 KM)' : `+₹${trackedRequest.pickupDeliveryCharge}`}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Payment Mode</span>
                  <span className="font-bold text-slate-800">
                    {trackedRequest.paymentStatus === 'Paid' ? 'Paid on Delivery' : 'Zero Advance (Pay on Delivery)'}
                  </span>
                </div>
              </div>

              {/* Progress Stepper Visualizer */}
              <div className="pt-2 border-t border-slate-200">
                <p className="text-[11px] font-bold text-slate-500 mb-2">Current Lifecycle Stage:</p>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                  {['Pickup Scheduled', 'Bat Picked Up', 'Inspection / In Progress', 'Ready to Deliver', 'Completed'].map((stage, idx) => {
                    const isDone = idx === 0 || (idx === 1 && trackedRequest.status !== 'Pickup Scheduled');
                    const isCurrent = (idx === 2 && ['Getting in Progress', 'Repair in Progress', 'Inspection'].includes(trackedRequest.status)) ||
                                      (idx === 3 && ['Getting Completed', 'Repair Completed', 'Out for Delivery'].includes(trackedRequest.status)) ||
                                      (idx === 4 && trackedRequest.status === 'Completed');
                    return (
                      <div
                        key={idx}
                        className={`px-3 py-1.5 rounded-xl whitespace-nowrap font-semibold flex items-center gap-1.5 ${
                          isCurrent
                            ? 'bg-blue-600 text-white font-bold shadow-sm'
                            : isDone
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {isDone ? <Check className="w-3 h-3 text-emerald-700" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
                        <span>{stage}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => openRequestDetail(trackedRequest.id)}
                  size="sm"
                  variant="outline"
                  className="font-bold text-xs"
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  View Full Request Details
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-slate-50 rounded-2xl text-center text-xs text-slate-500 border border-slate-200">
              No service ticket found for "{trackQuery}". Please verify your ticket ID or book a new service.
            </div>
          )}
        </div>
      </section>

      {/* 3. CUSTOMER VALUE: WHY PLAYERS CHOOSE GR SPORTS OVER LOCAL SHOPS */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3.5 py-1 rounded-full border border-emerald-200">
            ENGINEERED FOR SHUTTLERS
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900">
            Why Players Choose GR Sports Over Local Sports Shops
          </h2>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Traditional sports stores make you battle traffic and wait days. We bring tournament workshop craftsmanship directly to your doorstep.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Pillar 1 */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs hover:shadow-lg transition-all space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Truck className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900">Free Doorstep Pickup</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Never drive through traffic or waste weekends visiting sports stores. We collect and deliver in protective padded racket carriers within 15 KM at ₹0 fee.
            </p>
            <span className="inline-block text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md">
              100% Free Radius: {distanceConfig.freeRadiusKm} KM
            </span>
          </div>

          {/* Pillar 2 */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs hover:shadow-lg transition-all space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Zap className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900">Zero Advance Payment</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pay nothing upfront. We collect payment only upon doorstep delivery after you physically inspect your renewed racket and test its string tension.
            </p>
            <span className="inline-block text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md">
              Cash &amp; UPI on Delivery
            </span>
          </div>

          {/* Pillar 3 */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs hover:shadow-lg transition-all space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900">Electronic Constant-Pull</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Manual crank stringers lose 2–4 lbs of tension during knot tying. Our digital load-cell machines eliminate tension drop with exact ±0.1 lbs tournament calibration.
            </p>
            <span className="inline-block text-[11px] font-bold text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-md">
              Tension: 20 to 32 LBS
            </span>
          </div>

          {/* Pillar 4 */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs hover:shadow-lg transition-all space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900">7-Day Structural Guarantee</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Don’t discard your favorite broken racquet! Our aerospace Toray T800 graphite splice restores frame integrity up to 30+ lbs with a strict 7-day turnaround SLA.
            </p>
            <span className="inline-block text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md">
              Full Structural Warranty
            </span>
          </div>
        </div>
      </section>

      {/* 4. CORE 2 SERVICES BREAKDOWN CARDS */}
      <section id="services" className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            OUR TWO SPECIALIZED LINES
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900">
            Tournament-Grade Racket Services
          </h2>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Choose precision electronic stringing or structural carbon composite restoration.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card 1: BAT GETTING */}
          <div className="bg-white rounded-3xl border-2 border-slate-200 p-6 sm:p-8 shadow-sm hover:border-blue-400 hover:shadow-xl transition-all flex flex-col justify-between space-y-6 group">
            <div className="space-y-4">
              <div className="relative h-52 sm:h-60 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-2xs">
                <img
                  src="/images/stringing-machine.jpg"
                  alt="Electronic Badminton Stringing Machine"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
                  <span className="font-extrabold bg-blue-600/90 backdrop-blur-xs px-2.5 py-1 rounded-xl">
                    Constant-Pull Load-Cell
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
                <h3 className="text-2xl font-black text-slate-900 mt-2">Bat Getting (Electronic Stringing)</h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  High-precision digital constant-pull stringing using genuine Yonex, Li-Ning, and Victor tournament multifilaments. Custom tension from 20 to 32 lbs with free grommet check.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-2">
                <p className="font-bold text-slate-800">What’s Included:</p>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Constant-Pull 20–32 lbs</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Free Grommet Check</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Pre-stretch Enabled</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 24–48h Doorstep Return</span>
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
              <div className="relative h-52 sm:h-60 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-2xs">
                <img
                  src="/images/racket-repair.jpg"
                  alt="Badminton Carbon Composite Frame Repair"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
                  <span className="font-extrabold bg-amber-600/90 backdrop-blur-xs px-2.5 py-1 rounded-xl">
                    Aerospace Carbon Splice
                  </span>
                  <span className="bg-slate-900/80 backdrop-blur-xs px-2 py-0.5 rounded-lg text-[10px] font-bold">
                    7-Day SLA Guarantee
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md">
                  Service 2
                </span>
                <h3 className="text-2xl font-black text-slate-900 mt-2">Bat Repair (Carbon Composite)</h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  Damaged or cracked racquet? Aerospace Toray T800 carbon fiber splinting with vacuum epoxy resin infusion restores frame structural rigidity for high-tension play.
                </p>
              </div>

              <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200 text-xs space-y-2">
                <p className="font-bold text-amber-900">What’s Included:</p>
                <div className="grid grid-cols-2 gap-2 text-amber-950">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-amber-700" /> Toray T800 Carbon Weave</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-amber-700" /> Slow-Cure Resin Infusion</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-amber-700" /> Tested to 30 LBS Flex</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-amber-700" /> 7-Day Guarantee Target</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Starting Base</span>
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

      {/* 5. INTERACTIVE TENSION & SERVICE ESTIMATOR (LIGHT THEME) */}
      <section id="calculator" className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-10 border-2 border-slate-200 shadow-xl space-y-8">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-800 bg-emerald-50 px-3.5 py-1 rounded-full border border-emerald-200">
              CUSTOMIZE YOUR SERVICE
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950">
              Interactive Tension &amp; Cost Estimator
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Slide to your preferred string tension to see its playing profile and exact upfront pricing:
            </p>
          </div>

          <div className="space-y-6 max-w-2xl mx-auto">
            {/* Tension Slider */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-500 block font-semibold">Selected Tension</span>
                  <span className="text-3xl font-black text-blue-700 font-mono">{estimatorTension} LBS</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">Playing Profile</span>
                  <span className="text-xs font-bold text-slate-800">
                    {estimatorTension <= 23
                      ? 'Maximum Power & Sweet Spot (Beginner)'
                      : estimatorTension <= 27
                      ? 'Balanced Power & Control (Club Shuttler)'
                      : 'Pinpoint Control & Repulsion (Tournament Pro)'}
                  </span>
                </div>
              </div>

              <input
                type="range"
                min="20"
                max="32"
                step="1"
                value={estimatorTension}
                onChange={(e) => setEstimatorTension(parseInt(e.target.value, 10))}
                className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
              />

              <div className="flex justify-between text-[10px] text-slate-500 font-mono font-medium">
                <span>20 LBS (Max Repulsion)</span>
                <span>26 LBS (Standard Match)</span>
                <span>32 LBS (Pro Stiff)</span>
              </div>
            </div>

            {/* String Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { name: 'Yonex BG65', type: 'Durability', price: 400 },
                { name: 'Yonex BG80 Power', type: 'Hard Hitting', price: 500 },
                { name: 'Yonex Aerobite', type: 'Spin / Control', price: 600 },
              ].map((str) => (
                <div
                  key={str.name}
                  onClick={() => setEstimatorString(str.name)}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    estimatorString === str.name
                      ? 'bg-blue-50/80 border-blue-500 text-slate-900 shadow-sm ring-1 ring-blue-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100/50'
                  }`}
                >
                  <p className="font-bold text-sm text-slate-900">{str.name}</p>
                  <p className="text-[11px] text-slate-500">{str.type}</p>
                  <p className="text-base font-extrabold text-blue-700 mt-2">₹{str.price}</p>
                </div>
              ))}
            </div>

            {/* Total Estimate Breakdown */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Selected String &amp; Digital Tension:</span>
                <span className="font-bold text-slate-900">{estimatorString} @ {estimatorTension} lbs</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Doorstep Collection &amp; Return:</span>
                <span className="font-bold text-emerald-700">₹0 (Free within {distanceConfig.freeRadiusKm} KM)</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Advance Required:</span>
                <span className="font-bold text-emerald-700">₹0 (Zero Advance)</span>
              </div>
              <div className="pt-3 border-t border-slate-200 flex justify-between text-base font-black">
                <span className="text-slate-900">Total Due on Delivery:</span>
                <span className="text-blue-700 font-mono text-2xl">
                  ₹{estimatorString === 'Yonex BG65' ? 400 : estimatorString === 'Yonex BG80 Power' ? 500 : 600}
                </span>
              </div>
            </div>

            <Button
              onClick={() => handleStartBooking('getting')}
              size="lg"
              variant="primary"
              className="w-full font-black text-base py-4 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
              rightIcon={<ArrowRight className="w-5 h-5" />}
            >
              Book Doorstep Pickup for this Setup →
            </Button>
          </div>
        </div>
      </section>

      {/* 6. HOW IT WORKS FOR YOU (4 SIMPLE STEPS) */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            SIMPLE &amp; CONVENIENT
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900">How It Works for You</h2>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Book online in seconds. We handle the rest from doorstep pickup to tournament delivery.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              step: '1',
              title: 'Book Online in 60s',
              desc: 'Select Bat Getting or Repair, choose your racket brand & tension, and pick your preferred doorstep pickup slot. ₹0 advance payment.',
            },
            {
              step: '2',
              title: 'Doorstep Pickup',
              desc: 'Our logistics executive collects your racket from your apartment or club in a padded protective case and issues a digital receipt.',
            },
            {
              step: '3',
              title: 'Master Workshop Care',
              desc: 'Electronic constant-pull stringing (±0.1 lbs) or Toray carbon composite frame splice performed in our specialized facility.',
            },
            {
              step: '4',
              title: 'Delivery & Inspect',
              desc: 'We deliver your renewed racquet back to your doorstep. Inspect your racquet, test the ping and tension, then pay via Cash or UPI.',
            },
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

      {/* 7. VISUAL CRAFTSMANSHIP & EXPERIENCE GALLERY */}
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
          {/* Card 1 */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-xl transition-all group flex flex-col">
            <div className="h-48 overflow-hidden relative">
              <img
                src="/images/doorstep-delivery.jpg"
                alt="Doorstep Pickup and Delivery Concierge"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <span className="absolute top-3 left-3 bg-blue-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-xs">
                Step 1 &amp; 4
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

          {/* Card 2 */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-xl transition-all group flex flex-col">
            <div className="h-48 overflow-hidden relative">
              <img
                src="/images/racket-repair.jpg"
                alt="Aerospace Carbon Fiber Composite Repair"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <span className="absolute top-3 left-3 bg-amber-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-xs">
                Carbon Splice
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

          {/* Card 3 */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-xl transition-all group flex flex-col">
            <div className="h-48 overflow-hidden relative">
              <img
                src="/images/stringing-machine.jpg"
                alt="Constant-Pull Electronic Stringing Machine"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <span className="absolute top-3 left-3 bg-emerald-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-xs">
                Electronic Pull
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

          {/* Card 4 */}
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

      {/* 8. 15 KM FREE RADIUS PROMOTIONAL SECTION WITH INTERACTIVE MAP (LIGHT THEME) */}
      <section id="distance-map" className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="bg-gradient-to-b from-blue-50/70 via-slate-50 to-white text-slate-900 rounded-3xl p-6 sm:p-10 border-2 border-slate-200 shadow-xl space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-black border border-emerald-300 shadow-xs">
              UNBEATABLE CONVENIENCE
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight">
              FREE PICKUP &amp; DELIVERY WITHIN {distanceConfig.freeRadiusKm} KM
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
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

      {/* 9. REAL CUSTOMER REVIEWS & TESTIMONIALS (SOCIAL PROOF) */}
      <section id="reviews" className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
            TESTED ON COURT
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900">
            Loved by 1,200+ Competitive Shuttlers &amp; Coaches
          </h2>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Read what tournament players and club members say about our tension accuracy and carbon frame repairs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((test, idx) => (
            <div
              key={idx}
              className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-blue-400 hover:shadow-md transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-1 text-amber-400">
                  {[...Array(test.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-xs text-slate-700 leading-relaxed italic">
                  "{test.comment}"
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{test.name}</h4>
                  <p className="text-[11px] text-slate-500">{test.role}</p>
                </div>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  {test.racket}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 10. REPAIR PROMOTION BANNER */}
      <section id="pricing-sla" className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="relative rounded-3xl overflow-hidden shadow-xl border-2 border-amber-300 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600">
          <img
            src="/images/jump-smash.jpg"
            alt="Badminton Match Action"
            className="absolute inset-0 w-full h-full object-cover object-center mix-blend-overlay opacity-25"
          />

          <div className="relative z-10 p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-3 max-w-xl text-white">
              <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-white text-xs font-black uppercase tracking-wider border border-white/30 backdrop-blur-xs shadow-xs">
                7-DAY STRUCTURAL SLA GUARANTEE
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white">
                Bat Damaged or Broken in Match Play?
              </h2>
              <p className="text-sm text-amber-50 leading-relaxed font-medium">
                Don’t discard your favorite badminton racquet! We handle doorstep pickup, precision carbon composite bonding, electronic stringing, and return delivery.
              </p>
            </div>

            <div className="shrink-0">
              <Button
                onClick={() => handleStartBooking('repair')}
                variant="white"
                size="lg"
                className="font-extrabold shadow-2xl text-base px-8 py-4 !text-amber-900 !bg-white hover:!bg-amber-50"
                rightIcon={<ArrowRight className="w-5 h-5 text-amber-600" />}
              >
                Request Repair Now
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 11. FREQUENTLY ASKED QUESTIONS */}
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
                type="button"
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

      {/* 12. ACADEMY & CLUB QR CODE ENTRY */}
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
export default LandingPage;
