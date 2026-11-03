import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserCheck, BookOpen, Layers, IndianRupee, AlertTriangle, TrendingUp, ArrowRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Legend } from 'recharts';
import { getArray, getObject, expectArray } from '../../api/client.js';
import { useApp, money } from '../../context/AppContext.jsx';
import { Spinner, Avatar, ErrorNote } from '../../components/ui.jsx';

export default function Dashboard() {
  const { settings } = useApp();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [charts, setCharts] = useState({ revenue: [], enrollment: [], attendance: [] });
  const [chartError, setChartError] = useState(null);

  const load = useCallback(() => {
    setStats(null);
    setError(null);
    getObject('/dashboard/stats')
      .then((data) => setStats({
        ...data,
        recentStudents: expectArray(data.recentStudents, '/dashboard/stats recentStudents'),
        recentPayments: expectArray(data.recentPayments, '/dashboard/stats recentPayments'),
        upcomingExams: expectArray(data.upcomingExams, '/dashboard/stats upcomingExams'),
      }))
      .catch((err) => setError(err.message));
    Promise.all([
      getArray('/dashboard/charts/revenue'),
      getArray('/dashboard/charts/enrollment'),
      getArray('/dashboard/charts/attendance'),
    ]).then(([revenue, enrollment, attendance]) => {
      setCharts({ revenue, enrollment, attendance });
      setChartError(null);
    }).catch((err) => setChartError(err.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorNote message={error} onRetry={load} />;
  if (!stats) return <Spinner label="Loading dashboard…" />;

  const cards = [
    ['Total Students', stats.totalStudents, Users, 'from-brand-500 to-indigo-600'],
    ['Total Teachers', stats.totalTeachers, UserCheck, 'from-cyan-500 to-sky-600'],
    ['Courses', stats.totalCourses, BookOpen, 'from-emerald-500 to-teal-600'],
    ['Batches', stats.totalBatches, Layers, 'from-amber-500 to-orange-600'],
    ['Collected (all time)', money(stats.totalCollected, settings), IndianRupee, 'from-violet-500 to-purple-600'],
    ['This Month', money(stats.monthlyRevenue, settings), TrendingUp, 'from-rose-500 to-pink-600'],
    ['Pending Fees', stats.pendingFeesCount, AlertTriangle, 'from-red-500 to-rose-600'],
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {cards.map(([label, value, Icon, grad]) => (
          <div key={label} className="card flex items-center gap-3 p-4">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white ${grad}`}><Icon size={20} /></span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-400">{label}</p>
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-4 font-bold text-slate-900 dark:text-white">Monthly Revenue</h3>
          {chartError ? <p className="py-8 text-center text-sm text-rose-600">{chartError}</p> : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={charts.revenue} margin={{ left: -20, right: 8, top: 4 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip formatter={(v) => money(v, settings)} />
              <Area type="monotone" dataKey="total" name="Revenue" stroke="#7c3aed" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </div>
        <div className="card p-5">
          <h3 className="mb-4 font-bold text-slate-900 dark:text-white">Student Enrollment</h3>
          {chartError ? <p className="py-8 text-center text-sm text-rose-600">{chartError}</p> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={charts.enrollment} margin={{ left: -20, right: 8, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" name="Students" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-1">
          <h3 className="mb-4 font-bold text-slate-900 dark:text-white">Attendance (last 30 days)</h3>
          {chartError ? <p className="py-8 text-center text-sm text-rose-600">{chartError}</p> : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={charts.attendance} margin={{ left: -22, right: 4, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="#94a3b8" tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="present" name="Present" stroke="#10b981" strokeWidth={2} fill="#10b98133" />
              <Area type="monotone" dataKey="absent" name="Absent" stroke="#f43f5e" strokeWidth={2} fill="#f43f5e33" />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white">Recent Registrations</h3>
            <Link to="/admin/students" className="text-xs font-semibold text-brand-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {stats.recentStudents.length === 0 && <p className="py-4 text-sm text-slate-400">No students registered yet.</p>}
            {stats.recentStudents.map((s) => (
              <Link key={s.id} to={`/admin/students/${s.id}`} className="flex items-center gap-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-2 px-2 rounded-lg">
                <Avatar name={s.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.admissionNo} · {s.course?.name || 'No course'}</p>
                </div>
                <ArrowRight size={16} className="text-slate-300" />
              </Link>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white">Recent Fee Payments</h3>
            <Link to="/admin/fees" className="text-xs font-semibold text-brand-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {stats.recentPayments.length === 0 && <p className="py-4 text-sm text-slate-400">No payments recorded yet.</p>}
            {stats.recentPayments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={p.student?.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{p.student?.name}</p>
                  <p className="text-xs text-slate-400">{p.receiptNo} · {new Date(p.paymentDate).toLocaleDateString('en-IN')}</p>
                </div>
                <span className="text-sm font-bold text-emerald-600">{money(p.amount, settings)}</span>
              </div>
            ))}
          </div>
          <h3 className="mb-2 mt-5 font-bold text-slate-900 dark:text-white">Upcoming Examinations</h3>
          {stats.upcomingExams.length === 0 && <p className="text-sm text-slate-400">No exams scheduled.</p>}
          <div className="space-y-2">
            {stats.upcomingExams.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
                <span className="font-semibold text-slate-700 dark:text-slate-200">{e.name}</span>
                <span className="text-xs text-slate-400">{new Date(e.examDate).toLocaleDateString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
