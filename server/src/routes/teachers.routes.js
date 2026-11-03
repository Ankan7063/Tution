import { Router } from 'express';
import { z } from 'zod';
import {
  Teacher,
  Subject,
  Batch,
  ClassSchedule,
  TeacherAttendance,
  oid,
} from '../models/index.js';
import { authenticate, isStaff, authorize } from '../middleware/auth.js';
import { validate, ApiError } from '../middleware/validate.js';
import { applyIds, contains, pick, startsWith } from '../utils/students-serde.js';

const router = Router();
router.use(authenticate);

const teacherSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('').transform(() => undefined)),
  specialization: z.string().optional(),
  salary: z.coerce.number().min(0).default(0),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PASSED_OUT']).default('ACTIVE'),
  photo: z.string().optional(),
  userId: z.string().optional(),
});

router.get('/', authorize('SUPER_ADMIN', 'ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const where = {
      ...(status && { status }),
      ...(search && {
        $or: [
          { name: contains(search, { insensitive: true }) },
          { employeeNo: contains(search, { insensitive: true }) },
          { specialization: contains(search, { insensitive: true }) },
        ],
      }),
    };
    const teachers = await Teacher.find(where)
      .populate(['user', 'batches', 'subjects'])
      .sort({ createdAt: -1 });
    const rows = teachers.map((teacher) => {
      const row = teacher.toJSON();
      row.user = pick(row.user, ['email']);
      row.batches = pick(row.batches ?? [], ['id', 'name']);
      row.subjects = pick(row.subjects ?? [], ['id', 'name']);
      return row;
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const teacher = await Teacher.findOne({ _id }).populate([
      { path: 'user' },
      { path: 'batches', populate: { path: 'course' } },
      { path: 'subjects', populate: { path: 'course' } },
      { path: 'schedules', populate: [{ path: 'batch' }, { path: 'subject' }] },
      { path: 'attendance', options: { sort: { date: -1 }, limit: 31 } },
    ]);
    if (!teacher) return res.json(null);
    const row = teacher.toJSON();
    row.user = pick(row.user, ['email']);
    row.batches = (row.batches || []).map((batch) => ({ ...batch, course: pick(batch.course, ['name']) }));
    row.subjects = (row.subjects || []).map((subject) => ({ ...subject, course: pick(subject.course, ['name']) }));
    row.schedules = (row.schedules || []).map((schedule) => ({
      ...schedule,
      batch: pick(schedule.batch, ['name']),
      subject: pick(schedule.subject, ['name']),
    }));
    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.post('/', isStaff, validate(teacherSchema), async (req, res, next) => {
  try {
    const data = applyIds(req.body, ['userId']);
    if (!data) return res.status(400).json({ message: 'Invalid id' });
    const year = new Date().getFullYear();
    const prefix = `EMP-${year}-`;
    const last = await Teacher.findOne({ employeeNo: startsWith(prefix) }).sort({ employeeNo: -1 });
    const seq = last ? parseInt(last.employeeNo.slice(prefix.length), 10) + 1 : 1;
    const employeeNo = `${prefix}${String(seq).padStart(3, '0')}`;
    const teacher = await Teacher.create({ ...data, employeeNo });
    res.status(201).json(teacher);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', isStaff, validate(teacherSchema.partial()), async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const data = applyIds(req.body, ['userId']);
    if (!data) return res.status(400).json({ message: 'Invalid id' });
    const teacher = await Teacher.findByIdAndUpdate(_id, data, { new: true, runValidators: true });
    if (!teacher) throw new ApiError(404, 'Teacher not found');
    res.json(teacher);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', isStaff, async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const existing = await Teacher.findOne({ _id });
    if (!existing) throw new ApiError(404, 'Teacher not found');
    await Promise.all([
      Subject.updateMany({ teacherId: _id }, { teacherId: null }),
      Batch.updateMany({ teacherId: _id }, { teacherId: null }),
      ClassSchedule.updateMany({ teacherId: _id }, { teacherId: null }),
      TeacherAttendance.deleteMany({ teacherId: _id }),
    ]);
    await Teacher.findByIdAndDelete(_id);
    res.json({ message: 'Teacher deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
