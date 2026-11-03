import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User, oid } from '../models/index.js';
import { can, hidesFinancials, scrub } from '../utils/permissions.js';

export function signToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

const bearerToken = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

function hideFinancialResponses(req, res, user) {
  if (!hidesFinancials(user)) return;
  const send = res.json.bind(res);
  res.json = (body) => send(scrub(body));
}

export async function authenticate(req, res, next) {
  try {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const payload = jwt.verify(token, config.jwtSecret);
    const _id = oid(payload.sub);
    if (!_id) return res.status(401).json({ message: 'Invalid or expired token' });
    const user = await User.findOne({ _id });
    if (!user || !user.isActive) return res.status(401).json({ message: 'Invalid or disabled account' });
    req.user = user;
    hideFinancialResponses(req, res, user);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// For endpoints that stay public (the website course list) but must not leak fee columns to
// a signed-in teacher or staff member.
export async function attachIdentity(req, res, next) {
  const token = bearerToken(req);
  if (token) {
    try {
      const _id = oid(jwt.verify(token, config.jwtSecret).sub);
      const user = _id && await User.findOne({ _id });
      if (user?.isActive) {
        req.user = user;
        hideFinancialResponses(req, res, user);
      }
    } catch { /* an anonymous visitor keeps the public view */ }
  }
  next();
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

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    if (!can(req.user, permission)) {
      return res.status(403).json({ message: 'Your role does not allow this action' });
    }
    next();
  };
}

export const isStaff = authorize('SUPER_ADMIN', 'ADMIN');
export const isAdmin = authorize('SUPER_ADMIN');
