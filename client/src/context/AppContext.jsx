import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/client.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [dark, setDark] = useState(() => localStorage.getItem('tc_dark') === '1');
  const [authLoading, setAuthLoading] = useState(!!localStorage.getItem('tc_token'));

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await api.get('/settings');
      setSettings(data);
    } catch {
      /* keep defaults */
    }
  }, []);

  useEffect(() => {
    loadSettings();
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('tc_dark', dark ? '1' : '0');
  }, [dark, loadSettings]);

  useEffect(() => {
    if (!localStorage.getItem('tc_token')) return;
    api.get('/auth/me')
      .then(({ data }) => setUser(data))
      .catch(() => localStorage.removeItem('tc_token'))
      .finally(() => setAuthLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('tc_token', data.token);
    const me = await api.get('/auth/me');
    setUser(me.data);
    return me.data;
  };

  const logout = () => {
    localStorage.removeItem('tc_token');
    setUser(null);
  };

  const isStaffUser = user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN');

  return (
    <AppContext.Provider value={{ user, setUser, settings, loadSettings, dark, setDark, login, logout, authLoading, isStaffUser }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}

export function money(amount, settings) {
  const symbol = settings?.currencySymbol || '₹';
  return `${symbol}${Number(amount || 0).toLocaleString('en-IN')}`;
}

export function waLink(number, text) {
  if (!number) return '#';
  const n = String(number).replace(/\D/g, '');
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
