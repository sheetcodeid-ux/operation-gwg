-- Operational V.1 · TASK #85A — menutup periode yang bulannya sudah habis.
--
-- ┌─ FINALISASI ADALAH PERPINDAHAN KEADAAN, BUKAN PERHITUNGAN ULANG ─────────┐
-- │                                                                          │
-- │ Yang berubah HANYA `status`. Tidak ada rumus yang dijalankan, tidak ada  │
-- │ `nilai` yang disentuh, tidak ada versi baru yang dilahirkan, tidak ada   │
-- │ baris yang disisipkan atau dihapus.                                      │
-- │                                                                          │
-- │   versi 1 · terkini · sementara   →   versi 1 · terkini · FINAL          │
-- │                                                                          │
-- │ BUKAN versi 2. Sebuah bulan yang ditutup bukan bulan yang dihitung ulang;│
-- │ melahirkan versi baru untuknya berarti riwayat versi berisi dua baris    │
-- │ yang angkanya sama persis, dan yang membacanya akan mencari perbedaan    │
-- │ yang tidak pernah ada.                                                   │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ `tidak_tersedia` TIDAK IKUT JADI FINAL ─────────────────────────────────┐
-- │                                                                          │
-- │ Hanya `sementara` yang berpindah. `tidak_tersedia` dan `invalid`         │
-- │ dibiarkan apa adanya, dan itu justru yang membuat kalimatnya utuh:       │
-- │ "bulannya sudah ditutup, dan KPI ini memang tidak ada angkanya."         │
-- │                                                                          │
-- │ Menjadikannya final berarti mengklaim Platform Fee September adalah      │
-- │ angka yang sudah pasti — padahal kolomnya memang belum pernah diisi.     │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- BULAN BERJALAN DISEBUT PEMANGGIL, tidak dihitung di sini. Basis datanya
-- berjalan di UTC sementara perusahaan ini WIB; 1 Oktober pukul 00.30 WIB masih
-- 30 September menurut UTC, dan bulan yang ditentukan di sini akan salah selama
-- tujuh jam tiap pergantian bulan. Satu-satunya yang tahu bulan WIB adalah
-- `periodeBerjalan()` di `src/lib/ops/finalisasi.ts`.

create or replace function public.gwg_finalisasi_kpi_bulanan(p_bulan_berjalan text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_periode      text;
  v_diperiksa    text[] := '{}';
  v_difinalisasi text[] := '{}';
  v_baris        integer := 0;
  v_n            integer;
begin
  if p_bulan_berjalan !~ '^\d{4}-\d{2}$' then
    raise exception 'bulan berjalan harus berbentuk YYYY-MM, bukan %', p_bulan_berjalan;
  end if;

  -- Yang DIPERIKSA hanya periode yang benar-benar punya baris `sementara` yang
  -- terkini. Periode yang seluruhnya `final` atau `tidak_tersedia` tidak pernah
  -- masuk daftar — Agustus 2026 termasuk, dan itu bukan pengecualian yang
  -- ditulis tangan melainkan akibat langsung dari saringan ini.
  for v_periode in
    select distinct periode
    from kpi_values
    where skala = 'bulanan' and terkini and status = 'sementara'
    order by 1
  loop
    v_diperiksa := v_diperiksa || v_periode;

    -- Bulan yang belum habis dilewati. Ia tetap disebut dalam laporan supaya
    -- "diperiksa dan belum waktunya" bisa dibedakan dari "tidak pernah dilihat".
    if v_periode < p_bulan_berjalan then
      -- Kunci yang SAMA dengan yang dipakai `gwg_tulis_kpi_bulanan`, supaya
      -- menulis dan menutup periode yang sama tidak pernah berjalan bersamaan.
      perform pg_advisory_xact_lock(hashtext('gwg_kpi_bulanan'), hashtext(v_periode));

      update kpi_values
         set status = 'final'
       where periode = v_periode
         and skala = 'bulanan'
         and terkini
         and status = 'sementara';
      get diagnostics v_n = row_count;

      if v_n > 0 then
        v_difinalisasi := v_difinalisasi || v_periode;
        v_baris := v_baris + v_n;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'bulan_berjalan', p_bulan_berjalan,
    'periode_diperiksa', to_jsonb(v_diperiksa),
    'periode_difinalisasi', to_jsonb(v_difinalisasi),
    'baris_diubah', v_baris
  );
end;
$$;

comment on function public.gwg_finalisasi_kpi_bulanan(text) is
  'Menutup periode bulanan yang kalendernya sudah habis: sementara → final pada baris terkini saja. Tidak menghitung ulang apa pun, tidak melahirkan versi baru, dan tidak menyentuh tidak_tersedia maupun invalid.';

-- Hak jalannya dicabut dari `public`, `anon`, dan `authenticated`. `authenticated`
-- disebut TERPISAH karena Supabase memberinya secara bawaan untuk fungsi baru di
-- skema public — mencabut dari `public` saja tidak cukup. Menutup periode adalah
-- perubahan keadaan yang tidak boleh bisa dipicu siapa pun yang sekadar login.
revoke all on function public.gwg_finalisasi_kpi_bulanan(text) from public, anon, authenticated;
grant execute on function public.gwg_finalisasi_kpi_bulanan(text) to service_role;
