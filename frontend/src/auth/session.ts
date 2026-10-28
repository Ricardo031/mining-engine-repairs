import type { User } from '../api/types';

/**
 * The session lives in sessionStorage: it survives a page reload but is gone
 * when the tab is closed, which suits an internal tool.
 */
const STORAGE_KEY = 'mer.session';

export interface Session {
  token: string;
  user: User;
  /** Epoch milliseconds when the token expires. */
  expiresAt: number;
}

export function saveSession(session: Session): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (!session.token || session.expiresAt <= Date.now()) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function getToken(): string | null {
  return loadSession()?.token ?? null;
}
