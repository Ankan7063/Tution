import { oid } from '../models/index.js';

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

export function escapeRegex(value) {
  return String(value).replace(REGEX_SPECIAL, '\\$&');
}

export function contains(value, { insensitive = false } = {}) {
  const filter = { $regex: escapeRegex(value) };
  if (insensitive) filter.$options = 'i';
  return filter;
}

export function startsWith(value) {
  return { $regex: `^${escapeRegex(value)}` };
}

// A projected relation carries exactly the columns this API has always returned for it.
export function pick(value, fields) {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map((item) => pick(item, fields));
  const row = typeof value.toJSON === 'function' ? value.toJSON() : value;
  const projected = {};
  for (const field of fields) projected[field] = row[field] ?? null;
  return projected;
}

// Filter ids: missing or empty means no filter, an unusable value fails the whole request.
export function castIds(source, fields) {
  const cast = {};
  for (const field of fields) {
    const raw = source[field];
    if (raw === undefined || raw === null || raw === '') continue;
    const value = oid(raw);
    if (!value) return null;
    cast[field] = value;
  }
  return cast;
}

// Write ids: an empty value clears the link, anything else has to be a real id.
export function applyIds(source, fields) {
  const cast = {};
  for (const field of fields) {
    const raw = source[field];
    if (raw === undefined) continue;
    if (raw === null || raw === '') {
      cast[field] = null;
      continue;
    }
    const value = oid(raw);
    if (!value) return null;
    cast[field] = value;
  }
  const data = { ...source };
  for (const field of fields) delete data[field];
  return { ...data, ...cast };
}
