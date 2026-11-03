import { useCallback, useEffect, useState } from 'react';
import { Megaphone, Plus, Trash2, Loader2, Users, UserCheck, Globe } from 'lucide-react';
import api, { getArray } from '../../api/client.js';
import { Modal, Confirm, Spinner, Empty, Field, SelectField, useToast, ErrorNote } from '../../components/ui.jsx';

const audienceIcon = { ALL: Globe, STUDENTS: Users, TEACHERS: UserCheck };

export default function Announcements() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', audience: 'ALL', expiresAt: '' });

  const load = useCallback(() => {
    setRows(null);
    setError(null);
    getArray('/announcements').then(setRows).catch((err) => setError(err.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/announcements', { ...form, expiresAt: form.expiresAt || undefined });
      toast.success('Announcement published');
      setForm({ title: '', message: '', audience: 'ALL', expiresAt: '' });
      setOpen(false);
      load();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/announcements/${del.id}`);
      toast.success('Announcement deleted');
      setDel(null);
      load();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900 dark:text-white">
          <Megaphone size={24} className="text-brand-600" /> Announcements
        </h1>
        <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> New Announcement</button>
      </div>

      {error ? <ErrorNote message={error} onRetry={load} /> : !rows ? <Spinner /> : rows.length === 0 ? <div className="card"><Empty message="No active announcements" /></div> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((a) => {
            const Icon = audienceIcon[a.audience] || Globe;
            return (
              <div key={a.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white">{a.title}</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{a.message}</p>
                  </div>
                  <button className="rounded-lg p-2 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30" onClick={() => setDel({ id: a.id, name: a.title })} aria-label="Delete"><Trash2 size={16} /></button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"><Icon size={12} className="mr-1" /> {a.audience}</span>
                  <span>Posted {new Date(a.createdAt).toLocaleDateString('en-IN')}</span>
                  {a.expiresAt && <span>Expires {new Date(a.expiresAt).toLocaleDateString('en-IN')}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New Announcement">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div>
            <label className="label">Message</label>
            <textarea className="input" rows={4} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Audience" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
              <option value="ALL">Everyone</option>
              <option value="STUDENTS">Students</option>
              <option value="TEACHERS">Teachers</option>
            </SelectField>
            <Field label="Expires (optional)" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Publish</button>
          </div>
        </form>
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} onConfirm={remove} busy={busy} message={`Delete “${del?.name}”?`} />
    </div>
  );
}
