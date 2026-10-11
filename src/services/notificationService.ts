import { apiClient } from './apiClient';
import { AppNotification } from '../types';

export const notificationService = {
  async getNotifications(role?: string, unreadOnly: boolean = false): Promise<AppNotification[]> {
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    if (unreadOnly) params.append('unreadOnly', 'true');
    const qs = params.toString();
    return apiClient.get<AppNotification[]>(`/notifications${qs ? `?${qs}` : ''}`);
  },

  async addNotification(
    data: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>
  ): Promise<AppNotification> {
    return apiClient.post<AppNotification>('/notifications', data);
  },

  async markAsRead(id: string): Promise<AppNotification> {
    return apiClient.patch<AppNotification>(`/notifications/${id}/read`);
  },

  async markAllRead(): Promise<{ success: boolean; message: string }> {
    return apiClient.post<{ success: boolean; message: string }>('/notifications/mark-all-read');
  },

  async deleteNotification(id: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete<{ success: boolean; message: string }>(`/notifications/${id}`);
  },
};

