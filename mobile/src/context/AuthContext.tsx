import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApi } from './ApiContext';

interface User {
  id: string;
  email: string;
  name: string;
  partner_id?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isPaired: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { api } = useApi();

  const checkAuthState = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('user_data');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/api/v1/auth/login', {
        email,
        password,
      });

      const { user_id, token: authToken, partner_id } = response.data;

      // Fetch full user data
      const userResponse = await api.get(`/api/v1/users/${user_id}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      const userData = {
        id: user_id,
        email,
        name: userResponse.data.name,
        partner_id
      };

      await AsyncStorage.setItem('auth_token', authToken);
      await AsyncStorage.setItem('user_data', JSON.stringify(userData));

      setToken(authToken);
      setUser(userData);
      api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    } catch (error) {
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      const response = await api.post('/api/v1/auth/register', {
        email,
        password,
        name,
      });

      const { user_id, token: authToken } = response.data;

      const userData = {
        id: user_id,
        email,
        name,
      };

      await AsyncStorage.setItem('auth_token', authToken);
      await AsyncStorage.setItem('user_data', JSON.stringify(userData));

      setToken(authToken);
      setUser(userData);
      api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await api.post('/api/v1/auth/logout');
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('user_data');
      setToken(null);
      setUser(null);
      delete api.defaults.headers.common['Authorization'];
    }
  };

  const refreshAuth = async () => {
    try {
      if (token) {
        const response = await api.post('/api/v1/auth/refresh');
        const { token: newToken } = response.data;

        await AsyncStorage.setItem('auth_token', newToken);
        setToken(newToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      }
    } catch (error) {
      console.error('Error refreshing auth:', error);
      await logout();
    }
  };

  useEffect(() => {
    checkAuthState();
  }, []);

  const value: AuthContextType = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    isPaired: !!user?.partner_id,
    login,
    register,
    logout,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};