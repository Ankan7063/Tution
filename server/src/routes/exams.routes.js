import { Router } from 'express';
import { z } from 'zod';
import { oid, mongoose, Course, Batch, Student, Subject, Examination, ExamResult, CenterSettings } from '../models/index.js';
import { authenticate, isStaff } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { gradeFor } from '../utils/helpers.js';
import { notifyAdmins } from '../utils/notify.js';

const router = Router();

const jsonOf = (doc) => (doc ? doc.toJSON() : null);

const examSchema = z.object({
  name: z.string().min(2),
  courseId: z.string().optional(),
  batchId: z.string().optional(),
  examDate: z.coerce.date(),
  totalMarks: z.coerce.number().int().positive().default(100),
});

const resultsSchema = z.object({
  results: z.array(z.object({
    studentId: z.string(),
    subjectId: z.string().optional(),
    marksObtained: z.coerce.number().min(0),
    remarks: z.string().optional(),
  })).min(1),
});

router.get('/examinations', authenticate, async (req, res, next) => {
  try {
    const exams = await Examination.find().sort({ examDate: -1 });
    const [countRows, courses, batches] = await Promise.all([
      ExamResult.aggregate([
        { $match: { examinationId: { $in: exams.map((e) => e._id) } } },
        { $group: { _id: '$examinationId', n: { $sum: 1 } } },
      ]),
      Course.find({ _id: { $in: exams.map((e) => e.courseId).filter(Boolean) } }).select('name'),
      Batch.find({ _id: { $in: exams.map((e) => e.batchId).filter(Boolean) } }).select('name'),
    ]);
    const countByExam = new Map(countRows.map((c) => [String(c._id), c.n]));
    const courseById = new Map(courses.map((c) => [String(c._id), { name: c.name }]));
    const batchById = new Map(batches.map((b) => [String(b._id), { name: b.name }]));
    res.json(exams.map((e) => Object.assign(e.toJSON(), {
      course: e.courseId ? courseById.get(String(e.courseId)) ?? null : null,
      batch: e.batchId ? batchById.get(String(e.batchId)) ?? null : null,
      _count: { results: countByExam.get(String(e._id)) ?? 0 },
    })));
  } catch (err) {
    next(err);
  }
});

router.post('/examinations', authenticate, isStaff, validate(examSchema), async (req, res, next) => {
  try {
    const exam = await Examination.create({
      ...req.body,
      courseId: oid(req.body.courseId),
      batchId: oid(req.body.batchId),
    });
    const settings = await CenterSettings.findOne({ key: 1 });
    if (settings?.notifyExam) {
      await notifyAdmins({
        title: 'New Examination Scheduled',
        message: `${exam.name} on ${new Date(exam.examDate).toLocaleDateString('en-IN')}.`,
        type: 'EXAM',
        link: '/admin/exams',
      });
    }
    res.status(201).json(exam);
  } catch (err) {
    next(err);
  }
});

router.put('/examinations/:id', authenticate, isStaff, validate(examSchema.partial()), async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const data = { ...req.body };
    if (data.courseId !== undefined) data.courseId = oid(data.courseId);
    if (data.batchId !== undefined) data.batchId = oid(data.batchId);
    const exam = await Examination.findByIdAndUpdate(_id, data, { new: true, runValidators: true });
    if (!exam) return res.status(404).json({ message: 'Examination not found' });
    res.json(exam);
  } catch (err) {
    next(err);
  }
});

router.delete('/examinations/:id', authenticate, isStaff, async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const exam = await Examination.findById(_id);
    if (!exam) return res.status(404).json({ message: 'Examination not found' });
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await ExamResult.deleteMany({ examinationId: _id }, { session });
      await Examination.findByIdAndDelete(_id, { session });
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
    res.json({ message: 'Examination deleted' });
  } catch (err) {
    next(err);
  }
});

