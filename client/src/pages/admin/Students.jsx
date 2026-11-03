import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, ArrowLeft, Loader2, Phone, MessageCircle, Mail, CalendarCheck, FileText } from 'lucide-react';
import api, { getArray, getObject, expectArray } from '../../api/client.js';
import { useApp, money, waLink } from '../../context/AppContext.jsx';
import { Modal, Confirm, Spinner, Empty, ErrorNote, Badge, Field, SelectField, useToast, Avatar } from '../../components/ui.jsx';

const emptyForm = {
  name: '', gender: '', dob: '', phone: '', email: '', parentName: '', parentPhone: '',
  address: '', classGrade: '', courseId: '', batchId: '', monthlyFee: '', status: 'ACTIVE',
};

export function StudentFormModal({ open, onClose, onSaved, student, courses, batches }) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const isEdit = !!student?.id;

  useEffect(() => {
    if (student) {
      setForm({
        ...emptyForm, ...student,
        dob: student.dob ? student.dob.slice(0, 10) : '',
        monthlyFee: student.monthlyFee ?? '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [student, open]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, monthlyFee: Number(form.monthlyFee) || 0 };
      if (!payload.email) delete payload.email;
      if (isEdit) await api.put(`/students/${student.id}`, payload);
      else await api.post('/students', payload);
      toast.success(isEdit ? 'Student updated' : 'Student admitted successfully');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Student' : 'New Admission'} wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <SelectField label="Gender" value={form.gender || ''} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
          <option value="">Select…</option><option>Male</option><option>Female</option><option>Other</option>
        </SelectField>
        <Field label="Date of Birth" type="date" value={form.dob || ''} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
        <Field label="Phone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Student phone" />
        <Field label="Email" type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Optional" />
        <Field label="Class / Grade" value={form.classGrade || ''} onChange={(e) => setForm({ ...form, classGrade: e.target.value })} placeholder="e.g. Class 10" />
        <Field label="Parent / Guardian Name" value={form.parentName || ''} onChange={(e) => setForm({ ...form, parentName: e.target.value })} />
        <Field label="Parent Contact" value={form.parentPhone || ''} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} />
        <SelectField label="Course" value={form.courseId || ''} onChange={(e) => setForm({ ...form, courseId: e.target.value || undefined })}>
          <option value="">None</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
        <SelectField label="Batch" value={form.batchId || ''} onChange={(e) => setForm({ ...form, batchId: e.target.value || undefined })}>
          <option value="">None</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </SelectField>
        <Field label="Monthly Fee (₹)" type="number" min="0" value={form.monthlyFee} onChange={(e) => setForm({ ...form, monthlyFee: e.target.value })} />
        <SelectField label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option>ACTIVE</option><option>INACTIVE</option><option>PASSED_OUT</option>
        </SelectField>
        <div className="sm:col-span-2">
          <Field label="Address" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />} {isEdit ? 'Save Changes' : 'Admit Student'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Students() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [filters, setFilters] = useState({ search: '', courseId: '', batchId: '', status: '', page: 1 });
  const [modal, setModal] = useState({ open: false, student: null });
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
      const body = await getObject(`/students?${params}`);
      expectArray(body.rows, '/students rows');
      setData(body);
    } catch (err) { setError(err.message); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    getArray('/courses').then(setCourses).catch((e) => toast.error(e.message));
    getArray('/batches').then(setBatches).catch((e) => toast.error(e.message));
  }, []);

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/students/${del.id}`);
      toast.success('Student deleted');
      setDel(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">All Students</h1>
        <button className="btn-primary" onClick={() => setModal({ open: true, student: null })}><Plus size={18} /> New Admission</button>
      </div>
      <div className="card flex flex-wrap gap-3 p-4">
        <div className="relative min-w-52 flex-1">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search name, admission no, phone…"
            value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })} />
        </div>
        <select className="input w-44" value={filters.courseId} onChange={(e) => setFilters({ ...filters, courseId: e.target.value, page: 1 })}>
          <option value="">All Courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input w-44" value={filters.batchId} onChange={(e) => setFilters({ ...filters, batchId: e.target.value, page: 1 })}>
          <option value="">All Batches</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="input w-36" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}>
          <option value="">All Status</option><option>ACTIVE</option><option>INACTIVE</option><option>PASSED_OUT</option>
        </select>
      </div>

      {!data ? <Spinner /> : data.rows.length === 0 ? <div className="card"><Empty message="No students found" /></div> : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="th">Student</th><th className="th">Admission No</th><th className="th">Course</th>
                <th className="th">Batch</th><th className="th">Phone</th><th className="th">Monthly Fee</th>
                <th className="th">Status</th><th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {data.rows.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="td">
                    <Link to={`/admin/students/${s.id}`} className="flex items-center gap-3">
                      <Avatar name={s.name} size="sm" />
                      <span className="font-semibold text-slate-800 hover:text-brand-600 dark:text-slate-200">{s.name}</span>
                    </Link>
                  </td>
                  <td className="td text-slate-500 dark:text-slate-400">{s.admissionNo}</td>
                  <td className="td">{s.course?.name || '—'}</td>
                  <td className="td">{s.batch?.name || '—'}</td>
                  <td className="td">{s.phone || s.parentPhone || '—'}</td>
                  <td className="td font-semibold">{money(s.monthlyFee)}</td>
                  <td className="td"><Badge value={s.status} /></td>
                  <td className="td">
                    <div className="flex justify-end gap-1">
                      <button className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/30" title="Edit"
                        onClick={() => setModal({ open: true, student: s })}><Pencil size={16} /></button>
                      <button className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30" title="Delete"
                        onClick={() => setDel(s)}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: data.pages }, (_, i) => (
            <button key={i} onClick={() => setFilters({ ...filters, page: i + 1 })}
              className={`h-9 w-9 rounded-lg text-sm font-bold ${filters.page === i + 1 ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-brand-50 dark:bg-slate-900 dark:text-slate-300'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}

      <StudentFormModal open={modal.open} student={modal.student} courses={courses} batches={batches}
        onClose={() => setModal({ open: false, student: null })} onSaved={load} />
      <Confirm open={!!del} onClose={() => setDel(null)} onConfirm={remove} busy={busy}
        message={`Delete ${del?.name}? Their attendance, fee records and payment history will also be removed.`} />
    </div>
  );
}

export function NewAdmission() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  useEffect(() => {
    api.get('/courses').then(({ data }) => setCourses(data)).catch(() => {});
    api.get('/batches').then(({ data }) => setBatches(data)).catch(() => {});
  }, []);
  return (
    <div className="mx-auto max-w-3xl">
      <button className="btn-ghost mb-4" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</button>
      <div className="card p-6">
        <h1 className="mb-4 text-2xl font-extrabold text-slate-900 dark:text-white">New Admission</h1>
        <NewAdmissionForm courses={courses} batches={batches} onDone={() => navigate('/admin/students')} />
      </div>
    </div>
  );
}

