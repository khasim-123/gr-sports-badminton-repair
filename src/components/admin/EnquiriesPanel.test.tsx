import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useApp } from '../../context/AppContext';
import { contentService } from '../../services/contentService';
import type { Enquiry } from '../../types/content';
import { EnquiriesPanel, type AdminEnquiriesState } from './EnquiriesPanel';

vi.mock('../../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../../services/contentService', () => ({ contentService: { updateEnquiry: vi.fn(), listEnquiries: vi.fn() } }));

const updateEnquiry = vi.mocked(contentService.updateEnquiry);
const addToast = vi.fn();
const setSelectedRequestId = vi.fn();

function enquiry(overrides: Partial<Enquiry>): Enquiry {
  return {
    id: 'ENQ-10001',
    kind: 'academy',
    name: 'Ravi Kumar',
    mobile: '+919876543210',
    subject: 'Shuttle Stars Academy',
    batch: 'Mon–Fri 6:00–7:30 AM',
    status: 'new',
    createdAt: '2026-10-26T10:00:00Z',
    updatedAt: '2026-10-26T10:00:00Z',
    ...overrides,
  };
}

const ENQUIRIES: Enquiry[] = [
  enquiry({}),
  enquiry({ id: 'ENQ-10002', kind: 'tournament', name: 'Anitha', subject: 'Umpires', batch: null, department: 'umpire', location: 'Port Stadium', status: 'contacted' }),
  enquiry({ id: 'ENQ-10003', kind: 'custom_tshirt', name: 'Kiran', subject: 'Custom T-shirts', batch: null, quantity: 25, status: 'closed' }),
];

function renderPanel(enquiries = ENQUIRIES) {
  const upsert = vi.fn();
  const data: AdminEnquiriesState = { enquiries, loaded: true, loading: false, error: null, reload: vi.fn(), upsert };
  const user = userEvent.setup();
  render(<EnquiriesPanel data={data} />);
  return { user, upsert };
}

const names = () => screen.queryAllByRole('article').map((a) => within(a).getByRole('heading', { level: 3 }).textContent);

beforeEach(() => {
  updateEnquiry.mockReset();
  vi.mocked(useApp).mockImplementation(
    () => ({ addToast, selectedRequestId: null, setSelectedRequestId }) as unknown as ReturnType<typeof useApp>,
  );
});

describe('EnquiriesPanel', () => {
  it('starts on the ones to follow up, and filters by status and kind', async () => {
    const { user } = renderPanel();
    expect(names()).toEqual(['Ravi Kumar', 'Anitha']);

    await user.click(screen.getByRole('button', { name: /^Closed/ }));
    expect(names()).toEqual(['Kiran']);
    expect(screen.getByRole('article')).toHaveTextContent('25 T-shirts');

    await user.click(screen.getByRole('button', { name: /^All 3/ }));
    await user.click(screen.getByRole('button', { name: /^Tournaments/ }));
    expect(names()).toEqual(['Anitha']);
    expect(screen.getByRole('article')).toHaveTextContent('Umpires');
    expect(screen.getByRole('article')).toHaveTextContent('Port Stadium');
  });

  it('shows how to reach the person', () => {
    renderPanel();
    const card = screen.getAllByRole('article')[0];
    expect(within(card).getByRole('link', { name: '+91 98765 43210' })).toHaveAttribute('href', 'tel:+919876543210');
    expect(within(card).getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/919876543210');
    expect(card).toHaveTextContent('Shuttle Stars Academy · Mon–Fri 6:00–7:30 AM');
  });

  it('marks an enquiry contacted and saves a note', async () => {
    const contacted = { ...ENQUIRIES[0], status: 'contacted' as const };
    updateEnquiry.mockResolvedValueOnce(contacted).mockResolvedValueOnce({ ...contacted, adminNote: 'Coming Saturday' });
    const { user, upsert } = renderPanel();
    const card = screen.getAllByRole('article')[0];

    await user.click(within(card).getByRole('button', { name: 'Mark contacted' }));
    expect(updateEnquiry).toHaveBeenCalledWith('ENQ-10001', { status: 'contacted' });
    expect(upsert).toHaveBeenCalledWith(contacted);

    await user.click(within(card).getByRole('button', { name: 'Add note' }));
    await user.type(within(card).getByLabelText(/Your note/), 'Coming Saturday');
    await user.click(within(card).getByRole('button', { name: 'Save note' }));
    expect(updateEnquiry).toHaveBeenLastCalledWith('ENQ-10001', { adminNote: 'Coming Saturday' });
  });

  it('tells the admin when a save fails', async () => {
    updateEnquiry.mockRejectedValue(new Error('Enquiry not found'));
    const { user, upsert } = renderPanel();
    await user.click(within(screen.getAllByRole('article')[1]).getByRole('button', { name: 'Close' }));
    expect(addToast).toHaveBeenCalledWith('error', "Couldn't save", 'Enquiry not found');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('says so when there are no enquiries yet', () => {
    renderPanel([]);
    expect(screen.getByText('No enquiries yet')).toBeInTheDocument();
  });
});
