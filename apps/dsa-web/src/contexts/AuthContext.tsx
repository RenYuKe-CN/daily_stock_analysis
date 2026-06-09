import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createParsedApiError, getParsedApiError, type ParsedApiError } from '../api/error';
import { authApi, clearAuth, getAccessToken, getStoredUser, type UserInfo } from '../api/auth';
import { useStockPoolStore } from '../stores';

type AuthContextValue = {
  // State
  user: UserInfo | null;
  loggedIn: boolean;
  isLoading: boolean;
  loadError: ParsedApiError | null;
  // Legacy compat
  authEnabled: boolean;
  passwordSet: boolean;
  passwordChangeable: boolean;
  setupState: 'enabled' | 'password_retained' | 'no_password';
  // Actions
  login: (username: string, password: string) => Promise<{ success: boolean; error?: ParsedApiError }>;
  register: (username: string, password: string, email?: string) => Promise<{ success: boolean; error?: ParsedApiError }>;
  logout: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  // Legacy compat
  loginLegacy: (password: string, passwordConfirm?: string) => Promise<{ success: boolean; error?: ParsedApiError }>;
  changePassword: (current: string, newPwd: string, newConfirm: string) => Promise<{ success: boolean; error?: ParsedApiError }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function extractLoginError(err: unknown): ParsedApiError {
  const parsed = getParsedApiError(err);
  if (parsed.status === 429) {
    return createParsedApiError({
      title: '操作过于频繁',
      message: '尝试次数过多，请稍后再试。',
      rawMessage: parsed.rawMessage,
      status: parsed.status,
      category: parsed.category,
    });
  }
  return parsed;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(getStoredUser());
  const [loggedIn, setLoggedIn] = useState(!!getAccessToken());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<ParsedApiError | null>(null);
  // Legacy compat
  const [authEnabled, setAuthEnabled] = useState(false);
  const [passwordSet, setPasswordSet] = useState(false);
  const [passwordChangeable, setPasswordChangeable] = useState(false);
  const [setupState, setSetupState] = useState<'enabled' | 'password_retained' | 'no_password'>('no_password');

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const status = await authApi.getStatus();
      setAuthEnabled(status.authEnabled);
      setPasswordSet(status.passwordSet ?? false);
      setPasswordChangeable(status.passwordChangeable ?? false);
      setSetupState(status.setupState);
      // JWT user from API response takes priority over stored
      if (status.user) {
        setUser(status.user);
        setLoggedIn(true);
      } else {
        const storedUser = getStoredUser();
        const hasToken = !!getAccessToken();
        setLoggedIn(hasToken && !!storedUser);
        setUser(storedUser);
      }
      if (!status.loggedIn && !getAccessToken()) {
        useStockPoolStore.getState().resetDashboardState();
      }
    } catch (err) {
      setLoadError(getParsedApiError(err));
      setLoggedIn(false);
      setUser(null);
      setAuthEnabled(false);
      setPasswordSet(false);
      setPasswordChangeable(false);
      setSetupState('no_password');
      useStockPoolStore.getState().resetDashboardState();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // JWT login
  const login = useCallback(
    async (username: string, password: string): Promise<{ success: boolean; error?: ParsedApiError }> => {
      try {
        const result = await authApi.token(username, password);
        setUser(result.user);
        setLoggedIn(true);
        return { success: true };
      } catch (err: unknown) {
        return { success: false, error: extractLoginError(err) };
      }
    },
    []
  );

  // Register
  const register = useCallback(
    async (username: string, password: string, email?: string): Promise<{ success: boolean; error?: ParsedApiError }> => {
      try {
        const result = await authApi.register(username, password, email ?? '');
        setUser(result.user);
        setLoggedIn(true);
        return { success: true };
      } catch (err: unknown) {
        return { success: false, error: extractLoginError(err) };
      }
    },
    []
  );

  // Legacy login (cookie-based, backward compat)
  const loginLegacy = useCallback(
    async (password: string, passwordConfirm?: string): Promise<{ success: boolean; error?: ParsedApiError }> => {
      try {
        await authApi.login(password, passwordConfirm);
        await fetchStatus();
        return { success: true };
      } catch (err: unknown) {
        return { success: false, error: extractLoginError(err) };
      }
    },
    [fetchStatus]
  );

  // Legacy changePassword (used by ChangePasswordCard)
  const changePassword = useCallback(
    async (current: string, newPwd: string, _newConfirm: string): Promise<{ success: boolean; error?: ParsedApiError }> => {
      try {
        await authApi.changeMyPassword(current, newPwd);
        return { success: true };
      } catch (err: unknown) {
        return { success: false, error: getParsedApiError(err) };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout API errors
    }
    clearAuth();
    setUser(null);
    setLoggedIn(false);
    useStockPoolStore.getState().resetDashboardState();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loggedIn,
        isLoading,
        loadError,
        authEnabled,
        passwordSet,
        passwordChangeable,
        setupState,
        login,
        register,
        logout,
        refreshStatus: fetchStatus,
        loginLegacy,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
