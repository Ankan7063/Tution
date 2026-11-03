import { Router } from 'express';
import { z } from 'zod';
import {
  Student,
  BatchStudent,
  StudentAttendance,
  ExamResult,
  FeeRecord,
  Payment,
  CenterSettings,
  oid,
} from '../models/index.js';
import { authenticate, isStaff, authorize, requirePermission } from '../middleware/auth.js';
import { assignedBatchIds, can } from '../utils/permissions.js';
import { validate, ApiError } from '../middleware/validate.js';
import { nextAdmissionNo } from '../utils/helpers.js';
import { notifyAdmins, createNotification } from '../utils/notify.js';
import { applyIds, castIds, contains, pick } from '../utils/students-serde.js';

const router = Router();
router.use(authenticate);

const studentSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  gender: z.string().optional(),
  dob: z.coerce.date().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('').transform(() => undefined)),
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
  address: z.string().optional(),
  classGrade: z.string().optional(),
  courseId: z.string().optional(),
  batchId: z.string().optional(),
  monthlyFee: z.coerce.number().min(0).default(0),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PASSED_OUT']).default('ACTIVE'),
  photo: z.string().optional(),
});

// A teacher may only ever reach the students in the batches they are assigned to.
async function batchScopeOf(user) {
  return assignedBatchIds(user);
}

// The student portal opens a learner's own record; the handler below still rejects every other id.
const readStudent = (req, res, next) => {
  if (can(req.user, 'students:read') || req.user.role === 'STUDENT') return next();
  return res.status(403).json({ message: 'Your role does not allow this action' });
};

router.get('/', requirePermission('students:read'), async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const filters = castIds(req.query, ['courseId', 'batchId']);
    if (!filters) return res.status(400).json({ message: 'Invalid id' });
    const scope = await batchScopeOf(req.user);
    if (scope) {
      if (filters.batchId && !scope.includes(String(filters.batchId))) {
        throw new ApiError(403, 'You are not assigned to this batch');
      }
      filters.batchId = { $in: scope.map((id) => oid(id)) };
    }
    const where = {
      ...filters,
      ...(status && { status }),
      ...(search && {
        $or: [
          { name: contains(search, { insensitive: true }) },
          { admissionNo: contains(search, { insensitive: true }) },
          { phone: contains(search) },
          { parentPhone: contains(search) },
        ],
      }),
    };
    const [total, students] = await Promise.all([
      Student.countDocuments(where),
      Student.find(where)
        .populate(['course', 'batch'])
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit)),
    ]);
    const rows = students.map((student) => {
      const row = student.toJSON();
      row.course = pick(row.course, ['name']);
      row.batch = pick(row.batch, ['name']);
      return row;
    });
    res.json({ total, page: Number(page), pages: Math.ceil(total / Number(limit)), rows });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', readStudent, async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const student = await Student.findOne({ _id }).populate([
      { path: 'course' },
      { path: 'batch', populate: { path: 'teacher' } },
      { path: 'user' },
      { path: 'attendance', options: { sort: { date: -1 }, limit: 60 } },
      { path: 'feeRecords', options: { sort: { dueDate: -1 } }, populate: { path: 'payments' } },
      { path: 'payments', options: { sort: { paymentDate: -1 } }, populate: { path: 'receivedBy' } },
      { path: 'examResults', populate: [{ path: 'examination' }, { path: 'subject' }] },
    ]);
    if (!student) throw new ApiError(404, 'Student not found');
    if (req.user.role === 'STUDENT' && String(student.userId) !== String(req.user._id)) {
      throw new ApiError(403, 'You may only open your own record');
    }
    if (req.user.role === 'TEACHER') {
      const scope = await batchScopeOf(req.user);
      if (!student.batchId || !scope.includes(String(student.batchId))) {
        throw new ApiError(403, 'This student is not in your batches');
      }
    }
    const row = student.toJSON();
    row.user = pick(row.user, ['email']);
    if (row.batch) row.batch.teacher = pick(row.batch.teacher, ['name', 'phone']);
    row.payments = (row.payments || []).map((payment) => ({
      ...payment,
      receivedBy: pick(payment.receivedBy, ['email']),
    }));
    row.examResults = (row.examResults || []).map((result) => ({
      ...result,
      examination: pick(result.examination, ['name', 'totalMarks', 'examDate']),
      subject: pick(result.subject, ['name']),
    }));
    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermission('students:write'), validate(studentSchema), async (req, res, next) => {
  try {
    const data = applyIds(req.body, ['courseId', 'batchId']);
    if (!data) return res.status(400).json({ message: 'Invalid id' });
    const admissionNo = await nextAdmissionNo();
    const student = await Student.create({ ...data, admissionNo });
    const settings = await CenterSettings.findOne({ key: 1 });
    if (settings?.notifyNewStudent) {
      await notifyAdmins({
        title: 'New Student Registered',
        message: `${student.name} (${student.admissionNo}) was admitted.`,
        type: 'STUDENT',
        link: `/admin/students/${student.id}`,
      });
    }
    res.status(201).json(student);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requirePermission('students:write'), validate(studentSchema.partial()), async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const data = applyIds(req.body, ['courseId', 'batchId']);
    if (!data) return res.status(400).json({ message: 'Invalid id' });
    const existing = await Student.findOne({ _id });
    if (!existing) throw new ApiError(404, 'Student not found');
    const student = await Student.findByIdAndUpdate(_id, data, { new: true, runValidators: true });
    res.json(student);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requirePermission('students:delete'), async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const existing = await Student.findOne({ _id });
    if (!existing) throw new ApiError(404, 'Student not found');
    await Payment.deleteMany({ studentId: _id });
    await Promise.all([
      StudentAttendance.deleteMany({ studentId: _id }),
      ExamResult.deleteMany({ studentId: _id }),
      BatchStudent.deleteMany({ studentId: _id }),
      FeeRecord.deleteMany({ studentId: _id }),
    ]);
    await Student.findByIdAndDelete(_id);
    res.json({ message: 'Student deleted' });
  } catch (err) {
    next(err);
  }
});

// Student summary for fee panel on profile page
router.get('/:id/fee-summary', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    if (!can(req.user, 'fees:read')) {
      const own = await Student.exists({ _id, userId: req.user._id });
      if (!own) throw new ApiError(403, 'Your role does not allow this action');
    }
    const records = await FeeRecord.find({ studentId: _id }).populate('payments');
    let total = 0, paid = 0;
    for (const r of records) {
      total += Number(r.amount) + Number(r.lateFee) - Number(r.discount);
      paid += r.payments.reduce((s, p) => s + Number(p.amount), 0);
    }
    res.json({ total, paid, pending: Math.max(total - paid, 0) });
  } catch (err) {
    next(err);
  }
});

export default router;
