import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User, oid } from '../models/index.js';

export function signToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const payload = jwt.verify(token, config.jwtSecret);
    const _id = oid(payload.sub);
    if (!_id) return res.status(401).json({ message: 'Invalid or expired token' });
    const user = await User.findOne({ _id });
    if (!user || !user.isActive) return res.status(401).json({ message: 'Invalid or disabled account' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission for this action' });
    }
    next();
  };
}

export const isStaff = authorize('SUPER_ADMIN', 'ADMIN');
export const isAdmin = authorize('SUPER_ADMIN');
