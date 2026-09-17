-- Operational V.1 · PHASE 3 / TASK #87 — lapisan aturan yang berversi.
--
-- ┌─ YANG DIPISAHKAN ────────────────────────────────────────────────────────┐
-- │                                                                          │
-- │   kpi_values.nilai   = ANGKANYA         (20.364919)                      │
-- │   rule_conditions    = ARTINYA          (batasnya 30%, jadi aman)        │
-- │                                                                          │
-- │ Keduanya tidak boleh menempel. Menyimpan tafsir ke dalam `kpi_values`    │
-- │ berarti mengubah aturan sama dengan mengubah angka sejarah — dan angka   │
-- │ yang berubah karena kebijakan berubah adalah angka yang tidak bisa       │
-- │ dipertanggungjawabkan lagi.                                              │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Bentuk tabelnya mengikuti rancangan yang sudah ada di
-- `docs/operational-v1/blueprint.md` bagian 8 — `rules`, `rule_versions`,
-- `rule_conditions` — bukan rancangan baru.
--
-- ┌─ VERSI TIDAK PERNAH DIUBAH DI TEMPAT ────────────────────────────────────┐
-- │                                                                          │
-- │ Ambang berubah 30% → 28% TIDAK menyunting v1. Ia melahirkan v2, dan v1   │
-- │ tetap ada beserta rentang berlakunya. Tanpa itu, penilaian September     │
-- │ yang sudah dibaca orang akan diam-diam berubah artinya begitu kebijakan  │
-- │ Desember ditetapkan.                                                     │
-- │                                                                          │
-- │ Ditegakkan pemicu, bukan sekadar kesepakatan: UPDATE dan DELETE pada     │
-- │ kolom yang menentukan arti sebuah versi DITOLAK basis data.              │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- `op_settings` TIDAK dipindah dan TIDAK dihapus. Angkanya DISALIN jadi benih
-- versi 1 — halaman `/operation/settings` tetap membacanya seperti biasa, dan
-- dashboard lama tetap memakainya. Batas peralihannya jelas: aturan V.1 membaca
-- tabel ini, layar lama membaca `op_settings`. Pengalihan halaman pengaturannya
-- menyusul di phase tersendiri.

/* ─────────────────────────────── tabel ─────────────────────────────── */

create table if not exists rules (
  kode               text primary key,
  nama               text not null,
  kpi_definition_id  text not null references kpi_definitions (id) on delete restrict,
  kategori           text not null,
  -- Seluruh aturan hari ini berlaku untuk semua cakupan. Kolomnya ada supaya
  -- aturan per-area kelak tidak menuntut migrasi tabel; ia BUKAN pernyataan
  -- bahwa aturan berlingkup sudah ada.
  cakupan            text not null default 'semua',
  pemilik_departemen text,
  aktif              boolean not null default true,
  catatan            text,
  dibuat_pada        timestamptz not null default now(),

  constraint rules_kode_bentuk check (kode ~ '^[a-z][a-z0-9_]*$'),
  constraint rules_kategori_check check (kategori in ('sales', 'biaya', 'mutu', 'orang')),
  constraint rules_cakupan_check check (cakupan in ('semua', 'korporat', 'area', 'outlet'))
);

create table if not exists rule_versions (
  id               bigint generated always as identity primary key,
  rule_kode        text not null references rules (kode) on delete restrict,
  versi            integer not null,

  -- Rentangnya dinyatakan dalam PERIODE KPI ("2026-10"), bukan tanggal.
  -- Pertanyaannya memang "aturan mana yang berlaku untuk periode 2026-09",
  -- dan menjawabnya dengan tanggal memaksa pembandingan dua satuan yang
  -- berbeda di tiap pemanggil. `berlaku_sampai` null berarti masih berlaku.
  berlaku_mulai    text not null,
  berlaku_sampai   text,

  severity_default text not null default 'medium',
  -- DARI MANA ANGKANYA. Inilah yang membuat sebuah penilaian bisa dijelaskan
  -- tanpa membaca kode sumber lama.
  sumber           text not null,
  catatan          text,
  dibuat_oleh      text references users (id) on delete restrict,
  dibuat_pada      timestamptz not null default now(),

  constraint rule_versions_versi_check check (versi >= 1),
  constraint rule_versions_mulai_bentuk check (berlaku_mulai ~ '^\d{4}-\d{2}$'),
  constraint rule_versions_sampai_bentuk check (berlaku_sampai is null or berlaku_sampai ~ '^\d{4}-\d{2}$'),
  constraint rule_versions_rentang check (berlaku_sampai is null or berlaku_sampai >= berlaku_mulai),
  constraint rule_versions_severity_check check (severity_default in ('low', 'medium', 'high', 'critical'))
);

