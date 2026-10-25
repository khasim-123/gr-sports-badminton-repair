import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHOP_SETTINGS, primeShopSettings } from '../../../hooks/useShopSettings';
import { makeAvailability, makeStringProduct } from '../../../test/fixtures';
import type { PublicAvailability } from '../../../types/content';
import { formatDay, formatSlot } from './format';
import { StringBookingDialog, type StringBookingRequest } from './StringBookingDialog';

beforeAll(() => {
  primeShopSettings(DEFAULT_SHOP_SETTINGS);
});

const availability = makeAvailability([
  { date: '2030-01-08', available: true, remaining: null },
  { date: '2030-01-06', available: false, reason: 'Sunday' },
  { date: '2030-01-07', available: true, remaining: 2 },
]);

async function openDialog(
  request: StringBookingRequest | null = { product: makeStringProduct(), colour: 'Black' },
  opts: { availability?: PublicAvailability | null; isCustomer?: boolean } = {},
) {
  const onContinue = vi.fn();
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(
    <StringBookingDialog
      request={request}
      availability={opts.availability === undefined ? availability : opts.availability}
      isCustomer={opts.isCustomer ?? true}
      onClose={onClose}
      onContinue={onContinue}
    />,
  );
  const dialog = screen.getByRole('dialog', { name: 'Book stringing' });
  await waitFor(() => expect(dialog).toHaveFocus());
  return { user, onContinue, onClose, dialog };
}

const colours = () => screen.getByRole('group', { name: 'Yonex BG 65 Titanium colours' });

describe('StringBookingDialog', () => {
  it('shows the chosen string with its brand and gauge, and the passed colour as selected', async () => {
    const { dialog } = await openDialog();

    expect(dialog).toHaveAccessibleDescription('Your string is chosen. Tell us about your racket and when to pick it up.');
    expect(within(dialog).getByText('BG 65 Titanium')).toBeInTheDocument();
    expect(within(dialog).getByText('Your string · Yonex · 0.70 mm')).toBeInTheDocument();

    const group = colours();
    expect(within(group).getByRole('button', { name: 'Black (in stock)' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'White (in stock)' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(dialog).getByText('Colour: Black')).toBeInTheDocument();
  });

  it('out-of-stock colours are disabled and cannot be chosen', async () => {
    const { user } = await openDialog();

    const red = within(colours()).getByRole('button', { name: 'Red (out of stock)' });
    expect(red).toBeDisabled();
    await user.click(red);
    expect(screen.getByText('Colour: Black')).toBeInTheDocument();
  });

  it('falls back to the first colour in stock when the passed colour is sold out', async () => {
    await openDialog({ product: makeStringProduct(), colour: 'Red' });

    expect(within(colours()).getByRole('button', { name: 'White (in stock)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Colour: White')).toBeInTheDocument();
  });

  it('preselects the first open pickup day and lists only open days', async () => {
    await openDialog();

    const day = screen.getByLabelText('Pickup day');
    expect(day).toHaveValue('2030-01-07');
    expect(within(day).getAllByRole('option').map((o) => o.getAttribute('value'))).toEqual(['2030-01-07', '2030-01-08']);
    expect(within(day).getByRole('option', { name: /2 pickups left/ })).toHaveValue('2030-01-07');
    expect(
      screen.getByText(`Pickup slots: ${formatSlot('10:00 - 13:00')} and ${formatSlot('16:00 - 19:00')}. You pick one next.`),
    ).toBeInTheDocument();
  });

  it('Continue sends the racket, the string, the chosen colour, tension and pickup day', async () => {
    const { user, onContinue } = await openDialog();

    await user.click(within(colours()).getByRole('button', { name: 'White (in stock)' }));
    expect(screen.getByText('Colour: White')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Racket brand'), 'Li-Ning');
    await user.type(screen.getByLabelText(/Racket model/), '  Axforce 90 Max ');
    await user.selectOptions(screen.getByLabelText('Tension'), '26 lbs');
    await user.selectOptions(screen.getByLabelText('Pickup day'), '2030-01-08');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledWith({
      brand: 'Li-Ning',
      model: 'Axforce 90 Max',
      stringName: 'Yonex BG 65 Titanium',
      colour: 'White',
      tension: 26,
      pickupDate: '2030-01-08',
    });
  });

  it('"Other brand" and "Not sure" tension are sent as no brand and no tension', async () => {
    const { user, onContinue } = await openDialog();

    await user.selectOptions(screen.getByLabelText('Racket brand'), 'Other brand');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onContinue).toHaveBeenCalledWith({
      brand: '',
      model: '',
      stringName: 'Yonex BG 65 Titanium',
      colour: 'Black',
      tension: undefined,
      pickupDate: '2030-01-07',
    });
  });

  it('offers a WhatsApp message with the same details', async () => {
    const { user } = await openDialog();

    await user.selectOptions(screen.getByLabelText('Racket brand'), 'Yonex');
    await user.type(screen.getByLabelText(/Racket model/), 'Astrox 88D Pro');
    await user.selectOptions(screen.getByLabelText('Tension'), '24');

    const link = screen.getByRole('link', { name: 'Send these details' });
    expect(link).toHaveAttribute('target', '_blank');
    const href = link.getAttribute('href') as string;
    const prefix = 'https://wa.me/917675831496?text=';
    expect(href.startsWith(prefix)).toBe(true);
    expect(decodeURIComponent(href.slice(prefix.length)).split('\n')).toEqual([
      'Hi GR Sports, I would like to book racket stringing.',
      'Racket: Yonex Astrox 88D Pro',
      'String: Yonex BG 65 Titanium (Black)',
      'Tension: 24 lbs',
      `Pickup: ${formatDay('2030-01-07')}`,
    ]);
  });

  it('without availability data the pickup day is a date field from today', async () => {
    await openDialog(undefined, { availability: null });

    const day = screen.getByLabelText('Pickup day');
    expect(day).toHaveAttribute('type', 'date');
    expect(day).toHaveValue('');
  });

  it('when no pickup day is open it asks the customer to call', async () => {
    await openDialog(undefined, { availability: makeAvailability([{ date: '2030-01-06', available: false }]) });

    expect(screen.queryByLabelText('Pickup day')).not.toBeInTheDocument();
    expect(screen.getByText(/No pickup days are open right now/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+91 76758 31496' })).toHaveAttribute('href', 'tel:+917675831496');
  });

  it('tells a visitor who is not logged in that the next step is logging in', async () => {
    await openDialog(undefined, { isCustomer: false });
    expect(screen.getByText(/Next, log in with your mobile number/)).toBeInTheDocument();
  });

  it('the Close button calls onClose', async () => {
    const { user, onClose } = await openDialog();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing without a request', () => {
    render(<StringBookingDialog request={null} availability={null} isCustomer onClose={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
