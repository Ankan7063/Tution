import mongoose from 'mongoose';
import { config } from '../config.js';

const { Schema, model, Types } = mongoose;

// Every document is serialised the way Prisma serialised rows: a string `id`,
// no `_id`/`__v`, and populated relations inlined as plain objects.
const jsonOptions = {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    delete ret._id;
    return ret;
  },
};

const baseOptions = {
  timestamps: true,
  toJSON: jsonOptions,
  toObject: { virtuals: true },
};

// Request params arrive as the string ids this API hands out; anything that is not a
// valid ObjectId can only be a typo, so routes turn it into a 400 instead of a cast error.
const oid = (v) => (v && Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null);

// Postgres uuid -> ObjectId, used only by the one-off data transfer. Taking the first 24
// hex digits is deterministic, so foreign keys map through the same function.
const oidFromUuid = (uuid) => new Types.ObjectId(String(uuid).replace(/-/g, '').slice(0, 24));

const createdAtField = { createdAt: { type: Date, default: () => new Date() } };

const Role = ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT'];
const StudentStatus = ['ACTIVE', 'INACTIVE', 'PASSED_OUT'];
const AttendanceStatus = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'];
const FeeStatus = ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE'];
const PaymentMethod = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'ONLINE'];
const ExamStatus = ['SCHEDULED', 'CONDUCTED', 'RESULTS_PUBLISHED'];

const ref = (name) => ({ type: Types.ObjectId, ref: name, default: null });
// Money was Postgres Decimal(10,2); a rounded double keeps the JSON shape numeric.
const money = (def = 0) => ({
  type: Number,
  default: def,
  set: (v) => Math.round(Number(v) * 100) / 100,
});

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: Role, default: 'ADMIN' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  baseOptions,
);
userSchema.index({ role: 1 });

const studentSchema = new Schema(
  {
    admissionNo: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    photo: { type: String, default: null },
    gender: { type: String, default: null },
    dob: { type: Date, default: null },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    parentName: { type: String, default: null },
    parentPhone: { type: String, default: null },
    address: { type: String, default: null },
    classGrade: { type: String, default: null },
    courseId: ref('Course'),
    batchId: ref('Batch'),
    admissionDate: { type: Date, default: () => new Date() },
    monthlyFee: money(0),
    status: { type: String, enum: StudentStatus, default: 'ACTIVE' },
    userId: ref('User'),
  },
  baseOptions,
);
// Unique but nullable: a plain unique index would collide on every student without a login.
studentSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } });
studentSchema.index({ courseId: 1 });
studentSchema.index({ batchId: 1 });
studentSchema.index({ status: 1 });
studentSchema.index({ name: 1 });

const teacherSchema = new Schema(
  {
    employeeNo: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    photo: { type: String, default: null },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    specialization: { type: String, default: null },
    salary: money(0),
    joiningDate: { type: Date, default: () => new Date() },
    status: { type: String, enum: StudentStatus, default: 'ACTIVE' },
    userId: ref('User'),
  },
  baseOptions,
);
teacherSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } });

const courseSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    duration: { type: String, default: null },
    monthlyFee: money(0),
    admissionFee: money(0),
    isActive: { type: Boolean, default: true },
  },
  baseOptions,
);

const subjectSchema = new Schema(
  {
    name: { type: String, required: true },
    courseId: ref('Course'),
    teacherId: ref('Teacher'),
  },
  baseOptions,
);
subjectSchema.index({ courseId: 1 });

const batchSchema = new Schema(
  {
    name: { type: String, required: true },
    courseId: ref('Course'),
    teacherId: ref('Teacher'),
    capacity: { type: Number, default: 30 },
    startTime: { type: String, default: null },
    endTime: { type: String, default: null },
    days: { type: [String], default: [] },
    startDate: { type: Date, default: () => new Date() },
    isActive: { type: Boolean, default: true },
  },
  baseOptions,
);
batchSchema.index({ courseId: 1 });

