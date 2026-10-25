import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { shopService } from '../../services/shopService';
import type { CartItemKind, OrderQuote, QuoteInput } from '../../types/shop';
import { cartKey } from '../../context/CartContext';

export interface QuoteState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  quote: OrderQuote | null;
  /** HTTP status of the last failure (0 = offline). */
  errorStatus?: number;
  errorMessage?: string;
}

export const lineKey = (l: { kind: CartItemKind; productId: string; variantId?: string | null }) =>
  cartKey(l.kind, l.productId, l.variantId);

/**
 * Server price check for the cart (POST /api/shop/quote), re-run whenever the input changes
 * (debounced). Pass `null` to skip. Keeps the last good quote while a new one loads.
 */
export function useQuote(input: QuoteInput | null): QuoteState & { refresh: () => void } {
  const [state, setState] = useState<QuoteState>({ status: 'idle', quote: null });
  const [nonce, setNonce] = useState(0);
  const key = input && input.items.length ? JSON.stringify(input) : '';

  useEffect(() => {
    if (!key) {
      setState({ status: 'idle', quote: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, status: 'loading' }));
    const body = JSON.parse(key) as QuoteInput;
    const t = window.setTimeout(() => {
      shopService
        .quote(body)
        .then((quote) => {
          if (!cancelled) setState({ status: 'ready', quote });
        })
        .catch((err) => {
          if (cancelled) return;
          setState({
            status: 'error',
            quote: null,
            errorStatus: err instanceof ApiError ? err.status : -1,
            errorMessage: err instanceof Error ? err.message : undefined,
          });
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [key, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, refresh };
}
