import React, { useEffect, useId, useState } from 'react';
import { ArrowRight, ClipboardCheck, Clock, Info, Truck, Wallet } from 'lucide-react';
import type { DistancePricingConfig, RepairCategoryTier } from '../../../types';
import type { PublicAvailability, StringProduct } from '../../../types/content';
import { PickupDayField, RacketFields, TensionField, brandValue, usePickupDay } from './bookingFields';
import {
  beyondFreeText,
  describePickupHours,
  formatDay,
  formatInr,
  formatKm,
  hasPrice,
  inStockCount,
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
  nonce: number;
}

const OWN_STRING = '__own__';

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
  /** Only the form, without the heading and the notes beside it (homepage, GR website map). */
  formOnly?: boolean;
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
  formOnly,
}) => {
  const SHOP = useShop();
  const uid = useId();
  const [service, setService] = useState<BookingService>('stringing');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [stringName, setStringName] = useState('');
  const [colour, setColour] = useState('');
  const [tension, setTension] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const pickup = usePickupDay(availability);
  const { pickupDate } = pickup;

  // ---- strings
  const product = strings.find((p) => productLabel(p) === stringName);
  const variants = product ? sortedVariants(product) : [];

  useEffect(() => {
    if (!preset) return;
    setService(preset.service);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset?.nonce]);

  const activeCategories = repairCategories.filter((c) => c.isActive !== false);
  const { days: pickupDays, slots: pickupSlots } = describePickupHours(availability?.settings);
  const notice = (availability?.settings?.notice || '').trim();
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const racketText = [brandValue(brand), model.trim()].filter(Boolean).join(' ');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (service === 'stringing') {
      onBookStringing({
        brand: brandValue(brand),
        model: model.trim(),
        stringName: stringName === OWN_STRING ? '' : stringName,
        colour: stringName && stringName !== OWN_STRING ? colour : '',
        tension: tension ? Number(tension) : undefined,
        pickupDate,
      });
    } else {
      onBookRepair({ brand: brandValue(brand), model: model.trim(), category, notes: notes.trim(), pickupDate });
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

  const pickupField = <PickupDayField id={id('date')} availability={availability} pickup={pickup} />;

  return (
    <section id={SECTION_IDS.book} aria-labelledby={`${uid}-title`} className={cx('scroll-mt-20 bg-paper', formOnly ? 'py-8 sm:py-10' : 'py-10 sm:py-14')}>
      <div className={cx(container, !formOnly && 'grid gap-8 lg:grid-cols-12 lg:gap-12')}>
        {formOnly ? (
          <h2 id={`${uid}-title`} className="sr-only">
            Book stringing or a repair
          </h2>
        ) : (
        <div className="lg:col-span-5">
          <SectionHeader
            id={`${uid}-title`}
            title="Book a pickup in a minute"
            intro="Tell us what your racket needs. We collect it from your door, do the work in our shop and bring it back."
          />
          <ul className="mt-6 space-y-4 text-[15px] text-ink-soft">
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
        )}

        <div className={formOnly ? 'mx-auto max-w-4xl' : 'lg:col-span-7'}>
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
              <RacketFields idPrefix={uid} brand={brand} model={model} onBrand={setBrand} onModel={setModel} />

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
                  <TensionField id={id('tension')} value={tension} onChange={setTension} />
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
