import axios from 'axios';

// Dev: relative /api, forwarded by the Vite proxy. Deployed: the Render origin, set at
// build time with VITE_API_URL so the SPA talks to the API directly.
const apiUrl = import.meta.env.VITE_API_URL;
const base = apiUrl ? `${String(apiUrl).replace(/\/$/, '')}/api` : '/api';

// Without VITE_API_URL a deployed SPA asks its own origin for /api, and the host answers with
// index.html. That used to arrive as a 200 and reach a component as a string.
if (import.meta.env.PROD && !apiUrl) {
  console.error(
    '[api] VITE_API_URL is not set, so every request goes to '
    + `${base} on this site's own origin. Set VITE_API_URL to the Render service URL in Vercel and redeploy.`
  );
}

const api = axios.create({ baseURL: base, headers: { Accept: 'application/json' } });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function describe(value) {
  if (Array.isArray(value)) return 'a list';
  if (value === null || value === undefined) return 'nothing';
  if (typeof value === 'string') return `text starting with ${JSON.stringify(value.trim().slice(0, 40))}`;
  if (typeof value === 'object') return `an object with keys ${Object.keys(value).slice(0, 6).join(', ') || '(none)'}`;
  return `the value ${JSON.stringify(value)}`;
}

function shapeError(where, value, wanted) {
  return new Error(`${where} returned ${describe(value)} instead of ${wanted}`);
}

api.interceptors.response.use(
  (res) => {
    if (typeof res.data === 'string' && res.data.trim() !== '') {
      const where = res.config?.url || 'the request';
      const isHtml = res.data.trimStart().startsWith('<');
      return Promise.reject(new Error(
        isHtml
          ? `${where} answered with an HTML page, not the API. Check that VITE_API_URL points at the Render service.`
          : shapeError(where, res.data, 'JSON')
      ));
    }
    return res;
  },
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem('tc_token')) {
      localStorage.removeItem('tc_token');
      if (!location.pathname.startsWith('/login')) location.href = '/login';
    }
    const message = err.response?.data?.message || err.message || 'Something went wrong';
    return Promise.reject(new Error(Array.isArray(message) ? message.join(', ') : message));
  }
);

// Every list the UI renders goes through one of these two, so a response in the wrong shape
// becomes a readable error on the page instead of a "x.map is not a function" crash.
export async function getArray(path, params) {
  const { data } = await api.get(path, { params });
  if (!Array.isArray(data)) throw shapeError(path, data, 'a list');
  return data;
}

export async function getObject(path, params) {
  const { data } = await api.get(path, { params });
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw shapeError(path, data, 'an object');
  return data;
}

// For arrays nested inside a response body, e.g. data.rows or stats.recentStudents.
export function expectArray(value, where) {
  if (!Array.isArray(value)) throw shapeError(where, value, 'a list');
  return value;
}

export default api;
