-- Operational V.1 · PHASE 4 / TASK #88B — lapisan Signal.
--
-- ┌─ TIGA HAL YANG TIDAK BOLEH MENEMPEL ─────────────────────────────────────┐
-- │                                                                          │
-- │   kpi_values.nilai    36.4          ← FAKTA                              │
-- │   rule_conditions     gt 30         ← ATURAN BISNIS                      │
-- │   signals             lewat_ambang  ← PERISTIWA DETEKSI                  │
-- │                                                                          │
-- │ Signal tidak pernah mengubah angkanya dan tidak pernah jadi sumber       │
-- │ kebenaran untuk sales, biaya, pembelian, HPP, laba, target, maupun KPI.  │
-- │ Ia cuma mencatat bahwa pada suatu hari, sebuah angka melanggar sebuah    │
-- │ aturan yang memang berlaku saat itu.                                     │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ TIDAK ADA SATU PUN AMBANG DI BERKAS INI ────────────────────────────────┐
-- │                                                                          │
-- │ Mesin aturannya tetap `src/lib/ops/rules.ts`, dan ia tetap satu-satunya. │
-- │ SQL di sini hanya MENYIMPAN hasil yang sudah diputuskan di TypeScript.   │
-- │ Begitu ada `if nilai > 30` di sini, ada dua mesin penilai yang bisa      │
-- │ berbeda jawaban — dan tidak akan ada cara tahu mana yang benar.          │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Lihat AD-14 · docs/operational-v1/decisions.md dan blueprint.md bagian 9.

/* ─────────────────────────────── tabel ─────────────────────────────── */

