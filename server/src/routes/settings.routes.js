import { Router } from 'express';
import { z } from 'zod';
import { CenterSettings } from '../models/index.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const settingsSchema = z.object({
  centerName: z.string().min(2).optional(),
  logoUrl: z.string().optional().nullable(),
  tagline: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  website: z.string().optional().nullable(),
  academicSession: z.string().optional(),
  currency: z.string().optional(),
  currencySymbol: z.string().optional(),
  notifyFeePending: z.coerce.boolean().optional(),
  notifyNewStudent: z.coerce.boolean().optional(),
  notifyExam: z.coerce.boolean().optional(),
});

// Public — used by the public website and contact buttons
router.get('/', async (req, res, next) => {
  try {
    const settings = await CenterSettings.findOne({ key: 1 });
    res.json(settings || {});
  } catch (err) {
    next(err);
  }
});

router.put('/', authenticate, requirePermission('settings:manage'), validate(settingsSchema), async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.email === '') data.email = null;
    const settings = await CenterSettings.findOneAndUpdate(
      { key: 1 },
      { $set: data },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

export default router;
