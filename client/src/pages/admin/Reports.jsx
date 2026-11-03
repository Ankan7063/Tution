import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Download, Printer } from 'lucide-react';
import api from '../../api/client.js';
import { useApp, money } from '../../context/AppContext.jsx';
import { Spinner, Empty, Field, SelectField, Badge, useToast } from '../../components/ui.jsx';

const REPORTS = [
  ['fees', 'Fee Statement'],
  ['collection', 'Payment Collection'],
  ['attendance', 'Attendance Register'],
  ['students', 'Student Directory'],
  ['teachers', 'Teacher Directory'],
  ['exam', 'Exam Result Sheet'],
];

const COLUMNS = {
  fees: [
    ['student.name', 'Student'], ['student.admissionNo', 'Admission No'], ['student.course.name', 'Course'],
    ['feeType', 'Fee Type'], ['period', 'Period'], ['payable', 'Payable'], ['paid', 'Paid'], ['balance', 'Balance'],
    ['dueDate', 'Due Date'], ['status', 'Status'],
  ],
  collection: [
    ['receiptNo', 'Receipt'], ['student.name', 'Student'], ['student.admissionNo', 'Admission No'],
    ['amount', 'Amount'], ['method', 'Method'], ['paymentDate', 'Date'], ['feeRecord.feeType', 'Fee Type'],
    ['receivedBy.email', 'Received By'],
  ],
  attendance: [
    ['date', 'Date'], ['student.name', 'Student'], ['student.admissionNo', 'Admission No'],
    ['student.batch.name', 'Batch'], ['status', 'Status'], ['remark', 'Remark'],
  ],
  students: [
    ['admissionNo', 'Admission No'], ['name', 'Name'], ['classGrade', 'Class'], ['phone', 'Phone'],
    ['parentName', 'Guardian'], ['parentPhone', 'Guardian Phone'], ['course.name', 'Course'],
    ['batch.name', 'Batch'], ['monthlyFee', 'Monthly Fee'], ['status', 'Status'],
  ],
  teachers: [
    ['employeeNo', 'Employee No'], ['name', 'Name'], ['specialization', 'Specialization'],
    ['phone', 'Phone'], ['email', 'Email'], ['salary', 'Salary'],
    ['subjects', 'Subjects'], ['batches', 'Batches'],
  ],
  exam: [
    ['student.name', 'Student'], ['student.admissionNo', 'Admission No'], ['student.batch.name', 'Batch'],
    ['subject.name', 'Subject'], ['marksObtained', 'Marks'], ['percentage', 'Percentage'], ['grade', 'Grade'], ['remarks', 'Remarks'],
  ],
};

