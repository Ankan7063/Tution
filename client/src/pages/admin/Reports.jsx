import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Printer, FileDown } from 'lucide-react';
import { getArray, getObject, expectArray } from '../../api/client.js';
import { useApp, money } from '../../context/AppContext.jsx';
import { can as allowed } from '../../lib/permissions.js';
import { downloadCsv, printReport, reporterName } from '../../lib/reports.js';
import { Spinner, Empty, Field, SelectField, Badge, useToast, ErrorNote } from '../../components/ui.jsx';

// `money` marks a column only an authorised role may see or export; the server already
// redacts it, and the UI drops the column so a report never prints an empty rupee column.
const REPORTS = [
  ['fees', 'Fee Statement', 'fees:read'],
  ['collection', 'Payment Collection', 'fees:read'],
  ['attendance', 'Attendance Register'],
  ['students', 'Student Directory'],
  ['teachers', 'Teacher Directory'],
  ['exam', 'Exam Result Sheet'],
];

const COLUMNS = {
  fees: [
    ['student.name', 'Student'], ['student.admissionNo', 'Admission No'], ['student.course.name', 'Course'],
    ['feeType', 'Fee Type'], ['period', 'Period'], ['payable', 'Payable', 'money'], ['paid', 'Paid', 'money'],
    ['balance', 'Balance', 'money'], ['dueDate', 'Due Date'], ['status', 'Status'],
  ],
  collection: [
    ['receiptNo', 'Receipt'], ['student.name', 'Student'], ['student.admissionNo', 'Admission No'],
    ['amount', 'Amount', 'money'], ['method', 'Method'], ['paymentDate', 'Date'], ['feeRecord.feeType', 'Fee Type'],
    ['receivedBy.email', 'Received By'],
  ],
  attendance: [
    ['date', 'Date'], ['student.name', 'Student'], ['student.admissionNo', 'Admission No'],
    ['student.classGrade', 'Class'], ['student.batch.name', 'Batch'], ['status', 'Status'], ['remark', 'Remark'],
  ],
  students: [
    ['admissionNo', 'Admission No'], ['name', 'Name'], ['classGrade', 'Class'], ['phone', 'Phone'],
    ['parentName', 'Guardian'], ['parentPhone', 'Guardian Phone'], ['course.name', 'Course'],
    ['batch.name', 'Batch'], ['monthlyFee', 'Monthly Fee', 'money'], ['status', 'Status'],
  ],
  teachers: [
    ['employeeNo', 'Employee No'], ['name', 'Name'], ['specialization', 'Specialization'],
    ['phone', 'Phone'], ['email', 'Email'], ['salary', 'Salary', 'money'],
    ['subjects', 'Subjects'], ['batches', 'Batches'],
  ],
  exam: [
    ['student.name', 'Student'], ['student.admissionNo', 'Admission No'], ['student.batch.name', 'Batch'],
    ['subject.name', 'Subject'], ['marksObtained', 'Marks'], ['percentage', 'Percentage'], ['grade', 'Grade'], ['remarks', 'Remarks'],
  ],
};

const MONEY_PATHS = {
  fees: ['payable', 'paid', 'balance'],
  collection: ['amount'],
  students: ['monthlyFee'],
  teachers: ['salary'],
};

