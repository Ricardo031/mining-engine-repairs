import { createContext } from 'react';
import type { User } from '../api/types';

export type LogoutReason = 'manual' | 'expired';

export interface AuthContextValue {
  user: User | null;
  isAdmin: boolean;
  /** Why the last session ended; the login page shows a message for "expired". */
  logoutReason: LogoutReason | null;
  login: (email: string, password: string) => Promise<void>;
  logout: (reason?: LogoutReason) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
