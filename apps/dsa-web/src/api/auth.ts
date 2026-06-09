import apiClient from './index';

// --- Types ---

export interface UserInfo {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  roles?: string[];  // N:M from user_roles
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthStatusResponse {
  authEnabled: boolean;
  loggedIn: boolean;
  passwordSet?: boolean;
  passwordChangeable?: boolean;
  setupState: 'enabled' | 'password_retained' | 'no_password';
  authMethod?: 'jwt' | 'cookie';
  user?: UserInfo;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: UserInfo;
}

export interface UsersListResponse {
  items: UserInfo[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// --- Token storage ---

const TOKEN_KEY = 'dsa_access_token';
const REFRESH_TOKEN_KEY = 'dsa_refresh_token';
const USER_KEY = 'dsa_user';

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser(): UserInfo | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeAuth(accessToken: string, refreshToken: string, user: UserInfo): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// --- API ---

export const authApi = {
  // Legacy compatibility
  async getStatus(): Promise<AuthStatusResponse> {
    const { data } = await apiClient.get<AuthStatusResponse>('/api/v1/auth/status');
    // Merge stored user if authMethod not present
    if (!data.user) {
      const stored = getStoredUser();
      if (stored) {
        data.user = stored;
        data.loggedIn = true;
        data.authMethod = 'jwt';
      }
    }
    return data;
  },

  // JWT login
  async token(username: string, password: string): Promise<TokenResponse> {
    const { data } = await apiClient.post<TokenResponse>('/api/v1/auth/token', {
      username,
      password,
    });
    storeAuth(data.access_token, data.refresh_token, data.user);
    return data;
  },

  // Register
  async register(
    username: string,
    password: string,
    email: string = ''
  ): Promise<TokenResponse> {
    const { data } = await apiClient.post<TokenResponse>('/api/v1/auth/register', {
      username,
      password,
      email,
    });
    storeAuth(data.access_token, data.refresh_token, data.user);
    return data;
  },

  // Refresh token
  async refresh(): Promise<string | null> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    try {
      const { data } = await apiClient.post<{ access_token: string; token_type: string }>(
        '/api/v1/auth/refresh',
        { refreshToken }
      );
      localStorage.setItem(TOKEN_KEY, data.access_token);
      return data.access_token;
    } catch {
      clearAuth();
      return null;
    }
  },

  // Legacy — kept for backward compat with settings page
  async login(password: string, passwordConfirm?: string): Promise<void> {
    const body: { password: string; passwordConfirm?: string } = { password };
    if (passwordConfirm !== undefined) {
      body.passwordConfirm = passwordConfirm;
    }
    await apiClient.post('/api/v1/auth/login', body);
  },

  async updateSettings(
    authEnabled: boolean,
    password?: string,
    passwordConfirm?: string,
    currentPassword?: string
  ): Promise<AuthStatusResponse> {
    const body: {
      authEnabled: boolean;
      password?: string;
      passwordConfirm?: string;
      currentPassword?: string;
    } = { authEnabled };
    if (password !== undefined) body.password = password;
    if (passwordConfirm !== undefined) body.passwordConfirm = passwordConfirm;
    if (currentPassword !== undefined) body.currentPassword = currentPassword;
    const { data } = await apiClient.post<AuthStatusResponse>('/api/v1/auth/settings', body);
    return data;
  },

  async changePassword(
    currentPassword: string,
    newPassword: string,
    newPasswordConfirm: string
  ): Promise<void> {
    await apiClient.post('/api/v1/auth/change-password', {
      currentPassword,
      newPassword,
      newPasswordConfirm,
    });
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/api/v1/auth/logout');
    } finally {
      clearAuth();
    }
  },

  // --- User management (admin) ---

  async listUsers(page = 1, pageSize = 20): Promise<UsersListResponse> {
    const { data } = await apiClient.get<UsersListResponse>('/api/v1/users', {
      params: { page, page_size: pageSize },
    });
    return data;
  },

  async createUser(
    username: string,
    password: string,
    role: string = 'user',
    email: string = ''
  ): Promise<{ ok: boolean; user: UserInfo }> {
    const { data } = await apiClient.post<{ ok: boolean; user: UserInfo }>('/api/v1/users', {
      username,
      password,
      role,
      email,
    });
    return data;
  },

  async updateUser(
    userId: number,
    fields: { email?: string; role?: string; is_active?: boolean; password?: string }
  ): Promise<{ ok: boolean; user: UserInfo }> {
    const { data } = await apiClient.put<{ ok: boolean; user: UserInfo }>(
      `/api/v1/users/${userId}`,
      fields
    );
    return data;
  },

  async deleteUser(userId: number): Promise<{ ok: boolean }> {
    const { data } = await apiClient.delete<{ ok: boolean }>(`/api/v1/users/${userId}`);
    return data;
  },

  async getMyProfile(): Promise<UserInfo> {
    const { data } = await apiClient.get<UserInfo>('/api/v1/users/me/profile');
    return data;
  },

  async assignRoles(userId: number, roles: string[]): Promise<{ ok: boolean; roles: string[] }> {
    const { data } = await apiClient.put<{ ok: boolean; roles: string[] }>(`/api/v1/users/${userId}/roles`, { roles });
    return data;
  },

  async changeMyPassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiClient.put('/api/v1/users/me/password', {
      currentPassword,
      newPassword,
    });
  },

  // --- Role management (admin) ---

  async listRoles(): Promise<{ items: any[] }> {
    const { data } = await apiClient.get<{ items: any[] }>('/api/v1/roles');
    return data;
  },

  async getPermissions(): Promise<{ permissions: { key: string; label: string }[] }> {
    const { data } = await apiClient.get<{ permissions: { key: string; label: string }[] }>('/api/v1/roles/permissions');
    return data;
  },

  async createRole(name: string, displayName: string, permissions: string[], description = ''): Promise<any> {
    const { data } = await apiClient.post('/api/v1/roles', { name, displayName, permissions, description });
    return data;
  },

  async updateRole(roleId: number, fields: { displayName?: string; description?: string; permissions?: string[] }): Promise<any> {
    const { data } = await apiClient.put(`/api/v1/roles/${roleId}`, fields);
    return data;
  },

  async deleteRole(roleId: number): Promise<any> {
    const { data } = await apiClient.delete(`/api/v1/roles/${roleId}`);
    return data;
  },

  // --- Permissions ---

  async getMyPermissions(): Promise<{ permissions: string[] }> {
    const response = await apiClient.get<{ permissions: string[] }>('/api/v1/users/me/permissions');
    return response.data;
  },
};
