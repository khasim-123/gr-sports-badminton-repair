import { describe, expect, it } from 'vitest';
import { makeRequest } from '../../test/fixtures';
import type { RepairCategoryTier, RepairEstimate, RequestStatus, ServiceRequest } from '../../types';
import {
  actionsFor,
  addressLine,
  amountDue,
  byUrgency,
  canCorrectDistance,
  cardAmount,
  isForToday,
  isNewRequest,
  mapsUrl,
  matchesSearch,
  nextStepText,
  nextStepTitle,
  pickupDayOffset,
  pickupWhen,
  repairDue,
  serviceName,
  stageOf,
  wasDeclined,
} from './jobLogic';

const estimate = (overrides: Partial<RepairEstimate> = {}): RepairEstimate => ({
  labourCharge: 1200,
  materialsCharge: 500,
  additionalCharges: 0,
  pickupDeliveryCharge: 136,
  discount: 0,
  totalEstimate: 1836,
  expectedCompletionDate: '2026-11-02',
  inspectionNotes: 'Hairline crack at the 10 o’clock position.',
  ...overrides,
});

const repair = (overrides: Partial<ServiceRequest> = {}) =>
  makeRequest({ id: 'REP-00031', serviceType: 'REPAIR', repairIssue: 'Frame Damage', totalAmount: 0, ...overrides });

/** A repair the customer declined: they pay pickup & delivery plus any declined-repair fee. */
const declined = (status: RequestStatus, charge: number, fee?: number) =>
  repair({
    status,
    assignedEmployeeId: 'emp-1',
    pickupDeliveryCharge: charge,
    repairEstimate: estimate(fee === undefined ? {} : { declinedRepairFee: fee }),
    timeline: [{ status: 'Repair Declined', label: 'Customer declined the repair', timestamp: '2026-10-22T10:00:00Z' } as ServiceRequest['timeline'][number]],
  });

const kinds = (r: ServiceRequest, mine = true) => actionsFor(r, mine).map((a) => a.kind);

describe('stageOf', () => {
  it.each<[RequestStatus, string]>([
    ['Submitted', 'collect'],
    ['Accepted', 'collect'],
    ['Employee Assigned', 'collect'],
    ['Pickup Scheduled', 'collect'],
    ['Bat Picked Up', 'workshop'],
    ['Inspection', 'workshop'],
    ['Repair Estimate', 'workshop'],
    ['Repair Approved', 'workshop'],
    ['Repair in Progress', 'workshop'],
    ['Getting in Progress', 'workshop'],
    ['Awaiting Customer Approval', 'approval'],
    ['Getting Completed', 'deliver'],
    ['Repair Completed', 'deliver'],
    ['Repair Declined', 'deliver'],
    ['Out for Delivery', 'deliver'],
    ['Delivered', 'deliver'],
    ['Payment Pending', 'deliver'],
    ['Payment Collected', 'done'],
    ['Completed', 'done'],
    ['Completed Without Repair', 'done'],
    ['Cancelled', 'done'],
  ])('%s -> %s', (status, stage) => {
    expect(stageOf(makeRequest({ status }))).toBe(stage);
  });
});

describe('isNewRequest', () => {
  it('is a booking nobody has accepted yet', () => {
    expect(isNewRequest(makeRequest({ status: 'Submitted' }))).toBe(true);
    expect(isNewRequest(makeRequest({ status: 'Accepted' }))).toBe(true);
    expect(isNewRequest(makeRequest({ status: 'Submitted', assignedEmployeeId: 'emp-1' }))).toBe(false);
    expect(isNewRequest(makeRequest({ status: 'Employee Assigned' }))).toBe(false);
  });
});

