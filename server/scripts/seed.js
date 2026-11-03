// Demo data for a fresh database.
//
//   node scripts/seed.js --export   dump the connected database into scripts/seed-data.json
//   node scripts/seed.js            load seed-data.json into empty collections
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { db, connectDatabase, mongoose, Types } from '../src/models/index.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const dataFile = `${here}seed-data.json`;
const HEX_ID = /^[0-9a-f]{24}$/;

const DEMO_PASSWORDS = {
  SUPER_ADMIN: 'Admin@123',
  ADMIN: 'Admin@123',
  TEACHER: 'Teacher@123',
  STUDENT: 'Student@123',
};

// Order only affects readability; relations are resolved by stored ids.
const ORDER = [
  'User', 'Course', 'Teacher', 'Subject', 'Batch', 'BatchStudent', 'ClassSchedule',
  'Student', 'StudentAttendance', 'TeacherAttendance', 'FeeRecord', 'Payment',
  'Examination', 'ExamResult', 'Notification', 'Announcement', 'CenterSettings',
];

const toObjectIdStrings = (v) => JSON.stringify(
  v,
  (_k, val) => (val && typeof val === 'object' && val._bsontype === 'ObjectId' ? String(val) : val),
  2,
);

// Any *_id / Id field holding a 24-char hex string is a reference.
const hydrate = (doc) => Object.fromEntries(
  Object.entries(doc).map(([k, v]) => [
    k,
    (/_id$|Id$/.test(k) && typeof v === 'string' && HEX_ID.test(v)) ? new Types.ObjectId(v) : v,
  ]),
);

await connectDatabase();

if (process.argv.includes('--export')) {
  const out = {};
  for (const name of ORDER) {
    const rows = await db[name].find({}).lean();
    out[name] = rows.map(({ _id, passwordHash, ...rest }) => ({ _id: String(_id), ...rest }));
    console.log(`exported ${name.padEnd(18)} ${out[name].length}`);
  }
  writeFileSync(dataFile, toObjectIdStrings(out));
  console.log(`Wrote ${dataFile} (password hashes excluded)`);
  await mongoose.disconnect();
  process.exit(0);
}

const data = JSON.parse(readFileSync(dataFile, 'utf8'));
let inserted = 0;
for (const name of ORDER) {
  const Model = db[name];
  const existing = await Model.countDocuments({});
  if (existing) {
    console.log(`skip ${name.padEnd(18)} already has ${existing} documents`);
    continue;
  }
  let docs = (data[name] || []).map(hydrate);
  // The dump has no hashes; seed the same demo credentials the old Prisma seed used.
  if (name === 'User') {
    docs = await Promise.all(docs.map(async (u) => ({
      ...u,
      passwordHash: await bcrypt.hash(DEMO_PASSWORDS[u.role] || 'Admin@123', 12),
    })));
  }
  if (docs.length) await Model.insertMany(docs, { ordered: false });
  inserted += docs.length;
  console.log(`seeded ${name.padEnd(18)} ${docs.length}`);
}
console.log(inserted ? `Seeded ${inserted} documents into "${mongoose.connection.name}".` : 'Nothing to seed.');
await mongoose.disconnect();
