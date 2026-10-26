import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHOP_SETTINGS, primeShopSettings } from '../../../hooks/useShopSettings';
import { ApiError } from '../../../services/apiClient';
import { contentService } from '../../../services/contentService';
import type { Enquiry } from '../../../types/content';
import { EnquiryForm, type EnquiryFormProps } from './EnquiryForm';

vi.mock('../../../services/contentService', () => ({
  contentService: { submitEnquiry: vi.fn(), getShopSettings: vi.fn() },
}));

const submitEnquiry = vi.mocked(contentService.submitEnquiry);

beforeAll(() => {
  // Use the default shop details without a request to /api/config/shop.
  primeShopSettings(DEFAULT_SHOP_SETTINGS);
});
beforeEach(() => {
  submitEnquiry.mockReset();
});

function enquiry(overrides: Partial<Enquiry> = {}): Enquiry {
  return {
    id: 'ENQ-48213',
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

function renderForm(props: Partial<EnquiryFormProps> = {}) {
  const onDone = vi.fn();
  const user = userEvent.setup();
  render(
    <EnquiryForm
      kind="academy"
      fixed={{ academyId: 'ACD-1' }}
      batches={['Mon–Fri 6:00–7:30 AM', 'Sat–Sun 4:00–6:00 PM']}
      submitLabel="Book a slot"
      nextStep="We'll check with the academy and confirm your batch."
      onDone={onDone}
      {...props}
    />,
  );
  return { user, onDone };
}

describe('EnquiryForm', () => {
  it('asks for a batch, a name and a valid mobile before sending', async () => {
    const { user } = renderForm();
    await user.click(screen.getByRole('button', { name: 'Book a slot' }));

    expect(screen.getByText('Choose a batch.')).toBeInTheDocument();
    expect(screen.getByLabelText('Your name')).toHaveAccessibleDescription('Please enter your name.');
    expect(screen.getByLabelText('Mobile number')).toHaveAccessibleDescription(/Enter a 10-digit Indian mobile number/);
    expect(submitEnquiry).not.toHaveBeenCalled();
  });

  it('sends an academy slot request and shows the request number', async () => {
    submitEnquiry.mockResolvedValue(enquiry({ batch: 'Sat–Sun 4:00–6:00 PM' }));
    const { user, onDone } = renderForm();

    await user.click(screen.getByRole('radio', { name: 'Sat–Sun 4:00–6:00 PM' }));
    await user.type(screen.getByLabelText('Your name'), '  Ravi   Kumar ');
    await user.type(screen.getByLabelText('Mobile number'), '+91 98765-43210');
    await user.type(screen.getByLabelText(/Anything the coach should know/), 'Age 11');
    await user.click(screen.getByRole('button', { name: 'Book a slot' }));

    expect(submitEnquiry).toHaveBeenCalledWith({
      kind: 'academy',
      academyId: 'ACD-1',
      name: 'Ravi Kumar',
      mobile: '9876543210',
      batch: 'Sat–Sun 4:00–6:00 PM',
      location: undefined,
      quantity: undefined,
      date: undefined,
      notes: 'Age 11',
    });
    const done = await screen.findByRole('status');
    expect(within(done).getByRole('heading', { name: 'Request sent' })).toBeInTheDocument();
    expect(done).toHaveTextContent("We'll check with the academy and confirm your batch.");
    expect(done).toHaveTextContent('+91 98765 43210');
    expect(done).toHaveTextContent('ENQ-48213');
    expect(done).toHaveTextContent('Shuttle Stars Academy · Sat–Sun 4:00–6:00 PM');

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalled();
  });

  it('custom T-shirts need a number or a description', async () => {
    submitEnquiry.mockResolvedValue(enquiry({ kind: 'custom_tshirt', subject: 'Custom T-shirts', batch: null, quantity: 30 }));
    const { user } = renderForm({ kind: 'custom_tshirt', fixed: undefined, batches: [], submitLabel: 'Send request' });

    expect(screen.queryByRole('group', { name: 'Which batch?' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Your name'), 'Anitha');
    await user.type(screen.getByLabelText('Mobile number'), '9876543210');
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(screen.getByLabelText('How many T-shirts?')).toHaveAccessibleDescription(/Tell us how many you need, or describe them below/);
    expect(submitEnquiry).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('How many T-shirts?'), '30');
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(submitEnquiry).toHaveBeenCalledWith(expect.objectContaining({ kind: 'custom_tshirt', quantity: 30, batch: undefined }));
    expect(await screen.findByText('ENQ-48213')).toBeInTheDocument();
  });

  it('sends the tournament department and location', async () => {
    submitEnquiry.mockResolvedValue(enquiry({ kind: 'tournament', subject: 'Umpires', batch: null, department: 'umpire' }));
    const { user } = renderForm({ kind: 'tournament', fixed: { department: 'umpire' }, batches: [], submitLabel: 'Send request' });

    await user.type(screen.getByLabelText('Your name'), 'Anitha');
    await user.type(screen.getByLabelText('Mobile number'), '9876543210');
    await user.type(screen.getByLabelText(/Where is the tournament/), 'Port Indoor Stadium');
    await user.click(screen.getByRole('button', { name: 'Send request' }));

    expect(submitEnquiry).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'tournament', department: 'umpire', location: 'Port Indoor Stadium', quantity: undefined }),
    );
  });

  it.each([
    [new ApiError('We already have your request for Umpires from +91 98765 43210 (ENQ-11111).', 409), 'We already have your request for Umpires'],
    [new ApiError('Unable to reach the server', 0), "We couldn't reach the GR Sports server."],
    [new ApiError('Too many requests', 429), 'Too many requests from this number or device.'],
  ])('explains a failed send (%s) and keeps what was typed', async (error, message) => {
    submitEnquiry.mockRejectedValue(error);
    const { user } = renderForm({ kind: 'tournament', fixed: { department: 'umpire' }, batches: [], submitLabel: 'Send request' });

    await user.type(screen.getByLabelText('Your name'), 'Anitha');
    await user.type(screen.getByLabelText('Mobile number'), '9876543210');
    await user.click(screen.getByRole('button', { name: 'Send request' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText('Your name')).toHaveValue('Anitha');
  });
});
