import { Router } from 'express';
import { z } from 'zod';
import { Batch, BatchStudent, ClassSchedule, Examination, oid, Student, StudentAttendance } from '../models/index.js';
import { authenticate, isStaff } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);

const batchSchema = z.object({
  name: z.string().min(2),
  courseId: z.string().optional(),
  teacherId: z.string().optional(),
  capacity: z.coerce.number().int().min(1).default(30),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  days: z.array(z.string()).default([]),
  isActive: z.coerce.boolean().default(true),
});

const scheduleSchema = z.object({
  batchId: z.string(),
  teacherId: z.string().optional(),
  subjectId: z.string().optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string(),
  endTime: z.string(),
  room: z.string().optional(),
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

router.get('/', async (req, res, next) => {
  try {
    const batches = await Batch.find()
      .sort({ name: 1 })
      .populate([
        { path: 'courseId', select: 'name' },
        { path: 'teacherId', select: 'name' },
      ]);
    const ids = batches.map((b) => b._id);
    const [links, studentCounts] = await Promise.all([
      BatchStudent.find({ batchId: { $in: ids } }).select('batchId studentId'),
      Student.aggregate([
        { $match: { batchId: { $in: ids } } },
        { $group: { _id: '$batchId', n: { $sum: 1 } } },
      ]),
    ]);
    const studentsOf = Object.fromEntries(studentCounts.map((g) => [String(g._id), g.n]));
    res.json(
      batches.map((batch) => {
        const o = batch.toJSON();
        const key = String(batch._id);
        relation(o, 'courseId', 'course', ['name']);
        relation(o, 'teacherId', 'teacher', ['name']);
        o.studentLinks = links.filter((l) => String(l.batchId) === key).map((l) => ({ studentId: String(l.studentId) }));
        o._count = { students: studentsOf[key] || 0 };
        return o;
      }),
    );
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const batch = await Batch.findOne({ _id }).populate(['courseId', 'teacherId']);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    const [links, schedules] = await Promise.all([
      BatchStudent.find({ batchId: _id }).populate({ path: 'studentId', populate: { path: 'userId', select: 'email' } }),
      ClassSchedule.find({ batchId: _id }).populate([
        { path: 'teacherId', select: 'name' },
        { path: 'subjectId', select: 'name' },
      ]),
    ]);
    const o = batch.toJSON();
    relation(o, 'courseId', 'course');
    relation(o, 'teacherId', 'teacher');
    o.studentLinks = links.map((l) => {
      const lo = relation(l.toJSON(), 'studentId', 'student');
      if (lo.student) relation(lo.student, 'userId', 'user', ['email']);
      return lo;
    });
    o.schedules = schedules.map((s) => {
      const so = s.toJSON();
      relation(so, 'teacherId', 'teacher', ['name']);
      relation(so, 'subjectId', 'subject', ['name']);
      return so;
    });
    res.json(o);
  } catch (err) {
    next(err);
  }
});

router.post('/', isStaff, validate(batchSchema), async (req, res, next) => {
  try {
    const { courseId, teacherId } = req.body;
    if (badRef(courseId, teacherId)) return res.status(400).json({ message: 'Invalid id' });
    res.status(201).json(await Batch.create({ ...req.body, courseId: refId(courseId), teacherId: refId(teacherId) }));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', isStaff, validate(batchSchema.partial()), async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const { courseId, teacherId } = req.body;
    if (badRef(courseId, teacherId)) return res.status(400).json({ message: 'Invalid id' });
    const batch = await Batch.findByIdAndUpdate(
      _id,
      { ...req.body, courseId: refId(courseId), teacherId: refId(teacherId) },
      { new: true, runValidators: true },
    );
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    res.json(batch);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', isStaff, async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const batch = await Batch.findByIdAndDelete(_id);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    await Promise.all([
      Student.updateMany({ batchId: _id }, { $set: { batchId: null } }),
      BatchStudent.deleteMany({ batchId: _id }),
      ClassSchedule.deleteMany({ batchId: _id }),
      StudentAttendance.updateMany({ batchId: _id }, { $set: { batchId: null } }),
      Examination.updateMany({ batchId: _id }, { $set: { batchId: null } }),
    ]);
    res.json({ message: 'Batch deleted' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/students', isStaff, validate(z.object({ studentIds: z.array(z.string()).min(1) })), async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const requested = req.body.studentIds.map((studentId) => oid(studentId));
    if (requested.some((studentId) => !studentId)) return res.status(400).json({ message: 'Invalid id' });
    const unique = [...new Map(requested.map((studentId) => [String(studentId), studentId])).values()];
    const joined = await BatchStudent.find({ batchId: _id, studentId: { $in: unique } }).select('studentId');
    const already = new Set(joined.map((l) => String(l.studentId)));
    const fresh = unique.filter((studentId) => !already.has(String(studentId)));
    if (fresh.length) await BatchStudent.insertMany(fresh.map((studentId) => ({ batchId: _id, studentId })));
    await Student.updateMany({ _id: { $in: unique } }, { $set: { batchId: _id } });
    res.status(201).json({ message: 'Students assigned to batch' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/students/:studentId', isStaff, async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    const studentId = oid(req.params.studentId);
    if (!_id || !studentId) return res.status(400).json({ message: 'Invalid id' });
    await BatchStudent.deleteMany({ batchId: _id, studentId });
    await Student.updateMany({ _id: studentId, batchId: _id }, { $set: { batchId: null } });
    res.json({ message: 'Student removed from batch' });
  } catch (err) {
    next(err);
  }
});

router.post('/schedules', isStaff, validate(scheduleSchema), async (req, res, next) => {
  try {
    const { batchId, teacherId, subjectId } = req.body;
    if (badRef(batchId, teacherId, subjectId)) return res.status(400).json({ message: 'Invalid id' });
    res.status(201).json(
      await ClassSchedule.create({
        ...req.body,
        batchId: oid(batchId),
        teacherId: refId(teacherId),
        subjectId: refId(subjectId),
      }),
    );
  } catch (err) {
    next(err);
  }
});

router.delete('/schedules/:id', isStaff, async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const schedule = await ClassSchedule.findByIdAndDelete(_id);
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
    res.json({ message: 'Schedule deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
