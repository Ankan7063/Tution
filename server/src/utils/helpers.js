import { Payment, Student } from '../models/index.js';

export async function nextReceiptNo() {
  const year = new Date().getFullYear();
  const prefix = `RCP-${year}-`;
  const last = await Payment.findOne({ receiptNo: { $regex: `^${prefix}` } }).sort({ receiptNo: -1 });
  const seq = last ? parseInt(last.receiptNo.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(5, '0')}`;
}

export async function nextAdmissionNo() {
  const year = new Date().getFullYear();
  const prefix = `ADM-${year}-`;
  const last = await Student.findOne({ admissionNo: { $regex: `^${prefix}` } }).sort({ admissionNo: -1 });
  const seq = last ? parseInt(last.admissionNo.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

export function gradeFor(marks, total) {
  if (!total || total <= 0) return null;
  const pct = (Number(marks) / total) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Attendance, due, exam and notice dates were DATE columns under Postgres, which truncated
// them to the UTC calendar day. Mongo keeps the exact instant, so those fields are compared
// and written as UTC midnights to stay on the same day the stored rows use.
export function utcDay(d = new Date()) {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}