create unique index if not exists rule_versions_unik on rule_versions (rule_kode, versi);
create index if not exists rule_versions_berlaku_idx on rule_versions (rule_kode, berlaku_mulai);

create table if not exists rule_conditions (
  id              bigint generated always as identity primary key,
  rule_version_id bigint not null references rule_versions (id) on delete restrict,
  urutan          integer not null default 1,

  -- Operator menyatakan KAPAN AMBANGNYA DILANGGAR, bukan kapan sehat. Dengan
  -- begitu perilaku di titik batas jadi eksplisit: `gt 5` berarti tepat 5
  -- masih aman. Bentuk ini mengikuti contoh di blueprint bagian 8.
  operator        text not null,
  nilai_ambang    numeric not null,
  nilai_ambang_2  numeric,
  skala           text not null default 'bulanan',

  constraint rule_conditions_operator_check check (operator in ('lt', 'lte', 'gt', 'gte', 'between')),
  constraint rule_conditions_skala_check check (skala in ('harian', 'mingguan', 'bulanan', 'kuartalan', 'tahunan')),
  constraint rule_conditions_between check (
    (operator = 'between' and nilai_ambang_2 is not null) or
    (operator <> 'between' and nilai_ambang_2 is null)
  )
);

create unique index if not exists rule_conditions_urutan_unik on rule_conditions (rule_version_id, urutan);
create index if not exists rule_conditions_versi_idx on rule_conditions (rule_version_id);

/* ──────────────── dua versi tidak boleh berlaku bersamaan ──────────────── */

-- Kalau dua versi sebuah aturan berlaku untuk periode yang sama, "aturan mana
-- yang dipakai" tidak punya jawaban — dan jawabannya akan dipilih oleh urutan
-- baris, yang bisa berubah kapan saja.
--
-- Dipakai pemicu, bukan exclusion constraint. Yang kedua menuntut `btree_gist`
-- dipasang di produksi demi satu tabel yang barisnya belasan; pemicu dengan
-- kunci nasihat memberi jaminan yang sama tanpa menambah ekstensi. Kuncinya
-- membuat dua penyisipan berbarengan tetap tidak bisa saling melewati.
create or replace function rule_versions_tanpa_tumpang()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_bentrok text;
begin
  perform pg_advisory_xact_lock(hashtext('gwg_rule_versions'), hashtext(new.rule_kode));

  select string_agg('v' || v.versi || ' (' || v.berlaku_mulai || '→' || coalesce(v.berlaku_sampai, 'seterusnya') || ')', ', ')
    into v_bentrok
  from rule_versions v
  where v.rule_kode = new.rule_kode
    and v.id <> coalesce(new.id, -1)
    and new.berlaku_mulai <= coalesce(v.berlaku_sampai, '9999-99')
    and coalesce(new.berlaku_sampai, '9999-99') >= v.berlaku_mulai;

  if v_bentrok is not null then
    raise exception 'rentang berlaku % v% (%→%) bertumpang dengan %',
      new.rule_kode, new.versi, new.berlaku_mulai, coalesce(new.berlaku_sampai, 'seterusnya'), v_bentrok;
  end if;

  return new;
end;
$$;

create trigger rule_versions_tanpa_tumpang_trg
  before insert or update on rule_versions
  for each row execute function rule_versions_tanpa_tumpang();

/* ──────────────────── versi yang sudah ada tidak disunting ──────────────────── */

