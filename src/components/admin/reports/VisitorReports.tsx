import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarRange, Download, Users, Eye, UserCheck, UserPlus, ShoppingBag, TrendingUp, ShieldCheck } from 'lucide-react';
import { Button } from '../../common/Button';
import { useApp } from '../../../context/AppContext';
import { analyticsService, ReportCount, ReportType, VisitorSummary } from '../../../services/analyticsService';
import { ErrorState, ListSkeleton, Pills, addDaysISO, cardClass, errorMessage, inputClass, todayISO } from '../content/shared';

type RangePreset = '7' | '30' | '90' | 'custom';

const PAGE_LABELS: Record<string, string> = {
  home: 'Main page',
  'home/event': 'Event details (main page)',
  badminton: 'Badminton page',
  'badminton/event': 'Event details (Badminton page)',
  apparel: 'T-shirts page',
  'home/strings': 'Strings catalogue',
  'home/rackets': 'Rackets',
  'home/tshirts': 'T-shirts',
  'home/courts': 'Courts & academies',
  'home/tournaments': 'Tournaments',
  'home/events': 'Events calendar',
  login: 'Login page',
  'customer_portal/dashboard': 'Customer dashboard',
  'customer_portal/wizard': 'Booking form',
  'customer_portal/requests': 'My bookings',
};

const pageLabel = (page: string) => PAGE_LABELS[page] || page.replace(/[_/]/g, ' ');
const fmt = (n: number) => n.toLocaleString('en-IN');

// Same tile as the dashboard and the other admin pages: plain label, big figure, one line of context.
// (`icon` is kept in the props so callers don't change; the tiles read cleaner without it.)
const StatTile: React.FC<{ label: string; value: string; hint?: string; icon: React.ReactNode }> = ({ label, value, hint }) => (
  <div className={`${cardClass} p-4 sm:p-5 min-w-0`}>
    <h4 className="text-[13px] font-semibold text-slate-500 truncate">{label}</h4>
    <p className="font-display text-[32px] leading-tight font-bold text-ink mt-1 tabular-nums">{value}</p>
    {hint && <p className="text-[13px] text-slate-500 mt-0.5">{hint}</p>}
  </div>
);

