/**
 * GR Sports Platform - Authentication Service
 * Endpoints for Player, Staff, and Admin authentication.
 */
import { apiClient } from './apiClient';
import { UserRole } from '../types';

export interface AuthSession {
  isLoggedIn: boolean;
  token?: string;
  role: UserRole;
  email: string;
  name: string;
  mobile: string;
  title?: string;
  activeView?: string;
  customerSubView?: string;
  employeeSubView?: string;
  adminSubView?: string;
}

export interface LoginCredentials {
  email: string;
  password?: string;
  otp?: string;
  role: UserRole;
}

const STORAGE_KEY = 'shuttlecraft_auth_session';

export const authService = {
  // Local Session Management
  getStoredSession(): AuthSession | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setStoredSession(session: AuthSession): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      console.error('Failed to save session to localStorage', e);
    }
  },

  clearStoredSession(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear session from localStorage', e);
    }
  },

  // Remote API Calls (Switches to real backend when VITE_USE_MOCK_API=false)
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    if (!apiClient.isMockEnabled()) {
      const response = await apiClient.post<AuthSession>('/auth/login', credentials);
      this.setStoredSession(response);
      return response;
    }

    // Mock Login response
    const mockSession: AuthSession = {
      isLoggedIn: true,
      token: `mock_jwt_${credentials.role.toLowerCase()}_${Date.now()}`,
      role: credentials.role,
      email: credentials.email,
      name:
        credentials.role === 'ADMIN'
          ? 'Priya Anand'
          : credentials.role === 'EMPLOYEE'
          ? 'Rahul Sharma'
          : 'Vikram Malhotra',
      mobile:
        credentials.role === 'ADMIN'
          ? '+91 98451 11223'
          : credentials.role === 'EMPLOYEE'
          ? '+91 98765 43210'
          : '+91 99887 76655',
      title:
        credentials.role === 'ADMIN'
          ? 'Platform Admin & Operations Lead'
          : credentials.role === 'EMPLOYEE'
          ? 'Field Operations & Workshop Technician'
          : 'Tournament Player',
    };

    this.setStoredSession(mockSession);
    return mockSession;
  },

  async requestOtp(mobileOrEmail: string): Promise<{ success: boolean; message: string }> {
    if (!apiClient.isMockEnabled()) {
      return apiClient.post('/auth/otp/request', { identifier: mobileOrEmail });
    }
    return { success: true, message: 'OTP sent to ' + mobileOrEmail };
  },

  async logout(): Promise<void> {
    if (!apiClient.isMockEnabled()) {
      try {
        await apiClient.post('/auth/logout');
      } catch {
        // ignore error on logout
      }
    }
    this.clearStoredSession();
  },
};
