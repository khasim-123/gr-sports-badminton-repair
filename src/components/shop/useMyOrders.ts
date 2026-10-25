import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { shopService } from '../../services/shopService';
import type { ShopOrder } from '../../types/shop';

export interface MyOrdersState {
  /** 'unsupported' = this server has no shop orders yet (404). */
  status: 'loading' | 'ready' | 'error' | 'unsupported';
  orders: ShopOrder[];
}

const byNewest = (a: ShopOrder, b: ShopOrder) => (b.createdAt || '').localeCompare(a.createdAt || '');

/** The signed-in customer's shop orders (GET /api/orders), newest first. */
export function useMyOrders(enabled = true) {
  const [state, setState] = useState<MyOrdersState>({ status: 'loading', orders: [] });

  const reload = useCallback(() => {
    setState((s) => ({ ...s, status: s.orders.length ? s.status : 'loading' }));
    shopService
      .getOrders()
      .then((list) => setState({ status: 'ready', orders: (Array.isArray(list) ? list : []).slice().sort(byNewest) }))
      .catch((err) => setState({ status: err instanceof ApiError && err.status === 404 ? 'unsupported' : 'error', orders: [] }));
  }, []);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  const replace = useCallback((order: ShopOrder) => {
    setState((s) => ({
      ...s,
      orders: s.orders.some((o) => o.id === order.id) ? s.orders.map((o) => (o.id === order.id ? order : o)) : [order, ...s.orders],
    }));
  }, []);

  return { ...state, reload, replace };
}
