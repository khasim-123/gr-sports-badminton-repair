import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, RefreshCw, Search, WifiOff, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ServiceRequest } from '../../types';
import { formatDate, formatINR, parseDate } from '../../utils/format';
import { splitNotes } from '../customer/requestDisplay';
import { JobCard, stringWithColour } from './JobCard';
import { JobDetail } from './JobDetail';
import { ConfirmDialog, DistanceDialog, EstimateDialog, PaymentDialog, PickupDialog, ReviseDialog } from './JobDialogs';
import { requestService } from '../../services/requestService';
import { ActionKind, STAGE_TITLES, Stage, actionsFor, addressLine, amountDue, isForToday, matchesSearch, pickupWhen, stageOf } from './jobLogic';
import { useStaffJobs } from './useStaffJobs';

/** Staff portal views (employeeSubView). Older saved values fall back to "My jobs". */
type View = 'dashboard' | 'new' | 'done' | 'detail';
const LIST_VIEWS: { id: Exclude<View, 'detail'>; label: string }[] = [
  { id: 'dashboard', label: 'My jobs' },
  { id: 'new', label: 'New requests' },
  { id: 'done', label: 'Completed' },
];
const WORK_STAGES: Stage[] = ['collect', 'workshop', 'approval', 'deliver'];

const isSameDay = (iso: string | undefined, day: Date) => {
  const d = parseDate(iso);
  return !!d && d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
};

