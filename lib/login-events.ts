import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Increment a user's lifetime login counter, stored in auth user_metadata so it
// needs no schema/RLS work and shows up in admin.auth.admin.listUsers().
// Called once per genuine sign-in (OAuth callback + password sign-in) — token
// refreshes and page loads do NOT pass through here, so it never over-counts.
export async function recordLogin(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const admin = supabaseAdmin();
    const { data } = await admin.auth.admin.getUserById(userId);
    const md = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
    const prev = typeof md.login_count === 'number' ? md.login_count : 0;
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: { ...md, login_count: prev + 1, last_login_at: new Date().toISOString() },
    });
  } catch {
    // analytics must never block a login
  }
}
