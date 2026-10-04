import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/Badge';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyStates';
import { BatConditionAtPickup, PaymentMethod, RepairEstimate } from '../../types';
import {
  Truck,
  Wrench,
  DollarSign,
  Phone,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Calendar,
  X,
  FileText,
  Clock,
  MapPin,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Camera,
} from 'lucide-react';

export const EmployeePortal: React.FC = () => {
  const {
    requests,
    employeeSubView,
    setEmployeeSubView,
    recordPickupCondition,
    createRepairEstimate,
    requestPriceRevision,
    completeGettingJob,
    completeRepairJob,
    startDelivery,
    recordManualPayment,
    updateRequestStatus,
    approveRepairEstimate,
    addToast,
  } = useApp();

  // Active Modals
  const [pickupModalReqId, setPickupModalReqId] = useState<string | null>(null);
  const [condition, setCondition] = useState<BatConditionAtPickup>('Damaged');
  const [conditionNotes, setConditionNotes] = useState<string>('Upper frame cracked, strings removed.');
  const [isCollectedChecked, setIsCollectedChecked] = useState<boolean>(true);

  // Inspection Modal
  const [inspectModalReqId, setInspectModalReqId] = useState<string | null>(null);
  const [labourCharge, setLabourCharge] = useState<number | string>(300);
  const [materialsCharge, setMaterialsCharge] = useState<number | string>(100);
  const [additionalCharges, setAdditionalCharges] = useState<number | string>(0);
  const [discount, setDiscount] = useState<number | string>(0);
  const [inspectionNotes, setInspectionNotes] = useState<string>(
    'Shaft intact. Upper carbon frame requires composite splinting and resin infusion.'
  );
  const [expectedDate, setExpectedDate] = useState<string>('2026-10-06');

  // Revised Price Modal
  const [revisionModalReqId, setRevisionModalReqId] = useState<string | null>(null);
  const [revisionAdditional, setRevisionAdditional] = useState<number | string>(250);
  const [revisionReason, setRevisionReason] = useState<string>(
    'Additional frame and shaft damage identified during repair preparation.'
  );

  // Delivery & Payment Modal
  const [deliveryModalReqId, setDeliveryModalReqId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | string>(450);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentNotes, setPaymentNotes] = useState<string>('Collected at customer doorstep');

  // Filter lists for employee
  const pickupTasks = requests.filter(
    (r) => r.status === 'Accepted' || r.status === 'Employee Assigned' || r.status === 'Pickup Scheduled'
  );
  const gettingJobs = requests.filter(
    (r) => r.serviceType === 'GETTING' && (r.status === 'Bat Picked Up' || r.status === 'Getting in Progress')
  );
  const repairJobs = requests.filter(
    (r) =>
      r.serviceType === 'REPAIR' &&
      (r.status === 'Bat Picked Up' ||
        r.status === 'Inspection' ||
        r.status === 'Awaiting Customer Approval' ||
        r.status === 'Repair Approved' ||
        r.status === 'Repair in Progress')
  );
  const deliveryTasks = requests.filter(
    (r) => r.status === 'Getting Completed' || r.status === 'Repair Completed' || r.status === 'Out for Delivery'
  );
  const paymentsCollected = requests.filter((r) => r.paymentStatus === 'Paid' && r.paymentRecord);

  // Total collected by employee
  const totalCollectedToday = paymentsCollected.reduce(
    (acc, curr) => acc + (curr.paymentRecord?.amount || 0),
    0
  );

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 pb-24 sm:pb-8">
      {/* Mobile Top Header */}
      <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-xl flex items-center justify-between">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
            EMPLOYEE FIELD OPS
          </span>
          <h2 className="text-xl font-black mt-1">Technician & Logistics Portal</h2>
          <p className="text-xs text-slate-400">Doorstep pickups, stringing, inspections & payment reconciliation</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-xs text-slate-400">Today's Collections</p>
          <p className="text-xl font-extrabold text-emerald-400">₹{totalCollectedToday}</p>
        </div>
      </div>

      {/* Navigation Pills (Mobile touch bar only; desktop uses unified top Navbar to eliminate duplicate navigation) */}
      <div className="md:hidden flex overflow-x-auto gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
        {[
          { id: 'dashboard', label: 'Dashboard', count: null },
          { id: 'pickups', label: 'Pickups', count: pickupTasks.length },
          { id: 'getting', label: 'Getting Jobs', count: gettingJobs.length },
          { id: 'repair', label: 'Repair & Inspect', count: repairJobs.length },
          { id: 'deliveries', label: 'Deliveries', count: deliveryTasks.length },
          { id: 'payments', label: 'Payments', count: paymentsCollected.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setEmployeeSubView(tab.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              employeeSubView === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 bg-white/70'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== null && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  employeeSubView === tab.id ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* SUBVIEW: DASHBOARD */}
      {employeeSubView === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              onClick={() => setEmployeeSubView('pickups')}
              className="bg-white p-4 rounded-2xl border border-slate-200 cursor-pointer hover:border-blue-400 transition-colors shadow-2xs"
            >
              <div className="flex justify-between items-center text-slate-500 mb-1">
                <span className="text-xs font-semibold">Today's Pickups</span>
                <Truck className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-black text-slate-900">{pickupTasks.length}</p>
            </div>

            <div
              onClick={() => setEmployeeSubView('getting')}
              className="bg-white p-4 rounded-2xl border border-slate-200 cursor-pointer hover:border-blue-400 transition-colors shadow-2xs"
            >
              <div className="flex justify-between items-center text-slate-500 mb-1">
                <span className="text-xs font-semibold">Stringing Jobs</span>
                <Wrench className="w-4 h-4 text-teal-600" />
              </div>
              <p className="text-2xl font-black text-slate-900">{gettingJobs.length}</p>
            </div>

            <div
              onClick={() => setEmployeeSubView('repair')}
              className="bg-white p-4 rounded-2xl border border-slate-200 cursor-pointer hover:border-blue-400 transition-colors shadow-2xs"
            >
              <div className="flex justify-between items-center text-slate-500 mb-1">
                <span className="text-xs font-semibold">Repairs & Inspect</span>
                <Wrench className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-black text-slate-900">{repairJobs.length}</p>
            </div>

            <div
              onClick={() => setEmployeeSubView('deliveries')}
              className="bg-white p-4 rounded-2xl border border-slate-200 cursor-pointer hover:border-blue-400 transition-colors shadow-2xs"
            >
              <div className="flex justify-between items-center text-slate-500 mb-1">
                <span className="text-xs font-semibold">Ready to Deliver</span>
                <Truck className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-slate-900">{deliveryTasks.length}</p>
            </div>
          </div>

          {/* Service Workstations Live Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Stringing Workstation */}
            <div
              onClick={() => setEmployeeSubView('getting')}
              className="group relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 p-5 text-white cursor-pointer hover:border-blue-500/60 transition-all shadow-md"
            >
              <div className="absolute inset-0 z-0">
                <img
                  src="/images/stringing-machine.jpg"
                  alt="Electronic Stringing Machine"
                  className="w-full h-full object-cover opacity-25 group-hover:scale-105 group-hover:opacity-35 transition-all duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-transparent" />
              </div>
              <div className="relative z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2.5 py-0.5 rounded-full">
                    BENCH 01 • GETTING & STRINGING
                  </span>
                  <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/80 px-2.5 py-0.5 rounded-md border border-blue-800">
                    {gettingJobs.length} In Queue
                  </span>
                </div>
                <div>
                  <h4 className="text-lg font-black text-white group-hover:text-blue-300 transition-colors">
                    Electronic Constant-Pull Station
                  </h4>
                  <p className="text-xs text-slate-300 line-clamp-2 mt-0.5">
                    Yonex/Li-Ning 6-point mount system, digital load-cell micro-tensioning (18–34 LBS).
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                  <span className="text-slate-400">±0.1 LBS Load-Cell Calibration</span>
                  <span className="text-blue-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Enter Stringing Queue <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>

            {/* Repair Workstation */}
            <div
              onClick={() => setEmployeeSubView('repair')}
              className="group relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 p-5 text-white cursor-pointer hover:border-amber-500/60 transition-all shadow-md"
            >
              <div className="absolute inset-0 z-0">
                <img
                  src="/images/racket-repair.jpg"
                  alt="Carbon Composite Repair"
                  className="w-full h-full object-cover opacity-25 group-hover:scale-105 group-hover:opacity-35 transition-all duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-transparent" />
              </div>
              <div className="relative z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
                    LAB 02 • CARBON COMPOSITE REPAIR
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/80 px-2.5 py-0.5 rounded-md border border-amber-800">
                    {repairJobs.length} Active Jobs
                  </span>
                </div>
                <div>
                  <h4 className="text-lg font-black text-white group-hover:text-amber-300 transition-colors">
                    Carbon Structural Splinting & Resin Matrix
                  </h4>
                  <p className="text-xs text-slate-300 line-clamp-2 mt-0.5">
                    Toray T800 carbon fiber splinting, slow-cure aerospace epoxy, 7-day SLA guarantee.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                  <span className="text-slate-400">7-Day Turnaround SLA Guarantee</span>
                  <span className="text-amber-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Enter Repair Queue <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Urgent Pickup Queue */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900">Urgent Pending Doorstep Pickups</h3>
              <button
                onClick={() => setEmployeeSubView('pickups')}
                className="text-xs text-blue-600 font-bold hover:underline"
              >
                View All ({pickupTasks.length})
              </button>
            </div>

            {pickupTasks.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No pending pickups for today.</p>
            ) : (
              <div className="space-y-3">
                {pickupTasks.slice(0, 3).map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded-md">
                          {req.id}
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          {req.batBrand} {req.batModel}
                        </span>
                        <StatusBadge status={req.status} size="sm" />
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        <b>Customer:</b> {req.customerName} ({req.customerMobile}) •{' '}
                        <b>Address:</b> {req.pickupAddress.area} ({req.distanceKm} KM)
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${req.customerMobile}`}
                        className="px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
                      >
                        <Phone className="w-3.5 h-3.5 text-blue-600" /> Call
                      </a>
                      <Button
                        onClick={() => {
                          setPickupModalReqId(req.id);
                        }}
                        size="sm"
                        variant="primary"
                      >
                        Start Doorstep Pickup
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBVIEW: PICKUP TASKS (Figma Item 37 & 38) */}
      {employeeSubView === 'pickups' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Pickups Header Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-5 border border-slate-800 shadow-lg">
            <div className="absolute inset-0 z-0">
              <img
                src="/images/doorstep-delivery.jpg"
                alt="Doorstep Pickup Service"
                className="w-full h-full object-cover opacity-20"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-transparent" />
            </div>
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-400/30">
                  FREE 15 KM RADIUS • ZERO ADVANCE PAYMENT
                </span>
                <h3 className="text-xl font-black mt-1">Scheduled Doorstep Bat Collections</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Inspect frame condition at customer doorstep • Log photos • Issue instant digital pickup receipt
                </p>
              </div>
              <div className="bg-slate-800/80 border border-slate-700/80 px-4 py-2 rounded-2xl shrink-0 text-center sm:text-right">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Scheduled Today</p>
                <p className="text-2xl font-black text-blue-400">{pickupTasks.length} Bats</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-900">Assigned Customer Pickups</h3>
            <span className="text-xs text-slate-500 font-semibold">{pickupTasks.length} Pending</span>
          </div>

          {pickupTasks.length === 0 ? (
            <EmptyState
              type="no_pickups"
              title="No Pending Pickups"
              description="All customer bats have been collected or no new bookings require pickup."
            />
          ) : (
            <div className="space-y-4">
              {pickupTasks.map((req) => (
                <div
                  key={req.id}
                  className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-md">
                        {req.id}
                      </span>
                      <h4 className="text-base font-bold text-slate-900">
                        {req.batBrand} {req.batModel}
                      </h4>
                    </div>
                    <StatusBadge status={req.status} size="sm" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                      <p className="font-bold text-slate-700">Customer Details:</p>
                      <p className="text-slate-900 font-semibold">{req.customerName}</p>
                      <p className="text-slate-600">{req.customerMobile}</p>
                      <p className="text-slate-500">{req.customerEmail}</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                      <p className="font-bold text-slate-700 flex items-center justify-between">
                        <span>Pickup Location:</span>
                        <span className="text-blue-700">{req.distanceKm} KM ({req.isFreeDelivery ? 'Free' : `+₹${req.pickupDeliveryCharge}`})</span>
                      </p>
                      <p className="text-slate-900">{req.pickupAddress.houseFlat}, {req.pickupAddress.street}</p>
                      <p className="text-slate-600">{req.pickupAddress.area}, {req.pickupAddress.pincode}</p>
                      <p className="text-slate-500">Landmark: {req.pickupAddress.landmark || 'N/A'}</p>
                    </div>
                  </div>

                  {req.additionalNotes && (
                    <p className="text-xs bg-amber-50 text-amber-800 p-2.5 rounded-xl border border-amber-200 italic">
                      <b>Customer Note:</b> "{req.additionalNotes}"
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                    <a
                      href={`https://maps.google.com?q=${encodeURIComponent(req.pickupAddress.area + ' ' + req.pickupAddress.pincode)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5"
                    >
                      <Navigation className="w-3.5 h-3.5 text-blue-600" /> Navigate Map
                    </a>
                    <a
                      href={`tel:${req.customerMobile}`}
                      className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-600" /> Call Customer
                    </a>
                    <Button
                      onClick={() => setPickupModalReqId(req.id)}
                      variant="primary"
                      size="sm"
                      className="w-full sm:w-auto font-bold ml-auto"
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                    >
                      Record Bat Condition & Confirm Pickup
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBVIEW: GETTING JOBS (Figma Item 39) */}
      {employeeSubView === 'getting' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Workstation Technical Header */}
          <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-5 border border-slate-800 shadow-lg">
            <div className="absolute inset-0 z-0">
              <img
                src="/images/stringing-machine.jpg"
                alt="Electronic Stringing Machine"
                className="w-full h-full object-cover opacity-20"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-transparent" />
            </div>
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-400/30">
                  ELECTRONIC BENCH • 6-POINT CONSTANT-PULL
                </span>
                <h3 className="text-xl font-black mt-1">Bat Getting & Precision Stringing</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Digital load-cell calibration (±0.1 LBS) • Pre-stretch enabled • Diamond-dusted clamp teeth
                </p>
              </div>
              <div className="bg-slate-800/80 border border-slate-700/80 px-4 py-2 rounded-2xl shrink-0 text-center sm:text-right">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Stringing Queue</p>
                <p className="text-2xl font-black text-blue-400">{gettingJobs.length} Bats</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-900">Active Stringing Queue</h3>
            <span className="text-xs text-slate-500 font-semibold">{gettingJobs.length} In Queue</span>
          </div>

          {gettingJobs.length === 0 ? (
            <EmptyState
              type="no_getting"
              title="Stringing Queue Empty"
              description="No badminton bats currently pending electronic stringing."
            />
          ) : (
            <div className="space-y-4">
              {gettingJobs.map((req) => (
                <div
                  key={req.id}
                  className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-md">
                        {req.id}
                      </span>
                      <h4 className="text-base font-bold text-slate-900">
                        {req.batBrand} {req.batModel}
                      </h4>
                    </div>
                    <StatusBadge status={req.status} size="sm" />
                  </div>

                  {/* Stringing Specs Card with Real Machine Photo */}
                  <div className="flex flex-col sm:flex-row gap-4 items-center bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100">
                    <div className="relative w-full sm:w-32 h-24 rounded-xl overflow-hidden shrink-0 border border-blue-200 shadow-2xs">
                      <img
                        src="/images/stringing-machine.jpg"
                        alt="Constant-Pull Stringing"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 right-1 bg-slate-900/80 backdrop-blur-xs text-[9px] font-bold text-center text-blue-300 py-0.5 rounded">
                        Electronic Pull
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs w-full">
                      <div>
                        <p className="text-slate-500 text-[11px]">Getting Tier:</p>
                        <p className="font-bold text-blue-900">{req.gettingType}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-[11px]">Target Tension:</p>
                        <p className="font-extrabold text-blue-700 text-sm">{req.stringTensionLbs || 26} lbs</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-[11px]">String Model:</p>
                        <p className="font-semibold text-slate-800">{req.stringType || 'Yonex BG65'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-[11px]">Service Charge:</p>
                        <p className="font-bold text-slate-900">₹{req.gettingPrice || 450}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    {req.status === 'Bat Picked Up' ? (
                      <Button
                        onClick={() =>
                          updateRequestStatus(req.id, 'Getting in Progress', 'Rajesh Kumar (Master Stringer)', 'Mounted on electronic machine')
                        }
                        variant="primary"
                        size="sm"
                      >
                        Start Getting (Stringing)
                      </Button>
                    ) : (
                      <Button
                        onClick={() => completeGettingJob(req.id, 'Stringing tension calibrated. Cleaned grommets.')}
                        variant="success"
                        size="sm"
                        leftIcon={<CheckCircle2 className="w-4 h-4" />}
                      >
                        Complete Getting & Mark Ready for Delivery
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBVIEW: REPAIR & INSPECTION (Figma Items 40, 41, 42, 43) */}
      {employeeSubView === 'repair' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Workstation Technical Header */}
          <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-5 border border-slate-800 shadow-lg">
            <div className="absolute inset-0 z-0">
              <img
                src="/images/racket-repair.jpg"
                alt="Carbon Composite Repair"
                className="w-full h-full object-cover opacity-20"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-transparent" />
            </div>
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                  COMPOSITE LAB • 7-DAY SLA GUARANTEE
                </span>
                <h3 className="text-xl font-black mt-1">Carbon Fiber Splice & Structural Resin Lab</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  High-tensile carbon sleeve • Vacuum resin infiltration • Re-tested to 28+ LBS before release
                </p>
              </div>
              <div className="bg-slate-800/80 border border-slate-700/80 px-4 py-2 rounded-2xl shrink-0 text-center sm:text-right">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Active Repairs</p>
                <p className="text-2xl font-black text-amber-400">{repairJobs.length} Bats</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-900">Repair Inspection & Carbon Bonding</h3>
            <span className="text-xs text-slate-500 font-semibold">{repairJobs.length} In Progress</span>
          </div>

          {repairJobs.length === 0 ? (
            <EmptyState
              type="no_repair"
              title="No Pending Repairs"
              description="All structural repairs have been completed or dispatched."
            />
          ) : (
            <div className="space-y-4">
              {repairJobs.map((req) => (
                <div
                  key={req.id}
                  className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-md">
                        {req.id}
                      </span>
                      <h4 className="text-base font-bold text-slate-900">
                        {req.batBrand} {req.batModel}
                      </h4>
                    </div>
                    <StatusBadge status={req.status} size="sm" />
                  </div>

                  {/* Photo & Structural Diagnostics */}
                  <div className="flex flex-col sm:flex-row gap-4 items-center bg-amber-50/40 p-3.5 rounded-2xl border border-amber-100">
                    <div className="relative w-full sm:w-32 h-24 rounded-xl overflow-hidden shrink-0 border border-amber-200 shadow-2xs">
                      <img
                        src="/images/racket-repair.jpg"
                        alt="Carbon Composite Splice"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 right-1 bg-slate-900/80 backdrop-blur-xs text-[9px] font-bold text-center text-amber-300 py-0.5 rounded">
                        Carbon Splice Lab
                      </span>
                    </div>

                    <div className="flex-1 space-y-1.5 text-xs w-full">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">Reported Structural Issue:</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                          7-Day SLA Tracked
                        </span>
                      </div>
                      <p className="text-amber-900 font-semibold">{req.repairIssue}</p>
                      <p className="text-slate-600 italic">"{req.repairDescription}"</p>
                      {req.pickupCondition && (
                        <p className="text-slate-500 pt-1 border-t border-amber-200/60 text-[11px]">
                          <b>Pickup Intake Condition:</b> {req.pickupCondition.condition} ({req.pickupCondition.notes})
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Existing Estimate if already created */}
                  {req.repairEstimate && (
                    <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 text-xs flex justify-between items-center">
                      <div>
                        <span className="font-bold text-blue-900">Current Estimate: ₹{req.repairEstimate.totalEstimate}</span>
                        {req.repairEstimate.isRevised && (
                          <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold text-[10px]">
                            REVISED
                          </span>
                        )}
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Labour: ₹{req.repairEstimate.labourCharge} | Materials: ₹{req.repairEstimate.materialsCharge}
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500">
                        Target: {req.repairEstimate.expectedCompletionDate || 'Within 7 Days'}
                      </span>
                    </div>
                  )}

                  {/* Action Bar according to repair status flow */}
                  <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100">
                    {/* Stage 1: Bat Picked Up -> Need Inspection */}
                    {req.status === 'Bat Picked Up' && (
                      <Button
                        onClick={() => {
                          setInspectModalReqId(req.id);
                        }}
                        variant="primary"
                        size="sm"
                        leftIcon={<Wrench className="w-4 h-4" />}
                      >
                        Perform Inspection & Create Estimate
                      </Button>
                    )}

                    {/* Stage 2: Awaiting Customer Approval (LOCKED) */}
                    {req.status === 'Awaiting Customer Approval' && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                          Waiting for player approval in customer portal...
                        </span>
                        <Button
                          onClick={() => {
                            approveRepairEstimate(req.id);
                            addToast(
                              'success',
                              'Approval Simulated',
                              `Customer authorization recorded for ${req.id}. Repair can now proceed.`
                            );
                          }}
                          variant="ghost"
                          size="sm"
                          className="text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                        >
                          Simulate Customer Approval
                        </Button>
                      </div>
                    )}

                    {/* Stage 3: Customer Approved -> Can Start Repair */}
                    {req.status === 'Repair Approved' && (
                      <Button
                        onClick={() =>
                          updateRequestStatus(req.id, 'Repair in Progress', 'Sneha Patel (Technician)', 'Carbon bonding commenced')
                        }
                        variant="primary"
                        size="sm"
                      >
                        Start Repair (Authorized by Customer)
                      </Button>
                    )}

                    {/* Stage 4: Repair In Progress -> Can Complete or Request Price Revision (Figma Item 43) */}
                    {req.status === 'Repair in Progress' && (
                      <>
                        <Button
                          onClick={() => setRevisionModalReqId(req.id)}
                          variant="outline"
                          size="sm"
                          className="text-amber-800 border-amber-300 hover:bg-amber-50"
                          leftIcon={<AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                        >
                          Request Price Revision (Additional Damage Found)
                        </Button>
                        <Button
                          onClick={() => completeRepairJob(req.id, 'Carbon splice cured and tension tested')}
                          variant="success"
                          size="sm"
                          leftIcon={<CheckCircle2 className="w-4 h-4" />}
                        >
                          Mark Repair Completed
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBVIEW: DELIVERIES & PAYMENT COLLECTION (Figma Item 44 & 75) */}
      {employeeSubView === 'deliveries' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Workstation Technical Header */}
          <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-5 border border-slate-800 shadow-lg">
            <div className="absolute inset-0 z-0">
              <img
                src="/images/doorstep-delivery.jpg"
                alt="Doorstep Delivery"
                className="w-full h-full object-cover opacity-20"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-transparent" />
            </div>
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  CONCIERGE LOGISTICS • ZERO ADVANCE PAYMENT
                </span>
                <h3 className="text-xl font-black mt-1">Doorstep Drop-off & Payment Collection</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Protective racket carry case • Customer inspection on handoff • Instant Cash/UPI receipt
                </p>
              </div>
              <div className="bg-slate-800/80 border border-slate-700/80 px-4 py-2 rounded-2xl shrink-0 text-center sm:text-right">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Ready for Dispatch</p>
                <p className="text-2xl font-black text-emerald-400">{deliveryTasks.length} Bats</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-900">Delivery & Doorstep Collection</h3>
            <span className="text-xs text-slate-500 font-semibold">{deliveryTasks.length} Pending</span>
          </div>

          {deliveryTasks.length === 0 ? (
            <EmptyState
              type="no_deliveries"
              title="No Pending Deliveries"
              description="All serviced bats have been safely handed over to customers."
            />
          ) : (
            <div className="space-y-4">
              {deliveryTasks.map((req) => (
                <div
                  key={req.id}
                  className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-md">
                        {req.id}
                      </span>
                      <h4 className="text-base font-bold text-slate-900">
                        {req.batBrand} {req.batModel}
                      </h4>
                    </div>
                    <StatusBadge status={req.status} size="sm" />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div className="relative w-full sm:w-32 h-24 rounded-xl overflow-hidden shrink-0 border border-slate-200 shadow-2xs">
                      <img
                        src="/images/doorstep-delivery.jpg"
                        alt="Doorstep Delivery"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 right-1 bg-slate-900/80 backdrop-blur-xs text-[9px] font-bold text-center text-emerald-300 py-0.5 rounded">
                        Drop-off Ready
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs flex-1 w-full">
                      <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                        <p className="font-bold text-slate-700">Customer Doorstep:</p>
                        <p className="text-slate-900 font-bold">{req.customerName} ({req.customerMobile})</p>
                        <p className="text-slate-600">{req.pickupAddress.houseFlat}, {req.pickupAddress.street}</p>
                        <p className="text-slate-500">{req.pickupAddress.area} ({req.distanceKm} KM)</p>
                      </div>

                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                        <p className="font-bold text-emerald-900">Amount to Collect on Delivery:</p>
                        <p className="text-2xl font-black text-emerald-700">₹{req.totalAmount}</p>
                        <p className="text-[11px] text-emerald-800">
                          Includes: Service (₹{req.serviceCharge}) + Delivery ({req.isFreeDelivery ? 'Free' : `₹${req.pickupDeliveryCharge}`})
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100">
                    <a
                      href={`tel:${req.customerMobile}`}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5 text-blue-600" /> Call Ahead
                    </a>
                    {req.status !== 'Out for Delivery' ? (
                      <Button
                        onClick={() => startDelivery(req.id)}
                        variant="primary"
                        size="sm"
                        leftIcon={<Truck className="w-4 h-4" />}
                      >
                        Start Delivery Run
                      </Button>
                    ) : (
                      <Button
                        onClick={() => {
                          setDeliveryModalReqId(req.id);
                          setPaymentAmount(req.totalAmount);
                        }}
                        variant="success"
                        size="sm"
                        className="font-bold shadow-md"
                        leftIcon={<DollarSign className="w-4 h-4" />}
                      >
                        Confirm Delivery & Collect Payment (₹{req.totalAmount})
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBVIEW: PAYMENTS COLLECTED LOG */}
      {employeeSubView === 'payments' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-black text-slate-900">Reconciled Doorstep Payments</h3>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              Total Today: ₹{totalCollectedToday}
            </span>
          </div>

          {paymentsCollected.length === 0 ? (
            <EmptyState
              type="no_payments"
              title="No Payments Recorded Yet"
              description="Doorstep collections will appear here after marking deliveries completed."
            />
          ) : (
            <div className="space-y-3">
              {paymentsCollected.map((req) => (
                <div
                  key={req.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md">
                          {req.id}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">{req.customerName}</h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Method: <b>{req.paymentRecord?.method}</b> • Collected By: {req.paymentRecord?.collectedBy}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-base font-black text-emerald-700">₹{req.paymentRecord?.amount}</p>
                    <span className="text-[10px] text-slate-400">
                      {req.paymentRecord?.transactionNotes || 'Reconciled'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: BAT CONDITION AT PICKUP (Figma Item 38) */}
      {pickupModalReqId && (
        <div
          onClick={() => setPickupModalReqId(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[calc(100vh-2rem)] animate-in zoom-in-95"
          >
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-base">Record Bat Condition at Pickup</h3>
                <p className="text-xs text-slate-400">Request #{pickupModalReqId}</p>
              </div>
              <button
                onClick={() => setPickupModalReqId(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Visual Condition at Doorstep *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Good', 'Minor Damage', 'Damaged', 'Broken', 'Other'] as BatConditionAtPickup[]).map(
                    (cond) => (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => setCondition(cond)}
                        className={`p-2 rounded-xl text-xs font-semibold border text-center transition-all ${
                          condition === cond
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {cond}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Condition Notes (Existing Cracks, Scratches)
                </label>
                <textarea
                  rows={2}
                  value={conditionNotes}
                  onChange={(e) => setConditionNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Checkbox verification */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="collectedCheck"
                  checked={isCollectedChecked}
                  onChange={(e) => setIsCollectedChecked(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <label htmlFor="collectedCheck" className="text-xs text-emerald-950 font-semibold cursor-pointer">
                  I have physically collected the customer's bat and handed over the digital receipt.
                </label>
              </div>

              <Button
                onClick={() => {
                  recordPickupCondition(pickupModalReqId, condition, conditionNotes, []);
                  setPickupModalReqId(null);
                }}
                disabled={!isCollectedChecked}
                variant="primary"
                className="w-full"
                size="lg"
              >
                Confirm Pickup & Send to Workshop
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: INSPECTION & ESTIMATE CREATION (Figma Item 40) */}
      {inspectModalReqId && (
        <div
          onClick={() => setInspectModalReqId(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[calc(100vh-2rem)] animate-in zoom-in-95"
          >
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-base">Workshop Technical Inspection</h3>
                <p className="text-xs text-slate-400">Generate Estimate for #{inspectModalReqId}</p>
              </div>
              <button
                onClick={() => setInspectModalReqId(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Technical Damage & Scope of Work
                </label>
                <textarea
                  rows={2}
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Labour Charge (₹)</label>
                  <input
                    type="number"
                    value={labourCharge}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setLabourCharge(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Materials / Parts (₹)</label>
                  <input
                    type="number"
                    value={materialsCharge}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setMaterialsCharge(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Additional Charges (₹)</label>
                  <input
                    type="number"
                    value={additionalCharges}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setAdditionalCharges(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Courtesy Discount (₹)</label>
                  <input
                    type="number"
                    value={discount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setDiscount(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold outline-none"
                  />
                </div>
              </div>

              {(() => {
                const numLabour = typeof labourCharge === 'number' ? labourCharge : parseInt(labourCharge, 10) || 0;
                const numMaterials = typeof materialsCharge === 'number' ? materialsCharge : parseInt(materialsCharge, 10) || 0;
                const numAdditional = typeof additionalCharges === 'number' ? additionalCharges : parseInt(additionalCharges, 10) || 0;
                const numDiscount = typeof discount === 'number' ? discount : parseInt(discount, 10) || 0;
                const totalQuote = Math.max(0, numLabour + numMaterials + numAdditional - numDiscount);

                return (
                  <>
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 flex justify-between items-center text-xs">
                      <span className="font-bold text-blue-900">Total Repair Quote:</span>
                      <span className="text-xl font-extrabold text-blue-800">
                        ₹{totalQuote}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Notice: Submitting will place request into <b>Awaiting Customer Approval</b>. The employee cannot begin repairs until the player approves.
                    </p>

                    <Button
                      onClick={() => {
                        const est: RepairEstimate = {
                          labourCharge: numLabour,
                          materialsCharge: numMaterials,
                          additionalCharges: numAdditional,
                          pickupDeliveryCharge: 0,
                          discount: numDiscount,
                          totalEstimate: totalQuote,
                          expectedCompletionDate: expectedDate,
                          inspectionNotes,
                        };
                        createRepairEstimate(inspectModalReqId, est);
                        setInspectModalReqId(null);
                      }}
                      variant="primary"
                      className="w-full"
                      size="lg"
                    >
                      Create Repair Estimate & Await Approval
                    </Button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REQUEST PRICE REVISION (Figma Item 43 & 7) */}
      {revisionModalReqId && (
        <div
          onClick={() => setRevisionModalReqId(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-amber-300 my-auto flex flex-col max-h-[calc(100vh-2rem)] animate-in zoom-in-95"
          >
            <div className="bg-amber-600 text-white p-5 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-base">Request Price Revision</h3>
                <p className="text-xs text-amber-100">Additional damage found during repair</p>
              </div>
              <button
                onClick={() => setRevisionModalReqId(null)}
                className="text-amber-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Additional Repair Charges (₹)
                </label>
                <input
                  type="number"
                  value={revisionAdditional}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setRevisionAdditional(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Revision (Shown to Customer)
                </label>
                <textarea
                  rows={2}
                  value={revisionReason}
                  onChange={(e) => setRevisionReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                />
              </div>

              {(() => {
                const numRevision = typeof revisionAdditional === 'number' ? revisionAdditional : parseInt(revisionAdditional, 10) || 0;
                return (
                  <>
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                      <div className="flex justify-between">
                        <span>Original Quote:</span>
                        <span className="font-semibold">₹400</span>
                      </div>
                      <div className="flex justify-between font-bold text-amber-800">
                        <span>Additional Damage:</span>
                        <span>+₹{numRevision}</span>
                      </div>
                      <div className="pt-1 border-t border-amber-200 flex justify-between font-black text-sm">
                        <span>New Total Quote:</span>
                        <span>₹{400 + numRevision}</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-snug">
                      Repair will be <b>locked</b> until the player reviews and accepts ₹{400 + numRevision}.
                    </p>

                    <Button
                      onClick={() => {
                        requestPriceRevision(
                          revisionModalReqId,
                          numRevision,
                          400 + numRevision,
                          revisionReason
                        );
                        setRevisionModalReqId(null);
                      }}
                      variant="secondary"
                      className="w-full bg-amber-600 hover:bg-amber-700"
                      size="lg"
                    >
                      Send Revised Estimate to Customer
                    </Button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: MANUAL PAYMENT RECORDING & DELIVERY CONFIRMATION (Figma Item 44 & 75) */}
      {deliveryModalReqId && (
        <div
          onClick={() => setDeliveryModalReqId(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[calc(100vh-2rem)] animate-in zoom-in-95"
          >
            <div className="bg-emerald-700 text-white p-5 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-base">Doorstep Delivery & Manual Payment</h3>
                <p className="text-xs text-emerald-100">Request #{deliveryModalReqId}</p>
              </div>
              <button
                onClick={() => setDeliveryModalReqId(null)}
                className="text-emerald-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Amount Collected from Customer (₹) *
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)}
                  className="w-full p-3 rounded-xl border border-slate-300 text-lg font-mono font-bold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Payment Method Received *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Cash', 'UPI', 'Other'] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${
                        paymentMethod === m
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Transaction Notes / Reference (Optional)
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. UPI Ref / Google Pay / Cash in hand"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Confirming will transition status to <b>Delivered</b>, <b>Payment Collected</b>, and <b>Completed</b>.
                </span>
              </div>

              {(() => {
                const numPayment = typeof paymentAmount === 'number' ? paymentAmount : parseInt(paymentAmount, 10) || 0;
                return (
                  <Button
                    onClick={() => {
                      recordManualPayment(deliveryModalReqId, numPayment, paymentMethod, paymentNotes);
                      setDeliveryModalReqId(null);
                    }}
                    variant="success"
                    className="w-full"
                    size="lg"
                  >
                    Confirm Delivery & Record ₹{numPayment}
                  </Button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
