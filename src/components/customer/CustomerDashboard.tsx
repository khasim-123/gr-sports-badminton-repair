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
import { YourOrdersBlock } from '../shop/MyOrders';
import { NextCourtBookingBlock } from '../courts/MyCourtBookings';

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
    { label: 'In progress', value: openRequests.length, icon: <Clock className="w-4 h-4 text-ink" />, hint: 'Booked, with us or on the way back' },
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

  const hasAttention = approvals.length > 0 || reviewable.length > 0;

  const servicesSection = (
    <section className="space-y-3" aria-labelledby="dash-services">
      <h2 id="dash-services" className="font-display tracking-[0.01em] text-2xl font-semibold text-slate-900">
        Services and prices
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          {
            type: 'GETTING' as const,
            title: 'Racket stringing',
            subtitle: 'Your string, colour and tension',
            text: 'Choose a package, your string and colour from our current catalogue, and the tension you want.',
            price: stringingPrice,
            cta: 'Book stringing',
          },
          {
            type: 'REPAIR' as const,
            title: 'Racket repair',
            subtitle: 'Frame, shaft, joint, handle and grip',
            text: 'We inspect your racket first and send you an itemised estimate. Work starts only after you approve it.',
            price: repairPrice,
            cta: 'Book a repair',
          },
        ].map((card) => (
          <button
            key={card.type}
            type="button"
            onClick={() => openWizardWithService(card.type)}
            className="text-left bg-white rounded-2xl border border-line p-5 hover:border-slate-300 hover:bg-paper/40 transition-colors duration-150 group flex flex-col"
          >
            <span className="flex items-center gap-3">
              <ServiceTypeTile type={card.type} />
              <span>
                <span className="block text-lg font-semibold text-slate-900">{card.title}</span>
                <span className="block text-[13px] text-slate-500">{card.subtitle}</span>
              </span>
            </span>
            <span className="block text-sm text-slate-600 leading-relaxed mt-3 flex-1">{card.text}</span>
            <span className="mt-4 pt-3 border-t border-line/70 flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-900 tabular-nums">{card.price}</span>
              <span className="font-semibold text-ink flex items-center gap-1 group-hover:underline underline-offset-4">
                {card.cta} <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
      {/* Welcome */}
      <section className="bg-ink text-white p-5 sm:p-7 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-5 focus-on-dark">
        <div className="min-w-0">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-[0.01em]">
            {firstName ? `Welcome, ${firstName}` : 'Welcome'}
          </h1>
          <p className="text-[15px] text-white/80 mt-1.5 max-w-xl leading-relaxed">
            Book racket stringing or a repair. We pick your racket up from your door
            {distanceConfig.freeRadiusKm > 0 ? ` (free within ${distanceConfig.freeRadiusKm} km)` : ''} and you pay when it
            comes back.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => openWizardWithService('GETTING')}
            className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl bg-accent hover:bg-accent-hover text-ink text-sm font-semibold transition-colors duration-150"
          >
            Book stringing
          </button>
          <button
            type="button"
            onClick={() => openWizardWithService('REPAIR')}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl border border-white/30 text-white hover:bg-white/10 text-sm font-semibold transition-colors duration-150"
          >
            <Wrench className="w-4 h-4" aria-hidden="true" />
            Book a repair
          </button>
        </div>
      </section>

      {/* Things that need the customer's attention — first, so nothing waits on them unnoticed */}
      {hasAttention && (
        <section aria-labelledby="dash-attention" className="bg-white rounded-2xl border border-line overflow-hidden">
          <h2 id="dash-attention" className="px-4 sm:px-5 pt-4 pb-2 text-sm font-semibold text-slate-900">
            Needs your attention
          </h2>
          <ul className="divide-y divide-line/70">
            {approvals.map((r) => (
              <li
                key={`approve-${r.id}`}
                className="px-4 sm:px-5 py-4 bg-amber-50/70 border-l-4 border-amber-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-slate-900">
                      {r.repairEstimate?.isRevised ? 'Updated repair estimate' : 'Repair estimate'} for {r.batBrand} {r.batModel}
                      {r.repairEstimate ? <span className="tabular-nums"> — {formatINR(r.repairEstimate.totalEstimate)}</span> : ''}
                    </p>
                    <p className="text-[13px] text-slate-600 mt-0.5">
                      {r.id} · We won&apos;t start the repair until you approve it.
                    </p>
                  </div>
                </div>
                <Button onClick={() => openRequestDetail(r.id)} size="md" variant="primary" className="min-h-[44px] shrink-0">
                  Review estimate
                </Button>
              </li>
            ))}
            {reviewable.slice(0, 2).map((r) => (
              <li key={`review-${r.id}`} className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <Star className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-slate-900">
                      How was your {r.serviceType === 'REPAIR' ? 'repair' : 'stringing'}?
                    </p>
                    <p className="text-[13px] text-slate-600 mt-0.5">
                      {r.id} · {r.batBrand} {r.batModel} — tell us in a short review.
                    </p>
                  </div>
                </div>
                <Button onClick={() => openRequestDetail(r.id)} size="md" variant="outline" className="min-h-[44px] shrink-0">
                  Write a review
                </Button>
              </li>
            ))}
          </ul>
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
              className={`text-left bg-white p-4 sm:p-5 rounded-2xl border transition-colors duration-150 hover:bg-paper/40 ${
                s.highlight ? 'border-amber-300' : 'border-line hover:border-slate-300'
              }`}
            >
              <span className="flex items-center justify-between text-slate-600 mb-2">
                <span className="text-[13px] font-medium">{s.label}</span>
                <span aria-hidden="true">{s.icon}</span>
              </span>
              <span className="block font-display text-4xl font-semibold leading-none text-slate-900 tabular-nums">
                {showLoading ? '—' : s.value}
              </span>
              <span className="block text-xs text-slate-500 mt-2">{s.hint}</span>
            </button>
          ))}
        </section>
      )}

      {/* How it works — shown to customers who haven't booked yet */}
      {isNewCustomer && (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3" aria-label="How it works">
          {[
            { icon: <ClipboardList className="w-5 h-5 text-ink" />, title: '1. Book online', text: 'Tell us about your racket and pick a pickup day and time.' },
            {
              icon: <Truck className="w-5 h-5 text-ink" />,
              title: '2. We collect it',
              text: `Our agent picks it up from your door${distanceConfig.freeRadiusKm > 0 ? ` — free within ${distanceConfig.freeRadiusKm} km` : ''}.`,
            },
            { icon: <Wallet className="w-5 h-5 text-ink" />, title: '3. Pay on delivery', text: 'We bring it back; pay by cash or UPI.' },
          ].map((step) => (
            <div key={step.title} className="bg-white rounded-2xl border border-line p-4 flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-paper border border-line/70 flex items-center justify-center shrink-0" aria-hidden="true">
                {step.icon}
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-slate-900">{step.title}</span>
                <span className="block text-[13px] text-slate-600 mt-0.5">{step.text}</span>
              </span>
            </div>
          ))}
        </section>
      )}

      {isNewCustomer && servicesSection}

      {/* Recent requests */}
      <section className="bg-white rounded-2xl border border-line p-4 sm:p-6 space-y-3" aria-labelledby="dash-recent">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="dash-recent" className="font-display tracking-[0.01em] text-2xl font-semibold text-slate-900">
              Recent requests
            </h2>
            <p className="text-[13px] text-slate-500">Open one to see its progress, charges and pickup details.</p>
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
          <div className="space-y-3" aria-busy="true" aria-label="Loading your bookings">
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
          <ul className="divide-y divide-line/70">
            {requests.slice(0, 4).map((req) => (
              <li key={req.id}>
                <button
                  type="button"
                  onClick={() => openRequestDetail(req.id)}
                  className="w-full text-left py-3 px-2 -mx-2 sm:mx-0 rounded-xl hover:bg-paper transition-colors duration-150 grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_11rem_auto] items-center gap-x-3 gap-y-2"
                >
                  <ServiceTypeTile type={req.serviceType} size="sm" />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-xs font-semibold text-ink bg-paper px-1.5 py-0.5 rounded border border-line tabular-nums">
                        {req.id}
                      </span>
                      <span className="text-[15px] font-semibold text-slate-900 truncate">
                        {req.batBrand} {req.batModel}
                      </span>
                    </span>
                    <span className="block text-[13px] text-slate-500 mt-0.5 truncate">
                      {serviceSummary(req, gettingServices)} · Booked {formatDate(req.createdAt)}
                    </span>
                  </span>
                  <span className="col-start-2 sm:col-start-auto flex sm:flex-col items-center sm:items-end justify-between gap-1">
                    <StatusBadge status={req.status} size="sm" />
                    <span className="text-sm font-semibold text-slate-900 tabular-nums">{priceLabel(req)}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 hidden sm:block" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Next court booking and shop orders (only when there are any) */}
      <NextCourtBookingBlock />
      <YourOrdersBlock />

      {!isNewCustomer && servicesSection}
    </div>
  );
};
