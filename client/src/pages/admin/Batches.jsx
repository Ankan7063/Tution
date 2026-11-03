import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, ArrowLeft, Layers, Clock, Users as UsersIcon, X, Printer, FileDown } from 'lucide-react';
import api from '../../api/client.js';
import { useApp } from '../../context/AppContext.jsx';
import { can as allowed } from '../../lib/permissions.js';
import { downloadCsv, printReport, reporterName } from '../../lib/reports.js';
import { Modal, Confirm, Spinner, Empty, Field, SelectField, useToast, Avatar } from '../../components/ui.jsx';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const emptyBatch = { name: '', courseId: '', teacherId: '', capacity: 30, startTime: '', endTime: '', days: [], isActive: true };

const dayNames = (days) => (days || []).map((d) => DAYS[Number(d)]).join(', ') || '—';

// Print / Download sit on each data block and export only that block's rows.
function ExportButtons({ report, suffix, disabled }) {
  return (
    <div className="flex gap-2 no-print">
      <button type="button" className="btn-ghost" onClick={() => printReport(report)} disabled={disabled}><Printer size={16} /> Print</button>
      <button type="button" className="btn-ghost" onClick={() => downloadCsv({ ...report, suffix })} disabled={disabled}><FileDown size={16} /> CSV</button>
    </div>
  );
}

