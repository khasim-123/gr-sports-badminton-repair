/**
 * GR Sports Platform - API Client
 * Enterprise HTTP service client with automatic auth header injection,
 * JSON serialization, error normalization, and mock fallback.
 */

const metaEnv = (import.meta as any).env || {};
const API_BASE_URL: string = metaEnv.VITE_API_BASE_URL || '/api';
const USE_MOCK_API: boolean = metaEnv.VITE_USE_MOCK_API !== 'false';

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

export const getAuthToken = (): string | null => {
  try {
    const session = localStorage.getItem('shuttlecraft_auth_session');
    if (session) {
      const parsed = JSON.parse(session);
      return parsed.token || 'mock_jwt_token_shuttlecraft';
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
        throw new ApiError(
          errorData?.message || `HTTP Request failed with status ${response.status}`,
          response.status,
          errorData
        );
      }

      return (await response.json()) as T;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(error.message || 'Network connection failed', 0);
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