const batchStudentSchema = new Schema(
  {
    batchId: { type: Types.ObjectId, ref: 'Batch', required: true },
    studentId: { type: Types.ObjectId, ref: 'Student', required: true },
    joinedAt: { type: Date, default: () => new Date() },
  },
  { ...baseOptions, timestamps: false },
);
batchStudentSchema.index({ batchId: 1, studentId: 1 }, { unique: true });
batchStudentSchema.index({ studentId: 1 });

const classScheduleSchema = new Schema(
  {
    batchId: ref('Batch'),
    teacherId: ref('Teacher'),
    subjectId: ref('Subject'),
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    room: { type: String, default: null },
    ...createdAtField,
  },
  { ...baseOptions, timestamps: false },
);
classScheduleSchema.index({ batchId: 1 });
classScheduleSchema.index({ teacherId: 1 });

const studentAttendanceSchema = new Schema(
  {
    studentId: { type: Types.ObjectId, ref: 'Student', required: true },
    batchId: ref('Batch'),
    date: { type: Date, required: true },
    status: { type: String, enum: AttendanceStatus, default: 'PRESENT' },
    remark: { type: String, default: null },
    ...createdAtField,
  },
  { ...baseOptions, timestamps: false },
);
studentAttendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });
studentAttendanceSchema.index({ batchId: 1, date: 1 });
studentAttendanceSchema.index({ date: 1 });

const teacherAttendanceSchema = new Schema(
  {
    teacherId: { type: Types.ObjectId, ref: 'Teacher', required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: AttendanceStatus, default: 'PRESENT' },
    remark: { type: String, default: null },
    ...createdAtField,
  },
  { ...baseOptions, timestamps: false },
);
teacherAttendanceSchema.index({ teacherId: 1, date: 1 }, { unique: true });
teacherAttendanceSchema.index({ date: 1 });

const feeRecordSchema = new Schema(
  {
    studentId: { type: Types.ObjectId, ref: 'Student', required: true },
    feeType: { type: String, required: true },
    period: { type: String, default: null },
    amount: money(0),
    discount: money(0),
    lateFee: money(0),
    dueDate: { type: Date, required: true },
    status: { type: String, enum: FeeStatus, default: 'PENDING' },
  },
  baseOptions,
);
feeRecordSchema.index({ studentId: 1 });
feeRecordSchema.index({ status: 1 });
feeRecordSchema.index({ dueDate: 1 });

const paymentSchema = new Schema(
  {
    receiptNo: { type: String, required: true, unique: true },
    studentId: { type: Types.ObjectId, ref: 'Student', required: true },
    feeRecordId: ref('FeeRecord'),
    amount: money(0),
    method: { type: String, enum: PaymentMethod, default: 'CASH' },
    paymentDate: { type: Date, default: () => new Date() },
    note: { type: String, default: null },
    receivedById: ref('User'),
    ...createdAtField,
  },
  { ...baseOptions, timestamps: false },
);
paymentSchema.index({ studentId: 1 });
paymentSchema.index({ paymentDate: 1 });

const examinationSchema = new Schema(
  {
    name: { type: String, required: true },
    courseId: ref('Course'),
    batchId: ref('Batch'),
    examDate: { type: Date, required: true },
    totalMarks: { type: Number, default: 100 },
    status: { type: String, enum: ExamStatus, default: 'SCHEDULED' },
  },
  baseOptions,
);
examinationSchema.index({ courseId: 1 });
examinationSchema.index({ examDate: 1 });

const examResultSchema = new Schema(
  {
    examinationId: { type: Types.ObjectId, ref: 'Examination', required: true },
    studentId: { type: Types.ObjectId, ref: 'Student', required: true },
    subjectId: ref('Subject'),
    marksObtained: money(0),
    grade: { type: String, default: null },
    remarks: { type: String, default: null },
    ...createdAtField,
  },
  { ...baseOptions, timestamps: false },
);
examResultSchema.index({ studentId: 1 });
examResultSchema.index(
  { examinationId: 1, studentId: 1, subjectId: 1 },
  { unique: true, partialFilterExpression: { subjectId: { $type: 'objectId' } } },
);