function NewAdmissionForm({ courses, batches, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, monthlyFee: Number(form.monthlyFee) || 0 };
      if (!payload.email) delete payload.email;
      await api.post('/students', payload);
      toast.success('Student admitted successfully');
      onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <SelectField label="Gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
        <option value="">Select…</option><option>Male</option><option>Female</option><option>Other</option>
      </SelectField>
      <Field label="Date of Birth" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
      <Field label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <Field label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Optional" />
      <Field label="Class / Grade" value={form.classGrade} onChange={(e) => setForm({ ...form, classGrade: e.target.value })} placeholder="e.g. Class 10" />
      <Field label="Parent / Guardian Name" value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} />
      <Field label="Parent Contact" value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} />
      <SelectField label="Course" value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value || undefined })}>
        <option value="">None</option>
        {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </SelectField>
      <SelectField label="Batch" value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value || undefined })}>
        <option value="">None</option>
        {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </SelectField>
      <Field label="Monthly Fee (₹)" type="number" min="0" value={form.monthlyFee} onChange={(e) => setForm({ ...form, monthlyFee: e.target.value })} />
      <Field label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn-ghost" onClick={onDone}>Cancel</button>
        <button className="btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Admit Student</button>
      </div>
    </form>
  );
}

export function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useApp();
  const [student, setStudent] = useState(null);
  const [feeSummary, setFeeSummary] = useState(null);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [modal, setModal] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    api.get(`/students/${id}`).then(({ data }) => setStudent(data)).catch((e) => toast.error(e.message));
    api.get(`/students/${id}/fee-summary`).then(({ data }) => setFeeSummary(data)).catch(() => {});
  }, [id]);
  useEffect(() => {
    load();
    api.get('/courses').then(({ data }) => setCourses(data)).catch(() => {});
    api.get('/batches').then(({ data }) => setBatches(data)).catch(() => {});
  }, [load]);

  if (!student) return <Spinner />;
  const phone = student.phone || student.parentPhone;

  const attendancePct = (() => {
    const rows = student.attendance || [];
    if (!rows.length) return null;
    const ok = rows.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
    return Math.round((ok / rows.length) * 100);
  })();

  return (
    <div className="space-y-6">
      <button className="btn-ghost" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back to students</button>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile card */}
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <Avatar name={student.name} size="lg" />
            <Badge value={student.status} />
          </div>
          <h1 className="mt-4 text-xl font-extrabold text-slate-900 dark:text-white">{student.name}</h1>
          <p className="text-sm text-slate-400">{student.admissionNo} · {student.classGrade || '—'}</p>
          <div className="mt-3 flex gap-2">
            {phone && <a className="btn flex-1 bg-emerald-500 text-white hover:bg-emerald-600" target="_blank" rel="noreferrer"
              href={waLink(phone, `Hi ${student.name}, this is ${settings?.centerName || 'Tuition Center'}.`)}><MessageCircle size={16} /> WhatsApp</a>}
            {phone && <a className="btn flex-1 bg-sky-600 text-white hover:bg-sky-700" href={`tel:+${String(phone).replace(/\D/g, '')}`}><Phone size={16} /> Call</a>}
          </div>
          <dl className="mt-5 space-y-2.5 text-sm">
            {[
              ['Course', student.course?.name],
              ['Batch', student.batch?.name],
              ['Gender', student.gender],
              ['Date of Birth', student.dob ? new Date(student.dob).toLocaleDateString('en-IN') : null],
              ['Phone', student.phone],
              ['Parent', student.parentName],
              ['Parent Contact', student.parentPhone],
              ['Email', student.email || student.user?.email],
              ['Address', student.address],
              ['Admission Date', new Date(student.admissionDate).toLocaleDateString('en-IN')],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-slate-400">{k}</dt>
                <dd className="text-right font-medium text-slate-700 dark:text-slate-300">{v}</dd>
              </div>
            ))}
          </dl>
          <button className="btn-secondary mt-5 w-full" onClick={() => setModal(true)}><Pencil size={16} /> Edit Profile</button>
        </div>

        {/* Fee summary + attendance */}
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">Fee Summary</h3>
              {feeSummary && (
                <div className="flex gap-4 text-center">
                  <div><p className="text-xs text-slate-400">Total</p><p className="font-extrabold text-slate-800 dark:text-slate-200">{money(feeSummary.total, settings)}</p></div>
                  <div><p className="text-xs text-slate-400">Paid</p><p className="font-extrabold text-emerald-600">{money(feeSummary.paid, settings)}</p></div>
                  <div><p className="text-xs text-slate-400">Pending</p><p className="font-extrabold text-rose-600">{money(feeSummary.pending, settings)}</p></div>
                </div>
              )}
            </div>
            {attendancePct !== null && (
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                <CalendarCheck size={18} className="text-brand-600" />
                <p className="text-sm text-slate-600 dark:text-slate-300">Attendance (last 60 records): <span className="font-bold">{attendancePct}%</span></p>
              </div>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white">Fee Transactions</h3>
            </div>
            {student.payments.length === 0 ? <Empty message="No payments yet" /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-100 dark:border-slate-800">
                    <tr><th className="th">Receipt</th><th className="th">Fee Type</th><th className="th">Period</th><th className="th">Amount</th><th className="th">Date</th><th className="th">Mode</th><th className="th">Receipt PDF</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {student.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="td font-semibold">{p.receiptNo}</td>
                        <td className="td">{p.feeRecord?.feeType || 'General'}</td>
                        <td className="td">{p.feeRecord?.period || '—'}</td>
                        <td className="td font-bold text-emerald-600">{money(p.amount, settings)}</td>
                        <td className="td">{new Date(p.paymentDate).toLocaleDateString('en-IN')}</td>
                        <td className="td">{p.method}</td>
                        <td className="td">
                          <a className="btn-ghost !px-3 !py-1 text-xs" href={`/api/fees/payments/${p.id}/receipt.pdf`} target="_blank" rel="noreferrer">
                            <FileText size={14} /> PDF
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white">Pending Fee Records</h3>
            </div>
            {student.feeRecords.filter((r) => r.status !== 'PAID').length === 0 ? <Empty message="All fees cleared" /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-100 dark:border-slate-800">
                    <tr><th className="th">Fee Type</th><th className="th">Period</th><th className="th">Amount</th><th className="th">Due Date</th><th className="th">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {student.feeRecords.filter((r) => r.status !== 'PAID').map((r) => (
                      <tr key={r.id}>
                        <td className="td font-semibold">{r.feeType}</td>
                        <td className="td">{r.period || '—'}</td>
                        <td className="td font-bold">{money(Number(r.amount) + Number(r.lateFee) - Number(r.discount), settings)}</td>
                        <td className="td">{new Date(r.dueDate).toLocaleDateString('en-IN')}</td>
                        <td className="td"><Badge value={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white">Examination Results</h3>
            </div>
            {student.examResults.length === 0 ? <Empty message="No results yet" /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-100 dark:border-slate-800">
                    <tr><th className="th">Examination</th><th className="th">Subject</th><th className="th">Marks</th><th className="th">Grade</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {student.examResults.map((r) => (
                      <tr key={r.id}>
                        <td className="td font-semibold">{r.examination?.name}</td>
                        <td className="td">{r.subject?.name || '—'}</td>
                        <td className="td">{r.marksObtained} / {r.examination?.totalMarks}</td>
                        <td className="td"><span className="badge bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">{r.grade || '—'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white">Attendance History</h3>
            </div>
            {student.attendance.length === 0 ? <Empty message="No attendance recorded yet" /> : (
              <div className="flex flex-wrap gap-1.5 p-5">
                {student.attendance.slice(0, 60).map((a) => (
                  <span key={a.id} title={`${new Date(a.date).toLocaleDateString('en-IN')} — ${a.status}`}
                    className={`h-8 w-8 rounded-lg text-[10px] font-bold flex items-center justify-center text-white ${a.status === 'PRESENT' ? 'bg-emerald-500' : a.status === 'ABSENT' ? 'bg-rose-500' : a.status === 'LATE' ? 'bg-amber-500' : 'bg-sky-500'}`}>
                    {new Date(a.date).getDate()}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <StudentFormModal open={modal} onClose={() => setModal(false)} student={student} courses={courses} batches={batches} onSaved={load} />
    </div>
  );
}
