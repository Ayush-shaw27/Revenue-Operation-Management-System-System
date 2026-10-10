'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, ApiError, getStoredUser } from '@/api/client';
import type { User } from '@/api/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {
    throw new Error('AuthProvider not mounted');
  },
  logout: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const fresh = await api.me();
      setUser(fresh);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('revops_user', JSON.stringify(fresh));
      }
    } catch (err) {
      // Only a rejected token should end the session.  The previous version
      // logged the user out on *any* throw, including a 500 from a restarting
      // backend and the network error you get when you close the laptop lid -
      // so a working session was silently destroyed by an outage.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        api.logout();
        setUser(null);
        return;
      }
      // Transient failure: keep the cached user so a blip does not kick the
      // user out.  The token stays, and the next call will re-validate it.
    }
  }, []);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) {
      setUser(stored);
      // Revalidate the token in the background.
      refreshUser().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string): Promise<User> => {
      const data = await api.login(email, password);
      setUser(data.user);
      return data.user;
    },
    [],
  );

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: Boolean(user), login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}