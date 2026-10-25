import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartItem } from '../types/shop';
import { useApp } from './AppContext';
import { CartProvider, MAX_CART_QTY, cartKey, useCart, type NewCartItem } from './CartContext';

vi.mock('./AppContext', () => ({ useApp: vi.fn() }));

type App = ReturnType<typeof useApp>;

function fakeApp(overrides: Partial<App> = {}): App {
  return {
    isLoggedIn: false,
    currentRole: 'CUSTOMER',
    isAuthChecking: false,
    authModalOpen: false,
    setActiveView: vi.fn(),
    setCustomerSubView: vi.fn(),
    addToast: vi.fn(),
    openAuthModal: vi.fn(),
    ...overrides,
  } as unknown as App;
}

let app: App;
beforeEach(() => {
  app = fakeApp();
  vi.mocked(useApp).mockImplementation(() => app);
});

const STORAGE_KEY = 'gr_cart_v1';

const blackString: NewCartItem = {
  kind: 'string',
  productId: 'str-bg65',
  variantId: 'v-black',
  name: 'Yonex BG 65 Titanium',
  detail: 'Black',
  unitPrice: 650,
  image: null,
};
const tshirt: NewCartItem = { kind: 'apparel', productId: 'tee-1', variantId: 'tee-1-m-navy', name: 'Dry-fit T-shirt', detail: 'M · Navy', unitPrice: 499 };
const racket: NewCartItem = { kind: 'racket', productId: 'rk-88d', name: 'Yonex Astrox 88D Pro', unitPrice: 15990 };

const renderCart = () => renderHook(() => useCart(), { wrapper: CartProvider });
const stored = (): CartItem[] | null => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
};

describe('CartContext', () => {
  it('adds an item as a line with quantity 1, and totals the cart', () => {
    const { result } = renderCart();
    expect(result.current.items).toEqual([]);
    expect(result.current.count).toBe(0);

    act(() => result.current.add(blackString));

    expect(result.current.items).toEqual([{ ...blackString, key: 'string:str-bg65:v-black', quantity: 1 }]);
    expect(result.current.count).toBe(1);
    expect(result.current.subtotal).toBe(650);
    expect(result.current.lines).toEqual([{ kind: 'string', productId: 'str-bg65', variantId: 'v-black', quantity: 1 }]);
    expect(result.current.lastAdded).toEqual({ name: 'Yonex BG 65 Titanium', nonce: expect.any(Number) });
  });

  it('adding the same item again increases its quantity; other variants get their own line', () => {
    const { result } = renderCart();

    act(() => result.current.add(blackString));
    act(() => result.current.add({ ...blackString, quantity: 2 }));
    act(() => result.current.add({ ...blackString, variantId: 'v-white', detail: 'White' }));
    act(() => result.current.add(racket));

    expect(result.current.items.map((i) => [i.key, i.quantity])).toEqual([
      ['string:str-bg65:v-black', 3],
      ['string:str-bg65:v-white', 1],
      ['racket:rk-88d:', 1],
    ]);
    expect(result.current.items[2].variantId).toBeNull();
    expect(result.current.count).toBe(5);
    expect(result.current.subtotal).toBe(650 * 4 + 15990);
  });

  it(`never holds more than ${MAX_CART_QTY} of one item, nor less than 1`, () => {
    const { result } = renderCart();
    const key = cartKey('apparel', 'tee-1', 'tee-1-m-navy');

    act(() => result.current.add({ ...tshirt, quantity: 8 }));
    act(() => result.current.add({ ...tshirt, quantity: 5 }));
    expect(result.current.items[0].quantity).toBe(MAX_CART_QTY);

    act(() => result.current.setQuantity(key, 99));
    expect(result.current.items[0].quantity).toBe(MAX_CART_QTY);
    act(() => result.current.setQuantity(key, 0));
    expect(result.current.items[0].quantity).toBe(1);
    act(() => result.current.setQuantity(key, 2.6));
    expect(result.current.items[0].quantity).toBe(3);
  });

  it('removes a line and clears the cart', () => {
    const { result } = renderCart();
    act(() => {
      result.current.add(blackString);
      result.current.add(tshirt);
    });

    act(() => result.current.remove('string:str-bg65:v-black'));
    expect(result.current.items.map((i) => i.name)).toEqual(['Dry-fit T-shirt']);

    act(() => result.current.clear());
    expect(result.current.items).toEqual([]);
    expect(result.current.subtotal).toBe(0);
  });

  it('a silent add shows no "Added" notice; opening the cart dismisses it', () => {
    const { result } = renderCart();

    act(() => result.current.add(racket, { silent: true }));
    expect(result.current.lastAdded).toBeNull();

    act(() => result.current.add(tshirt));
    expect(result.current.lastAdded?.name).toBe('Dry-fit T-shirt');
    act(() => result.current.openCart());
    expect(result.current.isOpen).toBe(true);
    expect(result.current.lastAdded).toBeNull();
    act(() => result.current.closeCart());
    expect(result.current.isOpen).toBe(false);
  });

  it('replaces the stored prices with the server prices', () => {
    const { result } = renderCart();
    act(() => result.current.add({ ...blackString, quantity: 2 }));

    act(() => result.current.syncPrices({ 'string:str-bg65:v-black': 700, 'racket:missing:': 1 }));

    expect(result.current.items[0].unitPrice).toBe(700);
    expect(result.current.subtotal).toBe(1400);
  });
});

