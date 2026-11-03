import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserPlus, BookOpen, Layers, CalendarCheck, IndianRupee,
  FileText, BarChart3, Megaphone, Settings, LogOut, Menu, X, Bell, Sun, Moon,
  GraduationCap, ClipboardList, Wallet, MessageCircle, Phone, Mail,
} from 'lucide-react';
import { useApp, waLink } from '../context/AppContext.jsx';
import api from '../api/client.js';

const sections = [
  { title: 'Main', items: [['/admin', 'Dashboard', LayoutDashboard]] },
  {
    title: 'Students',
    items: [
      ['/admin/students', 'All Students', Users],
      ['/admin/students/new', 'New Admission', UserPlus],
    ],
  },
  {
    title: 'Academics',
    items: [
      ['/admin/courses', 'Courses & Subjects', BookOpen],
      ['/admin/batches', 'Batches & Schedule', Layers],
      ['/admin/attendance', 'Attendance', CalendarCheck],
      ['/admin/exams', 'Exams & Results', FileText],
    ],
  },
  {
    title: 'Finance',
    items: [['/admin/fees', 'Fees & Payments', IndianRupee]],
  },
  {
    title: 'Insights',
    items: [['/admin/reports', 'Reports', BarChart3]],
  },
  {
    title: 'Communication',
    items: [['/admin/announcements', 'Announcements', Megaphone]],
  },
  {
    title: 'Admin',
    items: [['/admin/settings', 'Settings', Settings]],
  },
];

function Sidebar({ open, onClose }) {
  const { user, settings } = useApp();
  return (
    <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-gradient-to-b from-brand-700 via-brand-600 to-indigo-700 text-white transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"><GraduationCap size={20} /></span>
          <div>
            <p className="text-sm font-extrabold leading-tight">{settings?.centerName || 'Tuition Center'}</p>
            <p className="text-[10px] uppercase tracking-widest text-brand-200">Management System</p>
          </div>
        </Link>
        <button className="rounded-lg p-1 hover:bg-white/10 lg:hidden" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
      </div>
      <nav className="h-[calc(100vh-8rem)] overflow-y-auto px-3 py-4">
        {sections.map((s) => (
          <div key={s.title} className="mb-4">
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-brand-200/80">{s.title}</p>
            {s.items.map(([to, label, Icon]) => (
              <NavLink key={to} to={to} end={to === '/admin'} onClick={onClose}
                className={({ isActive }) =>
                  `mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    isActive ? 'bg-white text-brand-700 shadow' : 'text-brand-50 hover:bg-white/10'
                  }`}>
                <Icon size={18} /> {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="absolute bottom-0 w-64 border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 font-bold">
            {(user?.email || 'A')[0].toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{user?.email}</p>
            <p className="text-xs capitalize text-brand-200">{String(user?.role || '').toLowerCase().replace('_', ' ')}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ rows: [], unread: 0 });
  const load = () => api.get('/notifications').then(({ data }) => setData(data)).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);
  const markAll = async () => { await api.post('/notifications/read-all'); load(); };
  return (
    <div className="relative">
      <button className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800" onClick={() => setOpen(!open)} aria-label="Notifications">
        <Bell size={20} />
        {data.unread > 0 && <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{data.unread}</span>}
      </button>
      {open && (
        <div className="fade-in absolute right-0 z-50 mt-2 w-80 card p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="font-bold text-slate-900 dark:text-white">Notifications</p>
            <button className="text-xs font-semibold text-brand-600 hover:underline" onClick={markAll}>Mark all read</button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {data.rows.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">No notifications</p>}
            {data.rows.map((n) => (
              <div key={n.id} className={`border-b border-slate-50 px-4 py-3 last:border-0 dark:border-slate-800 ${!n.isRead ? 'bg-brand-50/60 dark:bg-brand-900/10' : ''}`}>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{n.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{n.message}</p>
                <p className="mt-1 text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleString('en-IN')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminLayout() {
  const { user, settings, dark, setDark, logout } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const doLogout = () => { logout(); navigate('/'); };

  return (
    <div className="min-h-screen">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center gap-2">
            <button className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu size={22} />
            </button>
            <p className="hidden text-sm text-slate-400 sm:block">Academic Session <span className="font-bold text-slate-700 dark:text-slate-200">{settings?.academicSession}</span></p>
          </div>
          <div className="flex items-center gap-1">
            <a href={waLink(settings?.whatsapp)} target="_blank" rel="noreferrer" aria-label="WhatsApp"
              className="rounded-xl p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"><MessageCircle size={20} /></a>
            <a href={settings?.phone ? `tel:+${String(settings.phone).replace(/\D/g, '')}` : '#'} aria-label="Call"
              className="rounded-xl p-2 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20"><Phone size={20} /></a>
            <a href={settings?.email ? `mailto:${settings.email}` : '#'} aria-label="Email"
              className="rounded-xl p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20"><Mail size={20} /></a>
            <button onClick={() => setDark(!dark)} aria-label="Toggle dark mode"
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <Notifications />
            <button onClick={doLogout} aria-label="Logout"
              className="ml-1 rounded-xl p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20">
              <LogOut size={20} />
            </button>
          </div>
        </header>
        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
      <span className="hidden">{user?.role}</span>
    </div>
  );
}
