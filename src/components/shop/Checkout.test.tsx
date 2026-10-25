import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApp } from '../../context/AppContext';
import { CartProvider } from '../../context/CartContext';
import { DEFAULT_SHOP_SETTINGS, primeShopSettings } from '../../hooks/useShopSettings';
import { ApiError } from '../../services/apiClient';
import { shopService } from '../../services/shopService';
import { makeOrder, makeRequest } from '../../test/fixtures';
import type { Address, DistancePricingConfig } from '../../types';
import type { CartItem, OrderQuote, QuoteInput } from '../../types/shop';
import { Checkout } from './Checkout';

vi.mock('../../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../../services/shopService', () => ({ shopService: { quote: vi.fn(), placeOrder: vi.fn() } }));

const quote = vi.mocked(shopService.quote);
const placeOrder = vi.mocked(shopService.placeOrder);

const distanceConfig: DistancePricingConfig = {
  shopLocationName: 'GR Sports',
  shopLat: 17.7287,
  shopLng: 83.3015,
  freeRadiusKm: 15,
  perKmRateBeyondFree: 15,
  pricingMethod: 'PER_KM',
  maxServiceDistanceKm: 40,
  slabs: [],
};

const homeAddress: Address = { ...makeRequest().pickupAddress, id: 'addr-home', distanceKm: 18, isDefault: true };

const cartItems: CartItem[] = [
  { key: 'apparel:tee-1:tee-1-m-navy', kind: 'apparel', productId: 'tee-1', variantId: 'tee-1-m-navy', name: 'Dry-fit T-shirt', detail: 'M · Navy', unitPrice: 499, quantity: 2 },
  { key: 'string:str-bg65:v-black', kind: 'string', productId: 'str-bg65', variantId: 'v-black', name: 'Yonex BG 65 Titanium', detail: 'Black', unitPrice: 650, quantity: 1 },
];
const cartLines = cartItems.map(({ kind, productId, variantId, quantity }) => ({ kind, productId, variantId, quantity }));

/** The server's price check: prices as in the cart, ₹45 delivery to an address (none for pickup). */
function serverQuote(input: QuoteInput, overrides: Partial<OrderQuote> = {}): OrderQuote {
  const items = input.items.map((l) => {
    const item = cartItems.find((i) => i.productId === l.productId && i.variantId === l.variantId)!;
    return { ...l, name: item.name, detail: item.detail, unitPrice: item.unitPrice, lineTotal: item.unitPrice * l.quantity };
  });
  const subtotal = items.reduce((n, i) => n + i.lineTotal, 0);
  const deliveryCharge = input.fulfilment === 'delivery' ? 45 : 0;
  return { items, unavailable: [], subtotal, deliveryCharge, distanceKm: input.address?.distanceKm ?? null, total: subtotal + deliveryCharge, outsideDeliveryArea: false, ...overrides };
}

