import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User, Student, Teacher, oid } from '../models/index.js';
import { signToken, authenticate, isStaff } from '../middleware/auth.js';
import { validate, ApiError } from '../middleware/validate.js';
import { nextAdmissionNo } from '../utils/helpers.js';
import { sendMail, notifyAdmins } from '../utils/notify.js';

const router = Router();

// Password-reset one-time codes live in memory: reset flow is short-lived and demo data does
// not need durable codes. { email: { code, expiresAt, attempts } }
const resetCodes = new Map();
const RESET_TTL_MS = 10 * 60 * 1000;
const MAX_RESET_ATTEMPTS = 5;

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.isActive) throw new ApiError(401, 'Invalid email or password');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new ApiError(401, 'Invalid email or password');

    await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() }, { new: true, runValidators: true });
    const token = signToken({ id: String(user.id), role: user.role });
    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, studentId: undefined, teacherId: undefined },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: oid(req.user.id) });
    const [student, teacher] = await Promise.all([
      Student.findOne({ userId: user._id }),
      Teacher.findOne({ userId: user._id }),
    ]);
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      student: student ? { id: student.id, name: student.name, admissionNo: student.admissionNo } : null,
      teacher: teacher ? { id: teacher.id, name: teacher.name, employeeNo: teacher.employeeNo } : null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/change-password', authenticate, validate(z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
})), async (req, res, next) => {
  try {
    const ok = await bcrypt.compare(req.body.currentPassword, req.user.passwordHash);
    if (!ok) throw new ApiError(400, 'Current password is incorrect');
    const passwordHash = await bcrypt.hash(req.body.newPassword, 12);
    await User.findByIdAndUpdate(oid(req.user.id), { passwordHash }, { new: true, runValidators: true });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

// Admin creates user accounts (teachers / students / admins)
router.post('/users', authenticate, isStaff, validate(z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT']),
  studentId: z.string().optional(),
  teacherId: z.string().optional(),
})), async (req, res, next) => {
  try {
    const { email, password, role, studentId, teacherId } = req.body;
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) throw new ApiError(409, 'A user with this email already exists');
    const _studentId = studentId ? oid(studentId) : null;
    const _teacherId = teacherId ? oid(teacherId) : null;
    if ((studentId && !_studentId) || (teacherId && !_teacherId)) {
      return res.status(400).json({ message: 'Invalid id' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email: email.toLowerCase(), passwordHash, role });
    if (_studentId) await Student.updateOne({ _id: _studentId }, { userId: user._id });
    if (_teacherId) await Teacher.updateOne({ _id: _teacherId }, { userId: user._id });
    res.status(201).json({ id: user.id, email: user.email, role: user.role });
  } catch (err) {
    next(err);
  }
});

// Anyone with an account (admin, teacher or student) can recover access.
router.post('/forgot-password', validate(z.object({
  email: z.string().email('Enter a valid email address'),
})), async (req, res, next) => {
  try {
    const email = req.body.email.toLowerCase();
    const user = await User.findOne({ email });
    // Same reply whether or not the account exists, so the route can't enumerate users.
    const generic = { message: 'If the account exists, a reset code has been sent to the registered email.' };
    if (!user || !user.isActive) return res.json(generic);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    resetCodes.set(email, { hash: await bcrypt.hash(code, 10), expiresAt: Date.now() + RESET_TTL_MS, attempts: 0 });
    const sent = await sendMail(email, 'Your Tuition Center password reset code',
      `Your password reset code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`);
    // With SMTP unset (demo setups) the code is shown on screen instead of emailed.
    res.json(sent ? generic : { ...generic, demoCode: code });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', validate(z.object({
  email: z.string().email(),
  code: z.string().length(6, 'Enter the 6-digit code'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})), async (req, res, next) => {
  try {
    const email = req.body.email.toLowerCase();
    const entry = resetCodes.get(email);
    if (!entry || entry.expiresAt < Date.now()) {
      resetCodes.delete(email);
      throw new ApiError(400, 'Reset code expired or not requested. Please start again.');
    }
    if (entry.attempts >= MAX_RESET_ATTEMPTS) throw new ApiError(429, 'Too many attempts. Request a new code.');
    entry.attempts += 1;
    if (!(await bcrypt.compare(req.body.code, entry.hash))) throw new ApiError(400, 'Incorrect reset code');

    const user = await User.findOne({ email });
    if (!user) throw new ApiError(400, 'Account not found');
    resetCodes.delete(email);
    user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
    await user.save();
    res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (err) {
    next(err);
  }
});

// Self-service registration — students only. Staff accounts are created by the admin.
router.post('/register', validate(z.object({
  name: z.string().min(2, 'Enter the student name'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
  classGrade: z.string().optional(),
  address: z.string().optional(),
  courseId: z.string().optional(),
})), async (req, res, next) => {
  try {
    const email = req.body.email.toLowerCase();
    if (await User.findOne({ email })) throw new ApiError(409, 'An account with this email already exists');
    const { name, password, phone, parentName, parentPhone, classGrade, address, courseId } = req.body;

    const user = await User.create({ email, passwordHash: await bcrypt.hash(password, 12), role: 'STUDENT' });
    const student = await Student.create({
      name, email, phone: phone || null, parentName: parentName || null,
      parentPhone: parentPhone || null, classGrade: classGrade || null, address: address || null,
      admissionNo: await nextAdmissionNo(),
      courseId: courseId && oid(courseId) ? oid(courseId) : null,
      userId: user._id,
    });
    await notifyAdmins({
      title: 'New student registration',
      message: `${student.name} (${student.admissionNo}) registered online.`,
      type: 'STUDENT',
    });
    res.status(201).json({
      token: signToken({ id: String(user.id), role: user.role }),
      user: { id: user.id, email: user.email, role: user.role },
      student: { id: student.id, name: student.name, admissionNo: student.admissionNo },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
