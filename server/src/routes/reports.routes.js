import { Router } from 'express';
import {
  Batch,
  ClassSchedule,
  ExamResult,
  Examination,
  FeeRecord,
  Payment,
  Student,
  StudentAttendance,
  Subject,
  Teacher,
  TeacherAttendance,
  Types,
  oid,
} from '../models/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { startOfDay, utcDay } from '../utils/helpers.js';

const router = Router();
router.use(authenticate, authorize('SUPER_ADMIN', 'ADMIN'));

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

const isJoined = (v) => !!v && typeof v === 'object' && typeof v.id === 'string';

function prismaShape(value) {
  if (Array.isArray(value)) return value.map(prismaShape);
  if (value instanceof Types.ObjectId) return value.toString();
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (key.endsWith('Id') && isJoined(val)) {
      out[key] = val.id;
      out[key.slice(0, -2)] = prismaShape(val);
      continue;
    }
    out[key] = prismaShape(val);
  }
  return out;
}

const plain = (doc) => prismaShape(doc.toJSON());

const only = (v, keys) => (v && typeof v === 'object' ? Object.fromEntries(keys.map((k) => [k, v[k]])) : null);

const studentPopulate = (...nested) => ({
  path: 'studentId',
  select: { name: 1, admissionNo: 1 },
  populate: nested.map((key) => ({ path: `${key}Id`, select: { name: 1 } })),
});

const shapeStudent = (s, ...nested) => {
  if (!s) return null;
  const out = { name: s.name, admissionNo: s.admissionNo };
  for (const key of nested) out[key] = only(s[key], ['name']);
  return out;
};

async function studentIdsFor(courseId, batchId) {
  const filter = {};
  const course = oid(courseId);
  const batch = oid(batchId);
  if (course) filter.courseId = course;
  if (batch) filter.batchId = batch;
  if (!Object.keys(filter).length) return null;
  const rows = await Student.find(filter).select('_id').lean();
  return rows.map((s) => s._id);
}

