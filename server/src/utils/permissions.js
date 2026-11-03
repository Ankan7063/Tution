import { Batch, Teacher } from '../models/index.js';

// One flat list of capabilities. Every protected endpoint names the capability it needs and
// every role owns a set of them, so a permission check reads the same everywhere.
export const PERMISSIONS = {
  'dashboard:read': 'View the dashboard',
  'students:read': 'View student records',
  'students:write': 'Add and edit students',
  'students:delete': 'Delete students',
  'teachers:read': 'View teacher records',
  'teachers:write': 'Add and edit teachers',
  'courses:read': 'View courses',
  'courses:write': 'Add and edit courses',
  'batches:read': 'View batches',
  'batches:write': 'Add and edit batches',
  'attendance:read': 'View attendance',
  'attendance:write': 'Mark attendance',
  'exams:read': 'View exams and results',
  'exams:write': 'Create exams and enter results',
  'fees:read': 'View fee dues, amounts paid and payment history',
  'fees:write': 'Create, generate and delete fee records',
  'payments:record': 'Collect a payment and issue a receipt',
  'payments:delete': 'Delete a payment',
  'reports:read': 'View reports and analytics',
  'announcements:write': 'Post and remove centre announcements',
  'settings:manage': 'Change centre settings',
  'users:manage': 'Create accounts, assign roles and reset passwords',
};

const ALL = Object.keys(PERMISSIONS);

export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: ALL,
  ADMIN: ALL,
  // Academic only: a teacher never receives fee, payment or salary data.
  TEACHER: [
    'dashboard:read', 'students:read', 'teachers:read', 'courses:read', 'batches:read',
    'attendance:read', 'attendance:write', 'exams:read', 'reports:read',
  ],
  // Front desk: admissions and records work. Fee collection is granted per person, never by role.
  STAFF: [
    'dashboard:read', 'students:read', 'students:write', 'teachers:read', 'courses:read',
    'batches:read', 'attendance:read',
  ],
};

export const ROLE_LABELS = {
  SUPER_ADMIN: 'Admin',
  ADMIN: 'Admin',
  TEACHER: 'Teacher',
  STAFF: 'Staff',
  STUDENT: 'Student',
};

// Extra capabilities an admin grants to one account on top of its role.
export function permissionsFor(user) {
  if (!user) return [];
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return ALL;
  const base = ROLE_PERMISSIONS[user.role] || [];
  const granted = Array.isArray(user.permissions) ? user.permissions.filter((p) => p in PERMISSIONS) : [];
  return [...new Set([...base, ...granted])];
}

export const can = (user, permission) => permissionsFor(user).includes(permission);

const FINANCIAL_KEYS = [
  'monthlyFee', 'admissionFee', 'salary', 'amount', 'discount', 'lateFee', 'dueDate',
  'feeType', 'period', 'receiptNo', 'paymentDate', 'method', 'receivedBy', 'feeRecordId',
  'feeRecords', 'payments', 'feeRecord', 'totalDue', 'totalPaid', 'pending', 'paid',
  'monthlyCollected', 'totalCollected', 'pendingFeesCount', 'monthlyRevenue', 'recentPayments',
];

// Belt-and-braces: whatever a route forgets to strip, money never leaves the API for a
// non-financial role. Students are exempt because their own portal shows their own dues.
export function scrub(value, depth = 0) {
  if (depth > 8 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (FINANCIAL_KEYS.includes(key)) continue;
    out[key] = scrub(val, depth + 1);
  }
  return out;
}

export function hidesFinancials(user) {
  return (user.role === 'TEACHER' || user.role === 'STAFF') && !can(user, 'fees:read');
}

// Ids of the batches a teacher is responsible for; null means "not scoped" (admins, staff).
export async function assignedBatchIds(user) {
  if (user.role !== 'TEACHER') return null;
  const teacher = await Teacher.findOne({ userId: user._id });
  if (!teacher) return [];
  const batches = await Batch.find({ teacherId: teacher._id }).select('_id').lean();
  return batches.map((b) => String(b._id));
}

export const teachesBatch = async (user, batchId) => {
  const ids = await assignedBatchIds(user);
  return ids === null || ids.includes(String(batchId));
};
