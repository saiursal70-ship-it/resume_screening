import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { api } from '../api/client';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isHR: boolean;
  isViewer: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { name: string; email: string; password: string; role?: 'hr' | 'viewer' }) => Promise<User>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkAuth = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.auth.me();
      if (data && data.id) {
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string): Promise<User> => {
    setError(null);
    try {
      const data = await api.auth.login(email, password);
      setUser(data);
      return data;
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Login failed');
      throw err;
    }
  };

  const register = async (data: {
    name: string;
    email: string;
    password: string;
    role?: 'hr' | 'viewer';
  }): Promise<User> => {
    setError(null);
    try {
      const user = await api.auth.register(data);
      setUser(user);
      return user;
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Registration failed');
      throw err;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await api.auth.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
    }
  };

  const isHR = user?.role?.toLowerCase() === 'hr';
  const isViewer = user?.role?.toLowerCase() === 'viewer';

  const value: AuthContextValue = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isHR,
    isViewer,
    login,
    register,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}