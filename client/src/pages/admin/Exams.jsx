import { Fragment, useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, FileText, ClipboardList, Send, Trophy, Printer, FileDown } from 'lucide-react';
import api, { getArray, getObject, expectArray } from '../../api/client.js';
import { useApp } from '../../context/AppContext.jsx';
import { can as allowed } from '../../lib/permissions.js';
import { downloadCsv, printReport, reporterName } from '../../lib/reports.js';
import { Modal, Confirm, Spinner, Empty, ErrorNote, Field, SelectField, Badge, Avatar, useToast } from '../../components/ui.jsx';

const prettyDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

// One column set feeds the on-screen table, the printed mark sheet and the CSV download.
const resultColumns = (totalMarks) => [
  { header: 'Rank', value: 'rank' },
  { header: 'Student Name', value: (r) => r.student?.name },
  { header: 'Roll / Admission No.', value: (r) => r.student?.admissionNo },
  { header: 'Subject', value: (r) => r.subject?.name || 'General' },
  { header: 'Marks', value: (r) => `${Number(r.marksObtained)} / ${totalMarks}` },
  { header: 'Percentage', value: (r) => `${r.percentage}%` },
  { header: 'Grade', value: (r) => String(r.grade || '—') },
  { header: 'Remarks', value: (r) => r.remarks || '—' },
];

const emptyExam = { name: '', courseId: '', batchId: '', examDate: new Date().toISOString().slice(0, 10), totalMarks: 100 };

