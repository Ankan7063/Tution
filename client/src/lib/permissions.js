// The server sends the capability list with the session (login and /auth/me). The UI reads it
// from here and never re-derives it from the role, so a revoked grant disappears on the next
// request. This is presentation only — every endpoint checks the same capability again.
export const can = (user, permission) => Array.isArray(user?.permissions) && user.permissions.includes(permission);

export const isAdminUser = (user) => user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
