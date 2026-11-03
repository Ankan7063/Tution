import { useCallback, useEffect, useMemo, useState } from 'react';
import { UserCog, Plus, KeyRound, Loader2, Pencil, Printer, FileDown } from 'lucide-react';
import api, { getArray, getObject, expectArray } from '../../api/client.js';
import { useApp } from '../../context/AppContext.jsx';
import { can as allowed } from '../../lib/permissions.js';
import { downloadCsv, printReport, reporterName } from '../../lib/reports.js';
import { Modal, Confirm, Spinner, Empty, ErrorNote, Field, SelectField, Badge, useToast } from '../../components/ui.jsx';

// Roles an admin may hand out. SUPER_ADMIN is offered only to a super admin session.
const ROLE_ORDER = ['ADMIN', 'TEACHER', 'STAFF', 'STUDENT', 'SUPER_ADMIN'];

const roleLabel = (label, role) => label ?? role;

const emptyForm = { email: '', password: '', role: 'TEACHER', permissions: [], studentId: '', teacherId: '' };

function PermissionPicker({ catalogue, selected, onChange }) {
  return (
    <div>
      <p className="label">Extra permissions (on top of the role)</p>
      <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
        {catalogue.map((p) => (
          <label key={p.key} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={selected.includes(p.key)}
              onChange={(e) => onChange(e.target.checked ? [...selected, p.key] : selected.filter((x) => x !== p.key))} />
            <span className="min-w-0">
              <span className="block font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{p.key}</span>
              <span className="block text-xs text-slate-400">{p.description}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function AccountModal({ open, onClose, onSaved, account, catalogue, roleLabels, students, teachers, isSuperAdmin }) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const isEdit = !!account?.id;

  useEffect(() => {
    if (!open) return;
    setForm(account
      ? {
        ...emptyForm,
        role: account.role,
        permissions: account.permissions || [],
        email: account.email,
        studentId: account.student?.id || '',
        teacherId: account.teacher?.id || '',
      }
      : emptyForm);
  }, [open, account]);

  const roles = ROLE_ORDER.filter((r) => r !== 'SUPER_ADMIN' || isSuperAdmin || r === account?.role);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (isEdit) {
        await api.patch(`/auth/users/${account.id}`, {
          role: form.role,
          permissions: form.permissions,
          studentId: form.studentId || null,
          teacherId: form.teacherId || null,
        });
        toast.success('Account updated');
      } else {
        await api.post('/auth/users', {
          email: form.email,
          password: form.password,
          role: form.role,
          permissions: form.permissions,
          studentId: form.studentId || undefined,
          teacherId: form.teacherId || undefined,
        });
        toast.success('Account created');
      }
      onSaved(); onClose();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Edit ${account.email}` : 'Create Account'}>
      <form onSubmit={submit} className="space-y-4">
        {!isEdit && (
          <>
            <Field label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Field label="Initial Password" type="password" required minLength={8} value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" />
          </>
        )}
        <SelectField label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {roles.map((r) => <option key={r} value={r}>{roleLabel(roleLabels?.[r], r)}</option>)}
        </SelectField>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Linked student profile" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value, teacherId: '' })}>
            <option value="">None</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.admissionNo}</option>)}
          </SelectField>
          <SelectField label="Linked teacher profile" value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value, studentId: '' })}>
            <option value="">None</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.employeeNo}</option>)}
          </SelectField>
        </div>
        <PermissionPicker catalogue={catalogue || []} selected={form.permissions}
          onChange={(permissions) => setForm({ ...form, permissions })} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} {isEdit ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ open, onClose, account }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setPassword(''); }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post(`/auth/users/${account.id}/reset-password`, { newPassword: password });
      toast.success(data.message);
      onClose();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Reset password · ${account?.email || ''}`}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">Set a new password for this account. The current one is never shown, and the new one is not repeated after saving — pass it to the person directly.</p>
        <Field label="New Password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Reset Password</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Users() {
  const { user, settings } = useApp();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [catalogue, setCatalogue] = useState([]);
  const [roleLabels, setRoleLabels] = useState({});
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [modal, setModal] = useState({ open: false, account: null });
  const [resetting, setResetting] = useState(null);
  const [toggle, setToggle] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRows(null);
    setError(null);
    try {
      setRows(await getArray('/auth/users'));
    } catch (err) { setError(err.message); setRows([]); }
  }, []);

  useEffect(() => {
    load();
    api.get('/auth/permissions').then(({ data }) => {
      setCatalogue(data.catalogue || []);
      setRoleLabels(data.roleLabels || {});
    }).catch(() => {});
    getObject('/students', { limit: 500, status: 'ACTIVE' })
      .then((data) => setStudents(expectArray(data.rows, '/students rows'))).catch(() => {});    getArray('/teachers').then(setTeachers).catch(() => {});
  }, [load]);

  const visible = useMemo(() => {
    const list = rows || [];
    const q = search.trim().toLowerCase();
    return list.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (!q) return true;
      return [u.email, u.roleLabel, u.student?.name, u.student?.admissionNo, u.teacher?.name, u.teacher?.employeeNo]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, search, roleFilter]);

  const setActive = async () => {
    setBusy(true);
    try {
      await api.patch(`/auth/users/${toggle.id}`, { isActive: toggle.isActive });
      toast.success(toggle.isActive ? 'Account reactivated' : 'Account deactivated');
      setToggle(null); load();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const report = {
    title: 'User Accounts Directory',
    subtitle: `${visible.length} of ${(rows || []).length} accounts`,
    meta: [
      { label: 'Centre', value: settings?.centerName || 'Tuition Center' },
      { label: 'Role filter', value: roleFilter ? (roleLabels[roleFilter] || roleFilter) : 'All roles' },
      { label: 'Search', value: search.trim() || '—' },
      { label: 'Issued to', value: reporterName(user) },
    ],
    columns: [
      { header: 'Email', value: (u) => u.email },
      { header: 'Role', value: (u) => u.roleLabel || u.role },
      { header: 'Linked Student', value: (u) => (u.student ? `${u.student.name} (${u.student.admissionNo})` : '—') },
      { header: 'Linked Teacher', value: (u) => (u.teacher ? `${u.teacher.name} (${u.teacher.employeeNo})` : '—') },
      { header: 'Status', value: (u) => (u.isActive === false ? 'Disabled' : 'Active') },
      { header: 'Extra Permissions', value: (u) => (u.permissions || []).join(', ') || '—' },
      { header: 'Last Login', value: (u) => (u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-IN') : 'Never') },
    ],
    rows: visible,
  };

  if (!allowed(user, 'users:manage')) {
    return <ErrorNote message="Only an administrator can manage user accounts." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900 dark:text-white">
          <UserCog size={24} className="text-brand-600" /> User Accounts
        </h1>
        <div className="flex flex-wrap items-center gap-2 no-print">
          <button type="button" className="btn-ghost" onClick={() => printReport(report)} disabled={!visible.length}><Printer size={16} /> Print</button>
          <button type="button" className="btn-ghost" onClick={() => downloadCsv({ ...report, suffix: 'accounts' })} disabled={!visible.length}><FileDown size={16} /> CSV</button>
          <button className="btn-primary" onClick={() => setModal({ open: true, account: null })}><Plus size={16} /> New Account</button>
        </div>
      </div>

      <p className="card px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
        Passwords are stored hashed and are never returned by the API or shown here. Deactivating an account blocks its logins without deleting any student, teacher or fee record.
      </p>

      <div className="card grid gap-4 p-4 sm:grid-cols-2 no-print">
        <Field label="Search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Email, name, admission or employee no…" />
        <SelectField label="Role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          {ROLE_ORDER.filter((r) => r !== 'SUPER_ADMIN' || user.role === 'SUPER_ADMIN').map((r) => (
            <option key={r} value={r}>{roleLabels[r] || r}</option>
          ))}
        </SelectField>
      </div>

      {error && <ErrorNote message={error} onRetry={load} />}
      {!rows ? <Spinner /> : visible.length === 0 ? <div className="card"><Empty message="No accounts match the filters" /></div> : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="th">Email</th><th className="th">Role</th><th className="th">Linked Profile</th>
                <th className="th">Extra Permissions</th><th className="th">Last Login</th><th className="th">Status</th><th className="th no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visible.map((u) => (
                <tr key={u.id} className="text-slate-700 dark:text-slate-300">
                  <td className="td font-semibold text-slate-900 dark:text-white">{u.email}</td>
                  <td className="td">{u.roleLabel || u.role}</td>
                  <td className="td">
                    {u.student ? `${u.student.name} · ${u.student.admissionNo}`
                      : u.teacher ? `${u.teacher.name} · ${u.teacher.employeeNo}` : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1">
                      {(u.permissions || []).length === 0 && <span className="text-xs text-slate-400">Role default</span>}
                      {(u.permissions || []).map((p) => <span key={p} className="badge bg-slate-100 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{p}</span>)}
                    </div>
                  </td>
                  <td className="td text-xs">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-IN') : 'Never'}</td>
                  <td className="td"><Badge value={u.isActive === false ? 'DISABLED' : 'ACTIVE'} /></td>
                  <td className="td no-print">
                    <div className="flex gap-1">
                      <button className="rounded-lg p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30" onClick={() => setModal({ open: true, account: u })} aria-label="Edit role"><Pencil size={16} /></button>
                      <button className="rounded-lg p-2 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30" onClick={() => setResetting(u)} aria-label="Reset password"><KeyRound size={16} /></button>
                      {u.id !== user.id && (
                        <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          onClick={() => setToggle({ id: u.id, email: u.email, isActive: u.isActive === false })}
                          aria-label={u.isActive === false ? 'Enable' : 'Disable'}>
                          {u.isActive === false ? 'Enable' : 'Disable'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AccountModal open={modal.open} account={modal.account} onClose={() => setModal({ open: false, account: null })}
        onSaved={load} catalogue={catalogue} roleLabels={roleLabels} students={students} teachers={teachers}
        isSuperAdmin={user.role === 'SUPER_ADMIN'} />
      <ResetPasswordModal open={!!resetting} account={resetting || {}} onClose={() => setResetting(null)} />
      <Confirm open={!!toggle} onClose={() => setToggle(null)} onConfirm={setActive} busy={busy}
        message={`${toggle?.isActive ? 'Enable' : 'Disable'} login for ${toggle?.email}?`} />
    </div>
  );
}
