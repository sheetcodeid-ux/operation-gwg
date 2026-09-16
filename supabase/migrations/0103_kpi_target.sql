-- Operational V.1 · PHASE 2A — tempat menyimpan angka KPI dan target.
--
-- TIGA TABEL, tidak lebih: `kpi_definitions` (apa yang diukur),
-- `kpi_values` (hasil pengukurannya), dan `targets` (angka yang dikejar).
-- Signal, action, evidence, rule, dan seluruh tabel V.1 lainnya BUKAN bagian
-- dari phase ini dan tidak dibuat di sini.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- YANG PERLU DIKETAHUI SEBELUM MENJALANKAN INI KE PRODUKSI
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Berkas di `supabase/migrations/` BUKAN salinan utuh skema produksi. Per 16
-- September 2026 buku besar produksi (`supabase_migrations.schema_migrations`)
-- memuat 158 catatan sementara direktori ini memuat 102 berkas; 68 di antaranya
-- tidak punya berkas di sini sama sekali. Karena itu migrasi ini ditulis
-- terhadap SKEMA PRODUKSI YANG DIPERIKSA LANGSUNG, bukan terhadap hasil
-- pemutaran ulang berkas-berkas di atasnya.
--
-- Yang diperiksa dan menjadi dasar bentuk kolom di bawah:
--
--   outlets.id  text, primary key
--   areas.id    text, primary key
--   users.id    text, primary key
--
-- Ketiganya `text`, bukan uuid. Kolom penunjuk di sini mengikuti — kalau tidak,
-- foreign key-nya gagal dipasang dan tabelnya lahir tanpa pengait apa pun.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: AKTIF, TANPA POLICY — dan itu memang yang diinginkan
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `0004_lockdown_rls_and_rpc.sql` sudah memutuskan sikapnya: policy permisif
-- `using (true)` dibuang, RLS dinyalakan, dan tabel tanpa policy berarti anon
-- tidak mendapat satu baris pun. Aplikasi memakai service role, yang melewati
-- RLS, jadi seluruh perizinan sesungguhnya dijalankan di TypeScript
-- (`src/lib/rbac.ts`, `src/lib/ops/scope-v1.ts`).
--
-- Tiga tabel ini mengikuti sikap yang sama. Menambahkan policy `using (true)`
-- di sini akan membuka angka penjualan seluruh outlet kepada siapa pun yang
-- memegang kunci anon — kunci yang memang dikirim ke peramban.
--
-- AD-01 (`docs/operational-v1/decisions.md`) mengikat satu syarat: identitas
-- pengguna disimpan dengan bentuk yang sama seperti tabel existing (`users.id`,
-- teks), supaya policy berbasis `auth.uid()` bisa ditambahkan kelak tanpa
-- mengubah skema.

/* ═══════════════════════ 1 · kpi_definitions ═══════════════════════ */

-- Katalog: apa yang diukur, satuannya apa, dan arah mana yang berarti baik.
--
-- Dipisahkan dari nilainya supaya satu KPI bisa diubah namanya, satuannya, atau
-- dinonaktifkan tanpa menyentuh puluhan ribu baris hasil pengukuran — dan
-- supaya `kpi_values` tidak bisa memuat kode KPI yang tidak pernah didefinisikan
-- siapa pun.
create table if not exists kpi_definitions (
  -- Diketik tangan, bukan uuid: id-nya ikut terbaca di log, di berkas ekspor,
  -- dan di pesan galat. `sales.net_sales` menjelaskan dirinya sendiri;
  -- `a3f1…` menuntut satu query lagi tiap kali seseorang bertanya.
  id           text primary key,
  kode         text not null unique,
  nama         text not null,
  -- Kelompok, supaya KPI Sales tidak tercampur KPI biaya atau mutu.
  kelompok     text not null,
  satuan       text not null,
  -- Arah yang berarti baik. Tanpa ini, "capaian 80%" tidak bisa dibaca: untuk
  -- penjualan itu kurang, untuk HPP itu bagus.
  arah         text not null,
  -- Skala terkecil yang sah bagi KPI ini. `kpi_values` diperiksa terhadapnya.
  skala        text not null,
  -- Bagaimana nilai harian digabung jadi bulanan.
  agregasi     text not null,
  aktif        boolean not null default true,
  urutan       integer not null default 0,
  keterangan   text,
  dibuat_pada  timestamptz not null default now(),

  constraint kpi_definitions_satuan_check   check (satuan in ('rupiah', 'persen', 'angka')),
  constraint kpi_definitions_arah_check     check (arah in ('naik_baik', 'turun_baik', 'netral')),
  constraint kpi_definitions_skala_check    check (skala in ('harian', 'mingguan', 'bulanan', 'kuartalan', 'tahunan')),
  constraint kpi_definitions_agregasi_check check (agregasi in ('jumlah', 'rata', 'rasio', 'terakhir', 'tidak')),
  constraint kpi_definitions_kelompok_check check (kelompok in ('sales', 'biaya', 'mutu', 'orang'))
);

