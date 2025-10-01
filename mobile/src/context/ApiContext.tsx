import React, { createContext, useContext, ReactNode } from 'react';
import axios, { AxiosInstance } from 'axios';

interface ApiContextType {
  api: AxiosInstance;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export const useApi = () => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};

interface ApiProviderProps {
  children: ReactNode;
}

export const ApiProvider: React.FC<ApiProviderProps> = ({ children }) => {
  const api = axios.create({
    baseURL: 'http://localhost:5000',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Response interceptor for error handling
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // Handle unauthorized errors
        console.log('Unauthorized access - redirecting to login');
      }
      return Promise.reject(error);
    }
  );

  const value: ApiContextType = {
    api,
  };

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
};