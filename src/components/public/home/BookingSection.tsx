import React, { useEffect, useId, useMemo, useState } from 'react';
import { ArrowRight, ClipboardCheck, Clock, Info, Truck, Wallet } from 'lucide-react';
import type { DistancePricingConfig, RepairCategoryTier } from '../../../types';
import type { PublicAvailability, StringProduct } from '../../../types/content';
import {
  beyondFreeText,
  describePickupHours,
  formatDay,
  formatInr,
  formatKm,
  hasPrice,
  inStockCount,
  localIsoDate,
  productLabel,
  sortedVariants,
} from './format';
import { SECTION_IDS, useShop } from './shop';
import { Select, SectionHeader, WhatsAppIcon, btn, container, cx, fieldControl, fieldHint, fieldLabel } from './ui';

export type BookingService = 'stringing' | 'repair';

export interface StringingRequest {
  brand: string;
  model: string;
  stringName: string;
  colour: string;
  tension?: number;
  pickupDate: string;
}

export interface RepairRequest {
  brand: string;
  model: string;
  category: string;
  notes: string;
  pickupDate: string;
}

export interface BookingPreset {
  service: BookingService;
  stringName?: string;
  colour?: string;
  nonce: number;
}

const BRANDS = ['Yonex', 'Li-Ning', 'Victor', 'Apacs', 'Hundred'];
const OTHER_BRAND = 'Other';
const OWN_STRING = '__own__';
const TENSIONS = Array.from({ length: 15 }, (_, i) => 18 + i); // 18–32 lbs

/** A few common models per brand, offered as suggestions only (any text is accepted). */
const MODEL_SUGGESTIONS: Record<string, string[]> = {
  Yonex: ['Astrox 88D Pro', 'Astrox 99 Pro', 'Astrox 77 Pro', 'Nanoflare 1000Z', 'Nanoflare 800 Pro', 'Arcsaber 11 Pro', 'Voltric Z-Force II'],
  'Li-Ning': ['Axforce 90 Max', 'Axforce 80', 'Tectonic 9', 'Halbertec 8000', 'Windstorm 72'],
  Victor: ['Thruster Ryuga II Pro', 'Auraspeed 100X', 'DriveX 9X', 'Brave Sword 12'],
  Apacs: ['Z-Ziggler', 'Dual 100', 'Commander 80'],
  Hundred: ['Atomic X Vigor', 'Battle 600', 'N-Power 700'],
};

interface BookingSectionProps {
  strings: StringProduct[];
  stringsStatus: 'loading' | 'ready' | 'error';
  availability: PublicAvailability | null;
  repairCategories: RepairCategoryTier[];
  distanceConfig: DistancePricingConfig;
  isCustomer: boolean;
  preset: BookingPreset | null;
  onBookStringing: (req: StringingRequest) => void;
  onBookRepair: (req: RepairRequest) => void;
}

