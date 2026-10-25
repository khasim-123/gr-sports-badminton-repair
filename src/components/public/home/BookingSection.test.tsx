import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHOP_SETTINGS, primeShopSettings } from '../../../hooks/useShopSettings';
import { makeAvailability, makeStringProduct, makeVariant } from '../../../test/fixtures';
import type { DistancePricingConfig, RepairCategoryTier } from '../../../types';
import type { PublicAvailability, StringProduct } from '../../../types/content';
import { BookingSection, type BookingPreset } from './BookingSection';

beforeAll(() => {
  primeShopSettings(DEFAULT_SHOP_SETTINGS);
});

const distanceConfig: DistancePricingConfig = {
  shopLocationName: 'GR Sports, Dondaparthy',
  shopLat: 17.7287,
  shopLng: 83.3015,
  freeRadiusKm: 15,
  perKmRateBeyondFree: 15,
  pricingMethod: 'PER_KM',
  maxServiceDistanceKm: 40,
  slabs: [],
};

const repairCategories: RepairCategoryTier[] = [
  { id: 'rc-frame', name: 'Frame crack', basePrice: 1200, turnaround: '5 days', description: '', slaDays: 5, isActive: true },
  { id: 'rc-grommet', name: 'Grommet replacement', basePrice: 150, turnaround: '1 day', description: '', slaDays: 1 },
  { id: 'rc-old', name: 'Old category', basePrice: 0, turnaround: '', description: '', slaDays: 0, isActive: false },
];

const strings: StringProduct[] = [
  makeStringProduct(),
  makeStringProduct({
    id: 'str-aero',
    brand: 'Yonex',
    name: 'Aerobite',
    gauge: null,
    price: null,
    variants: [makeVariant({ id: 'v-aero', productId: 'str-aero', colour: 'White/Red', inStock: false })],
    inStockCount: 0,
  }),
];

const availability = makeAvailability(
  [
    { date: '2030-01-06', available: false, reason: 'Sunday' },
    { date: '2030-01-07', available: true },
    { date: '2030-01-08', available: true },
  ],
  { notice: 'Closed on 15 Jan for Sankranti.' },
);

function renderSection(props: { availability?: PublicAvailability | null; preset?: BookingPreset | null; stringsStatus?: 'loading' | 'ready' | 'error' } = {}) {
  const onBookStringing = vi.fn();
  const onBookRepair = vi.fn();
  const user = userEvent.setup();
  const view = (p: typeof props) => (
    <BookingSection
      strings={strings}
      stringsStatus={p.stringsStatus ?? 'ready'}
      availability={p.availability === undefined ? availability : p.availability}
      repairCategories={repairCategories}
      distanceConfig={distanceConfig}
      isCustomer={false}
      preset={p.preset ?? null}
      onBookStringing={onBookStringing}
      onBookRepair={onBookRepair}
    />
  );
  const utils = render(view(props));
  return { user, onBookStringing, onBookRepair, rerender: (p: typeof props) => utils.rerender(view(p)) };
}

const continueButton = () => screen.getByRole('button', { name: 'Continue' });

