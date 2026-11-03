import axios from 'axios';

// Dev: relative /api, forwarded by the Vite proxy. Deployed: the Render origin, set at
// build time with VITE_API_URL so the SPA talks to the API directly.
const base = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api` : '/api';

const api = axios.create({ baseURL: base });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem('tc_token')) {
      localStorage.removeItem('tc_token');
      if (!location.pathname.startsWith('/login')) location.href = '/login';
    }
    const message = err.response?.data?.message || err.message || 'Something went wrong';
    return Promise.reject(new Error(Array.isArray(message) ? message.join(', ') : message));
  }
);

export default api;
