import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Store, Truck, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { contentService } from '../../services/contentService';
import { customerService, CustomerSummary } from '../../services/customerService';
import type { Address, GettingType, RepairIssue, ServiceRequest, ServiceType } from '../../types';
import type { ShopSettings, StringProduct } from '../../types/content';
import { MobileInput } from '../common/MobileInput';
import { formatINR } from '../../utils/format';
import { formatMobile, localMobileDigits, normalizeMobile, INVALID_MOBILE_MESSAGE } from '../../utils/phone';

const inputCls =
  'w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-ink/40 bg-white';
const labelCls = 'block text-xs font-bold text-slate-700 mb-1';
const sectionCls = 'p-4 rounded-2xl border border-line space-y-3';
const sectionTitle = 'text-xs font-bold text-slate-500 uppercase tracking-wider';

const productLabel = (p: StringProduct) =>
  p.brand && !p.name.toLowerCase().startsWith(p.brand.toLowerCase()) ? `${p.brand} ${p.name}` : p.name;

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export interface NewBookingPrefill {
  mobile?: string; // any format
  name?: string;
}

interface Props {
  open: boolean;
  prefill?: NewBookingPrefill | null;
  onClose: () => void;
  onCreated: (req: ServiceRequest) => void;
}

/** Admin books a stringing / repair job for a customer who phoned or walked in. */
export const NewBookingDialog: React.FC<Props> = ({ open, prefill, onClose, onCreated }) => {
  const { gettingServices, repairCategories, employees, addRequest, assignEmployee, addToast } = useApp();

  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [serviceType, setServiceType] = useState<ServiceType>('GETTING');
  const [packageName, setPackageName] = useState('');
  const [ownString, setOwnString] = useState(false);
  const [ownStringNote, setOwnStringNote] = useState('');
  const [productId, setProductId] = useState('');
  const [colour, setColour] = useState('');
  const [tension, setTension] = useState('24');
  const [repairCat, setRepairCat] = useState('');
  const [repairDesc, setRepairDesc] = useState('');
  const [batBrand, setBatBrand] = useState('');
  const [batModel, setBatModel] = useState('');
  const [dropAtShop, setDropAtShop] = useState(false);
  const [addr, setAddr] = useState({ houseFlat: '', street: '', area: '', pincode: '', landmark: '' });
  const [distanceKm, setDistanceKm] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [notes, setNotes] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [strings, setStrings] = useState<StringProduct[]>([]);
  const [shop, setShop] = useState<ShopSettings | null>(null);

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setMobile(localMobileDigits(prefill?.mobile || ''));
    setName(prefill?.name || '');
    setNameEdited(!!prefill?.name);
    setServiceType('GETTING');
    setPackageName(gettingServices[0]?.name || '');
    setOwnString(false);
    setOwnStringNote('');
    setProductId('');
    setColour('');
    setTension('24');
    setRepairCat(repairCategories[0]?.name || '');
    setRepairDesc('');
    setBatBrand('');
    setBatModel('');
    setDropAtShop(false);
    setAddr({ houseFlat: '', street: '', area: '', pincode: '', landmark: '' });
    setDistanceKm('');
    setPickupDate('');
    setNotes('');
    setAssignTo('');
    setTouched(false);
    setSubmitError(null);
    customerService.listCustomers().then(setCustomers).catch(() => setCustomers([]));
    contentService.getPublicStrings().then(setStrings).catch(() => setStrings([]));
    contentService.getShopSettings().then(setShop).catch(() => setShop(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape closes (unless saving).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, submitting, onClose]);

  const normalized = normalizeMobile(mobile);
  const matched = useMemo(
    () => (normalized ? customers.find((c) => c.phone === normalized) : undefined),
    [customers, normalized]
  );
  // Prefill the name from the customers list when the mobile matches (unless typed already).
  useEffect(() => {
    if (matched && !nameEdited) setName(matched.name);
  }, [matched, nameEdited]);

  const product = strings.find((p) => p.id === productId);
  const colours = (product?.variants || []).filter((v) => v.inStock);
  const pkg = gettingServices.find((g) => g.name === packageName);
  const staff = employees.filter((e) => e.isActive !== false);

  if (!open) return null;

  const tensionNum = Number(tension);
  const km = dropAtShop ? 0 : distanceKm.trim() === '' ? NaN : Number(distanceKm);
  const errors: Record<string, string> = {};
  if (!normalized) errors.mobile = INVALID_MOBILE_MESSAGE;
  if (name.trim().length < 2) errors.name = "Enter the customer's name.";
  if (serviceType === 'GETTING') {
    if (!packageName) errors.package = 'Choose a stringing package.';
    if (!Number.isFinite(tensionNum) || tensionNum < 15 || tensionNum > 35) errors.tension = 'Tension must be 15–35 lbs.';
  } else {
    if (!repairCat) errors.repairCat = 'Choose a repair category.';
    if (repairDesc.trim().length < 3) errors.repairDesc = 'Describe the damage.';
  }
  if (!batBrand.trim()) errors.batBrand = 'Enter the racket brand.';
  if (!batModel.trim()) errors.batModel = 'Enter the racket model.';
  if (!dropAtShop) {
    if (!addr.houseFlat.trim()) errors.houseFlat = 'Required.';
    if (!addr.street.trim()) errors.street = 'Required.';
    if (!addr.area.trim()) errors.area = 'Required.';
    if (!/^\d{6}$/.test(addr.pincode.trim())) errors.pincode = '6-digit pincode.';
    if (!Number.isFinite(km) || km < 0 || km > 200) errors.distanceKm = 'Enter the distance in km (0–200).';
  }
  const err = (k: string) =>
    touched && errors[k] ? <p className="text-xs text-rose-700 mt-1">{errors[k]}</p> : null;
  const bad = (k: string) => (touched && errors[k] ? 'border-rose-400' : '');

  const stringName = ownString
    ? `Customer-provided string${ownStringNote.trim() ? `: ${ownStringNote.trim()}` : ''}`
    : product
      ? productLabel(product)
      : "Any (Technician's Choice)";
  const stringColour = !ownString && product && colour ? colour : '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const pickupAddress: Address = dropAtShop
      ? {
          id: 'ADDR-SHOP',
          label: 'Other',
          houseFlat: shop?.name || 'GR Sports',
          street: shop?.addressLine || 'Shop',
          area: shop?.area || 'Visakhapatnam',
          city: 'Visakhapatnam',
          state: 'Andhra Pradesh',
          pincode: shop?.pincode || '530016',
          landmark: 'Customer drops the racket at the shop',
          distanceKm: 0,
        }
      : {
          id: 'ADDR-NEW',
          label: 'Home',
          houseFlat: addr.houseFlat.trim(),
          street: addr.street.trim(),
          area: addr.area.trim(),
          city: 'Visakhapatnam',
          state: 'Andhra Pradesh',
          pincode: addr.pincode.trim(),
          landmark: addr.landmark.trim() || undefined,
          distanceKm: km,
        };
    const noteParts = [
      dropAtShop ? 'Customer will drop the racket at the shop (no pickup needed).' : '',
      notes.trim(),
    ].filter(Boolean);
    const isGetting = serviceType === 'GETTING';
    try {
      const saved = await addRequest({
        serviceType,
        customerName: name.trim(),
        customerMobile: normalized!,
        batBrand: batBrand.trim(),
        batModel: batModel.trim(),
        batPhotos: [],
        gettingType: isGetting ? (packageName as GettingType) : undefined,
        stringPreference: isGetting ? stringName : undefined,
        stringType: isGetting ? (stringColour ? `${stringName} (${stringColour})` : stringName) : undefined,
        colour: isGetting && stringColour ? stringColour : undefined,
        stringTensionLbs: isGetting ? Math.round(tensionNum) : undefined,
        repairIssue: !isGetting ? (repairCat as RepairIssue) : undefined,
        repairDescription: !isGetting ? repairDesc.trim() : undefined,
        pickupAddress,
        distanceKm: dropAtShop ? 0 : km,
        pickupDate: pickupDate || undefined,
        additionalNotes: noteParts.join('\n') || undefined,
      });
      if (assignTo) {
        const ok = await assignEmployee(saved.id, assignTo);
        if (!ok) addToast('warning', 'Booking saved, not assigned', `Assign ${saved.id} from its detail page.`);
      }
      onCreated(saved);
    } catch (e2: any) {
      setSubmitError(e2?.message || 'The booking could not be saved. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleBtn = (active: boolean) =>
    `flex-1 min-h-[40px] px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 ${
      active ? 'bg-ink border-ink text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-paper'
    }`;

  return createPortal(
    <div
      onClick={() => !submitting && onClose()}
      className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in"
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-booking-title"
        noValidate
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl my-auto flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] animate-in zoom-in-95"
      >
        <div className="flex justify-between items-start gap-3 p-4 sm:p-5 border-b border-line/70 shrink-0">
          <div className="min-w-0">
            <h3 id="new-booking-title" className="text-lg font-bold text-slate-900">
              New booking
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">For a customer who called or walked in. They get the usual booking updates.</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={submitting}
            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5 space-y-4 text-sm">
          {/* Customer */}
          <div className={sectionCls}>
            <p className={sectionTitle}>Customer</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="nb-mobile" className={labelCls}>
                  Mobile number
                </label>
                <MobileInput id="nb-mobile" value={mobile} onChange={setMobile} required aria-invalid={touched && !!errors.mobile} />
                {err('mobile')}
                {matched ? (
                  <p className="text-xs text-emerald-700 mt-1">
                    Existing customer · {matched.bookings} booking{matched.bookings === 1 ? '' : 's'}
                  </p>
                ) : normalized ? (
                  <p className="text-xs text-slate-500 mt-1">New customer — an account is created for {formatMobile(normalized)}.</p>
                ) : null}
              </div>
              <div>
                <label htmlFor="nb-name" className={labelCls}>
                  Name
                </label>
                <input
                  id="nb-name"
                  type="text"
                  maxLength={80}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameEdited(true);
                  }}
                  className={`${inputCls} ${bad('name')}`}
                />
                {err('name')}
              </div>
            </div>
          </div>

          {/* Service */}
          <div className={sectionCls}>
            <p className={sectionTitle}>Service</p>
            <div className="flex gap-2" role="group" aria-label="Service type">
              <button type="button" aria-pressed={serviceType === 'GETTING'} onClick={() => setServiceType('GETTING')} className={toggleBtn(serviceType === 'GETTING')}>
                Stringing
              </button>
              <button type="button" aria-pressed={serviceType === 'REPAIR'} onClick={() => setServiceType('REPAIR')} className={toggleBtn(serviceType === 'REPAIR')}>
                Repair
              </button>
            </div>

            {serviceType === 'GETTING' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor="nb-package" className={labelCls}>
                    Package
                  </label>
                  <select id="nb-package" value={packageName} onChange={(e) => setPackageName(e.target.value)} className={`${inputCls} ${bad('package')}`}>
                    {gettingServices.length === 0 && <option value="">No packages set up</option>}
                    {gettingServices.map((g) => (
                      <option key={g.id} value={g.name}>
                        {g.name} — {formatINR(g.price)}
                      </option>
                    ))}
                  </select>
                  {err('package')}
                  {pkg && <p className="text-xs text-slate-500 mt-1">The price is set by the server from the package.</p>}
                </div>
                <label className="sm:col-span-2 flex items-center gap-2 text-xs font-semibold text-slate-700 min-h-[40px]">
                  <input type="checkbox" checked={ownString} onChange={(e) => setOwnString(e.target.checked)} className="w-4 h-4" />
                  Customer brings their own string
                </label>
                {ownString ? (
                  <div className="sm:col-span-2">
                    <label htmlFor="nb-own" className={labelCls}>
                      Their string (optional)
                    </label>
                    <input id="nb-own" type="text" maxLength={80} value={ownStringNote} onChange={(e) => setOwnStringNote(e.target.value)} className={inputCls} placeholder="e.g. Yonex BG80 white" />
                  </div>
                ) : (
                  <>
                    <div>
                      <label htmlFor="nb-string" className={labelCls}>
                        String
                      </label>
                      <select
                        id="nb-string"
                        value={productId}
                        onChange={(e) => {
                          setProductId(e.target.value);
                          setColour('');
                        }}
                        className={inputCls}
                      >
                        <option value="">Technician's choice</option>
                        {strings.map((p) => (
                          <option key={p.id} value={p.id} disabled={p.inStockCount === 0}>
                            {productLabel(p)}
                            {p.price != null ? ` — ${formatINR(p.price)}` : ''}
                            {p.inStockCount === 0 ? ' (out of stock)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="nb-colour" className={labelCls}>
                        Colour
                      </label>
                      <select id="nb-colour" value={colour} onChange={(e) => setColour(e.target.value)} disabled={!product} className={`${inputCls} disabled:bg-paper`}>
                        <option value="">{product ? 'Any colour' : 'Choose a string first'}</option>
                        {colours.map((v) => (
                          <option key={v.id} value={v.colour}>
                            {v.colour}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <label htmlFor="nb-tension" className={labelCls}>
                    Tension (lbs)
                  </label>
                  <input id="nb-tension" type="number" inputMode="numeric" min={15} max={35} value={tension} onChange={(e) => setTension(e.target.value)} className={`${inputCls} ${bad('tension')}`} />
                  {err('tension')}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label htmlFor="nb-cat" className={labelCls}>
                    Repair category
                  </label>
                  <select id="nb-cat" value={repairCat} onChange={(e) => setRepairCat(e.target.value)} className={`${inputCls} ${bad('repairCat')}`}>
                    {repairCategories.length === 0 && <option value="">No categories set up</option>}
                    {repairCategories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} — from {formatINR(c.basePrice)}
                      </option>
                    ))}
                  </select>
                  {err('repairCat')}
                </div>
                <div>
                  <label htmlFor="nb-desc" className={labelCls}>
                    What's wrong?
                  </label>
                  <textarea id="nb-desc" rows={2} maxLength={1000} value={repairDesc} onChange={(e) => setRepairDesc(e.target.value)} className={`${inputCls} ${bad('repairDesc')}`} />
                  {err('repairDesc')}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="nb-brand" className={labelCls}>
                  Racket brand
                </label>
                <input id="nb-brand" type="text" maxLength={60} value={batBrand} onChange={(e) => setBatBrand(e.target.value)} className={`${inputCls} ${bad('batBrand')}`} placeholder="Yonex" />
                {err('batBrand')}
              </div>
              <div>
                <label htmlFor="nb-model" className={labelCls}>
                  Model
                </label>
                <input id="nb-model" type="text" maxLength={80} value={batModel} onChange={(e) => setBatModel(e.target.value)} className={`${inputCls} ${bad('batModel')}`} placeholder="Astrox 88D" />
                {err('batModel')}
              </div>
            </div>
          </div>

          {/* Pickup */}
          <div className={sectionCls}>
            <p className={sectionTitle}>Pickup</p>
            <div className="flex gap-2" role="group" aria-label="Pickup or drop-off">
              <button type="button" aria-pressed={!dropAtShop} onClick={() => setDropAtShop(false)} className={toggleBtn(!dropAtShop)}>
                <Truck className="w-4 h-4" /> Pick up from customer
              </button>
              <button type="button" aria-pressed={dropAtShop} onClick={() => setDropAtShop(true)} className={toggleBtn(dropAtShop)}>
                <Store className="w-4 h-4" /> Drop at shop
              </button>
            </div>
            {dropAtShop ? (
              <p className="text-xs text-slate-600">
                Customer will drop the racket at the shop
                {shop ? ` (${shop.addressLine}, ${shop.area})` : ''}. No pickup charge; this is noted on the booking.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    ['houseFlat', 'House / flat', 'Flat 4B, Sai Residency'],
                    ['street', 'Street', 'Beach Road'],
                    ['area', 'Area', 'MVP Colony'],
                    ['pincode', 'Pincode', '530017'],
                    ['landmark', 'Landmark (optional)', 'Near the park'],
                  ] as const
                ).map(([k, label, ph]) => (
                  <div key={k}>
                    <label htmlFor={`nb-${k}`} className={labelCls}>
                      {label}
                    </label>
                    <input
                      id={`nb-${k}`}
                      type="text"
                      inputMode={k === 'pincode' ? 'numeric' : undefined}
                      maxLength={k === 'pincode' ? 6 : 120}
                      value={addr[k]}
                      placeholder={ph}
                      onChange={(e) => setAddr((a) => ({ ...a, [k]: e.target.value }))}
                      className={`${inputCls} ${bad(k)}`}
                    />
                    {err(k)}
                  </div>
                ))}
                <div>
                  <label htmlFor="nb-km" className={labelCls}>
                    Distance from the shop (km)
                  </label>
                  <input id="nb-km" type="number" inputMode="decimal" min={0} max={200} step="0.1" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} className={`${inputCls} ${bad('distanceKm')}`} placeholder="e.g. 4.5" />
                  {err('distanceKm')}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="nb-date" className={labelCls}>
                  {dropAtShop ? 'Drop-off date (optional)' : 'Pickup date (optional)'}
                </label>
                <input id="nb-date" type="date" min={todayIso()} value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="nb-assign" className={labelCls}>
                  Assign to (optional)
                </label>
                <select id="nb-assign" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className={inputCls}>
                  <option value="">Assign later</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="nb-notes" className={labelCls}>
                  Notes (optional)
                </label>
                <textarea id="nb-notes" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="e.g. Call before coming, gate code…" />
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-line/70 p-3 sm:p-4 space-y-2">
          {submitError && (
            <div role="alert" className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}
          {touched && Object.keys(errors).length > 0 && !submitError && (
            <p className="text-xs text-rose-700">Please fix the highlighted fields.</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 min-h-[44px] rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:bg-paper disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[2] min-h-[44px] rounded-xl bg-ink hover:bg-ink-hover text-white text-sm font-bold disabled:opacity-60"
            >
              {submitting ? 'Creating booking…' : 'Create booking'}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body
  );
};
