// Admin allowlist — who can see /admin analytics. Kept tiny and explicit.
export const ADMIN_EMAILS = new Set([
  'lohokur123@gmail.com',
  'byloho@gmail.com',
  'loho@lohokur.com',
]);

export const isAdmin = (email?: string | null): boolean =>
  !!email && ADMIN_EMAILS.has(email.toLowerCase());
