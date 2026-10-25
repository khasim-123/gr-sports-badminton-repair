import React, { useEffect, useMemo, useState } from 'react';
import type { PublicAvailability } from '../../../types/content';
import { describePickupHours, formatDay, localIsoDate } from './format';
import { useShop } from './shop';
import { Select, fieldControl, fieldHint, fieldLabel } from './ui';

/** Fields shared by the homepage booking form and the "Book with this string" dialog. */

export const BRANDS = ['Yonex', 'Li-Ning', 'Victor', 'Apacs', 'Hundred'];
export const OTHER_BRAND = 'Other';
export const TENSIONS = Array.from({ length: 15 }, (_, i) => 18 + i); // 18–32 lbs

/** A few common models per brand, offered as suggestions only (any text is accepted). */
const MODEL_SUGGESTIONS: Record<string, string[]> = {
  Yonex: ['Astrox 88D Pro', 'Astrox 99 Pro', 'Astrox 77 Pro', 'Nanoflare 1000Z', 'Nanoflare 800 Pro', 'Arcsaber 11 Pro', 'Voltric Z-Force II'],
  'Li-Ning': ['Axforce 90 Max', 'Axforce 80', 'Tectonic 9', 'Halbertec 8000', 'Windstorm 72'],
  Victor: ['Thruster Ryuga II Pro', 'Auraspeed 100X', 'DriveX 9X', 'Brave Sword 12'],
  Apacs: ['Z-Ziggler', 'Dual 100', 'Commander 80'],
  Hundred: ['Atomic X Vigor', 'Battle 600', 'N-Power 700'],
};

/** "Other brand" is sent as an empty brand. */
export function brandValue(brand: string): string {
  return brand === OTHER_BRAND ? '' : brand;
}

/** Racket brand (select) + model (free text with suggestions). Renders two grid cells. */
export const RacketFields: React.FC<{
  idPrefix: string;
  brand: string;
  model: string;
  onBrand: (value: string) => void;
  onModel: (value: string) => void;
}> = ({ idPrefix, brand, model, onBrand, onModel }) => {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <>
      <div>
        <label htmlFor={id('brand')} className={fieldLabel}>
          Racket brand
        </label>
        <Select id={id('brand')} value={brand} onChange={(e) => onBrand(e.target.value)}>
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
          Racket model <span className="font-normal text-ink-muted">(optional)</span>
        </label>
        <input
          id={id('model')}
          type="text"
          value={model}
          onChange={(e) => onModel(e.target.value)}
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
    </>
  );
};

export const TensionField: React.FC<{ id: string; value: string; onChange: (value: string) => void }> = ({ id, value, onChange }) => (
  <div>
    <label htmlFor={id} className={fieldLabel}>
      Tension
    </label>
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Not sure, advise me</option>
      {TENSIONS.map((t) => (
        <option key={t} value={t}>
          {t} lbs
        </option>
      ))}
    </Select>
  </div>
);

/** Pickup day state: defaults to the first open day once availability arrives. */
export function usePickupDay(availability: PublicAvailability | null) {
  const [pickupDate, setPickupDate] = useState('');
  const days = useMemo(() => [...(availability?.days || [])].sort((a, b) => a.date.localeCompare(b.date)), [availability]);
  const openDays = days.filter((d) => d.available);
  const hasAvailability = days.length > 0;

  useEffect(() => {
    if (!hasAvailability) return;
    if (!openDays.some((d) => d.date === pickupDate)) setPickupDate(openDays[0]?.date || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability]);

  return { pickupDate, setPickupDate, openDays, hasAvailability };
}

export const PickupDayField: React.FC<{
  id: string;
  availability: PublicAvailability | null;
  pickup: ReturnType<typeof usePickupDay>;
}> = ({ id, availability, pickup }) => {
  const SHOP = useShop();
  const { pickupDate, setPickupDate, openDays, hasAvailability } = pickup;
  const today = localIsoDate(new Date());
  const { slots } = describePickupHours(availability?.settings);
  return (
    <div>
      <label htmlFor={id} className={fieldLabel}>
        Pickup day
      </label>
      {hasAvailability ? (
        openDays.length ? (
          <Select id={id} value={pickupDate} onChange={(e) => setPickupDate(e.target.value)}>
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
        <input id={id} type="date" min={today} value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className={fieldControl} />
      )}
      {slots && hasAvailability && openDays.length > 0 && <p className={fieldHint}>Pickup slots: {slots}. You pick one next.</p>}
    </div>
  );
};