alter table kpi_definitions enable row level security;

/* ═══════════════════════════ 2 · kpi_values ═══════════════════════════ */

-- Hasil pengukuran. Satu baris = satu KPI, satu cakupan, satu periode, satu
-- versi perhitungan.
--
-- ┌─ KENAPA ADA KOLOM `cakupan` PADAHAL SUDAH ADA outlet_id DAN area_id ─────┐
-- │                                                                          │
-- │ Angka korporat tidak dimiliki outlet mana pun dan tidak dimiliki area    │
-- │ mana pun, jadi kedua penunjuknya null. Di PostgreSQL, NULL tidak pernah  │
-- │ sama dengan NULL — sebuah unique index atas (…, outlet_id, area_id, …)   │
-- │ karena itu TIDAK MENOLAK APA PUN untuk baris korporat. Seratus baris     │
-- │ korporat yang identik bisa masuk tanpa satu pun ditolak, dan tidak ada   │
-- │ yang akan tahu sampai angkanya terbaca seratus kali lipat.               │
-- │                                                                          │
-- │ `cakupan` dan `cakupan_id` menutup celah itu: keduanya TIDAK PERNAH      │
-- │ null, jadi unique index-nya benar-benar berlaku, termasuk untuk korporat.│
-- │ `cakupan_id` dihitung basis data sendiri (`generated always`) supaya     │
-- │ tidak mungkin berbeda dari outlet_id/area_id yang sesungguhnya.          │
-- └──────────────────────────────────────────────────────────────────────────┘
create table if not exists kpi_values (
  id                bigint generated always as identity primary key,
  kpi_definition_id text not null references kpi_definitions (id) on delete restrict,

  -- `on delete restrict`, bukan cascade: menghapus outlet tidak boleh diam-diam
  -- menghapus riwayat penjualannya. Outlet yang tutup dinonaktifkan
  -- (`outlets.active = false`), tidak dihapus — dan angkanya tetap dibutuhkan
  -- untuk membandingkan tahun ini dengan tahun lalu.
  outlet_id         text references outlets (id) on delete restrict,
  area_id           text references areas (id) on delete restrict,
  cakupan           text not null,
  cakupan_id        text generated always as (coalesce(outlet_id, area_id, '~korporat')) stored,

  periode           text not null,
  skala             text not null,

  -- NULL BUKAN NOL. Null berarti angkanya tidak bisa dihitung dari data yang
  -- sah — AD-04 menyebutnya INCONCLUSIVE, dan itu jawaban yang benar, bukan
  -- kegagalan. Nol berarti terukur dan hasilnya nol.
  nilai             numeric,
  status            text not null default 'final',

  -- ── asal-usul: dari mana angkanya, dan aturan mana yang dipakai ──
  sumber            text not null,
  rumus             text not null,
  rumus_versi       integer not null default 1,

  -- Benar bila sumbernya memang berlaku untuk periode ini. `outlets.esb_mulai`
  -- dan `outlets.esb_abaikan` menandai bulan-bulan yang angka ESB-nya sudah
  -- dinyatakan salah (`grossDiketik()`, `src/lib/data/kpi.ts`). Angkanya tetap
  -- disimpan apa adanya supaya cocok dengan halaman Daily, tapi penandanya ikut
  -- supaya yang menilai tidak memakai angka yang sudah dinyatakan tidak sah.
  sumber_sah        boolean not null default true,

  kelengkapan_persen numeric,
  jumlah_hari        integer,

  -- ── versi: riwayat disimpan, bukan ditimpa ──
  versi             integer not null default 1,
  terkini           boolean not null default true,

  dihitung_pada     timestamptz not null default now(),
  dibuat_pada       timestamptz not null default now(),
  catatan           text,

  constraint kpi_values_skala_check  check (skala in ('harian', 'mingguan', 'bulanan', 'kuartalan', 'tahunan')),
  constraint kpi_values_status_check check (status in ('final', 'sementara', 'tidak_tersedia', 'invalid')),
  constraint kpi_values_versi_check  check (versi >= 1),

  -- Bentuk periode WAJIB cocok dengan skalanya. Tanpa ini, "2026-08" bisa
  -- masuk sebagai nilai harian dan diam-diam menjadi satu hari yang tidak
  -- pernah ada.
  constraint kpi_values_periode_bentuk check (
    (skala = 'harian'    and periode ~ '^\d{4}-\d{2}-\d{2}$') or
    (skala = 'mingguan'  and periode ~ '^\d{4}-W\d{2}$')      or
    (skala = 'bulanan'   and periode ~ '^\d{4}-\d{2}$')       or
    (skala = 'kuartalan' and periode ~ '^\d{4}-Q[1-4]$')      or
    (skala = 'tahunan'   and periode ~ '^\d{4}$')
  ),

  -- Cakupan wajib sepakat dengan penunjuk yang benar-benar terisi.
  constraint kpi_values_cakupan_cocok check (
    (cakupan = 'outlet'   and outlet_id is not null and area_id is null) or
    (cakupan = 'area'     and area_id   is not null and outlet_id is null) or
    (cakupan = 'korporat' and outlet_id is null     and area_id is null)
  ),

  -- Status yang menyatakan angkanya tidak ada TIDAK BOLEH membawa angka, dan
  -- sebaliknya. Baris ber-status `tidak_tersedia` dengan nilai 0 adalah cara
  -- paling halus membuat "datanya belum masuk" terbaca "outletnya tidak jualan".
  constraint kpi_values_nilai_sepakat check (
    (status in ('tidak_tersedia', 'invalid') and nilai is null) or
    (status in ('final', 'sementara'))
  ),

  constraint kpi_values_kelengkapan_check check (
    kelengkapan_persen is null or (kelengkapan_persen >= 0 and kelengkapan_persen <= 100)
  )
);