function ExamModal({ open, onClose, onSaved, exam, courses, batches }) {
  const toast = useToast();
  const [form, setForm] = useState(emptyExam);
  const [busy, setBusy] = useState(false);
  const isEdit = !!exam?.id;

  useEffect(() => {
    if (open) setForm(exam ? { ...emptyExam, ...exam, courseId: exam.courseId || '', batchId: exam.batchId || '' } : emptyExam);
  }, [open, exam]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, courseId: form.courseId || undefined, batchId: form.batchId || undefined, totalMarks: Number(form.totalMarks) };
      if (isEdit) await api.put(`/examinations/${exam.id}`, payload);
      else await api.post('/examinations', payload);
      toast.success(isEdit ? 'Examination updated' : 'Examination scheduled');
      onSaved(); onClose();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Examination' : 'Schedule Examination'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Exam Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Half Yearly — Mathematics" />
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Course" value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
            <option value="">All courses</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
          <SelectField label="Batch" value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })}>
            <option value="">All batches</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </SelectField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Exam Date" type="date" required value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} />
          <Field label="Total Marks" type="number" min="1" required value={form.totalMarks} onChange={(e) => setForm({ ...form, totalMarks: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} {isEdit ? 'Save' : 'Schedule'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ResultsModal({ open, onClose, exam, subjects }) {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!exam) return;
    setRows(null);
    setError(null);
    try {
      const studentsParams = exam.batchId ? { batchId: exam.batchId, limit: 300 }
        : exam.courseId ? { courseId: exam.courseId, limit: 300 }
        : { limit: 300, status: 'ACTIVE' };
      const [studentsBody, examBody] = await Promise.all([
        getObject('/students', { params: studentsParams }),
        getObject(`/examinations/${exam.id}/results`),
      ]);
      const results = expectArray(examBody.results, 'exam results');
      const students = expectArray(studentsBody.rows, '/students rows');
      const byStudent = {};
      for (const r of results) byStudent[r.studentId] = r;
      setRows(students.map((s) => ({
        student: s,
        subjectId: byStudent[s.id]?.subjectId || '',
        marks: byStudent[s.id] ? String(byStudent[s.id].marksObtained) : '',
        remarks: byStudent[s.id]?.remarks || '',
      })));
    } catch (err) {
      setError(err.message);
    }
  }, [exam]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const save = async () => {
    setBusy(true);
    try {
      const results = rows.filter((r) => r.marks !== '').map((r) => ({
        studentId: r.student.id,
        subjectId: r.subjectId || undefined,
        marksObtained: Number(r.marks),
        remarks: r.remarks || undefined,
      }));
      if (!results.length) { toast.error('Enter marks for at least one student'); setBusy(false); return; }
      const { data } = await api.post(`/examinations/${exam.id}/results`, { results });
      toast.success(data.message);
      onClose();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Marks Entry — ${exam?.name || ''}`} wide>
      {error ? <ErrorNote message={error} onRetry={load} /> : !rows ? <Spinner label="Loading roster…" /> : rows.length === 0 ? <Empty message="No students linked to this exam's course or batch" /> : (
        <>
          <div className="mb-3 text-sm text-slate-500 dark:text-slate-400">Total marks: <span className="font-bold text-slate-800 dark:text-slate-200">{exam.totalMarks}</span></div>
          <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                <tr><th className="th">Student</th><th className="th">Subject</th><th className="th">Marks</th><th className="th">Remarks</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r, i) => (
                  <tr key={r.student.id}>
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.student.name} size="sm" />
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{r.student.name}</p>
                          <p className="text-xs text-slate-400">{r.student.admissionNo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      <select className="input max-w-[10rem]" value={r.subjectId}
                        onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, subjectId: e.target.value } : x)))}>
                        <option value="">General</option>
                        {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>
                    <td className="td">
                      <input className="input w-24" type="number" min="0" max={exam.totalMarks} step="0.5" value={r.marks}
                        onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, marks: e.target.value } : x)))} />
                    </td>
                    <td className="td">
                      <input className="input" value={r.remarks} placeholder="Optional"
                        onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, remarks: e.target.value } : x)))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Save Marks</button>
          </div>
        </>
      )}
    </Modal>
  );
}

function ResultTable({ exam }) {
  const { user, settings } = useApp();
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api.get(`/examinations/${exam.id}/results`).then(({ data: d }) => setData(d)).catch(() => setData({ results: [] }));
  }, [exam.id]);

  if (!data) return <Spinner />;
  if (!data.results.length) return <Empty message="No marks entered yet" />;

  const sorted = [...data.results]
    .sort((a, b) => Number(b.marksObtained) - Number(a.marksObtained))
    .map((r, i) => ({ ...r, rank: i + 1 }));
  const avg = Math.round((sorted.reduce((s, r) => s + r.percentage, 0) / sorted.length) * 100) / 100;

  const report = {
    title: `${exam.name} — Result Sheet`,
    subtitle: `${sorted.length} students · out of ${data.totalMarks} marks`,
    meta: [
      { label: 'Centre', value: settings?.centerName || 'Tuition Center' },
      { label: 'Course', value: exam.course?.name || 'All courses' },
      { label: 'Batch', value: exam.batch?.name || 'All batches' },
      { label: 'Exam date', value: prettyDate(exam.examDate) },
      { label: 'Total marks', value: data.totalMarks },
      { label: 'Class average', value: `${avg}%` },
      { label: 'Issued by', value: reporterName(user) },
    ],
    columns: resultColumns(data.totalMarks),
    rows: sorted,
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-slate-500">Students evaluated: <b className="text-slate-800 dark:text-slate-200">{sorted.length}</b></span>
          <span className="text-slate-500">Average: <b className="text-slate-800 dark:text-slate-200">{avg}%</b></span>
          <span className="text-slate-500">Highest: <b className="text-emerald-600">{sorted[0]?.percentage}%</b></span>
        </div>
        <div className="flex gap-2 no-print">
          <button type="button" className="btn-ghost" onClick={() => printReport(report)}><Printer size={16} /> Print results</button>
          <button type="button" className="btn-ghost" onClick={() => downloadCsv({ ...report, suffix: exam.name })}><FileDown size={16} /> CSV</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr><th className="th">Rank</th><th className="th">Student</th><th className="th">Subject</th><th className="th">Marks</th><th className="th">%</th><th className="th">Grade</th><th className="th">Remarks</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {sorted.map((r) => (
              <tr key={r.id} className="text-slate-700 dark:text-slate-300">
                <td className="td">{r.rank === 1 ? <Trophy size={16} className="text-amber-500" /> : r.rank}</td>
                <td className="td font-semibold text-slate-900 dark:text-white">{r.student?.name}<span className="block text-xs font-normal text-slate-400">{r.student?.admissionNo}</span></td>
                <td className="td">{r.subject?.name || 'General'}</td>
                <td className="td">{Number(r.marksObtained)} / {data.totalMarks}</td>
                <td className="td font-semibold">{r.percentage}%</td>
                <td className="td"><Badge value={r.grade} /></td>
                <td className="td text-slate-400">{r.remarks || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Exams() {
  const { user } = useApp();
  const toast = useToast();
  const [exams, setExams] = useState(null);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [modal, setModal] = useState({ open: false, exam: null });
  const [resultsFor, setResultsFor] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);

  const canWrite = allowed(user, 'exams:write');

  const load = useCallback(() => api.get('/examinations').then(({ data }) => setExams(data)).catch((e) => { toast.error(e.message); setExams([]); }), []);

  useEffect(() => {
    load();
    api.get('/courses').then(({ data }) => setCourses(data)).catch(() => {});
    api.get('/batches').then(({ data }) => setBatches(data)).catch(() => {});
  }, []);

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/examinations/${del.id}`);
      toast.success('Examination deleted');
      setDel(null); load();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const publish = async (exam) => {
    try {
      await api.post(`/examinations/${exam.id}/publish`);
      toast.success('Results published');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const subjectsOf = (exam) => courses.find((c) => c.id === exam?.courseId)?.subjects || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900 dark:text-white">
          <FileText size={24} className="text-brand-600" /> Exams &amp; Results
        </h1>
        {canWrite && (
          <button className="btn-primary" onClick={() => setModal({ open: true, exam: null })}><Plus size={16} /> Schedule Exam</button>
        )}
      </div>

      {!exams ? <Spinner /> : exams.length === 0 ? <div className="card"><Empty message="No examinations yet" /></div> : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr><th className="th">Examination</th><th className="th">Course</th><th className="th">Batch</th><th className="th">Date</th><th className="th">Marks</th><th className="th">Results</th><th className="th">Status</th>{canWrite && <th className="th no-print">Actions</th>}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {exams.map((e) => (
                <Fragment key={e.id}>
                  <tr className="text-slate-700 dark:text-slate-300">
                    <td className="td font-semibold text-slate-900 dark:text-white">{e.name}</td>
                    <td className="td">{e.course?.name || 'All'}</td>
                    <td className="td">{e.batch?.name || 'All'}</td>
                    <td className="td">{new Date(e.examDate).toLocaleDateString('en-IN')}</td>
                    <td className="td">{e.totalMarks}</td>
                    <td className="td">{e._count?.results || 0} entered</td>
                    <td className="td"><Badge value={e.status} /></td>
                    {canWrite && (
                      <td className="td no-print">
                        <div className="flex gap-1">
                          <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setExpanded(expanded === e.id ? null : e.id)} aria-label="Toggle results"><ClipboardList size={16} /></button>
                          <button className="rounded-lg p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30" onClick={() => setResultsFor(e)} aria-label="Enter marks"><Pencil size={16} /></button>
                          {e.status !== 'RESULTS_PUBLISHED' && (
                            <button className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30" onClick={() => publish(e)} aria-label="Publish results"><Send size={16} /></button>
                          )}
                          <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setModal({ open: true, exam: e })} aria-label="Edit"><FileText size={16} /></button>
                          <button className="rounded-lg p-2 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30" onClick={() => setDel({ id: e.id, name: e.name })} aria-label="Delete"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                  {expanded === e.id && (
                    <tr>
                      <td colSpan={8} className="bg-slate-50/60 px-5 py-4 dark:bg-slate-800/30">
                        <ResultTable exam={e} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ExamModal open={modal.open} exam={modal.exam} courses={courses} batches={batches} onClose={() => setModal({ open: false, exam: null })} onSaved={load} />
      <ResultsModal open={!!resultsFor} exam={resultsFor} subjects={subjectsOf(resultsFor)} onClose={() => setResultsFor(null)} />
      <Confirm open={!!del} onClose={() => setDel(null)} onConfirm={remove} busy={busy} message={`Delete ${del?.name} and all its results?`} />
    </div>
  );
}
