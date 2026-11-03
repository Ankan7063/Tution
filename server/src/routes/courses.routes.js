import { Router } from 'express';
import { z } from 'zod';
import { Batch, ClassSchedule, Course, ExamResult, Examination, oid, Student, Subject } from '../models/index.js';
import { attachIdentity, authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const courseSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  description: z.string().optional(),
  duration: z.string().optional(),
  monthlyFee: z.coerce.number().min(0).default(0),
  admissionFee: z.coerce.number().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
});

const subjectSchema = z.object({
  name: z.string().min(1),
  courseId: z.string().optional(),
  teacherId: z.string().optional(),
});

const refId = (v) => (v === undefined || v === null ? v : oid(v));
const badRef = (...vals) => vals.some((v) => v !== undefined && v !== null && v !== '' && !oid(v));

const picked = (doc, fields) => fields.reduce((acc, f) => ({ ...acc, [f]: doc[f] }), {});

// A populated foreign key holds the document itself, so the relation is exposed under
// `<name>` while `<name>Id` keeps the id string.
const relation = (obj, key, name, fields) => {
  const value = obj[key];
  if (!value || typeof value !== 'object') {
    obj[name] = null;
    return obj;
  }
  obj[key] = value.id ?? null;
  obj[name] = fields ? picked(value, fields) : value;
  return obj;
};

// Public for the centre website; a signed-in teacher or staff member still gets the
// financial columns removed, so the fee cards cannot be read from here.
router.get('/courses', attachIdentity, async (req, res, next) => {
  try {
    const courses = await Course.find().sort({ name: 1 });
    const ids = courses.map((c) => c._id);
    const [subjects, batches, studentCounts] = await Promise.all([
      Subject.find({ courseId: { $in: ids } }).populate({ path: 'teacherId', select: 'name' }),
      Batch.find({ courseId: { $in: ids } }),
      Student.aggregate([
        { $match: { courseId: { $in: ids } } },
        { $group: { _id: '$courseId', n: { $sum: 1 } } },
      ]),
    ]);
    const studentsOf = Object.fromEntries(studentCounts.map((g) => [String(g._id), g.n]));
    res.json(
      courses.map((course) => {
        const o = course.toJSON();
        const key = String(course._id);
        o.subjects = subjects
          .filter((s) => String(s.courseId) === key)
          .map((s) => relation(s.toJSON(), 'teacherId', 'teacher', ['name']));
        o.batches = batches
          .filter((b) => String(b.courseId) === key)
          .map((b) => ({ id: b.id, name: b.name }));
        o._count = { students: studentsOf[o.id] || 0 };
        return o;
      }),
    );
  } catch (err) {
    next(err);
  }
});

router.post('/courses', authenticate, requirePermission('courses:write'), validate(courseSchema), async (req, res, next) => {
  try {
    res.status(201).json(await Course.create(req.body));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Course code already exists' });
    next(err);
  }
});

router.put('/courses/:id', authenticate, requirePermission('courses:write'), validate(courseSchema.partial()), async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const course = await Course.findByIdAndUpdate(_id, req.body, { new: true, runValidators: true });
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json(course);
  } catch (err) {
    next(err);
  }
});

router.delete('/courses/:id', authenticate, requirePermission('courses:write'), async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const course = await Course.findByIdAndDelete(_id);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    await Promise.all([
      Subject.updateMany({ courseId: _id }, { $set: { courseId: null } }),
      Batch.updateMany({ courseId: _id }, { $set: { courseId: null } }),
      Student.updateMany({ courseId: _id }, { $set: { courseId: null } }),
      Examination.updateMany({ courseId: _id }, { $set: { courseId: null } }),
    ]);
    res.json({ message: 'Course deleted' });
  } catch (err) {
    next(err);
  }
});

router.post('/subjects', authenticate, requirePermission('courses:write'), validate(subjectSchema), async (req, res, next) => {
  try {
    const { name, courseId, teacherId } = req.body;
    if (badRef(courseId, teacherId)) return res.status(400).json({ message: 'Invalid id' });
    res.status(201).json(await Subject.create({ name, courseId: refId(courseId), teacherId: refId(teacherId) }));
  } catch (err) {
    next(err);
  }
});

router.put('/subjects/:id', authenticate, requirePermission('courses:write'), validate(subjectSchema.partial()), async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const { courseId, teacherId } = req.body;
    if (badRef(courseId, teacherId)) return res.status(400).json({ message: 'Invalid id' });
    const subject = await Subject.findByIdAndUpdate(
      _id,
      { ...req.body, courseId: refId(courseId), teacherId: refId(teacherId) },
      { new: true, runValidators: true },
    );
    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    res.json(subject);
  } catch (err) {
    next(err);
  }
});

router.delete('/subjects/:id', authenticate, requirePermission('courses:write'), async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const subject = await Subject.findByIdAndDelete(_id);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    await Promise.all([
      ClassSchedule.updateMany({ subjectId: _id }, { $set: { subjectId: null } }),
      ExamResult.updateMany({ subjectId: _id }, { $set: { subjectId: null } }),
    ]);
    res.json({ message: 'Subject deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