-- Satu angka berlaku per KPI per cakupan per periode. Versi lama tetap
-- tersimpan; yang dibatasi hanya berapa banyak yang boleh berstatus terkini.
create unique index if not exists kpi_values_terkini_unik
  on kpi_values (kpi_definition_id, cakupan, cakupan_id, periode, skala)
  where terkini;

-- Versi yang sama tidak boleh dimasukkan dua kali, termasuk yang sudah tidak
-- terkini. Ini yang membuat perhitungan ulang aman diulang: percobaan kedua
-- ditolak basis data, bukan menghasilkan baris kembar.
create unique index if not exists kpi_values_versi_unik
  on kpi_values (kpi_definition_id, cakupan, cakupan_id, periode, skala, versi);

create index if not exists kpi_values_periode_idx on kpi_values (periode, skala);
create index if not exists kpi_values_outlet_idx  on kpi_values (outlet_id) where outlet_id is not null;
create index if not exists kpi_values_area_idx    on kpi_values (area_id) where area_id is not null;
create index if not exists kpi_values_definisi_idx on kpi_values (kpi_definition_id);

alter table kpi_values enable row level security;

/* ════════════════════════════ 3 · targets ════════════════════════════ */

-- Angka yang dikejar. Bentuknya sengaja sejajar dengan `kpi_values` supaya
-- capaian bisa dihitung dengan menggabungkan keduanya pada kunci yang sama.
--
-- PHASE 2A HANYA MENULIS TARGET BERUMUS. Target yang diketik tangan beserta
-- alur persetujuannya (AD-05: pembuat target tidak boleh menyetujui targetnya
-- sendiri) BUKAN bagian phase ini. Kolomnya sudah disediakan supaya alur itu
-- bisa ditambahkan tanpa mengubah skema, dan CHECK di bawah memastikan target
-- tangan tidak bisa lahir tanpa nama pembuatnya.
create table if not exists targets (
  id                bigint generated always as identity primary key,
  kpi_definition_id text not null references kpi_definitions (id) on delete restrict,

  outlet_id         text references outlets (id) on delete restrict,
  area_id           text references areas (id) on delete restrict,
  cakupan           text not null,
  cakupan_id        text generated always as (coalesce(outlet_id, area_id, '~korporat')) stored,

  periode           text not null,
  skala             text not null,
  nilai             numeric not null,

  -- ── asal-usul ──
  sumber            text not null,
  rumus             text,
  rumus_versi       integer,
  -- Angka masukan rumusnya ikut disimpan. Rata-rata tiga bulan bisa berubah
  -- kalau bulan lalu ditarik ulang; tanpa ini, target lama tidak bisa
  -- dijelaskan lagi enam bulan kemudian.
  dasar             jsonb,

  status            text not null default 'berlaku',
  versi             integer not null default 1,
  terkini           boolean not null default true,

  dihitung_pada     timestamptz not null default now(),
  dibuat_oleh       text references users (id) on delete restrict,
  dibuat_pada       timestamptz not null default now(),
  catatan           text,

  constraint targets_skala_check  check (skala in ('harian', 'mingguan', 'bulanan', 'kuartalan', 'tahunan')),
  constraint targets_sumber_check check (sumber in ('rumus', 'manual')),
  constraint targets_status_check check (status in ('draf', 'berlaku', 'diganti')),
  constraint targets_versi_check  check (versi >= 1),

  constraint targets_periode_bentuk check (
    (skala = 'harian'    and periode ~ '^\d{4}-\d{2}-\d{2}$') or
    (skala = 'mingguan'  and periode ~ '^\d{4}-W\d{2}$')      or
    (skala = 'bulanan'   and periode ~ '^\d{4}-\d{2}$')       or
    (skala = 'kuartalan' and periode ~ '^\d{4}-Q[1-4]$')      or
    (skala = 'tahunan'   and periode ~ '^\d{4}$')
  ),

  constraint targets_cakupan_cocok check (
    (cakupan = 'outlet'   and outlet_id is not null and area_id is null) or
    (cakupan = 'area'     and area_id   is not null and outlet_id is null) or
    (cakupan = 'korporat' and outlet_id is null     and area_id is null)
  ),

  -- Target berumus wajib menyebut rumusnya; target tangan wajib menyebut
  -- orangnya. Tidak ada target yang boleh muncul tanpa bisa dipertanggungjawabkan
  -- kepada salah satu dari keduanya.
  constraint targets_asal_jelas check (
    (sumber = 'rumus'  and rumus is not null and rumus_versi is not null) or
    (sumber = 'manual' and dibuat_oleh is not null)
  )
);

