import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { modeData, variabelKurang } from "./mode";

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

/**
 * Mode data yang sedang berjalan — lihat `mode.ts` soal mengapa data contoh
 * kini harus diizinkan, bukan sekadar terjadi.
 */
export const MODE_DATA = modeData({
  dbAktif: dbEnabled,
  pengembangan: process.env.NODE_ENV !== "production",
  demoDiizinkan: process.env.GWG_DEMO === "1",
});

/** Nama variabel yang belum terisi — dipakai halaman penjaga. Tanpa nilainya. */
export const VARIABEL_KURANG = variabelKurang({
  GWG_SUPABASE_URL: process.env.GWG_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  GWG_SUPABASE_KEY: process.env.GWG_SUPABASE_KEY,
});

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    client = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}