describe('CartContext — saved in this browser', () => {
  it('saves the cart to localStorage and reads it back on the next visit', () => {
    const first = renderCart();
    act(() => first.result.current.add({ ...tshirt, quantity: 2 }));
    expect(stored()).toEqual([{ ...tshirt, key: 'apparel:tee-1:tee-1-m-navy', quantity: 2 }]);
    first.unmount();

    const second = renderCart();
    expect(second.result.current.items).toEqual([{ ...tshirt, key: 'apparel:tee-1:tee-1-m-navy', quantity: 2 }]);
    expect(second.result.current.count).toBe(2);
  });

  it('removes the saved cart once it is empty', () => {
    const { result } = renderCart();
    act(() => result.current.add(racket));
    expect(stored()).not.toBeNull();

    act(() => result.current.remove('racket:rk-88d:'));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('ignores broken or tampered entries in the saved cart', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        items: [
          { kind: 'string', productId: 'str-bg65', variantId: 'v-black', name: 'BG 65', unitPrice: 650, quantity: 50 },
          { kind: 'string', productId: 'str-bg65', variantId: 'v-black', name: 'BG 65 (duplicate)', unitPrice: 1, quantity: 1 },
          { kind: 'apparel', productId: 'tee-1', name: 'Tee', unitPrice: 499, quantity: -3 },
          { kind: 'voucher', productId: 'x', name: 'Free money', unitPrice: -500, quantity: 1 },
          { kind: 'racket', productId: 'rk', name: 'No price' },
          { kind: 'racket', productId: 'rk2', name: 'Bad price', unitPrice: 'NaN' },
          null,
        ],
      }),
    );

    const { result } = renderCart();

    expect(result.current.items.map((i) => [i.key, i.name, i.quantity])).toEqual([
      ['string:str-bg65:v-black', 'BG 65', MAX_CART_QTY],
      ['apparel:tee-1:', 'Tee', 1],
    ]);
  });

  it('starts empty when the saved cart is not valid JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    const { result } = renderCart();
    expect(result.current.items).toEqual([]);
  });

  it('picks up changes made in another tab', () => {
    const { result } = renderCart();
    expect(result.current.items).toEqual([]);

    act(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...racket, quantity: 1 }]));
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    });

    expect(result.current.items.map((i) => i.name)).toEqual(['Yonex Astrox 88D Pro']);
  });
});

describe('CartContext — checkout', () => {
  it('takes a logged-in customer straight to checkout', () => {
    app = fakeApp({ isLoggedIn: true, currentRole: 'CUSTOMER' });
    const { result } = renderCart();
    act(() => result.current.openCart());

    act(() => result.current.checkout());

    expect(result.current.isOpen).toBe(false);
    expect(app.setActiveView).toHaveBeenCalledWith('customer_portal');
    expect(app.setCustomerSubView).toHaveBeenCalledWith('checkout');
  });

  it('asks a visitor to log in first, then continues to checkout after login', () => {
    const { result, rerender } = renderCart();

    act(() => result.current.checkout());
    expect(app.openAuthModal).toHaveBeenCalledWith('CUSTOMER');
    expect(app.setActiveView).not.toHaveBeenCalled();

    const before = app;
    app = fakeApp({ ...before, authModalOpen: true });
    rerender();
    expect(before.setActiveView).not.toHaveBeenCalled();

    app = fakeApp({ ...before, isLoggedIn: true, currentRole: 'CUSTOMER', authModalOpen: false });
    rerender();
    expect(before.setActiveView).toHaveBeenCalledWith('customer_portal');
    expect(before.setCustomerSubView).toHaveBeenCalledWith('checkout');
  });

  it('forgets the checkout if the visitor closes the login without signing in', () => {
    const { result, rerender } = renderCart();
    act(() => result.current.checkout());
    const before = app;

    app = fakeApp({ ...before, authModalOpen: true });
    rerender();
    app = fakeApp({ ...before, authModalOpen: false });
    rerender();
    app = fakeApp({ ...before, isLoggedIn: true });
    rerender();

    expect(before.setActiveView).not.toHaveBeenCalled();
  });

  it('staff accounts are told shop orders need a customer account', () => {
    app = fakeApp({ isLoggedIn: true, currentRole: 'ADMIN' });
    const { result } = renderCart();

    act(() => result.current.checkout());

    expect(app.addToast).toHaveBeenCalledWith('info', 'Customer accounts only', expect.stringContaining('customer account'));
    expect(app.setActiveView).not.toHaveBeenCalled();
    expect(app.openAuthModal).not.toHaveBeenCalled();
  });

  it('useCart outside a CartProvider throws a clear error', () => {
    // React reports the render error before rethrowing it; keep the expected noise out of the output.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const swallow = (e: ErrorEvent) => e.preventDefault();
    window.addEventListener('error', swallow);
    try {
      expect(() => renderHook(() => useCart())).toThrow('useCart must be used within a CartProvider');
    } finally {
      window.removeEventListener('error', swallow);
    }
  });
});