create or replace function rule_versions_tak_tersunting()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'versi aturan tidak boleh dihapus (% v%) — buat versi baru, jangan menghapus sejarahnya', old.rule_kode, old.versi;
  end if;

  -- `catatan` boleh diperbaiki; yang menentukan ARTI sebuah versi tidak boleh.
  if new.rule_kode is distinct from old.rule_kode
     or new.versi is distinct from old.versi
     or new.berlaku_mulai is distinct from old.berlaku_mulai
     or new.severity_default is distinct from old.severity_default
     or new.sumber is distinct from old.sumber then
    raise exception 'versi aturan % v% tidak boleh diubah di tempat — ambang atau rentang yang berubah menuntut versi baru', old.rule_kode, old.versi;
  end if;

  -- ┌─ MENUTUP RENTANG ADALAH SATU-SATUNYA SUNTINGAN YANG DIIZINKAN ─────────┐
  -- │                                                                        │
  -- │ Versi yang masih berlaku (`berlaku_sampai` null) HARUS bisa ditutup —  │
  -- │ kalau tidak, ia bertumpang dengan versi berikutnya selamanya dan       │
  -- │ ambang tidak akan pernah bisa berubah. Ditemukan uji basis data,       │
  -- │ bukan produksi.                                                        │
  -- │                                                                        │
  -- │ Menutupnya tidak mengubah arti satu periode pun yang MASIH dicakupnya; │
  -- │ ia cuma berhenti mencakup periode sesudahnya, yang lalu diambil alih   │
  -- │ versi baru. Sebaliknya, rentang yang SUDAH ditutup tidak boleh diubah  │
  -- │ lagi maupun dibuka kembali — itu menulis ulang sejarah.                │
  -- └────────────────────────────────────────────────────────────────────────┘
  if old.berlaku_sampai is not null and new.berlaku_sampai is distinct from old.berlaku_sampai then
    raise exception 'rentang % v% sudah ditutup di % dan tidak boleh diubah lagi', old.rule_kode, old.versi, old.berlaku_sampai;
  end if;

  return new;
end;
$$;

create trigger rule_versions_tak_tersunting_trg
  before update or delete on rule_versions
  for each row execute function rule_versions_tak_tersunting();

create or replace function rule_conditions_tak_tersunting()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'syarat aturan tidak boleh diubah maupun dihapus — ambang yang berubah menuntut versi aturan baru';
end;
$$;

create trigger rule_conditions_tak_tersunting_trg
  before update or delete on rule_conditions
  for each row execute function rule_conditions_tak_tersunting();

/* ─────────────────────────────── RLS ─────────────────────────────── */

-- Sama dengan 109 tabel lain di basis data ini: RLS menyala, NOL policy.
-- Menolak secara bawaan, dan seluruh otorisasi ada di TypeScript
-- (`src/lib/ops/scope-v1.ts`). Lihat `0004_lockdown_rls_and_rpc.sql`.
alter table rules            enable row level security;
alter table rule_versions    enable row level security;
alter table rule_conditions  enable row level security;

comment on table rules is 'Aturan bisnis V.1 — satu baris per aturan, tanpa ambang. Ambangnya ada di rule_conditions, per versi.';
comment on table rule_versions is 'Versi sebuah aturan beserta rentang periode berlakunya. Tidak pernah disunting di tempat: ambang berubah berarti versi baru.';
comment on table rule_conditions is 'Ambang satu versi aturan. Operatornya menyatakan kapan ambang DILANGGAR, sehingga perilaku di titik batas eksplisit.';

/* ───────────────────────────── benih versi 1 ───────────────────────────── */

-- Angkanya DISALIN dari `op_settings` yang sudah dipakai produksi, bukan
-- dikarang. Satu-satunya yang bukan dari sana adalah sewa — lihat di bawah.
--
-- `berlaku_mulai` = '2026-08', periode KPI paling awal yang ada di basis data.
-- Ambang-ambang ini memang sudah berlaku pada bulan itu: ia yang dipakai
-- dashboard Operation sepanjang periode tersebut.

insert into rules (kode, nama, kpi_definition_id, kategori, pemilik_departemen, catatan) values
  ('warehouse_persen',       'Warehouse % melebihi batas',       'biaya.warehouse_pct',       'biaya', 'operation', 'Disalin dari op_settings.purchaseLimits.warehouse'),
  ('non_warehouse_persen',   'Non-Warehouse % melebihi batas',   'biaya.non_warehouse_pct',   'biaya', 'operation', 'Disalin dari op_settings.purchaseLimits.nonWarehouse'),
  ('total_pembelian_persen', 'Total Purchase % melebihi batas',  'biaya.total_purchase_pct',  'biaya', 'operation', 'Disalin dari op_settings.purchaseLimits.total'),
  ('tenaga_kerja_persen',    'Labor % melebihi batas',           'biaya.labor_pct',           'biaya', 'operation', 'Disalin dari op_settings.expenseThresholds.tenaga_kerja'),
  ('lainnya_persen',         'Other % melebihi batas',           'biaya.other_pct',           'biaya', 'operation', 'Disalin dari op_settings.expenseThresholds.lainnya'),
  ('laba_bersih_persen',     'Net Profit % di bawah sehat',      'biaya.net_profit_pct',      'biaya', 'operation', 'Disalin dari op_settings.marginBands.sehat'),
  ('listrik_persen',         'Electricity % melebihi batas',     'biaya.electricity_pct',     'biaya', 'operation', 'Ambang disebut pemiliknya di TASK #87; belum ada di op_settings'),
  ('air_persen',             'Water % melebihi batas',           'biaya.water_pct',           'biaya', 'operation', 'Ambang disebut pemiliknya di TASK #87; belum ada di op_settings'),
  ('internet_persen',        'Internet % melebihi batas',        'biaya.internet_pct',        'biaya', 'operation', 'Ambang disebut pemiliknya di TASK #87; belum ada di op_settings'),
  ('sewa_melebihi_ambang',   'Rent % melebihi batas',            'biaya.rent_pct',            'biaya', 'operation', 'AD-02. op_settings.expenseThresholds.sewa TETAP 3 dan tidak disentuh.')
