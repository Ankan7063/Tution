import { Router } from 'express';
import { z } from 'zod';
import { oid, mongoose, FeeRecord, Payment, Student, User, CenterSettings } from '../models/index.js';
import { authenticate, isStaff } from '../middleware/auth.js';
import { validate, ApiError } from '../middleware/validate.js';
import { nextReceiptNo } from '../utils/helpers.js';
import { buildReceiptPdf } from '../utils/pdf.js';
import { notifyAdmins, sendMail } from '../utils/notify.js';

const router = Router();
router.use(authenticate);

const round2 = (n) => Math.round(Number(n) * 100) / 100;
const jsonOf = (doc) => (doc ? doc.toJSON() : null);

const feeRecordSchema = z.object({
  studentId: z.string(),
  feeType: z.string().min(2),
  period: z.string().optional(),
  amount: z.coerce.number().positive(),
  discount: z.coerce.number().min(0).default(0),
  lateFee: z.coerce.number().min(0).default(0),
  dueDate: z.coerce.date(),
});

router.get('/records', async (req, res, next) => {
  try {
    const { status, studentId, overdue } = req.query;
    const where = {
      ...(studentId && { studentId: oid(studentId) }),
      ...(status && { status }),
      ...(overdue === 'true' && { dueDate: { $lt: new Date() }, status: { $in: ['PENDING', 'PARTIAL'] } }),
    };
    const docs = await FeeRecord.find(where).sort({ dueDate: -1 }).limit(500);
    const [students, payments] = await Promise.all([
      Student.find({ _id: { $in: docs.map((d) => d.studentId) } }).select('name admissionNo phone parentPhone'),
      Payment.find({ feeRecordId: { $in: docs.map((d) => d._id) } }).select('amount paymentDate feeRecordId'),
    ]);
    const studentById = new Map(
      students.map((s) => [String(s._id), { name: s.name, admissionNo: s.admissionNo, phone: s.phone, parentPhone: s.parentPhone }]),
    );
    const paymentsByRecord = new Map();
    for (const p of payments) {
      const key = String(p.feeRecordId);
      if (!paymentsByRecord.has(key)) paymentsByRecord.set(key, []);
      paymentsByRecord.get(key).push({ id: p.id, amount: p.amount, paymentDate: p.paymentDate });
    }
    res.json(docs.map((d) => Object.assign(d.toJSON(), {
      student: studentById.get(String(d.studentId)) ?? null,
      payments: paymentsByRecord.get(String(d._id)) ?? [],
    })));
  } catch (err) {
    next(err);
  }
});

router.post('/records', isStaff, validate(feeRecordSchema), async (req, res, next) => {
  try {
    const { studentId, ...rest } = req.body;
    res.status(201).json(await FeeRecord.create({ ...rest, studentId: oid(studentId), status: 'PENDING' }));
  } catch (err) {
    next(err);
  }
});

router.delete('/records/:id', isStaff, async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const record = await FeeRecord.findByIdAndDelete(_id, { session });
      if (!record) throw new ApiError(404, 'Fee record not found');
      await Payment.updateMany({ feeRecordId: _id }, { feeRecordId: null }, { session });
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
    res.json({ message: 'Fee record deleted' });
  } catch (err) {
    next(err);
  }
});

// Generate monthly fee records for all active students in one click
router.post('/records/generate-monthly', isStaff, validate(z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM'),
  dueDate: z.coerce.date(),
  feeType: z.string().default('Monthly Fee'),
})), async (req, res, next) => {
  try {
    const { period, dueDate, feeType } = req.body;
    const students = await Student.find({ status: 'ACTIVE', monthlyFee: { $gt: 0 } });
    const existing = await FeeRecord.find({ period, feeType, studentId: { $in: students.map((s) => s._id) } }).select('studentId');
    const hasRecord = new Set(existing.map((f) => String(f.studentId)));
    let created = 0;
    for (const s of students) {
      if (hasRecord.has(String(s._id))) continue;
      await FeeRecord.create({ studentId: s._id, feeType, period, amount: s.monthlyFee, dueDate });
      created++;
    }
    res.json({ message: `Generated ${created} fee records for ${period}` });
  } catch (err) {
    next(err);
  }
});

const paymentSchema = z.object({
  studentId: z.string(),
  feeRecordId: z.string().optional(),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  method: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'ONLINE']).default('CASH'),
  note: z.string().optional(),
  paymentDate: z.coerce.date().optional(),
});

router.get('/payments', async (req, res, next) => {
  try {
    const { studentId, from, to } = req.query;
    const where = {
      ...(studentId && { studentId: oid(studentId) }),
      ...(from && { paymentDate: { $gte: new Date(from), ...(to && { $lte: new Date(to) }) } }),
    };
    const docs = await Payment.find(where).sort({ paymentDate: -1 }).limit(500);
    const [students, records, users] = await Promise.all([
      Student.find({ _id: { $in: docs.map((d) => d.studentId) } }).select('name admissionNo'),
      FeeRecord.find({ _id: { $in: docs.map((d) => d.feeRecordId).filter(Boolean) } }).select('feeType period'),
      User.find({ _id: { $in: docs.map((d) => d.receivedById).filter(Boolean) } }).select('email'),
    ]);
    const studentById = new Map(students.map((s) => [String(s._id), { name: s.name, admissionNo: s.admissionNo }]));
    const recordById = new Map(records.map((r) => [String(r._id), { feeType: r.feeType, period: r.period }]));
    const userById = new Map(users.map((u) => [String(u._id), { email: u.email }]));
    res.json(docs.map((d) => Object.assign(d.toJSON(), {
      student: studentById.get(String(d.studentId)) ?? null,
      feeRecord: d.feeRecordId ? recordById.get(String(d.feeRecordId)) ?? null : null,
      receivedBy: d.receivedById ? userById.get(String(d.receivedById)) ?? null : null,
    })));
  } catch (err) {
    next(err);
  }
});

