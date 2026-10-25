import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { CartItem, CartItemKind, CartLineInput } from '../types/shop';
import { useApp } from './AppContext';

/**
 * Shopping cart for the GR Sports shop (T-shirts, rackets, string sets).
 *
 * Kept in this browser only (localStorage `gr_cart_v1`); prices shown here are the ones seen when
 * the item was added — the server re-checks prices and stock (shopService.quote) before an order.
 * The cart drawer and the "Added" notice are rendered by <CartProvider> (see components/shop).
 */

const STORAGE_KEY = 'gr_cart_v1';
export const MAX_CART_QTY = 10;
const KINDS: CartItemKind[] = ['apparel', 'racket', 'string'];

export const cartKey = (kind: CartItemKind, productId: string, variantId?: string | null) =>
  `${kind}:${productId}:${variantId || ''}`;

const clampQty = (n: number) => Math.max(1, Math.min(MAX_CART_QTY, Math.round(Number(n) || 1)));

function isCartItem(v: unknown): v is CartItem {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    KINDS.includes(o.kind as CartItemKind) &&
    typeof o.productId === 'string' &&
    typeof o.name === 'string' &&
    typeof o.unitPrice === 'number' &&
    Number.isFinite(o.unitPrice)
  );
}

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : [];
    const seen = new Set<string>();
    const out: CartItem[] = [];
    for (const v of list) {
      if (!isCartItem(v)) continue;
      const key = cartKey(v.kind, v.productId, v.variantId);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...v, key, quantity: clampQty(v.quantity) });
    }
    return out.slice(0, 50);
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  try {
    if (items.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage full / blocked: the cart still works for this page view
  }
}

export type NewCartItem = Omit<CartItem, 'key' | 'quantity'> & { quantity?: number };

interface CartContextValue {
  items: CartItem[];
  /** Total number of pieces. */
  count: number;
  /** Sum of the prices shown when the items were added. */
  subtotal: number;
  /** The lines to send to the server (quote / order). */
  lines: CartLineInput[];
  add: (item: NewCartItem, opts?: { silent?: boolean }) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  /** Replace the stored prices with the server's current ones. */
  syncPrices: (prices: Record<string, number>) => void;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  /** Opens checkout (asks a logged-out visitor to log in first, then returns to checkout). */
  checkout: () => void;
  /** Last item added (drives the small "Added — View cart" notice). */
  lastAdded: { name: string; nonce: number } | null;
  dismissAdded: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const app = useApp();
  const [items, setItems] = useState<CartItem[]>(readCart);
  const [isOpen, setIsOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<{ name: string; nonce: number } | null>(null);
  const nonceRef = useRef(0);
  const skipWrite = useRef(true);

  // Persist (skipping the initial read).
  useEffect(() => {
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    writeCart(items);
  }, [items]);

  // Keep several open tabs in step.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY && e.key !== null) return;
      skipWrite.current = true;
      setItems(readCart());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const add = useCallback((item: NewCartItem, opts?: { silent?: boolean }) => {
    const key = cartKey(item.kind, item.productId, item.variantId);
    const qty = clampQty(item.quantity ?? 1);
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) =>
          i.key === key ? { ...i, ...item, key, quantity: clampQty(existing.quantity + qty) } : i,
        );
      }
      return [...prev, { ...item, key, quantity: qty, variantId: item.variantId ?? null }];
    });
    if (!opts?.silent) setLastAdded({ name: item.name, nonce: ++nonceRef.current });
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, quantity: clampQty(quantity) } : i)));
  }, []);

  const remove = useCallback((key: string) => setItems((prev) => prev.filter((i) => i.key !== key)), []);
  const clear = useCallback(() => setItems([]), []);

  const syncPrices = useCallback((prices: Record<string, number>) => {
    setItems((prev) => {
      let changed = false;
      const next = prev.map((i) => {
        const p = prices[i.key];
        if (typeof p === 'number' && Number.isFinite(p) && p !== i.unitPrice) {
          changed = true;
          return { ...i, unitPrice: p };
        }
        return i;
      });
      return changed ? next : prev;
    });
  }, []);

  // ---- checkout (login first when needed) ----
  const appRef = useRef(app);
  appRef.current = app;
  const pendingCheckout = useRef(false);

  const goToCheckout = () => {
    const a = appRef.current;
    a.setActiveView('customer_portal');
    a.setCustomerSubView('checkout');
    window.scrollTo({ top: 0 });
  };

  const checkout = useCallback(() => {
    const a = appRef.current;
    setIsOpen(false);
    if (a.isLoggedIn && a.currentRole === 'CUSTOMER') {
      goToCheckout();
      return;
    }
    if (a.isLoggedIn) {
      a.addToast('info', 'Customer accounts only', 'Shop orders are placed from a customer account. Log out and sign in with your own mobile number.');
      return;
    }
    pendingCheckout.current = true;
    a.openAuthModal('CUSTOMER');
  }, []);

  useEffect(() => {
    if (!pendingCheckout.current) return;
    if (app.isLoggedIn && app.currentRole === 'CUSTOMER' && !app.isAuthChecking) {
      pendingCheckout.current = false;
      goToCheckout();
    } else if (!app.isLoggedIn && !app.authModalOpen) {
      pendingCheckout.current = false; // closed the login without signing in
    }
  }, [app.isLoggedIn, app.currentRole, app.authModalOpen, app.isAuthChecking]);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((n, i) => n + i.quantity, 0);
    const subtotal = items.reduce((n, i) => n + i.unitPrice * i.quantity, 0);
    return {
      items,
      count,
      subtotal,
      lines: items.map(({ kind, productId, variantId, quantity }) => ({ kind, productId, variantId: variantId ?? null, quantity })),
      add,
      setQuantity,
      remove,
      clear,
      syncPrices,
      isOpen,
      openCart: () => {
        setLastAdded(null);
        setIsOpen(true);
      },
      closeCart: () => setIsOpen(false),
      checkout,
      lastAdded,
      dismissAdded: () => setLastAdded(null),
    };
  }, [items, isOpen, lastAdded, add, setQuantity, remove, clear, syncPrices, checkout]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
