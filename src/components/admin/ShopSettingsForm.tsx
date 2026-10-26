import React, { useEffect, useState } from 'react';
import { AlertTriangle, Info, RotateCcw, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { contentService } from '../../services/contentService';
import type { ShopSettings } from '../../types/content';
import { primeShopSettings } from '../../hooks/useShopSettings';
import { MobileInput } from '../common/MobileInput';
import { Button } from '../common/Button';
import { localMobileDigits, normalizeMobile, INVALID_MOBILE_MESSAGE } from '../../utils/phone';

const inputCls =
  'w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-ink/40 bg-white';
const errInputCls = 'border-rose-400 focus:ring-rose-400';
const labelCls = 'block text-xs font-bold text-slate-700 mb-1';
const cardCls = 'bg-white rounded-2xl border border-line shadow-xs';

/** Form values: phone numbers as 10 local digits (MobileInput shows +91), money as text. */
interface ShopForm {
  name: string;
  tagline: string;
  phone: string;
  whatsapp: string;
  email: string;
  addressLine: string;
  area: string;
  pincode: string;
  mapsUrl: string;
  openingHours: string;
  declinedRepairFee: string;
  instagramUrl: string;
  facebookUrl: string;
  xUrl: string;
  youtubeUrl: string;
  highlight1: string;
  highlight2: string;
  highlight3: string;
}

const SOCIALS: { key: 'instagramUrl' | 'facebookUrl' | 'xUrl' | 'youtubeUrl'; label: string; placeholder: string }[] = [
  { key: 'instagramUrl', label: 'Instagram', placeholder: 'https://instagram.com/…' },
  { key: 'facebookUrl', label: 'Facebook', placeholder: 'https://facebook.com/…' },
  { key: 'xUrl', label: 'X (Twitter)', placeholder: 'https://x.com/…' },
  { key: 'youtubeUrl', label: 'YouTube', placeholder: 'https://youtube.com/@…' },
];
const HIGHLIGHTS = ['highlight1', 'highlight2', 'highlight3'] as const;
const HIGHLIGHT_MAX = 120;

type Errors = Partial<Record<keyof ShopForm, string>>;

const toForm = (s: ShopSettings): ShopForm => ({
  name: s.name || '',
  tagline: s.tagline || '',
  phone: localMobileDigits(s.phone),
  whatsapp: localMobileDigits(s.whatsapp),
  email: s.email || '',
  addressLine: s.addressLine || '',
  area: s.area || '',
  pincode: s.pincode || '',
  mapsUrl: s.mapsUrl || '',
  openingHours: s.openingHours || '',
  declinedRepairFee: String(s.declinedRepairFee ?? 0),
  instagramUrl: s.instagramUrl || '',
  facebookUrl: s.facebookUrl || '',
  xUrl: s.xUrl || '',
  youtubeUrl: s.youtubeUrl || '',
  highlight1: s.footerHighlights?.[0] || '',
  highlight2: s.footerHighlights?.[1] || '',
  highlight3: s.footerHighlights?.[2] || '',
});

const validate = (f: ShopForm): Errors => {
  const e: Errors = {};
  const name = f.name.trim();
  if (name.length < 2 || name.length > 60) e.name = 'Enter the shop name (2–60 characters).';
  if (f.tagline.trim().length > 80) e.tagline = 'Keep the tagline to 80 characters or fewer.';
  if (!normalizeMobile(f.phone)) e.phone = INVALID_MOBILE_MESSAGE;
  if (!normalizeMobile(f.whatsapp)) e.whatsapp = INVALID_MOBILE_MESSAGE;
  const email = f.email.trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) e.email = 'Enter an email like name@example.com, or leave it empty.';
  if (!f.addressLine.trim()) e.addressLine = 'Enter the street address.';
  else if (f.addressLine.trim().length > 120) e.addressLine = 'Keep the address to 120 characters or fewer.';
  if (!f.area.trim()) e.area = 'Enter the area and city.';
  else if (f.area.trim().length > 120) e.area = 'Keep this to 120 characters or fewer.';
  if (f.pincode.trim() && !/^\d{6}$/.test(f.pincode.trim())) e.pincode = 'Pincode must be 6 digits.';
  const maps = f.mapsUrl.trim();
  if (maps && !/^https:\/\/\S+$/.test(maps)) e.mapsUrl = 'Paste a link that starts with https://';
  if (f.openingHours.trim().length > 120) e.openingHours = 'Keep the opening hours to 120 characters or fewer.';
  const fee = f.declinedRepairFee.trim() === '' ? NaN : Number(f.declinedRepairFee);
  if (!Number.isFinite(fee) || fee < 0 || fee > 5000) e.declinedRepairFee = 'Enter an amount from ₹0 to ₹5,000.';
  for (const { key } of SOCIALS) {
    const link = f[key].trim();
    if (link && (!/^https:\/\/\S+$/.test(link) || link.length > 300)) e[key] = 'Paste a link that starts with https://, or leave it empty.';
  }
  for (const key of HIGHLIGHTS) {
    if (f[key].trim().length > HIGHLIGHT_MAX) e[key] = `Keep each line to ${HIGHLIGHT_MAX} characters or fewer.`;
  }
  return e;
};

