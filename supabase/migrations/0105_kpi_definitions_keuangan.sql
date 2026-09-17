-- Operational V.1 · PHASE 2C — katalog empat belas KPI keuangan.
--
-- HANYA BARIS KATALOG. Tidak ada tabel baru, tidak ada kolom baru, tidak ada
-- satu pun baris finansial yang disentuh. `kpi_definitions` dan `kpi_values`
-- dari 0103 sudah menampung seluruhnya apa adanya:
--
--   kelompok 'biaya'   sudah ada di CHECK-nya
--   satuan   'persen'  sudah ada di CHECK-nya
--   cakupan  outlet / area / korporat sudah didukung
--   grain    (kpi, cakupan, cakupan_id, periode, skala) sudah unik
--
-- Karena itu Phase 2C tidak menambah tabel penyimpanan KPI kedua.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CATATAN ISTILAH — jangan dilewati
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Indikator existing `hpp_kpk` di KPI Supervisor BUKAN harga pokok. Ia
-- pembelian warehouse + non-warehouse dibagi omzet; komentar di
-- `src/lib/data/kpi.ts` menyatakannya sendiri. Istilah lamanya TIDAK diubah.
--
--   `hpp_kpk` (lama)          = `biaya.total_purchase_pct` (di sini)
--   `biaya.hpp_pct` (di sini) = harga pokok dari laporan keuangan (`op_pnl.hpp`)
--
-- Keduanya juga berbeda DASAR omzetnya: yang lama memakai `esb_net_bulanan`
-- lewat `grossOutlet()`, yang di sini memakai `seasonal_daily` lewat
-- `sales-fact.ts` — sumber yang sama dengan seluruh Phase 2A. Untuk Agustus
-- 2026 keduanya berbeda Rp 25.002 dari Rp 13,2 miliar pada 10 dari 57 outlet.
-- Keputusan pemiliknya: V.1 memakai sales-fact, dan yang lama dibiarkan
-- melayani KPI Supervisor tanpa diubah.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- KETERBATASAN YANG DITERIMA SADAR
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Empat belas kolom angka lama di `op_expenses`, `op_purchases`, dan `op_pnl`
-- bertipe `numeric not null default 0` sejak `0017_op_finance.sql`. Di sana
-- "dilaporkan nol" dan "belum dilaporkan" TIDAK BISA DIBEDAKAN. KPI yang
-- bersumber dari kolom-kolom itu membaca nol apa adanya — keterbatasannya
-- ditulis di `keterangan` masing-masing, bukan disembunyikan.
--
-- Enam kolom Phase 2B (listrik, air, internet, kebersihan, platform_fee, pbjt)
-- tidak mewarisi keterbatasan itu: NULL tetap NULL, dan KPI-nya
-- `tidak_tersedia` — bukan 0%.