let app: ReturnType<typeof useApp>;
function setApp(overrides: Record<string, unknown> = {}) {
  app = {
    isLoggedIn: true,
    currentRole: 'CUSTOMER',
    isAuthChecking: false,
    authModalOpen: false,
    userMobile: '+919876543210',
    savedAddresses: [homeAddress],
    distanceConfig,
    addNewAddress: vi.fn(),
    setCustomerSubView: vi.fn(),
    setActiveView: vi.fn(),
    setSelectedRequestId: vi.fn(),
    addToast: vi.fn(),
    openAuthModal: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useApp>;
}

beforeAll(() => {
  primeShopSettings(DEFAULT_SHOP_SETTINGS);
});

beforeEach(() => {
  setApp();
  vi.mocked(useApp).mockImplementation(() => app);
  quote.mockImplementation(async (input) => serverQuote(input));
  window.localStorage.setItem('gr_cart_v1', JSON.stringify(cartItems));
});

function renderCheckout() {
  const user = userEvent.setup();
  render(
    <CartProvider>
      <Checkout />
    </CartProvider>,
  );
  return { user };
}

const placeButton = () => screen.getByRole('button', { name: /^Place order/ });
const summary = () => screen.getByRole('complementary', { name: 'Order summary' });

describe('Checkout', () => {
  it("lists the cart, checks prices with the server and totals delivery to the customer's saved address", async () => {
    renderCheckout();

    expect(screen.getByRole('heading', { level: 1, name: 'Checkout' })).toBeInTheDocument();
    const items = screen.getByRole('region', { name: 'Your items' });
    expect(within(items).getByText('Dry-fit T-shirt')).toBeInTheDocument();
    expect(within(items).getByText('M · Navy · Qty 2')).toBeInTheDocument();
    expect(within(items).getByText('₹998')).toBeInTheDocument();
    expect(within(items).getByText('String set · Black · Qty 1')).toBeInTheDocument();

    expect(screen.getByRole('radio', { name: /Deliver to me/ })).toHaveAttribute('aria-checked', 'true');
    const addresses = screen.getByRole('radiogroup', { name: 'Delivery address' });
    expect(within(addresses).getByRole('radio', { name: /Flat 302, Sai Residency, Beach Road, MVP Colony, Visakhapatnam – 530017/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    expect(await screen.findByRole('button', { name: 'Place order · ₹1,693' })).toBeEnabled();
    expect(quote).toHaveBeenLastCalledWith({ items: cartLines, fulfilment: 'delivery', address: homeAddress });
    expect(within(summary()).getByText('Items (3)')).toBeInTheDocument();
    expect(within(summary()).getByText('₹45')).toBeInTheDocument();
    expect(within(summary()).getByText("Pay when it's delivered — cash or UPI.")).toBeInTheDocument();
    expect(within(summary()).getByText(/keep you updated here and by phone on \+91 98765 43210/)).toBeInTheDocument();
  });

  it('collect from the shop: places a pickup order and shows the confirmation', async () => {
    placeOrder.mockResolvedValue(makeOrder({ id: 'ORD-48213', fulfilment: 'pickup', total: 1648, subtotal: 1648 }));
    const { user } = renderCheckout();

    await user.click(screen.getByRole('radio', { name: /Collect from the shop/ }));
    expect(screen.getByRole('radio', { name: /Collect from the shop/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('radiogroup', { name: 'Delivery address' })).not.toBeInTheDocument();
    expect(screen.getByText(/Beside Ramalayam Arch, Near Diamond Park, Dondaparthy, Visakhapatnam 530016/)).toBeInTheDocument();
    expect(within(summary()).getByText('Free')).toBeInTheDocument();
    expect(within(summary()).getByText('Pay at the shop when you collect it — cash or UPI.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Note'), '  Please keep it at the counter ');
    const button = await screen.findByRole('button', { name: 'Place order · ₹1,648' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(placeOrder).toHaveBeenCalledWith({ items: cartLines, fulfilment: 'pickup', address: null, notes: 'Please keep it at the counter' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Order placed' })).toBeInTheDocument();
    expect(screen.getByText('ORD-48213')).toBeInTheDocument();
    expect(screen.getByText('Total to pay').nextElementSibling).toHaveTextContent('₹1,648');
    expect(screen.getByText('Collect from').nextElementSibling).toHaveTextContent('Beside Ramalayam Arch, Near Diamond Park, Dondaparthy, Visakhapatnam 530016');
    expect(screen.getByText(/We'll contact you on \+91 98765 43210/)).toBeInTheDocument();
    // The cart is emptied, and no address is saved for a pickup.
    expect(window.localStorage.getItem('gr_cart_v1')).toBeNull();
    expect(app.addNewAddress).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'View my order' }));
    expect(app.setSelectedRequestId).toHaveBeenCalledWith('ORD-48213');
    expect(app.setActiveView).toHaveBeenCalledWith('customer_portal');
    expect(app.setCustomerSubView).toHaveBeenCalledWith('orders');
  });

  it('a new delivery address is checked before ordering and saved afterwards', async () => {
    setApp({ savedAddresses: [] });
    placeOrder.mockResolvedValue(makeOrder());
    const { user } = renderCheckout();

    await waitFor(() => expect(placeButton()).toBeEnabled());
    await user.click(placeButton());
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter your house / flat and area for delivery.');
    expect(placeOrder).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Flat / house / building *'), 'Flat 302, Sai Residency');
    await user.type(screen.getByLabelText('Area / locality *'), 'MVP Colony');
    await user.type(screen.getByLabelText('Pincode *'), '5300');
    await waitFor(() => expect(placeButton()).toBeEnabled());
    await user.click(placeButton());
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid 6-digit pincode.');
    expect(placeOrder).not.toHaveBeenCalled();

    // Only digits are kept, at most six.
    await user.type(screen.getByLabelText('Pincode *'), '17-99');
    expect(screen.getByLabelText('Pincode *')).toHaveValue('530017');
    await waitFor(() => expect(placeButton()).toBeEnabled());
    await user.click(placeButton());

    await screen.findByRole('heading', { name: 'Order placed' });
    const expectedAddress = expect.objectContaining({
      houseFlat: 'Flat 302, Sai Residency',
      area: 'MVP Colony',
      city: 'Visakhapatnam',
      pincode: '530017',
      distanceKm: 3,
    });
    expect(placeOrder).toHaveBeenCalledWith({ items: cartLines, fulfilment: 'delivery', address: expectedAddress, notes: undefined });
    expect(app.addNewAddress).toHaveBeenCalledWith(expect.objectContaining({ houseFlat: 'Flat 302, Sai Residency', pincode: '530017', isDefault: true }));
    expect(vi.mocked(app.addNewAddress).mock.calls[0][0]).not.toHaveProperty('id');
  });

  it('lists the items the server refuses, and removing them clears the problem', async () => {
    placeOrder.mockRejectedValue(
      new ApiError('Some items are no longer available.', 409, {
        unavailable: [{ kind: 'string', productId: 'str-bg65', variantId: 'v-black', name: 'Yonex BG 65 Titanium', reason: 'Out of stock' }],
      }),
    );
    const { user } = renderCheckout();

    await waitFor(() => expect(placeButton()).toBeEnabled());
    await user.click(placeButton());

    const refused = await screen.findByText('No longer available');
    const box = refused.closest('[role="alert"]') as HTMLElement;
    expect(box).toHaveTextContent('Yonex BG 65 Titanium (Black): Out of stock');
    expect(within(summary()).getByRole('alert')).toHaveTextContent(
      'Some items are no longer available. Remove the items marked “No longer available” and try again.',
    );
    expect(placeButton()).toBeDisabled();

    await user.click(within(box).getByRole('button', { name: 'Remove' }));

    expect(screen.queryByText('No longer available')).not.toBeInTheDocument();
    // The removed item leaves "Your items" at once, before the new price check (debounced) comes back.
    expect(within(screen.getByRole('region', { name: 'Your items' })).queryByText('Yonex BG 65 Titanium')).not.toBeInTheDocument();
    // The list follows the server's fresh price check for the remaining items.
    expect(await screen.findByRole('button', { name: 'Place order · ₹1,043' })).toBeEnabled();
    expect(within(screen.getByRole('region', { name: 'Your items' })).queryByText('Yonex BG 65 Titanium')).not.toBeInTheDocument();
    expect(quote).toHaveBeenLastCalledWith({ items: [cartLines[0]], fulfilment: 'delivery', address: homeAddress });
  });

  it('warns when the address is outside the delivery area and blocks the order', async () => {
    quote.mockImplementation(async (input) => serverQuote(input, { outsideDeliveryArea: input.fulfilment === 'delivery', distanceKm: 52 }));
    renderCheckout();

    const warning = await screen.findByText(/This address is outside our delivery area \(about 52 km\)/);
    expect(warning.closest('[role="alert"]')).toHaveTextContent('Choose “Collect from the shop”, or call us on +91 76758 31496.');
    expect(placeButton()).toBeDisabled();
  });

  it('an empty cart offers the shop and the orders instead', async () => {
    window.localStorage.clear();
    const { user } = renderCheckout();

    expect(screen.getByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument();
    expect(quote).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Shop T-shirts' }));
    expect(app.setActiveView).toHaveBeenCalledWith('apparel');
  });
});