describe('BookingSection', () => {
  it('starts on Stringing with the string, colour and tension fields', () => {
    renderSection();

    expect(screen.getByRole('heading', { name: 'Book a pickup in a minute' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Stringing' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Repair' })).not.toBeChecked();
    expect(screen.getByLabelText('String')).toBeInTheDocument();
    expect(screen.getByLabelText('Colour')).toBeDisabled();
    expect(screen.getByLabelText('Tension')).toBeInTheDocument();
    expect(screen.queryByLabelText('What needs fixing?')).not.toBeInTheDocument();
    expect(screen.getByText(/Free pickup and delivery within 15 km/)).toBeInTheDocument();
    expect(screen.getByText(/Beyond that it's ₹15 per km\./)).toBeInTheDocument();
  });

  it('the Stringing / Repair toggle swaps the fields', async () => {
    const { user } = renderSection();

    await user.click(screen.getByRole('radio', { name: 'Repair' }));

    expect(screen.getByRole('radio', { name: 'Repair' })).toBeChecked();
    expect(screen.getByLabelText('What needs fixing?')).toBeInTheDocument();
    expect(screen.getByLabelText(/What happened\?/)).toBeInTheDocument();
    expect(screen.queryByLabelText('String')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Colour')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Tension')).not.toBeInTheDocument();
    // Racket and pickup day are asked for both services.
    expect(screen.getByLabelText('Racket brand')).toBeInTheDocument();
    expect(screen.getByLabelText('Pickup day')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Stringing' }));
    expect(screen.getByLabelText('String')).toBeInTheDocument();
    expect(screen.queryByLabelText('What needs fixing?')).not.toBeInTheDocument();
  });

  it('preselects the first open pickup day from the availability', () => {
    renderSection();

    const day = screen.getByLabelText('Pickup day');
    expect(day).toHaveValue('2030-01-07');
    expect(within(day).queryByRole('option', { name: /6 Jan/ })).not.toBeInTheDocument();
  });

  it('lists strings with gauge and price, and marks out-of-stock strings and colours', async () => {
    const { user } = renderSection();

    const stringSelect = screen.getByLabelText('String');
    expect(within(stringSelect).getByRole('option', { name: 'Yonex BG 65 Titanium · 0.70 mm · ₹650' })).toBeEnabled();
    expect(within(stringSelect).getByRole('option', { name: 'Yonex Aerobite (out of stock)' })).toBeDisabled();
    expect(within(stringSelect).getByRole('option', { name: "I'll give my own string" })).toBeInTheDocument();

    await user.selectOptions(stringSelect, 'Yonex BG 65 Titanium');
    const colour = screen.getByLabelText('Colour');
    expect(colour).toBeEnabled();
    expect(within(colour).getByRole('option', { name: 'Red (out of stock)' })).toBeDisabled();
    expect(within(colour).getByRole('option', { name: 'Black' })).toBeEnabled();
  });

  it('Continue on Stringing calls onBookStringing with the entered values', async () => {
    const { user, onBookStringing, onBookRepair } = renderSection();

    await user.selectOptions(screen.getByLabelText('Racket brand'), 'Yonex');
    await user.type(screen.getByLabelText(/Racket model/), ' Astrox 88D Pro ');
    await user.selectOptions(screen.getByLabelText('String'), 'Yonex BG 65 Titanium');
    await user.selectOptions(screen.getByLabelText('Colour'), 'Black');
    await user.selectOptions(screen.getByLabelText('Tension'), '24 lbs');
    await user.selectOptions(screen.getByLabelText('Pickup day'), '2030-01-08');
    await user.click(continueButton());

    expect(onBookStringing).toHaveBeenCalledTimes(1);
    expect(onBookStringing).toHaveBeenCalledWith({
      brand: 'Yonex',
      model: 'Astrox 88D Pro',
      stringName: 'Yonex BG 65 Titanium',
      colour: 'Black',
      tension: 24,
      pickupDate: '2030-01-08',
    });
    expect(onBookRepair).not.toHaveBeenCalled();
  });

  it('changing the string clears the colour, and "my own string" sends no string or colour', async () => {
    const { user, onBookStringing } = renderSection();

    await user.selectOptions(screen.getByLabelText('String'), 'Yonex BG 65 Titanium');
    await user.selectOptions(screen.getByLabelText('Colour'), 'White');
    await user.selectOptions(screen.getByLabelText('String'), "I'll give my own string");

    expect(screen.getByLabelText('Colour')).toHaveValue('');
    expect(screen.getByLabelText('Colour')).toBeDisabled();
    await user.click(continueButton());

    expect(onBookStringing).toHaveBeenCalledWith({
      brand: '',
      model: '',
      stringName: '',
      colour: '',
      tension: undefined,
      pickupDate: '2030-01-07',
    });
  });

  it('Continue on Repair calls onBookRepair with the entered values (active categories only)', async () => {
    const { user, onBookStringing, onBookRepair } = renderSection();

    await user.click(screen.getByRole('radio', { name: 'Repair' }));
    const category = screen.getByLabelText('What needs fixing?');
    expect(within(category).getAllByRole('option').map((o) => o.textContent)).toEqual([
      "Not sure, we'll check",
      'Frame crack · from ₹1,200',
      'Grommet replacement · from ₹150',
    ]);

    await user.selectOptions(screen.getByLabelText('Racket brand'), 'Victor');
    await user.type(screen.getByLabelText(/Racket model/), 'Thruster Ryuga II Pro');
    await user.selectOptions(category, 'Frame crack');
    await user.type(screen.getByLabelText(/What happened\?/), '  Crack near the top after a clash  ');
    await user.click(continueButton());

    expect(onBookRepair).toHaveBeenCalledWith({
      brand: 'Victor',
      model: 'Thruster Ryuga II Pro',
      category: 'Frame crack',
      notes: 'Crack near the top after a clash',
      pickupDate: '2030-01-07',
    });
    expect(onBookStringing).not.toHaveBeenCalled();
  });

  it('a preset from elsewhere on the page switches the service (each time it is sent)', async () => {
    const { user, rerender } = renderSection();

    rerender({ preset: { service: 'repair', nonce: 1 } });
    expect(screen.getByRole('radio', { name: 'Repair' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Stringing' }));
    rerender({ preset: { service: 'repair', nonce: 2 } });
    expect(screen.getByRole('radio', { name: 'Repair' })).toBeChecked();
  });

  it('shows the shop notice, which can be hidden', async () => {
    const { user } = renderSection();

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Closed on 15 Jan for Sankranti.');
    await user.click(within(notice).getByRole('button', { name: 'Hide' }));
    expect(screen.queryByText('Closed on 15 Jan for Sankranti.')).not.toBeInTheDocument();
  });

  it('while strings load, the string list is disabled', () => {
    renderSection({ stringsStatus: 'loading' });

    const select = screen.getByLabelText('String');
    expect(select).toBeDisabled();
    expect(within(select).getByRole('option', { name: 'Loading strings…' })).toBeInTheDocument();
  });

  it('the WhatsApp link carries the repair details', async () => {
    const { user } = renderSection();

    await user.click(screen.getByRole('radio', { name: 'Repair' }));
    await user.selectOptions(screen.getByLabelText('What needs fixing?'), 'Frame crack');
    await user.type(screen.getByLabelText(/What happened\?/), 'Cracked frame');

    const href = screen.getByRole('link', { name: 'Send these details' }).getAttribute('href') as string;
    const text = decodeURIComponent(href.split('?text=')[1]);
    expect(text).toContain('Hi GR Sports, I would like to get my racket repaired.');
    expect(text).toContain('Problem: Frame crack');
    expect(text).toContain('Details: Cracked frame');
  });
});
