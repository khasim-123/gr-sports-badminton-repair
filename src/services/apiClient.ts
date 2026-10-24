/**
 * GR Sports Platform - API Client
 * Enterprise HTTP service client with automatic auth header injection,
 * JSON serialization, error normalization, and mock fallback.
 */

const metaEnv = (import.meta as any).env || {};
const API_BASE_URL: string =
  metaEnv.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1'
    ? 'https://badminton-service-backend.onrender.com/api'
    : '/api');
const USE_MOCK_API: boolean = false;

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/** localStorage key holding the signed-in user's AuthSession (incl. JWT). */
export const AUTH_SESSION_STORAGE_KEY = 'shuttlecraft_auth_session';

/**
 * Fired on `window` when an authenticated request comes back 401
 * (token missing/expired/invalid). AppContext listens and logs the user out.
 */
export const SESSION_EXPIRED_EVENT = 'gr:session-expired';

/**
 * Endpoints whose 401 means "bad credentials", not "session expired".
 * They must never trigger the global session-expired logout.
 */
const NON_SESSION_ENDPOINTS = ['/auth/login', '/auth/otp/request', '/auth/logout'];

const isNonSessionEndpoint = (endpoint: string): boolean =>
  NON_SESSION_ENDPOINTS.some((p) => endpoint === p || endpoint.startsWith(`${p}?`) || endpoint.endsWith(p));

/**
 * Clears the stored session and notifies the app — at most once per token,
 * so parallel requests failing with the same expired token don't loop/spam.
 */
const handleUnauthorized = (usedToken: string) => {
  if (getAuthToken() !== usedToken) return; // already handled (or a new session replaced it)
  try {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
};

export const getAuthToken = (): string | null => {
  try {
    const session = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (session) {
      const parsed = JSON.parse(session);
      return parsed.token || null;
    }
  } catch {
    // fallback
  }
  return null;
};

export interface ApiClient {
  isMockEnabled: () => boolean;
  baseUrl: string;
  request<T = any>(endpoint: string, options?: RequestInit): Promise<T>;
  get<T = any>(endpoint: string): Promise<T>;
  post<T = any>(endpoint: string, body?: any): Promise<T>;
  put<T = any>(endpoint: string, body?: any): Promise<T>;
  patch<T = any>(endpoint: string, body?: any): Promise<T>;
  delete<T = any>(endpoint: string): Promise<T>;
}

export const apiClient: ApiClient = {
  isMockEnabled: () => USE_MOCK_API,
  baseUrl: API_BASE_URL,

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorData = null;
        try {
          errorData = await response.json();
        } catch {
          // ignore
        }
        const detail = Array.isArray(errorData?.detail)
          ? errorData.detail.map((d: any) => d?.msg).filter(Boolean).join('; ')
          : errorData?.detail;
        if (response.status === 401 && token && !isNonSessionEndpoint(endpoint)) {
          handleUnauthorized(token);
        }
        throw new ApiError(
          (typeof detail === 'string' && detail) || errorData?.message || `HTTP Request failed with status ${response.status}`,
          response.status,
          errorData
        );
      }

      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        error instanceof TypeError
          ? 'Unable to reach the GR Sports server. Please check your connection and try again.'
          : error?.message || 'Network connection failed',
        0
      );
    }
  },

  get<T = any>(endpoint: string): Promise<T> {
    return apiClient.request<T>(endpoint, { method: 'GET' });
  },

  post<T = any>(endpoint: string, body?: any): Promise<T> {
    return apiClient.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T = any>(endpoint: string, body?: any): Promise<T> {
    return apiClient.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T = any>(endpoint: string, body?: any): Promise<T> {
    return apiClient.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T = any>(endpoint: string): Promise<T> {
    return apiClient.request<T>(endpoint, { method: 'DELETE' });
  },
};