insert into kpi_definitions (id, kode, nama, kelompok, satuan, arah, skala, agregasi, urutan, keterangan)
values
  -- ── pembelian ──
  ('biaya.warehouse_pct', 'warehouse_pct', 'Warehouse Purchase %', 'biaya', 'persen', 'turun_baik', 'bulanan', 'rasio', 110,
   'op_purchases.warehouse dibagi omzet sales-fact. Nol pada kolom lama tidak bisa dibedakan dari belum dilaporkan.'),
  ('biaya.non_warehouse_pct', 'non_warehouse_pct', 'Non-Warehouse Purchase %', 'biaya', 'persen', 'turun_baik', 'bulanan', 'rasio', 120,
   'op_purchases.non_warehouse dibagi omzet sales-fact. Nol pada kolom lama tidak bisa dibedakan dari belum dilaporkan.'),
  ('biaya.total_purchase_pct', 'total_purchase_pct', 'Total Purchase %', 'biaya', 'persen', 'turun_baik', 'bulanan', 'rasio', 130,
   'warehouse + non_warehouse dibagi omzet sales-fact. Sama konsepnya dengan indikator lama hpp_kpk, tapi dasar omzetnya seasonal_daily, bukan esb_net_bulanan.'),

  -- ── harga pokok dan hasil ──
  ('biaya.hpp_pct', 'hpp_pct', 'HPP %', 'biaya', 'persen', 'turun_baik', 'bulanan', 'rasio', 140,
   'op_pnl.hpp dibagi omzet sales-fact. Harga pokok dari laporan keuangan — BUKAN keluaran kalkulator HPP.'),
  ('biaya.net_profit_pct', 'net_profit_pct', 'Net Profit %', 'biaya', 'persen', 'naik_baik', 'bulanan', 'rasio', 250,
   'op_pnl.laba_bersih dibagi omzet sales-fact. Laba diambil apa adanya dari laporan keuangan, tidak dihitung ulang dari omzet dikurangi biaya.'),

  -- ── beban operasional ──
  ('biaya.labor_pct', 'labor_pct', 'Labor %', 'biaya', 'persen', 'turun_baik', 'bulanan', 'rasio', 150,
   'op_expenses.tenaga_kerja dibagi omzet sales-fact. Nol pada kolom lama tidak bisa dibedakan dari belum dilaporkan.'),
  ('biaya.rent_pct', 'rent_pct', 'Rent %', 'biaya', 'persen', 'turun_baik', 'bulanan', 'rasio', 160,
   'op_expenses.sewa dibagi omzet sales-fact. Ambangnya BELUM ditetapkan di sini — rule versioning Phase 3.'),
  ('biaya.other_pct', 'other_pct', 'Other %', 'biaya', 'persen', 'turun_baik', 'bulanan', 'rasio', 240,
   'op_expenses.lainnya dibagi omzet sales-fact. Nilai historis dapat memuat biaya yang belum terurai, termasuk kemungkinan komisi platform, karena platform_fee baru tersedia mulai V.1.'),

  -- ── rincian utilitas, kolom baru Phase 2B ──
  ('biaya.electricity_pct', 'electricity_pct', 'Electricity %', 'biaya', 'persen', 'turun_baik', 'bulanan', 'rasio', 170,
   'op_expenses.listrik dibagi omzet sales-fact. NULL berarti belum pernah dirinci — angkanya masih menyatu di dalam utilitas, bukan nol rupiah.'),
  ('biaya.water_pct', 'water_pct', 'Water %', 'biaya', 'persen', 'turun_baik', 'bulanan', 'rasio', 180,
   'op_expenses.air dibagi omzet sales-fact. NULL berarti belum pernah dirinci, bukan nol rupiah.'),
  ('biaya.internet_pct', 'internet_pct', 'Internet %', 'biaya', 'persen', 'turun_baik', 'bulanan', 'rasio', 190,
   'op_expenses.internet dibagi omzet sales-fact. NULL berarti belum pernah dirinci, bukan nol rupiah.'),
  ('biaya.cleaning_pct', 'cleaning_pct', 'Cleaning %', 'biaya', 'persen', 'turun_baik', 'bulanan', 'rasio', 200,
   'op_expenses.kebersihan dibagi omzet sales-fact. NULL berarti belum pernah dirinci, bukan nol rupiah.'),

  -- ── dua beban yang belum pernah ada sebelum V.1 ──
  ('biaya.platform_fee_pct', 'platform_fee_pct', 'Platform Fee %', 'biaya', 'persen', 'turun_baik', 'bulanan', 'rasio', 210,
   'op_expenses.platform_fee dibagi omzet sales-fact. Kolom baru V.1 — NULL untuk seluruh periode sebelum Phase 2B, dan itu berarti belum dilaporkan, bukan nol. BUKAN ongkos_kirim.'),
  ('biaya.pbjt_pct', 'pbjt_pct', 'PBJT %', 'biaya', 'persen', 'turun_baik', 'bulanan', 'rasio', 220,
   'op_expenses.pbjt dibagi omzet sales-fact. Diperlakukan sebagai beban operasional, sebelum laba bersih. Kolom baru V.1 — NULL berarti belum dilaporkan.')
on conflict (id) do nothing;