/** Daily page views: single series, so no legend; hover/focus shows the exact numbers. */
const DailyChart: React.FC<{ daily: VisitorSummary['daily'] }> = ({ daily }) => {
  const [active, setActive] = useState<number | null>(null);
  // Draw at the real container width so text stays 10–11px on phones instead of shrinking.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const max = Math.max(1, ...daily.map((d) => d.pageViews));
  const niceMax = max <= 4 ? 4 : max <= 10 ? 10 : Math.ceil(max / 10) * 10; // halves stay whole numbers
  const ticks = [0, niceMax / 2, niceMax];
  const H = W < 500 ? 160 : 200;
  const padL = 32;
  const padB = 22;
  const plotW = W - padL - 4;
  const plotH = H - padB - 8;
  const slot = plotW / daily.length;
  const barW = Math.max(2, slot - 2); // 2px gap between bars
  const shown = active !== null ? daily[active] : null;
  const labelEvery = Math.max(1, Math.ceil(daily.length / Math.max(2, Math.floor(plotW / 70))));

  return (
    <div className="relative" ref={wrapRef}>
      <div className="h-6 text-xs text-slate-600" aria-live="polite">
        {shown ? (
          <span>
            <strong className="text-slate-900">{new Date(shown.date + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })}</strong>
            {' · '}{fmt(shown.pageViews)} page views · {fmt(shown.visitors)} visitors · {fmt(shown.bookings)} bookings
          </span>
        ) : (
          <span className="text-slate-400">Hover or tap a bar for that day's numbers</span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label="Page views per day">
        {ticks.map((t) => {
          const y = 8 + plotH - (t / niceMax) * plotH;
          return (
            <g key={t}>
              <line x1={padL} x2={W - 4} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize={10} fill="#64748b">{fmt(t)}</text>
            </g>
          );
        })}
        {daily.map((d, i) => {
          const h = (d.pageViews / niceMax) * plotH;
          const x = padL + i * slot + 1;
          const y = 8 + plotH - h;
          const r = Math.min(4, barW / 2, h);
          return (
            <g
              key={d.date}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onClick={() => setActive(i)}
              tabIndex={0}
              aria-label={`${d.date}: ${d.pageViews} page views`}
              className="cursor-pointer outline-none"
            >
              {/* full-height hit target, larger than the mark */}
              <rect x={padL + i * slot} y={8} width={slot} height={plotH} fill={active === i ? '#f1f5f9' : 'transparent'} />
              {h > 0 && (
                <path
                  d={`M${x},${8 + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${8 + plotH} Z`}
                  fill="#0F1B2B"
                  opacity={active === null || active === i ? 1 : 0.55}
                />
              )}
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="#64748b">
                  {new Date(d.date + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </text>
              )}
            </g>
          );
        })}
        <line x1={padL} x2={W - 4} y1={8 + plotH} y2={8 + plotH} stroke="#cbd5e1" strokeWidth={1} />
      </svg>
    </div>
  );
};

const RankList: React.FC<{ title: string; items: ReportCount[]; label?: (s: string) => string; capitalize?: boolean }> = ({
  title,
  items,
  label = (s) => s,
  capitalize = false,
}) => {
  const total = items.reduce((sum, i) => sum + i.count, 0) || 1;
  return (
    <div className={`${cardClass} p-4`}>
      <h3 className="text-sm font-bold text-slate-900 mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">No data for this period.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.label}>
              <div className="flex justify-between text-xs gap-3">
                <span className={`text-slate-700 truncate ${capitalize ? 'capitalize' : ''}`}>{label(item.label)}</span>
                <span className="text-slate-900 font-bold tabular-nums shrink-0">
                  {fmt(item.count)} <span className="text-slate-400 font-medium">({Math.round((item.count / total) * 100)}%)</span>
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-ink rounded-full" style={{ width: `${(item.count / total) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const VisitorReports: React.FC = () => {
  const { addToast } = useApp();
  const [preset, setPreset] = useState<RangePreset>('30');
  const [start, setStart] = useState(() => addDaysISO(todayISO(), -29));
  const [end, setEnd] = useState(() => todayISO());
  const [summary, setSummary] = useState<VisitorSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<ReportType | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await analyticsService.getSummary(start, end));
    } catch (err) {
      setError(errorMessage(err, 'Could not load visitor statistics.'));
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    if (start <= end) load();
  }, [load, start, end]);

  const choosePreset = (p: RangePreset) => {
    setPreset(p);
    if (p !== 'custom') {
      setEnd(todayISO());
      setStart(addDaysISO(todayISO(), -(Number(p) - 1)));
    }
  };

  const download = async (type: ReportType) => {
    setDownloading(type);
    try {
      await analyticsService.downloadReport(type, start, end);
      addToast('success', 'Report downloaded', type === 'customers' ? 'Customer report saved as CSV (opens in Excel / Google Sheets).' : 'Visit log saved as CSV.');
    } catch (err) {
      addToast('error', 'Download failed', errorMessage(err));
    } finally {
      setDownloading(null);
    }
  };

  const t = summary?.totals;

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h3 className="font-display tracking-[0.01em] text-2xl font-bold text-ink">Website visitors & customers</h3>
          <p className="text-xs text-slate-500 mt-0.5">Who visited the site, which pages they used, and how many went on to book.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => download('customers')} isLoading={downloading === 'customers'} disabled={!!downloading || start > end} variant="primary" size="sm" leftIcon={<Download className="w-4 h-4" />}>
            Customer report (CSV)
          </Button>
          <Button onClick={() => download('visits')} isLoading={downloading === 'visits'} disabled={!!downloading || start > end} variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />}>
            Visit log (CSV)
          </Button>
        </div>
      </div>

      <div className={`${cardClass} p-3 flex flex-col sm:flex-row sm:items-center gap-3`}>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <CalendarRange className="w-4 h-4" /> Period
        </div>
        <Pills
          value={preset}
          onChange={choosePreset}
          ariaLabel="Report period"
          options={[
            { id: '7', label: 'Last 7 days' },
            { id: '30', label: 'Last 30 days' },
            { id: '90', label: 'Last 90 days' },
            { id: 'custom', label: 'Custom' },
          ]}
        />
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" aria-label="Start date" className={inputClass} value={start} max={end} onChange={(e) => setStart(e.target.value)} />
            <span className="text-xs text-slate-400">to</span>
            <input type="date" aria-label="End date" className={inputClass} value={end} min={start} max={todayISO()} onChange={(e) => setEnd(e.target.value)} />
          </div>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} retrying={loading} />
      ) : loading && !summary ? (
        <ListSkeleton rows={4} withImage={false} />
      ) : summary && t ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <StatTile label="Visitors" value={fmt(t.uniqueVisitors)} hint="Unique browsers" icon={<Users className="w-4 h-4" />} />
            <StatTile label="Page views" value={fmt(t.pageViews)} hint={`${fmt(t.sessions)} visits`} icon={<Eye className="w-4 h-4" />} />
            <StatTile label="Logged-in customers" value={fmt(t.loggedInCustomers)} hint="Visited while signed in" icon={<UserCheck className="w-4 h-4" />} />
            <StatTile label="New customers" value={fmt(t.newCustomers)} hint="Registered in period" icon={<UserPlus className="w-4 h-4" />} />
            <StatTile label="Bookings" value={fmt(t.bookings)} hint="Requests created" icon={<ShoppingBag className="w-4 h-4" />} />
            <StatTile label="Conversion" value={`${t.conversionRate}%`} hint="Bookings per visitor" icon={<TrendingUp className="w-4 h-4" />} />
          </div>

          <div className={`${cardClass} p-4`}>
            <h3 className="text-sm font-bold text-slate-900">Page views per day</h3>
            {t.pageViews === 0 ? (
              <p className="text-xs text-slate-400 mt-3">No visits recorded in this period yet. Visits are counted from the day this feature went live.</p>
            ) : (
              <DailyChart daily={summary.daily} />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <RankList title="Most viewed pages" items={summary.topPages} label={pageLabel} capitalize />
            <RankList title="Where visitors came from" items={summary.topReferrers} />
            <RankList title="Devices" items={summary.devices} capitalize />
          </div>

          <div className={`${cardClass} overflow-hidden`}>
            <div className="p-4 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Recent customer visits</h3>
              <p className="text-xs text-slate-500">Customers who were logged in while browsing. Guests are counted above but not identified.</p>
            </div>
            {summary.recentCustomers.length === 0 ? (
              <p className="text-xs text-slate-400 px-4 pb-4">No logged-in customer visits in this period.</p>
            ) : (
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-paper text-slate-500 text-left">
                    <tr>
                      <th className="px-4 py-2 font-bold">Customer</th>
                      <th className="px-4 py-2 font-bold">Mobile</th>
                      <th className="px-4 py-2 font-bold">Last visit (IST)</th>
                      <th className="px-4 py-2 font-bold">Last page</th>
                      <th className="px-4 py-2 font-bold text-right">Page views</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {summary.recentCustomers.map((c) => (
                      <tr key={c.phone}>
                        <td className="px-4 py-2.5 font-bold text-slate-900">{c.name || 'Not registered yet'}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="text-ink hover:underline">
                            {c.phone}
                          </a>
                        </td>
                        <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">{c.lastVisit}</td>
                        <td className="px-4 py-2.5 text-slate-700 capitalize">{pageLabel(c.lastPage)}</td>
                        <td className="px-4 py-2.5 text-right font-bold tabular-nums">{fmt(c.pageViews)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {summary.recentCustomers.length > 0 && (
              <ul className="md:hidden divide-y divide-line/70 border-t border-line/70">
                {summary.recentCustomers.map((c) => (
                  <li key={c.phone} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{c.name || 'Not registered yet'}</p>
                      <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="text-[13px] text-ink underline underline-offset-2">
                        {c.phone}
                      </a>
                      <p className="text-[13px] text-slate-500">
                        {c.lastVisit} · <span className="capitalize">{pageLabel(c.lastPage)}</span>
                      </p>
                    </div>
                    <p className="shrink-0 text-right text-[13px] text-slate-500">
                      <span className="block text-sm font-bold tabular-nums text-slate-900">{fmt(c.pageViews)}</span>
                      views
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-slate-500 flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600" />
            Reports contain customers' personal details — store downloads securely and don't share them outside the business. Every download is recorded in the audit log.
          </p>
        </>
      ) : null}
    </div>
  );
};
