-- Operational V.1 · TASK #88B Gate I-A — mengunci `app_config`.
--
-- ┌─ KENAPA SEKARANG ────────────────────────────────────────────────────────┐
-- │                                                                          │
-- │ `app_config` menyimpan token cron DAN, sejak Gate H, penanda sampai      │
-- │ bulan mana deteksi Signal pernah tuntas. Hibah tabelnya masih warisan    │
-- │ lama: `anon` dan `authenticated` memegang arwdDxtm penuh, dan yang       │
-- │ menahan mereka cuma RLS tanpa policy.                                    │
-- │                                                                          │
-- │ Pagar itu benar, tapi ia satu lapis. Satu policy yang tidak sengaja      │
-- │ dibuat di sana akan langsung membuka token cron kepada siapa pun yang    │
-- │ memegang kunci publik. `signals` sudah dicabut habis sejak lahir         │
-- │ (`0111`); tabel ini menyusul.                                            │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Tidak ada konsumen sah yang terputus: `db()` memakai SUPABASE_SERVICE_ROLE_KEY,
-- dan seluruh pembaca `app_config` — `cron-auth.ts`, `signals.ts`,
-- `kejar-seasonal.ts`, `esb-menu.ts` — lewat `app-config.ts` yang ber-`server-only`.
-- Nol komponen klien menyentuhnya.
--
-- HANYA pencabutan hak. Tidak ada GRANT baru, tidak ada policy, RLS tidak
-- disentuh, isi tabelnya tidak dibaca maupun diubah, tidak ada token yang
-- dirotasi, tidak ada skema yang bergerak.

revoke all on table public.app_config from anon;
revoke all on table public.app_config from authenticated;
