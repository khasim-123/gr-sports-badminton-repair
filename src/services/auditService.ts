import { apiClient } from './apiClient';
import { AuditLogItem } from '../types';

export const auditService = {
  async getAuditLogs(): Promise<AuditLogItem[]> {
    return apiClient.get<AuditLogItem[]>('/audit-logs');
  },
};
