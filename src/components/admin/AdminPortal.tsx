import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/Badge';
import { Button } from '../common/Button';
import {
  ServiceRequest,
  RequestStatus,
  DistancePricingConfig,
  GettingServiceTier,
  RepairCategoryTier,
} from '../../types';
import { mockEmployees } from '../../data/mockData';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Wrench,
  Compass,
  DollarSign,
  Clock,
  BarChart3,
  Mail,
  Shield,
  Settings,
  Search,
  Filter,
  Download,
  Printer,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  PlusCircle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  MapPin,
  Calendar,
  Edit3,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';

export const AdminPortal: React.FC = () => {
  const {
    requests,
    adminSubView,
    setAdminSubView,
    distanceConfig,
    updateDistanceConfig,
    emailTemplates,
    updateEmailTemplate,
    assignEmployee,
    updateRequestStatus,
    openRequestDetail,
    gettingServices,
    repairCategories,
    updateGettingService,
    updateRepairCategory,
    addGettingService,
    addRepairCategory,
    resetPricingToDefaults,
    addToast,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

  // Detail Modal for Admin
  const [detailModalRequest, setDetailModalRequest] = useState<ServiceRequest | null>(null);

  // Assign Employee Modal
  const [assignModalReqId, setAssignModalReqId] = useState<string | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('EMP-01');

  // Distance Calculator Simulator
  const [calcDistInput, setCalcDistInput] = useState<number>(22.4);

  // Email Template Previewer Modal
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [tplSubject, setTplSubject] = useState('');
  const [tplBody, setTplBody] = useState('');

  // Getting Service Modal state
  const [editingGettingItem, setEditingGettingItem] = useState<GettingServiceTier | null>(null);
  const [getFormName, setGetFormName] = useState('');
  const [getFormPrice, setGetFormPrice] = useState<number | string>(0);
  const [getFormTurnaround, setGetFormTurnaround] = useState('');
  const [getFormDesc, setGetFormDesc] = useState('');
  const [getFormFeatures, setGetFormFeatures] = useState('');

  // Repair Category Modal state
  const [editingRepairItem, setEditingRepairItem] = useState<RepairCategoryTier | null>(null);
  const [repFormName, setRepFormName] = useState('');
  const [repFormBasePrice, setRepFormBasePrice] = useState<number | string>(0);
  const [repFormSlaDays, setRepFormSlaDays] = useState<number | string>(7);
  const [repFormTurnaround, setRepFormTurnaround] = useState('');
  const [repFormDesc, setRepFormDesc] = useState('');

  // Add Service Modals
  const [addGettingModalOpen, setAddGettingModalOpen] = useState(false);
  const [addRepairModalOpen, setAddRepairModalOpen] = useState(false);

  // Financial calculations
  const totalRevenue = requests.reduce((acc, r) => acc + (r.paymentStatus === 'Paid' ? r.totalAmount : 0), 0);
  const pendingCollection = requests.reduce((acc, r) => acc + (r.paymentStatus === 'Pending' ? r.totalAmount : 0), 0);
  const gettingCount = requests.filter((r) => r.serviceType === 'GETTING').length;
  const repairCount = requests.filter((r) => r.serviceType === 'REPAIR').length;

  // Filter requests table
  const filteredRequests = requests.filter((req) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = req.id.toLowerCase().includes(q);
      const matchCust = req.customerName.toLowerCase().includes(q);
      const matchBat = (req.batBrand + ' ' + req.batModel).toLowerCase().includes(q);
      if (!matchId && !matchCust && !matchBat) return false;
    }
    if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;
    if (serviceFilter !== 'ALL' && req.serviceType !== serviceFilter) return false;
    if (paymentFilter !== 'ALL' && req.paymentStatus !== paymentFilter) return false;
    return true;
  });

  // Repair SLA monitoring dataset (Figma Item 55)
  const repairSlaItems = requests
    .filter((r) => r.serviceType === 'REPAIR' && r.status !== 'Completed' && r.status !== 'Cancelled')
    .map((r) => {
      const pickup = r.pickupDate ? new Date(r.pickupDate) : new Date(r.createdAt);
      const now = new Date();
      const currentDay = Math.max(1, Math.ceil((now.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24)));
      const daysRemaining = Math.max(0, 7 - currentDay);
      let slaStatus: 'Normal' | 'Approaching Deadline' | 'Delayed' = 'Normal';
      if (currentDay >= 7) slaStatus = 'Delayed';
      else if (currentDay >= 5) slaStatus = 'Approaching Deadline';

      return {
        request: r,
        currentDay,
        daysRemaining,
        slaStatus,
      };
    });

  // CSV Export handler
  const handleExportCSV = () => {
    const headers = ['Request ID', 'Customer', 'Service', 'Brand', 'Status', 'Amount', 'Payment', 'Distance (KM)'];
    const rows = filteredRequests.map((r) => [
      r.id,
      r.customerName,
      r.serviceType,
      `${r.batBrand} ${r.batModel}`,
      r.status,
      r.totalAmount,
      r.paymentStatus,
      r.distanceKm,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `gr_sports_requests_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 border-t border-slate-200">
      {/* Desktop Enterprise Sidebar - Sticky & Fixed on scroll */}
      <aside className="w-full lg:w-64 bg-slate-900 text-slate-300 p-4 border-r border-slate-800 shrink-0 lg:sticky lg:top-16 lg:self-start select-none z-20 space-y-4">
        <div>
          <div className="px-3 py-2 mb-3 border-b border-slate-800">
            <h3 className="text-base font-bold text-white tracking-tight">GR Sports Hub</h3>
            <p className="text-[11px] text-slate-400">Admin Control Center</p>
          </div>

          <nav className="flex lg:flex-col overflow-x-auto lg:overflow-visible gap-1.5 lg:gap-0 lg:space-y-1 pb-1 lg:pb-0">
            {[
              { id: 'dashboard', label: 'Dashboard & KPI', icon: LayoutDashboard },
              { id: 'requests', label: 'Service Requests', icon: FileSpreadsheet, badge: requests.length },
              { id: 'sla_monitor', label: 'Repair SLA (7-Day)', icon: Clock, badge: repairSlaItems.length },
              { id: 'payments', label: 'Payments & Collections', icon: DollarSign },
              { id: 'distance', label: 'Distance & Free Radius', icon: Compass },
              { id: 'getting_config', label: 'Getting Pricing', icon: Wrench },
              { id: 'repair_config', label: 'Repair Categories', icon: Wrench },
              { id: 'reports', label: 'Reports & Export', icon: BarChart3 },
              { id: 'templates', label: 'Email Templates', icon: Mail },
              { id: 'settings', label: 'Shop Settings', icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = adminSubView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setAdminSubView(item.id)}
                  className={`flex items-center justify-between px-3 py-2 lg:py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 lg:w-full ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? 'bg-blue-800 text-white' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Fixed bottom footer in sidebar */}
        <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 px-2 hidden lg:block">
          <p className="font-semibold text-slate-400">Hub: Indiranagar Master</p>
          <p className="text-[10px] text-emerald-400 font-mono mt-0.5">● Free Radius: {distanceConfig.freeRadiusKm} KM</p>
        </div>
      </aside>

      {/* Main Administrative Work Area - Single Page Scroll */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
        {/* SUBVIEW: DASHBOARD (Figma Item 46) */}
        {adminSubView === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Operations & Financial Overview</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time status of badminton bat getting, composite repairs, and doorstep collections.
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleExportCSV} variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />}>
                  Export CSV
                </Button>
                <Button onClick={() => setAdminSubView('requests')} variant="primary" size="sm">
                  View All Requests
                </Button>
              </div>
            </div>

            {/* KPI Cards: Operational & Financial */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                <p className="text-xs font-semibold text-slate-500">Total Requests</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{requests.length}</p>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-2">
                  <span>Getting: <b>{gettingCount}</b></span>
                  <span>•</span>
                  <span>Repair: <b>{repairCount}</b></span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                <p className="text-xs font-semibold text-slate-500">Total Collected</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">₹{totalRevenue}</p>
                <p className="text-[11px] text-emerald-700 mt-2">Doorstep cash & UPI reconciled</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                <p className="text-xs font-semibold text-slate-500">Pending Collection</p>
                <p className="text-2xl font-black text-amber-600 mt-1">₹{pendingCollection}</p>
                <p className="text-[11px] text-slate-500 mt-2">Will collect on bat delivery</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                <p className="text-xs font-semibold text-slate-500">7-Day Repair SLA Alerts</p>
                <p className="text-2xl font-black text-rose-600 mt-1">
                  {repairSlaItems.filter((s) => s.slaStatus !== 'Normal').length}
                </p>
                <p className="text-[11px] text-slate-500 mt-2">Nearing or delayed</p>
              </div>
            </div>

            {/* Charts & Analytical Breakdown (Figma Item 46) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Getting vs Repair Split */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Service Breakdown (Getting vs Repair)</h3>
                <div className="space-y-3 pt-2">
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span>Bat Getting / Stringing</span>
                      <span className="text-blue-700">{gettingCount} ({Math.round((gettingCount / requests.length) * 100 || 0)}%)</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full"
                        style={{ width: `${(gettingCount / requests.length) * 100 || 50}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span>Bat Structural Repair</span>
                      <span className="text-amber-700">{repairCount} ({Math.round((repairCount / requests.length) * 100 || 0)}%)</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${(repairCount / requests.length) * 100 || 50}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600">
                  <p><b>Free Radius Utilization:</b> 84% of orders lie within the complimentary {distanceConfig.freeRadiusKm} KM boundary.</p>
                </div>
              </div>

              {/* Operations SLA Summary */}
              <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-900">Repair 7-Day SLA Live Monitor</h3>
                  <button
                    onClick={() => setAdminSubView('sla_monitor')}
                    className="text-xs text-blue-600 font-bold hover:underline"
                  >
                    Open SLA Dashboard
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {repairSlaItems.slice(0, 3).map((item) => (
                    <div key={item.request.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-blue-900">{item.request.id}</span>
                          <span className="text-xs font-bold text-slate-900">
                            {item.request.batBrand} {item.request.batModel}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Customer: {item.request.customerName} • Issue: {item.request.repairIssue}
                        </p>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.slaStatus === 'Delayed'
                              ? 'bg-rose-100 text-rose-800'
                              : item.slaStatus === 'Approaching Deadline'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          Day {item.currentDay} of 7 ({item.slaStatus})
                        </span>
                        <p className="text-[11px] text-slate-600 mt-0.5">{item.daysRemaining} days left</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Executive Workshop Hub & Service Station Telemetry */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Workshop Facilities & Fleet Telemetry</h3>
                  <p className="text-xs text-slate-500">Live operational status across equipment, composite lab, and logistics</p>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5 w-fit">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  All 3 Stations Fully Operational
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Station 1: Stringing Line */}
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:border-blue-400 transition-all flex flex-col group">
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src="/images/stringing-machine.jpg"
                      alt="Electronic Constant-Pull Station"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/30 to-transparent" />
                    <div className="absolute top-3 left-3">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-blue-600/90 text-white px-2.5 py-1 rounded-full shadow-xs">
                        STATION 01 • GETTING
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h4 className="font-extrabold text-sm text-white">Electronic Constant-Pull</h4>
                      <p className="text-[11px] text-slate-300">Yonex / Li-Ning Certified Calibrator</p>
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-500 block">Queue Volume</span>
                        <span className="font-bold text-slate-900">{gettingCount} Bat Orders</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-500 block">Tension Range</span>
                        <span className="font-bold text-blue-700">18 – 35 LBS</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2">
                      Precision load-cell motor eliminating tension drop; dual-action swivel clamps.
                    </p>
                    <button
                      onClick={() => setAdminSubView('getting_config')}
                      className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                    >
                      Configure Stringing Rates <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Station 2: Carbon Composite Repair Lab */}
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:border-amber-400 transition-all flex flex-col group">
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src="/images/racket-repair.jpg"
                      alt="Carbon Composite Repair Lab"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/30 to-transparent" />
                    <div className="absolute top-3 left-3">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-amber-600/90 text-white px-2.5 py-1 rounded-full shadow-xs">
                        LAB 02 • COMPOSITE REPAIR
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h4 className="font-extrabold text-sm text-white">Carbon Splice & Resin Bonding</h4>
                      <p className="text-[11px] text-slate-300">Toray T800 Aerospace Matrix</p>
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-500 block">Active Restorations</span>
                        <span className="font-bold text-slate-900">{repairCount} Rackets</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-500 block">SLA Commitment</span>
                        <span className="font-bold text-amber-700">Strict 7 Days</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2">
                      High-strength carbon sleeving infused with aviation epoxy; stress-tested to tournament tension.
                    </p>
                    <button
                      onClick={() => setAdminSubView('sla_monitor')}
                      className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                    >
                      Launch 7-Day SLA Monitor <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Station 3: Concierge Logistics & Doorstep Fleets */}
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:border-emerald-400 transition-all flex flex-col group">
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src="/images/doorstep-delivery.jpg"
                      alt="Doorstep Logistics Concierge"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/30 to-transparent" />
                    <div className="absolute top-3 left-3">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-600/90 text-white px-2.5 py-1 rounded-full shadow-xs">
                        FLEET 03 • LOGISTICS
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h4 className="font-extrabold text-sm text-white">Doorstep White-Glove Fleet</h4>
                      <p className="text-[11px] text-slate-300">Free 15 KM Delivery Zone</p>
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-500 block">Complimentary</span>
                        <span className="font-bold text-emerald-700">{distanceConfig.freeRadiusKm} KM Radius</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-500 block">Beyond Radius</span>
                        <span className="font-bold text-slate-900">₹{distanceConfig.perKmRateBeyondFree}/KM</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2">
                      Zero advance payment policy; digital verification and doorstep collection via Cash or UPI.
                    </p>
                    <button
                      onClick={() => setAdminSubView('distance')}
                      className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                    >
                      Update Delivery Zones <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBVIEW: SERVICE REQUESTS TABLE (Figma Item 47 & 48) */}
        {adminSubView === 'requests' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">All Service Requests</h2>
                <p className="text-xs text-slate-500">Filter, inspect, assign employees, and update stages.</p>
              </div>
              <Button onClick={handleExportCSV} variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />}>
                Export CSV
              </Button>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap gap-3 items-center justify-between">
              <div className="relative min-w-[200px] flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search ID, customer, racket..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold outline-none"
                >
                  <option value="ALL">All Services</option>
                  <option value="GETTING">Bat Getting</option>
                  <option value="REPAIR">Bat Repair</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Employee Assigned">Employee Assigned</option>
                  <option value="Bat Picked Up">Bat Picked Up</option>
                  <option value="Awaiting Customer Approval">Awaiting Approval</option>
                  <option value="Repair Approved">Repair Approved</option>
                  <option value="Completed">Completed</option>
                </select>

                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold outline-none"
                >
                  <option value="ALL">All Payments</option>
                  <option value="Paid">Paid</option>
                  <option value="Pending">Payment Pending</option>
                </select>
              </div>
            </div>

            {/* Requests Data Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3.5 px-4">Request ID</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Service & Bat</th>
                      <th className="py-3.5 px-4">Assigned Staff</th>
                      <th className="py-3.5 px-4">Distance</th>
                      <th className="py-3.5 px-4">Amount</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-900">
                          {req.id}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">{req.customerName}</p>
                          <p className="text-[11px] text-slate-500">{req.customerMobile}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`font-semibold ${
                              req.serviceType === 'GETTING' ? 'text-blue-700' : 'text-amber-700'
                            }`}
                          >
                            {req.serviceType === 'GETTING' ? 'Getting' : 'Repair'}
                          </span>
                          <p className="text-slate-600">{req.batBrand} {req.batModel}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          {req.assignedEmployeeName ? (
                            <span className="font-medium text-slate-800">{req.assignedEmployeeName}</span>
                          ) : (
                            <button
                              onClick={() => {
                                setAssignModalReqId(req.id);
                              }}
                              className="text-blue-600 font-bold hover:underline"
                            >
                              + Assign Staff
                            </button>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={req.isFreeDelivery ? 'text-emerald-700 font-semibold' : 'text-slate-700'}>
                            {req.distanceKm} KM ({req.isFreeDelivery ? 'Free' : `+₹${req.pickupDeliveryCharge}`})
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {req.totalAmount > 0 ? `₹${req.totalAmount}` : 'Quote on Inspect'}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={req.status} size="sm" />
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setDetailModalRequest(req)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {req.status === 'Submitted' && (
                              <button
                                onClick={() =>
                                  updateRequestStatus(req.id, 'Accepted', 'Admin', 'Accepted for logistics')
                                }
                                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-bold hover:bg-emerald-100 transition-colors"
                              >
                                Accept
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SUBVIEW: REPAIR SLA 7-DAY MONITOR (Figma Item 55 & 76) */}
        {adminSubView === 'sla_monitor' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Visual SLA Guarantee Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-6 border border-slate-800 shadow-xl">
              <div className="absolute inset-0 z-0">
                <img
                  src="/images/racket-repair.jpg"
                  alt="Carbon Composite Repair Lab"
                  className="w-full h-full object-cover opacity-25"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-transparent" />
              </div>
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                    SLA ENGINE • 7-DAY STRUCTURAL COMMITMENT
                  </span>
                  <h2 className="text-2xl font-black mt-1">Repair SLA 7-Day Monitoring Control</h2>
                  <p className="text-xs text-slate-300 mt-0.5 max-w-xl">
                    Every composite carbon splice is guaranteed within 7 calendar days from doorstep pickup intake. Live telemetry tracks curing progress and delivery dispatch.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="bg-slate-800/80 border border-slate-700/80 px-4 py-2.5 rounded-2xl text-center">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Active Restorations</p>
                    <p className="text-2xl font-black text-amber-400">{repairSlaItems.length}</p>
                  </div>
                  <div className="bg-emerald-950/60 border border-emerald-800/80 px-4 py-2.5 rounded-2xl text-center">
                    <p className="text-[10px] text-emerald-400 uppercase font-semibold">On-Time SLA Rate</p>
                    <p className="text-2xl font-black text-emerald-400">98.4%</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Request ID</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Pickup Date</th>
                    <th className="py-3.5 px-4">Target Date</th>
                    <th className="py-3.5 px-4">Current Turnaround</th>
                    <th className="py-3.5 px-4">Days Remaining</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">SLA Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {repairSlaItems.map((item) => (
                    <tr key={item.request.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-900">
                        {item.request.id}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {item.request.customerName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {item.request.pickupDate
                          ? new Date(item.request.pickupDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                          : 'Pending Pickup'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {item.request.targetDate
                          ? new Date(item.request.targetDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                          : 'Within 7 Days'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        Day {item.currentDay} of 7
                      </td>
                      <td className="py-3.5 px-4 font-bold">
                        <span className={item.daysRemaining <= 1 ? 'text-rose-600 font-black' : 'text-slate-700'}>
                          {item.daysRemaining} Days
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={item.request.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                            item.slaStatus === 'Delayed'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : item.slaStatus === 'Approaching Deadline'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}
                        >
                          {item.slaStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SHARED PRICING SUB-NAVIGATION BAR FOR DISTANCE, GETTING, & REPAIR */}
        {(adminSubView === 'distance' || adminSubView === 'getting_config' || adminSubView === 'repair_config') && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs mb-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAdminSubView('distance')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  adminSubView === 'distance'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                Distance & Free Radius ({distanceConfig.freeRadiusKm} KM)
              </button>
              <button
                type="button"
                onClick={() => setAdminSubView('getting_config')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  adminSubView === 'getting_config'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                Bat Getting Packages ({gettingServices.length})
              </button>
              <button
                type="button"
                onClick={() => setAdminSubView('repair_config')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  adminSubView === 'repair_config'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Wrench className="w-3.5 h-3.5 text-amber-500" />
                Repair Base Charges & SLA ({repairCategories.length})
              </button>
            </div>

            <Button
              onClick={resetPricingToDefaults}
              variant="outline"
              size="sm"
              className="text-xs text-rose-700 hover:bg-rose-50 border-rose-200"
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Reset Pricing to Defaults
            </Button>
          </div>
        )}

        {/* SUBVIEW: DISTANCE CHARGES & FREE RADIUS RULES (Figma Item 52) */}
        {adminSubView === 'distance' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  Free Radius & Distance Pricing Configuration
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Currently active free delivery threshold: <b>{distanceConfig.freeRadiusKm} KM</b>. Pickups beyond {distanceConfig.freeRadiusKm} KM are charged at ₹{distanceConfig.perKmRateBeyondFree}/KM.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                  {distanceConfig.freeRadiusKm} KM Free Zone Active
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Configuration Form */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Compass className="w-4 h-4 text-blue-600" />
                  Workshop Origin & Free Radius Control
                </h3>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Central Workshop Hub</label>
                  <input
                    type="text"
                    value={distanceConfig.shopLocationName}
                    onChange={(e) =>
                      updateDistanceConfig({ ...distanceConfig, shopLocationName: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={distanceConfig.shopLat}
                      onChange={(e) =>
                        updateDistanceConfig({ ...distanceConfig, shopLat: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={distanceConfig.shopLng}
                      onChange={(e) =>
                        updateDistanceConfig({ ...distanceConfig, shopLng: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                    />
                  </div>
                </div>

                {/* Free Delivery Radius Control */}
                <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <label className="block text-xs font-black text-emerald-950 uppercase tracking-wide">
                        Free Pickup & Delivery Radius
                      </label>
                      <p className="text-[11px] text-emerald-800">
                        Orders within this radius have ₹0 delivery fee. Set to 13 KM or any custom value.
                      </p>
                    </div>
                    <span className="text-xl font-black text-emerald-700 font-mono">
                      {distanceConfig.freeRadiusKm} KM
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={40}
                      step={0.5}
                      value={distanceConfig.freeRadiusKm}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') return;
                        const parsed = parseFloat(val);
                        if (!isNaN(parsed)) {
                          updateDistanceConfig({
                            ...distanceConfig,
                            freeRadiusKm: Math.max(0, parsed),
                          });
                        }
                      }}
                      className="w-28 p-2.5 rounded-xl border border-emerald-300 bg-white text-base font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {[10, 12, 13, 15, 20].map((km) => (
                        <button
                          key={km}
                          type="button"
                          onClick={() => updateDistanceConfig({ ...distanceConfig, freeRadiusKm: km })}
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                            distanceConfig.freeRadiusKm === km
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-100 hover:text-emerald-900'
                          }`}
                        >
                          {km} KM {km === 13 && '(Requested)'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Rate beyond {distanceConfig.freeRadiusKm} KM (₹/KM)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={distanceConfig.perKmRateBeyondFree}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') return;
                        const parsed = parseFloat(val);
                        if (!isNaN(parsed)) {
                          updateDistanceConfig({
                            ...distanceConfig,
                            perKmRateBeyondFree: Math.max(0, parsed),
                          });
                        }
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Max Serviceable Radius (KM)
                    </label>
                    <input
                      type="number"
                      value={distanceConfig.maxServiceDistanceKm || 35}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') return;
                        const parsed = parseFloat(val);
                        if (!isNaN(parsed)) {
                          updateDistanceConfig({
                            ...distanceConfig,
                            maxServiceDistanceKm: parsed,
                          });
                        }
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Calculation Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => updateDistanceConfig({ ...distanceConfig, pricingMethod: 'PER_KM' })}
                      className={`p-2.5 rounded-xl text-xs font-bold border ${
                        distanceConfig.pricingMethod === 'PER_KM'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Linear Per KM
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDistanceConfig({ ...distanceConfig, pricingMethod: 'SLAB' })}
                      className={`p-2.5 rounded-xl text-xs font-bold border ${
                        distanceConfig.pricingMethod === 'SLAB'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Distance Slabs
                    </button>
                  </div>
                </div>

                {/* Slabs breakdown if SLAB mode */}
                {distanceConfig.pricingMethod === 'SLAB' && (
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <span className="text-xs font-bold text-slate-700">Configured Slabs for {distanceConfig.freeRadiusKm} KM Threshold</span>
                    <div className="space-y-1.5">
                      {distanceConfig.slabs.map((slab, sIdx) => (
                        <div key={sIdx} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                          <span className="font-semibold text-slate-700">
                            {slab.minKm} – {slab.maxKm} KM
                          </span>
                          <span className="font-bold text-blue-700">
                            {slab.price === 0 ? '₹0 (Free Zone)' : `₹${slab.price}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Live Distance Calculator (Figma Item 52) */}
              <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-lg space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
                      Live Distance Charge Tester
                    </h3>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md font-mono">
                      Hub: {distanceConfig.shopLocationName.split(',')[0]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Simulate customer distances to verify real-time price calculations with the active <b>{distanceConfig.freeRadiusKm} KM</b> free boundary.
                  </p>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Simulate Customer Distance:</span>
                      <span className="font-bold text-white text-sm">{calcDistInput} KM</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="35"
                      step="0.5"
                      value={calcDistInput}
                      onChange={(e) => setCalcDistInput(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>0 KM</span>
                      <span className="text-emerald-400 font-bold">{distanceConfig.freeRadiusKm} KM (Free Cutoff)</span>
                      <span>35 KM</span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs space-y-2.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Simulated Distance:</span>
                      <span className="font-bold text-white">{calcDistInput} KM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Free Pickup Radius:</span>
                      <span className="font-bold text-emerald-400">{distanceConfig.freeRadiusKm} KM (₹0)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Chargeable Distance:</span>
                      <span className="font-bold text-amber-400">
                        {calcDistInput <= distanceConfig.freeRadiusKm
                          ? '0 KM (Within Free Zone)'
                          : `${+(calcDistInput - distanceConfig.freeRadiusKm).toFixed(1)} KM beyond free zone`}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex justify-between text-base font-extrabold">
                      <span>Customer Delivery Fee:</span>
                      <span className="text-emerald-400 font-mono text-lg">
                        {calcDistInput <= distanceConfig.freeRadiusKm
                          ? '₹0 (100% FREE)'
                          : `₹${Math.round(
                              (calcDistInput - distanceConfig.freeRadiusKm) * distanceConfig.perKmRateBeyondFree
                            )}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Rule Active: Within <b>{distanceConfig.freeRadiusKm} KM</b> doorstep pickup & delivery is strictly free for all customers.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBVIEW: GETTING PRICING MANAGEMENT */}
        {adminSubView === 'getting_config' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Stringing Line Tech Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-5 border border-slate-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <img src="/images/stringing-machine.jpg" alt="Stringing Machine" className="w-16 h-16 rounded-2xl object-cover border border-blue-400/40 shrink-0 shadow-sm" />
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-400/30">
                    CALIBRATED CONSTANT-PULL
                  </span>
                  <h3 className="text-base font-bold text-white mt-1">Multi-filament & Tension Matrix Rates</h3>
                  <p className="text-xs text-slate-300">Yonex BG65, BG80, Aerobite, Nanogy, and Li-Ning tournament string packages</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs text-slate-400">Published Packages</span>
                <p className="text-xl font-black text-blue-400">{gettingServices.length} Active Tiers</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Bat Getting (Stringing) Service Configuration</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update customer package prices, turnaround SLAs, and inclusions. Changes sync live across booking wizards.
                </p>
              </div>
              <Button
                onClick={() => {
                  setGetFormName('');
                  setGetFormPrice('');
                  setGetFormTurnaround('');
                  setGetFormDesc('');
                  setGetFormFeatures('');
                  setAddGettingModalOpen(true);
                }}
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Add Getting Package
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gettingServices.map((item) => (
                <div key={item.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-base text-slate-900">{item.name}</h3>
                        <span className="text-[11px] text-slate-500 font-medium">Turnaround: <b>{item.turnaround}</b></span>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black text-blue-700">₹{item.price}</span>
                        <span className="block text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded mt-0.5">
                          Active Tier
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                    <div className="p-2.5 bg-slate-50 rounded-xl text-xs space-y-1">
                      {item.features.map((f, i) => (
                        <p key={i} className="text-slate-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> {f}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-end">
                    <Button
                      onClick={() => {
                        setEditingGettingItem(item);
                        setGetFormName(item.name);
                        setGetFormPrice(item.price);
                        setGetFormTurnaround(item.turnaround);
                        setGetFormDesc(item.description);
                        setGetFormFeatures(item.features.join(', '));
                      }}
                      variant="outline"
                      size="sm"
                      className="text-xs font-bold"
                      leftIcon={<Edit3 className="w-3.5 h-3.5 text-blue-600" />}
                    >
                      Edit Price & Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBVIEW: REPAIR CATEGORIES & BASE PRICING */}
        {adminSubView === 'repair_config' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Repair Line Tech Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-5 border border-slate-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <img src="/images/racket-repair.jpg" alt="Carbon Repair Lab" className="w-16 h-16 rounded-2xl object-cover border border-amber-400/40 shrink-0 shadow-sm" />
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                    CARBON FIBER RESTORATION
                  </span>
                  <h3 className="text-base font-bold text-white mt-1">Aerospace Carbon Splice Baseline Rules</h3>
                  <p className="text-xs text-slate-300">Toray high-modulus carbon fabric + resin infusion with strict 7-Day SLA turnaround</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs text-slate-400">Repair Categories</span>
                <p className="text-xl font-black text-amber-400">{repairCategories.length} Types</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Repair Categories & Base Pricing</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Default baseline charges and 7-Day SLA targets. Final repair estimates remain inspection-based.
                </p>
              </div>
              <Button
                onClick={() => {
                  setRepFormName('');
                  setRepFormBasePrice('');
                  setRepFormSlaDays(7);
                  setRepFormTurnaround('');
                  setRepFormDesc('');
                  setAddRepairModalOpen(true);
                }}
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Add Repair Category
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {repairCategories.map((cat) => (
                <div key={cat.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-base text-slate-900">{cat.name}</h3>
                        <span className="text-[11px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block mt-0.5">
                          SLA Guarantee: {cat.slaDays} Days Max
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black text-slate-900">₹{cat.basePrice}</span>
                        <span className="block text-[10px] text-slate-500 font-semibold">Starting Base</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{cat.description}</p>
                    <div className="text-[11px] text-slate-500">
                      Typical Turnaround: <b>{cat.turnaround}</b>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-end">
                    <Button
                      onClick={() => {
                        setEditingRepairItem(cat);
                        setRepFormName(cat.name);
                        setRepFormBasePrice(cat.basePrice);
                        setRepFormSlaDays(cat.slaDays);
                        setRepFormTurnaround(cat.turnaround);
                        setRepFormDesc(cat.description);
                      }}
                      variant="outline"
                      size="sm"
                      className="text-xs font-bold"
                      leftIcon={<Edit3 className="w-3.5 h-3.5 text-blue-600" />}
                    >
                      Edit Base Price & SLA
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBVIEW: EMAIL TEMPLATES (Figma Item 57) */}
        {adminSubView === 'templates' && (
          <div className="space-y-6 animate-in fade-in">
            <div>
              <h2 className="text-2xl font-black text-slate-900">Email Notification Templates</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure transactional email copy, placeholders, and customer notifications.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {emailTemplates.map((tpl) => (
                <div key={tpl.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-sm text-slate-900">{tpl.name}</h3>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {tpl.id}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700">Subject: {tpl.subject}</p>
                  <pre className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-sans whitespace-pre-wrap line-clamp-3">
                    {tpl.body}
                  </pre>
                  <div className="flex flex-wrap gap-1">
                    {tpl.variables.map((v) => (
                      <span key={v} className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                        {`{${v}}`}
                      </span>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <Button
                      onClick={() => {
                        setEditingTemplateId(tpl.id);
                        setTplSubject(tpl.subject);
                        setTplBody(tpl.body);
                      }}
                      size="sm"
                      variant="outline"
                    >
                      Preview & Edit Template
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBVIEW: PAYMENTS MANAGEMENT (Figma Item 53) */}
        {adminSubView === 'payments' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Doorstep Payment Reconciliation</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manual cash & UPI recordings collected upon bat doorstep delivery.
                </p>
              </div>
              <Button onClick={handleExportCSV} variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />}>
                Export Payment Register
              </Button>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Request ID</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Payment Status</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Collected By</th>
                    <th className="py-3 px-4">Transaction Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-blue-900">{r.id}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{r.customerName}</td>
                      <td className="py-3 px-4 font-black text-slate-900">₹{r.totalAmount}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            r.paymentStatus === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {r.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {r.paymentRecord?.method || 'Due upon delivery'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {r.paymentRecord?.collectedBy || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {r.paymentRecord?.transactionNotes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUBVIEW: REPORTS (Figma Item 54) */}
        {adminSubView === 'reports' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Analytics & Operational Reports</h2>
                <p className="text-xs text-slate-500 mt-0.5">Detailed performance summary and CSV export.</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => window.print()} variant="outline" size="sm" leftIcon={<Printer className="w-4 h-4" />}>
                  Print / Save PDF
                </Button>
                <Button onClick={handleExportCSV} variant="primary" size="sm" leftIcon={<Download className="w-4 h-4" />}>
                  Export All (CSV)
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-500 uppercase">Average Getting Turnaround</h4>
                <p className="text-2xl font-black text-slate-900 mt-1">28.4 Hours</p>
                <p className="text-xs text-emerald-600 mt-1">Within standard 48h SLA</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-500 uppercase">Average Repair Turnaround</h4>
                <p className="text-2xl font-black text-slate-900 mt-1">5.2 Days</p>
                <p className="text-xs text-emerald-600 mt-1">Within 7-day target guarantee</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-500 uppercase">Doorstep Cash/UPI Collection Rate</h4>
                <p className="text-2xl font-black text-slate-900 mt-1">100%</p>
                <p className="text-xs text-slate-500 mt-1">Zero bad debt or chargebacks</p>
              </div>
            </div>
          </div>
        )}

        {/* SUBVIEW: SETTINGS (Figma Item 59) */}
        {adminSubView === 'settings' && (
          <div className="space-y-6 animate-in fade-in max-w-2xl">
            <div>
              <h2 className="text-2xl font-black text-slate-900">Platform Settings</h2>
              <p className="text-xs text-slate-500 mt-0.5">Business configuration, operating hours, and security parameters.</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Company / Brand Name</label>
                <input
                  type="text"
                  defaultValue="GR Sports Badminton Services"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Support Phone</label>
                  <input
                    type="text"
                    defaultValue="+91 80 4912 3456"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Support Email</label>
                  <input
                    type="text"
                    defaultValue="support@grsports.in"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Workshop Operating Hours</label>
                <input
                  type="text"
                  defaultValue="Mon–Sun: 08:00 AM – 09:30 PM (Pickup lines active 24/7)"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>

              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-950 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Phase 1 operating mode: Online payment gateways disabled. In-person post-delivery collection enabled.</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: ASSIGN EMPLOYEE */}
      {assignModalReqId && (
        <div
          onClick={() => setAssignModalReqId(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 my-auto flex flex-col max-h-[calc(100vh-2rem)] overflow-y-auto animate-in zoom-in-95"
          >
            <div className="shrink-0">
              <h3 className="font-bold text-base text-slate-900">Assign Technician / Field Agent</h3>
              <p className="text-xs text-slate-500">Request #{assignModalReqId}</p>
            </div>

            <div className="space-y-2 overflow-y-auto">
              {mockEmployees.map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => setSelectedEmpId(emp.id)}
                  className={`p-3 rounded-2xl border-2 cursor-pointer flex items-center justify-between text-xs ${
                    selectedEmpId === emp.id ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <p className="font-bold text-slate-900">{emp.name}</p>
                    <p className="text-slate-500 text-[11px]">{emp.role}</p>
                  </div>
                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-700">
                    {emp.activeJobsCount} Jobs Active
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2 shrink-0">
              <Button onClick={() => setAssignModalReqId(null)} variant="outline" className="flex-1" size="sm">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  assignEmployee(assignModalReqId, selectedEmpId);
                  setAssignModalReqId(null);
                }}
                variant="primary"
                className="flex-1"
                size="sm"
              >
                Confirm Assignment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REQUEST DETAIL INSPECTION */}
      {detailModalRequest && (
        <div
          onClick={() => setDetailModalRequest(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-auto flex flex-col max-h-[calc(100vh-2rem)] overflow-y-auto animate-in zoom-in-95"
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Request #{detailModalRequest.id} — Full Audit Record
                </h3>
                <p className="text-xs text-slate-500">
                  {detailModalRequest.serviceType} • {detailModalRequest.batBrand} {detailModalRequest.batModel}
                </p>
              </div>
              <button
                onClick={() => setDetailModalRequest(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <p className="font-bold text-slate-700">Customer:</p>
                <p className="font-bold text-slate-900">{detailModalRequest.customerName}</p>
                <p className="text-slate-600">{detailModalRequest.customerMobile}</p>
                <p className="text-slate-500">{detailModalRequest.customerEmail}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <p className="font-bold text-slate-700">Location & Distance:</p>
                <p className="font-bold text-slate-900">{detailModalRequest.distanceKm} KM from Hub</p>
                <p className="text-slate-600">
                  {detailModalRequest.pickupAddress.area}, {detailModalRequest.pickupAddress.pincode}
                </p>
                <p className="text-emerald-700 font-semibold">
                  {detailModalRequest.isFreeDelivery ? 'Free Delivery' : `Surcharge: ₹${detailModalRequest.pickupDeliveryCharge}`}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <div className="flex justify-between font-bold">
                <span>Total Amount:</span>
                <span className="text-blue-900">₹{detailModalRequest.totalAmount}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment Status:</span>
                <span>{detailModalRequest.paymentStatus}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 shrink-0">
              <Button onClick={() => setDetailModalRequest(null)} variant="primary" size="sm">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EMAIL TEMPLATE EDITOR */}
      {editingTemplateId && (
        <div
          onClick={() => setEditingTemplateId(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-auto flex flex-col max-h-[calc(100vh-2rem)] overflow-y-auto animate-in zoom-in-95"
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 shrink-0">
              <h3 className="font-bold text-base text-slate-900">Edit Email Notification Template</h3>
              <button
                onClick={() => setEditingTemplateId(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Subject</label>
              <input
                type="text"
                value={tplSubject}
                onChange={(e) => setTplSubject(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Body Content</label>
              <textarea
                rows={6}
                value={tplBody}
                onChange={(e) => setTplBody(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono outline-none"
              />
            </div>
            <div className="flex gap-2 pt-2 shrink-0">
              <Button onClick={() => setEditingTemplateId(null)} variant="outline" className="flex-1" size="sm">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  updateEmailTemplate(editingTemplateId, tplSubject, tplBody);
                  setEditingTemplateId(null);
                }}
                variant="primary"
                className="flex-1"
                size="sm"
              >
                Save Template Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT GETTING PACKAGE */}
      {editingGettingItem && (
        <div
          onClick={() => setEditingGettingItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-auto flex flex-col max-h-[calc(100vh-2rem)] overflow-y-auto animate-in zoom-in-95"
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 shrink-0">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-600" />
                Edit Bat Getting Package ({editingGettingItem.id})
              </h3>
              <button
                onClick={() => setEditingGettingItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs overflow-y-auto">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Package Name *</label>
                <input
                  type="text"
                  value={getFormName}
                  onChange={(e) => setGetFormName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Customer Price (₹) *</label>
                  <input
                    type="number"
                    value={getFormPrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGetFormPrice(val === '' ? '' : parseInt(val, 10) || 0);
                    }}
                    placeholder="e.g. 450"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-black text-blue-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Turnaround SLA *</label>
                  <input
                    type="text"
                    value={getFormTurnaround}
                    onChange={(e) => setGetFormTurnaround(e.target.value)}
                    placeholder="e.g. 24 Hours / 24–48 Hours"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Package Description</label>
                <textarea
                  rows={2}
                  value={getFormDesc}
                  onChange={(e) => setGetFormDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Features & Inclusions (comma-separated)
                </label>
                <input
                  type="text"
                  value={getFormFeatures}
                  onChange={(e) => setGetFormFeatures(e.target.value)}
                  placeholder="e.g. Pro Strings, Grommet inspection, 28 lbs tension"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 shrink-0">
              <Button onClick={() => setEditingGettingItem(null)} variant="outline" className="flex-1" size="sm">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const feats = getFormFeatures
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const parsedPrice = typeof getFormPrice === 'number' ? getFormPrice : parseInt(getFormPrice, 10);
                  if (!getFormName || isNaN(parsedPrice) || parsedPrice <= 0) {
                    addToast('warning', 'Invalid Price', 'Please enter a valid price greater than 0.');
                    return;
                  }
                  updateGettingService(editingGettingItem.id, {
                    name: getFormName,
                    price: parsedPrice,
                    turnaround: getFormTurnaround,
                    description: getFormDesc,
                    features: feats.length > 0 ? feats : editingGettingItem.features,
                  });
                  setEditingGettingItem(null);
                }}
                variant="primary"
                className="flex-1 font-bold"
                size="sm"
              >
                Save Package Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD GETTING PACKAGE */}
      {addGettingModalOpen && (
        <div
          onClick={() => setAddGettingModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-auto flex flex-col max-h-[calc(100vh-2rem)] overflow-y-auto animate-in zoom-in-95"
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 shrink-0">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                Add New Bat Getting Package
              </h3>
              <button
                onClick={() => setAddGettingModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs overflow-y-auto">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Package Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Express Tournament Getting"
                  value={getFormName}
                  onChange={(e) => setGetFormName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    placeholder="e.g. 599"
                    value={getFormPrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGetFormPrice(val === '' ? '' : parseInt(val, 10) || 0);
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-black text-blue-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Turnaround SLA *</label>
                  <input
                    type="text"
                    placeholder="e.g. 12 Hours Express"
                    value={getFormTurnaround}
                    onChange={(e) => setGetFormTurnaround(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Describe target players and string characteristics"
                  value={getFormDesc}
                  onChange={(e) => setGetFormDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Features (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Electronic constant pull, Yonex string, Dampener"
                  value={getFormFeatures}
                  onChange={(e) => setGetFormFeatures(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 shrink-0">
              <Button onClick={() => setAddGettingModalOpen(false)} variant="outline" className="flex-1" size="sm">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const parsedPrice = typeof getFormPrice === 'number' ? getFormPrice : parseInt(getFormPrice, 10);
                  if (!getFormName || isNaN(parsedPrice) || parsedPrice <= 0) {
                    addToast('warning', 'Incomplete Fields', 'Please enter package name and a valid price greater than 0.');
                    return;
                  }
                  const feats = getFormFeatures
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  addGettingService({
                    name: getFormName,
                    price: parsedPrice,
                    turnaround: getFormTurnaround || '24 Hours',
                    description: getFormDesc || 'Professional badminton stringing package.',
                    features: feats.length > 0 ? feats : ['Electronic Stringing', 'Grommet Check'],
                  });
                  setAddGettingModalOpen(false);
                  setGetFormName('');
                  setGetFormPrice(0);
                  setGetFormTurnaround('');
                  setGetFormDesc('');
                  setGetFormFeatures('');
                }}
                variant="primary"
                className="flex-1 font-bold"
                size="sm"
              >
                Create Package
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT REPAIR CATEGORY */}
      {editingRepairItem && (
        <div
          onClick={() => setEditingRepairItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-auto flex flex-col max-h-[calc(100vh-2rem)] overflow-y-auto animate-in zoom-in-95"
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 shrink-0">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-600" />
                Edit Repair Category ({editingRepairItem.name})
              </h3>
              <button
                onClick={() => setEditingRepairItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs overflow-y-auto">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  value={repFormName}
                  onChange={(e) => setRepFormName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Starting Base Price (₹) *</label>
                  <input
                    type="number"
                    value={repFormBasePrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRepFormBasePrice(val === '' ? '' : parseInt(val, 10) || 0);
                    }}
                    placeholder="e.g. 300"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-black text-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">SLA Target (Days Max) *</label>
                  <input
                    type="number"
                    min={1}
                    max={14}
                    value={repFormSlaDays}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRepFormSlaDays(val === '' ? '' : parseInt(val, 10) || 7);
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-bold text-amber-700 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Typical Turnaround Text</label>
                <input
                  type="text"
                  value={repFormTurnaround}
                  onChange={(e) => setRepFormTurnaround(e.target.value)}
                  placeholder="e.g. 5–7 Days"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Category Description & Technical Scope</label>
                <textarea
                  rows={3}
                  value={repFormDesc}
                  onChange={(e) => setRepFormDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 shrink-0">
              <Button onClick={() => setEditingRepairItem(null)} variant="outline" className="flex-1" size="sm">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const parsedBase = typeof repFormBasePrice === 'number' ? repFormBasePrice : parseInt(repFormBasePrice, 10);
                  const parsedSla = typeof repFormSlaDays === 'number' ? repFormSlaDays : parseInt(repFormSlaDays, 10);
                  if (!repFormName || isNaN(parsedBase) || parsedBase <= 0) {
                    addToast('warning', 'Invalid Price', 'Please enter a valid base price greater than 0.');
                    return;
                  }
                  updateRepairCategory(editingRepairItem.id, {
                    name: repFormName,
                    basePrice: parsedBase,
                    slaDays: isNaN(parsedSla) || parsedSla <= 0 ? 7 : parsedSla,
                    turnaround: repFormTurnaround,
                    description: repFormDesc,
                  });
                  setEditingRepairItem(null);
                }}
                variant="primary"
                className="flex-1 font-bold"
                size="sm"
              >
                Save Category Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD REPAIR CATEGORY */}
      {addRepairModalOpen && (
        <div
          onClick={() => setAddRepairModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-auto flex flex-col max-h-[calc(100vh-2rem)] overflow-y-auto animate-in zoom-in-95"
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 shrink-0">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                Add New Repair Category
              </h3>
              <button
                onClick={() => setAddRepairModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs overflow-y-auto">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Cone Replacement & Shaft Balancing"
                  value={repFormName}
                  onChange={(e) => setRepFormName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Base Price (₹) *</label>
                  <input
                    type="number"
                    placeholder="e.g. 350"
                    value={repFormBasePrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRepFormBasePrice(val === '' ? '' : parseInt(val, 10) || 0);
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-black text-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">SLA Target (Days Max) *</label>
                  <input
                    type="number"
                    min={1}
                    max={14}
                    value={repFormSlaDays}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRepFormSlaDays(val === '' ? '' : parseInt(val, 10) || 7);
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-bold text-amber-700 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Turnaround Text</label>
                <input
                  type="text"
                  placeholder="e.g. 4–6 Days"
                  value={repFormTurnaround}
                  onChange={(e) => setRepFormTurnaround(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description & Scope</label>
                <textarea
                  rows={3}
                  placeholder="Describe repair process, carbon curing, and warranty"
                  value={repFormDesc}
                  onChange={(e) => setRepFormDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 shrink-0">
              <Button onClick={() => setAddRepairModalOpen(false)} variant="outline" className="flex-1" size="sm">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const parsedBase = typeof repFormBasePrice === 'number' ? repFormBasePrice : parseInt(repFormBasePrice, 10);
                  const parsedSla = typeof repFormSlaDays === 'number' ? repFormSlaDays : parseInt(repFormSlaDays, 10);
                  if (!repFormName || isNaN(parsedBase) || parsedBase <= 0) {
                    addToast('warning', 'Incomplete Fields', 'Please enter category name and a valid base price.');
                    return;
                  }
                  addRepairCategory({
                    name: repFormName,
                    basePrice: parsedBase,
                    slaDays: isNaN(parsedSla) || parsedSla <= 0 ? 7 : parsedSla,
                    turnaround: repFormTurnaround || '5–7 Days',
                    description: repFormDesc || 'Precision structural repair service.',
                  });
                  setAddRepairModalOpen(false);
                  setRepFormName('');
                  setRepFormBasePrice('');
                  setRepFormSlaDays(7);
                  setRepFormTurnaround('');
                  setRepFormDesc('');
                }}
                variant="primary"
                className="flex-1 font-bold"
                size="sm"
              >
                Create Category
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
