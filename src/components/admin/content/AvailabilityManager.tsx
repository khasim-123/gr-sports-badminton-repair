/**
 * Admin: pickup availability rules (open days, capacity, lead time, slots, closed dates, notice).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, CalendarX2, Clock3, Megaphone, Plus, Save, Trash2, Undo2, X } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { contentService } from '../../../services/contentService';
import { AvailabilitySettings, ClosedDate } from '../../../types/content';
import { Button } from '../../common/Button';
import {
  ErrorState,
  Field,
  ListSkeleton,
  SectionHeader,
  addDaysISO,
  cardClass,
  errorMessage,
  formatDate,
  inputClass,
  inputErrorClass,
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
  if (cap === null) errors.dailyPickupCapacity = 'Whole number, 0 or more.';
  if (lead === null) errors.leadTimeDays = 'Whole number, 0 or more.';
  if (win === null || win < 1) errors.bookingWindowDays = 'At least 1 day.';
  if (lead !== null && win !== null && win >= 1 && lead >= win)
    errors.bookingWindowDays = 'Must be longer than the lead time, or no days can be booked.';
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
    <div className="space-y-4 pb-24 sm:pb-0">
      <SectionHeader
        title="Pickup availability"
        description="Controls which days customers can choose for doorstep racket pickup."
        actions={
          <div className="hidden sm:flex gap-2">
            {dirty && (
              <Button
                type="button"
                variant="outline"
                className="min-h-[42px]"
                leftIcon={<Undo2 className="w-4 h-4" />}
                onClick={() => {
                  setForm(saved);
                  setErrors({});
                  setSaveError(null);
                }}
                disabled={saving}
              >
                Discard
              </Button>
            )}
            <Button
              type="button"
              className="min-h-[42px]"
              leftIcon={<Save className="w-4 h-4" />}
              onClick={save}
              isLoading={saving}
              disabled={!dirty}
            >
              {dirty ? 'Save changes' : 'Saved'}
            </Button>
          </div>
        }
      />

      {dirty && (
        <div className="hidden sm:flex p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-semibold" role="status">
          You have unsaved changes.
        </div>
      )}
      {saveError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700" role="alert">
          {saveError} Your changes are still here — try saving again.
        </div>
      )}
      {summary && (
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-900">{summary}</div>
      )}

      {/* Open days */}
      <section className={`${cardClass} p-4 space-y-3`} aria-labelledby="avail-days">
        <div>
          <h4 id="avail-days" className="text-sm font-bold text-slate-900">
            Open days
          </h4>
          <p className="text-[11px] text-slate-500">Days of the week you collect rackets.</p>
        </div>
        <div className="grid grid-cols-4 min-[420px]:grid-cols-7 gap-1.5" role="group" aria-label="Open weekdays">
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
                className={`min-h-[44px] rounded-xl text-xs font-bold border transition-colors ${
                  on
                    ? 'bg-sportsBlue text-white border-sportsBlue'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 line-through decoration-slate-300'
                }`}
              >
                {d.short}
              </button>
            );
          })}
        </div>
        {errors.openWeekdays && (
          <p className="text-[11px] text-rose-600 font-medium" role="alert">
            {errors.openWeekdays}
          </p>
        )}
      </section>

      {/* Numbers */}
      <section className={`${cardClass} p-4`} aria-label="Booking limits">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field
            label="Daily pickup capacity"
            htmlFor="avail-cap"
            error={errors.dailyPickupCapacity}
            hint={cap === 0 ? 'Unlimited pickups per day' : 'Max pickups per day · 0 = unlimited'}
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
            label="Lead time (days)"
            htmlFor="avail-lead"
            error={errors.leadTimeDays}
            hint={lead === 0 ? 'Same-day pickup allowed' : lead === 1 ? 'Earliest pickup is tomorrow' : 'Days of notice needed'}
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
            label="Booking window (days)"
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
      <section className={`${cardClass} p-4 space-y-3`} aria-labelledby="avail-slots">
        <div>
          <h4 id="avail-slots" className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Clock3 className="w-4 h-4 text-blue-600" /> Pickup time slots
          </h4>
          <p className="text-[11px] text-slate-500">Customers pick one of these when booking.</p>
        </div>
        {form.pickupSlots.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No slots — customers will only choose a date.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {form.pickupSlots.map((s) => (
              <li
                key={s}
                className="inline-flex items-center gap-1 pl-3 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800"
              >
                {s}
                <button
                  type="button"
                  aria-label={`Remove slot ${s}`}
                  onClick={() => update({ pickupSlots: form.pickupSlots.filter((x) => x !== s) })}
                  className="w-10 h-10 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="slot-from" className="block text-[11px] font-semibold text-slate-600 mb-1">
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
              className={`${inputClass} w-32`}
            />
          </div>
          <div>
            <label htmlFor="slot-to" className="block text-[11px] font-semibold text-slate-600 mb-1">
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
              className={`${inputClass} w-32`}
            />
          </div>
          <Button type="button" variant="outline" className="min-h-[42px]" leftIcon={<Plus className="w-4 h-4" />} onClick={addSlot}>
            Add slot
          </Button>
        </div>
        {slotError && (
          <p className="text-[11px] text-rose-600 font-medium" role="alert">
            {slotError}
          </p>
        )}
      </section>

      {/* Closed dates */}
      <section className={`${cardClass} p-4 space-y-3`} aria-labelledby="avail-closed">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 id="avail-closed" className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <CalendarX2 className="w-4 h-4 text-rose-600" /> Closed dates
            </h4>
            <p className="text-[11px] text-slate-500">Holidays and days off — no pickups on these dates.</p>
          </div>
          {pastCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-[40px] text-slate-600"
              onClick={() => update({ closedDates: form.closedDates.filter((c) => c.date >= today) })}
            >
              Clear {pastCount} past date{pastCount === 1 ? '' : 's'}
            </Button>
          )}
        </div>

        {form.closedDates.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No closed dates.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {form.closedDates.map((c, idx) => {
              const past = c.date < today;
              return (
                <li key={c.date} className={`flex items-center gap-2 pl-3 pr-1 py-1 ${past ? 'bg-slate-50 text-slate-400' : ''}`}>
                  <span className={`text-xs font-bold w-32 shrink-0 ${past ? 'line-through' : 'text-slate-800'}`}>
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
                    className={`flex-1 min-w-0 min-h-[40px] px-2 text-xs rounded-lg border border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent ${
                      past ? 'text-slate-400' : 'text-slate-700'
                    }`}
                  />
                  {past && <span className="text-[10px] font-semibold text-slate-400 shrink-0 hidden min-[420px]:inline">Past</span>}
                  <button
                    type="button"
                    aria-label={`Remove closed date ${formatDate(c.date)}`}
                    onClick={() => update({ closedDates: form.closedDates.filter((x) => x.date !== c.date) })}
                    className="w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[170px_1fr_auto] gap-2 items-end">
          <div>
            <label htmlFor="closed-date" className="block text-[11px] font-semibold text-slate-600 mb-1">
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
            <label htmlFor="closed-reason" className="block text-[11px] font-semibold text-slate-600 mb-1">
              Reason (optional)
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
          <Button type="button" variant="outline" className="min-h-[42px]" leftIcon={<CalendarPlus className="w-4 h-4" />} onClick={addClosed}>
            Add date
          </Button>
        </div>
        {closedError && (
          <p className="text-[11px] text-rose-600 font-medium" role="alert">
            {closedError}
          </p>
        )}
      </section>

      {/* Notice */}
      <section className={`${cardClass} p-4 space-y-2`} aria-labelledby="avail-notice">
        <h4 id="avail-notice" className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <Megaphone className="w-4 h-4 text-amber-500" /> Customer notice
        </h4>
        <label htmlFor="avail-notice-text" className="sr-only">
          Customer notice text
        </label>
        <textarea
          id="avail-notice-text"
          rows={2}
          value={form.notice}
          onChange={(e) => update({ notice: e.target.value })}
          placeholder="e.g. Closed 1–3 Nov for Diwali. Pickups resume 4 Nov."
          className={`${inputClass} resize-y`}
        />
        <p className="text-[11px] text-slate-500">
          Shown to customers when they choose a pickup date. Leave empty to show nothing. {form.notice.trim().length} characters.
        </p>
      </section>

      {/* Mobile sticky save bar */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-2">
        <p className={`text-[11px] font-semibold flex-1 min-w-0 ${dirty ? 'text-amber-700' : 'text-slate-500'}`} role="status">
          {dirty ? 'Unsaved changes' : 'All changes saved'}
        </p>
        {dirty && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[42px]"
            onClick={() => {
              setForm(saved);
              setErrors({});
              setSaveError(null);
            }}
            disabled={saving}
          >
            Discard
          </Button>
        )}
        <Button type="button" size="sm" className="min-h-[42px]" onClick={save} isLoading={saving} disabled={!dirty}>
          Save
        </Button>
      </div>
    </div>
  );
};

export default AvailabilityManager;
