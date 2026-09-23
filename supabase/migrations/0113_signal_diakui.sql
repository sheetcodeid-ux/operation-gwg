-- Operational V.1 · Z-01 / PHASE 5 — work-state "sudah diakui" pada Signal.
--
-- ┌─ KENAPA BUKAN STATUS KETIGA ─────────────────────────────────────────────┐
-- │                                                                          │
-- │ Keputusan pemiliknya (Z-01 · D1 = B). Alasannya terbaca langsung dari    │
-- │ `signals_kerja_idx`: ia partial `where status = 'terbuka'`, dan daftar   │
-- │ kerja Command Center menyaring `status = 'terbuka'` (Z-01 Q3). Kalau     │
-- │ `acknowledged` jadi nilai `status`, menekan "saya lihat" akan MENGHAPUS  │
-- │ Signal itu dari daftar kerjanya sendiri — persis kebalikan dari yang     │
-- │ dimaksud.                                                                │
-- │                                                                          │
-- │ Sebagai work-state terpisah, Signal yang sudah diakui TETAP `terbuka`,   │
-- │ tetap masuk index yang sama, tetap muncul di daftar kerja — hanya        │
-- │ bertanda siapa yang sudah melihatnya dan kapan.                          │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ADITIF SEPENUHNYA. Tidak ada kolom yang dihapus, tidak ada constraint lama
-- yang dilonggarkan, tidak ada baris yang disentuh. Seluruh 341 Signal tetap
-- apa adanya dengan kedua kolom baru bernilai NULL — dan NULL di sini berarti
-- "belum ada yang menyatakan sudah melihatnya", bukan nol dan bukan tidak ada.

alter table signals add column if not exists diakui_oleh text references users (id) on delete restrict;
alter table signals add column if not exists diakui_pada timestamptz;

-- Aktor tanpa waktu tidak bisa diaudit, dan waktu tanpa aktor tidak menyebut
-- siapa pun. Keduanya berjalan bersama atau tidak sama sekali — bentuk yang
-- sama persis dengan `signals_diabaikan_utuh`.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'signals_diakui_utuh' and conrelid = 'signals'::regclass
  ) then
    alter table signals add constraint signals_diakui_utuh check (
      (diakui_oleh is null and diakui_pada is null) or
      (diakui_oleh is not null and diakui_pada is not null)
    );
  end if;
end $$;

/* ──────────────── snapshot tetap beku, pengakuan tetap sekali ──────────────── */

-- Fungsi yang sama dengan `0111_signals.sql`, DITAMBAH dua aturan arah untuk
-- kolom baru. Seluruh aturan lama disalin apa adanya — tidak satu pun dicabut.
create or replace function signals_tak_tersunting()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'signal tidak boleh dihapus (% % %) — ia bukti bahwa sesuatu pernah terdeteksi',
      old.id, old.periode, old.cakupan_id;
  end if;

  if new.rule_version_id   is distinct from old.rule_version_id
     or new.cakupan        is distinct from old.cakupan
     or new.outlet_id      is distinct from old.outlet_id
     or new.area_id        is distinct from old.area_id
     or new.periode        is distinct from old.periode
     or new.skala          is distinct from old.skala then
    raise exception 'identitas signal % tidak boleh diubah — identitas yang bergeser berarti Signal lain', old.id;
  end if;

  if new.kpi_definition_id is distinct from old.kpi_definition_id
     or new.kpi_value_id   is distinct from old.kpi_value_id
     or new.nilai_actual   is distinct from old.nilai_actual
     or new.nilai_ambang   is distinct from old.nilai_ambang
     or new.nilai_ambang_2 is distinct from old.nilai_ambang_2
     or new.operator       is distinct from old.operator
     or new.severity       is distinct from old.severity
     or new.status_kpi     is distinct from old.status_kpi
     or new.terdeteksi_pada is distinct from old.terdeteksi_pada then
    raise exception 'snapshot deteksi signal % tidak boleh diubah — keadaan saat pertama terdeteksi adalah buktinya', old.id;
  end if;

  if old.status = 'diabaikan' and new.status = 'terbuka' then
    raise exception 'signal % sudah diabaikan dan tidak boleh dibuka kembali — itu keputusan workflow, bukan hasil deteksi', old.id;
  end if;

  -- ┌─ PENGAKUAN TIDAK BISA DITARIK KEMBALI ────────────────────────────────┐
  -- │                                                                       │
  -- │ "Saya sudah melihatnya" adalah peristiwa yang benar-benar terjadi.    │
  -- │ Mengosongkannya kembali berarti menghapus jejak orang yang sudah      │
  -- │ membacanya — dan daftar kerja yang bisa dibersihkan diam-diam tidak   │
  -- │ bisa dipakai menjawab "sudah dilihat belum?".                         │
  -- └───────────────────────────────────────────────────────────────────────┘
  if old.diakui_oleh is not null and new.diakui_oleh is null then
    raise exception 'pengakuan signal % tidak boleh dicabut', old.id;
  end if;

  -- ┌─ MENGAKUI DUA KALI TIDAK MELAHIRKAN RIWAYAT PALSU ────────────────────┐
  -- │                                                                       │
  -- │ Yang tercatat orang PERTAMA yang melihatnya, bukan yang terakhir      │
  -- │ menekan tombolnya. Tanpa aturan ini, satu Signal yang dibuka lima     │
  -- │ orang akan berakhir menyebut nama kelima — dan empat sebelumnya       │
  -- │ hilang tanpa pernah tercatat di mana pun.                             │
  -- └───────────────────────────────────────────────────────────────────────┘
  if old.diakui_oleh is not null
     and (new.diakui_oleh is distinct from old.diakui_oleh
          or new.diakui_pada is distinct from old.diakui_pada) then
    raise exception 'pengakuan signal % sudah tercatat atas nama % dan tidak boleh ditimpa', old.id, old.diakui_oleh;
  end if;

  return new;
end;
$$;

-- Triggernya sendiri TIDAK dibuat ulang: `0111` sudah memasangnya, dan
-- `create or replace function` sudah cukup untuk menggantikan isinya.
