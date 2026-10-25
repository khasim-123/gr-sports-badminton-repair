import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHOP_SETTINGS, primeShopSettings } from '../../../hooks/useShopSettings';
import { ApiError } from '../../../services/apiClient';
import { contentService } from '../../../services/contentService';
import { makeEvent } from '../../../test/fixtures';
import type { EventRegistration, SiteEvent } from '../../../types/content';
import { EventDialog } from './EventDialog';
import { eventDateText } from './events';

vi.mock('../../../services/contentService', () => ({
  contentService: { registerForEvent: vi.fn(), getShopSettings: vi.fn() },
}));

const registerForEvent = vi.mocked(contentService.registerForEvent);

beforeAll(() => {
  // Use the default shop details without a request to /api/config/shop.
  primeShopSettings(DEFAULT_SHOP_SETTINGS);
});

function registration(overrides: Partial<EventRegistration> = {}): EventRegistration {
  return { id: 'reg-1', eventId: 'evt-1', name: 'Anil Kumar', mobile: '+919876543210', status: 'registered', createdAt: '2026-10-25T10:00:00Z', ...overrides };
}

async function openDialog(event: SiteEvent | null = makeEvent()) {
  const onClose = vi.fn();
  const onRegistered = vi.fn();
  const user = userEvent.setup();
  render(<EventDialog event={event} intent="register" onClose={onClose} onRegistered={onRegistered} />);
  const dialog = await screen.findByRole('dialog', { name: event?.title });
  // The dialog moves focus into itself on the next frame (like in the browser) before anyone types.
  await waitFor(() => expect(dialog).toHaveFocus());
  return { user, onClose, onRegistered, dialog };
}

/** The value shown next to a fact label ("When", "Where", "Entry fee", "Categories"). */
function fact(label: string): HTMLElement {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement;
}

const form = (name = 'Register for this event') => screen.getByRole('form', { name });

async function fillAndRegister(user: ReturnType<typeof userEvent.setup>, opts: { category?: string; name?: string; mobile?: string } = {}) {
  if (opts.category) await user.click(screen.getByRole('radio', { name: opts.category }));
  if (opts.name !== undefined) await user.type(screen.getByLabelText('Your name'), opts.name);
  if (opts.mobile !== undefined) await user.type(screen.getByLabelText('Mobile number'), opts.mobile);
  await user.click(screen.getByRole('button', { name: 'Register' }));
}

