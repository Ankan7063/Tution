# Tuition Center Management System

Full-stack system for running a coaching centre / tuition centre: a public marketing
website, a staff admin dashboard, and a student portal.

- **Frontend** — React 18, Vite 6, Tailwind CSS 3, react-router-dom 6, Recharts, lucide-react, axios
- **Backend** — Node + Express (ESM), JWT auth, bcrypt password hashing, zod request validation, PDFKit receipts with QR codes
- **Database** — MongoDB Atlas (Mongoose 8)

## Features

| Area | What it does |
| --- | --- |
| Public site | Home, About, Courses, Teachers, Contact with WhatsApp / click-to-call / email links taken from settings |
| Dashboard | Counters, fee-collection trend, batch and attendance charts |
| Students | Search/filter list, new admission form, profile with course, batch, fees, attendance and results |
| Teachers | Profiles, subject assignment, salary records |
| Courses & subjects | Courses with subjects and assigned teacher |
| Batches | Batch roster, schedule, multi-student links |
| Attendance | Daily student roster per batch (Present / Absent / Late / Leave) with bulk save, teacher attendance, monthly history |
| Fees | Fee records, monthly generation for a billing period, partial payments, overdue filter, payment history, downloadable PDF receipt with QR |
| Exams | Exams per course/batch, marks entry per subject, ranked result tables, publish to student portal |
| Reports | Fee, collection, attendance, student, teacher and exam reports with CSV export and print |
| Announcements | Broadcast notices scoped to all / students / teachers |
| Notifications | In-app notification bell |
| Settings | Centre profile (name, contact, currency, session), notification toggles, staff accounts, change password |

Light and dark mode throughout; fully responsive.

## Prerequisites

- Node.js 18 or newer
- A MongoDB Atlas cluster, with your current IP (and later Render's IPs) added under
  **Security → Network Access**

## Setup

```bash
# 1. environment
cp server/.env.example server/.env       # then edit MONGODB_URI and JWT_SECRET

# 2. install dependencies
cd server  && npm install && cd ..
cd client  && npm install && cd ..

# 3. collections + demo data
cd server
npm run db:seed                          # inserts into empty collections only
```

`MONGODB_URI` is the Atlas connection string; `MONGODB_DB` (default `Tution`) is the
database name. `JWT_SECRET` should be a long random string:
`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

`npm run db:seed` loads the demo dataset from `server/scripts/seed-data.json` and re-hashes
the demo passwords, so no credentials live in the JSON. Skip it for an empty centre — the
first run of the API creates indexes automatically.

## Demo accounts

| Role | Email | Password | Sign in at |
| --- | --- | --- | --- |
| Admin (super) | `admin@tuitioncenter.com` | `Admin@123` | `/admin/login` |
| Teacher | `teacher@tuitioncenter.com` | `Teacher@123` | `/admin/login` |
| Staff | `staff@tuitioncenter.com` | `Staff@123` | `/admin/login` |
| Student | `student@tuitioncenter.com` | `Student@123` | `/login` |

The dataset also carries 20 students, 3 teachers, 4 courses, 3 batches, 600 attendance
rows, 60 fee records with 44 payments and 2 exams.

## Self-service auth

- **Students can register themselves** at `/register` (name, email, password + optional
  phone/class/parent/course). A `Student` record with the next admission number and a
  `STUDENT` login are created together and the student lands in the portal. Admins get a
  "New student registration" notification. Staff accounts are still created only by admins.
- **Anyone can reset a forgotten password** at `/forgot-password` — admin, teacher or
  student. A 6-digit code (10-minute validity, 5 attempts) is emailed when SMTP is
  configured; with SMTP unset (demo setups) the code is shown on screen as `demoCode`.

## Running

Two processes, in two terminals:

```bash
cd server && npm run dev     # API on https://tution-29l5.onrender.com
cd client && npm run dev     # site on http://localhost:5173
```

Vite proxies `/api` to `https://tution-29l5.onrender.com`, so if you change `PORT` in
`server/.env` change the proxy target in `client/vite.config.js` too.



### Production build

```bash
cd client && npm run build        # outputs client/dist
cd server && npm start            # serve the API
```

## Deploying (Vercel + Render + Atlas)

The client and server deploy separately; they only meet over `/api` and Atlas.

**1. MongoDB Atlas** — create the cluster, then under Network Access allow:
- your own IP (public IP changes often on residential connections — use `0.0.0.0/0` only if
  you accept the risk, or use an Atlas IP Access List entry per office), and
- Render's egress addresses for the region you pick (listed on the service's **Info** page).

**2. Backend on Render** — this repo ships `render.yaml` (Blueprint). Create a **New
→ Blueprint** in your Render dashboard, point it at this private repo and it will offer the
`tuition-center-api` web service with root directory `server`. Fill in the two
`sync: false` values in the dashboard, never in git:

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | your Atlas connection string |
| `CLIENT_URL` | the Vercel origin, e.g. `https://your-app.vercel.app` (comma-separated list allowed) |
| `JWT_SECRET` | generated by the blueprint |

`MONGODB_DB`, `JWT_EXPIRES_IN` and the optional `SMTP_*` block are also read from the
environment. `GET /api/health` reports `{ status, db }` and is the configured health check.

