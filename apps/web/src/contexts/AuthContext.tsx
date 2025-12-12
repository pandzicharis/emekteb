import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface User {
  id: string;
  email: string;
  uloga: 'ADMIN' | 'MUALLIM' | 'UCENIK';
  ime: string | null;
  prezime: string | null;
  fotografija: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, lozinka: string) => Promise<void>;
  loginWithPin: (pin: string, userId?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Helper funkcija za čuvanje korisnika u localStorage za brzi login
function saveUserToQuickLogin(
  userId: string,
  ime: string | null,
  prezime: string | null,
  fotografija: string | null,
  pin: string | null
) {
  try {
    console.log('💾 Čuvanje korisnika u localStorage za brzi login:', {
      userId,
      ime,
      prezime,
      pin: pin ? '***' : null,
    });

    const quickLoginKey = 'quickLoginUsers';
    const existingUsers = localStorage.getItem(quickLoginKey);
    const users: Array<{
      id: string;
      ime: string | null;
      prezime: string | null;
      fotografija: string | null;
      pin: string | null;
      poslednjeLogiranje: string;
    }> = existingUsers ? JSON.parse(existingUsers) : [];

    console.log('📋 Postojeći korisnici u localStorage:', users.length);

    // Ukloni korisnika ako već postoji (da bi ga dodali na vrh sa novim vremenom)
    const filteredUsers = users.filter((u) => u.id !== userId);

    // Dodaj korisnika na početak liste sa trenutnim vremenom
    const now = new Date().toISOString();
    filteredUsers.unshift({
      id: userId,
      ime,
      prezime,
      fotografija,
      pin,
      poslednjeLogiranje: now,
    });

    // Zadrži samo poslednjih 10 korisnika
    const limitedUsers = filteredUsers.slice(0, 10);

    // Obriši korisnike starije od 30 dana
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentUsers = limitedUsers.filter((u) => {
      const loginTime = new Date(u.poslednjeLogiranje).getTime();
      return loginTime > thirtyDaysAgo;
    });

    console.log('✅ Sačuvano korisnika:', recentUsers.length);
    console.log('📦 Finalna lista za čuvanje:', recentUsers.map(u => ({
      id: u.id,
      ime: `${u.ime} ${u.prezime}`,
      poslednjeLogiranje: u.poslednjeLogiranje,
    })));

    localStorage.setItem(quickLoginKey, JSON.stringify(recentUsers));
  } catch (error) {
    console.error('❌ Greška pri čuvanju korisnika za brzi login:', error);
  }
}

// Setup axios interceptor
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Ne preusmjeravaj na login za auth endpoint-e (login i login/pin)
    const isAuthEndpoint = error.config?.url?.includes('/auth/login');
    
    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, lozinka: string) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        lozinka,
      });

      const { access_token, user: userData } = response.data;

      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));

      // Sačuvaj ID korisnika za brzi login (po browseru)
      saveUserToQuickLogin(userData.id, userData.ime, userData.prezime, userData.fotografija, userData.pin);

      setToken(access_token);
      setUser(userData);
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Greška pri prijavi'
      );
    }
  };

  const loginWithPin = async (pin: string, userId?: string) => {
    try {
      const requestBody: { pin: string; userId?: string } = { pin };
      if (userId) {
        requestBody.userId = userId;
      }
      
      console.log('📤 Sending PIN login request:', requestBody);
      
      const response = await axios.post(`${API_URL}/auth/pin`, requestBody);
      
      console.log('✅ PIN login response:', response.data);

      const { access_token, user: userData } = response.data;

      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));

      // Sačuvaj ID korisnika za brzi login (po browseru)
      saveUserToQuickLogin(userData.id, userData.ime, userData.prezime, userData.fotografija, userData.pin);

      setToken(access_token);
      setUser(userData);
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Greška pri prijavi sa PIN-om'
      );
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        loginWithPin,
        logout,
        isAuthenticated: !!user && !!token,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}




