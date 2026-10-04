import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/Badge';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyStates';
import {
  Search,
  Filter,
  Wrench,
  Clock,
  ArrowRight,
  ChevronRight,
  PlusCircle,
  MapPin,
} from 'lucide-react';

export const MyRequests: React.FC = () => {
  const { requests, openRequestDetail, setCustomerSubView } = useApp();
  const [activeTab, setActiveTab] = useState<'All' | 'Getting' | 'Repair' | 'Active' | 'Completed' | 'Cancelled'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRequests = requests.filter((req) => {
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = req.id.toLowerCase().includes(q);
      const matchBrand = req.batBrand.toLowerCase().includes(q);
      const matchModel = req.batModel.toLowerCase().includes(q);
      if (!matchId && !matchBrand && !matchModel) return false;
    }

    // Tab filter
    if (activeTab === 'Getting') return req.serviceType === 'GETTING';
    if (activeTab === 'Repair') return req.serviceType === 'REPAIR';
    if (activeTab === 'Active') {
      return req.status !== 'Completed' && req.status !== 'Cancelled' && req.status !== 'Completed Without Repair';
    }
    if (activeTab === 'Completed') return req.status === 'Completed';
    if (activeTab === 'Cancelled') {
      return req.status === 'Cancelled' || req.status === 'Repair Declined' || req.status === 'Completed Without Repair';
    }

    return true;
  });

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">My Service Requests</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Monitor stringing, inspection status, and doorstep delivery for all your badminton bats.
          </p>
        </div>
        <Button
          onClick={() => setCustomerSubView('wizard')}
          variant="primary"
          size="md"
          leftIcon={<PlusCircle className="w-4 h-4" />}
        >
          Book New Service
        </Button>
      </div>

      {/* Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Tabs */}
        <div className="flex overflow-x-auto gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-semibold shrink-0">
          {(['All', 'Getting', 'Repair', 'Active', 'Completed', 'Cancelled'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-white text-blue-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID or Model..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          />
        </div>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <EmptyState
          type="no_requests"
          title="No Matching Requests Found"
          description="Try adjusting your filter or search query, or submit a new badminton service request."
          actionText="Book New Service"
          onAction={() => setCustomerSubView('wizard')}
        />
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => (
            <div
              key={req.id}
              onClick={() => openRequestDetail(req.id)}
              className="bg-white rounded-3xl border border-slate-200/90 p-5 hover:border-blue-400 hover:shadow-xl transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
            >
              <div className="flex items-start sm:items-center gap-4">
                {/* Rich Service Thumbnail */}
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-slate-200 shadow-2xs group-hover:scale-103 transition-transform">
                  <img
                    src={req.serviceType === 'GETTING' ? '/images/stringing-machine.jpg' : '/images/racket-repair.jpg'}
                    alt={req.batBrand}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                  <span className={`absolute bottom-0 inset-x-0 text-[8px] font-black uppercase text-center py-0.5 text-white ${
                    req.serviceType === 'GETTING' ? 'bg-blue-600' : 'bg-amber-600'
                  }`}>
                    {req.serviceType === 'GETTING' ? 'Stringing' : 'Repair'}
                  </span>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                      {req.id}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {req.batBrand} {req.batModel}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {req.batType}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-800">
                      {req.serviceType === 'GETTING'
                        ? `${req.gettingType} • ${req.stringTensionLbs || 26} lbs (${req.stringType || 'Yonex BG65'})`
                        : `Defect: ${req.repairIssue}`}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {req.pickupAddress.area} ({req.distanceKm} KM)
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 pl-20 sm:pl-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                <div className="text-left sm:text-right">
                  <StatusBadge status={req.status} size="sm" />
                  <p className="text-sm font-extrabold text-slate-900 mt-1">
                    {req.totalAmount > 0 ? `₹${req.totalAmount}` : 'Quote on Inspection'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Payment: {req.paymentStatus} (Doorstep)
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 group-hover:bg-blue-600 text-slate-400 group-hover:text-white transition-all shadow-2xs">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
