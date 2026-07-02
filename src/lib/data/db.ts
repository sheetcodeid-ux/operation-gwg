import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client for the DATA layer (persistence).
 *
 * Deliberately separate from `lib/supabase/*` (which keys off NEXT_PUBLIC_*
 * and switches the app's AUTH mode). These env vars never reach the browser.
 * When unset, the app runs in pure in-memory demo mode exactly as before.
 */
const url = process.env.GWG_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.GWG_SUPABASE_KEY;

export const dbEnabled = Boolean(url && key);

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    client = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}