describe('EventDialog — website registration form', () => {
  it('shows the event title, date, venue and fee next to the registration form', async () => {
    const { dialog } = await openDialog();

    expect(within(dialog).getByRole('heading', { level: 2, name: 'GR Sports Doubles Open 2026' })).toBeInTheDocument();
    expect(within(dialog).getByText('Tournament')).toBeInTheDocument();
    expect(fact('When')).toHaveTextContent('Saturday, 14 November 2026');
    expect(fact('When')).toHaveTextContent('7:00 AM onwards');
    expect(fact('Where')).toHaveTextContent('S3 Badminton Arena, MVP Colony');
    expect(within(fact('Where')).getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute(
      'href',
      'https://maps.google.com/?q=S3+Badminton+Arena',
    );
    expect(fact('Entry fee')).toHaveTextContent('₹600 per pair');

    const registration = form();
    expect(within(registration).getByText('Registration open · 12 spots left')).toBeInTheDocument();
    expect(within(registration).getByRole('group', { name: 'Which category will you play?' })).toBeInTheDocument();
    expect(within(registration).getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual([
      "Men's Doubles",
      'U-15 Singles',
      'Mixed Doubles',
    ]);
    expect(within(registration).getByLabelText('Your name')).toHaveValue('');
    expect(within(registration).getByLabelText('Mobile number')).toHaveAccessibleDescription('We call this number to confirm.');
    expect(within(registration).getByText('₹600 per pair')).toBeInTheDocument();
    expect(within(registration).getByRole('button', { name: 'Register' })).toBeEnabled();
    // The WhatsApp / call actions are only for events that don't register on the website.
    expect(screen.queryByRole('link', { name: /Register on WhatsApp/ })).not.toBeInTheDocument();
  });

  it('submitting the empty form shows what is missing and does not call the server', async () => {
    const { user } = await openDialog();

    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(screen.getByText('Choose the category you want to play.')).toBeInTheDocument();
    const name = screen.getByLabelText('Your name');
    expect(name).toBeInvalid();
    expect(name).toHaveAccessibleDescription('Please enter your name.');
    const mobile = screen.getByLabelText('Mobile number');
    expect(mobile).toBeInvalid();
    expect(mobile).toHaveAccessibleDescription(expect.stringContaining('Enter a 10-digit Indian mobile number.'));
    expect(screen.queryByText('We call this number to confirm.')).not.toBeInTheDocument();
    // Focus goes to the first problem: the category choice.
    expect(screen.getByRole('radio', { name: "Men's Doubles" })).toHaveFocus();
    expect(registerForEvent).not.toHaveBeenCalled();

    // Choosing a category clears that message.
    await user.click(screen.getByRole('radio', { name: 'U-15 Singles' }));
    expect(screen.queryByText('Choose the category you want to play.')).not.toBeInTheDocument();
  });

  it('rejects a mobile number that is not a 10-digit Indian mobile', async () => {
    const { user } = await openDialog();

    await fillAndRegister(user, { category: 'U-15 Singles', name: 'Anil Kumar', mobile: '12345 67890' });

    expect(screen.getByLabelText('Mobile number')).toHaveAccessibleDescription(expect.stringContaining('Enter a 10-digit Indian mobile number.'));
    expect(screen.getByLabelText('Mobile number')).toHaveFocus();
    expect(registerForEvent).not.toHaveBeenCalled();
  });

  it('lets the mobile field hold a full "+91 98765 43210"', async () => {
    // jsdom doesn't enforce maxLength, so check the limit itself: browsers would cut a 15-character number.
    await openDialog();
    expect(screen.getByLabelText('Mobile number')).toHaveProperty('maxLength', expect.any(Number));
    expect((screen.getByLabelText('Mobile number') as HTMLInputElement).maxLength).toBeGreaterThanOrEqual('+91 98765 43210'.length);
  });

  it("asks for a partner's name only for doubles and mixed categories", async () => {
    const { user } = await openDialog();
    const partner = () => screen.queryByLabelText(/Partner's name/);

    expect(partner()).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: "Men's Doubles" }));
    expect(partner()).toBeInTheDocument();
    expect(screen.getByText("Leave it blank if you don't have a partner yet.")).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'U-15 Singles' }));
    expect(partner()).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Mixed Doubles' }));
    expect(partner()).toBeInTheDocument();
  });

  it('registers the player and confirms with the formatted mobile number and category', async () => {
    let finish!: (r: EventRegistration) => void;
    registerForEvent.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    const event = makeEvent();
    const { user, onRegistered, onClose } = await openDialog(event);

    await user.click(screen.getByRole('radio', { name: "Men's Doubles" }));
    await user.type(screen.getByLabelText(/Partner's name/), '  Ravi Teja ');
    await user.type(screen.getByLabelText('Your name'), '  Anil   Kumar ');
    await user.type(screen.getByLabelText('Mobile number'), '098765 43210');
    await user.type(screen.getByLabelText(/Anything we should know/), 'Club: Vizag Smashers');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    // While the server answers, the button can't be pressed again.
    expect(screen.getByRole('button', { name: 'Registering…' })).toBeDisabled();
    expect(registerForEvent).toHaveBeenCalledTimes(1);
    expect(registerForEvent).toHaveBeenCalledWith('evt-1', {
      name: 'Anil Kumar',
      mobile: '9876543210',
      partnerName: 'Ravi Teja',
      playCategory: "Men's Doubles",
      notes: 'Club: Vizag Smashers',
    });

    finish(registration({ playCategory: "Men's Doubles" }));

    const done = await screen.findByRole('status');
    expect(within(done).getByRole('heading', { name: "You're registered" })).toBeInTheDocument();
    expect(done).toHaveTextContent(
      "Thanks, Anil Kumar. Your entry for GR Sports Doubles Open 2026 is in. We'll call you on +91 98765 43210 to confirm your place.",
    );
    expect(within(done).getByText('Your category')).toBeInTheDocument();
    expect(within(done).getByText("Men's Doubles")).toBeInTheDocument();
    expect(onRegistered).toHaveBeenCalledWith(event);
    expect(screen.queryByRole('form')).not.toBeInTheDocument();

    const doneButton = within(done).getByRole('button', { name: 'Done' });
    expect(doneButton).toHaveFocus();
    await user.click(doneButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('accepts the common ways of writing the mobile number', async () => {
    registerForEvent.mockResolvedValue(registration());
    const { user } = await openDialog(makeEvent({ categories: [] }));

    // No categories: no category question, and no category is sent.
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    await fillAndRegister(user, { name: 'Anil Kumar', mobile: '+91 9876543210' });

    expect(registerForEvent).toHaveBeenCalledWith('evt-1', {
      name: 'Anil Kumar',
      mobile: '9876543210',
      partnerName: undefined,
      playCategory: undefined,
      notes: undefined,
    });
    expect(await screen.findByRole('heading', { name: "You're registered" })).toBeInTheDocument();
    expect(screen.queryByText('Your category')).not.toBeInTheDocument();
    // Nothing left to enter: no "Enter another category".
    expect(screen.queryByRole('button', { name: 'Enter another category' })).not.toBeInTheDocument();
  });

  it('"Enter another category" offers only the categories not entered yet, with the details kept', async () => {
    registerForEvent.mockResolvedValue(registration());
    const { user } = await openDialog();

    await fillAndRegister(user, { category: "Men's Doubles", name: 'Anil Kumar', mobile: '98765 43210' });
    await user.click(await screen.findByRole('button', { name: 'Enter another category' }));

    const second = form('Enter another category');
    expect(within(second).getByText(/Already entered:/)).toHaveTextContent("Already entered: Men's Doubles");
    expect(within(second).getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual(['U-15 Singles', 'Mixed Doubles']);
    expect(within(second).getByLabelText('Your name')).toHaveValue('Anil Kumar');
    expect(within(second).getByLabelText('Mobile number')).toHaveValue('98765 43210');

    await user.click(within(second).getByRole('radio', { name: 'Mixed Doubles' }));
    await user.click(within(second).getByRole('button', { name: 'Register' }));

    expect(registerForEvent).toHaveBeenLastCalledWith('evt-1', expect.objectContaining({ mobile: '9876543210', playCategory: 'Mixed Doubles' }));
    const done = await screen.findByRole('status');
    expect(within(done).getByText('Your categories')).toBeInTheDocument();
    expect(within(done).getByText("Men's Doubles, Mixed Doubles")).toBeInTheDocument();

    // The last category left is chosen for the player.
    await user.click(within(done).getByRole('button', { name: 'Enter another category' }));
    const third = form('Enter another category');
    expect(within(third).getByRole('group', { name: 'Category' })).toBeInTheDocument();
    expect(within(third).getByRole('radio', { name: 'U-15 Singles' })).toBeChecked();
    await user.click(within(third).getByRole('button', { name: 'Register' }));

    expect(registerForEvent).toHaveBeenCalledTimes(3);
    expect(registerForEvent).toHaveBeenLastCalledWith('evt-1', expect.objectContaining({ playCategory: 'U-15 Singles' }));
    expect(await screen.findByText("Men's Doubles, Mixed Doubles, U-15 Singles")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enter another category' })).not.toBeInTheDocument();
  });

  it('shows the server error message in an alert and keeps the form', async () => {
    registerForEvent.mockRejectedValue(new ApiError('This mobile number is already registered for U-15 Singles.', 409));
    const { user } = await openDialog();

    await fillAndRegister(user, { category: 'U-15 Singles', name: 'Anil Kumar', mobile: '98765 43210' });

    expect(await screen.findByRole('alert')).toHaveTextContent('This mobile number is already registered for U-15 Singles.');
    expect(screen.getByRole('button', { name: 'Register' })).toBeEnabled();
    expect(screen.getByLabelText('Your name')).toHaveValue('Anil Kumar');
    expect(screen.queryByRole('heading', { name: "You're registered" })).not.toBeInTheDocument();
  });

  it.each([
    [new ApiError('Unable to reach the server', 0), "We couldn't reach the GR Sports server. Check your connection and try again, or call +91 76758 31496."],
    [new ApiError('Too many requests', 429), 'Too many attempts from this device. Please wait a few minutes, or call +91 76758 31496 to register.'],
    [new Error(''), 'Registration failed. Please try again.'],
  ])('explains a failed request in plain words (%s)', async (error, message) => {
    registerForEvent.mockRejectedValue(error);
    const { user } = await openDialog();

    await fillAndRegister(user, { category: 'U-15 Singles', name: 'Anil Kumar', mobile: '98765 43210' });

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });
});

describe('EventDialog — other ways to register', () => {
  it('a WhatsApp event opens as one column with a "Register on WhatsApp" link and no form', async () => {
    const event = makeEvent({ registrationMode: 'whatsapp', capacity: null, spotsLeft: null });
    await openDialog(event);

    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();

    const link = screen.getByRole('link', { name: 'Register on WhatsApp' });
    const message = `Hi GR Sports, I'd like to register for GR Sports Doubles Open 2026 (${eventDateText(event)}).`;
    expect(link).toHaveAttribute('href', `https://wa.me/917675831496?text=${encodeURIComponent(message)}`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Registration is open.')).toBeInTheDocument();

    // One column: the categories are listed with the facts, the write-up appears once.
    expect(fact('Categories')).toHaveTextContent("Men's Doubles, U-15 Singles, Mixed Doubles");
    expect(fact('Entry fee')).toHaveTextContent('₹600 per pair');
    expect(screen.getAllByRole('heading', { name: 'About this event' })).toHaveLength(1);
  });

  it('a phone event shows "Call to register" with the shop number', async () => {
    await openDialog(makeEvent({ registrationMode: 'phone', registrationDeadline: '2026-11-10' }));

    expect(screen.getByRole('link', { name: 'Call to register' })).toHaveAttribute('href', 'tel:+917675831496');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('a full website event says all places are taken instead of showing the form', async () => {
    await openDialog(makeEvent({ registrationOpen: false, spotsLeft: 0 }));

    expect(screen.getByText('All places have been taken.')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Register/ })).not.toBeInTheDocument();
  });

  it('an event without registration says so', async () => {
    await openDialog(makeEvent({ registrationMode: 'none', entryFee: null }));

    expect(screen.getByText('No registration needed.')).toBeInTheDocument();
    expect(fact('Entry fee')).toHaveTextContent('Free entry');
  });
});

describe('EventDialog — closing', () => {
  it('closes with the Close button and with Escape', async () => {
    const { user, onClose } = await openDialog();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders nothing without an event', () => {
    render(<EventDialog event={null} intent="details" onClose={vi.fn()} onRegistered={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