router.get('/examinations/:id/results', authenticate, async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const exam = await Examination.findById(_id);
    if (!exam) return res.status(404).json({ message: 'Examination not found' });
    const [course, results] = await Promise.all([
      exam.courseId ? Course.findById(exam.courseId) : Promise.resolve(null),
      ExamResult.find({ examinationId: _id }),
    ]);
    const [students, subjects] = await Promise.all([
      Student.find({ _id: { $in: results.map((r) => r.studentId) } }).select('name admissionNo'),
      Subject.find({ _id: { $in: results.map((r) => r.subjectId).filter(Boolean) } }).select('name'),
    ]);
    const studentById = new Map(students.map((s) => [String(s._id), { name: s.name, admissionNo: s.admissionNo }]));
    const subjectById = new Map(subjects.map((s) => [String(s._id), { name: s.name }]));
    const withPct = results.map((r) => Object.assign(r.toJSON(), {
      student: studentById.get(String(r.studentId)) ?? null,
      subject: r.subjectId ? subjectById.get(String(r.subjectId)) ?? null : null,
      percentage: exam.totalMarks ? Math.round((Number(r.marksObtained) / exam.totalMarks) * 10000) / 100 : 0,
    }));
    res.json(Object.assign(exam.toJSON(), { course: jsonOf(course), results: withPct }));
  } catch (err) {
    next(err);
  }
});

router.post('/examinations/:id/results', authenticate, isStaff, validate(resultsSchema), async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const exam = await Examination.findById(_id);
    if (!exam) return res.status(404).json({ message: 'Examination not found' });

    for (const r of req.body.results) {
      if (Number(r.marksObtained) > exam.totalMarks) {
        throw new Error(`Marks for a student exceed total marks (${exam.totalMarks})`);
      }
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    const saved = [];
    try {
      for (const r of req.body.results) {
        const studentId = oid(r.studentId);
        const subjectId = r.subjectId ? oid(r.subjectId) : null;
        const grade = gradeFor(r.marksObtained, exam.totalMarks);
        const existing = await ExamResult.findOne({ examinationId: _id, studentId, subjectId }).session(session);
        if (existing) {
          existing.marksObtained = r.marksObtained;
          if (r.remarks !== undefined) existing.remarks = r.remarks;
          existing.grade = grade;
          await existing.save({ session });
          saved.push(existing);
        } else {
          const [created] = await ExamResult.create([{
            ...r,
            studentId,
            subjectId,
            examinationId: _id,
            grade,
          }], { session });
          saved.push(created);
        }
      }
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
    res.json({ message: `Saved ${saved.length} results` });
  } catch (err) {
    next(err);
  }
});

router.post('/examinations/:id/publish', authenticate, isStaff, async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const exam = await Examination.findByIdAndUpdate(_id, { status: 'RESULTS_PUBLISHED' }, { new: true, runValidators: true });
    if (!exam) return res.status(404).json({ message: 'Examination not found' });
    res.json({ message: 'Results published' });
  } catch (err) {
    next(err);
  }
});

// Student report card: all exams
router.get('/students/:id/results', authenticate, async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const rows = await ExamResult.find({ studentId: _id }).sort({ createdAt: -1 });
    const [exams, subjects] = await Promise.all([
      Examination.find({ _id: { $in: rows.map((r) => r.examinationId) } }).select('name totalMarks examDate status'),
      Subject.find({ _id: { $in: rows.map((r) => r.subjectId).filter(Boolean) } }).select('name'),
    ]);
    const examById = new Map(exams.map((e) => [String(e._id), { name: e.name, totalMarks: e.totalMarks, examDate: e.examDate, status: e.status }]));
    const subjectById = new Map(subjects.map((s) => [String(s._id), { name: s.name }]));
    res.json(rows.map((r) => Object.assign(r.toJSON(), {
      examination: examById.get(String(r.examinationId)) ?? null,
      subject: r.subjectId ? subjectById.get(String(r.subjectId)) ?? null : null,
    })));
  } catch (err) {
    next(err);
  }
});

export default router;