router.post('/payments', isStaff, validate(paymentSchema), async (req, res, next) => {
  try {
    const { studentId, feeRecordId, amount, method, note, paymentDate } = req.body;
    const sid = oid(studentId);
    const fid = feeRecordId ? oid(feeRecordId) : null;

    const session = await mongoose.startSession();
    session.startTransaction();
    let payment;
    let record = null;
    let receiptNo;
    try {
      if (feeRecordId) {
        record = fid ? await FeeRecord.findById(fid).session(session) : null;
        if (!record) throw new ApiError(404, 'Fee record not found');
        const paidRows = await Payment.find({ feeRecordId: fid }).select('amount').session(session);
        const paidSoFar = round2(paidRows.reduce((s, p) => s + Number(p.amount), 0));
        const due = round2(Number(record.amount) + Number(record.lateFee) - Number(record.discount) - paidSoFar);
        if (amount > due) throw new ApiError(400, `Amount exceeds pending balance of ${due}`);
        const newStatus = paidSoFar + amount >= due - 0.001 ? 'PAID' : 'PARTIAL';
        record = await FeeRecord.findByIdAndUpdate(fid, { status: newStatus }, { new: true, runValidators: true, session });
      }
      receiptNo = await nextReceiptNo();
      [payment] = await Payment.create([{
        receiptNo,
        studentId: sid,
        feeRecordId: fid,
        amount,
        method,
        note,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        receivedById: oid(req.user.id),
      }], { session });
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    const [student, receivedBy] = await Promise.all([
      Student.findById(payment.studentId),
      payment.receivedById ? User.findById(payment.receivedById).select('email') : Promise.resolve(null),
    ]);
    const paymentJson = Object.assign(payment.toJSON(), {
      student: jsonOf(student),
      feeRecord: jsonOf(record),
      receivedBy: receivedBy ? { email: receivedBy.email } : null,
    });

    await notifyAdmins({
      title: 'Fee Payment Received',
      message: `${paymentJson.student.name} paid ${amount} (${receiptNo}).`,
      type: 'FEE',
      link: '/admin/fees/collection',
    });

    if (paymentJson.student?.email) {
      await sendMail(student.email, 'Fee Payment Receipt', `Receipt ${receiptNo}: Paid ${amount} on ${new Date().toLocaleDateString('en-IN')}.`);
    }
    res.status(201).json(paymentJson);
  } catch (err) {
    next(err);
  }
});

router.get('/payments/:id/receipt.pdf', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const payment = await Payment.findById(_id);
    if (!payment) throw new ApiError(404, 'Payment not found');
    const [student, feeRecord, receivedBy, settings] = await Promise.all([
      Student.findById(payment.studentId),
      payment.feeRecordId ? FeeRecord.findById(payment.feeRecordId) : Promise.resolve(null),
      payment.receivedById ? User.findById(payment.receivedById).select('email') : Promise.resolve(null),
      CenterSettings.findOne({ key: 1 }),
    ]);
    const doc = Object.assign(payment.toJSON(), {
      student: jsonOf(student),
      feeRecord: jsonOf(feeRecord),
      receivedBy: receivedBy ? { email: receivedBy.email } : null,
    });
    const pdf = await buildReceiptPdf(doc, settings);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt-${payment.receiptNo}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

router.delete('/payments/:id', isStaff, async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const payment = await Payment.findByIdAndDelete(_id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.feeRecordId) {
      const record = await FeeRecord.findById(payment.feeRecordId);
      if (record) {
        const rows = await Payment.find({ feeRecordId: record._id }).select('amount');
        const paid = round2(rows.reduce((s, p) => s + Number(p.amount), 0));
        const payable = round2(Number(record.amount) + Number(record.lateFee) - Number(record.discount));
        const status = paid <= 0 ? 'PENDING' : paid >= payable - 0.001 ? 'PAID' : 'PARTIAL';
        await FeeRecord.findByIdAndUpdate(record._id, { status }, { new: true, runValidators: true });
      }
    }
    res.json({ message: 'Payment deleted' });
  } catch (err) {
    next(err);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    const records = await FeeRecord.find().limit(5000).select('amount discount lateFee');
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const [paidAgg, monthlyAgg] = await Promise.all([
      Payment.aggregate([
        { $match: { feeRecordId: { $in: records.map((r) => r._id) } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Payment.aggregate([
        { $match: { paymentDate: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);
    const totalDue = round2(records.reduce((s, r) => s + Number(r.amount) + Number(r.lateFee) - Number(r.discount), 0));
    const totalPaid = round2(paidAgg[0]?.total || 0);
    const monthlyCollected = round2(monthlyAgg[0]?.total || 0);
    res.json({ totalDue, totalPaid, pending: round2(Math.max(totalDue - totalPaid, 0)), monthlyCollected });
  } catch (err) {
    next(err);
  }
});

export default router;
