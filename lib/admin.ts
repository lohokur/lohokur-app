// Admin allowlist — who can see /admin analytics. Kept tiny and explicit.
export const ADMIN_EMAILS = new Set([
  'lohokur123@gmail.com',
  'byloho@gmail.com',
  'charlesoverend19@gmail.com',
  'juniork2030@gmail.com',
]);

// Never-metered owners — unlimited generations, no cap. A SUBSET of admins: being
// an admin (analytics access) does NOT grant unlimited generations on its own.
export const UNLIMITED_EMAILS = new Set([
  'lohokur123@gmail.com',
  'byloho@gmail.com',
  'charlesoverend19@gmail.com', // unlimited generations
]);

// Per-account tier overrides (no DB write needed). Forces the plan/cap for a given
// email everywhere — metering + the resolved entitlements shown to the client.
export const TIER_BY_EMAIL: Record<string, string> = {
  'charlesoverend19@gmail.com': 'brand', // admin + UNLIMITED gens; Max tier for entitlements/display
  'juniork2030@gmail.com': 'studio',     // admin, capped like Starter (~25 gens)
};

const norm = (email?: string | null) => email?.toLowerCase() ?? '';

export const isAdmin = (email?: string | null): boolean => ADMIN_EMAILS.has(norm(email));
export const isUnlimited = (email?: string | null): boolean => UNLIMITED_EMAILS.has(norm(email));
export const tierOverrideFor = (email?: string | null): string | undefined => TIER_BY_EMAIL[norm(email)];