const notificationSchema = new Schema(
  {
    userId: { ...ref('User'), default: null },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: 'INFO' },
    link: { type: String, default: null },
    isRead: { type: Boolean, default: false },
    ...createdAtField,
  },
  { ...baseOptions, timestamps: false },
);
notificationSchema.index({ userId: 1, isRead: 1 });

const announcementSchema = new Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    audience: { type: String, default: 'ALL' },
    expiresAt: { type: Date, default: null },
    ...createdAtField,
  },
  { ...baseOptions, timestamps: false },
);

// Prisma forced this to a single row with id 1; a unique key does the same here.
const centerSettingsSchema = new Schema(
  {
    key: { type: Number, default: 1, unique: true },
    centerName: { type: String, default: 'Tuition Center' },
    logoUrl: { type: String, default: null },
    tagline: { type: String, default: null },
    address: { type: String, default: null },
    phone: { type: String, default: null },
    whatsapp: { type: String, default: null },
    email: { type: String, default: null },
    website: { type: String, default: null },
    academicSession: { type: String, default: '2026-27' },
    currency: { type: String, default: 'INR' },
    currencySymbol: { type: String, default: '₹' },
    notifyFeePending: { type: Boolean, default: true },
    notifyNewStudent: { type: Boolean, default: true },
    notifyExam: { type: Boolean, default: true },
  },
  baseOptions,
);

// Prisma's `include` gave every relation a named object on the row. Mongoose only knows
// about a relation when it is declared, so these virtuals recreate those exact names and
// let routes keep writing .populate('course') / .populate('payments').
const virtual = (schema, name, refModel, localField, foreignField, justOne = false) =>
  schema.virtual(name, { ref: refModel, localField, foreignField, justOne });

// Student
virtual(studentSchema, 'user', 'User', 'userId', '_id', true);
virtual(studentSchema, 'course', 'Course', 'courseId', '_id', true);
virtual(studentSchema, 'batch', 'Batch', 'batchId', '_id', true);
virtual(studentSchema, 'attendance', 'StudentAttendance', '_id', 'studentId');
virtual(studentSchema, 'feeRecords', 'FeeRecord', '_id', 'studentId');
virtual(studentSchema, 'payments', 'Payment', '_id', 'studentId');
virtual(studentSchema, 'examResults', 'ExamResult', '_id', 'studentId');
virtual(studentSchema, 'batchLinks', 'BatchStudent', '_id', 'studentId');

// Teacher
virtual(teacherSchema, 'user', 'User', 'userId', '_id', true);
virtual(teacherSchema, 'subjects', 'Subject', '_id', 'teacherId');
virtual(teacherSchema, 'batches', 'Batch', '_id', 'teacherId');
virtual(teacherSchema, 'schedules', 'ClassSchedule', '_id', 'teacherId');
virtual(teacherSchema, 'attendance', 'TeacherAttendance', '_id', 'teacherId');

// Course
virtual(courseSchema, 'subjects', 'Subject', '_id', 'courseId');
virtual(courseSchema, 'batches', 'Batch', '_id', 'courseId');
virtual(courseSchema, 'students', 'Student', '_id', 'courseId');
virtual(courseSchema, 'examinations', 'Examination', '_id', 'courseId');

// Subject
virtual(subjectSchema, 'course', 'Course', 'courseId', '_id', true);
virtual(subjectSchema, 'teacher', 'Teacher', 'teacherId', '_id', true);
virtual(subjectSchema, 'schedules', 'ClassSchedule', '_id', 'subjectId');
virtual(subjectSchema, 'examResults', 'ExamResult', '_id', 'subjectId');