function dig(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function cellText(value) {
  if (value == null) return '—';
  if (Array.isArray(value)) return value.map((v) => v.name).join(', ');
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleDateString('en-IN');
  return String(value);
}

function toCsv(columns, rows) {
  const escape = (v) => {
    const s = cellText(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [columns.map(([, h]) => h).join(','), ...rows.map((r) => columns.map(([path]) => escape(dig(r, path))).join(','))].join('\n');
}

export default function Reports() {
  const { settings } = useApp();
  const toast = useToast();
  const [kind, setKind] = useState('fees');
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [exams, setExams] = useState([]);
  const [filters, setFilters] = useState({ from: '', to: '', courseId: '', batchId: '', status: '', method: '', examId: '' });
  const [rows, setRows] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/courses').then(({ data }) => setCourses(data)).catch(() => {});
    api.get('/batches').then(({ data }) => setBatches(data)).catch(() => {});
    api.get('/examinations').then(({ data }) => { setExams(data); if (data.length) setFilters((f) => ({ ...f, examId: f.examId || data[0].id })); }).catch(() => {});
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    setRows(null);
    const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null));
    try {
      if (kind === 'fees') {
        const { data } = await api.get('/reports/fees', { params: clean({ from: filters.from, to: filters.to, courseId: filters.courseId, batchId: filters.batchId, status: filters.status }) });
        setRows(data.rows); setSummary(data.summary);
      } else if (kind === 'collection') {
        const { data } = await api.get('/reports/collection', { params: clean({ from: filters.from, to: filters.to, courseId: filters.courseId, batchId: filters.batchId, method: filters.method }) });
        setRows(data.rows); setSummary(data.summary);
      } else if (kind === 'attendance') {
        const { data } = await api.get('/reports/attendance', { params: clean({ from: filters.from, to: filters.to, batchId: filters.batchId }) });
        setRows(data); setSummary(null);
      } else if (kind === 'students') {
        const { data } = await api.get('/reports/students', { params: clean({ courseId: filters.courseId, batchId: filters.batchId, status: filters.status }) });
        setRows(data); setSummary(null);
      } else if (kind === 'teachers') {
        const { data } = await api.get('/reports/teachers');
        setRows(data); setSummary(null);
      } else if (kind === 'exam') {
        if (!filters.examId) { setRows([]); setLoading(false); return; }
        const { data } = await api.get(`/reports/exams/${filters.examId}`);
        setRows(data.rows);
        setSummary({ exam: data.exam.name, totalMarks: data.exam.totalMarks, count: data.rows.length });
      }
    } catch (err) {
      toast.error(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [kind, filters]);

  useEffect(() => { run(); }, [run]);

  const columns = COLUMNS[kind];
  const centerName = settings?.centerName || 'Tuition Center';

  const downloadCsv = () => {
    const blob = new Blob([toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${kind}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  const show = (v, path) => {
    const raw = dig(v, path);
    if (kind === 'fees' && ['payable', 'paid', 'balance'].includes(path)) return money(raw, settings);
    if (kind === 'collection' && path === 'amount') return money(raw, settings);
    if (kind === 'students' && path === 'monthlyFee') return money(raw, settings);
    if (kind === 'teachers' && path === 'salary') return money(raw, settings);
    if (['status', 'method', 'grade'].includes(path.split('.').pop())) return <Badge value={raw} />;
    return cellText(raw);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900 dark:text-white">
          <BarChart3 size={24} className="text-brand-600" /> Reports
        </h1>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => window.print()} disabled={!rows?.length}><Printer size={16} /> Print</button>
          <button className="btn-primary" onClick={downloadCsv} disabled={!rows?.length}><Download size={16} /> CSV</button>
        </div>
      </div>

      <div className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField label="Report" value={kind} onChange={(e) => setKind(e.target.value)}>
          {REPORTS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </SelectField>
        {kind === 'exam' ? (
          <SelectField label="Examination" value={filters.examId} onChange={(e) => setFilters({ ...filters, examId: e.target.value })}>
            {exams.length === 0 && <option value="">No examinations</option>}
            {exams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </SelectField>
        ) : (
          <>
            {(kind !== 'teachers') && <Field label="From" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />}
            {(kind === 'fees' || kind === 'collection' || kind === 'attendance') && <Field label="To" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />}
            {(kind === 'fees' || kind === 'collection' || kind === 'students') && (
              <SelectField label="Course" value={filters.courseId} onChange={(e) => setFilters({ ...filters, courseId: e.target.value })}>
                <option value="">All courses</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </SelectField>
            )}
            {(kind !== 'teachers' && kind !== 'students') && (
              <SelectField label="Batch" value={filters.batchId} onChange={(e) => setFilters({ ...filters, batchId: e.target.value })}>
                <option value="">All batches</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </SelectField>
            )}
            {(kind === 'fees' || kind === 'students') && (
              <SelectField label="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="PARTIAL">Partial</option>
                <option value="PAID">Paid</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="PASSED_OUT">Passed out</option>
              </SelectField>
            )}
            {kind === 'collection' && (
              <SelectField label="Method" value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })}>
                <option value="">All methods</option>
                {['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'ONLINE'].map((m) => <option key={m} value={m}>{m.replaceAll('_', ' ')}</option>)}
              </SelectField>
            )}
          </>
        )}
      </div>

      {summary && (
        <div className="card flex flex-wrap gap-6 px-5 py-4 text-sm">
          {kind === 'exam' ? (
            <>
              <span className="text-slate-500">Exam: <b className="text-slate-800 dark:text-slate-200">{summary.exam}</b></span>
              <span className="text-slate-500">Out of: <b className="text-slate-800 dark:text-slate-200">{summary.totalMarks}</b></span>
              <span className="text-slate-500">Students: <b className="text-slate-800 dark:text-slate-200">{summary.count}</b></span>
            </>
          ) : kind === 'collection' ? (
            <>
              <span className="text-slate-500">Collected: <b className="text-emerald-600">{money(summary.total, settings)}</b></span>
              <span className="text-slate-500">Payments: <b className="text-slate-800 dark:text-slate-200">{summary.count}</b></span>
            </>
          ) : (
            <>
              <span className="text-slate-500">Total payable: <b className="text-slate-800 dark:text-slate-200">{money(summary.totalPayable, settings)}</b></span>
              <span className="text-slate-500">Paid: <b className="text-emerald-600">{money(summary.totalPaid, settings)}</b></span>
              <span className="text-slate-500">Pending: <b className="text-rose-600">{money(summary.totalPending, settings)}</b></span>
            </>
          )}
        </div>
      )}

      <div className="card overflow-x-auto" id="report-table">
        <div className="hidden px-5 pt-5 print:block">
          <p className="text-lg font-extrabold">{centerName}</p>
          <p className="text-xs text-slate-500">{REPORTS.find(([k]) => k === kind)[1]} · generated {new Date().toLocaleString('en-IN')}</p>
        </div>
        {loading ? <Spinner label="Building report…" /> : !rows || rows.length === 0 ? <Empty message="No data for the selected filters" /> : (
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>{columns.map(([path, header]) => <th key={path} className="th">{header}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r, i) => (
                <tr key={r.id || i} className="text-slate-700 dark:text-slate-300">
                  {columns.map(([path]) => <td key={path} className="td">{show(r, path)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {rows?.length > 0 && <p className="text-xs text-slate-400">{rows.length} rows. Reports cap at 2000 rows per run.</p>}
    </div>
  );
}