describe('actionsFor', () => {
  it("someone else's job: only a new request can be accepted", () => {
    expect(actionsFor(makeRequest(), false)).toEqual([{ kind: 'accept', label: 'Accept job', primary: true }]);
    expect(actionsFor(makeRequest({ status: 'Bat Picked Up', assignedEmployeeId: 'emp-2' }), false)).toEqual([]);
  });

  it.each<[string, ServiceRequest, string[]]>([
    ['stringing to collect', makeRequest({ status: 'Pickup Scheduled' }), ['pickup', 'correct_distance']],
    ['stringing picked up', makeRequest({ status: 'Bat Picked Up' }), ['start_stringing', 'correct_distance']],
    ['repair picked up', repair({ status: 'Bat Picked Up' }), ['estimate', 'correct_distance']],
    ['repair under inspection', repair({ status: 'Inspection' }), ['estimate', 'correct_distance']],
    ['stringing under inspection (nothing to do)', makeRequest({ status: 'Inspection' }), ['correct_distance']],
    ['stringing in progress', makeRequest({ status: 'Getting in Progress' }), ['finish_stringing', 'correct_distance']],
    ['waiting for the customer', repair({ status: 'Awaiting Customer Approval' }), ['correct_distance']],
    ['repair approved', repair({ status: 'Repair Approved' }), ['start_repair', 'revise', 'correct_distance']],
    ['repair in progress', repair({ status: 'Repair in Progress' }), ['finish_repair', 'revise', 'correct_distance']],
    ['stringing done', makeRequest({ status: 'Getting Completed' }), ['dispatch', 'correct_distance']],
    ['out for delivery, unpaid', makeRequest({ status: 'Out for Delivery' }), ['payment', 'correct_distance']],
    ['out for delivery, paid', makeRequest({ status: 'Out for Delivery', paymentStatus: 'Paid' }), []],
    ['declined, returning with a charge', declined('Out for Delivery', 80), ['payment', 'correct_distance']],
    ['declined, returning with nothing to collect', declined('Out for Delivery', 0), ['return_done', 'correct_distance']],
    ['declined, delivered, nothing to collect', declined('Delivered', 0), ['correct_distance']],
    ['completed', makeRequest({ status: 'Completed', paymentStatus: 'Paid' }), []],
    ['cancelled', makeRequest({ status: 'Cancelled' }), []],
  ])('my job, %s', (_, r, expected) => {
    expect(kinds(r)).toEqual(expected);
  });

  it('labels the return trip of a declined repair', () => {
    expect(actionsFor(declined('Repair Declined', 80), true)[0]).toEqual({ kind: 'dispatch', label: 'Out for delivery (return)', primary: true });
  });

  it('has at most one main next step per job', () => {
    const statuses: RequestStatus[] = ['Submitted', 'Bat Picked Up', 'Repair Approved', 'Repair in Progress', 'Out for Delivery', 'Repair Declined'];
    for (const status of statuses) {
      for (const r of [makeRequest({ status }), repair({ status })]) {
        expect(actionsFor(r, true).filter((a) => a.primary).length, status).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('canCorrectDistance', () => {
  it('only the assigned employee, and only until the customer has paid', () => {
    expect(canCorrectDistance(makeRequest(), true)).toBe(true);
    expect(canCorrectDistance(makeRequest(), false)).toBe(false);
    expect(canCorrectDistance(makeRequest({ paymentStatus: 'Paid', status: 'Delivered' }), true)).toBe(false);
    expect(canCorrectDistance(makeRequest({ status: 'Cancelled' }), true)).toBe(false);
  });
});

describe('money due', () => {
  it('a normal job collects the total; a declined repair collects pickup & delivery plus the declined fee', () => {
    expect(amountDue(makeRequest({ totalAmount: 450 }))).toBe(450);
    expect(amountDue(declined('Out for Delivery', 80, 100))).toBe(180);
    expect(amountDue(declined('Out for Delivery', 80))).toBe(80);
  });

  it('a repair counts as declined from the timeline even after the status moved on', () => {
    expect(wasDeclined(declined('Delivered', 80))).toBe(true);
    expect(wasDeclined(repair({ status: 'Delivered' }))).toBe(false);
  });
});

describe('nextStepText / nextStepTitle', () => {
  it.each<[string, ServiceRequest, boolean, string, string]>([
    ['new request', makeRequest(), false, 'New request — accept it to take the job', 'New request'],
    ['to collect', makeRequest({ status: 'Pickup Scheduled', assignedEmployeeId: 'emp-1' }), true, 'Collect the racket from the customer', 'Collect the racket'],
    ['stringing picked up', makeRequest({ status: 'Bat Picked Up' }), true, 'String the racket', 'String the racket'],
    ['repair picked up', repair({ status: 'Bat Picked Up' }), true, 'Inspect it and send the repair estimate', 'Inspect and send estimate'],
    ['waiting for approval', repair({ status: 'Awaiting Customer Approval', repairEstimate: estimate() }), true, 'Waiting for the customer to approve ₹1,836', 'Waiting for approval'],
    ['waiting, no estimate yet', repair({ status: 'Awaiting Customer Approval' }), true, 'Waiting for the customer to approve the estimate', 'Waiting for approval'],
    ['approved', repair({ status: 'Repair Approved', repairEstimate: estimate() }), true, 'Customer approved ₹1,836 — start the repair', 'Approved — start the repair'],
    ['ready to deliver', makeRequest({ status: 'Getting Completed', totalAmount: 1836 }), true, 'Ready — deliver and collect ₹1,836', 'Ready to deliver'],
    ['declined', declined('Repair Declined', 80), true, 'Customer declined the repair — return the racket', 'Return the racket'],
    ['out for delivery', makeRequest({ status: 'Out for Delivery', totalAmount: 450 }), true, 'Out for delivery — collect ₹450', 'Out for delivery'],
    ['returning with fee', declined('Out for Delivery', 80, 100), true, 'Returning — collect ₹180 (pickup & delivery + declined-repair fee)', 'Returning the racket'],
    ['returning, pickup charge only', declined('Out for Delivery', 80), true, 'Returning — collect ₹80 pickup charge', 'Returning the racket'],
    ['returning, nothing due', declined('Out for Delivery', 0), true, 'Returning the racket — nothing to collect', 'Returning the racket'],
    ['paid', makeRequest({ status: 'Delivered', paymentStatus: 'Paid' }), true, 'Paid', 'Paid'],
    [
      'completed',
      makeRequest({ status: 'Completed', paymentRecord: { amount: 450, method: 'UPI', collectedAt: '2026-10-24T10:00:00Z', collectedBy: 'emp-1' } }),
      true,
      'Completed · paid ₹450 by UPI',
      'Completed',
    ],
    ['returned without repair', repair({ status: 'Completed Without Repair' }), true, 'Returned without repair', 'Returned without repair'],
    ['cancelled', makeRequest({ status: 'Cancelled' }), true, 'Cancelled', 'Cancelled'],
  ])('%s', (_, r, mine, text, title) => {
    expect(nextStepText(r, mine)).toBe(text);
    expect(nextStepTitle(r, mine)).toBe(title);
  });
});

describe('cardAmount', () => {
  const paid = { amount: 450, method: 'UPI' as const, collectedAt: '2026-10-24T10:00:00Z', collectedBy: 'emp-1' };

  it.each<[string, ServiceRequest, ReturnType<typeof cardAmount>]>([
    ['done and paid', makeRequest({ status: 'Completed', paymentRecord: paid }), { label: 'Paid · UPI', value: '₹450', strong: false }],
    ['done, no payment record', makeRequest({ status: 'Cancelled' }), null],
    ['waiting for approval', repair({ status: 'Awaiting Customer Approval', repairEstimate: estimate() }), { label: 'Estimate', value: '₹1,836', strong: false }],
    ['repair not estimated yet', repair({ status: 'Bat Picked Up' }), null],
    ['to deliver', makeRequest({ status: 'Out for Delivery', totalAmount: 450 }), { label: 'To collect', value: '₹450', strong: true }],
    ['to deliver, already paid', makeRequest({ status: 'Delivered', paymentStatus: 'Paid' }), null],
    ['declined, nothing to collect', declined('Out for Delivery', 0), { label: 'To collect', value: 'Nothing', strong: false }],
    ['stringing to collect', makeRequest({ totalAmount: 450 }), { label: 'On delivery', value: '₹450', strong: false }],
  ])('%s', (_, r, expected) => {
    expect(cardAmount(r)).toEqual(expected);
  });
});

describe('pickup dates', () => {
  const today = new Date(2026, 9, 25, 15, 30);

  it('counts calendar days to the pickup', () => {
    expect(pickupDayOffset(makeRequest({ pickupDate: '2026-10-25' }), today)).toBe(0);
    expect(pickupDayOffset(makeRequest({ pickupDate: '2026-10-23' }), today)).toBe(-2);
    expect(pickupDayOffset(makeRequest({ pickupDate: undefined }), today)).toBeNull();
  });

  it.each([
    ['2026-10-25', '10:00 - 13:00', 'Today, 10:00 - 13:00'],
    ['2026-10-26', null, 'Tomorrow'],
    ['2026-10-30', '16:00 - 19:00', '30 Oct 2026, 16:00 - 19:00'],
    [undefined, null, 'Date not chosen — call the customer'],
    [undefined, '10:00 - 13:00', '10:00 - 13:00, date not chosen — call the customer'],
  ])('pickupWhen(%s, %s) -> %s', (pickupDate, slot, expected) => {
    expect(pickupWhen(makeRequest({ pickupDate }), slot, today)).toBe(expected);
  });

  it("today's list: pickups due today or overdue, and runs out for delivery", () => {
    expect(isForToday(makeRequest({ pickupDate: '2026-10-25' }), today)).toBe(true);
    expect(isForToday(makeRequest({ pickupDate: '2026-10-22' }), today)).toBe(true);
    expect(isForToday(makeRequest({ pickupDate: '2026-10-26' }), today)).toBe(false);
    expect(isForToday(makeRequest({ pickupDate: undefined }), today)).toBe(false);
    expect(isForToday(makeRequest({ status: 'Out for Delivery' }), today)).toBe(true);
    expect(isForToday(makeRequest({ status: 'Bat Picked Up', pickupDate: '2026-10-20' }), today)).toBe(false);
  });
});

describe('repairDue', () => {
  const categories: RepairCategoryTier[] = [
    { id: 'frame', name: 'Frame Damage / Crack', basePrice: 1200, turnaround: '5 days', description: '', slaDays: 5 },
    { id: 'grip', name: 'Grip Issue', basePrice: 100, turnaround: 'Same day', description: '', slaDays: 0 },
  ];

  it('uses the date promised in the estimate', () => {
    expect(repairDue(repair({ repairEstimate: estimate({ expectedCompletionDate: '2026-11-02' }) }), categories)).toEqual({
      date: new Date(2026, 10, 2),
      source: 'estimate',
    });
  });

  it("otherwise counts the category's turnaround from pickup", () => {
    const r = repair({
      pickupDate: '2026-10-20',
      pickupCondition: { condition: 'Good' as never, notes: '', photos: [], collectedAt: '2026-10-21T10:00:00+05:30', collectedBy: 'emp-1' },
    });
    expect(repairDue(r, categories)).toEqual({ date: new Date(2026, 9, 26), source: 'sla', slaDays: 5 });
    expect(repairDue(repair({ pickupDate: '2026-10-20' }), categories)).toEqual({ date: new Date(2026, 9, 25), source: 'sla', slaDays: 5 });
  });

  it('is unknown for stringing, unmatched categories and categories without a turnaround', () => {
    expect(repairDue(makeRequest(), categories)).toBeNull();
    expect(repairDue(repair({ repairIssue: 'Other' }), categories)).toBeNull();
    expect(repairDue(repair({ repairIssue: 'Grip Issue' }), categories)).toBeNull();
  });
});

describe('address, maps and search', () => {
  const address = makeRequest().pickupAddress;

  it('addressLine joins the parts and skips empty ones', () => {
    expect(addressLine(address)).toBe('Flat 302, Sai Residency, Beach Road, MVP Colony, Visakhapatnam – 530017');
    expect(addressLine({ ...address, street: '  ', pincode: '' })).toBe('Flat 302, Sai Residency, MVP Colony, Visakhapatnam');
    expect(addressLine(null)).toBe('');
  });

  it('mapsUrl prefers the GPS position, else searches the address', () => {
    expect(mapsUrl({ ...address, lat: 17.7231, lng: 83.3012 })).toBe('https://www.google.com/maps/search/?api=1&query=17.7231%2C83.3012');
    expect(mapsUrl(address)).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Flat 302, Sai Residency, Beach Road, MVP Colony, Visakhapatnam, 530017')}`,
    );
    expect(mapsUrl({ ...address, houseFlat: '', street: '', area: '', city: '', pincode: '' })).toBeNull();
    expect(mapsUrl(undefined)).toBeNull();
  });

  it.each([
    ['', true],
    ['anil', true],
    ['GET-00025', true],
    ['mvp colony', true],
    ['530017', true],
    ['98765', true],
    ['+91 98765 43210', true],
    ['987', false],
    ['Ravi', false],
  ])('matchesSearch(%s) -> %s', (q, expected) => {
    expect(matchesSearch(makeRequest(), q)).toBe(expected);
  });

  it('serviceName', () => {
    expect(serviceName(makeRequest())).toBe('Stringing');
    expect(serviceName(repair())).toBe('Repair');
  });
});

describe('byUrgency', () => {
  it('pickups by pickup date first, then the rest oldest first', () => {
    const jobs = [
      makeRequest({ id: 'workshop-new', status: 'Bat Picked Up', createdAt: '2026-10-24T09:00:00Z' }),
      makeRequest({ id: 'pickup-later', pickupDate: '2026-10-28' }),
      makeRequest({ id: 'workshop-old', status: 'Getting in Progress', createdAt: '2026-10-20T09:00:00Z' }),
      makeRequest({ id: 'pickup-soon', pickupDate: '2026-10-26' }),
    ];
    expect([...jobs].sort(byUrgency).map((r) => r.id)).toEqual(['pickup-soon', 'pickup-later', 'workshop-old', 'workshop-new']);
  });
});
