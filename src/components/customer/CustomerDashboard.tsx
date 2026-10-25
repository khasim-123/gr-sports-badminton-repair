import React from 'react';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/Badge';
import { Button } from '../common/Button';
import { CardSkeleton } from '../common/Skeletons';
import { Wrench, Clock, CheckCircle2, ChevronRight, AlertTriangle, Star, Truck, Wallet, ClipboardList } from 'lucide-react';
import { formatDate, formatINR } from '../../utils/format';
import {
  CustomerEmptyState,
  ServiceTypeTile,
  canReview,
  isOpenRequest,
  needsApproval,
  priceLabel,
  serviceSummary,
} from './requestDisplay';

export const CustomerDashboard: React.FC = () => {
  const {
    userName,
    requests,
    setCustomerSubView,
    openRequestDetail,
    openWizardWithService,
    distanceConfig,
    isDataLoading,
    dataLoaded,
    gettingServices,
    repairCategories,
    requestsLoadFailed,
    refreshData,
  } = useApp();

  const showLoading = isDataLoading && !dataLoaded;
  const firstName = (userName || '').trim().split(/\s+/)[0];

  // Live prices from the public configuration.
  const tierPrices = gettingServices.filter((g) => g.isActive !== false && g.price > 0).map((g) => g.price);
  const stringingPrice =
    tierPrices.length === 0
      ? 'Price confirmed at pickup'
      : Math.min(...tierPrices) === Math.max(...tierPrices)
      ? formatINR(tierPrices[0])
      : `${formatINR(Math.min(...tierPrices))} – ${formatINR(Math.max(...tierPrices))}`;
  const repairPrices = repairCategories.filter((r) => r.isActive !== false && r.basePrice > 0).map((r) => r.basePrice);
  const repairPrice = repairPrices.length > 0 ? `From ${formatINR(Math.min(...repairPrices))}` : 'Price after inspection';

  const openRequests = requests.filter(isOpenRequest);
  const approvals = requests.filter(needsApproval);
  const reviewable = requests.filter(canReview);
  const completed = requests.filter((r) => r.status === 'Completed');
  const isNewCustomer = !showLoading && requests.length === 0 && !requestsLoadFailed;
  const loadFailed = !showLoading && requests.length === 0 && requestsLoadFailed;

  const stats = [
    { label: 'In progress', value: openRequests.length, icon: <Clock className="w-4 h-4 text-blue-600" />, hint: 'Booked, with us or on the way back' },
    {
      label: 'Waiting for you',
      value: approvals.length,
      icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
      hint: 'Repair estimates to approve',
      highlight: approvals.length > 0,
    },
    { label: 'Completed', value: completed.length, icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />, hint: 'Delivered and paid' },
    { label: 'All bookings', value: requests.length, icon: <ClipboardList className="w-4 h-4 text-slate-500" />, hint: 'Since you joined' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:p-6 lg:p-8 space-y-6">
      {/* Welcome */}
      <section className="bg-ink text-white p-5 sm:p-7 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="min-w-0">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-[0.01em]">
            {firstName ? `Welcome, ${firstName}` : 'Welcome'}
          </h1>
          <p className="text-sm text-white/75 mt-1.5 max-w-xl leading-relaxed">
            Book racket stringing or a repair. We pick your racket up from your door
            {distanceConfig.freeRadiusKm > 0 ? ` (free within ${distanceConfig.freeRadiusKm} KM)` : ''} and you pay after
            it is delivered back.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => openWizardWithService('GETTING')}
            className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl bg-accent hover:bg-accent-hover text-ink text-sm font-bold transition-colors"
          >
            Book stringing
          </button>
          <button
            type="button"
            onClick={() => openWizardWithService('REPAIR')}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl border border-white/25 text-white hover:bg-white/10 text-sm font-bold transition-colors"
          >
            <Wrench className="w-4 h-4" />
            Book a repair
          </button>
        </div>
      </section>

      {/* Things that need the customer's attention */}
      {(approvals.length > 0 || reviewable.length > 0) && (
        <section className="space-y-2.5" aria-label="Needs your attention">
          {approvals.map((r) => (
            <div
              key={`approve-${r.id}`}
              className="p-4 rounded-2xl border-2 border-amber-300 bg-amber-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">
                    {r.repairEstimate?.isRevised ? 'Updated repair estimate' : 'Repair estimate'} for {r.batBrand} {r.batModel}
                    {r.repairEstimate ? ` — ${formatINR(r.repairEstimate.totalEstimate)}` : ''}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {r.id} · We won&apos;t start the repair until you approve it.
                  </p>
                </div>
              </div>
              <Button onClick={() => openRequestDetail(r.id)} size="sm" variant="primary" className="min-h-[40px] shrink-0">
                Review estimate
              </Button>
            </div>
          ))}
          {reviewable.slice(0, 2).map((r) => (
            <div
              key={`review-${r.id}`}
              className="p-4 rounded-2xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <Star className="w-5 h-5 text-amber-500 fill-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">How was your {r.serviceType === 'REPAIR' ? 'repair' : 'stringing'}?</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {r.id} · {r.batBrand} {r.batModel} — tell us in a short review.
                  </p>
                </div>
              </div>
              <Button onClick={() => openRequestDetail(r.id)} size="sm" variant="outline" className="min-h-[40px] shrink-0">
                Write a review
              </Button>
            </div>
          ))}
        </section>
      )}

      {/* Booking summary (only once there is something to count) */}
      {!isNewCustomer && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" aria-label="Your bookings">
          {stats.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setCustomerSubView('requests')}
              className={`text-left bg-white p-4 sm:p-5 rounded-2xl border shadow-2xs hover:shadow-md transition-all ${
                s.highlight ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200/80 hover:border-blue-300'
              }`}
            >
              <span className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold">{s.label}</span>
                {s.icon}
              </span>
              <span className="block text-2xl font-black text-slate-900">{showLoading ? '—' : s.value}</span>
              <span className="block text-[11px] text-slate-400 mt-1">{s.hint}</span>
            </button>
          ))}
        </section>
      )}

      {/* Services */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-label="Services">
        <button
          type="button"
          onClick={() => openWizardWithService('GETTING')}
          className="text-left bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs hover:border-blue-400 hover:shadow-lg transition-all group flex flex-col"
        >
          <span className="flex items-center gap-3">
            <ServiceTypeTile type="GETTING" />
            <span>
              <span className="block text-lg font-black text-slate-900 group-hover:text-blue-700">Racket stringing</span>
              <span className="block text-xs text-slate-500">Bat getting</span>
            </span>
          </span>
          <span className="block text-xs text-slate-600 leading-relaxed mt-3 flex-1">
            Choose a package, your string and colour from our current catalogue, and the tension you want.
          </span>
          <span className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800">{stringingPrice}</span>
            <span className="font-bold text-blue-700 flex items-center gap-1">
              Book stringing <ChevronRight className="w-4 h-4" />
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => openWizardWithService('REPAIR')}
          className="text-left bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs hover:border-amber-400 hover:shadow-lg transition-all group flex flex-col"
        >
          <span className="flex items-center gap-3">
            <ServiceTypeTile type="REPAIR" />
            <span>
              <span className="block text-lg font-black text-slate-900 group-hover:text-amber-700">Racket repair</span>
              <span className="block text-xs text-slate-500">Frame, shaft, joint, handle and grip</span>
            </span>
          </span>
          <span className="block text-xs text-slate-600 leading-relaxed mt-3 flex-1">
            We inspect your racket first and send you an itemised estimate. Work starts only after you approve it.
          </span>
          <span className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800">{repairPrice}</span>
            <span className="font-bold text-amber-700 flex items-center gap-1">
              Book a repair <ChevronRight className="w-4 h-4" />
            </span>
          </span>
        </button>
      </section>

      {/* How it works — shown to customers who haven't booked yet */}
      {isNewCustomer && (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3" aria-label="How it works">
          {[
            { icon: <ClipboardList className="w-5 h-5 text-blue-600" />, title: '1. Book online', text: 'Tell us about your racket and pick a pickup day and time.' },
            {
              icon: <Truck className="w-5 h-5 text-emerald-600" />,
              title: '2. We collect it',
              text: `Our agent picks it up from your door${distanceConfig.freeRadiusKm > 0 ? ` — free within ${distanceConfig.freeRadiusKm} KM` : ''}.`,
            },
            { icon: <Wallet className="w-5 h-5 text-amber-600" />, title: '3. Pay after delivery', text: 'We bring it back; pay by cash or UPI.' },
          ].map((step) => (
            <div key={step.title} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">{step.icon}</span>
              <span>
                <span className="block text-sm font-bold text-slate-900">{step.title}</span>
                <span className="block text-xs text-slate-600 mt-0.5">{step.text}</span>
              </span>
            </div>
          ))}
        </section>
      )}

      {/* Recent requests */}
      <section className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Recent requests</h2>
            <p className="text-xs text-slate-500">Open one to see its progress, charges and pickup details.</p>
          </div>
          {requests.length > 0 && (
            <Button
              onClick={() => setCustomerSubView('requests')}
              variant="ghost"
              size="sm"
              className="min-h-[40px] shrink-0"
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              View all
            </Button>
          )}
        </div>

        {showLoading && (
          <div className="space-y-3">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {loadFailed && (
          <CustomerEmptyState
            icon="requests"
            title="Couldn't load your bookings"
            description="We couldn't reach GR Sports just now. Check your internet connection and try again."
            actionText="Try again"
            onAction={refreshData}
          />
        )}

        {isNewCustomer && (
          <CustomerEmptyState
            icon="requests"
            title="No bookings yet"
            description="Your stringing and repair requests will appear here once you book."
            actionText="Book your first service"
            onAction={() => openWizardWithService('GETTING')}
          />
        )}

        {!showLoading && requests.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {requests.slice(0, 4).map((req) => (
              <li key={req.id}>
                <button
                  type="button"
                  onClick={() => openRequestDetail(req.id)}
                  className="w-full text-left py-3 px-2 -mx-2 sm:mx-0 rounded-2xl hover:bg-slate-50 transition-colors grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_11rem_auto] items-center gap-x-3 gap-y-2"
                >
                  <ServiceTypeTile type={req.serviceType} size="sm" />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-mono text-[11px] font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                        {req.id}
                      </span>
                      <span className="text-sm font-bold text-slate-900 truncate">
                        {req.batBrand} {req.batModel}
                      </span>
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5 truncate">
                      {serviceSummary(req, gettingServices)} · Booked {formatDate(req.createdAt)}
                    </span>
                  </span>
                  <span className="col-start-2 sm:col-start-auto flex sm:flex-col items-center sm:items-end justify-between gap-1">
                    <StatusBadge status={req.status} size="sm" />
                    <span className="text-xs font-extrabold text-slate-900">{priceLabel(req)}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 hidden sm:block" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