export const EmployeePortal: React.FC = () => {
  const {
    requests,
    userName,
    employeeSubView,
    setEmployeeSubView,
    selectedRequestId,
    setSelectedRequestId,
    isDataLoading,
    dataLoaded,
    refreshData,
    gettingServices,
    repairCategories,
    distanceConfig,
    calculateDistanceCharge,
    assignEmployee,
    recordPickupCondition,
    createRepairEstimate,
    requestPriceRevision,
    updateRequestStatus,
    startDelivery,
    recordManualPayment,
    toasts,
  } = useApp();
  const { me, open, done, unassigned } = useStaffJobs();

  const view: View = (['dashboard', 'new', 'done', 'detail'] as View[]).includes(employeeSubView as View)
    ? (employeeSubView as View)
    : 'dashboard';
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<{ kind: ActionKind; id: string } | null>(null);
  const backTo = useRef<Exclude<View, 'detail'>>('dashboard');
  // Staff work outdoors: say plainly when the phone has no connection (saves would fail).
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const on = () => {
      setOffline(false);
      refreshData();
    };
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detailRequest = view === 'detail' ? requests.find((r) => r.id === selectedRequestId) : undefined;
  const dialogRequest = dialog ? requests.find((r) => r.id === dialog.id) : undefined;
  const isMine = (r: ServiceRequest) => !!me && r.assignedEmployeeId === me.id;

  // Unknown/old sub-views (and a detail view restored without its request) go back to the list.
  useEffect(() => {
    if (employeeSubView !== view) setEmployeeSubView(view);
    if (view === 'detail' && dataLoaded && !detailRequest) setEmployeeSubView(backTo.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeSubView, view, dataLoaded, detailRequest]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view, selectedRequestId]);

  // New bookings and changes made by the admin appear without pressing Refresh (every minute,
  // only while the app is on screen and no form is open).
  const refreshRef = useRef(refreshData);
  refreshRef.current = refreshData;
  const dialogOpenRef = useRef(false);
  dialogOpenRef.current = !!dialog;
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !dialogOpenRef.current) refreshRef.current();
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Close an open dialog when its step is no longer valid (e.g. the data was refreshed after an error).
  useEffect(() => {
    if (!dialog) return;
    if (!dialogRequest || !actionsFor(dialogRequest, isMine(dialogRequest)).some((a) => a.kind === dialog.kind)) setDialog(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, me]);

  const openDetail = (id: string) => {
    if (view !== 'detail') backTo.current = view;
    setSelectedRequestId(id);
    setEmployeeSubView('detail');
  };
  const goTo = (v: Exclude<View, 'detail'>) => {
    setSearch('');
    setEmployeeSubView(v);
  };

  /** The server's message for a save that failed after `since` (the app reports failures as error toasts). */
  const errorSince = (since: number): string | null => {
    const t = toasts.find((x) => x.type === 'error' && Number(/^toast-(\d{13})/.exec(x.id)?.[1] || 0) >= since);
    return t ? t.message : null;
  };

  /** Runs a server action; on failure the data is reloaded so the screen shows the real status. */
  const run = async (action: () => Promise<boolean>) => {
    const ok = await action();
    if (!ok) refreshData();
    return ok;
  };

  const today = new Date();
  const todayJobs = open.filter((r) => isForToday(r, today));
  const byStage = (stage: Stage) => open.filter((r) => stageOf(r) === stage && !isForToday(r, today));
  const collectedToday = useMemo(() => {
    const paid = done.filter((r) => r.paymentRecord && isSameDay(r.paymentRecord.collectedAt, new Date()));
    const sum = (m: string) => paid.filter((r) => r.paymentRecord!.method === m).reduce((t, r) => t + (r.paymentRecord!.amount || 0), 0);
    return { count: paid.length, cash: sum('Cash'), upi: sum('UPI'), other: sum('Other') };
  }, [done]);

  const loading = !dataLoaded && isDataLoading;

  const cardProps = {
    gettingServices,
    repairCategories,
    onOpen: openDetail,
    onAction: (kind: ActionKind, r: ServiceRequest) => setDialog({ kind, id: r.id }),
  };

  const renderList = (list: ServiceRequest[]) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {list.map((r) => (
        <JobCard key={r.id} request={r} mine={isMine(r)} {...cardProps} />
      ))}
    </div>
  );

  const section = (title: string, list: ServiceRequest[], hint?: string, key?: string) =>
    list.length === 0 ? null : (
      <section key={key} className="space-y-3" aria-label={title}>
        <div>
          <h2 className="font-display tracking-[0.01em] text-[22px] leading-tight font-bold text-ink flex items-baseline gap-2">
            {title}
            <span className="font-sans text-sm font-semibold text-slate-500 tabular-nums">{list.length}</span>
          </h2>
          {hint && <p className="text-[13px] text-slate-500 mt-0.5">{hint}</p>}
        </div>
        {renderList(list)}
      </section>
    );

  const empty = (title: string, text: string, action?: React.ReactNode) => (
    <div className="bg-white rounded-2xl border border-line px-5 py-10 text-center">
      <p className="font-display tracking-[0.01em] text-xl font-bold text-ink">{title}</p>
      <p className="text-[15px] text-slate-600 mt-1 max-w-md mx-auto">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );

  /** Placeholder cards shaped like the job cards while the first load runs. */
  const skeleton = (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your jobs…</span>
      <div className="h-6 w-28 rounded-lg bg-slate-200/70 motion-safe:animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-line p-4 space-y-3" aria-hidden="true">
            <div className="flex justify-between gap-3">
              <div className="h-4 w-32 rounded bg-slate-200/70 motion-safe:animate-pulse" />
              <div className="h-5 w-20 rounded-full bg-slate-200/70 motion-safe:animate-pulse" />
            </div>
            <div className="h-6 w-48 rounded bg-slate-200/80 motion-safe:animate-pulse" />
            <div className="h-4 w-56 rounded bg-slate-200/60 motion-safe:animate-pulse" />
            <div className="h-4 w-40 rounded bg-slate-200/60 motion-safe:animate-pulse" />
            <div className="h-12 w-full rounded-xl bg-slate-200/70 motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );

  const searchResults = search.trim()
    ? [...open, ...unassigned, ...done].filter((r) => matchesSearch(r, search))
    : [];

  const counts: Record<Exclude<View, 'detail'>, number | null> = {
    dashboard: open.length,
    new: unassigned.length,
    done: null,
  };

  // ---------------------------------------------------------------------------
  // Dialogs (one at a time, for the list and the detail view)
  // ---------------------------------------------------------------------------
  const renderDialog = () => {
    if (!dialog || !dialogRequest) return null;
    const r = dialogRequest;
    const close = () => setDialog(null);
    const racket = `${r.batBrand} ${r.batModel}`.trim();
    const confirm = (title: string, message: React.ReactNode, confirmLabel: string, action: () => Promise<boolean>, tone: 'primary' | 'success' = 'primary') => (
      <ConfirmDialog
        title={title}
        message={message}
        confirmLabel={confirmLabel}
        onClose={close}
        onConfirm={() => run(action)}
        tone={tone}
        errorSince={errorSince}
      />
    );
    switch (dialog.kind) {
      case 'accept': {
        const { slot } = splitNotes(r.additionalNotes);
        return confirm(
          `Accept ${r.id}?`,
          <>
            <p>
              <b>{racket}</b> — {r.serviceType === 'REPAIR' ? r.repairIssue || 'repair' : 'stringing'} for {r.customerName}.
            </p>
            <p>
              Pickup: {pickupWhen(r, slot)} at {addressLine(r.pickupAddress) || r.pickupAddress?.area}.
            </p>
            <p className="text-slate-500">The job will be assigned to you. Only the admin can move it to someone else.</p>
          </>,
          'Accept job',
          () => (me ? assignEmployee(r.id, me.id) : Promise.resolve(false))
        );
      }
      case 'pickup':
        return (
          <PickupDialog
            request={r}
            onClose={close}
            onSubmit={(c, n, p) => run(() => recordPickupCondition(r.id, c, n, p))}
            errorSince={errorSince}
          />
        );
      case 'start_stringing':
        return confirm(
          'Start stringing?',
          <p>
            {racket}: {[stringWithColour(r), r.stringTensionLbs ? `${r.stringTensionLbs} lbs` : ''].filter(Boolean).join(', ') || 'string details not given'}.
          </p>,
          'Start stringing',
          () => updateRequestStatus(r.id, 'Getting in Progress', userName)
        );
      case 'finish_stringing':
        return confirm(
          'Stringing done?',
          <p>
            {racket} will be marked ready for delivery. Amount to collect on delivery: <b>{formatINR(amountDue(r))}</b>.
          </p>,
          'Mark ready for delivery',
          () => updateRequestStatus(r.id, 'Getting Completed', userName, 'Stringing finished, ready for delivery.')
        );
      case 'estimate':
        return (
          <EstimateDialog
            request={r}
            repairCategories={repairCategories}
            onClose={close}
            onSubmit={(est) => run(() => createRepairEstimate(r.id, est))}
            errorSince={errorSince}
          />
        );
      case 'start_repair':
        return confirm(
          'Start the repair?',
          <p>
            The customer approved <b>{formatINR(r.repairEstimate?.totalEstimate)}</b> for {racket}.
          </p>,
          'Start repair',
          () => updateRequestStatus(r.id, 'Repair in Progress', userName)
        );
      case 'revise':
        return (
          <ReviseDialog
            request={r}
            onClose={close}
            onSubmit={(extra, total, reason) => run(() => requestPriceRevision(r.id, extra, total, reason))}
            errorSince={errorSince}
          />
        );
      case 'finish_repair':
        return confirm(
          'Repair done?',
          <p>
            {racket} will be marked ready for delivery. Amount to collect on delivery: <b>{formatINR(amountDue(r))}</b>.
          </p>,
          'Mark ready for delivery',
          () => updateRequestStatus(r.id, 'Repair Completed', userName, 'Repair finished, ready for delivery.')
        );
      case 'dispatch':
        return confirm(
          r.status === 'Repair Declined' ? 'Return the racket?' : 'Out for delivery?',
          <>
            <p>
              Delivering {racket} to {r.customerName}, {addressLine(r.pickupAddress)}.
            </p>
            <p>
              {amountDue(r) > 0 ? (
                <>
                  Collect <b>{formatINR(amountDue(r))}</b> on delivery.
                </>
              ) : (
                'Nothing to collect.'
              )}
            </p>
          </>,
          'Out for delivery',
          () => startDelivery(r.id)
        );
      case 'payment':
        return (
          <PaymentDialog
            request={r}
            onClose={close}
            onSubmit={(amount, method, notes) => run(() => recordManualPayment(r.id, amount, method, notes, userName))}
            errorSince={errorSince}
          />
        );
      case 'correct_distance':
        return (
          <DistanceDialog
            request={r}
            distanceConfig={distanceConfig}
            chargeFor={calculateDistanceCharge}
            onClose={close}
            onSubmit={async (km, reason) => {
              const updated = await requestService.correctDistance(r.id, km, reason);
              refreshData(); // reload the job list with the new charge
              return updated;
            }}
          />
        );
      case 'return_done':
        return confirm(
          'Racket returned?',
          <p>
            {racket} was handed back to {r.customerName} without repair. There is nothing to collect; the request will be closed.
          </p>,
          'Close request',
          () => updateRequestStatus(r.id, 'Completed Without Repair', userName, 'Returned to the customer without repair.'),
          'success'
        );
      default:
        return null;
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const listHeading = view === 'new' ? 'New requests' : view === 'done' ? 'Completed' : 'My jobs';

  return (
    <div
      className={`max-w-6xl mx-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 space-y-4 ${
        view === 'detail' && detailRequest ? 'pb-36 md:pb-16' : 'pb-16'
      }`}
    >
      {offline && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <WifiOff className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <b>You&apos;re offline.</b> The list shows the last update. Pickups, payments and other changes can&apos;t be saved
            until the connection is back.
          </span>
        </p>
      )}
      {view === 'detail' && detailRequest ? (
        <JobDetail
          request={detailRequest}
          mine={isMine(detailRequest)}
          backLabel={LIST_VIEWS.find((v) => v.id === backTo.current)?.label || 'My jobs'}
          onBack={() => setEmployeeSubView(backTo.current)}
          onAction={(kind, r) => setDialog({ kind, id: r.id })}
          gettingServices={gettingServices}
          repairCategories={repairCategories}
          distanceConfig={distanceConfig}
        />
      ) : (
        <>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display tracking-[0.01em] text-[30px] sm:text-4xl leading-tight font-bold text-ink">{listHeading}</h1>
              <p className="text-sm text-slate-500 truncate mt-0.5">
                {userName || 'Staff'} · {formatDate(today)}
              </p>
            </div>
            <button
              type="button"
              onClick={refreshData}
              disabled={isDataLoading}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-3 sm:px-4 rounded-xl border border-line bg-white text-sm font-bold text-ink hover:bg-paper transition-colors duration-150 disabled:opacity-60 shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              aria-label="Refresh jobs"
            >
              <RefreshCw className={`w-4 h-4 ${isDataLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isDataLoading ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          </div>

          {/* Phone: view switcher (the top bar shows these tabs on wider screens) */}
          <nav className="md:hidden grid grid-cols-3 gap-1 p-1 rounded-2xl bg-paper-deep/60 border border-line" aria-label="Staff views">
            {LIST_VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => goTo(v.id)}
                aria-current={view === v.id ? 'page' : undefined}
                className={`min-h-[44px] px-1 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  view === v.id ? 'bg-white text-ink border border-line' : 'text-slate-600 border border-transparent'
                }`}
              >
                {v.id === 'new' ? 'New' : v.label}
                {counts[v.id] !== null && counts[v.id]! > 0 && (
                  <span
                    className={`min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center text-xs tabular-nums rounded-full ${
                      v.id === 'new' ? 'bg-accent text-ink' : 'bg-ink/10 text-ink'
                    }`}
                  >
                    {counts[v.id]}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {view !== 'new' && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, mobile, ID or racket"
                aria-label="Search your jobs"
                className="w-full min-h-[44px] pl-9 pr-11 rounded-xl border border-slate-300 bg-white text-base sm:text-sm focus:ring-2 focus:ring-ink/40 focus:border-ink outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-0 top-0 w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {loading ? (
            skeleton
          ) : dataLoaded && !me ? (
            empty(
              "Your staff account wasn't found",
              'Jobs are matched to your mobile number in the team list. Ask the admin to check your staff account.'
            )
          ) : search.trim() ? (
            searchResults.length === 0 ? (
              empty('No matching jobs', `Nothing in your jobs or new requests matches “${search.trim()}”.`)
            ) : (
              section('Search results', searchResults)
            )
          ) : view === 'new' ? (
            unassigned.length === 0 ? (
              empty('No new requests', 'New bookings that nobody has accepted yet appear here.')
            ) : (
              section(
                'Waiting to be accepted',
                unassigned,
                'Accept a job to take on its pickup, service and delivery. The admin can also assign jobs.'
              )
            )
          ) : view === 'done' ? (
            <>
              {collectedToday.count > 0 && (
                <section className="bg-white rounded-2xl border border-line p-4 shadow-2xs text-sm">
                  <h2 className="font-bold text-slate-900">Collected today on your jobs</h2>
                  <p className="text-slate-700 mt-1">
                    {[
                      collectedToday.cash > 0 && `Cash ${formatINR(collectedToday.cash)}`,
                      collectedToday.upi > 0 && `UPI ${formatINR(collectedToday.upi)}`,
                      collectedToday.other > 0 && `Other ${formatINR(collectedToday.other)}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}{' '}
                    <span className="text-slate-500">
                      ({collectedToday.count} {collectedToday.count === 1 ? 'payment' : 'payments'})
                    </span>
                  </p>
                </section>
              )}
              {done.length === 0 ? (
                empty('Nothing completed yet', 'Jobs you finish and get paid for are listed here.')
              ) : (
                section('Finished jobs', done)
              )}
            </>
          ) : (
            <>
              {unassigned.length > 0 && (
                <button
                  type="button"
                  onClick={() => goTo('new')}
                  className="w-full min-h-[52px] flex items-center justify-between gap-3 pl-4 pr-3 py-3 rounded-2xl border border-line border-l-4 border-l-accent bg-white text-left text-[15px] text-ink hover:bg-paper transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <span>
                    <b className="tabular-nums">
                      {unassigned.length} new {unassigned.length === 1 ? 'request' : 'requests'}
                    </b>{' '}
                    <span className="text-slate-600">waiting to be accepted</span>
                  </span>
                  <span className="inline-flex items-center gap-1 font-bold shrink-0">
                    View <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </span>
                </button>
              )}
              {open.length === 0 ? (
                empty(
                  'No jobs assigned to you',
                  'Accept a new request, or ask the admin to assign one to you.',
                  unassigned.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => goTo('new')}
                      className="min-h-[44px] px-5 rounded-xl bg-ink hover:bg-ink-hover text-white text-sm font-bold"
                    >
                      See new requests
                    </button>
                  ) : undefined
                )
              ) : (
                <>
                  {todayJobs.length === 0 && (
                    <p className="text-[15px] text-slate-600 px-1">
                      <b className="text-ink">Nothing due today.</b> Upcoming jobs are below.
                    </p>
                  )}
                  {section('Today', todayJobs, 'Pickups due today or overdue, and deliveries on the way.')}
                  {WORK_STAGES.map((s) => section(STAGE_TITLES[s], byStage(s), undefined, s))}
                </>
              )}
            </>
          )}
        </>
      )}

      {renderDialog()}
    </div>
  );
};
