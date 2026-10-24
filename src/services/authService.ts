/**
 * GR Sports Platform - Authentication Service
 * Endpoints for Player, Staff, and Admin authentication.
 *
 * The backend issues a signed JWT (`token`) with every AuthSession. The full
 * session (including the token) is kept in localStorage so `apiClient` can send
 * it as a Bearer token. Never overwrite the stored session without the token —
 * use `updateStoredSession` for partial updates (view state, profile edits).
 */
import { apiClient, AUTH_SESSION_STORAGE_KEY } from './apiClient';
import { UserRole } from '../types';
import { formatMobile, normalizeMobile } from '../utils/phone';

export interface AuthSession {
  isLoggedIn: boolean;
  token?: string;
  role: UserRole;
  name: string;
  /** The user's identity: an Indian mobile number, always "+91XXXXXXXXXX". */
  mobile: string;
  title?: string;
  /** True when an SMS-code login succeeded for a number that has no customer account yet. */
  isNewCustomer?: boolean;
  activeView?: string;
  customerSubView?: string;
  employeeSubView?: string;
  adminSubView?: string;
}

/**
 * Customers log in with `phone` + `otp` (SMS code) only.
 * Staff and admins log in with `phone` + `password`.
 */
export interface LoginCredentials {
  phone: string;
  password?: string;
  otp?: string;
  role: UserRole;
}

export interface OtpRequestResponse {
  success: boolean;
  message: string;
  /** Whether the SMS was actually handed to the SMS provider. */
  smsSent?: boolean;
  /** Only present when the server runs in dev/demo mode (EXPOSE_OTP_IN_RESPONSE). */
  otp?: string;
}

/** The mobile number comes from the Bearer token of the SMS-code login. */
export interface RegisterCustomerPayload {
  name: string;
  address?: string;
}

const STORAGE_KEY = AUTH_SESSION_STORAGE_KEY;

export const authService = {
  // ---------- Local Session Management ----------
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

  /**
   * Merge a partial update into the stored session, preserving the token.
   * Does nothing (returns null) when there is no stored session, so it can
   * never resurrect a session that was cleared (e.g. after a 401).
   */
  updateStoredSession(patch: Partial<AuthSession>): AuthSession | null {
    const current = this.getStoredSession();
    if (!current) return null;
    const next: AuthSession = { ...current, ...patch, token: patch.token || current.token };
    this.setStoredSession(next);
    return next;
  },

  clearStoredSession(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear session from localStorage', e);
    }
  },

  // ---------- Remote API Calls ----------
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    if (!apiClient.isMockEnabled()) {
      const response = await apiClient.post<AuthSession>('/auth/login', credentials);
      this.setStoredSession(response);
      return response;
    }

    // Offline mock mode (development only) — no fabricated identities.
    const mockSession: AuthSession = {
      isLoggedIn: true,
      token: `mock_jwt_${credentials.role.toLowerCase()}_${Date.now()}`,
      role: credentials.role,
      name: '',
      mobile: normalizeMobile(credentials.phone) || credentials.phone,
      isNewCustomer: credentials.role === 'CUSTOMER',
    };
    this.setStoredSession(mockSession);
    return mockSession;
  },

  /** Sends a 6-digit login code by SMS to the given mobile number. */
  async requestOtp(phone: string): Promise<OtpRequestResponse> {
    if (!apiClient.isMockEnabled()) {
      return apiClient.post<OtpRequestResponse>('/auth/otp/request', { phone });
    }
    return { success: true, message: 'Verification code sent by SMS to ' + formatMobile(phone), smsSent: false };
  },

  /**
   * Complete a new customer's profile. Requires the Bearer token from the OTP
   * login (the mobile number is taken from it). The returned session (fresh token) replaces the
   * stored one.
   */
  /** Customer: update name / address on the account (PATCH /api/auth/profile). */
  async updateProfile(payload: { name?: string; address?: string }): Promise<AuthSession> {
    const response = await apiClient.patch<AuthSession>('/auth/profile', payload);
    const previous = this.getStoredSession();
    const session: AuthSession = { ...(previous || {}), ...response, token: response.token || previous?.token };
    this.setStoredSession(session);
    return session;
  },

  async register(payload: RegisterCustomerPayload): Promise<AuthSession> {
    const body: RegisterCustomerPayload = { name: payload.name.trim() };
    if (payload.address && payload.address.trim()) body.address = payload.address.trim();

    if (!apiClient.isMockEnabled()) {
      const response = await apiClient.post<AuthSession>('/auth/register-customer', body);
      const previous = this.getStoredSession();
      const session: AuthSession = {
        ...response,
        isNewCustomer: false,
        token: response.token || previous?.token,
      };
      this.setStoredSession(session);
      return session;
    }

    const mockSession: AuthSession = {
      isLoggedIn: true,
      token: this.getStoredSession()?.token || `mock_jwt_customer_${Date.now()}`,
      role: 'CUSTOMER',
      name: body.name,
      mobile: this.getStoredSession()?.mobile || '',
      isNewCustomer: false,
    };
    this.setStoredSession(mockSession);
    return mockSession;
  },

  /** GET /auth/me — validates the stored token and returns the current session. */
  async me(): Promise<AuthSession> {
    if (!apiClient.isMockEnabled()) {
      const response = await apiClient.get<AuthSession>('/auth/me');
      // Only take identity fields; keep locally persisted view state and token.
      const merged = this.updateStoredSession({
        isLoggedIn: true,
        token: response.token || undefined,
        role: response.role,
        name: response.name,
        mobile: response.mobile,
        title: response.title ?? undefined,
      });
      return merged || response;
    }
    const stored = this.getStoredSession();
    if (!stored) throw new Error('Not logged in');
    return stored;
  },

  async logout(): Promise<void> {
    if (!apiClient.isMockEnabled()) {
      // The token is read synchronously when the request starts, so the local
      // session can be cleared immediately without waiting for the server.
      const pending = apiClient.post('/auth/logout').catch(() => undefined);
      this.clearStoredSession();
      await pending;
      return;
    }
    this.clearStoredSession();
  },
};