function dig(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function cellText(value) {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.map((v) => v?.name ?? v).filter(Boolean).join(', ') || '—';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  if (typeof value === 'string') return value;
  return String(value);
}

export default function Reports() {
  const { user, settings } = useApp();
  const toast = useToast();
  const [kind, setKind] = useState('fees');
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [exams, setExams] = useState([]);
  const [filters, setFilters] = useState({ from: '', to: '', courseId: '', batchId: '', status: '', method: '', examId: '' });
  const [rows, setRows] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [picked, setPicked] = useState({});

  const seesMoney = allowed(user, 'fees:read');
  const reports = REPORTS.filter(([, , perm]) => !perm || allowed(user, perm));
  const title = (reports.find(([key]) => key === kind) || reports[0] || ['', 'Report'])[1];
  const mayRun = (key) => reports.some(([k]) => k === key);

  // A role without fee access defaults to the register instead of an empty financial report.
  useEffect(() => {
    if (kind && !mayRun(kind)) setKind(reports[0]?.[0] ?? 'attendance');
  }, [reports, kind]);

  useEffect(() => {
    getArray('/courses').then(setCourses).catch((err) => toast.error(err.message));
    getArray('/batches').then(setBatches).catch((err) => toast.error(err.message));
    getArray('/examinations').then((data) => { setExams(data); if (data.length) setFilters((f) => ({ ...f, examId: f.examId || data[0].id })); }).catch((err) => toast.error(err.message));
  }, []);

  const run = useCallback(async () => {
    if (!mayRun(kind)) return;
    setLoading(true);
    setRows(null);
    setSummary(null);
    setError(null);
    setPicked({});
    const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null));
    try {
      if (kind === 'fees') {
        const data = await getObject('/reports/fees', clean({ from: filters.from, to: filters.to, courseId: filters.courseId, batchId: filters.batchId, status: filters.status }));
        setRows(expectArray(data.rows, 'report rows')); setSummary(data.summary);
      } else if (kind === 'collection') {
        const data = await getObject('/reports/collection', clean({ from: filters.from, to: filters.to, courseId: filters.courseId, batchId: filters.batchId, method: filters.method }));
        setRows(expectArray(data.rows, 'report rows')); setSummary(data.summary);
      } else if (kind === 'attendance') {
        setRows(await getArray('/reports/attendance', clean({ from: filters.from, to: filters.to, batchId: filters.batchId }))); setSummary(null);
      } else if (kind === 'students') {
        setRows(await getArray('/reports/students', clean({ courseId: filters.courseId, batchId: filters.batchId, status: filters.status }))); setSummary(null);
      } else if (kind === 'teachers') {
        setRows(await getArray('/reports/teachers')); setSummary(null);
      } else if (kind === 'exam') {
        if (!filters.examId) { setRows([]); setLoading(false); return; }
        const data = await getObject(`/reports/exams/${filters.examId}`);
        const list = expectArray(data.rows, 'report rows');
        setRows(list);
        setSummary({ exam: data.exam.name, totalMarks: data.exam.totalMarks, count: list.length });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [kind, filters]);

  useEffect(() => { run(); }, [run]);

  const centerName = settings?.centerName || 'Tuition Center';

  const columns = useMemo(
    () => (COLUMNS[kind] || []).filter(([path, , flag]) => flag !== 'money' || seesMoney),
    [kind, seesMoney],
  );

  const moneyPaths = MONEY_PATHS[kind] || [];

  // Table cell, printed cell and CSV cell all resolve through this, so what is on screen is
  // what leaves the browser.
  const display = useCallback((row, path) => {
    const raw = dig(row, path);
    if (moneyPaths.includes(path)) return raw == null ? '—' : money(raw, settings);
    return cellText(raw);
  }, [moneyPaths, settings]);

  const raw = useCallback((row, path) => {
    const value = dig(row, path);
    if (moneyPaths.includes(path)) return value ?? '';
    if (Array.isArray(value)) return value.map((v) => v?.name ?? v).filter(Boolean).join(', ');
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toISOString().slice(0, 10);
    return value ?? '';
  }, [moneyPaths]);

  // Ticked rows only when something is ticked; otherwise every row the filters returned.
  const selected = useMemo(
    () => (rows || []).filter((r, i) => picked[r.id ?? i]),
    [rows, picked],
  );
  const outRows = selected.length ? selected : (rows || []);

  const reportMeta = [
    { label: 'Centre', value: centerName },
    { label: 'Report', value: title },
    kind !== 'teachers' && { label: 'Batch', value: batches.find((b) => b.id === filters.batchId)?.name || 'All batches' },
    kind === 'students' && { label: 'Course', value: courses.find((c) => c.id === filters.courseId)?.name || 'All courses' },
    ['fees', 'collection', 'attendance'].includes(kind) && {
      label: 'Period',
      value: [filters.from, filters.to].filter(Boolean).map((d) => new Date(d).toLocaleDateString('en-IN')).join(' to ') || 'All time',
    },
    kind === 'fees' && { label: 'Status', value: filters.status || 'All statuses' },
    kind === 'collection' && { label: 'Method', value: filters.method || 'All methods' },
    { label: 'Issued to', value: reporterName(user) },
  ].filter(Boolean);

  const printCols = columns.map(([path, header]) => ({ header, value: (row) => display(row, path), align: moneyPaths.includes(path) ? 'right' : 'left' }));
  const csvCols = columns.map(([path, header]) => ({ header, value: (row) => raw(row, path) }));

  const doPrint = () => printReport({
    title: `${centerName} — ${title}`,
    subtitle: `${outRows.length} record${outRows.length === 1 ? '' : 's'}${selected.length ? ' (selection)' : ''}`,
    meta: reportMeta,
    columns: printCols,
    rows: outRows,
    footer: summary?.total != null ? `Total collected: ${money(summary.total, settings)}` : undefined,
  });

  const doCsv = () => downloadCsv({
    title,
    subtitle: reportMeta.map((m) => `${m.label}: ${m.value}`).join(' · '),
    columns: csvCols,
    rows: outRows,
    suffix: filters.batchId || filters.examId || '',
  });

  const allPicked = !!rows?.length && rows.every((r, i) => picked[r.id ?? i]);
  const toggle = (key) => setPicked((p) => ({ ...p, [key]: !p[key] }));
  const toggleAll = () => setPicked(allPicked ? {} : Object.fromEntries((rows || []).map((r, i) => [r.id ?? i, true])));

  const show = (row, path) => {
    const rawValue = dig(row, path);
    if (['status', 'method', 'grade'].includes(path.split('.').pop())) return <Badge value={rawValue} />;
    return display(row, path);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900 dark:text-white">
          <BarChart3 size={24} className="text-brand-600" /> Reports
        </h1>
        <div className="flex gap-2 no-print">
          <button className="btn-ghost" onClick={doPrint} disabled={!outRows.length}><Printer size={16} /> Print</button>
          <button className="btn-primary" onClick={doCsv} disabled={!outRows.length}><FileDown size={16} /> CSV</button>
        </div>
      </div>

      <div className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 no-print">
        <SelectField label="Report" value={kind} onChange={(e) => setKind(e.target.value)}>
          {reports.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
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

      <div className="card overflow-x-auto">
        {error ? <ErrorNote message={error} onRetry={run} /> : loading ? <Spinner label="Building report…" /> : !rows || rows.length === 0 ? <Empty message="No data for the selected filters" /> : (
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="th no-print"><input type="checkbox" checked={allPicked} onChange={toggleAll} aria-label="Select all rows" className="h-4 w-4 accent-brand-600" /></th>
                {columns.map(([path, header]) => <th key={path} className="th">{header}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r, i) => {
                const key = r.id ?? i;
                return (
                  <tr key={key} className="text-slate-700 dark:text-slate-300">
                    <td className="td no-print">
                      <input type="checkbox" checked={!!picked[key]} onChange={() => toggle(key)}
                        aria-label="Select row" className="h-4 w-4 accent-brand-600" />
                    </td>
                    {columns.map(([path]) => <td key={path} className="td">{show(r, path)}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {rows?.length > 0 && (
        <p className="text-xs text-slate-400">
          {selected.length ? `${selected.length} selected of ${rows.length} rows` : `${rows.length} rows`} — print and CSV follow the filters and selection. Reports cap at 2000 rows per run.
        </p>
      )}
    </div>
  );
}