create table if not exists signals (
  id                    bigint generated always as identity primary key,

  -- ── IDENTITAS ── tidak pernah berubah, dan inilah yang dikunci unique index.
  --
  -- ┌─ KENAPA BUKAN `kpi_value_id` ─────────────────────────────────────────┐
  -- │                                                                       │
  -- │ Bulan berjalan ditulis ulang tiap hari, dan tiap kali isinya berubah  │
  -- │ lahir versi baru dengan `id` baru. Kalau identitasnya di situ, 158    │
  -- │ pelanggaran September jadi ribuan baris dalam sebulan — dan Signal    │
  -- │ yang sudah diabaikan kemarin muncul lagi hari ini sebagai baris baru. │
  -- │ Pertanyaan "sudah pernah ditangani belum?" jadi tidak bisa dijawab.   │
  -- └───────────────────────────────────────────────────────────────────────┘
  rule_version_id       bigint not null references rule_versions (id) on delete restrict,

  cakupan               text not null,
  outlet_id             text references outlets (id) on delete restrict,
  area_id               text references areas (id) on delete restrict,

  -- ┌─ KOLOM INI YANG MENUTUP LUBANG KORPORAT (AD-14 · koreksi 1) ──────────┐
  -- │                                                                       │
  -- │ Rancangan blueprint memakai `outlet_id` di dalam unique key. Di       │
  -- │ PostgreSQL NULL tidak pernah sama dengan NULL, jadi dua Signal        │
  -- │ korporat yang identik dua-duanya lolos — dan jumlahnya berlipat tiap  │
  -- │ kali cron jalan. `kpi_values` sudah memecahkan ini di tempat yang     │
  -- │ sama; bentuknya disalin persis.                                      │
  -- └───────────────────────────────────────────────────────────────────────┘
  cakupan_id            text generated always as (coalesce(outlet_id, area_id, '~korporat')) stored,

  periode               text not null,
  skala                 text not null,

  -- ── SNAPSHOT DETEKSI ── keadaan pada saat PERTAMA terdeteksi. Beku.
  --
  -- `kpi_definition_id` sengaja DISALIN, bukan di-join lewat `rules`: tabel
  -- `rules` tidak punya pemicu immutability, jadi `kpi_definition_id`-nya bisa
  -- diubah orang. Tanpa salinan ini, Signal lama diam-diam berpindah KPI.
  kpi_definition_id     text not null references kpi_definitions (id) on delete restrict,
  kpi_value_id          bigint not null references kpi_values (id) on delete restrict,
  nilai_actual          numeric not null,
  nilai_ambang          numeric not null,
  nilai_ambang_2        numeric,
  operator              text not null,
  severity              text not null,
  status_kpi            text not null,
  terdeteksi_pada       timestamptz not null default now(),

  -- ── PENGAMATAN TERAKHIR ── hanya mesin yang menulis.
  --
  -- Ini yang membedakan 36% yang memburuk jadi 41% dari 36% yang membaik jadi
  -- 28%. Keduanya tetap satu Signal; yang berubah cuma keterangan terakhirnya.
  kpi_value_id_terakhir bigint not null references kpi_values (id) on delete restrict,
  nilai_terakhir        numeric,
  kondisi_terakhir      text not null default 'lewat_ambang',
  status_kpi_terakhir   text not null,
  diamati_pada          timestamptz not null default now(),

  -- ── KEADAAN KERJA ── hanya manusia yang menulis.
  --
  -- Dua keadaan, dan itu cukup (AD-14). "Masalahnya sudah membaik" adalah
  -- HASIL DETEKSI, bukan keadaan kerja — ia hidup di `kondisi_terakhir`, dan
  -- daftar kerja cukup menyaring `status='terbuka' and
  -- kondisi_terakhir='lewat_ambang'`. Tidak ada yang perlu mengklaim sesuatu
  -- "selesai" atas nama mesin.
  status                text not null default 'terbuka',
  diabaikan_oleh        text references users (id) on delete restrict,
  diabaikan_pada        timestamptz,
  diabaikan_alasan      text,

  constraint signals_status_check check (status in ('terbuka', 'diabaikan')),

  -- Signal hanya lahir dari angka yang benar-benar ada dan sudah dinilai.
  constraint signals_status_kpi_check check (status_kpi in ('final', 'sementara')),

  -- Pengamatan boleh berakhir di keadaan mana pun — termasuk ketika sumbernya
  -- belakangan dinyatakan tidak sah.
  constraint signals_status_kpi_terakhir_check
    check (status_kpi_terakhir in ('final', 'sementara', 'tidak_tersedia', 'invalid')),
  constraint signals_kondisi_check
    check (kondisi_terakhir in ('lewat_ambang', 'aman', 'tidak_tersedia', 'invalid', 'tanpa_aturan')),

  constraint signals_operator_check check (operator in ('lt', 'lte', 'gt', 'gte', 'between')),
  constraint signals_severity_check check (severity in ('low', 'medium', 'high', 'critical')),
  constraint signals_between_lengkap check (operator <> 'between' or nilai_ambang_2 is not null),

  -- Disalin PERSIS dari `kpi_values`. Signal yang cakupannya tidak sepakat
  -- dengan penunjuknya adalah Signal yang tidak bisa ditelusuri ke unit mana pun.
  constraint signals_cakupan_cocok check (
    (cakupan = 'outlet'   and outlet_id is not null and area_id is null) or
    (cakupan = 'area'     and area_id   is not null and outlet_id is null) or
    (cakupan = 'korporat' and outlet_id is null     and area_id is null)
  ),

  constraint signals_periode_bentuk check (
    (skala = 'harian'    and periode ~ '^\d{4}-\d{2}-\d{2}$') or
    (skala = 'mingguan'  and periode ~ '^\d{4}-W\d{2}$')      or
    (skala = 'bulanan'   and periode ~ '^\d{4}-\d{2}$')       or
    (skala = 'kuartalan' and periode ~ '^\d{4}-Q[1-4]$')      or
    (skala = 'tahunan'   and periode ~ '^\d{4}$')
  ),

  -- Mengabaikan tanpa alasan tidak bisa diaudit. Ketiganya berjalan bersama
  -- atau tidak sama sekali.
  constraint signals_diabaikan_utuh check (
    (status = 'terbuka'   and diabaikan_oleh is null and diabaikan_pada is null and diabaikan_alasan is null) or
    (status = 'diabaikan' and diabaikan_oleh is not null and diabaikan_pada is not null
                          and coalesce(trim(diabaikan_alasan), '') <> '')
  )
);

/* ─────────────────────────────── index ─────────────────────────────── */

