import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SafeUser } from '@codecollab/shared';
import { disconnectSocket } from '../lib/socket';
import { API_BASE_URL } from '../lib/api';

interface AuthContextType {
  user: SafeUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: SafeUser, refreshToken?: string) => void;
  logout: () => void;
  updateUser: (updatedUser: SafeUser) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('codecollab_token'));
  const [user, setUser] = useState<SafeUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    const refreshToken = localStorage.getItem('codecollab_refresh_token');
    if (refreshToken) {
      fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }

    localStorage.removeItem('codecollab_token');
    localStorage.removeItem('codecollab_refresh_token');
    setToken(null);
    setUser(null);
    disconnectSocket();
  }, []);

  const login = useCallback((newToken: string, newUser: SafeUser, newRefreshToken?: string) => {
    localStorage.setItem('codecollab_token', newToken);
    if (newRefreshToken) {
      localStorage.setItem('codecollab_refresh_token', newRefreshToken);
    }
    setToken(newToken);
    setUser(newUser);
  }, []);

  const updateUser = useCallback((updatedUser: SafeUser) => {
    setUser(updatedUser);
  }, []);

  const verifyAuth = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.data.user);
      } else if (response.status === 401) {
        // Attempt silent token refresh
        const refreshToken = localStorage.getItem('codecollab_refresh_token');
        if (refreshToken) {
          const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            const newAccessToken = refreshData.data.token;
            const rotatedRefreshToken = refreshData.data.refreshToken;

            localStorage.setItem('codecollab_token', newAccessToken);
            localStorage.setItem('codecollab_refresh_token', rotatedRefreshToken);
            setToken(newAccessToken);

            // Retry auth/me with new token
            const retryRes = await fetch(`${API_BASE_URL}/auth/me`, {
              headers: { Authorization: `Bearer ${newAccessToken}` },
            });
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              setUser(retryData.data.user);
              return;
            }
          }
        }
        logout();
      } else {
        logout();
      }
    } catch {
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    verifyAuth();
  }, [verifyAuth]);

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
