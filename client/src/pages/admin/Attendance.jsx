import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, Save, Users, UserCheck, Loader2, History } from 'lucide-react';
import api, { getArray, getObject, expectArray } from '../../api/client.js';
import { useApp } from '../../context/AppContext.jsx';
import { Spinner, Empty, ErrorNote, Badge, SelectField, Field, useToast } from '../../components/ui.jsx';

const STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'];

const statusStyle = {
  PRESENT: 'bg-emerald-600 text-white',
  ABSENT: 'bg-rose-600 text-white',
  LATE: 'bg-amber-500 text-white',
  LEAVE: 'bg-sky-600 text-white',
};

function StatusPicker({ value, onChange }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
      {STATUSES.map((s) => (
        <button key={s} type="button" onClick={() => onChange(s)}
          className={`px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
            value === s ? statusStyle[s] : 'bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400'
          }`}>
          {s.toLowerCase()}
        </button>
      ))}
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function StudentMarking({ isStaff }) {
  const toast = useToast();
  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState('');
  const [date, setDate] = useState(today());
  const [roster, setRoster] = useState(null);
  const [marks, setMarks] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getArray('/batches').then((data) => {
      setBatches(data);
      if (data.length) setBatchId((b) => b || data[0].id);
    }).catch((err) => toast.error(err.message));
  }, []);

  const load = useCallback(async () => {
    if (!batchId || !date) return;
    setRoster(null);
    setError(null);
    try {
      const [studentsBody, existing] = await Promise.all([
        getObject('/students', { params: { batchId, limit: 300, status: 'ACTIVE' } }),
        getArray('/attendance/students', { params: { batchId, date } }),
      ]);
      const rows = expectArray(studentsBody.rows, '/students rows');
      const already = {};
      for (const row of existing) already[row.studentId] = row.status;
      setRoster(rows);
      setMarks(rows.reduce((acc, s) => ({ ...acc, [s.id]: already[s.id] || 'PRESENT' }), {}));
    } catch (err) {
      setError(err.message);
    }
  }, [batchId, date]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      const entries = Object.entries(marks).map(([studentId, status]) => ({ studentId, status }));
      const { data } = await api.post('/attendance/students/bulk', { date, batchId, entries });
      toast.success(data.message);
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: Object.values(marks).filter((v) => v === s).length }), {});

  return (
    <div className="space-y-4">
      <div className="card grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <SelectField label="Batch" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
          {batches.length === 0 && <option value="">No batches yet</option>}
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </SelectField>
        <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
          {STATUSES.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${statusStyle[s]}`} />
              {s.charAt(0) + s.slice(1).toLowerCase()}: {counts[s] || 0}
            </span>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <p className="font-bold text-slate-900 dark:text-white">Batch roster</p>
          {isStaff && (
            <button className="btn-primary" onClick={save} disabled={!roster?.length || busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Attendance
            </button>
          )}
        </div>
        {error ? <ErrorNote message={error} onRetry={load} /> : !roster ? <Spinner /> : roster.length === 0 ? <Empty message="No students in this batch" /> : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {roster.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.admissionNo} · {s.classGrade || '—'}</p>
                </div>
                <StatusPicker value={marks[s.id]} onChange={(v) => setMarks({ ...marks, [s.id]: v })} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TeacherMarking() {
  const toast = useToast();
  const [teachers, setTeachers] = useState(null);
  const [date, setDate] = useState(today());
  const [marks, setMarks] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setTeachers(null);
    setError(null);
    try {
      const [tData, aData] = await Promise.all([
        getArray('/teachers'),
        getArray('/attendance/teachers', { params: { date } }),
      ]);
      const already = {};
      for (const row of aData) already[row.teacherId] = row.status;
      setTeachers(tData);
      setMarks(tData.reduce((acc, t) => ({ ...acc, [t.id]: already[t.id] || 'PRESENT' }), {}));
    } catch (err) {
      setError(err.message);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  // The bulk endpoint reuses the studentId key for whichever person is being marked.
  const save = async () => {
    setBusy(true);
    try {
      const entries = Object.entries(marks).map(([id, status]) => ({ studentId: id, status }));
      const { data } = await api.post('/attendance/teachers/bulk', { date, entries });
      toast.success(data.message);
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="card grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn-primary" onClick={save} disabled={!teachers?.length || busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
        </button>
      </div>
      <div className="card overflow-hidden">
        {error ? <ErrorNote message={error} onRetry={load} /> : !teachers ? <Spinner /> : teachers.length === 0 ? <Empty message="No teachers yet" /> : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {teachers.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{t.name}</p>
                  <p className="text-xs text-slate-400">{t.employeeNo}</p>
                </div>
                <StatusPicker value={marks[t.id]} onChange={(v) => setMarks({ ...marks, [t.id]: v })} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AttendanceHistory() {
  const toast = useToast();
  const [batches, setBatches] = useState([]);
  const [filters, setFilters] = useState({ batchId: '', month: new Date().toISOString().slice(0, 7) });
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getArray('/batches').then(setBatches).catch((err) => toast.error(err.message));
  }, []);

  const load = useCallback(async () => {
    setRows(null);
    setError(null);
    try {
      setRows(await getArray('/attendance/students', {
        params: { batchId: filters.batchId || undefined, month: filters.month || undefined },
      }));
    } catch (err) { setError(err.message); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="card grid gap-4 p-5 sm:grid-cols-2">
        <SelectField label="Batch" value={filters.batchId} onChange={(e) => setFilters({ ...filters, batchId: e.target.value })}>
          <option value="">All batches</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </SelectField>
        <Field label="Month" type="month" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })} />
      </div>
      <div className="card overflow-x-auto">
        {error ? <ErrorNote message={error} onRetry={load} /> : !rows ? <Spinner /> : rows.length === 0 ? <Empty message="No attendance records this month" /> : (
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="th">Date</th>
                <th className="th">Student</th>
                <th className="th">Batch</th>
                <th className="th">Status</th>
                <th className="th">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => (
                <tr key={r.id} className="text-slate-700 dark:text-slate-300">
                  <td className="td">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                  <td className="td font-semibold text-slate-900 dark:text-white">{r.student.name}</td>
                  <td className="td">{r.batch?.name || '—'}</td>
                  <td className="td"><Badge value={r.status} /></td>
                  <td className="td text-slate-400">{r.remark || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function Attendance() {
  const { user } = useApp();
  const [tab, setTab] = useState('students');
  const isStaff = user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN');

  const tabs = [['students', 'Student Attendance', Users], ['teachers', 'Teacher Attendance', UserCheck], ['history', 'History', History]];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900 dark:text-white">
          <CalendarCheck size={24} className="text-brand-600" /> Attendance
        </h1>
        {!isStaff && <p className="text-xs text-slate-400">Teachers can mark attendance only.</p>}
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {tabs.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              tab === key ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === 'students' && <StudentMarking isStaff={isStaff} />}
      {tab === 'teachers' && <TeacherMarking />}
      {tab === 'history' && <AttendanceHistory />}
    </div>
  );
}
