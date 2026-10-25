import React, { useId, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { PublicAvailability, StringProduct } from '../../../types/content';
import type { StringingRequest } from './BookingSection';
import { PickupDayField, RacketFields, TensionField, brandValue, usePickupDay } from './bookingFields';
import { Dialog } from './Dialog';
import { formatDay, productLabel, safeImageUrl, sortedVariants } from './format';
import { useShop } from './shop';
import { Swatch } from './StringsSection';
import { WhatsAppIcon, btn, cx } from './ui';

export interface StringBookingRequest {
  product: StringProduct;
  colour?: string;
}

interface StringBookingDialogProps {
  request: StringBookingRequest | null;
  availability: PublicAvailability | null;
  isCustomer: boolean;
  onClose: () => void;
  onContinue: (req: StringingRequest) => void;
}

/**
 * "Book with this string" from a string card: opens over the catalogue (no jump back to the
 * booking form at the top), shows the chosen string and colour, and asks only for the rest.
 */
export const StringBookingDialog: React.FC<StringBookingDialogProps> = ({ request, onClose, ...rest }) => (
  <Dialog
    open={!!request}
    onClose={onClose}
    size="md"
    title="Book stringing"
    description="Your string is chosen. Tell us about your racket and when to pick it up."
  >
    {request && <StringBookingForm key={`${request.product.id}-${request.colour || ''}`} request={request} {...rest} />}
  </Dialog>
);

const StringBookingForm: React.FC<Omit<StringBookingDialogProps, 'request' | 'onClose'> & { request: StringBookingRequest }> = ({
  request,
  availability,
  isCustomer,
  onContinue,
}) => {
  const SHOP = useShop();
  const uid = useId();
  const p = request.product;
  const label = productLabel(p);
  const variants = sortedVariants(p);
  const [colourId, setColourId] = useState<string | undefined>(
    () => (variants.find((v) => v.inStock && v.colour === request.colour) || variants.find((v) => v.inStock))?.id,
  );
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [tension, setTension] = useState('');
  const pickup = usePickupDay(availability);

  const selected = variants.find((v) => v.id === colourId);
  const imageVariant = selected && safeImageUrl(selected.imageUrl) ? selected : variants.find((v) => safeImageUrl(v.imageUrl));
  const image = imageVariant ? safeImageUrl(imageVariant.imageUrl) : null;
  const colour = selected?.colour || '';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onContinue({
      brand: brandValue(brand),
      model: model.trim(),
      stringName: label,
      colour,
      tension: tension ? Number(tension) : undefined,
      pickupDate: pickup.pickupDate,
    });
  };

  const racketText = [brandValue(brand), model.trim()].filter(Boolean).join(' ');
  const whatsapp = SHOP.whatsAppLink(
    [
      SHOP.greeting('I would like to book racket stringing.'),
      racketText && `Racket: ${racketText}`,
      `String: ${label}${colour ? ` (${colour})` : ''}`,
      tension && `Tension: ${tension} lbs`,
      pickup.pickupDate && `Pickup: ${formatDay(pickup.pickupDate)}`,
    ]
      .filter(Boolean)
      .join('\n'),
  );

  return (
    <form onSubmit={submit} noValidate>
      <section aria-labelledby={`${uid}-string`} className="flex gap-4 rounded-xl border border-line bg-paper p-3.5">
        <div className="relative h-[92px] w-[76px] shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-line">
          {image ? (
            <img src={image} alt="" className="absolute inset-0 h-full w-full object-contain" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center px-1 text-center text-[12px] text-ink-muted">No photo</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-ink-muted">
            Your string · {p.brand}
            {p.gauge ? ` · ${p.gauge}` : ''}
          </p>
          <p id={`${uid}-string`} className="font-display text-[22px] font-semibold leading-tight text-ink">
            {p.name}
          </p>
          {variants.length > 0 && (
            <>
              <div role="group" aria-label={`${label} colours`} className="-ml-2 mt-1 flex flex-wrap sm:-ml-1 sm:gap-1">
                {variants.map((v) => (
                  <Swatch key={v.id} variant={v} selected={v.id === colourId} onSelect={() => setColourId(v.id)} />
                ))}
              </div>
              <p className="mt-0.5 text-[14px] text-ink-soft">{colour ? `Colour: ${colour}` : 'Choose a colour'}</p>
            </>
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <RacketFields idPrefix={uid} brand={brand} model={model} onBrand={setBrand} onModel={setModel} />
        <TensionField id={`${uid}-tension`} value={tension} onChange={setTension} />
        <PickupDayField id={`${uid}-date`} availability={availability} pickup={pickup} />
      </div>

      <div className="mt-7 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[14px] leading-relaxed text-ink-muted sm:max-w-[300px]">
          {isCustomer
            ? 'Next, confirm your address and pickup slot. Nothing is booked until you confirm.'
            : 'Next, log in with your mobile number, add your address and confirm. Nothing is booked until you confirm.'}
        </p>
        <button type="submit" className={cx(btn.base, btn.primary, 'px-6 sm:shrink-0')}>
          Continue
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-1 text-[14px] text-ink-muted">
        Prefer WhatsApp?{' '}
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-1 font-semibold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
        >
          <WhatsAppIcon className="h-4 w-4 text-[#128C4B]" />
          Send these details
        </a>
      </p>
    </form>
  );
};
