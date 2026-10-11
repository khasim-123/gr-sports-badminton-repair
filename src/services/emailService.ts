import { apiClient } from './apiClient';
import { EmailTemplate } from '../types';

export const emailService = {
  async getTemplates(): Promise<EmailTemplate[]> {
    return apiClient.get<EmailTemplate[]>('/emails/templates');
  },

  async updateTemplate(id: string, subject: string, body: string): Promise<EmailTemplate> {
    return apiClient.put<EmailTemplate>(`/emails/templates/${id}`, { subject, body });
  },

  async simulateEmail(templateId: string, recipient: string, variables: Record<string, any>): Promise<any> {
    return apiClient.post<any>('/emails/simulate', {
      templateId,
      recipient,
      variables,
    });
  },
};