create unique index if not exists targets_terkini_unik
  on targets (kpi_definition_id, cakupan, cakupan_id, periode, skala)
  where terkini;

create unique index if not exists targets_versi_unik
  on targets (kpi_definition_id, cakupan, cakupan_id, periode, skala, versi);

create index if not exists targets_periode_idx on targets (periode, skala);
create index if not exists targets_outlet_idx  on targets (outlet_id) where outlet_id is not null;

alter table targets enable row level security;

/* ═════════════════════════ 4 · katalog KPI Sales ═════════════════════════ */

-- Lima KPI Sales. Dimasukkan di sini, bukan lewat kode, supaya katalognya ikut
-- terbawa ke setiap basis data yang menjalankan migrasi ini — termasuk basis
-- data uji — dan supaya `kpi_values` tidak pernah menunjuk definisi yang belum
-- ada.
insert into kpi_definitions (id, kode, nama, kelompok, satuan, arah, skala, agregasi, urutan, keterangan)
values
  ('sales.gross_sales', 'gross_sales', 'Gross Sales', 'sales', 'rupiah', 'naik_baik', 'harian', 'jumlah', 10,
   'Penjualan kotor dari seasonal_daily, hanya cabang yang dimiliki outlet aktif.'),
  ('sales.net_sales', 'net_sales', 'Net Sales', 'sales', 'rupiah', 'naik_baik', 'harian', 'jumlah', 20,
   'Penjualan bersih dari seasonal_daily, hanya cabang yang dimiliki outlet aktif.'),
  ('sales.average_transaction', 'average_transaction', 'Average Transaction', 'sales', 'rupiah', 'naik_baik', 'bulanan', 'rasio', 30,
   'Net sales dibagi jumlah bill. Null bila jumlah bill tidak pernah terukur atau nol.'),
  ('sales.monthly_target', 'monthly_target', 'Target Bulanan', 'sales', 'rupiah', 'netral', 'bulanan', 'tidak', 40,
   'Rata-rata tiga bulan penuh sebelumnya ditambah laju pertumbuhan. Outlet yang belum genap tiga bulan tidak diberi target.'),
  ('sales.achievement', 'achievement', 'Capaian', 'sales', 'persen', 'naik_baik', 'bulanan', 'rasio', 50,
   'Net sales dibagi target bulanan. Null bila targetnya tidak ada — bukan nol.')
on conflict (id) do nothing;
