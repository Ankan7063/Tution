import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { Notification } from '../models/index.js';

let transporter = null;
if (config.smtp.host && config.smtp.user) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
}

export async function createNotification({ userId = null, title, message, type = 'INFO', link = null }) {
  return Notification.create({ userId, title, message, type, link });
}

export async function notifyAdmins(payload) {
  return createNotification({ ...payload, userId: null });
}

export async function sendMail(to, subject, text) {
  if (!transporter) return false;
  try {
    await transporter.sendMail({ from: config.smtp.from, to, subject, text });
    return true;
  } catch (err) {
    console.error('Email send failed:', err.message);
    return false;
  }
}
