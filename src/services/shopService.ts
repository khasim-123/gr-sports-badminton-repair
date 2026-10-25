/**
 * Shop: T-shirts & apparel catalogue, cart price checks and orders.
 */
import { apiClient } from './apiClient';
import type {
  ApparelProduct,
  ApparelProductInput,
  ApparelVariant,
  ApparelVariantInput,
  OrderQuote,
  OrderStatus,
  PlaceOrderInput,
  QuoteInput,
  ShopOrder,
} from '../types/shop';

export const shopService = {
  // ---------- Public ----------

  /** Active apparel products, featured first. */
  getApparel(): Promise<ApparelProduct[]> {
    return apiClient.get<ApparelProduct[]>('/shop/apparel');
  },

  /** Current prices, stock and delivery charge for a cart (no login needed). */
  quote(input: QuoteInput): Promise<OrderQuote> {
    return apiClient.post<OrderQuote>('/shop/quote', input);
  },

  // ---------- Customer (and admin) ----------

  placeOrder(input: PlaceOrderInput): Promise<ShopOrder> {
    return apiClient.post<ShopOrder>('/orders', input);
  },

  /** Customers get their own orders; admins get every order. */
  getOrders(): Promise<ShopOrder[]> {
    return apiClient.get<ShopOrder[]>('/orders');
  },

  getOrder(id: string): Promise<ShopOrder> {
    return apiClient.get<ShopOrder>(`/orders/${id}`);
  },

  /** Customers may cancel while the order is Placed or Confirmed; the admin until it is delivered. */
  cancelOrder(id: string, reason: string): Promise<ShopOrder> {
    return apiClient.post<ShopOrder>(`/orders/${id}/cancel`, { reason });
  },

  // ---------- Admin ----------

  updateOrderStatus(id: string, status: OrderStatus, notes?: string): Promise<ShopOrder> {
    return apiClient.patch<ShopOrder>(`/orders/${id}/status`, { status, notes });
  },

  /** Amount must equal the order total (a different amount needs a note). */
  recordOrderPayment(id: string, amount: number, method: 'Cash' | 'UPI' | 'Other', notes?: string): Promise<ShopOrder> {
    return apiClient.post<ShopOrder>(`/orders/${id}/payment`, { amount, method, notes });
  },

  listApparel(): Promise<ApparelProduct[]> {
    return apiClient.get<ApparelProduct[]>('/shop/admin/apparel');
  },
  createApparel(input: ApparelProductInput): Promise<ApparelProduct> {
    return apiClient.post<ApparelProduct>('/shop/admin/apparel', input);
  },
  updateApparel(id: string, input: Partial<ApparelProductInput>): Promise<ApparelProduct> {
    return apiClient.put<ApparelProduct>(`/shop/admin/apparel/${id}`, input);
  },
  deleteApparel(id: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/shop/admin/apparel/${id}`);
  },
  addApparelVariant(productId: string, input: ApparelVariantInput): Promise<ApparelVariant> {
    return apiClient.post<ApparelVariant>(`/shop/admin/apparel/${productId}/variants`, input);
  },
  updateApparelVariant(variantId: string, input: Partial<ApparelVariantInput>): Promise<ApparelVariant> {
    return apiClient.put<ApparelVariant>(`/shop/admin/apparel-variants/${variantId}`, input);
  },
  deleteApparelVariant(variantId: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/shop/admin/apparel-variants/${variantId}`);
  },
};