on conflict (kode) do nothing;

insert into rule_versions (rule_kode, versi, berlaku_mulai, berlaku_sampai, severity_default, sumber, catatan)
select * from (values
  ('warehouse_persen',       1, '2026-08', null::text, 'medium',
   'op_settings.purchaseLimits.warehouse = 30 (16 September 2026)', null::text),
  ('non_warehouse_persen',   1, '2026-08', null, 'medium',
   'op_settings.purchaseLimits.nonWarehouse = 5 (16 September 2026)', null),
  ('total_pembelian_persen', 1, '2026-08', null, 'medium',
   'op_settings.purchaseLimits.total = 35 (16 September 2026)', null),
  ('tenaga_kerja_persen',    1, '2026-08', null, 'high',
   'op_settings.expenseThresholds.tenaga_kerja = 13 (16 September 2026)', null),
  ('lainnya_persen',         1, '2026-08', null, 'medium',
   'op_settings.expenseThresholds.lainnya = 3 (16 September 2026)', null),
  ('laba_bersih_persen',     1, '2026-08', null, 'critical',
   'op_settings.marginBands.sehat = 30 (16 September 2026)',
   'Hanya batas sehat yang dipakai. marginBands juga memuat cukup=29 dan kritis=15, tapi ketiganya menyisakan rentang 15–29 yang tidak bernama — jadi pita tengahnya TIDAK dikarang di sini.'),
  ('listrik_persen',         1, '2026-08', null, 'medium',
   'TASK #87 bagian 3 — disebut pemiliknya; belum ada di op_settings maupun dokumen repositori', null),
  ('air_persen',             1, '2026-08', null, 'low',
   'TASK #87 bagian 3 — disebut pemiliknya; belum ada di op_settings maupun dokumen repositori', null),
  ('internet_persen',        1, '2026-08', null, 'low',
   'TASK #87 bagian 3 — disebut pemiliknya; belum ada di op_settings maupun dokumen repositori', null),
  -- Sewa berbeda sendiri, dan itu disengaja. AD-02 menetapkan 5% berlaku
  -- 1 Oktober 2026 — jadi periode sebelum Oktober TIDAK punya aturan sewa,
  -- dan itu jawaban yang benar, bukan lubang. Angka 3 di `op_settings` tetap
  -- melayani layar lama untuk bulan-bulan lama.
  ('sewa_melebihi_ambang',   1, '2026-10', null, 'medium',
   'AD-02 · docs/operational-v1/decisions.md — Sewa = 5%, berlaku 2026-10-01',
   'op_settings.expenseThresholds.sewa tetap 3 dan tidak diubah. Periode sebelum 2026-10 sengaja tidak punya aturan sewa V.1.')
) as v(rule_kode, versi, berlaku_mulai, berlaku_sampai, severity_default, sumber, catatan)
where not exists (select 1 from rule_versions x where x.rule_kode = v.rule_kode and x.versi = v.versi);

insert into rule_conditions (rule_version_id, urutan, operator, nilai_ambang, skala)
select v.id, 1, a.operator, a.ambang, 'bulanan'
from rule_versions v
join (values
  ('warehouse_persen',       'gt', 30),
  ('non_warehouse_persen',   'gt',  5),
  ('total_pembelian_persen', 'gt', 35),
  ('tenaga_kerja_persen',    'gt', 13),
  ('lainnya_persen',         'gt',  3),
  -- Naik-baik: yang dilanggar adalah nilai DI BAWAH ambang.
  ('laba_bersih_persen',     'lt', 30),
  ('listrik_persen',         'gt',  4),
  ('air_persen',             'gt',  1),
  ('internet_persen',        'gt',  1),
  ('sewa_melebihi_ambang',   'gt',  5)
) as a(rule_kode, operator, ambang) on a.rule_kode = v.rule_kode and v.versi = 1
where not exists (select 1 from rule_conditions c where c.rule_version_id = v.id);