// Batch
virtual(batchSchema, 'course', 'Course', 'courseId', '_id', true);
virtual(batchSchema, 'teacher', 'Teacher', 'teacherId', '_id', true);
virtual(batchSchema, 'students', 'Student', '_id', 'batchId');
virtual(batchSchema, 'studentLinks', 'BatchStudent', '_id', 'batchId');
virtual(batchSchema, 'schedules', 'ClassSchedule', '_id', 'batchId');
virtual(batchSchema, 'attendance', 'StudentAttendance', '_id', 'batchId');
virtual(batchSchema, 'examinations', 'Examination', '_id', 'batchId');

// Join, schedule and attendance rows
virtual(batchStudentSchema, 'batch', 'Batch', 'batchId', '_id', true);
virtual(batchStudentSchema, 'student', 'Student', 'studentId', '_id', true);
virtual(classScheduleSchema, 'batch', 'Batch', 'batchId', '_id', true);
virtual(classScheduleSchema, 'teacher', 'Teacher', 'teacherId', '_id', true);
virtual(classScheduleSchema, 'subject', 'Subject', 'subjectId', '_id', true);
virtual(studentAttendanceSchema, 'student', 'Student', 'studentId', '_id', true);
virtual(studentAttendanceSchema, 'batch', 'Batch', 'batchId', '_id', true);
virtual(teacherAttendanceSchema, 'teacher', 'Teacher', 'teacherId', '_id', true);

// Money
virtual(feeRecordSchema, 'student', 'Student', 'studentId', '_id', true);
virtual(feeRecordSchema, 'payments', 'Payment', '_id', 'feeRecordId');
virtual(paymentSchema, 'student', 'Student', 'studentId', '_id', true);
virtual(paymentSchema, 'feeRecord', 'FeeRecord', 'feeRecordId', '_id', true);
virtual(paymentSchema, 'receivedBy', 'User', 'receivedById', '_id', true);

// Exams
virtual(examinationSchema, 'course', 'Course', 'courseId', '_id', true);
virtual(examinationSchema, 'batch', 'Batch', 'batchId', '_id', true);
virtual(examinationSchema, 'results', 'ExamResult', '_id', 'examinationId');
virtual(examResultSchema, 'examination', 'Examination', 'examinationId', '_id', true);
virtual(examResultSchema, 'student', 'Student', 'studentId', '_id', true);
virtual(examResultSchema, 'subject', 'Subject', 'subjectId', '_id', true);

// Communication
virtual(notificationSchema, 'user', 'User', 'userId', '_id', true);

export const User = model('User', userSchema);
export const Student = model('Student', studentSchema);
export const Teacher = model('Teacher', teacherSchema);
export const Course = model('Course', courseSchema);
export const Subject = model('Subject', subjectSchema);
export const Batch = model('Batch', batchSchema);
export const BatchStudent = model('BatchStudent', batchStudentSchema);
export const ClassSchedule = model('ClassSchedule', classScheduleSchema);
export const StudentAttendance = model('StudentAttendance', studentAttendanceSchema);
export const TeacherAttendance = model('TeacherAttendance', teacherAttendanceSchema);
export const FeeRecord = model('FeeRecord', feeRecordSchema);
export const Payment = model('Payment', paymentSchema);
export const Examination = model('Examination', examinationSchema);
export const ExamResult = model('ExamResult', examResultSchema);
export const Notification = model('Notification', notificationSchema);
export const Announcement = model('Announcement', announcementSchema);
export const CenterSettings = model('CenterSettings', centerSettingsSchema);

export const db = {
  User,
  Student,
  Teacher,
  Course,
  Subject,
  Batch,
  BatchStudent,
  ClassSchedule,
  StudentAttendance,
  TeacherAttendance,
  FeeRecord,
  Payment,
  Examination,
  ExamResult,
  Notification,
  Announcement,
  CenterSettings,
};

export { mongoose, Types, Schema, oid, oidFromUuid, Role, StudentStatus, AttendanceStatus, FeeStatus, PaymentMethod, ExamStatus };

export async function connectDatabase() {
  if (!config.mongoUri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(config.mongoUri, {
    dbName: config.mongoDbName,
    serverSelectionTimeoutMS: 15000,
  });
  return mongoose.connection;
}
