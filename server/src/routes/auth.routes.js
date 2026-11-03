import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User, Student, Teacher, oid } from '../models/index.js';
import { signToken, authenticate, isStaff } from '../middleware/auth.js';
import { validate, ApiError } from '../middleware/validate.js';

const router = Router();

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

export default router;
