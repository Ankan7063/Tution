import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { config } from './config.js';
import { errorHandler } from './middleware/validate.js';

import authRoutes from './routes/auth.routes.js';
import studentRoutes from './routes/students.routes.js';
import teacherRoutes from './routes/teachers.routes.js';
import courseRoutes from './routes/courses.routes.js';
import batchRoutes from './routes/batches.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import feeRoutes from './routes/fees.routes.js';
import examRoutes from './routes/exams.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import reportRoutes from './routes/reports.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import notificationRoutes from './routes/notifications.routes.js';

export function createApp() {
  const app = express();

  // Render terminates TLS in front of the app, so the rate limiter must read X-Forwarded-For.
  app.set('trust proxy', 1);

  // CLIENT_URL may be a single origin or a comma-separated list. Trailing slashes are
  // stripped because the browser sends an Origin without one, and an exact-match list
  // would silently reject it — the request succeeds server-side but CORS-blocks in the
  // browser, which the SPA reports as a network error.
  const origins = new Set([
    ...String(config.clientUrl || '').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean),
    'http://localhost:4173', 'http://localhost:5001', 'http://localhost:5173',
  ]);
  // Vercel/Render give each deploy its own hostname, so their app domains are accepted
  // whatever the env var says.
  const hostedRe = /^https:\/\/([\w-]+\.)*(vercel\.app|onrender\.com)$/;
  app.use(cors({
    credentials: true,
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl, health checks, same-origin server calls
      cb(null, hostedRe.test(origin) || origins.has(origin));
    },
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('dev'));

  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
  app.use('/api', limiter);
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
  app.use('/api/auth', authLimiter);

  app.get('/api/health', (req, res) => res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'up' : 'down' }));
  app.use('/api/auth', authRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/teachers', teacherRoutes);
  app.use('/api', courseRoutes);
  app.use('/api/batches', batchRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/fees', feeRoutes);
  app.use('/api', examRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api', notificationRoutes);

  app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
  app.use(errorHandler);

  return app;
}
