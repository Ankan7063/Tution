import { Router } from 'express';
import { z } from 'zod';
import { oid, StudentAttendance, TeacherAttendance } from '../models/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { notifyAdmins } from '../utils/notify.js';
import { utcDay } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

const bulkSchema = z.object({
  date: z.coerce.date(),
  batchId: z.string().optional(),
  entries: z.array(z.object({
    studentId: z.string(),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'LEAVE']),
    remark: z.string().optional(),
  })).min(1),
});

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

// Marking the same day twice edits the existing row; only a first entry inserts one.
// Values left undefined are dropped from $set, so the stored column stays untouched.
// $set and $setOnInsert may not share a path, so insert-only columns come from `onInsertOnly`.
const dayUpsert = (filter, changed, onInsertOnly = {}) => {
  const set = {};
  for (const [key, value] of Object.entries(changed)) {
    if (value !== undefined) set[key] = value;
  }
  const onInsert = { ...filter, ...onInsertOnly, createdAt: new Date() };
  for (const key of Object.keys(set)) delete onInsert[key];
  return { updateOne: { filter, update: { $set: set, $setOnInsert: onInsert }, upsert: true } };
};

router.post('/students/bulk', authorize('SUPER_ADMIN', 'ADMIN', 'TEACHER'), validate(bulkSchema), async (req, res, next) => {
  try {
    const { date, batchId, entries } = req.body;
    if (batchId && !oid(batchId)) return res.status(400).json({ message: 'Invalid id' });
    const studentIds = entries.map((e) => oid(e.studentId));
    if (studentIds.some((id) => !id)) return res.status(400).json({ message: 'Invalid id' });
    const day = utcDay(date);
    await StudentAttendance.bulkWrite(
      entries.map((e, i) =>
        dayUpsert({ studentId: studentIds[i], date: day }, {
          status: e.status,
          remark: e.remark,
        }, {
          batchId: batchId ? oid(batchId) : null,
        }),
      ),
    );
    const absent = entries.filter((e) => e.status === 'ABSENT').length;
    await notifyAdmins({
      title: 'Attendance Marked',
      message: `Attendance for ${day.toLocaleDateString('en-IN')}: ${entries.length - absent} present, ${absent} absent.`,
      type: 'ATTENDANCE',
    });
    res.json({ message: `Attendance saved for ${entries.length} students` });
  } catch (err) {
    next(err);
  }
});

router.get('/students', async (req, res, next) => {
  try {
    const { date, batchId, studentId, month } = req.query;
    const where = {};
    if (studentId) {
      const id = oid(studentId);
      if (!id) return res.status(400).json({ message: 'Invalid id' });
      where.studentId = id;
    }
    if (batchId) {
      const id = oid(batchId);
      if (!id) return res.status(400).json({ message: 'Invalid id' });
      where.batchId = id;
    }
    if (date) where.date = utcDay(date);
    if (month) {
      const first = utcDay(new Date(`${month}-01`));
      where.date = { $gte: first, $lt: new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1)) };
    }
    const rows = await StudentAttendance.find(where)
      .sort({ date: 'desc' })
      .limit(500)
      .populate([
        { path: 'studentId', select: 'name admissionNo' },
        { path: 'batchId', select: 'name' },
      ]);
    res.json(
      rows.map((row) => {
        const o = row.toJSON();
        relation(o, 'studentId', 'student', ['name', 'admissionNo']);
        relation(o, 'batchId', 'batch', ['name']);
        return o;
      }),
    );
  } catch (err) {
    next(err);
  }
});

router.get('/students/report/:studentId', async (req, res, next) => {
  try {
    const studentId = oid(req.params.studentId);
    if (!studentId) return res.status(400).json({ message: 'Invalid id' });
    const { from, to } = req.query;
    const where = { studentId };
    if (from) {
      where.date = { $gte: utcDay(from) };
      if (to) where.date.$lte = utcDay(to);
    }
    const rows = await StudentAttendance.find(where).sort({ date: 'desc' });
    const total = rows.length;
    const present = rows.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
    res.json({ total, present, absent: total - present, percentage: total ? Math.round((present / total) * 100) : 0, rows });
  } catch (err) {
    next(err);
  }
});

router.post('/teachers/bulk', authorize('SUPER_ADMIN', 'ADMIN'), validate(bulkSchema.omit({ batchId: true })), async (req, res, next) => {
  try {
    const { date, entries } = req.body;
    const teacherIds = entries.map((e) => oid(e.studentId));
    if (teacherIds.some((id) => !id)) return res.status(400).json({ message: 'Invalid id' });
    const day = utcDay(date);
    await TeacherAttendance.bulkWrite(
      entries.map((e, i) => dayUpsert({ teacherId: teacherIds[i], date: day }, { status: e.status, remark: e.remark })),
    );
    res.json({ message: `Teacher attendance saved for ${entries.length} teachers` });
  } catch (err) {
    next(err);
  }
});

router.get('/teachers', authorize('SUPER_ADMIN', 'ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const { date } = req.query;
    const rows = await TeacherAttendance.find(date ? { date: utcDay(date) } : {})
      .sort({ date: 'desc' })
      .limit(300)
      .populate({ path: 'teacherId', select: 'name employeeNo' });
    res.json(
      rows.map((row) => {
        const o = row.toJSON();
        relation(o, 'teacherId', 'teacher', ['name', 'employeeNo']);
        return o;
      }),
    );
  } catch (err) {
    next(err);
  }
});

export default router;
