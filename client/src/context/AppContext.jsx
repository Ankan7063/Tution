import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { getObject } from '../api/client.js';
import { can as hasPermission } from '../lib/permissions.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [dark, setDark] = useState(() => localStorage.getItem('tc_dark') === '1');
  const [authLoading, setAuthLoading] = useState(!!localStorage.getItem('tc_token'));

  const loadSettings = useCallback(async () => {
    try {
      setSettings(await getObject('/settings'));
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
    getObject('/auth/me')
      .then(setUser)
      .catch(() => localStorage.removeItem('tc_token'))
      .finally(() => setAuthLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (!data?.token) throw new Error('Login did not return a token');
    localStorage.setItem('tc_token', data.token);
    const me = await getObject('/auth/me');
    setUser(me);
    return me;
  };

  const logout = () => {
    localStorage.removeItem('tc_token');
    setUser(null);
  };

  const isStaffUser = user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN');

  // Bound to the signed-in session so a page asks "may this user do X" once, in the same
  // words the API uses.
  const can = (permission) => hasPermission(user, permission);

  return (
    <AppContext.Provider value={{ user, setUser, settings, loadSettings, dark, setDark, login, logout, authLoading, isStaffUser, can }}>
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
