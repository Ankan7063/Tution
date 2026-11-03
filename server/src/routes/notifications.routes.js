import { Router } from 'express';
import { z } from 'zod';
import { Announcement, Notification, oid } from '../models/index.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/notifications', authenticate, async (req, res, next) => {
  try {
    const userId = oid(req.user.id);
    const rows = await Notification
      .find({ $or: [{ userId: null }, { userId }] })
      .sort({ createdAt: -1 })
      .limit(50);
    const unread = rows.filter((r) => !r.isRead).length;
    res.json({ rows, unread });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/read-all', authenticate, async (req, res, next) => {
  try {
    const userId = oid(req.user.id);
    await Notification.updateMany({ $or: [{ userId: null }, { userId }] }, { isRead: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
});

router.get('/announcements', async (req, res, next) => {
  try {
    const rows = await Announcement
      .find({ $or: [{ expiresAt: null }, { expiresAt: { $gte: new Date() } }] })
      .sort({ createdAt: -1 });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/announcements', authenticate, requirePermission('announcements:write'), validate(z.object({
  title: z.string().min(2),
  message: z.string().min(2),
  audience: z.enum(['ALL', 'STUDENTS', 'TEACHERS']).default('ALL'),
  expiresAt: z.coerce.date().optional(),
})), async (req, res, next) => {
  try {
    res.status(201).json(await Announcement.create(req.body));
  } catch (err) {
    next(err);
  }
});

router.delete('/announcements/:id', authenticate, requirePermission('announcements:write'), async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ message: 'Invalid id' });
    await Announcement.deleteOne({ _id });
    res.json({ message: 'Announcement deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
