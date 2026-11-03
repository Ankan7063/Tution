import { useCallback, useEffect, useState } from 'react';
import { GraduationCap, MapPin, Phone, Mail, Globe, MessageCircle, Users, Target, HeartHandshake, Send } from 'lucide-react';
import { getArray } from '../../api/client.js';
import { useApp, money, waLink } from '../../context/AppContext.jsx';
import { Avatar, Empty, ErrorNote, Spinner, useToast } from '../../components/ui.jsx';

export function About() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-14">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white">About Us</h1>
        <p className="mt-4 text-lg text-slate-500 dark:text-slate-400">
          We are a dedicated team of educators helping students from Classes 8 to 12 achieve their
          academic goals through structured teaching, regular assessments and personal mentoring.
        </p>
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {[
          [Target, 'Our Mission', 'To make quality education personal, affordable and result-oriented for every student.'],
          [HeartHandshake, 'Our Approach', 'Small batches, experienced teachers, weekly tests and parent updates after every exam.'],
          [Users, 'Our Team', 'Subject specialists with years of board-exam teaching experience and a genuine love for teaching.'],
        ].map(([Icon, title, desc]) => (
          <div key={title} className="card p-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-400">
              <Icon size={26} />
            </span>
            <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Courses() {
  const { settings } = useApp();
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setCourses(null);
    setError(null);
    getArray('/courses').then(setCourses).catch((err) => setError(err.message));
  }, []);
  useEffect(load, [load]);
  const active = (courses || []).filter((c) => c.isActive);
  return (
    <div className="mx-auto max-w-7xl px-4 py-14">
      <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white">Our Courses</h1>
      <p className="mt-2 text-slate-500 dark:text-slate-400">Structured programmes for every class and subject.</p>
      {error ? <ErrorNote message={error} onRetry={load} /> : !courses ? <Spinner /> : active.length === 0 ? <Empty message="No courses have been published yet" /> : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((c) => (
            <div key={c.id} className="card flex flex-col p-6 transition-transform hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">{c.code}</span>
                <span className="text-xs text-slate-400">{c._count?.students || 0} students enrolled</span>
              </div>
              <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">{c.name}</h3>
              <p className="mt-2 flex-1 text-sm text-slate-500 dark:text-slate-400">{c.description}</p>
              <ul className="mt-4 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                {(c.subjects || []).slice(0, 4).map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> {s.name}
                    {s.teacher && <span className="text-xs text-slate-400">· {s.teacher.name}</span>}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                <span className="font-bold text-brand-600 dark:text-brand-400">{money(c.monthlyFee, settings)}<span className="text-xs font-normal text-slate-400">/month</span></span>
                <a className="btn-secondary" href={waLink(settings?.whatsapp, `Hi, I want to enroll in ${c.name}.`)} target="_blank" rel="noreferrer">Enquire</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Teachers() {
  const [teachers, setTeachers] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setTeachers(null);
    setError(null);
    getArray('/teachers/public').then(setTeachers).catch((err) => setError(err.message));
  }, []);
  useEffect(load, [load]);
  const active = (teachers || []).filter((t) => t.status === 'ACTIVE');
  return (
    <div className="mx-auto max-w-7xl px-4 py-14">
      <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white">Our Teachers</h1>
      <p className="mt-2 text-slate-500 dark:text-slate-400">Experienced subject specialists who care about every student.</p>
      {error ? <ErrorNote message={error} onRetry={load} /> : !teachers ? <Spinner /> : active.length === 0 ? <Empty message="No teachers have been listed yet" /> : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((t) => (
            <div key={t.id} className="card p-6 text-center transition-transform hover:-translate-y-1">
              <div className="flex justify-center"><Avatar name={t.name} size="lg" /></div>
              <h3 className="mt-4 font-bold text-slate-900 dark:text-white">{t.name}</h3>
              <p className="text-sm text-brand-600 dark:text-brand-400">{t.specialization || 'Faculty'}</p>
              <p className="mt-1 text-xs text-slate-400">{t.employeeNo}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {(t.subjects || []).map((s) => <span key={s.id} className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{s.name}</span>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Contact() {
  const { settings } = useApp();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', phone: '', message: '' });

  const submit = (e) => {
    e.preventDefault();
    const text = `Hi, I am ${form.name}. ${form.message} (Contact: ${form.phone})`;
    window.open(waLink(settings?.whatsapp, text), '_blank');
    toast.success('Opening WhatsApp with your message…');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-14">
      <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white">Contact Us</h1>
      <p className="mt-2 text-slate-500 dark:text-slate-400">We would love to hear from you. Reach out through any channel below.</p>
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          {[
            [MapPin, 'Address', settings?.address],
            [Phone, 'Phone', settings?.phone, settings?.phone ? `tel:+${String(settings.phone).replace(/\D/g, '')}` : null],
            [Mail, 'Email', settings?.email, settings?.email ? `mailto:${settings.email}` : null],
            [Globe, 'Website', settings?.website],
          ].map(([Icon, label, value, href]) => value && (
            <div key={label} className="card flex items-center gap-4 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-400"><Icon size={20} /></span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                {href ? <a href={href} className="font-semibold text-slate-900 hover:text-brand-600 dark:text-white">{value}</a> : <p className="font-semibold text-slate-900 dark:text-white">{value}</p>}
              </div>
            </div>
          ))}
          <div className="card flex gap-3 p-5">
            <a className="btn flex-1 bg-emerald-500 text-white hover:bg-emerald-600" href={waLink(settings?.whatsapp, 'Hi, I have an enquiry.')} target="_blank" rel="noreferrer"><MessageCircle size={18} /> WhatsApp</a>
            <a className="btn flex-1 bg-sky-600 text-white hover:bg-sky-700" href={settings?.phone ? `tel:+${String(settings.phone).replace(/\D/g, '')}` : '#'}><Phone size={18} /> Call</a>
          </div>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          <h3 className="font-bold text-slate-900 dark:text-white">Send an enquiry</h3>
          <div>
            <label className="label">Your Name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
          </div>
          <div>
            <label className="label">Phone Number</label>
            <input className="input" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit mobile number" />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea className="input" rows={4} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Which class/course are you interested in?" />
          </div>
          <button className="btn-primary w-full" type="submit"><Send size={18} /> Send via WhatsApp</button>
          <p className="text-center text-xs text-slate-400">Submitting opens WhatsApp with your message pre-filled.</p>
        </form>
      </div>
    </div>
  );
}
