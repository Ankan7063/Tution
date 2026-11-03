import { Router } from 'express';
import {
  Batch,
  Course,
  Examination,
  FeeRecord,
  Payment,
  Student,
  StudentAttendance,
  Teacher,
  Types,
} from '../models/index.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { can } from '../utils/permissions.js';
import { utcDay } from '../utils/helpers.js';

const router = Router();
router.use(authenticate, requirePermission('dashboard:read'));

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

router.get('/stats', async (req, res, next) => {
  try {
    const today = utcDay();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    // Money is only aggregated when the session may see it, so it never reaches the response at all.
    const seesFees = can(req.user, 'fees:read');
    const [
      totalStudents, totalTeachers, totalCourses, totalBatches,
      todayAttendance, totalCollected, monthlyRevenue, recentStudents,
      recentPayments, upcomingExams, pendingFeesCount,
    ] = await Promise.all([
      Student.countDocuments({ status: 'ACTIVE' }),
      Teacher.countDocuments({ status: 'ACTIVE' }),
      Course.countDocuments({ isActive: true }),
      Batch.countDocuments({ isActive: true }),
      StudentAttendance.aggregate([
        { $match: { date: today } },
        { $group: { _id: '$status', _count: { $sum: 1 } } },
      ]),
      seesFees ? Payment.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]) : Promise.resolve([]),
      seesFees
        ? Payment.aggregate([
          { $match: { paymentDate: { $gte: monthStart } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ])
        : Promise.resolve([]),
      Student.find().sort({ createdAt: -1 }).limit(5).populate({ path: 'courseId', select: { name: 1 } }),
      seesFees
        ? Payment.find()
          .sort({ paymentDate: -1 })
          .limit(5)
          .populate({ path: 'studentId', select: { name: 1, admissionNo: 1 } })
        : Promise.resolve([]),
      Examination.find({ examDate: { $gte: today }, status: 'SCHEDULED' })
        .sort({ examDate: 1 })
        .limit(5)
        .populate({ path: 'courseId', select: { name: 1 } }),
      seesFees ? FeeRecord.countDocuments({ dueDate: { $lt: today }, status: { $in: ['PENDING', 'PARTIAL'] } }) : Promise.resolve(null),
    ]);

    const byStatus = Object.fromEntries(todayAttendance.map((a) => [a._id, a._count]));
    const attendanceToday = {
      present: byStatus.PRESENT || 0,
      absent: byStatus.ABSENT || 0,
      late: byStatus.LATE || 0,
    };

    res.json({
      totalStudents, totalTeachers, totalCourses, totalBatches,
      attendanceToday,
      ...(seesFees ? { totalCollected: round2(totalCollected[0]?.total || 0) } : {}),
      ...(seesFees ? { monthlyRevenue: round2(monthlyRevenue[0]?.total || 0) } : {}),
      ...(seesFees ? { pendingFeesCount } : {}),
      recentStudents: recentStudents.map((s) => {
        const o = plain(s);
        o.course = only(o.course, ['name']);
        return o;
      }),
      ...(seesFees
        ? {
          recentPayments: recentPayments.map((p) => {
            const o = plain(p);
            o.student = only(o.student, ['name', 'admissionNo']);
            return o;
          }),
        }
        : {}),
      upcomingExams: upcomingExams.map((e) => {
        const o = plain(e);
        o.course = only(o.course, ['name']);
        return o;
      }),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/charts/revenue', requirePermission('fees:read'), async (req, res, next) => {
  try {
    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    const rows = await Payment.aggregate([
      { $match: { paymentDate: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$paymentDate', timezone: 'UTC' } },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json(rows.map((r) => ({ month: r._id, total: round2(r.total) })));
  } catch (err) {
    next(err);
  }
});

router.get('/charts/enrollment', async (req, res, next) => {
  try {
    const rows = await Student.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'UTC' } },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json(rows.map((r) => ({ month: r._id, total: Number(r.total) })));
  } catch (err) {
    next(err);
  }
});

router.get('/charts/attendance', async (req, res, next) => {
  try {
    const since = utcDay(new Date(Date.now() - 30 * 86400000));
    const rows = await StudentAttendance.aggregate([
      { $match: { date: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'UTC' } },
          present: { $sum: { $cond: [{ $in: ['$status', ['PRESENT', 'LATE']] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'ABSENT'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json(rows.map((r) => ({ day: r._id, present: Number(r.present), absent: Number(r.absent) })));
  } catch (err) {
    next(err);
  }
});

export default router;
