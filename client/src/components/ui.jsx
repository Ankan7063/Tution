import { Component, createContext, useCallback, useContext, useState } from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Loader2, Inbox, RefreshCw } from 'lucide-react';

/* ---------- Toasts ---------- */
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  const toast = {
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
  };
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className={`fade-in flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${t.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
            {t.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className={`fade-in card max-h-[92vh] w-full overflow-y-auto p-6 ${wide ? 'max-w-3xl' : 'max-w-lg'}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Confirm dialog ---------- */
export function Confirm({ open, onClose, onConfirm, message, busy }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="fade-in card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-slate-700 dark:text-slate-300">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />} Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Misc ---------- */
export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-brand-600">
      <Loader2 size={22} className="animate-spin" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

export function Empty({ message = 'Nothing here yet' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
      <Inbox size={36} />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function ErrorNote({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <AlertCircle size={36} className="text-rose-500" />
      <p className="max-w-md text-sm font-medium text-rose-600 dark:text-rose-400">
        {message || 'Could not load this list.'}
      </p>
      {onRetry && (
        <button type="button" className="btn-ghost mt-1" onClick={onRetry}>
          <RefreshCw size={16} /> Try again
        </button>
      )}
    </div>
  );
}

// One throw during render used to unmount the whole tree and leave a blank page. Anything that
// still escapes the per-page error states stops here instead.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-20 text-center">
        <AlertTriangle size={40} className="text-rose-500" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">This page hit an error</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{this.state.error.message}</p>
        <div className="mt-2 flex gap-3">
          <button type="button" className="btn-ghost" onClick={() => this.setState({ error: null })}>
            <RefreshCw size={16} /> Retry this page
          </button>
          <button type="button" className="btn-primary" onClick={() => window.location.assign('/')}>
            Go to home
          </button>
        </div>
      </div>
    );
  }
}

const badgeColors = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  INACTIVE: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  PASSED_OUT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  PRESENT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  ABSENT: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  LATE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  LEAVE: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  PARTIAL: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  PAID: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  OVERDUE: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  SCHEDULED: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  CONDUCTED: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  RESULTS_PUBLISHED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  SUPER_ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  ADMIN: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  TEACHER: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  STUDENT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

export function Badge({ value }) {
  const color = badgeColors[value] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
  return <span className={`badge ${color}`}>{String(value || '—').replaceAll('_', ' ')}</span>;
}

export function Field({ label, error, ...props }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" {...props} />
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function SelectField({ label, children, ...props }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" {...props}>{children}</select>
    </div>
  );
}

export function Avatar({ name, size = 'md' }) {
  const initials = (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-20 w-20 text-2xl' };
  return (
    <div className={`flex ${sizes[size]} shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 font-bold text-white`}>
      {initials}
    </div>
  );
}
