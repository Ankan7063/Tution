import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User, Student, Teacher, oid } from '../models/index.js';
import { signToken, authenticate, requirePermission } from '../middleware/auth.js';
import { validate, ApiError } from '../middleware/validate.js';
import { nextAdmissionNo } from '../utils/helpers.js';
import { sendMail, notifyAdmins } from '../utils/notify.js';
import { PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS, permissionsFor } from '../utils/permissions.js';

const router = Router();

// The identity the client works with. `permissions` drives which nav entries, routes and
// buttons render — the server re-checks every one of them on each request.
const publicUser = (user) => ({
  id: String(user.id),
  email: user.email,
  role: user.role,
  roleLabel: ROLE_LABELS[user.role] ?? user.role,
  permissions: permissionsFor(user),
});

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
    res.json({ token, user: publicUser(user) });
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
      ...publicUser(user),
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

// ---- Account administration: only an admin reaches these ----

const assignableRoles = ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STAFF', 'STUDENT'];

// The catalogue the admin UI renders, plus what each role gets out of the box.
router.get('/permissions', authenticate, requirePermission('users:manage'), async (req, res) => {
  res.json({
    catalogue: Object.entries(PERMISSIONS).map(([key, description]) => ({ key, description })),
    roleDefaults: ROLE_PERMISSIONS,
    roleLabels: ROLE_LABELS,
  });
});

router.get('/users', authenticate, requirePermission('users:manage'), async (req, res, next) => {
  try {
    const users = await User.find().sort({ role: 1, email: 1 });
    const [students, teachers] = await Promise.all([
      Student.find({ userId: { $in: users.map((u) => u._id) } }).select('userId name admissionNo'),
      Teacher.find({ userId: { $in: users.map((u) => u._id) } }).select('userId name employeeNo'),
    ]);
    const studentBy = new Map(students.map((s) => [String(s.userId), { id: s.id, name: s.name, admissionNo: s.admissionNo }]));
    const teacherBy = new Map(teachers.map((t) => [String(t.userId), { id: t.id, name: t.name, employeeNo: t.employeeNo }]));
    // No credential field is ever serialised: the model's toJSON drops passwordHash.
    res.json(users.map((user) => Object.assign(publicUser(user), {
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt ?? null,
      student: studentBy.get(String(user.id)) ?? null,
      teacher: teacherBy.get(String(user.id)) ?? null,
    })));
  } catch (err) {
    next(err);
  }
});

// Admin creates user accounts (teachers / staff / students / admins)
router.post('/users', authenticate, requirePermission('users:manage'), validate(z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(assignableRoles),
  permissions: z.array(z.enum(Object.keys(PERMISSIONS))).optional(),
  studentId: z.string().optional(),
  teacherId: z.string().optional(),
})), async (req, res, next) => {
  try {
    const { email, password, role, permissions, studentId, teacherId } = req.body;
    if (role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      throw new ApiError(403, 'Only a super admin can create a super admin account');
    }
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) throw new ApiError(409, 'A user with this email already exists');
    const _studentId = studentId ? oid(studentId) : null;
    const _teacherId = teacherId ? oid(teacherId) : null;
    if ((studentId && !_studentId) || (teacherId && !_teacherId)) {
      return res.status(400).json({ message: 'Invalid id' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      role,
      permissions: permissions ?? [],
    });
    if (_studentId) await Student.updateOne({ _id: _studentId }, { userId: user._id });
    if (_teacherId) await Teacher.updateOne({ _id: _teacherId }, { userId: user._id });
    res.status(201).json(publicUser(user));
  } catch (err) {
    next(err);
  }
});

// Role, extra grants, linked profile and active flag. Passwords are never read or returned here.
router.patch('/users/:id', authenticate, requirePermission('users:manage'), validate(z.object({
  role: z.enum(assignableRoles).optional(),
  permissions: z.array(z.enum(Object.keys(PERMISSIONS))).optional(),
  isActive: z.coerce.boolean().optional(),
  studentId: z.string().nullable().optional(),
  teacherId: z.string().nullable().optional(),
})), async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const target = await User.findOne({ _id });
    if (!target) return res.status(404).json({ message: 'User not found' });
    const isSelf = String(_id) === String(req.user.id);
    if (target.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      throw new ApiError(403, 'Only a super admin can change a super admin account');
    }
    if (isSelf && (req.body.isActive === false || (req.body.role && req.body.role !== target.role))) {
      throw new ApiError(400, 'You cannot deactivate or change your own role');
    }
    if (req.body.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      throw new ApiError(403, 'Only a super admin can grant the super admin role');
    }
    if (req.body.role !== undefined) target.role = req.body.role;
    if (req.body.permissions !== undefined) target.permissions = req.body.permissions;
    if (req.body.isActive !== undefined) target.isActive = req.body.isActive;
    await target.save();

    // Re-linking moves the account pointer; a person record never ends up without one.
    const link = async (Model, rawId, ownField) => {
      if (rawId === undefined) return;
      await Model.updateOne({ userId: target._id }, { userId: null });
      if (!rawId) return;
      const _linkId = oid(rawId);
      if (!_linkId) throw new ApiError(400, `Invalid ${ownField} id`);
      const record = await Model.findById(_linkId);
      if (!record) throw new ApiError(404, `${ownField} record not found`);
      if (record.userId && String(record.userId) !== String(target._id)) {
        throw new ApiError(409, `That ${ownField.toLowerCase()} is already linked to another account`);
      }
      await Model.updateOne({ _id: _linkId }, { userId: target._id });
    };
    await link(Student, req.body.studentId, 'student');
    await link(Teacher, req.body.teacherId, 'teacher');

    res.json(publicUser(target));
  } catch (err) {
    next(err);
  }
});

// Admin-set password. The old password is not needed and the new one is never echoed back.
router.post('/users/:id/reset-password', authenticate, requirePermission('users:manage'), validate(z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})), async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    const target = await User.findOne({ _id });
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (target.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      throw new ApiError(403, 'Only a super admin can reset a super admin password');
    }
    target.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
    await target.save();
    res.json({ message: `Password updated for ${target.email}` });
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
