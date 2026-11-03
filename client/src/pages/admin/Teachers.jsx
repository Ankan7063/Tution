import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, Loader2, Phone, MessageCircle, Mail, Printer, FileDown } from 'lucide-react';
import api, { getArray, expectArray } from '../../api/client.js';
import { useApp, money, waLink } from '../../context/AppContext.jsx';
import { can as allowed } from '../../lib/permissions.js';
import { downloadCsv, printReport, reporterName } from '../../lib/reports.js';
import { Modal, Confirm, Spinner, Empty, ErrorNote, Badge, Field, SelectField, useToast, Avatar } from '../../components/ui.jsx';

const emptyForm = { name: '', phone: '', email: '', specialization: '', salary: '', status: 'ACTIVE' };

function TeacherFormModal({ open, onClose, onSaved, teacher }) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const isEdit = !!teacher?.id;

  useEffect(() => {
    setForm(teacher ? { ...emptyForm, ...teacher, salary: teacher.salary ?? '' } : emptyForm);
  }, [teacher, open]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, salary: Number(form.salary) || 0 };
      if (!payload.email) delete payload.email;
      if (isEdit) await api.put(`/teachers/${teacher.id}`, payload);
      else await api.post('/teachers', payload);
      toast.success(isEdit ? 'Teacher updated' : 'Teacher added');
      onSaved(); onClose();
    } catch (err) {
      toast.error(err.message);
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Teacher' : 'Add Teacher'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Field label="Specialization" value={form.specialization || ''} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="e.g. Mathematics" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Field label="Monthly Salary (₹)" type="number" min="0" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
        </div>
        <Field label="Email" type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Optional login email" />
        <SelectField label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option>ACTIVE</option><option>INACTIVE</option><option>PASSED_OUT</option>
        </SelectField>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} {isEdit ? 'Save' : 'Add Teacher'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Teachers() {
  const { user, settings } = useApp();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState({ open: false, teacher: null });
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);

  const canWrite = allowed(user, 'teachers:write');
  // A teacher or front-desk account has no pay data in its payload at all; the API redacts it,
  // so the row is dropped rather than printed as ₹0.
  const seesSalary = allowed(user, 'fees:read');

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getArray(`/teachers${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      setRows(data.map((t) => ({
        ...t,
        batches: expectArray(t.batches ?? [], '/teachers batches'),
        subjects: expectArray(t.subjects ?? [], '/teachers subjects'),
      })));
    } catch (err) { setError(err.message); }
  }, [search]);
  useEffect(() => { load(); }, [load]);

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/teachers/${del.id}`);
      toast.success('Teacher deleted'); setDel(null); load();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const columns = [
    { header: 'Employee No', value: (t) => t.employeeNo },
    { header: 'Name', value: (t) => t.name },
    { header: 'Specialization', value: (t) => t.specialization },
    { header: 'Phone', value: (t) => t.phone },
    { header: 'Email', value: (t) => t.email },
    { header: 'Batches', value: (t) => (t.batches || []).map((b) => b.name).join(', ') },
    { header: 'Subjects', value: (t) => (t.subjects || []).map((s) => s.name).join(', ') },
    { header: 'Status', value: (t) => String(t.status || '—').replaceAll('_', ' ') },
    seesSalary && { header: 'Monthly Salary', value: (t) => money(t.salary, settings), align: 'right' },
  ].filter(Boolean);

  const report = {
    title: 'Teacher & Staff Directory',
    subtitle: search ? `Search: ${search}` : 'All faculty',
    meta: [
      { label: 'Centre', value: settings?.centerName || 'Tuition Center' },
      { label: 'Search filter', value: search || '—' },
      { label: 'Issued to', value: reporterName(user) },
    ],
    columns,
    rows: rows || [],
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Teachers</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2 no-print">
            <button className="btn-ghost" onClick={() => printReport(report)} disabled={!rows?.length}>
              <Printer size={16} /> Print
            </button>
            <button className="btn-ghost" onClick={() => downloadCsv({ ...report, suffix: search })} disabled={!rows?.length}>
              <FileDown size={16} /> CSV
            </button>
          </div>
          {canWrite && (
            <button className="btn-primary" onClick={() => setModal({ open: true, teacher: null })}><Plus size={18} /> Add Teacher</button>
          )}
        </div>
      </div>
      <div className="card p-4 no-print">
        <div className="relative max-w-md">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search by name, employee no, specialization…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {error ? <ErrorNote message={error} onRetry={load} />
        : !rows ? <Spinner /> : rows.length === 0 ? <div className="card"><Empty message="No teachers found" /></div> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((t) => (
            <div key={t.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={t.name} />
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.employeeNo} · {t.specialization || 'Faculty'}</p>
                  </div>
                </div>
                <Badge value={t.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {t.batches.map((b) => <span key={b.id} className="badge bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{b.name}</span>)}
                {t.subjects.map((s) => <span key={s.id} className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{s.name}</span>)}
              </div>
              {seesSalary && (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Salary: <span className="font-bold text-slate-700 dark:text-slate-200">{money(t.salary, settings)}</span>/month</p>
              )}
              <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                {t.phone && (
                  <>
                    <a className="btn flex-1 bg-emerald-500 !px-2 text-white hover:bg-emerald-600" target="_blank" rel="noreferrer" href={waLink(t.phone, `Hi ${t.name}, this is ${settings?.centerName || 'Tuition Center'}.`)}><MessageCircle size={15} /> WhatsApp</a>
                    <a className="btn flex-1 bg-sky-600 !px-2 text-white hover:bg-sky-700" href={`tel:+${String(t.phone).replace(/\D/g, '')}`}><Phone size={15} /> Call</a>
                  </>
                )}
                {t.email && <a className="btn-ghost !px-3" href={`mailto:${t.email}`} aria-label="Email"><Mail size={15} /></a>}
                {canWrite && (
                  <>
                    <button className="btn-ghost ml-auto !px-3" onClick={() => setModal({ open: true, teacher: t })} aria-label="Edit"><Pencil size={15} /></button>
                    <button className="rounded-lg p-2 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30" onClick={() => setDel(t)} aria-label="Delete"><Trash2 size={15} /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <TeacherFormModal open={modal.open} teacher={modal.teacher} onClose={() => setModal({ open: false, teacher: null })} onSaved={load} />
      <Confirm open={!!del} onClose={() => setDel(null)} onConfirm={remove} busy={busy} message={`Delete ${del?.name}?`} />
    </div>
  );
}
