import React from 'react';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/Badge';
import { Button } from '../common/Button';
import {
  Wrench,
  Clock,
  CheckCircle2,
  DollarSign,
  PlusCircle,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export const CustomerDashboard: React.FC = () => {
  const {
    userName,
    requests,
    setCustomerSubView,
    setSelectedRequestId,
    openRequestDetail,
    openWizardWithService,
    distanceConfig,
  } = useApp();

  // Metrics calculation
  const activeRequests = requests.filter(
    (r) => r.status !== 'Completed' && r.status !== 'Cancelled' && r.status !== 'Completed Without Repair'
  );
  const gettingRequests = requests.filter((r) => r.serviceType === 'GETTING');
  const repairRequests = requests.filter((r) => r.serviceType === 'REPAIR');
  const completedRequests = requests.filter((r) => r.status === 'Completed');
  const paymentPendingRequests = requests.filter((r) => r.paymentStatus === 'Pending');

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Welcome & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-400/30 mb-2">
            <Sparkles className="w-3.5 h-3.5" /> BADMINTON SERVICE SUITE
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Welcome, {userName || 'Badminton Player'}
          </h1>
          <p className="text-sm text-blue-200 mt-1 max-w-xl">
            Book professional bat getting or graphite composite structural repair with free doorstep pickup within {distanceConfig.freeRadiusKm} KM.
          </p>
        </div>

        {/* Quick Action CTAs */}
        <div className="flex flex-wrap sm:flex-col gap-3 relative z-10 shrink-0">
          <Button
            onClick={() => openWizardWithService('GETTING')}
            variant="secondary"
            size="md"
            className="font-bold shadow-md bg-emerald-500 hover:bg-emerald-600 text-white border-0"
            leftIcon={<Wrench className="w-4 h-4" />}
          >
            Book Bat Getting
          </Button>
          <Button
            onClick={() => openWizardWithService('REPAIR')}
            variant="glass"
            size="md"
            className="font-bold border-white/20"
            leftIcon={<Wrench className="w-4 h-4" />}
          >
            Request Bat Repair
          </Button>
        </div>

        {/* Background glow circle */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl" />
      </div>

      {/* 5 KPI Metric Cards (Figma Item 20) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div
          onClick={() => setCustomerSubView('requests')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Active Jobs</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{activeRequests.length}</p>
          <p className="text-[11px] text-slate-400 mt-1">In progress or pickup</p>
        </div>

        <div
          onClick={() => setCustomerSubView('requests')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs cursor-pointer hover:border-teal-400 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Bat Getting</span>
            <Wrench className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{gettingRequests.length}</p>
          <p className="text-[11px] text-slate-400 mt-1">Stringing requests</p>
        </div>

        <div
          onClick={() => setCustomerSubView('requests')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs cursor-pointer hover:border-amber-400 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Bat Repairs</span>
            <Wrench className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{repairRequests.length}</p>
          <p className="text-[11px] text-slate-400 mt-1">Inspection &amp; repairs</p>
        </div>

        <div
          onClick={() => setCustomerSubView('requests')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{completedRequests.length}</p>
          <p className="text-[11px] text-slate-400 mt-1">Delivered bats</p>
        </div>

        <div
          onClick={() => setCustomerSubView('requests')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs col-span-2 sm:col-span-1 cursor-pointer hover:border-yellow-400 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Pay On Delivery</span>
            <DollarSign className="w-4 h-4 text-yellow-600" />
          </div>
          <p className="text-2xl font-black text-amber-600">{paymentPendingRequests.length}</p>
          <p className="text-[11px] text-slate-400 mt-1">Doorstep collection</p>
        </div>
      </div>

      {/* Trust Reminder Strip (Figma Item 77) */}
      <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-900">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <span className="font-semibold">
            Zero Advance Risk: No online payment needed. Pay Cash/UPI directly to agent upon bat delivery.
          </span>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-md">
          {distanceConfig.freeRadiusKm} KM Free Radius Protected
        </span>
      </div>

      {/* Visual Service Launchpads (Prompt: Rich UI & service-tailored requests) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Launchpad 1: Bat Getting */}
        <div
          onClick={() => openWizardWithService('GETTING')}
          className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:border-blue-400 hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="relative h-44 sm:h-48 w-full overflow-hidden">
              <img
                src="/images/stringing-machine.jpg"
                alt="Electronic Stringing Machine"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
              <div className="absolute top-3 left-3 bg-blue-600/90 text-white text-[11px] font-black px-2.5 py-1 rounded-xl backdrop-blur-xs">
                SERVICE 1 • STRINGING
              </div>
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
                <span className="font-extrabold bg-slate-900/80 px-2.5 py-1 rounded-xl backdrop-blur-xs">
                  20–32 LBS Constant-Pull
                </span>
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-xl">
                  24–48h SLA
                </span>
              </div>
            </div>

            <div className="p-5 space-y-2">
              <h3 className="text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                Book Badminton Bat Getting
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Precision digital electronic tensioning with Yonex (BG65, BG80, Aerobite) and Li-Ning tournament multifilaments. Free grommet alignment.
              </p>
            </div>
          </div>

          <div className="px-5 pb-5 pt-2 flex items-center justify-between border-t border-slate-100">
            <span className="text-xs font-bold text-slate-700">From ₹250 to ₹950</span>
            <span className="text-xs font-bold text-blue-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Start Booking <ChevronRight className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* Launchpad 2: Bat Repair */}
        <div
          onClick={() => openWizardWithService('REPAIR')}
          className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:border-amber-400 hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="relative h-44 sm:h-48 w-full overflow-hidden">
              <img
                src="/images/racket-repair.jpg"
                alt="Carbon Composite Repair"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
              <div className="absolute top-3 left-3 bg-amber-600/90 text-white text-[11px] font-black px-2.5 py-1 rounded-xl backdrop-blur-xs">
                SERVICE 2 • REPAIR
              </div>
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
                <span className="font-extrabold bg-slate-900/80 px-2.5 py-1 rounded-xl backdrop-blur-xs">
                  Aerospace Carbon Splice
                </span>
                <span className="text-[11px] font-bold text-amber-400 bg-amber-950/80 px-2.5 py-1 rounded-xl">
                  7-Day Strict SLA
                </span>
              </div>
            </div>

            <div className="p-5 space-y-2">
              <h3 className="text-lg font-black text-slate-900 group-hover:text-amber-600 transition-colors">
                Request Bat Structural Repair
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Frame fractures and shaft cracks restored with vacuum resin composite bonding. Zero work done without your digital estimate approval.
              </p>
            </div>
          </div>

          <div className="px-5 pb-5 pt-2 flex items-center justify-between border-t border-slate-100">
            <span className="text-xs font-bold text-slate-700">Base Rates from ₹150</span>
            <span className="text-xs font-bold text-amber-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Request Repair <ChevronRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>

      {/* Recent Requests Section */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Recent Service Requests</h3>
            <p className="text-xs text-slate-500">Track real-time progress and inspection approvals</p>
          </div>
          <Button
            onClick={() => setCustomerSubView('requests')}
            variant="ghost"
            size="sm"
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            View All Requests
          </Button>
        </div>

        <div className="divide-y divide-slate-100">
          {requests.slice(0, 4).map((req) => (
            <div
              key={req.id}
              onClick={() => openRequestDetail(req.id)}
              className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 p-3 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-slate-200"
            >
              <div className="flex items-start sm:items-center gap-3.5">
                {/* Visual Thumbnail */}
                <div className="relative w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-slate-200 shadow-2xs">
                  <img
                    src={req.serviceType === 'GETTING' ? '/images/stringing-machine.jpg' : '/images/racket-repair.jpg'}
                    alt={req.batBrand}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-slate-900/20" />
                  <span className={`absolute bottom-0 inset-x-0 text-[8px] font-black uppercase text-center py-0.2 text-white ${
                    req.serviceType === 'GETTING' ? 'bg-blue-600' : 'bg-amber-600'
                  }`}>
                    {req.serviceType}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      {req.id}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">
                      {req.batBrand} {req.batModel}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {req.batType}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-700">
                      {req.serviceType === 'GETTING'
                        ? `${req.gettingType} • ${req.stringTensionLbs || 26} lbs (${req.stringType || 'Yonex BG65'})`
                        : `Repair: ${req.repairIssue}`}
                    </span>
                    <span>•</span>
                    <span>{req.pickupAddress.area} ({req.distanceKm} KM)</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 pl-17 sm:pl-0">
                <div className="text-right">
                  <StatusBadge status={req.status} size="sm" />
                  <p className="text-xs font-extrabold text-slate-900 mt-1">
                    {req.totalAmount > 0 ? `₹${req.totalAmount}` : 'Quote on Inspection'}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 hidden sm:block" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
