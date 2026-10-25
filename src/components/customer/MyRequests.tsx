import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/Badge';
import { Button } from '../common/Button';
import { CardSkeleton } from '../common/Skeletons';
import { Search, ChevronRight, PlusCircle, MapPin, CalendarDays } from 'lucide-react';
import { formatDate } from '../../utils/format';
import { CustomerEmptyState, ServiceTypeTile, isOpenRequest, needsApproval, paymentLabel, priceLabel, serviceSummary } from './requestDisplay';

type Tab = 'All' | 'Active' | 'Stringing' | 'Repair' | 'Completed' | 'Declined / Cancelled';
const TABS: Tab[] = ['All', 'Active', 'Stringing', 'Repair', 'Completed', 'Declined / Cancelled'];

export const MyRequests: React.FC = () => {
  const { requests, openRequestDetail, openWizardWithService, isDataLoading, dataLoaded, gettingServices, requestsLoadFailed, refreshData } = useApp();
  const showLoading = isDataLoading && !dataLoaded;
  const [activeTab, setActiveTab] = useState<Tab>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const matchesTab = (req: (typeof requests)[number], tab: Tab) => {
    switch (tab) {
      case 'Stringing':
        return req.serviceType === 'GETTING';
      case 'Repair':
        return req.serviceType === 'REPAIR';
      case 'Active':
        return isOpenRequest(req);
      case 'Completed':
        return req.status === 'Completed';
      case 'Declined / Cancelled':
        return req.status === 'Cancelled' || req.status === 'Repair Declined' || req.status === 'Completed Without Repair';
      default:
        return true;
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredRequests = requests.filter((req) => {
    if (q) {
      const haystack = [req.id, req.batBrand, req.batModel, req.stringType, req.repairIssue].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return matchesTab(req, activeTab);
  }).sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:p-6 lg:p-8 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display tracking-[0.01em] text-3xl font-bold text-slate-900">My Requests</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Every stringing and repair you have booked, newest first. Open one for its progress and charges.
          </p>
        </div>
        <Button
          onClick={() => openWizardWithService('GETTING')}
          variant="primary"
          size="md"
          className="min-h-[44px] shrink-0"
          leftIcon={<PlusCircle className="w-4 h-4" />}
        >
          Book a service
        </Button>
      </div>

      {requests.length > 0 && (
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div className="flex overflow-x-auto no-scrollbar gap-1 bg-slate-100 p-1 rounded-2xl border border-line text-xs font-semibold" role="tablist">
            {TABS.map((tab) => {
              const count = requests.filter((r) => matchesTab(r, tab)).length;
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 min-h-[40px] rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    active ? 'bg-white text-ink shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab}
                  <span className={`text-[10px] px-1.5 rounded-full ${active ? 'bg-paper-deep text-ink' : 'bg-slate-200 text-slate-600'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative lg:w-64 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, racket or string"
              aria-label="Search your requests"
              className="w-full pl-9 pr-3 min-h-[44px] rounded-xl border border-line text-sm focus:ring-2 focus:ring-ink/40 outline-none bg-white"
            />
          </div>
        </div>
      )}

      {showLoading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : filteredRequests.length === 0 ? (
        requests.length === 0 && requestsLoadFailed ? (
          <CustomerEmptyState
            icon="requests"
            title="Couldn't load your bookings"
            description="We couldn't reach GR Sports just now. Check your internet connection and try again."
            actionText="Try again"
            onAction={refreshData}
          />
        ) : requests.length === 0 ? (
          <CustomerEmptyState
            icon="requests"
            title="No bookings yet"
            description="Book racket stringing or a repair and it will show up here, with live progress and charges."
            actionText="Book your first service"
            onAction={() => openWizardWithService('GETTING')}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
            No requests match {q ? `"${searchQuery.trim()}"` : 'this filter'}.{' '}
            <button
              type="button"
              className="text-ink font-bold underline min-h-[40px]"
              onClick={() => {
                setSearchQuery('');
                setActiveTab('All');
              }}
            >
              Show all requests
            </button>
          </div>
        )
      ) : (
        <ul className="space-y-3">
          {filteredRequests.map((req) => {
            const approval = needsApproval(req);
            return (
              <li key={req.id}>
                <button
                  type="button"
                  onClick={() => openRequestDetail(req.id)}
                  className={`w-full text-left bg-white rounded-2xl sm:rounded-2xl border p-4 sm:p-5 hover:border-ink/30 hover:shadow-lg transition-all group grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_12rem_auto] items-center gap-x-4 gap-y-3 ${
                    approval ? 'border-amber-300 ring-1 ring-amber-200' : 'border-line'
                  }`}
                >
                  <ServiceTypeTile type={req.serviceType} />

                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-xs font-bold text-ink bg-paper px-2 py-0.5 rounded-md border border-line">
                        {req.id}
                      </span>
                      <span className="text-base font-extrabold text-slate-900 group-hover:text-ink">
                        {req.batBrand} {req.batModel}
                      </span>
                    </span>
                    <span className="block text-xs font-semibold text-slate-700 mt-1">{serviceSummary(req, gettingServices)}</span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 mt-1">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="w-3.5 h-3.5" /> Booked {formatDate(req.createdAt)}
                      </span>
                      {req.pickupAddress?.area && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> {req.pickupAddress.area} ({req.distanceKm} KM)
                        </span>
                      )}
                    </span>
                  </span>

                  <span className="col-span-2 sm:col-span-1 flex sm:flex-col items-center sm:items-end justify-between gap-1 border-t sm:border-t-0 border-line/70 pt-3 sm:pt-0">
                    <StatusBadge status={req.status} size="sm" />
                    <span className="text-right">
                      <span className="block text-sm font-extrabold text-slate-900">{priceLabel(req)}</span>
                      <span className="block text-[11px] text-slate-500">{paymentLabel(req)}</span>
                    </span>
                  </span>

                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-ink hidden sm:block" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