function BatchModal({ open, onClose, onSaved, batch, courses, teachers }) {
  const toast = useToast();
  const [form, setForm] = useState(emptyBatch);
  const [busy, setBusy] = useState(false);
  const isEdit = !!batch?.id;

  useEffect(() => {
    setForm(batch ? { ...emptyBatch, ...batch, days: batch.days || [] } : emptyBatch);
  }, [batch, open]);

  const toggleDay = (d) => {
    setForm((f) => ({ ...f, days: f.days.includes(String(d)) ? f.days.filter((x) => x !== String(d)) : [...f.days, String(d)].sort() }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, capacity: Number(form.capacity) || 30, courseId: form.courseId || undefined, teacherId: form.teacherId || undefined };
      if (isEdit) await api.put(`/batches/${batch.id}`, payload);
      else await api.post('/batches', payload);
      toast.success(isEdit ? 'Batch updated' : 'Batch created');
      onSaved(); onClose();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Batch' : 'Create Batch'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Batch Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Morning Batch A" />
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Course" value={form.courseId || ''} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
            <option value="">None</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
          <SelectField label="Teacher" value={form.teacherId || ''} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
            <option value="">None</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </SelectField>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Capacity" type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          <Field label="Start Time" type="time" value={form.startTime || ''} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          <Field label="End Time" type="time" value={form.endTime || ''} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
        </div>
        <div>
          <label className="label">Class Days</label>
          <div className="flex gap-2">
            {DAYS.map((d, i) => (
              <button type="button" key={d}
                className={`h-9 w-9 rounded-lg text-xs font-bold transition-colors ${form.days.includes(String(i)) ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'}`}
                onClick={() => toggleDay(i)}>{d}</button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} {isEdit ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function Batches() {
  const { user, settings } = useApp();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [modal, setModal] = useState({ open: false, batch: null });
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);

  const canWrite = allowed(user, 'batches:write');

  const load = useCallback(async () => {
    const { data } = await api.get('/batches');
    setRows(data);
  }, []);
  useEffect(() => {
    load().catch((e) => toast.error(e.message));
    api.get('/courses').then(({ data }) => setCourses(data)).catch(() => {});
    api.get('/teachers').then(({ data }) => setTeachers(data)).catch(() => {});
  }, [load]);

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/batches/${del.id}`);
      toast.success('Batch deleted'); setDel(null); load();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const listReport = {
    title: 'Batch Directory',
    subtitle: `${(rows || []).length} batches`,
    meta: [
      { label: 'Centre', value: settings?.centerName || 'Tuition Center' },
      { label: 'Issued to', value: reporterName(user) },
    ],
    columns: [
      { header: 'Batch', value: (b) => b.name },
      { header: 'Course', value: (b) => b.course?.name || 'No course' },
      { header: 'Teacher', value: (b) => b.teacher?.name || 'Unassigned' },
      { header: 'Timing', value: (b) => `${b.startTime || '—'} – ${b.endTime || '—'}` },
      { header: 'Days', value: (b) => dayNames(b.days) },
      { header: 'Students', value: (b) => `${b._count?.students || 0} / ${b.capacity}` },
      { header: 'Status', value: (b) => (b.isActive === false ? 'Inactive' : 'Active') },
    ],
    rows: rows || [],
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Batches &amp; Schedule</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons report={listReport} suffix="batches" disabled={!rows?.length} />
          {canWrite && (
            <button className="btn-primary" onClick={() => setModal({ open: true, batch: null })}><Plus size={16} /> Create Batch</button>
          )}
        </div>
      </div>
      {!rows ? <Spinner /> : rows.length === 0 ? <div className="card"><Empty message="No batches yet" /></div> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((b) => (
            <div key={b.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400"><Layers size={20} /></span>
                  <div>
                    <Link to={`/admin/batches/${b.id}`} className="font-bold text-slate-900 hover:text-brand-600 dark:text-white">{b.name}</Link>
                    <p className="text-xs text-slate-400">{b.course?.name || 'No course'}</p>
                  </div>
                </div>
                {canWrite && (
                  <div className="flex gap-1 no-print">
                    <button className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/30" onClick={() => setModal({ open: true, batch: b })} aria-label="Edit"><Pencil size={15} /></button>
                    <button className="rounded-lg p-2 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30" onClick={() => setDel(b)} aria-label="Delete"><Trash2 size={15} /></button>
                  </div>
                )}
              </div>
              <div className="mt-3 space-y-1.5 text-sm text-slate-500 dark:text-slate-400">
                <p className="flex items-center gap-2"><Clock size={14} /> {b.startTime || '—'} – {b.endTime || '—'} · {(b.days || []).map((d) => DAYS[Number(d)]).join(', ') || 'No days set'}</p>
                <p className="flex items-center gap-2"><UsersIcon size={14} /> {b._count?.students || 0} / {b.capacity} students</p>
                <p>Teacher: <span className="font-semibold text-slate-700 dark:text-slate-300">{b.teacher?.name || 'Unassigned'}</span></p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-indigo-500" style={{ width: `${Math.min(((b._count?.students || 0) / b.capacity) * 100, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <BatchModal open={modal.open} batch={modal.batch} courses={courses} teachers={teachers} onClose={() => setModal({ open: false, batch: null })} onSaved={load} />
      <Confirm open={!!del} onClose={() => setDel(null)} onConfirm={remove} busy={busy} message={`Delete batch ${del?.name}? Students will be unassigned.`} />
    </div>
  );
}

export function BatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, settings } = useApp();
  const toast = useToast();
  const [batch, setBatch] = useState(null);
  const [students, setStudents] = useState([]);
  const [modal, setModal] = useState({ open: false, batch: null });
  const [assignOpen, setAssignOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ dayOfWeek: 1, startTime: '', endTime: '', room: '', subjectId: '', teacherId: '' });
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [courses, setCourses] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get(`/batches/${id}`).then(({ data }) => setBatch(data)).catch((e) => toast.error(e.message));
  }, [id]);
  useEffect(() => {
    load();
    api.get('/students?limit=100').then(({ data }) => setStudents(data.rows)).catch(() => {});
    api.get('/teachers').then(({ data }) => setTeachers(data)).catch(() => {});
    api.get('/courses').then(({ data }) => setCourses(data)).catch(() => {});
  }, [load]);

  useEffect(() => {
    if (batch?.courseId) {
      api.get('/courses').then(({ data }) => {
        const course = data.find((c) => c.id === batch.courseId);
        setSubjects(course?.subjects || []);
      }).catch(() => {});
    }
  }, [batch?.courseId]);

  if (!batch) return <Spinner />;
  const canWrite = allowed(user, 'batches:write');
  const assignedIds = new Set((batch.studentLinks || []).map((l) => l.studentId));
  const roster = (batch.studentLinks || []).map((l) => l.student).filter(Boolean);
  const schedule = [...(batch.schedules || [])].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  const sheetMeta = [
    { label: 'Centre', value: settings?.centerName || 'Tuition Center' },
    { label: 'Batch', value: batch.name },
    { label: 'Course', value: batch.course?.name || 'No course' },
    { label: 'Teacher', value: batch.teacher?.name || 'Unassigned' },
    { label: 'Timing', value: `${batch.startTime || '—'} – ${batch.endTime || '—'} · ${dayNames(batch.days)}` },
    { label: 'Issued to', value: reporterName(user) },
  ];

  const rosterReport = {
    title: `${batch.name} — Student Roster`,
    subtitle: `${roster.length} of ${batch.capacity} seats filled`,
    meta: sheetMeta,
    columns: [
      { header: 'Student Name', value: (s) => s.name },
      { header: 'Roll / Admission No.', value: (s) => s.admissionNo },
      { header: 'Class', value: (s) => s.classGrade },
      { header: 'Phone', value: (s) => s.phone },
      { header: 'Status', value: (s) => String(s.status || '—').replaceAll('_', ' ') },
    ],
    rows: roster,
  };

  const scheduleReport = {
    title: `${batch.name} — Class Timetable`,
    subtitle: `${schedule.length} class${schedule.length === 1 ? '' : 'es'} per week`,
    meta: sheetMeta,
    columns: [
      { header: 'Day', value: (s) => DAYS[s.dayOfWeek] },
      { header: 'Start', value: (s) => s.startTime },
      { header: 'End', value: (s) => s.endTime },
      { header: 'Subject', value: (s) => s.subject?.name || '—' },
      { header: 'Teacher', value: (s) => s.teacher?.name || batch.teacher?.name || 'Batch teacher' },
      { header: 'Room', value: (s) => s.room || '—' },
    ],
    rows: schedule,
  };

  const assign = async () => {
    setBusy(true);
    try {
      await api.post(`/batches/${id}/students`, { studentIds: selected });
      toast.success('Students assigned');
      setAssignOpen(false); setSelected([]); load();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const unassign = async (studentId) => {
    try {
      await api.delete(`/batches/${id}/students/${studentId}`);
      toast.success('Student removed'); load();
    } catch (err) { toast.error(err.message); }
  };

  const addSchedule = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/batches/schedules', {
        batchId: id,
        dayOfWeek: Number(scheduleForm.dayOfWeek),
        startTime: scheduleForm.startTime,
        endTime: scheduleForm.endTime,
        room: scheduleForm.room || undefined,
        subjectId: scheduleForm.subjectId || undefined,
        teacherId: scheduleForm.teacherId || undefined,
      });
      toast.success('Class scheduled');
      setScheduleOpen(false); load();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const removeSchedule = async (sid) => {
    try {
      await api.delete(`/batches/schedules/${sid}`);
      toast.success('Schedule removed'); load();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="space-y-6">
      <button className="btn-ghost" onClick={() => navigate('/admin/batches')}><ArrowLeft size={16} /> All batches</button>
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{batch.name}</h1>
            <p className="mt-1 text-sm text-slate-400">
              {batch.course?.name || 'No course'} · {batch.teacher?.name || 'Unassigned'} · {batch.startTime}–{batch.endTime} · {(batch.days || []).map((d) => DAYS[Number(d)]).join(', ')}
            </p>
          </div>
          {canWrite && (
            <button className="btn-secondary" onClick={() => setModal({ open: true, batch })}><Pencil size={15} /> Edit</button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white">Students ({batch.studentLinks?.length || 0}/{batch.capacity})</h3>
          <div className="flex flex-wrap items-center gap-2">
            <ExportButtons report={rosterReport} suffix={`${batch.name}-roster`} disabled={!roster.length} />
            {canWrite && (
              <button className="btn-primary !py-1.5 text-xs" onClick={() => setAssignOpen(true)}><Plus size={14} /> Assign Students</button>
            )}
          </div>
        </div>
        {(batch.studentLinks || []).length === 0 ? <Empty message="No students in this batch" /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 dark:border-slate-800"><tr><th className="th">Student</th><th className="th">Admission No</th><th className="th">Class</th>{canWrite && <th className="th text-right no-print">Actions</th>}</tr></thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {batch.studentLinks.map((l) => (
                  <tr key={l.id}>
                    <td className="td">
                      <Link to={`/admin/students/${l.student.id}`} className="flex items-center gap-3">
                        <Avatar name={l.student.name} size="sm" />
                        <span className="font-semibold text-slate-800 hover:text-brand-600 dark:text-slate-200">{l.student.name}</span>
                      </Link>
                    </td>
                    <td className="td text-slate-400">{l.student.admissionNo}</td>
                    <td className="td">{l.student.classGrade || '—'}</td>
                    {canWrite && (
                      <td className="td text-right no-print">
                        <button className="rounded-lg p-2 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30" onClick={() => unassign(l.studentId)} aria-label="Remove"><X size={16} /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white">Class Schedule</h3>
          <div className="flex flex-wrap items-center gap-2">
            <ExportButtons report={scheduleReport} suffix={`${batch.name}-timetable`} disabled={!schedule.length} />
            {canWrite && (
              <button className="btn-primary !py-1.5 text-xs" onClick={() => setScheduleOpen(true)}><Plus size={14} /> Add Class</button>
            )}
          </div>
        </div>
        {(batch.schedules || []).length === 0 ? <Empty message="No classes scheduled" /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 dark:border-slate-800"><tr><th className="th">Day</th><th className="th">Time</th><th className="th">Subject</th><th className="th">Teacher</th><th className="th">Room</th>{canWrite && <th className="th text-right no-print">Actions</th>}</tr></thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {schedule.map((s) => (
                  <tr key={s.id}>
                    <td className="td font-semibold">{DAYS[s.dayOfWeek]}</td>
                    <td className="td">{s.startTime} – {s.endTime}</td>
                    <td className="td">{s.subject?.name || '—'}</td>
                    <td className="td">{s.teacher?.name || '—'}</td>
                    <td className="td">{s.room || '—'}</td>
                    {canWrite && (
                      <td className="td text-right no-print">
                        <button className="rounded-lg p-2 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30" onClick={() => removeSchedule(s.id)} aria-label="Remove"><X size={16} /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Students" wide>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {students.filter((s) => !assignedIds.has(s.id)).length === 0 && <p className="py-6 text-center text-sm text-slate-400">All students are already in this batch.</p>}
          {students.filter((s) => !assignedIds.has(s.id)).map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
              <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={selected.includes(s.id)}
                onChange={(e) => setSelected(e.target.checked ? [...selected, s.id] : selected.filter((x) => x !== s.id))} />
              <Avatar name={s.name} size="sm" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{s.name}</span>
              <span className="ml-auto text-xs text-slate-400">{s.admissionNo}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setAssignOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={assign} disabled={busy || selected.length === 0}>
            {busy && <Loader2 size={16} className="animate-spin" />} Assign ({selected.length})
          </button>
        </div>
      </Modal>

      <Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Add Class to Schedule">
        <form onSubmit={addSchedule} className="space-y-4">
          <SelectField label="Day" value={scheduleForm.dayOfWeek} onChange={(e) => setScheduleForm({ ...scheduleForm, dayOfWeek: e.target.value })}>
            {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </SelectField>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start" type="time" required value={scheduleForm.startTime} onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })} />
            <Field label="End" type="time" required value={scheduleForm.endTime} onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })} />
          </div>
          <SelectField label="Subject" value={scheduleForm.subjectId} onChange={(e) => setScheduleForm({ ...scheduleForm, subjectId: e.target.value })}>
            <option value="">None</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectField>
          <SelectField label="Teacher" value={scheduleForm.teacherId} onChange={(e) => setScheduleForm({ ...scheduleForm, teacherId: e.target.value })}>
            <option value="">Default (batch teacher)</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </SelectField>
          <Field label="Room" value={scheduleForm.room} onChange={(e) => setScheduleForm({ ...scheduleForm, room: e.target.value })} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setScheduleOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={busy}>Add Class</button>
          </div>
        </form>
      </Modal>

      <BatchModal open={modal.open} batch={modal.batch} courses={courses} teachers={teachers} onClose={() => setModal({ open: false, batch: null })} onSaved={load} />
    </div>
  );
}
