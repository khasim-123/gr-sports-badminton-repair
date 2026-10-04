/**
 * GR Sports Platform - Service Requests API Service
 * Standard REST interface for booking, inspecting, and managing badminton service jobs.
 */
import { apiClient } from './apiClient';
import {
  ServiceRequest,
  RequestStatus,
  BatConditionAtPickup,
  RepairEstimate,
  PaymentMethod,
} from '../types';

export interface RequestFilterParams {
  status?: string;
  serviceType?: string;
  search?: string;
  customerId?: string;
}

export const requestService = {
  /**
   * Fetch all service requests with optional filtering
   * GET /api/requests?status=...&serviceType=...
   */
  async getRequests(filters?: RequestFilterParams): Promise<ServiceRequest[]> {
    if (!apiClient.isMockEnabled()) {
      const query = new URLSearchParams(filters as Record<string, string>).toString();
      return apiClient.get<ServiceRequest[]>(`/requests${query ? `?${query}` : ''}`);
    }
    // Mock local storage read
    const saved = localStorage.getItem('shuttlecraft_requests');
    return saved ? JSON.parse(saved) : [];
  },

  /**
   * Fetch a single request by its reference ID (e.g., REP-00025)
   * GET /api/requests/:id
   */
  async getRequestById(id: string): Promise<ServiceRequest | null> {
    if (!apiClient.isMockEnabled()) {
      return apiClient.get<ServiceRequest>(`/requests/${id}`);
    }
    const list = await this.getRequests();
    return list.find((r) => r.id === id) || null;
  },

  /**
   * Submit a new badminton service request (Getting or Repair)
   * POST /api/requests
   */
  async createRequest(payload: Partial<ServiceRequest>): Promise<ServiceRequest> {
    if (!apiClient.isMockEnabled()) {
      return apiClient.post<ServiceRequest>('/requests', payload);
    }
    // Local mock handler
    const id = `${payload.serviceType === 'GETTING' ? 'GET' : 'REP'}-${String(Math.floor(Math.random() * 90000) + 10000)}`;
    const newRequest = { ...payload, id } as ServiceRequest;
    return newRequest;
  },

  /**
   * Update request status & add timeline entry
   * PATCH /api/requests/:id/status
   */
  async updateStatus(
    id: string,
    status: RequestStatus,
    actor: string,
    notes?: string
  ): Promise<ServiceRequest> {
    if (!apiClient.isMockEnabled()) {
      return apiClient.patch<ServiceRequest>(`/requests/${id}/status`, {
        status,
        actor,
        notes,
      });
    }
    const current = await this.getRequestById(id);
    if (!current) throw new Error('Request not found');
    return { ...current, status };
  },

  /**
   * Assign an operations technician or stringer to a request
   * POST /api/requests/:id/assign
   */
  async assignTechnician(id: string, employeeId: string): Promise<ServiceRequest> {
    if (!apiClient.isMockEnabled()) {
      return apiClient.post<ServiceRequest>(`/requests/${id}/assign`, { employeeId });
    }
    const current = await this.getRequestById(id);
    if (!current) throw new Error('Request not found');
    return { ...current, assignedEmployeeId: employeeId };
  },

  /**
   * Log physical bat condition at doorstep pickup
   * POST /api/requests/:id/pickup-condition
   */
  async recordPickupCondition(
    id: string,
    condition: BatConditionAtPickup,
    notes: string,
    photos: string[]
  ): Promise<ServiceRequest> {
    if (!apiClient.isMockEnabled()) {
      return apiClient.post<ServiceRequest>(`/requests/${id}/pickup-condition`, {
        condition,
        notes,
        photos,
      });
    }
    const current = await this.getRequestById(id);
    if (!current) throw new Error('Request not found');
    return current;
  },

  /**
   * Submit itemized workshop repair estimate
   * POST /api/requests/:id/estimate
   */
  async createRepairEstimate(id: string, estimate: RepairEstimate): Promise<ServiceRequest> {
    if (!apiClient.isMockEnabled()) {
      return apiClient.post<ServiceRequest>(`/requests/${id}/estimate`, estimate);
    }
    const current = await this.getRequestById(id);
    if (!current) throw new Error('Request not found');
    return { ...current, repairEstimate: estimate };
  },

  /**
   * Customer approval of initial or revised repair estimate
   * POST /api/requests/:id/estimate/approve
   */
  async approveRepairEstimate(id: string): Promise<ServiceRequest> {
    if (!apiClient.isMockEnabled()) {
      return apiClient.post<ServiceRequest>(`/requests/${id}/estimate/approve`);
    }
    const current = await this.getRequestById(id);
    if (!current) throw new Error('Request not found');
    return current;
  },

  /**
   * Customer decline of repair estimate
   * POST /api/requests/:id/estimate/decline
   */
  async declineRepairEstimate(id: string): Promise<ServiceRequest> {
    if (!apiClient.isMockEnabled()) {
      return apiClient.post<ServiceRequest>(`/requests/${id}/estimate/decline`);
    }
    const current = await this.getRequestById(id);
    if (!current) throw new Error('Request not found');
    return current;
  },

  /**
   * Workshop technician requests price revision due to hidden damage
   * POST /api/requests/:id/estimate/revise
   */
  async requestPriceRevision(
    id: string,
    additionalAmount: number,
    newTotal: number,
    reason: string
  ): Promise<ServiceRequest> {
    if (!apiClient.isMockEnabled()) {
      return apiClient.post<ServiceRequest>(`/requests/${id}/estimate/revise`, {
        additionalAmount,
        newTotal,
        reason,
      });
    }
    const current = await this.getRequestById(id);
    if (!current) throw new Error('Request not found');
    return current;
  },

  /**
   * Record in-person payment (Cash or UPI) collected on doorstep delivery
   * POST /api/requests/:id/payment
   */
  async recordPayment(
    id: string,
    amount: number,
    method: PaymentMethod,
    notes?: string
  ): Promise<ServiceRequest> {
    if (!apiClient.isMockEnabled()) {
      return apiClient.post<ServiceRequest>(`/requests/${id}/payment`, {
        amount,
        method,
        notes,
      });
    }
    const current = await this.getRequestById(id);
    if (!current) throw new Error('Request not found');
    return current;
  },
};