export const BookingSection: React.FC<BookingSectionProps> = ({
  strings,
  stringsStatus,
  availability,
  repairCategories,
  distanceConfig,
  isCustomer,
  preset,
  onBookStringing,
  onBookRepair,
}) => {
  const SHOP = useShop();
  const uid = useId();
  const [service, setService] = useState<BookingService>('stringing');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [stringName, setStringName] = useState('');
  const [colour, setColour] = useState('');
  const [tension, setTension] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');

  // ---- availability → pickup days
  const days = useMemo(
    () => [...(availability?.days || [])].sort((a, b) => a.date.localeCompare(b.date)),
    [availability],
  );
  const openDays = days.filter((d) => d.available);
  const hasAvailability = days.length > 0;
  const today = localIsoDate(new Date());

  useEffect(() => {
    if (!hasAvailability) return;
    if (!openDays.some((d) => d.date === pickupDate)) setPickupDate(openDays[0]?.date || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability]);

  // ---- strings
  const product = strings.find((p) => productLabel(p) === stringName);
  const variants = product ? sortedVariants(product) : [];

  useEffect(() => {
    if (!preset) return;
    setService(preset.service);
    if (preset.stringName !== undefined) {
      setStringName(preset.stringName);
      setColour(preset.colour || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset?.nonce]);

  const activeCategories = repairCategories.filter((c) => c.isActive !== false);
  const { days: pickupDays, slots: pickupSlots } = describePickupHours(availability?.settings);
  const notice = (availability?.settings?.notice || '').trim();
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const brandValue = brand === OTHER_BRAND ? '' : brand;
  const racketText = [brandValue, model.trim()].filter(Boolean).join(' ');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (service === 'stringing') {
      onBookStringing({
        brand: brandValue,
        model: model.trim(),
        stringName: stringName === OWN_STRING ? '' : stringName,
        colour: stringName && stringName !== OWN_STRING ? colour : '',
        tension: tension ? Number(tension) : undefined,
        pickupDate,
      });
    } else {
      onBookRepair({ brand: brandValue, model: model.trim(), category, notes: notes.trim(), pickupDate });
    }
  };

  const whatsappMessage = () => {
    const lines =
      service === 'stringing'
        ? [
            SHOP.greeting('I would like to book racket stringing.'),
            racketText && `Racket: ${racketText}`,
            stringName === OWN_STRING ? 'String: my own string' : stringName && `String: ${stringName}${colour ? ` (${colour})` : ''}`,
            tension && `Tension: ${tension} lbs`,
            pickupDate && `Pickup: ${formatDay(pickupDate)}`,
          ]
        : [
            SHOP.greeting('I would like to get my racket repaired.'),
            racketText && `Racket: ${racketText}`,
            category && `Problem: ${category}`,
            notes.trim() && `Details: ${notes.trim()}`,
            pickupDate && `Pickup: ${formatDay(pickupDate)}`,
          ];
    return SHOP.whatsAppLink(lines.filter(Boolean).join('\n'));
  };

  const id = (name: string) => `${uid}-${name}`;

  const pickupField = (
    <div>
      <label htmlFor={id('date')} className={fieldLabel}>
        Pickup day
      </label>
      {hasAvailability ? (
        openDays.length ? (
          <Select id={id('date')} value={pickupDate} onChange={(e) => setPickupDate(e.target.value)}>
            {openDays.map((d) => (
              <option key={d.date} value={d.date}>
                {formatDay(d.date)}
                {d.date === today ? ' (today)' : ''}
                {typeof d.remaining === 'number' && d.remaining > 0 && d.remaining <= 3
                  ? ` · ${d.remaining} ${d.remaining === 1 ? 'pickup' : 'pickups'} left`
                  : ''}
              </option>
            ))}
          </Select>
        ) : (
          <p className="rounded-xl border border-line bg-paper px-3.5 py-3 text-[14px] text-ink-soft">
            No pickup days are open right now. Please call{' '}
            <a href={SHOP.phoneTel} className="font-semibold text-sportsBlue underline underline-offset-2">
              {SHOP.phoneDisplay}
            </a>
            .
          </p>
        )
      ) : (
        <input
          id={id('date')}
          type="date"
          min={today}
          value={pickupDate}
          onChange={(e) => setPickupDate(e.target.value)}
          className={fieldControl}
        />
      )}
      {pickupSlots && hasAvailability && openDays.length > 0 && <p className={fieldHint}>Pickup slots: {pickupSlots}. You pick one next.</p>}
    </div>
  );

  return (
    <section id={SECTION_IDS.book} aria-labelledby={`${uid}-title`} className="scroll-mt-20 bg-paper py-16 sm:py-20">
      <div className={cx(container, 'grid gap-10 lg:grid-cols-12 lg:gap-12')}>
        <div className="lg:col-span-5">
          <SectionHeader
            id={`${uid}-title`}
            title="Book a pickup in a minute"
            intro="Tell us what your racket needs. We collect it from your door, do the work in our shop and bring it back."
          />
          <ul className="mt-8 space-y-4 text-[15px] text-ink-soft">
            <li className="flex gap-3">
              <Truck className="mt-0.5 h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
              <span>
                <span className="font-semibold text-ink">Free pickup and delivery within {formatKm(distanceConfig.freeRadiusKm)}</span> of the
                shop. {beyondFreeText(distanceConfig)}
              </span>
            </li>
            {pickupDays && (
              <li className="flex gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
                <span>
                  Pickups {pickupDays}
                  {pickupSlots ? `, ${pickupSlots}` : ''}.
                </span>
              </li>
            )}
            <li className="flex gap-3">
              <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
              <span>Pay when your racket comes back, in cash or by UPI.</span>
            </li>
            <li className="flex gap-3">
              <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
              <span>For repairs we inspect the racket first and send you an estimate. Nothing is repaired until you approve it.</span>
            </li>
          </ul>
        </div>

        <div className="lg:col-span-7">
          <form onSubmit={submit} className="rounded-xl border border-line bg-white p-5 sm:p-8 shadow-[0_1px_2px_rgba(15,27,43,0.04)]" noValidate>
            {notice && !noticeDismissed && (
              <div role="status" className="mb-6 flex items-start gap-3 rounded-xl border border-[#EBD9A6] bg-[#FFF8E1] px-4 py-3 text-[14px] text-[#5C4300]">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p className="flex-1">{notice}</p>
                <button
                  type="button"
                  onClick={() => setNoticeDismissed(true)}
                  className="-my-2 -mr-2 inline-flex h-9 min-w-[44px] items-center justify-center rounded-lg text-[13px] font-semibold underline underline-offset-2"
                >
                  Hide
                </button>
              </div>
            )}

            <fieldset>
              <legend className="sr-only">What do you need?</legend>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-paper p-1">
                {(
                  [
                    ['stringing', 'Stringing'],
                    ['repair', 'Repair'],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className={cx(
                      'flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg text-[15px] font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sportsBlue',
                      service === value ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                    )}
                  >
                    <input
                      type="radio"
                      name={`${uid}-service`}
                      value={value}
                      checked={service === value}
                      onChange={() => setService(value)}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor={id('brand')} className={fieldLabel}>
                  Racket brand
                </label>
                <Select id={id('brand')} value={brand} onChange={(e) => setBrand(e.target.value)}>
                  <option value="">Choose brand</option>
                  {BRANDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                  <option value={OTHER_BRAND}>Other brand</option>
                </Select>
              </div>
              <div>
                <label htmlFor={id('model')} className={fieldLabel}>
                  Model <span className="font-normal text-ink-muted">(optional)</span>
                </label>
                <input
                  id={id('model')}
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  maxLength={80}
                  list={MODEL_SUGGESTIONS[brand] ? id('models') : undefined}
                  placeholder="e.g. Astrox 88D Pro"
                  autoComplete="off"
                  className={fieldControl}
                />
                {MODEL_SUGGESTIONS[brand] && (
                  <datalist id={id('models')}>
                    {MODEL_SUGGESTIONS[brand].map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                )}
              </div>

              {service === 'stringing' ? (
                <>
                  <div>
                    <label htmlFor={id('string')} className={fieldLabel}>
                      String
                    </label>
                    <Select
                      id={id('string')}
                      value={stringName}
                      onChange={(e) => {
                        setStringName(e.target.value);
                        setColour('');
                      }}
                      disabled={stringsStatus === 'loading'}
                    >
                      <option value="">{stringsStatus === 'loading' ? 'Loading strings…' : 'Choose later'}</option>
                      {strings.map((p) => {
                        const label = productLabel(p);
                        const out = inStockCount(p) === 0;
                        return (
                          <option key={p.id} value={label} disabled={out}>
                            {label}
                            {p.gauge ? ` · ${p.gauge}` : ''}
                            {hasPrice(p.price) ? ` · ${formatInr(p.price)}` : ''}
                            {out ? ' (out of stock)' : ''}
                          </option>
                        );
                      })}
                      <option value={OWN_STRING}>I'll give my own string</option>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor={id('colour')} className={fieldLabel}>
                      Colour
                    </label>
                    <Select id={id('colour')} value={colour} onChange={(e) => setColour(e.target.value)} disabled={!variants.length}>
                      <option value="">{variants.length ? 'No preference' : 'Choose a string first'}</option>
                      {variants.map((v) => (
                        <option key={v.id} value={v.colour} disabled={!v.inStock}>
                          {v.colour}
                          {v.inStock ? '' : ' (out of stock)'}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label htmlFor={id('tension')} className={fieldLabel}>
                      Tension
                    </label>
                    <Select id={id('tension')} value={tension} onChange={(e) => setTension(e.target.value)}>
                      <option value="">Not sure, advise me</option>
                      {TENSIONS.map((t) => (
                        <option key={t} value={t}>
                          {t} lbs
                        </option>
                      ))}
                    </Select>
                  </div>
                  {pickupField}
                </>
              ) : (
                <>
                  <div className="sm:col-span-2">
                    <label htmlFor={id('category')} className={fieldLabel}>
                      What needs fixing?
                    </label>
                    <Select id={id('category')} value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="">Not sure, we'll check</option>
                      {activeCategories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                          {c.basePrice > 0 ? ` · from ${formatInr(c.basePrice)}` : ''}
                        </option>
                      ))}
                    </Select>
                    <p className={fieldHint}>Prices are starting prices. The final price comes with the estimate, after inspection.</p>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={id('notes')} className={fieldLabel}>
                      What happened? <span className="font-normal text-ink-muted">(optional)</span>
                    </label>
                    <textarea
                      id={id('notes')}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      maxLength={500}
                      placeholder="e.g. Crack near the top after a clash in doubles"
                      className={cx(fieldControl, 'py-2.5 leading-relaxed')}
                    />
                  </div>
                  {pickupField}
                </>
              )}
            </div>

            <div className="mt-7 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[14px] leading-relaxed text-ink-muted sm:max-w-[330px]">
                {isCustomer
                  ? 'Next, confirm your address and pickup slot. Nothing is booked until you confirm.'
                  : "Next, log in with your mobile number, add your address and confirm. Nothing is booked until you confirm."}
              </p>
              <button type="submit" className={cx(btn.base, btn.primary, 'px-6 sm:shrink-0')}>
                Continue
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-1 text-[14px] text-ink-muted">
              Prefer WhatsApp?{' '}
              <a
                href={whatsappMessage()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-1 font-semibold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
              >
                <WhatsAppIcon className="h-4 w-4 text-[#128C4B]" />
                Send these details
              </a>
            </p>
          </form>
        </div>
      </div>
    </section>
  );
};