-- INI YANG MENJAMIN IDEMPOTENSI. Advisory lock bisa dilewati jalur lain;
-- unique index tidak bisa.
create unique index if not exists signals_unik
  on signals (rule_version_id, cakupan, cakupan_id, periode, skala);

-- Pertanyaan utama layar Phase 5: "apa yang masih perlu ditangani bulan ini".
create index if not exists signals_kerja_idx
  on signals (periode, skala)
  where status = 'terbuka' and kondisi_terakhir = 'lewat_ambang';

create index if not exists signals_unit_idx     on signals (cakupan, cakupan_id, periode);
create index if not exists signals_versi_idx    on signals (rule_version_id);
create index if not exists signals_bukti_idx    on signals (kpi_value_id);

/* ──────────────────── snapshot deteksi tidak bisa disunting ──────────────────── */

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

  -- ┌─ YANG SUDAH DIABAIKAN TIDAK PERNAH DIBUKA MESIN ───────────────────────┐
  -- │                                                                        │
  -- │ Orang yang sudah memutuskan "ini tidak perlu ditangani" tidak boleh    │
  -- │ dibantah cron besok pagi. Angkanya boleh naik-turun sesukanya;         │
  -- │ pengamatannya ikut bergerak, keputusannya tidak.                       │
  -- │                                                                        │
  -- │ Konsep "insiden baru sesudah diabaikan" memang mungkin dibutuhkan,     │
  -- │ tapi itu keputusan workflow Phase 5/6 — bukan sesuatu yang lahir       │
  -- │ diam-diam di Phase 4.                                                  │
  -- └────────────────────────────────────────────────────────────────────────┘
  if old.status = 'diabaikan' and new.status = 'terbuka' then
    raise exception 'signal % sudah diabaikan dan tidak boleh dibuka kembali — itu keputusan workflow, bukan hasil deteksi', old.id;
  end if;

  return new;
end;
$$;

create trigger signals_tak_tersunting_trg
  before update or delete on signals
  for each row execute function signals_tak_tersunting();

/* ─────────────────────────────── RLS ─────────────────────────────── */

-- Sama dengan 113 tabel lain: RLS menyala, NOL policy — menolak secara bawaan.
-- Seluruh otorisasi ada di TypeScript (`src/lib/ops/scope-v1.ts`).
alter table signals enable row level security;
revoke all on table signals from anon, authenticated;

/* ───────────────────── penulis: satu fungsi, satu transaksi ───────────────────── */

