import { apiClient } from './apiClient';
import { Employee } from '../types';

export const employeeService = {
  async getEmployees(): Promise<Employee[]> {
    return apiClient.get<Employee[]>('/employees');
  },

  async getEmployeeById(id: string): Promise<Employee> {
    return apiClient.get<Employee>(`/employees/${id}`);
  },

  async createEmployee(
    data: Omit<Employee, 'id' | 'activeJobsCount' | 'avatar'>
  ): Promise<Employee> {
    return apiClient.post<Employee>('/employees', data);
  },

  async deleteEmployee(id: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete<{ success: boolean; message: string }>(`/employees/${id}`);
  },

  async getEmployeeWorkload(id: string): Promise<any> {
    return apiClient.get<any>(`/employees/${id}/workload`);
  },
};