const fromForm = (f: ShopForm): ShopSettings => ({
  name: f.name.trim(),
  tagline: f.tagline.trim(),
  phone: normalizeMobile(f.phone) || f.phone,
  whatsapp: normalizeMobile(f.whatsapp) || f.whatsapp,
  email: f.email.trim() || null,
  addressLine: f.addressLine.trim(),
  area: f.area.trim(),
  pincode: f.pincode.trim() || null,
  mapsUrl: f.mapsUrl.trim() || null,
  openingHours: f.openingHours.trim(),
  declinedRepairFee: Number(f.declinedRepairFee),
  instagramUrl: f.instagramUrl.trim() || null,
  facebookUrl: f.facebookUrl.trim() || null,
  xUrl: f.xUrl.trim() || null,
  youtubeUrl: f.youtubeUrl.trim() || null,
  footerHighlights: HIGHLIGHTS.map((k) => f[k].trim().replace(/\s+/g, ' ')).filter(Boolean),
});

const sameForm = (a: ShopForm, b: ShopForm) =>
  (Object.keys(a) as (keyof ShopForm)[]).every((k) => a[k].trim() === b[k].trim());

/** Editable shop details (Shop Settings page). Saves to PUT /api/config/shop. */
export const ShopSettingsForm: React.FC<{ onSaved?: (s: ShopSettings) => void }> = ({ onSaved }) => {
  const { addToast } = useApp();
  const [saved, setSaved] = useState<ShopForm | null>(null);
  const [form, setForm] = useState<ShopForm | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const load = () => {
    setLoadError(null);
    contentService
      .getShopSettings()
      .then((s) => {
        const f = toForm(s);
        setSaved(f);
        setForm(f);
      })
      .catch((err: any) => setLoadError(err?.message || 'Could not load the shop details.'));
  };

  useEffect(load, []);

  if (!form || !saved) {
    return (
      <div className={`${cardCls} p-5 text-sm text-slate-600`}>
        {loadError ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {loadError}
            </span>
            <Button onClick={load} variant="outline" size="sm" className="min-h-[40px]">
              Try again
            </Button>
          </div>
        ) : (
          'Loading shop details…'
        )}
      </div>
    );
  }

  const errors = touched ? validate(form) : {};
  const dirty = !sameForm(form, saved);
  const set = (patch: Partial<ShopForm>) => {
    setForm((f) => (f ? { ...f, ...patch } : f));
    setSaveError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(validate(form)).length) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await contentService.updateShopSettings(fromForm(form));
      primeShopSettings(result); // headers, footers and links on this page update right away
      const f = toForm(result);
      setSaved(f);
      setForm(f);
      setTouched(false);
      addToast('success', 'Shop details saved', 'The website and customer messages now use the new details.');
      onSaved?.(result);
    } catch (err: any) {
      setSaveError(err?.message || 'The shop details could not be saved. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const field = (
    key: keyof ShopForm,
    label: string,
    input: React.ReactNode,
    hint?: React.ReactNode
  ) => (
    <div>
      <label htmlFor={`shop-${key}`} className={labelCls}>
        {label}
      </label>
      {input}
      {errors[key] ? (
        <p id={`shop-${key}-err`} className="text-xs text-rose-700 mt-1">
          {errors[key]}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500 mt-1">{hint}</p>
      ) : null}
    </div>
  );

  const text = (key: keyof ShopForm, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      id={`shop-${key}`}
      type="text"
      value={form[key]}
      onChange={(e) => set({ [key]: e.target.value } as Partial<ShopForm>)}
      aria-invalid={!!errors[key]}
      aria-describedby={errors[key] ? `shop-${key}-err` : undefined}
      className={`${inputCls} ${errors[key] ? errInputCls : ''}`}
      {...props}
    />
  );

  return (
    <form onSubmit={submit} noValidate className={`${cardCls} p-5 space-y-5`}>
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Shop details</p>
        <p className="text-xs text-slate-600 mt-1 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
          These details appear on the website (header, footer, contact buttons) and in messages sent to customers.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('name', 'Shop name', text('name', { maxLength: 60, autoComplete: 'organization' }))}
        {field('tagline', 'Tagline (optional)', text('tagline', { maxLength: 80 }), 'Short line under the logo.')}
        {field(
          'phone',
          'Phone number (calls)',
          <MobileInput
            id="shop-phone"
            value={form.phone}
            onChange={(d) => set({ phone: d })}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? 'shop-phone-err' : undefined}
          />
        )}
        {field(
          'whatsapp',
          'WhatsApp number',
          <MobileInput
            id="shop-whatsapp"
            value={form.whatsapp}
            onChange={(d) => set({ whatsapp: d })}
            aria-invalid={!!errors.whatsapp}
            aria-describedby={errors.whatsapp ? 'shop-whatsapp-err' : undefined}
          />,
          form.whatsapp !== form.phone ? undefined : 'Same as the phone number.'
        )}
        {field('email', 'Email (optional)', text('email', { type: 'email', maxLength: 120, inputMode: 'email' }))}
        {field('openingHours', 'Opening hours', text('openingHours', { maxLength: 120 }), 'e.g. Mon–Sat 10:00 AM – 8:00 PM · Sunday closed')}
        <div className="sm:col-span-2">
          {field('addressLine', 'Address', text('addressLine', { maxLength: 120, autoComplete: 'street-address' }))}
        </div>
        {field('area', 'Area & city', text('area', { maxLength: 120 }))}
        {field('pincode', 'Pincode (optional)', text('pincode', { maxLength: 6, inputMode: 'numeric' }))}
        <div className="sm:col-span-2">
          {field(
            'mapsUrl',
            'Google Maps link (optional)',
            text('mapsUrl', { type: 'url', maxLength: 500, placeholder: 'https://maps.app.goo.gl/…' }),
            'Used for the “Directions” button. Open the shop in Google Maps, tap Share and paste the link.'
          )}
        </div>
        <div className="sm:col-span-2">
          {field(
            'declinedRepairFee',
            'Declined repair fee (₹)',
            <input
              id="shop-declinedRepairFee"
              type="number"
              inputMode="decimal"
              min={0}
              max={5000}
              step="any"
              value={form.declinedRepairFee}
              onChange={(e) => set({ declinedRepairFee: e.target.value })}
              aria-invalid={!!errors.declinedRepairFee}
              aria-describedby={errors.declinedRepairFee ? 'shop-declinedRepairFee-err' : undefined}
              className={`${inputCls} sm:max-w-[200px] ${errors.declinedRepairFee ? errInputCls : ''}`}
            />,
            'Charged (on top of pickup & delivery) when a customer declines a repair estimate and we return the racket unrepaired. 0 = only pickup & delivery.'
          )}
        </div>
      </div>

      <fieldset className="space-y-3 border-t border-line pt-5">
        <legend className="sr-only">Social media</legend>
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Social media</p>
          <p className="text-xs text-slate-600 mt-1">The four icons always show in the website footer. Add a link to make that icon open your page.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SOCIALS.map(({ key, label, placeholder }) => (
            <React.Fragment key={key}>{field(key, `${label} (optional)`, text(key, { type: 'url', maxLength: 300, inputMode: 'url', placeholder }))}</React.Fragment>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3 border-t border-line pt-5">
        <legend className="sr-only">Footer highlights</legend>
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Footer highlights</p>
          <p className="text-xs text-slate-600 mt-1">
            Up to three short lines in your own words, shown in the footer of every page. Empty lines are left out.
          </p>
        </div>
        <div className="space-y-3">
          {HIGHLIGHTS.map((key, i) => (
            <React.Fragment key={key}>{field(key, `Line ${i + 1}`, text(key, { maxLength: HIGHLIGHT_MAX }))}</React.Fragment>
          ))}
        </div>
      </fieldset>

      {saveError && (
        <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="submit"
          size="sm"
          className="min-h-[40px]"
          isLoading={isSaving}
          disabled={isSaving || !dirty}
          leftIcon={<Save className="w-4 h-4" />}
        >
          {isSaving ? 'Saving…' : 'Save shop details'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[40px]"
          disabled={isSaving || !dirty}
          onClick={() => {
            setForm(saved);
            setTouched(false);
            setSaveError(null);
          }}
          leftIcon={<RotateCcw className="w-4 h-4" />}
        >
          Discard changes
        </Button>
        {dirty && !isSaving && <span className="text-xs text-amber-700 font-semibold">Unsaved changes</span>}
      </div>
    </form>
  );
};
