import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHOP_SETTINGS, primeShopSettings } from '../../hooks/useShopSettings';
import { ApiError } from '../../services/apiClient';
import { courtService } from '../../services/courtService';
import type { CourtBooking, CourtVenue } from '../../types/courts';
import { BookingDialog, type BookingDraft } from './BookingDialog';
import { formatDateLong } from './courtFormat';

vi.mock('../../services/courtService', () => ({ courtService: { book: vi.fn() } }));
const book = vi.mocked(courtService.book);

beforeAll(() => {
  primeShopSettings(DEFAULT_SHOP_SETTINGS);
});

const venue = {
  id: 'ven-1',
  name: 'GR Sports Courts',
  address: 'Dondaparthy, Visakhapatnam',
  cancellationHours: 12,
} as CourtVenue;

const draft: BookingDraft = { venue, courtId: 'c1', courtName: 'Court 1', date: '2026-11-14', startTime: '18:00', endTime: '20:00', slots: 2, price: 800 };

const booked: CourtBooking = {
  id: 'CRT-48213',
  venueId: 'ven-1',
  venueName: 'GR Sports Courts',
  courtId: 'c1',
  courtName: 'Court 1',
  date: '2026-11-14',
  startTime: '18:00',
  endTime: '20:00',
  slots: 2,
  price: 800,
  customerName: 'Anil Kumar',
  customerMobile: '+919876543210',
  status: 'Confirmed',
  paymentStatus: 'Pending',
  bookedBy: 'customer',
  canCancel: true,
  createdAt: '2026-10-25T10:00:00Z',
  timeline: [],
};

async function openDialog() {
  const props = { onClose: vi.fn(), onBooked: vi.fn(), onConflict: vi.fn(), onOpenProfile: vi.fn(), onOpenMyBookings: vi.fn() };
  const user = userEvent.setup();
  render(<BookingDialog draft={draft} {...props} />);
  const dialog = screen.getByRole('dialog', { name: 'Book this court' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm booking' })).toHaveFocus());
  return { user, dialog, ...props };
}

/** The value next to a label in the dialog's summary list. */
const row = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement;

describe('Court BookingDialog', () => {
  it('summarises the court, time and price to pay at the venue', async () => {
    const { dialog } = await openDialog();

    expect(dialog).toHaveAccessibleDescription(`Court 1 · ${formatDateLong('2026-11-14')} · 6:00–8:00 PM`);
    expect(row('Court')).toHaveTextContent('Court 1\, GR Sports Courts');
    expect(row('When')).toHaveTextContent(`${formatDateLong('2026-11-14')}, 6:00–8:00 PM`);
    expect(row('To pay at the venue')).toHaveTextContent('₹800');
    expect(screen.getByText('Pay at the venue — cash or UPI. Cancel free until 12 hours before the start.')).toBeInTheDocument();
  });

  it('books with the chosen number of players and note, then confirms', async () => {
    let finish!: (b: CourtBooking) => void;
    book.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    const { user, onBooked, onOpenMyBookings, onClose } = await openDialog();

    const players = screen.getByRole('group', { name: /How many players\?/ });
    await user.click(within(players).getByRole('button', { name: '4' }));
    await user.click(within(players).getByRole('button', { name: '2' }));
    expect(within(players).getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(players).getByRole('button', { name: '4' })).toHaveAttribute('aria-pressed', 'false');
    await user.type(screen.getByRole('textbox', { name: /Note for us/ }), '  We need to borrow rackets ');
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));

    expect(screen.getByRole('button', { name: 'Booking…' })).toBeDisabled();
    expect(book).toHaveBeenCalledWith({
      venueId: 'ven-1',
      courtId: 'c1',
      date: '2026-11-14',
      startTime: '18:00',
      slots: 2,
      players: 2,
      notes: 'We need to borrow rackets',
    });

    finish(booked);
    const confirmation = await screen.findByRole('dialog', { name: 'Court booked' });
    expect(onBooked).toHaveBeenCalledWith(booked);
    expect(within(confirmation).getByText('CRT-48213')).toBeInTheDocument();
    expect(row('Time')).toHaveTextContent('6:00–8:00 PM');
    expect(row('Price')).toHaveTextContent('₹800');
    expect(within(confirmation).getByText(/Cancel free until 12 hours before the start, from My bookings\./)).toBeInTheDocument();
    const done = within(confirmation).getByRole('button', { name: 'Done' });
    await waitFor(() => expect(done).toHaveFocus());

    await user.click(within(confirmation).getByRole('button', { name: 'My bookings' }));
    expect(onOpenMyBookings).toHaveBeenCalledWith('CRT-48213');
    await user.click(done);
    expect(onClose).toHaveBeenCalled();
  });

  it('"Add to calendar" downloads an .ics file for the booking', async () => {
    book.mockResolvedValue(booked);
    // jsdom has no object URLs; record what would be downloaded instead.
    const original = { createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL };
    const createObjectURL = vi.fn((_: Blob) => 'blob:booking');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
    try {
      const { user } = await openDialog();

      await user.click(screen.getByRole('button', { name: 'Confirm booking' }));
      await user.click(await screen.findByRole('button', { name: 'Add to calendar' }));

      expect(downloads).toEqual(['CRT-48213.ics']);
      const blob = createObjectURL.mock.calls[0][0];
      expect(blob.type).toBe('text/calendar;charset=utf-8');
      const text = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(blob);
      });
      expect(text).toContain('UID:CRT-48213@grsports-courts');
      expect(text).toContain('SUMMARY:Badminton – Court 1\\, GR Sports Courts');
    } finally {
      Object.assign(URL, original);
    }
  });

  it('players are optional: pressing the same number again clears it', async () => {
    book.mockResolvedValue(booked);
    const { user } = await openDialog();

    await user.click(screen.getByRole('button', { name: '3' }));
    await user.click(screen.getByRole('button', { name: '3' }));
    expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));

    expect(book).toHaveBeenCalledWith({ venueId: 'ven-1', courtId: 'c1', date: '2026-11-14', startTime: '18:00', slots: 2 });
  });

  it('when the time was just taken, hands the message to the page instead of showing an error', async () => {
    book.mockRejectedValue(new ApiError('Court 1 was booked by someone else a moment ago.', 409));
    const { user, onConflict } = await openDialog();

    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));

    await waitFor(() => expect(onConflict).toHaveBeenCalledWith('Court 1 was booked by someone else a moment ago.'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('asks for a profile name when the server needs one', async () => {
    book.mockRejectedValue(new ApiError('Please add your name before booking.', 403));
    const { user, onOpenProfile } = await openDialog();

    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Please add your name before booking.');
    await user.click(within(alert).getByRole('button', { name: 'Add your name in Profile' }));
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
  });

  it.each([
    [new ApiError('Not authenticated', 401), 'Please log in again to book.'],
    [new ApiError('HTTP Request failed with status 500', 500), "The booking didn't go through. Please try again, or call +91 76758 31496."],
    [new ApiError('Bookings open at 6 AM.', 422), 'Bookings open at 6 AM.'],
  ])('explains other failures (%s)', async (error, message) => {
    book.mockRejectedValue(error);
    const { user } = await openDialog();

    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'Confirm booking' })).toBeEnabled();
  });

  it('Back closes the dialog without booking', async () => {
    const { user, onClose } = await openDialog();

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(book).not.toHaveBeenCalled();
  });
});
