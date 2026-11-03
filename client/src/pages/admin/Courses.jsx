import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Loader2, BookOpen } from 'lucide-react';
import api from '../../api/client.js';
import { useApp, money } from '../../context/AppContext.jsx';
import { Modal, Confirm, Spinner, Empty, Field, SelectField, useToast } from '../../components/ui.jsx';

const emptyCourse = { name: '', code: '', description: '', duration: '', monthlyFee: '', admissionFee: '', isActive: true };

function CourseModal({ open, onClose, onSaved, course }) {
  const toast = useToast();
  const [form, setForm] = useState(emptyCourse);
  const [busy, setBusy] = useState(false);
  const isEdit = !!course?.id;

  useEffect(() => {
    setForm(course ? { ...emptyCourse, ...course, monthlyFee: course.monthlyFee ?? '', admissionFee: course.admissionFee ?? '' } : emptyCourse);
  }, [course, open]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, monthlyFee: Number(form.monthlyFee) || 0, admissionFee: Number(form.admissionFee) || 0 };
      if (isEdit) await api.put(`/courses/${course.id}`, payload);
      else await api.post('/courses', payload);
      toast.success(isEdit ? 'Course updated' : 'Course created');
      onSaved(); onClose();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Course' : 'Create Course'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Course Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Course Code" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. MTH-10" disabled={isEdit} />
          <Field label="Duration" value={form.duration || ''} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 12 months" />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input" rows={3} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Monthly Fee (₹)" type="number" min="0" value={form.monthlyFee} onChange={(e) => setForm({ ...form, monthlyFee: e.target.value })} />
          <Field label="Admission Fee (₹)" type="number" min="0" value={form.admissionFee} onChange={(e) => setForm({ ...form, admissionFee: e.target.value })} />
        </div>
        <SelectField label="Status" value={String(form.isActive)} onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}>
          <option value="true">Active</option><option value="false">Inactive</option>
        </SelectField>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} {isEdit ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </Modal>
  );
}

function SubjectModal({ open, onClose, onSaved, courses, teachers, subject }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', courseId: '', teacherId: '' });
  const [busy, setBusy] = useState(false);
  const isEdit = !!subject?.id;

  useEffect(() => {
    setForm(subject ? { name: subject.name, courseId: subject.courseId || '', teacherId: subject.teacherId || '' } : { name: '', courseId: '', teacherId: '' });
  }, [subject, open]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { name: form.name, courseId: form.courseId || undefined, teacherId: form.teacherId || undefined };
      if (isEdit) await api.put(`/subjects/${subject.id}`, payload);
      else await api.post('/subjects', payload);
      toast.success(isEdit ? 'Subject updated' : 'Subject added');
      onSaved(); onClose();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Subject' : 'Add Subject'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Subject Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <SelectField label="Course" value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
          <option value="">None</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
        <SelectField label="Teacher" value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
          <option value="">None</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </SelectField>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{isEdit ? 'Save' : 'Add'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Courses() {
  const { settings } = useApp();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [courseModal, setCourseModal] = useState({ open: false, course: null });
  const [subjectModal, setSubjectModal] = useState({ open: false, subject: null });
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get('/courses');
    setRows(data);
  }, []);
  useEffect(() => {
    load().catch((e) => toast.error(e.message));
    api.get('/teachers').then(({ data }) => setTeachers(data)).catch(() => {});
  }, [load]);

  const remove = async () => {
    setBusy(true);
    try {
      if (del.kind === 'course') await api.delete(`/courses/${del.id}`);
      else await api.delete(`/subjects/${del.id}`);
      toast.success('Deleted'); setDel(null); load();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Courses & Subjects</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setSubjectModal({ open: true, subject: null })}><Plus size={16} /> Subject</button>
          <button className="btn-primary" onClick={() => setCourseModal({ open: true, course: null })}><Plus size={16} /> Course</button>
        </div>
      </div>

      {!rows ? <Spinner /> : rows.length === 0 ? <div className="card"><Empty message="No courses yet" /></div> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((c) => (
            <div key={c.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-400"><BookOpen size={20} /></span>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.code} · {c.duration || 'Ongoing'}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/30" onClick={() => setCourseModal({ open: true, course: c })} aria-label="Edit"><Pencil size={15} /></button>
                  <button className="rounded-lg p-2 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30" onClick={() => setDel({ kind: 'course', id: c.id, name: c.name })} aria-label="Delete"><Trash2 size={15} /></button>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{c.description}</p>
              <div className="mt-3 flex items-center gap-4 text-sm">
                <span className="font-bold text-brand-600 dark:text-brand-400">{money(c.monthlyFee, settings)}<span className="text-xs font-normal text-slate-400">/month</span></span>
                <span className="text-slate-400">{c._count?.students || 0} students</span>
                <span className="text-slate-400">{c.batches?.length || 0} batches</span>
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Subjects</p>
                <div className="flex flex-wrap gap-1.5">
                  {(c.subjects || []).length === 0 && <span className="text-xs text-slate-400">No subjects added</span>}
                  {(c.subjects || []).map((s) => (
                    <span key={s.id} className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {s.name}{s.teacher ? ` · ${s.teacher.name}` : ''}
                      <button className="ml-1 text-slate-400 hover:text-rose-500" onClick={() => setDel({ kind: 'subject', id: s.id, name: s.name })} aria-label="Delete subject">×</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CourseModal open={courseModal.open} course={courseModal.course} onClose={() => setCourseModal({ open: false, course: null })} onSaved={load} />
      <SubjectModal open={subjectModal.open} subject={subjectModal.subject} courses={rows || []} teachers={teachers} onClose={() => setSubjectModal({ open: false, subject: null })} onSaved={load} />
      <Confirm open={!!del} onClose={() => setDel(null)} onConfirm={remove} busy={busy} message={`Delete ${del?.name}?`} />
    </div>
  );
}
