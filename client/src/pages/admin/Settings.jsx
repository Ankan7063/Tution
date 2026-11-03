import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Loader2, Save, KeyRound, UserCog, Building2, Bell } from 'lucide-react';
import api from '../../api/client.js';
import { useApp } from '../../context/AppContext.jsx';
import { Field, SelectField, Spinner, useToast } from '../../components/ui.jsx';

const defaults = {
  centerName: '', tagline: '', address: '', phone: '', whatsapp: '', email: '', website: '',
  academicSession: '', currency: 'INR', currencySymbol: '₹', logoUrl: '',
  notifyFeePending: true, notifyNewStudent: true, notifyExam: true,
};

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-800">
      <span>
        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</span>
        <span className="block text-xs text-slate-400">{hint}</span>
      </span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </label>
  );
}

function AccountPanel({ students, teachers }) {
  const toast = useToast();
  const [form, setForm] = useState({ email: '', password: '', role: 'TEACHER', studentId: '', teacherId: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/auth/users', {
        email: form.email,
        password: form.password,
        role: form.role,
        studentId: form.role === 'STUDENT' && form.studentId ? form.studentId : undefined,
        teacherId: form.role === 'TEACHER' && form.teacherId ? form.teacherId : undefined,
      });
      toast.success('Account created');
      setForm({ ...form, email: '', password: '', studentId: '', teacherId: '' });
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><UserCog size={18} className="text-brand-600" /> Staff &amp; Portal Accounts</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create a login for a teacher or student so they can access the portal.</p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Field label="Password" type="text" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min. 8 characters" />
        </div>
        <SelectField label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="ADMIN">Admin</option>
          <option value="TEACHER">Teacher</option>
          <option value="STUDENT">Student</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </SelectField>
        {form.role === 'STUDENT' && (
          <SelectField label="Link to student" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
            <option value="">None</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.admissionNo}</option>)}
          </SelectField>
        )}
        {form.role === 'TEACHER' && (
          <SelectField label="Link to teacher" value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
            <option value="">None</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.employeeNo}</option>)}
          </SelectField>
        )}
        <div className="flex justify-end">
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Create Account</button>
        </div>
      </form>
    </div>
  );
}

function PasswordPanel() {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/auth/change-password', form);
      toast.success('Password updated');
      setForm({ currentPassword: '', newPassword: '' });
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><KeyRound size={18} className="text-brand-600" /> Change My Password</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <Field label="Current Password" type="password" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        <Field label="New Password" type="password" required minLength={8} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} placeholder="min. 8 characters" />
        <div className="flex justify-end">
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Update Password</button>
        </div>
      </form>
    </div>
  );
}

export default function Settings() {
  const { settings, loadSettings } = useApp();
  const toast = useToast();
  const [form, setForm] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);

  useEffect(() => {
    if (settings) setForm({ ...defaults, ...settings });
  }, [settings]);

  useEffect(() => {
    api.get('/students', { params: { limit: 500 } }).then(({ data }) => setStudents(data.rows)).catch(() => {});
    api.get('/teachers').then(({ data }) => setTeachers(data)).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.put('/settings', {
        centerName: form.centerName, tagline: form.tagline || null, address: form.address || null,
        phone: form.phone || null, whatsapp: form.whatsapp || null, email: form.email || '',
        website: form.website || null, academicSession: form.academicSession, currency: form.currency,
        currencySymbol: form.currencySymbol, logoUrl: form.logoUrl || null,
        notifyFeePending: form.notifyFeePending, notifyNewStudent: form.notifyNewStudent, notifyExam: form.notifyExam,
      });
      setForm({ ...defaults, ...data });
      await loadSettings();
      toast.success('Settings saved');
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  if (!settings) return <Spinner label="Loading settings…" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900 dark:text-white">
          <SettingsIcon size={24} className="text-brand-600" /> Settings
        </h1>
        <button className="btn-primary" onClick={save} disabled={busy}><Save size={16} /> {busy ? 'Saving…' : 'Save Changes'}</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><Building2 size={18} className="text-brand-600" /> Center Profile</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">These details drive the public website, receipts and the call / WhatsApp / email buttons.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Center Name" required value={form.centerName} onChange={(e) => setForm({ ...form, centerName: e.target.value })} />
            <Field label="Tagline" value={form.tagline || ''} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
            <Field label="Phone (click-to-call)" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="919876543210" />
            <Field label="WhatsApp Number" value={form.whatsapp || ''} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="919876543210" />
            <Field label="Email" type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Field label="Website" value={form.website || ''} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" />
            <div className="sm:col-span-2">
              <label className="label">Address</label>
              <textarea className="input" rows={2} value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <Field label="Logo / Image URL" value={form.logoUrl || ''} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://…" />
            <Field label="Academic Session" value={form.academicSession} onChange={(e) => setForm({ ...form, academicSession: e.target.value })} />
            <Field label="Currency Code" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            <Field label="Currency Symbol" value={form.currencySymbol} onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })} />
          </div>
        </div>

        <div className="card space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><Bell size={18} className="text-brand-600" /> Notifications</h2>
          <Toggle label="Pending fee alerts" hint="Notify admins when a fee stays unpaid." checked={form.notifyFeePending} onChange={(v) => setForm({ ...form, notifyFeePending: v })} />
          <Toggle label="New student alerts" hint="Notify admins on every admission." checked={form.notifyNewStudent} onChange={(v) => setForm({ ...form, notifyNewStudent: v })} />
          <Toggle label="Exam alerts" hint="Notify admins when an exam is scheduled." checked={form.notifyExam} onChange={(v) => setForm({ ...form, notifyExam: v })} />
        </div>

        <PasswordPanel />
        <div className="lg:col-span-2"><AccountPanel students={students} teachers={teachers} /></div>
      </div>
    </div>
  );
}