-- ┌─ KENAPA FUNGSI, BUKAN BEBERAPA PERINTAH DARI KLIEN ──────────────────────┐
-- │                                                                          │
-- │ PostgREST tidak punya transaksi lintas permintaan. Penyisipan yang       │
-- │ sebagian berhasil akan meninggalkan sebagian Signal periode itu ada dan  │
-- │ sebagian tidak — dan tidak ada yang terlihat salah dari luar.            │
-- │                                                                          │
-- │ `p_baris` sudah membawa HASIL penilaian. Fungsi ini tidak menilai apa    │
-- │ pun: tidak ada perbandingan ambang, tidak ada operator yang ditafsirkan. │
-- │ `boleh_sisip` diputuskan `src/lib/data/signals.ts`.                      │
-- └──────────────────────────────────────────────────────────────────────────┘
create or replace function gwg_deteksi_signal(p_periode text, p_baris jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_masuk      integer;
  v_disisipkan integer := 0;
  v_diperbarui integer := 0;
  v_diamati    integer := 0;
begin
  -- Ruang kunci SENDIRI, sengaja berbeda dari 'gwg_kpi_bulanan': deteksi tidak
  -- boleh memblokir generasi KPI, dan sebaliknya.
  perform pg_advisory_xact_lock(hashtext('gwg_signal'), hashtext(p_periode));
  perform set_config('client_min_messages', 'warning', true);

  -- `on commit drop` baru melepas saat COMMIT, jadi dua panggilan dalam satu
  -- transaksi bertabrakan. Ditemukan uji basis data pada TASK #85.
  drop table if exists masuk_signal;

  create temp table masuk_signal on commit drop as
  select * from jsonb_to_recordset(p_baris) as x(
    boleh_sisip           boolean,
    rule_version_id       bigint,
    cakupan               text,
    outlet_id             text,
    area_id               text,
    periode               text,
    skala                 text,
    kpi_definition_id     text,
    kpi_value_id          bigint,
    nilai_actual          numeric,
    nilai_ambang          numeric,
    nilai_ambang_2        numeric,
    operator              text,
    severity              text,
    status_kpi            text,
    kpi_value_id_terakhir bigint,
    nilai_terakhir        numeric,
    kondisi_terakhir      text,
    status_kpi_terakhir   text
  );

  select count(*) into v_masuk from masuk_signal;

  if v_masuk > 0 and exists (select 1 from masuk_signal where periode <> p_periode) then
    raise exception 'muatan memuat periode selain % — satu panggilan menangani satu periode', p_periode;
  end if;

  -- ── yang boleh melahirkan Signal ──
  --
  -- `on conflict` HANYA menyentuh blok pengamatan. `status`, `diabaikan_*`, dan
  -- seluruh snapshot sengaja TIDAK ada di daftar `set` — jadi deteksi ulang
  -- tidak bisa membuka Signal yang sudah diabaikan maupun menulis ulang
  -- keadaan saat pertama terdeteksi. Pemicunya menolak kalau toh dicoba.
  with hasil as (
    insert into signals (
      rule_version_id, cakupan, outlet_id, area_id, periode, skala,
      kpi_definition_id, kpi_value_id, nilai_actual, nilai_ambang, nilai_ambang_2,
      operator, severity, status_kpi,
      kpi_value_id_terakhir, nilai_terakhir, kondisi_terakhir, status_kpi_terakhir
    )
    select
      m.rule_version_id, m.cakupan, m.outlet_id, m.area_id, m.periode, m.skala,
      m.kpi_definition_id, m.kpi_value_id, m.nilai_actual, m.nilai_ambang, m.nilai_ambang_2,
      m.operator, m.severity, m.status_kpi,
      m.kpi_value_id_terakhir, m.nilai_terakhir, m.kondisi_terakhir, m.status_kpi_terakhir
    from masuk_signal m
    where m.boleh_sisip
    on conflict (rule_version_id, cakupan, cakupan_id, periode, skala) do update
      set kpi_value_id_terakhir = excluded.kpi_value_id_terakhir,
          nilai_terakhir        = excluded.nilai_terakhir,
          kondisi_terakhir      = excluded.kondisi_terakhir,
          status_kpi_terakhir   = excluded.status_kpi_terakhir,
          diamati_pada          = now()
    returning (xmax = 0) as baru
  )
  select count(*) filter (where baru), count(*) filter (where not baru)
    into v_disisipkan, v_diperbarui
  from hasil;

  -- ── yang TIDAK boleh melahirkan Signal, tapi tetap mengabarkan ──
  --
  -- KPI yang membaik, yang angkanya hilang, dan yang sumbernya belakangan
  -- dinyatakan tidak sah (AD-14). Kalau Signal-nya belum ada, `update` ini
  -- mengenai nol baris — dan itu memang jawabannya, tanpa perlu membaca dulu.
  with ubah as (
    update signals s
       set kpi_value_id_terakhir = m.kpi_value_id_terakhir,
           nilai_terakhir        = m.nilai_terakhir,
           kondisi_terakhir      = m.kondisi_terakhir,
           status_kpi_terakhir   = m.status_kpi_terakhir,
           diamati_pada          = now()
      from masuk_signal m
     where not m.boleh_sisip
       and s.rule_version_id = m.rule_version_id
       and s.cakupan         = m.cakupan
       and s.cakupan_id      = coalesce(m.outlet_id, m.area_id, '~korporat')
       and s.periode         = m.periode
       and s.skala           = m.skala
    returning 1
  )
  select count(*) into v_diamati from ubah;

  return jsonb_build_object(
    'periode',     p_periode,
    'masuk',       v_masuk,
    'disisipkan',  v_disisipkan,
    'diperbarui',  v_diperbarui,
    'diamati_saja', v_diamati
  );
end;
$$;

revoke all on function gwg_deteksi_signal(text, jsonb) from public, anon, authenticated;
grant execute on function gwg_deteksi_signal(text, jsonb) to service_role;
