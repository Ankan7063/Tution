import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { GraduationCap, Menu, X, Phone, Mail, Globe, MessageCircle } from 'lucide-react';
import { useApp, waLink } from '../context/AppContext.jsx';

function ContactButtons({ settings, compact = false }) {
  const cls = compact
    ? 'flex h-10 w-10 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-110'
    : 'btn text-white';
  return (
    <>
      <a href={waLink(settings?.whatsapp, `Hi ${settings?.centerName || ''}, I want to enquire about admissions.`)}
        target="_blank" rel="noreferrer" aria-label="WhatsApp"
        className={`${cls} bg-emerald-500 hover:bg-emerald-600`}>
        <MessageCircle size={compact ? 20 : 18} /> {!compact && 'WhatsApp'}
      </a>
      <a href={settings?.phone ? `tel:+${String(settings.phone).replace(/\D/g, '')}` : '#'} aria-label="Call now"
        className={`${cls} bg-sky-600 hover:bg-sky-700`}>
        <Phone size={compact ? 20 : 18} /> {!compact && 'Call Now'}
      </a>
      <a href={settings?.email ? `mailto:${settings.email}` : '#'} aria-label="Email us"
        className={`${cls} bg-brand-600 hover:bg-brand-700`}>
        <Mail size={compact ? 20 : 18} /> {!compact && 'Email Us'}
      </a>
    </>
  );
}

export default function PublicLayout() {
  const { settings, user } = useApp();
  const [open, setOpen] = useState(false);
  const links = [
    ['/', 'Home'],
    ['/about', 'About Us'],
    ['/courses', 'Courses'],
    ['/teachers', 'Teachers'],
    ['/contact', 'Contact'],
  ];
  const navCls = ({ isActive }) =>
    `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-indigo-600 text-white">
              <GraduationCap size={20} />
            </span>
            <span className="text-lg font-extrabold text-slate-900 dark:text-white">
              {settings?.centerName || 'Tuition Center'}
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map(([to, label]) => <NavLink key={to} to={to} className={navCls}>{label}</NavLink>)}
            <NavLink to="/login" className={navCls}>Student Login</NavLink>
            <Link to={user ? (user.role === 'STUDENT' ? '/portal' : '/admin') : '/admin/login'}
              className="btn-primary ml-2">
              {user ? 'Dashboard' : 'Admin Login'}
            </Link>
          </nav>
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {open && (
          <nav className="fade-in border-t border-slate-200 px-4 py-3 md:hidden dark:border-slate-800">
            <div className="flex flex-col gap-1">
              {links.map(([to, label]) => (
                <NavLink key={to} to={to} className={navCls} onClick={() => setOpen(false)}>{label}</NavLink>
              ))}
              <NavLink to="/login" className={navCls} onClick={() => setOpen(false)}>Student Login</NavLink>
              <Link to="/admin/login" className="btn-primary mt-2" onClick={() => setOpen(false)}>Admin Login</Link>
            </div>
          </nav>
        )}
      </header>

      <main><Outlet /></main>

      <footer className="mt-20 bg-slate-900 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-indigo-600 text-white">
                <GraduationCap size={20} />
              </span>
              <span className="text-lg font-extrabold text-white">{settings?.centerName || 'Tuition Center'}</span>
            </div>
            <p className="mt-3 text-sm text-slate-400">{settings?.tagline || 'Quality education, proven results.'}</p>
            <div className="mt-4 flex gap-2">
              <ContactButtons settings={settings} compact />
            </div>
          </div>
          <div>
            <h4 className="mb-3 font-bold text-white">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              {links.map(([to, label]) => (
                <li key={to}><Link to={to} className="hover:text-white">{label}</Link></li>
              ))}
              <li><Link to="/login" className="hover:text-white">Student Login</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-bold text-white">Contact</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              {settings?.address && <li>{settings.address}</li>}
              {settings?.phone && <li><a className="hover:text-white" href={`tel:+${String(settings.phone).replace(/\D/g, '')}`}>{settings.phone}</a></li>}
              {settings?.email && <li><a className="hover:text-white" href={`mailto:${settings.email}`}>{settings.email}</a></li>}
              {settings?.website && <li className="flex items-center gap-1"><Globe size={14} /> {settings.website}</li>}
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-bold text-white">Get in Touch</h4>
            <div className="flex flex-col gap-2">
              <ContactButtons settings={settings} />
            </div>
          </div>
        </div>
        <div className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} {settings?.centerName || 'Tuition Center'}. All rights reserved.
        </div>
      </footer>

      {/* Floating contact buttons — desktop right side, mobile bottom-right */}
      <div className="fixed right-4 bottom-4 z-40 flex flex-col gap-2 md:right-6 md:bottom-6 md:top-1/2 md:bottom-auto md:-translate-y-1/2">
        <ContactButtons settings={settings} compact />
      </div>
    </div>
  );
}