**3. Frontend on Vercel** — import the repo, set **Root Directory** to `client`;
`client/vercel.json` supplies the Vite build settings and the SPA rewrite. Add one
environment variable:

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | `https://tuition-center-api.onrender.com` (no trailing `/api`) |

Left unset, the client talks to `/api` on its own origin, which is what the local Vite
proxy and a single-origin deployment rely on. Because `VITE_*` values are baked in at build
time, redeploy after changing it.

**4. Point the two at each other** — the API's CORS allow-list comes from `CLIENT_URL`, so
a Vercel preview URL you want to test against needs adding there too.

## Project layout

```
tuition-center/
├── render.yaml                        # Render Blueprint for the API service
├── client/
│   ├── index.html, vite.config.js, tailwind.config.js, vercel.json
│   └── src/
│       ├── main.jsx, App.jsx          # router entry + guarded route tree
│       ├── api/client.js              # axios instance, Bearer token, 401 -> /login
│       ├── context/AppContext.jsx     # session, settings, dark mode, money() and waLink()
│       ├── components/                # ui.jsx (Modal/Toast/Badge/...), AdminLayout, PublicLayout
│       └── pages/
│           ├── public/                # Home, StaticPages, Login (also used for /admin/login)
│           ├── admin/                 # Dashboard, Students, Teachers, Courses, Batches,
│           │                          # Attendance, Exams, Fees, Reports, Announcements, Settings
│           └── portal/StudentPortal.jsx
└── server/
    ├── scripts/seed.js                # loads/re-exports the demo dataset
    └── src/
        ├── index.js, app.js, config.js
        ├── models/index.js            # Mongoose schemas, populate virtuals, connect helper
        ├── middleware/                # auth.js (JWT + roles), validate.js (zod + error handler)
        ├── routes/                    # one file per resource, mounted in app.js
        └── utils/                     # PDF receipt + QR generation, notifications
```

## Roles

Access is capability-based: `server/src/utils/permissions.js` holds the catalogue (`students:read`,
`fees:read`, `payments:record`, `users:manage`, …), the base set for each role, and any extra
per-account grants an admin ticks on. `client/src/lib/permissions.js` mirrors the same strings, so
a button, a nav entry and the API guard always ask for the *same* capability.

- **SUPER_ADMIN / ADMIN** — every capability: all modules, CRUD, attendance, fees, payments,
  payment history, receipts, financial reports, expenses in Reports, user accounts, role
  assignment, password resets and Settings.
- **TEACHER** — dashboard, their assigned batches and the students inside them, marking
  attendance for those students, exams and academic reports. Fee status, amounts paid, pending
  dues, payment history, revenue reports, expenses, other people's records, accounts and Settings
  are refused by the API with `403`, and money fields are stripped from any response a teacher
  could otherwise reach (`scrub()` in `permissions.js`, plus per-query omission in `/dashboard/stats`).
- **STAFF** — front-office work: read and edit students, read teachers/courses/batches and the
  attendance register. No financial capability by default; an admin can grant `fees:read` and
  `payments:record` to a specific collections clerk. Full financial reporting stays with Admin.
- **STUDENT** — redirected to `/portal`, which shows only their own attendance, fees and
  published results. The student flow is unchanged.

Accounts are only ever created, re-roled or reset from **Admin → User Accounts**
(`users:manage`), which POSTs to `/api/auth/users` and PATCHes `/api/auth/users/:id`. Passwords
are bcrypt hashes (cost 12), never returned by any endpoint, never logged, and an admin-set new
password is not echoed back. `authenticate` re-reads the account on every request, so a revoked
role, a removed grant or a deactivation takes effect on the very next call.

The client guard (`RequireStaff`, `RequirePermission` in `client/src/App.jsx`) sends a student to
`/portal` and bounces any hand-typed admin URL the session cannot serve back to the dashboard;
the same limits are enforced on the server, so bypassing the UI still returns `403`.

## Printing and exporting

Every Print / Download CSV button builds a stand-alone A4 document (`client/src/lib/reports.js`)
and hands it to the browser through a hidden `srcdoc` iframe — the page's sidebar, navbar, buttons
and footer are structurally unable to appear in the print preview or the saved PDF. Each report
carries a title, the centre name, the active filters (batch, date, month, tab) and the signer, and
exports exactly the rows the table is showing: tick a subset and only those rows leave. CSVs are
BOM-prefixed for Excel and named `<report>-<filter>-<date>.csv`; receipt PDFs are fetched with the
bearer token, so they keep working for signed-in users only.

## Notes

- Money amounts are formatted with the currency and symbol from **Settings**, so the
  dashboard, receipts and reports follow whatever centre profile you fill in.
- Email notifications are optional; without `SMTP_*` set, in-app notifications and
  WhatsApp links still work and mail sending is skipped.
- Receipts are generated on demand at `GET /api/fees/payments/:id/receipt.pdf`.
- IDs are Mongo ObjectIds serialised as `id` in every API response; the client never
  references `_id`.
- A Render free instance sleeps after inactivity, so the first request after a gap can take
  ~50 seconds — the health check endpoint is the cheapest way to warm it.
