import { useCallback, useEffect, useMemo, useState } from 'react';
import { IndianRupee, Plus, Trash2, Loader2, Receipt, Wand2, FileDown, Wallet, AlertTriangle, Printer } from 'lucide-react';
import api, { getArray, getObject, expectArray } from '../../api/client.js';
import { useApp, money } from '../../context/AppContext.jsx';
import { can as allowed } from '../../lib/permissions.js';
import { downloadAuthedFile, downloadCsv, printReport, reporterName } from '../../lib/reports.js';
import { Modal, Confirm, Spinner, Empty, ErrorNote, Field, SelectField, Badge, Avatar, useToast } from '../../components/ui.jsx';

const METHODS = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'ONLINE'];

const pretty = (v) => String(v ?? '—').replaceAll('_', ' ');

const asDate = (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const dueOf = (r) => Number(r.amount) + Number(r.lateFee) - Number(r.discount);
const paidOf = (r) => r.payments.reduce((s, p) => s + Number(p.amount), 0);

function SummaryCard({ label, value, Icon, grad }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white ${grad}`}><Icon size={20} /></span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-400">{label}</p>
        <p className="text-lg font-extrabold text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function ExportPair({ onPrint, onCsv, disabled }) {
  return (
    <div className="flex gap-2 no-print">
      <button type="button" className="btn-ghost" onClick={onPrint} disabled={disabled}><Printer size={16} /> Print</button>
      <button type="button" className="btn-ghost" onClick={onCsv} disabled={disabled}><FileDown size={16} /> CSV</button>
    </div>
  );
}

const emptyRecord = { studentId: '', feeType: 'Monthly Fee', period: '', amount: '', discount: '0', lateFee: '0', dueDate: new Date().toISOString().slice(0, 10) };

function RecordModal({ open, onClose, onSaved, students }) {
  const toast = useToast();
  const [form, setForm] = useState(emptyRecord);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setForm({ ...emptyRecord, studentId: students[0]?.id || '' }); }, [open, students]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/fees/records', {
        ...form,
        amount: Number(form.amount),
        discount: Number(form.discount) || 0,
        lateFee: Number(form.lateFee) || 0,
        period: form.period || undefined,
      });
      toast.success('Fee record created');
      onSaved(); onClose();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Fee Record">
      <form onSubmit={submit} className="space-y-4">
        <SelectField label="Student" required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
          <option value="">Select a student</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.admissionNo}</option>)}
        </SelectField>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fee Type" required value={form.feeType} onChange={(e) => setForm({ ...form, feeType: e.target.value })} />
          <Field label="Period" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="2026-11" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Amount" type="number" min="1" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <Field label="Discount" type="number" min="0" step="0.01" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
          <Field label="Late Fee" type="number" min="0" step="0.01" value={form.lateFee} onChange={(e) => setForm({ ...form, lateFee: e.target.value })} />
        </div>
        <Field label="Due Date" type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Create</button>
        </div>
      </form>
    </Modal>
  );
}

function PaymentModal({ open, onClose, onSaved, record, students }) {
  const toast = useToast();
  const [form, setForm] = useState({ studentId: '', amount: '', method: 'CASH', note: '', paymentDate: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (record) {
      const balance = Math.max(dueOf(record) - paidOf(record), 0);
      setForm({ studentId: record.studentId, amount: String(balance), method: 'CASH', note: '', paymentDate: new Date().toISOString().slice(0, 10) });
    } else {
      setForm({ studentId: students[0]?.id || '', amount: '', method: 'CASH', note: '', paymentDate: new Date().toISOString().slice(0, 10) });
    }
  }, [open, record, students]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/fees/payments', {
        studentId: form.studentId,
        feeRecordId: record?.id,
        amount: Number(form.amount),
        method: form.method,
        note: form.note || undefined,
        paymentDate: form.paymentDate,
      });
      toast.success(`Receipt ${data.receiptNo} created`);
      onSaved(); onClose();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={record ? `Collect · ${record.student?.name || 'Fee'}` : 'Record Payment'}>
      <form onSubmit={submit} className="space-y-4">
        {!record && (
          <SelectField label="Student" required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
            <option value="">Select a student</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.admissionNo}</option>)}
          </SelectField>
        )}
        {record && (
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800">
            <p className="font-semibold text-slate-800 dark:text-slate-200">{record.feeType}{record.period ? ` · ${record.period}` : ''}</p>
            <p className="text-xs text-slate-400">Payable {money(dueOf(record), null)} · Already paid {money(paidOf(record), null)}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount Received" type="number" min="1" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <SelectField label="Method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            {METHODS.map((m) => <option key={m} value={m}>{m.replaceAll('_', ' ')}</option>)}
          </SelectField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Payment Date" type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} />
          <Field label="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Save &amp; Generate Receipt</button>
        </div>
      </form>
    </Modal>
  );
}

function GenerateMonthlyModal({ open, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ period: new Date().toISOString().slice(0, 7), dueDate: `${new Date().toISOString().slice(0, 7)}-05`, feeType: 'Monthly Fee' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/fees/records/generate-monthly', form);
      toast.success(data.message);
      onSaved(); onClose();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Generate Monthly Fees">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">Creates one fee record per active student using their monthly fee. Students who already have a record for this period are skipped.</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Period" type="month" required value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} />
          <Field label="Due Date" type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </div>
        <Field label="Fee Type" required value={form.feeType} onChange={(e) => setForm({ ...form, feeType: e.target.value })} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Generate</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Fees() {
  const { user, settings } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState('records');
  const [summary, setSummary] = useState(null);
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState(null);
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState({ status: '', overdue: false });
  const [paymentFilter, setPaymentFilter] = useState({ from: '', to: '' });
  const [recordModal, setRecordModal] = useState(false);
  const [generate, setGenerate] = useState(false);
  const [payFor, setPayFor] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState({});

  const canManageFees = allowed(user, 'fees:write');
  const canCollect = allowed(user, 'payments:record');
  const canDeletePayment = allowed(user, 'payments:delete');

  const loadSummary = useCallback(() => getObject('/fees/summary').then(setSummary).catch(() => {}), []);
  const loadRecords = useCallback(async () => {
    setRecords(null);
    setError(null);
    setPicked({});
    try {
      const rows = await getArray('/fees/records', {
        status: filter.status || undefined, overdue: filter.overdue ? 'true' : undefined,
      });
      setRecords(rows.map((r) => ({ ...r, payments: Array.isArray(r.payments) ? r.payments : [] })));
    } catch (err) { setError(err.message); setRecords([]); }
  }, [filter]);
  const loadPayments = useCallback(async () => {
    setPayments(null);
    setError(null);
    setPicked({});
    try {
      setPayments(await getArray('/fees/payments', {
        from: paymentFilter.from || undefined, to: paymentFilter.to || undefined,
      }));
    } catch (err) { setError(err.message); setPayments([]); }
  }, [paymentFilter]);

  useEffect(() => {
    loadSummary();
    getObject('/students', { limit: 500, status: 'ACTIVE' })
      .then((data) => setStudents(expectArray(data.rows, '/students rows')))
      .catch((err) => setError(err.message));
  }, []);
  useEffect(() => { loadRecords(); }, [loadRecords]);
  useEffect(() => { if (tab === 'payments') loadPayments(); }, [tab, loadPayments]);

  const reloadAll = () => { loadRecords(); loadPayments(); loadSummary(); };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(del.kind === 'record' ? `/fees/records/${del.id}` : `/fees/payments/${del.id}`);
      toast.success('Deleted');
      setDel(null);
      reloadAll();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const downloadReceipt = (p) => downloadAuthedFile(api, `/fees/payments/${p.id}/receipt.pdf`, `receipt-${p.receiptNo || p.id}.pdf`)
    .catch((err) => toast.error(err.message));

  // The two finance tabs share one pattern: filtered rows, narrowed to the ticked rows when the
  // user picked any, printed or exported as a standalone sheet.
  const activeRows = tab === 'records' ? (records || []) : (payments || []);
  const selected = useMemo(() => activeRows.filter((r) => picked[r.id]), [activeRows, picked]);
  const outRows = selected.length ? selected : activeRows;

  const filterMeta = tab === 'records'
    ? [
      { label: 'Status filter', value: filter.status || 'All statuses' },
      { label: 'Overdue only', value: filter.overdue ? 'Yes' : 'No' },
    ]
    : [
      { label: 'From', value: asDate(paymentFilter.from) },
      { label: 'To', value: asDate(paymentFilter.to) },
    ];

  const feesReport = {
    title: tab === 'records' ? 'Fee Statement' : 'Payment Collection Report',
    subtitle: selected.length ? `${selected.length} selected records` : `${outRows.length} records`,
    meta: [
      { label: 'Centre', value: settings?.centerName || 'Tuition Center' },
      ...filterMeta,
      { label: 'Issued to', value: reporterName(user) },
    ],
    columns: tab === 'records'
      ? [
        { header: 'Student', value: (r) => r.student?.name },
        { header: 'Roll / Admission No.', value: (r) => r.student?.admissionNo },
        { header: 'Batch', value: (r) => r.student?.batch?.name },
        { header: 'Fee Type', value: (r) => r.feeType },
        { header: 'Period', value: (r) => r.period },
        { header: 'Payable', value: (r) => money(dueOf(r), settings), align: 'right' },
        { header: 'Paid', value: (r) => money(paidOf(r), settings), align: 'right' },
        { header: 'Balance', value: (r) => money(Math.max(dueOf(r) - paidOf(r), 0), settings), align: 'right' },
        { header: 'Due Date', value: (r) => asDate(r.dueDate) },
        { header: 'Status', value: (r) => pretty(r.status) },
      ]
      : [
        { header: 'Receipt No', value: (p) => p.receiptNo },
        { header: 'Student', value: (p) => p.student?.name },
        { header: 'Roll / Admission No.', value: (p) => p.student?.admissionNo },
        { header: 'Fee Type', value: (p) => p.feeRecord?.feeType || 'General' },
        { header: 'Period', value: (p) => p.feeRecord?.period },
        { header: 'Amount', value: (m) => money(m.amount, settings), align: 'right' },
        { header: 'Method', value: (p) => pretty(p.method) },
        { header: 'Payment Date', value: (p) => asDate(p.paymentDate) },
        { header: 'Received By', value: (p) => p.receivedBy?.email },
      ],
    rows: outRows,
    footer: tab === 'payments' && outRows.length
      ? `Collected in this sheet: ${money(outRows.reduce((s, p) => s + Number(p.amount || 0), 0), settings)}`
      : undefined,
  };

  const toggle = (id) => setPicked((p) => ({ ...p, [id]: !p[id] }));
  const allPicked = !!outRows.length && activeRows.every((r) => picked[r.id]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900 dark:text-white">
          <IndianRupee size={24} className="text-brand-600" /> Fees &amp; Payments
        </h1>
        <div className="flex flex-wrap gap-2 no-print">
          {canManageFees && (
            <button className="btn-secondary" onClick={() => setGenerate(true)}><Wand2 size={16} /> Generate Monthly</button>
          )}
          {canCollect && (
            <button className="btn-secondary" onClick={() => setPayFor('new')}><Wallet size={16} /> Record Payment</button>
          )}
          {canManageFees && (
            <button className="btn-primary" onClick={() => setRecordModal(true)}><Plus size={16} /> Fee Record</button>
          )}
        </div>
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total Billed" value={money(summary.totalDue, settings)} Icon={FileDown} grad="from-brand-500 to-indigo-600" />
          <SummaryCard label="Collected" value={money(summary.totalPaid, settings)} Icon={IndianRupee} grad="from-emerald-500 to-teal-600" />
          <SummaryCard label="Pending" value={money(summary.pending, settings)} Icon={AlertTriangle} grad="from-red-500 to-rose-600" />
          <SummaryCard label="Collected This Month" value={money(summary.monthlyCollected, settings)} Icon={Receipt} grad="from-violet-500 to-purple-600" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {[['records', 'Fee Records'], ['payments', 'Payment History']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                tab === key ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <ExportPair
          disabled={!outRows.length}
          onPrint={() => printReport(feesReport)}
          onCsv={() => downloadCsv({ ...feesReport, suffix: tab })}
        />
      </div>

      {tab === 'records' && (
        <>
          <div className="card flex flex-wrap items-center gap-4 p-4 no-print">
            <SelectField label="Status" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIAL">Partial</option>
              <option value="PAID">Paid</option>
            </SelectField>
            <label className="mt-5 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={filter.overdue}
                onChange={(e) => setFilter({ ...filter, overdue: e.target.checked })} />
              Overdue only
            </label>
            {selected.length > 0 && (
              <button type="button" className="btn-ghost mt-4" onClick={() => setPicked({})}>Clear {selected.length} selected</button>
            )}
          </div>
          <div className="card overflow-x-auto">
            {error ? <ErrorNote message={error} onRetry={loadRecords} /> : !records ? <Spinner /> : records.length === 0 ? <Empty message="No fee records match" /> : (
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="th w-10 no-print"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={allPicked}
                      onChange={() => setPicked(allPicked ? {} : Object.fromEntries(activeRows.map((r) => [r.id, true])))} aria-label="Select all" /></th>
                    <th className="th">Student</th><th className="th">Fee</th><th className="th">Payable</th>
                    <th className="th">Paid</th><th className="th">Balance</th><th className="th">Due</th>
                    <th className="th">Status</th>{(canCollect || canManageFees) && <th className="th no-print">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {records.map((r) => (
                    <tr key={r.id} className="text-slate-700 dark:text-slate-300">
                      <td className="td no-print"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={!!picked[r.id]}
                        onChange={() => toggle(r.id)} aria-label={`Select ${r.feeType}`} /></td>
                      <td className="td">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={r.student?.name} size="sm" />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{r.student?.name || 'Unknown student'}</p>
                            <p className="text-xs text-slate-400">{r.student?.admissionNo || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="td">{r.feeType}<span className="block text-xs text-slate-400">{r.period || '—'}</span></td>
                      <td className="td font-semibold">{money(dueOf(r), settings)}</td>
                      <td className="td text-emerald-600">{money(paidOf(r), settings)}</td>
                      <td className="td font-semibold text-rose-600">{money(Math.max(dueOf(r) - paidOf(r), 0), settings)}</td>
                      <td className="td">{new Date(r.dueDate).toLocaleDateString('en-IN')}</td>
                      <td className="td"><Badge value={r.status} /></td>
                      {(canCollect || canManageFees) && (
                        <td className="td no-print">
                          <div className="flex gap-1">
                            {canCollect && r.status !== 'PAID' && (
                              <button className="rounded-lg p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30" onClick={() => setPayFor(r)} aria-label="Collect"><Wallet size={16} /></button>
                            )}
                            {canManageFees && (
                              <button className="rounded-lg p-2 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30" onClick={() => setDel({ kind: 'record', id: r.id, name: `${r.feeType} for ${r.student?.name || 'this student'}` })} aria-label="Delete"><Trash2 size={16} /></button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'payments' && (
        <>
          <div className="card grid gap-4 p-4 sm:grid-cols-2 no-print">
            <Field label="From" type="date" value={paymentFilter.from} onChange={(e) => setPaymentFilter({ ...paymentFilter, from: e.target.value })} />
            <Field label="To" type="date" value={paymentFilter.to} onChange={(e) => setPaymentFilter({ ...paymentFilter, to: e.target.value })} />
            {selected.length > 0 && (
              <button type="button" className="btn-ghost" onClick={() => setPicked({})}>Clear {selected.length} selected</button>
            )}
          </div>
          <div className="card overflow-x-auto">
            {error ? <ErrorNote message={error} onRetry={loadPayments} /> : !payments ? <Spinner /> : payments.length === 0 ? <Empty message="No payments recorded" /> : (
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="th w-10 no-print"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={allPicked}
                      onChange={() => setPicked(allPicked ? {} : Object.fromEntries(activeRows.map((r) => [r.id, true])))} aria-label="Select all" /></th>
                    <th className="th">Receipt</th><th className="th">Student</th><th className="th">Fee</th>
                    <th className="th">Amount</th><th className="th">Method</th><th className="th">Date</th>
                    {(canDeletePayment || canCollect) && <th className="th no-print">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {payments.map((p) => (
                    <tr key={p.id} className="text-slate-700 dark:text-slate-300">
                      <td className="td no-print"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={!!picked[p.id]}
                        onChange={() => toggle(p.id)} aria-label={`Select receipt ${p.receiptNo}`} /></td>
                      <td className="td font-mono text-xs">{p.receiptNo}</td>
                      <td className="td font-semibold text-slate-900 dark:text-white">{p.student?.name || '—'}</td>
                      <td className="td">{p.feeRecord?.feeType || 'General'}<span className="block text-xs text-slate-400">{p.feeRecord?.period || ''}</span></td>
                      <td className="td font-bold text-emerald-600">{money(p.amount, settings)}</td>
                      <td className="td"><Badge value={p.method} /></td>
                      <td className="td">{new Date(p.paymentDate).toLocaleDateString('en-IN')}</td>
                      {(canDeletePayment || canCollect) && (
                        <td className="td no-print">
                          <div className="flex gap-1">
                            <button className="rounded-lg p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30" onClick={() => downloadReceipt(p)} aria-label="Receipt PDF"><Receipt size={16} /></button>
                            {canDeletePayment && (
                              <button className="rounded-lg p-2 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30" onClick={() => setDel({ kind: 'payment', id: p.id, name: `receipt ${p.receiptNo}` })} aria-label="Delete"><Trash2 size={16} /></button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <RecordModal open={recordModal} onClose={() => setRecordModal(false)} onSaved={reloadAll} students={students} />
      <GenerateMonthlyModal open={generate} onClose={() => setGenerate(false)} onSaved={reloadAll} />
      <PaymentModal open={!!payFor} record={payFor === 'new' ? null : payFor} onClose={() => setPayFor(null)} onSaved={reloadAll} students={students} />
      <Confirm open={!!del} onClose={() => setDel(null)} onConfirm={remove} busy={busy} message={`Delete ${del?.name}? Payments linked to a fee record are kept.`} />
    </div>
  );
}
