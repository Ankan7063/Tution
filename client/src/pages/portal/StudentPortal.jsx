import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, LogOut, CalendarCheck, Wallet, FileText, Moon, Sun, MessageCircle, Phone, Mail, User } from 'lucide-react';
import { getArray, getObject, expectArray } from '../../api/client.js';
import { useApp, money, waLink } from '../../context/AppContext.jsx';
import { Spinner, Badge, Avatar, Empty, ErrorNote } from '../../components/ui.jsx';

const tabs = [['overview', 'Overview'], ['attendance', 'Attendance'], ['fees', 'Fees'], ['results', 'Results'], ['notices', 'Notices']];

export default function StudentPortal() {
  const { user, settings, dark, setDark, logout } = useApp();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [notices, setNotices] = useState([]);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');

  const load = useCallback(() => {
    const id = user?.student?.id;
    if (!id) return;
    setStudent(null);
    setError(null);
    getObject(`/students/${id}`)
      .then((data) => setStudent({
        ...data,
        attendance: expectArray(data.attendance, `/students/${id} attendance`),
        feeRecords: expectArray(data.feeRecords, `/students/${id} feeRecords`),
        payments: expectArray(data.payments, `/students/${id} payments`),
        examResults: expectArray(data.examResults, `/students/${id} examResults`),
      }))
      .catch((err) => setError(err.message));
    getArray('/announcements')
      .then((rows) => setNotices(rows.filter((a) => a.audience !== 'TEACHERS')))
      .catch(() => {});
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (!user?.student?.id) {
    return (
      <div className="card mx-auto my-16 max-w-md p-8 text-center">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">No student profile linked</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Ask the admin to link this login to your admission record.</p>
        <button className="btn-primary mt-4" onClick={() => { logout(); navigate('/'); }}>Sign Out</button>
      </div>
    );
  }
  if (error) return <div className="card mx-auto my-16 max-w-2xl p-4"><ErrorNote message={error} onRetry={load} /></div>;
  if (!student) return <Spinner label="Loading your dashboard…" />;

  const attendance = student.attendance;
  const present = attendance.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
  const attendancePct = attendance.length ? Math.round((present / attendance.length) * 100) : 0;

  const feeTotal = student.feeRecords.reduce((s, r) => s + Number(r.amount) + Number(r.lateFee) - Number(r.discount), 0);
  const feePaid = student.payments.reduce((s, p) => s + Number(p.amount), 0);

  const results = student.examResults;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-indigo-600 text-white"><GraduationCap size={18} /></span>
            <div>
              <p className="text-sm font-extrabold leading-tight text-slate-900 dark:text-white">{settings?.centerName || 'Tuition Center'}</p>
              <p className="text-[10px] uppercase tracking-widest text-slate-400">Student Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {settings?.whatsapp && <a href={waLink(settings.whatsapp)} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="rounded-xl p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"><MessageCircle size={18} /></a>}
            {settings?.phone && <a href={`tel:+${String(settings.phone).replace(/\D/g, '')}`} aria-label="Call" className="rounded-xl p-2 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20"><Phone size={18} /></a>}
            {settings?.email && <a href={`mailto:${settings.email}`} aria-label="Email" className="rounded-xl p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20"><Mail size={18} /></a>}
            <button onClick={() => setDark(!dark)} aria-label="Toggle dark mode" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button onClick={() => { logout(); navigate('/'); }} aria-label="Sign out" className="rounded-xl p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        <div className="card flex flex-wrap items-center gap-4 p-5">
          <Avatar name={student.name} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">{student.name}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{student.admissionNo} · {student.classGrade || 'Class not set'} · {student.course?.name || 'No course'} · {student.batch?.name || 'No batch'}</p>
          </div>
          <Badge value={student.status} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Attendance', `${attendancePct}%`, CalendarCheck, 'from-emerald-500 to-teal-600'],
            ['Fees Pending', money(Math.max(feeTotal - feePaid, 0), settings), Wallet, 'from-rose-500 to-pink-600'],
            ['Exams Recorded', results.length, FileText, 'from-brand-500 to-indigo-600'],
          ].map(([label, value, Icon, grad]) => (
            <div key={label} className="card flex items-center gap-3 p-4">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white ${grad}`}><Icon size={20} /></span>
              <div>
                <p className="text-xs font-medium text-slate-400">{label}</p>
                <p className="text-lg font-extrabold text-slate-900 dark:text-white">{value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {tabs.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                tab === key ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-bold text-slate-900 dark:text-white"><User size={16} className="text-brand-600" /> Personal Details</h2>
              <dl className="space-y-2 text-sm">
                {[['Phone', student.phone], ['Email', student.email], ['Guardian', student.parentName], ['Guardian Phone', student.parentPhone], ['Address', student.address], ['Date of Birth', student.dob ? new Date(student.dob).toLocaleDateString('en-IN') : null], ['Monthly Fee', money(student.monthlyFee, settings)], ['Admitted On', new Date(student.admissionDate).toLocaleDateString('en-IN')]]
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800">
                      <dt className="text-slate-400">{k}</dt>
                      <dd className="text-right font-semibold text-slate-700 dark:text-slate-200">{v || '—'}</dd>
                    </div>
                  ))}
              </dl>
            </div>
            <div className="card p-5">
              <h2 className="mb-3 font-bold text-slate-900 dark:text-white">Batch &amp; Teacher</h2>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{student.batch?.name || 'Not assigned'}</p>
              {student.batch?.startTime && <p className="text-sm text-slate-500">{student.batch.startTime} – {student.batch.endTime} · {student.batch.days?.join(', ')}</p>}
              {student.batch?.teacher && (
                <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{student.batch.teacher.name}</p>
                  <a className="text-sm text-brand-600 hover:underline" href={`tel:+${String(student.batch.teacher.phone || '').replace(/\D/g, '')}`}>{student.batch.teacher.phone || 'No phone'}</a>
                </div>
              )}
              <h3 className="mb-2 mt-5 font-bold text-slate-900 dark:text-white">Recent Payments</h3>
              {student.payments.length === 0 && <p className="text-sm text-slate-400">No payments recorded yet.</p>}
              <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {student.payments.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2">
                    <span className="font-mono text-xs text-slate-400">{p.receiptNo}</span>
                    <span className="text-xs text-slate-400">{new Date(p.paymentDate).toLocaleDateString('en-IN')}</span>
                    <span className="font-bold text-emerald-600">{money(p.amount, settings)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {tab === 'attendance' && (
          <div className="card overflow-x-auto">
            {attendance.length === 0 ? <Empty message="No attendance recorded yet" /> : (
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/60"><tr><th className="th">Date</th><th className="th">Status</th><th className="th">Batch</th><th className="th">Remark</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {attendance.map((a) => (
                    <tr key={a.id} className="text-slate-700 dark:text-slate-300">
                      <td className="td">{new Date(a.date).toLocaleDateString('en-IN')}</td>
                      <td className="td"><Badge value={a.status} /></td>
                      <td className="td">{a.batch?.name || student.batch?.name || '—'}</td>
                      <td className="td text-slate-400">{a.remark || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'fees' && (
          <div className="card overflow-x-auto">
            {(student.feeRecords || []).length === 0 ? <Empty message="No fee records" /> : (
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/60"><tr><th className="th">Fee</th><th className="th">Period</th><th className="th">Amount</th><th className="th">Paid</th><th className="th">Due Date</th><th className="th">Status</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {student.feeRecords.map((r) => {
                    const payable = Number(r.amount) + Number(r.lateFee) - Number(r.discount);
                    const paid = (r.payments || []).reduce((s, p) => s + Number(p.amount), 0);
                    return (
                      <tr key={r.id} className="text-slate-700 dark:text-slate-300">
                        <td className="td font-semibold text-slate-900 dark:text-white">{r.feeType}</td>
                        <td className="td">{r.period || '—'}</td>
                        <td className="td">{money(payable, settings)}</td>
                        <td className="td text-emerald-600">{money(paid, settings)}</td>
                        <td className="td">{new Date(r.dueDate).toLocaleDateString('en-IN')}</td>
                        <td className="td"><Badge value={r.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'results' && (
          <div className="card overflow-x-auto">
            {results.length === 0 ? <Empty message="Results have not been published yet" /> : (
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/60"><tr><th className="th">Examination</th><th className="th">Subject</th><th className="th">Marks</th><th className="th">%</th><th className="th">Grade</th><th className="th">Remarks</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {results.map((r) => {
                    const pct = r.examination?.totalMarks ? Math.round((Number(r.marksObtained) / r.examination.totalMarks) * 10000) / 100 : 0;
                    return (
                      <tr key={r.id} className="text-slate-700 dark:text-slate-300">
                        <td className="td font-semibold text-slate-900 dark:text-white">{r.examination?.name}<span className="block text-xs font-normal text-slate-400">{r.examination?.examDate ? new Date(r.examination.examDate).toLocaleDateString('en-IN') : ''}</span></td>
                        <td className="td">{r.subject?.name || 'General'}</td>
                        <td className="td">{Number(r.marksObtained)} / {r.examination?.totalMarks}</td>
                        <td className="td">{pct}%</td>
                        <td className="td"><Badge value={r.grade} /></td>
                        <td className="td text-slate-400">{r.remarks || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'notices' && (
          <div className="grid gap-4 md:grid-cols-2">
            {notices.length === 0 && <div className="card md:col-span-2"><Empty message="No announcements right now" /></div>}
            {notices.map((a) => (
              <div key={a.id} className="card p-5">
                <p className="font-bold text-slate-900 dark:text-white">{a.title}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{a.message}</p>
                <p className="mt-2 text-xs text-slate-400">Posted {new Date(a.createdAt).toLocaleDateString('en-IN')}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
