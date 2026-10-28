import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi } from '../api/endpoints';
import { setUnauthorizedHandler } from '../api/http';
import { AuthContext, type AuthContextValue, type LogoutReason } from './context';
import { clearSession, loadSession, saveSession, type Session } from './session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [logoutReason, setLogoutReason] = useState<LogoutReason | null>(null);

  const logout = useCallback(
    (reason: LogoutReason = 'manual') => {
      clearSession();
      setSession(null);
      setLogoutReason(reason);
      // Never show cached data from the previous user.
      queryClient.clear();
    },
    [queryClient],
  );

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    const next: Session = {
      token: result.accessToken,
      user: result.user,
      expiresAt: Date.now() + result.expiresIn * 1000,
    };
    saveSession(next);
    setSession(next);
    setLogoutReason(null);
  }, []);

  // Any 401 from either API (expired or invalid token) ends the session.
  useEffect(() => {
    setUnauthorizedHandler(() => logout('expired'));
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Log out exactly when the token expires.
  useEffect(() => {
    if (!session) return;
    const timeout = window.setTimeout(() => logout('expired'), session.expiresAt - Date.now());
    return () => window.clearTimeout(timeout);
  }, [session, logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      isAdmin: session?.user.role === 'admin',
      logoutReason,
      login,
      logout,
    }),
    [session, logoutReason, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
