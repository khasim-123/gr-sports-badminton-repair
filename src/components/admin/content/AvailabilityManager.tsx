/**
 * Admin: pickup availability rules (open days, capacity, lead time, slots, closed dates, notice).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Check, Loader2, Plus, Trash2, X } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { contentService } from '../../../services/contentService';
import { AvailabilitySettings, ClosedDate } from '../../../types/content';
import { Button } from '../../common/Button';
import {
  ErrorState,
  Field,
  FieldError,
  ListSkeleton,
  Notice,
  SaveFailedNotice,
  SectionHeader,
  addDaysISO,
  cardClass,
  errorMessage,
  focusRing,
  formatDate,
  hintClass,
  inputClass,
  inputErrorClass,
  labelClass,
  todayISO,
} from './shared';

const WEEKDAYS = [
  { id: 0, short: 'Mon', long: 'Monday' },
  { id: 1, short: 'Tue', long: 'Tuesday' },
  { id: 2, short: 'Wed', long: 'Wednesday' },
  { id: 3, short: 'Thu', long: 'Thursday' },
  { id: 4, short: 'Fri', long: 'Friday' },
  { id: 5, short: 'Sat', long: 'Saturday' },
  { id: 6, short: 'Sun', long: 'Sunday' },
];

interface FormState {
  openWeekdays: number[];
  dailyPickupCapacity: string;
  leadTimeDays: string;
  bookingWindowDays: string;
  pickupSlots: string[];
  closedDates: ClosedDate[];
  notice: string;
}

const sortClosed = (list: ClosedDate[]) => [...list].sort((a, b) => a.date.localeCompare(b.date));

const slotStart = (s: string) => (s.match(/\d{1,2}:\d{2}/)?.[0] ?? s).padStart(5, '0');

const sortSlots = (list: string[]) => [...list].sort((a, b) => slotStart(a).localeCompare(slotStart(b)));

const toForm = (s: AvailabilitySettings): FormState => ({
  openWeekdays: [...(s.openWeekdays || [])].sort((a, b) => a - b),
  dailyPickupCapacity: String(s.dailyPickupCapacity ?? 0),
  leadTimeDays: String(s.leadTimeDays ?? 0),
  bookingWindowDays: String(s.bookingWindowDays ?? 30),
  pickupSlots: sortSlots(s.pickupSlots || []),
  closedDates: sortClosed((s.closedDates || []).map((c) => ({ date: c.date, reason: c.reason ?? '' }))),
  notice: s.notice ?? '',
});

const serialize = (f: FormState) =>
  JSON.stringify({
    ...f,
    closedDates: f.closedDates.map((c) => ({ date: c.date, reason: (c.reason ?? '').trim() })),
    notice: f.notice.trim(),
  });

type Errors = Partial<Record<'dailyPickupCapacity' | 'leadTimeDays' | 'bookingWindowDays' | 'openWeekdays', string>>;

const parseInt0 = (v: string): number | null => {
  if (!/^\d+$/.test(v.trim())) return null;
  return parseInt(v.trim(), 10);
};

const validate = (f: FormState): { errors: Errors; settings?: AvailabilitySettings } => {
  const errors: Errors = {};
  const cap = parseInt0(f.dailyPickupCapacity);
  const lead = parseInt0(f.leadTimeDays);
  const win = parseInt0(f.bookingWindowDays);
  if (cap === null) errors.dailyPickupCapacity = 'Enter a whole number, 0 or more.';
  if (lead === null) errors.leadTimeDays = 'Enter a whole number, 0 or more.';
  if (win === null || win < 1) errors.bookingWindowDays = 'Enter at least 1 day.';
  if (lead !== null && win !== null && win >= 1 && lead >= win)
    errors.bookingWindowDays = 'Make this more than the days of notice, or no day can be booked.';
  if (f.openWeekdays.length === 0) errors.openWeekdays = 'Choose at least one day, or customers can’t book any pickup.';
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    settings: {
      openWeekdays: [...f.openWeekdays].sort((a, b) => a - b),
      dailyPickupCapacity: cap as number,
      leadTimeDays: lead as number,
      bookingWindowDays: win as number,
      pickupSlots: f.pickupSlots,
      closedDates: f.closedDates.map((c) => ({ date: c.date, reason: (c.reason ?? '').trim() || null })),
      notice: f.notice.trim() || null,
    },
  };
};

export const AvailabilityManager: React.FC = () => {
  const { addToast } = useApp();
  const [saved, setSaved] = useState<FormState | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  // add-slot inputs
  const [slotFrom, setSlotFrom] = useState('10:00');
  const [slotTo, setSlotTo] = useState('13:00');
  const [slotError, setSlotError] = useState<string | null>(null);
  // add-closed-date inputs
  const [closedDate, setClosedDate] = useState('');
  const [closedReason, setClosedReason] = useState('');
  const [closedError, setClosedError] = useState<string | null>(null);

  const today = todayISO();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const s = await contentService.getAvailabilitySettings();
      const f = toForm(s);
      setSaved(f);
      setForm(f);
      setErrors({});
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load availability settings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(() => !!form && !!saved && serialize(form) !== serialize(saved), [form, saved]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const update = (patch: Partial<FormState>) => {
    setForm((f) => (f ? { ...f, ...patch } : f));
    setSaveError(null);
  };

  const save = async () => {
    if (!form) return;
    const { errors: errs, settings } = validate(form);
    setErrors(errs);
    if (!settings) {
      addToast('warning', 'Check the highlighted fields', 'Some settings need fixing before saving.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await contentService.updateAvailabilitySettings(settings);
      const f = toForm(result || settings);
      setSaved(f);
      setForm(f);
      addToast('success', 'Availability saved', 'Customers will see the updated pickup days right away.');
    } catch (err) {
      const msg = errorMessage(err, 'Could not save availability.');
      setSaveError(msg);
      addToast('error', 'Save failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const addSlot = () => {
    if (!form) return;
    if (!slotFrom || !slotTo) return setSlotError('Choose a start and end time.');
    if (slotTo <= slotFrom) return setSlotError('End time must be after start time.');
    const label = `${slotFrom} - ${slotTo}`;
    if (form.pickupSlots.includes(label)) return setSlotError('That slot already exists.');
    setSlotError(null);
    update({ pickupSlots: sortSlots([...form.pickupSlots, label]) });
  };

  const addClosed = () => {
    if (!form) return;
    if (!closedDate) return setClosedError('Pick a date.');
    if (form.closedDates.some((c) => c.date === closedDate)) return setClosedError('That date is already closed.');
    setClosedError(null);
    update({ closedDates: sortClosed([...form.closedDates, { date: closedDate, reason: closedReason.trim() }]) });
    setClosedDate('');
    setClosedReason('');
  };

  const discard = () => {
    setForm(saved);
    setErrors({});
    setSaveError(null);
  };

  if (loading && !form) return <ListSkeleton rows={4} withImage={false} />;
  if (loadError && !form) return <ErrorState message={loadError} onRetry={load} retrying={loading} />;
  if (!form) return null;

  const lead = parseInt0(form.leadTimeDays);
  const win = parseInt0(form.bookingWindowDays);
  const cap = parseInt0(form.dailyPickupCapacity);
  const pastCount = form.closedDates.filter((c) => c.date < today).length;
  const summary =
    lead !== null && win !== null && win > lead
      ? `Customers can book pickups from ${formatDate(addDaysISO(today, lead), true)} to ${formatDate(
          addDaysISO(today, win),
          true
        )}${form.openWeekdays.length < 7 && form.openWeekdays.length > 0 ? ', on open days only' : ''}.`
      : null;

  return (
    <div className="space-y-4 pb-28 sm:pb-0">
      <SectionHeader
        title="Pickup availability"
        description="Which days customers can choose for doorstep racket pickup, and how many pickups you take."
        actions={
          !dirty && !saving ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[14px] text-ink-muted" role="status">
              <Check className="w-4 h-4 text-emerald-700" aria-hidden="true" /> All changes saved
            </span>
          ) : undefined
        }
      />

      <SaveFailedNotice message={saveError} />
      {summary && <Notice tone="info">{summary}</Notice>}

      {/* Open days */}
      <section className={`${cardClass} p-4 sm:p-5 space-y-4`} aria-labelledby="avail-days">
        <div>
          <h4 id="avail-days" className="text-[16px] font-semibold text-ink">
            Open days
          </h4>
          <p className="mt-0.5 text-[13px] text-ink-muted">Days of the week you collect rackets. Tap a day to open or close it.</p>
        </div>
        <div className="grid grid-cols-4 min-[420px]:grid-cols-7 gap-2" role="group" aria-label="Open weekdays">
          {WEEKDAYS.map((d) => {
            const on = form.openWeekdays.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={on}
                aria-label={d.long}
                onClick={() => {
                  update({
                    openWeekdays: on
                      ? form.openWeekdays.filter((x) => x !== d.id)
                      : [...form.openWeekdays, d.id].sort((a, b) => a - b),
                  });
                  if (errors.openWeekdays) setErrors((e) => ({ ...e, openWeekdays: undefined }));
                }}
                className={`min-h-[52px] rounded-xl border flex flex-col items-center justify-center leading-tight transition-colors duration-150 ${focusRing} ${
                  on ? 'bg-ink text-white border-ink hover:bg-ink-hover' : 'bg-white text-ink-muted border-line hover:border-ink/30 hover:text-ink'
                }`}
              >
                <span className="text-[14px] font-semibold">{d.short}</span>
                <span className={`text-[12px] ${on ? 'text-white/75' : 'text-ink-muted'}`}>{on ? 'Open' : 'Closed'}</span>
              </button>
            );
          })}
        </div>
        {errors.openWeekdays && <FieldError className="!mt-0">{errors.openWeekdays}</FieldError>}
      </section>

      {/* Numbers */}
      <section className={`${cardClass} p-4 sm:p-5 space-y-4`} aria-labelledby="avail-limits">
        <h4 id="avail-limits" className="text-[16px] font-semibold text-ink">
          Booking limits
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field
            label="Pickups per day"
            htmlFor="avail-cap"
            error={errors.dailyPickupCapacity}
            hint={cap === 0 ? 'No limit. Enter a number to cap pickups per day.' : 'The most pickups taken on one day · 0 = no limit'}
          >
            <input
              id="avail-cap"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={form.dailyPickupCapacity}
              onChange={(e) => {
                update({ dailyPickupCapacity: e.target.value });
                if (errors.dailyPickupCapacity) setErrors((x) => ({ ...x, dailyPickupCapacity: undefined }));
              }}
              className={`${inputClass} ${errors.dailyPickupCapacity ? inputErrorClass : ''}`}
            />
          </Field>
          <Field
            label="Notice needed (days)"
            htmlFor="avail-lead"
            error={errors.leadTimeDays}
            hint={lead === 0 ? 'Same-day pickup allowed' : lead === 1 ? 'Earliest pickup is tomorrow' : `Earliest pickup is in ${lead ?? '…'} days`}
          >
            <input
              id="avail-lead"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={form.leadTimeDays}
              onChange={(e) => {
                update({ leadTimeDays: e.target.value });
                if (errors.leadTimeDays) setErrors((x) => ({ ...x, leadTimeDays: undefined }));
              }}
              className={`${inputClass} ${errors.leadTimeDays ? inputErrorClass : ''}`}
            />
          </Field>
          <Field
            label="Book up to (days ahead)"
            htmlFor="avail-window"
            error={errors.bookingWindowDays}
            hint="How far ahead customers can book"
          >
            <input
              id="avail-window"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={form.bookingWindowDays}
              onChange={(e) => {
                update({ bookingWindowDays: e.target.value });
                if (errors.bookingWindowDays) setErrors((x) => ({ ...x, bookingWindowDays: undefined }));
              }}
              className={`${inputClass} ${errors.bookingWindowDays ? inputErrorClass : ''}`}
            />
          </Field>
        </div>
      </section>

      {/* Slots */}
      <section className={`${cardClass} p-4 sm:p-5 space-y-4`} aria-labelledby="avail-slots">
        <div>
          <h4 id="avail-slots" className="text-[16px] font-semibold text-ink">
            Pickup time slots
          </h4>
          <p className="mt-0.5 text-[13px] text-ink-muted">Customers pick one of these when booking.</p>
        </div>
        {form.pickupSlots.length === 0 ? (
          <p className="text-[14px] text-ink-soft">No slots yet, so customers only choose a date.</p>
        ) : (
          <ul className="flex flex-wrap gap-2" aria-label="Pickup time slots">
            {form.pickupSlots.map((s) => (
              <li
                key={s}
                className="inline-flex items-center gap-0.5 pl-3.5 rounded-full bg-paper border border-line text-[14px] font-medium text-ink tabular-nums"
              >
                {s}
                <button
                  type="button"
                  aria-label={`Remove slot ${s}`}
                  title="Remove slot"
                  onClick={() => update({ pickupSlots: form.pickupSlots.filter((x) => x !== s) })}
                  className={`w-11 h-11 inline-flex items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:text-rose-700 hover:bg-rose-50 ${focusRing}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="slot-from" className={labelClass}>
              From
            </label>
            <input
              id="slot-from"
              type="time"
              value={slotFrom}
              onChange={(e) => {
                setSlotFrom(e.target.value);
                setSlotError(null);
              }}
              className={`${inputClass} w-36`}
            />
          </div>
          <div>
            <label htmlFor="slot-to" className={labelClass}>
              To
            </label>
            <input
              id="slot-to"
              type="time"
              value={slotTo}
              onChange={(e) => {
                setSlotTo(e.target.value);
                setSlotError(null);
              }}
              className={`${inputClass} w-36`}
            />
          </div>
          <Button type="button" variant="secondary" className="min-h-[44px] px-4" leftIcon={<Plus className="w-4 h-4" />} onClick={addSlot}>
            Add slot
          </Button>
        </div>
        {slotError && <FieldError className="!mt-0">{slotError}</FieldError>}
      </section>

      {/* Closed dates */}
      <section className={`${cardClass} p-4 sm:p-5 space-y-4`} aria-labelledby="avail-closed">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 id="avail-closed" className="text-[16px] font-semibold text-ink">
              Closed dates
            </h4>
            <p className="mt-0.5 text-[13px] text-ink-muted">Holidays and days off. No pickups on these dates.</p>
          </div>
          {pastCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-[44px] sm:min-h-[40px] text-ink-soft"
              onClick={() => update({ closedDates: form.closedDates.filter((c) => c.date >= today) })}
            >
              Clear {pastCount} past date{pastCount === 1 ? '' : 's'}
            </Button>
          )}
        </div>

        {form.closedDates.length === 0 ? (
          <p className="text-[14px] text-ink-soft">No closed dates.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line" aria-label="Closed dates">
            {form.closedDates.map((c, idx) => {
              const past = c.date < today;
              return (
                <li key={c.date} className={`flex items-center gap-2 pl-3.5 pr-1 py-1 ${past ? 'bg-paper text-ink-muted' : ''}`}>
                  <span className={`text-[14px] font-medium w-36 shrink-0 tabular-nums ${past ? 'line-through' : 'text-ink'}`}>
                    {formatDate(c.date, true)}
                  </span>
                  <label htmlFor={`closed-reason-${c.date}`} className="sr-only">
                    Reason for {formatDate(c.date)}
                  </label>
                  <input
                    id={`closed-reason-${c.date}`}
                    value={c.reason ?? ''}
                    onChange={(e) => {
                      const next = [...form.closedDates];
                      next[idx] = { ...c, reason: e.target.value };
                      update({ closedDates: next });
                    }}
                    placeholder="Reason (optional)"
                    className={`flex-1 min-w-0 min-h-[44px] px-2.5 text-[14px] rounded-lg border border-transparent hover:border-line focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/15 bg-transparent placeholder:text-ink-muted/60 ${
                      past ? 'text-ink-muted' : 'text-ink'
                    }`}
                  />
                  {past && <span className="text-[12px] font-medium text-ink-muted shrink-0 hidden min-[420px]:inline">Past</span>}
                  <button
                    type="button"
                    aria-label={`Remove closed date ${formatDate(c.date)}`}
                    title="Remove"
                    onClick={() => update({ closedDates: form.closedDates.filter((x) => x.date !== c.date) })}
                    className={`w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-lg text-ink-muted transition-colors duration-150 hover:text-rose-700 hover:bg-rose-50 ${focusRing}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[190px_1fr_auto] gap-x-2 gap-y-3 items-end">
          <div>
            <label htmlFor="closed-date" className={labelClass}>
              Date
            </label>
            <input
              id="closed-date"
              type="date"
              min={today}
              value={closedDate}
              onChange={(e) => {
                setClosedDate(e.target.value);
                setClosedError(null);
              }}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="closed-reason" className={labelClass}>
              Reason <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <input
              id="closed-reason"
              value={closedReason}
              onChange={(e) => setClosedReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addClosed();
                }
              }}
              placeholder="e.g. Diwali"
              className={inputClass}
            />
          </div>
          <Button type="button" variant="secondary" className="min-h-[44px] px-4" leftIcon={<CalendarPlus className="w-4 h-4" />} onClick={addClosed}>
            Add date
          </Button>
        </div>
        {closedError && <FieldError className="!mt-0">{closedError}</FieldError>}
      </section>

      {/* Notice */}
      <section className={`${cardClass} p-4 sm:p-5 space-y-4`} aria-labelledby="avail-notice">
        <h4 id="avail-notice" className="text-[16px] font-semibold text-ink">
          Message for customers
        </h4>
        <div>
          <label htmlFor="avail-notice-text" className={labelClass}>
            Notice <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <textarea
            id="avail-notice-text"
            rows={2}
            value={form.notice}
            onChange={(e) => update({ notice: e.target.value })}
            placeholder="e.g. Closed 1–3 Nov for Diwali. Pickups resume 4 Nov."
            aria-describedby="avail-notice-help"
            className={`${inputClass} resize-y`}
          />
          <p id="avail-notice-help" className={hintClass}>
            Shown when customers choose a pickup date. Leave it empty to show nothing.
            {form.notice.trim().length > 0 && <span className="tabular-nums"> {form.notice.trim().length} characters.</span>}
          </p>
        </div>
      </section>

      {/* Save bar: fixed to the bottom on phones (always), floating at the bottom of the page on
          wider screens while there are unsaved changes, so Save is reachable from every section. */}
      <div
        className={`fixed bottom-0 inset-x-0 z-40 flex items-center gap-2 border-t border-line bg-white/95 backdrop-blur px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:sticky sm:bottom-4 sm:z-20 sm:mx-auto sm:rounded-2xl sm:border sm:shadow-elevated sm:px-4 sm:py-3 ${
          dirty || saving ? '' : 'sm:hidden'
        }`}
      >
        <p
          className={`flex-1 min-w-0 inline-flex items-center gap-2 text-[14px] font-medium ${dirty ? 'text-amber-800' : 'text-ink-muted'}`}
          role="status"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Saving…
            </>
          ) : dirty ? (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
              <span className="truncate">
                Unsaved changes<span className="hidden sm:inline"> — customers still see the old settings</span>
              </span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4 text-emerald-700" aria-hidden="true" /> All changes saved
            </>
          )}
        </p>
        {dirty && (
          <Button type="button" variant="secondary" className="min-h-[44px] px-4" onClick={discard} disabled={saving}>
            Discard
          </Button>
        )}
        <Button type="button" className="min-h-[44px] px-5" onClick={save} isLoading={saving} disabled={!dirty}>
          <span className="sm:hidden">Save</span>
          <span className="hidden sm:inline">Save changes</span>
        </Button>
      </div>
    </div>
  );
};

export default AvailabilityManager;
