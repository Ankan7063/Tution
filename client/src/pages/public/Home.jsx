import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Users, Trophy, Clock, Star, MessageCircle, Phone, Mail, GraduationCap, CheckCircle2 } from 'lucide-react';
import api from '../../api/client.js';
import { useApp, money, waLink } from '../../context/AppContext.jsx';
import { Avatar } from '../../components/ui.jsx';

export default function Home() {
  const { settings } = useApp();
  const [courses, setCourses] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    api.get('/courses').then(({ data }) => setCourses(data.filter((c) => c.isActive).slice(0, 3))).catch(() => {});
    api.get('/announcements').then(({ data }) => setAnnouncements(data.slice(0, 3))).catch(() => {});
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-700 text-white">
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 md:grid-cols-2 md:py-28">
          <div className="fade-in">
            <span className="badge bg-white/15 text-white backdrop-blur">Admissions open · Session {settings?.academicSession || '2026-27'}</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">
              Excel in academics with <span className="text-amber-300">expert guidance</span>
            </h1>
            <p className="mt-4 max-w-lg text-lg text-brand-100">
              {settings?.tagline || 'Personal attention, small batches, regular tests and complete progress tracking — for Classes 8 to 12.'}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={waLink(settings?.whatsapp, 'Hi, I want to enquire about admissions.')} target="_blank" rel="noreferrer"
                className="btn bg-emerald-500 text-white hover:bg-emerald-600">
                <MessageCircle size={18} /> Enquire on WhatsApp
              </a>
              <Link to="/courses" className="btn bg-white/15 text-white backdrop-blur hover:bg-white/25">
                Explore Courses <ArrowRight size={18} />
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-6 text-sm text-brand-100">
              <span className="flex items-center gap-2"><Users size={16} /> Small batches</span>
              <span className="flex items-center gap-2"><BookOpen size={16} /> All subjects</span>
              <span className="flex items-center gap-2"><Trophy size={16} /> Proven results</span>
            </div>
          </div>
          <div className="fade-in hidden md:block">
            <div className="grid grid-cols-2 gap-4">
              {[['500+', 'Students taught'], ['15+', 'Expert teachers'], ['95%', 'Board pass rate'], ['10+', 'Years of experience']].map(([v, l]) => (
                <div key={l} className="rounded-2xl bg-white/10 p-6 text-center backdrop-blur">
                  <div className="text-3xl font-extrabold text-amber-300">{v}</div>
                  <div className="mt-1 text-sm text-brand-100">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Announcements */}
      {announcements.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-10">
          <div className="card divide-y divide-slate-100 dark:divide-slate-800">
            {announcements.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-5 py-4">
                <span className="badge mt-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Notice</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{a.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{a.message}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Why choose us */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-center text-3xl font-extrabold text-slate-900 dark:text-white">Why Choose Us</h2>
        <p className="mt-2 text-center text-slate-500 dark:text-slate-400">Everything a student needs to score higher, in one place.</p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [Users, 'Small Batches', 'Limited seats per batch so every student gets personal attention.'],
            [Clock, 'Flexible Timings', 'Morning, evening and weekend batches that fit school schedules.'],
            [Trophy, 'Regular Tests', 'Weekly tests and full-length mock exams with detailed report cards.'],
            [BookOpen, 'All Subjects', 'Maths, Science, English and more — taught by subject specialists.'],
          ].map(([Icon, title, desc]) => (
            <div key={title} className="card p-6 transition-transform hover:-translate-y-1">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-400">
                <Icon size={22} />
              </span>
              <h3 className="mt-4 font-bold text-slate-900 dark:text-white">{title}</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured courses */}
      <section className="bg-white py-16 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Featured Courses</h2>
              <p className="mt-2 text-slate-500 dark:text-slate-400">Our most popular programmes.</p>
            </div>
            <Link to="/courses" className="btn-secondary hidden sm:inline-flex">View all <ArrowRight size={16} /></Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <div key={c.id} className="card flex flex-col p-6 transition-transform hover:-translate-y-1">
                <span className="badge w-fit bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">{c.code}</span>
                <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">{c.name}</h3>
                <p className="mt-2 flex-1 text-sm text-slate-500 dark:text-slate-400">{c.description}</p>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                  <span className="font-bold text-brand-600 dark:text-brand-400">{money(c.monthlyFee, settings)}<span className="text-xs font-normal text-slate-400">/month</span></span>
                  <span className="text-xs text-slate-400">{c.duration}</span>
                </div>
              </div>
            ))}
          </div>
          <Link to="/courses" className="btn-secondary mt-6 sm:hidden">View all courses</Link>
        </div>
      </section>

      {/* Achievements / testimonials */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-center text-3xl font-extrabold text-slate-900 dark:text-white">Student Achievements</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Riya S.', '98% in Class X Boards', 'Mathematics batch of 2025'],
            ['Aditya K.', 'School topper, Class XII Science', 'Physics-Chemistry programme'],
            ['Meghna D.', '99/100 in English', 'Advanced English course'],
          ].map(([name, achievement, batch]) => (
            <div key={name} className="card p-6">
              <div className="flex items-center gap-3">
                <Avatar name={name} />
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{name}</p>
                  <p className="text-xs text-slate-400">{batch}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-1 text-amber-400">{[...Array(5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}</div>
              <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                <Trophy size={16} /> {achievement}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-4">
        <div className="card flex flex-col items-center gap-6 bg-gradient-to-r from-brand-600 to-indigo-600 p-10 text-center text-white sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h2 className="text-2xl font-extrabold">Ready to boost your grades?</h2>
            <p className="mt-1 text-brand-100">Reach out now — we usually reply within minutes.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <a href={waLink(settings?.whatsapp, 'Hi, I want to enquire about admissions.')} target="_blank" rel="noreferrer" className="btn bg-emerald-500 text-white hover:bg-emerald-600"><MessageCircle size={18} /> WhatsApp</a>
            <a href={settings?.phone ? `tel:+${String(settings.phone).replace(/\D/g, '')}` : '#'} className="btn bg-white text-brand-700 hover:bg-brand-50"><Phone size={18} /> Call Now</a>
            <a href={settings?.email ? `mailto:${settings.email}` : '#'} className="btn bg-white/15 text-white backdrop-blur hover:bg-white/25"><Mail size={18} /> Email Us</a>
          </div>
        </div>
      </section>
    </div>
  );
}
