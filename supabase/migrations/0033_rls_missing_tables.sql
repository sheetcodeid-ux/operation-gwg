-- Operation GWG — aktifkan RLS pada tabel yang terlewat.
--
-- Konteks: migrasi 0004 mengunci semua tabel yang ada saat itu. Enam tabel yang
-- dibuat SESUDAHNYA tidak pernah ikut dikunci, sehingga bisa dibaca DAN ditulis
-- oleh peran `anon` lewat PostgREST — termasuk `op_pnl` (laba rugi per outlet)
-- dan `hpp_competitor_prices`. Kunci anon saat ini memang tidak dikirim ke
-- browser, jadi belum ada yang bisa menyalahgunakannya dari luar, tapi pagarnya
-- memang bolong dan tidak boleh dibiarkan.
--
-- Seluruh akses aplikasi memakai kunci service-role yang MELEWATI RLS, jadi
-- mengaktifkan ini tidak mengubah perilaku aplikasi sama sekali. Tanpa policy,
-- anon/authenticated ditolak secara bawaan — persis seperti 55 tabel lainnya.

alter table public.op_pnl                enable row level security;
alter table public.hpp_competitor_prices enable row level security;
alter table public.ops_kpi_manual        enable row level security;
alter table public.ops_kpi_weights       enable row level security;
alter table public.org_division_groups   enable row level security;
alter table public.assessment_blocked    enable row level security;