const countBy = async (Model, match, field) => {
  if (!match.length) return new Map();
  const rows = await Model.aggregate([
    { $match: { [field]: { $in: match } } },
    { $group: { _id: `$${field}`, n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
};

router.get('/fees', async (req, res, next) => {
  try {
    const { from, to, courseId, batchId, status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (from) {
      filter.dueDate = { $gte: utcDay(from) };
      if (to) filter.dueDate.$lte = utcDay(to);
    }
    const students = await studentIdsFor(courseId, batchId);
    if (students) filter.studentId = { $in: students };

    const records = await FeeRecord.find(filter)
      .populate(studentPopulate('course', 'batch'))
      .sort({ dueDate: -1 })
      .limit(2000);

    const grouped = new Map();
    if (records.length) {
      const payments = await Payment.find({ feeRecordId: { $in: records.map((r) => r._id) } });
      for (const p of payments) {
        const key = String(p.feeRecordId);
        const list = grouped.get(key) || [];
        list.push(plain(p));
        grouped.set(key, list);
      }
    }

    const rows = records.map((r) => {
      const o = plain(r);
      o.student = shapeStudent(o.student, 'course', 'batch');
      o.payments = grouped.get(String(r._id)) || [];
      const payable = round2(Number(r.amount) + Number(r.lateFee) - Number(r.discount));
      const paid = round2(o.payments.reduce((s, p) => s + Number(p.amount), 0));
      return { ...o, payable, paid, balance: round2(payable - paid) };
    });
    const summary = {
      totalPayable: round2(rows.reduce((s, r) => s + r.payable, 0)),
      totalPaid: round2(rows.reduce((s, r) => s + r.paid, 0)),
      totalPending: round2(rows.reduce((s, r) => s + r.balance, 0)),
    };
    res.json({ rows, summary });
  } catch (err) {
    next(err);
  }
});

router.get('/collection', async (req, res, next) => {
  try {
    const { from, to, courseId, batchId, method } = req.query;
    const filter = {};
    if (method) filter.method = method;
    if (from) {
      filter.paymentDate = { $gte: startOfDay(from) };
      if (to) filter.paymentDate.$lte = startOfDay(new Date(to).getTime() + 86399999);
    }
    const students = await studentIdsFor(courseId, batchId);
    if (students) filter.studentId = { $in: students };

    const payments = await Payment.find(filter)
      .populate(studentPopulate('course', 'batch'))
      .populate({ path: 'feeRecordId', select: { feeType: 1, period: 1 } })
      .populate({ path: 'receivedById', select: { email: 1 } })
      .sort({ paymentDate: -1 })
      .limit(2000);

    const rows = payments.map((p) => {
      const o = plain(p);
      o.student = shapeStudent(o.student, 'course', 'batch');
      o.feeRecord = only(o.feeRecord, ['feeType', 'period']);
      o.receivedBy = only(o.receivedBy, ['email']);
      return o;
    });
    const summary = {
      total: round2(rows.reduce((s, p) => s + Number(p.amount), 0)),
      count: rows.length,
    };
    res.json({ rows, summary });
  } catch (err) {
    next(err);
  }
});

router.get('/attendance', async (req, res, next) => {
  try {
    const { from, to, batchId, courseId } = req.query;
    const filter = {};
    const batch = oid(batchId);
    if (batch) filter.batchId = batch;
    const students = await studentIdsFor(courseId, null);
    if (students) filter.studentId = { $in: students };
    if (from) {
      filter.date = { $gte: utcDay(from) };
      if (to) filter.date.$lte = utcDay(to);
    }

    const rows = await StudentAttendance.find(filter)
      .populate(studentPopulate('course', 'batch'))
      .sort({ date: -1 })
      .limit(3000);

    res.json(rows.map((a) => {
      const o = plain(a);
      o.student = shapeStudent(o.student, 'course', 'batch');
      return o;
    }));
  } catch (err) {
    next(err);
  }
});

router.get('/students', async (req, res, next) => {
  try {
    const { courseId, batchId, status } = req.query;
    const filter = {};
    const course = oid(courseId);
    const batch = oid(batchId);
    if (course) filter.courseId = course;
    if (batch) filter.batchId = batch;
    if (status) filter.status = status;

    const students = await Student.find(filter)
      .populate({ path: 'courseId', select: { name: 1 } })
      .populate({ path: 'batchId', select: { name: 1 } })
      .sort({ name: 1 });
    const ids = students.map((s) => s._id);
    const [attendance, payments, examResults] = await Promise.all([
      countBy(StudentAttendance, ids, 'studentId'),
      countBy(Payment, ids, 'studentId'),
      countBy(ExamResult, ids, 'studentId'),
    ]);

    res.json(students.map((s) => {
      const o = plain(s);
      o.course = only(o.course, ['name']);
      o.batch = only(o.batch, ['name']);
      const key = String(s._id);
      o._count = {
        attendance: attendance.get(key) || 0,
        payments: payments.get(key) || 0,
        examResults: examResults.get(key) || 0,
      };
      return o;
    }));
  } catch (err) {
    next(err);
  }
});

router.get('/teachers', async (req, res, next) => {
  try {
    const teachers = await Teacher.find().sort({ name: 1 });
    const ids = teachers.map((t) => t._id);
    const [batches, subjects, attendance, schedules] = await Promise.all([
      Batch.find({ teacherId: { $in: ids } }).select('name teacherId').lean(),
      Subject.find({ teacherId: { $in: ids } }).select('name teacherId').lean(),
      countBy(TeacherAttendance, ids, 'teacherId'),
      countBy(ClassSchedule, ids, 'teacherId'),
    ]);

    const group = (rows) => {
      const map = new Map();
      for (const r of rows) {
        const key = String(r.teacherId);
        const list = map.get(key) || [];
        list.push({ name: r.name });
        map.set(key, list);
      }
      return map;
    };
    const batchMap = group(batches);
    const subjectMap = group(subjects);

    res.json(teachers.map((t) => {
      const o = plain(t);
      const key = String(t._id);
      o.batches = batchMap.get(key) || [];
      o.subjects = subjectMap.get(key) || [];
      o._count = { attendance: attendance.get(key) || 0, schedules: schedules.get(key) || 0 };
      return o;
    }));
  } catch (err) {
    next(err);
  }
});

router.get('/exams/:examId', async (req, res, next) => {
  try {
    const _id = oid(req.params.examId);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });

    const examDoc = await Examination.findOne({ _id }).populate({ path: 'courseId', select: { name: 1 } });
    if (!examDoc) return res.status(404).json({ message: 'Examination not found' });

    const results = await ExamResult.find({ examinationId: _id })
      .populate(studentPopulate('batch'))
      .populate({ path: 'subjectId', select: { name: 1 } });

    const exam = plain(examDoc);
    exam.course = only(exam.course, ['name']);
    exam.results = results.map((x) => {
      const o = plain(x);
      o.student = shapeStudent(o.student, 'batch');
      o.subject = only(o.subject, ['name']);
      return o;
    });

    const rows = exam.results.map((r) => ({
      ...r,
      percentage: examDoc.totalMarks ? Math.round((Number(r.marksObtained) / examDoc.totalMarks) * 10000) / 100 : 0,
    }));
    res.json({ exam, rows });
  } catch (err) {
    next(err);
  }
});

export default router;
