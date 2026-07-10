import { createClient } from '@supabase/supabase-js';

// Service-role Supabase client — bypasses RLS. Server-only. NEVER import from the
// browser. Used by the Stripe webhook to write subscription state to `profiles`.
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
