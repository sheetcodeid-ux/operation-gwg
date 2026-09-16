# Operational V.1 — Keputusan Terkunci

Keputusan di halaman ini **sudah diputuskan pemiliknya** dan menjadi dasar seluruh
implementasi. Yang hendak mengubahnya menambahkan keputusan baru di bawah, lengkap
dengan tanggal dan alasannya — jangan menyunting yang lama. Keputusan yang diubah
diam-diam meninggalkan kode yang mengikuti aturan lama tanpa ada yang tahu kenapa.

Dikunci: 16 September 2026.

---

## AD-01 · §34-1 — Autentikasi

**Migrasi ke Supabase Auth TIDAK dilakukan di dalam Operational V.1.**

V.1 memakai autentikasi existing apa adanya: cookie HMAC `gwg_uid`
(`src/lib/auth.ts`), RBAC existing (`src/lib/rbac.ts`), dan pembatasan menu
existing (`src/lib/nav.ts::canReachMenu`).

Yang dipakai V.1 sebagai gantinya:

- `src/lib/ops/scope-v1.ts` — satu pintu pembatasan cakupan outlet
- pemeriksaan izin di server pada setiap server action
- FK dan CHECK constraint pada seluruh tabel V.1
- deny-all RLS sebagai tripwire terdokumentasi

**Kenapa migrasinya ditunda, bukan dibatalkan.** Policy RLS bersandar pada
`auth.uid()`. Identitas utama aplikasi ini adalah cookie HMAC yang tidak pernah
sampai ke Postgres; jalur Supabase Auth yang ada cuma cadangan dan dicocokkan
lewat email (`src/lib/auth.ts:95-103`), bukan lewat `auth.uid()`. Menjalankan RLS
sungguhan berarti memindahkan 122 akun, menulis ulang `auth.ts`, mengganti klien
service-role dengan klien per-pengguna, dan membongkar model hidrasi yang membaca
seluruh tabel dalam satu proses. Itu proyek tersendiri, bukan sisipan.

**Syarat yang mengikat V.1:** jangan membuat ketergantungan baru yang mempersulit
migrasi itu. Tabel V.1 menyimpan identitas pengguna dengan bentuk yang sama
seperti tabel existing (`users.id`, teks), supaya policy bisa ditambahkan kelak
tanpa mengubah skema.

---

## AD-02 · §34-2 — Ambang Sewa

**Sewa = 5%.**

Angka existing di basis data **tidak diubah dan tidak dihapus**. Per 16 September
2026, `op_settings.data.expenseThresholds.sewa` bernilai `3` dan tetap bernilai
`3`; halaman `/operation/settings` terus membacanya seperti biasa.

Operational V.1 memakai **Rule Version tersendiri** dengan ambang 5%. Dua angka
itu hidup berdampingan dengan sengaja: yang lama menilai laporan lama dengan
aturan yang berlaku saat itu, yang baru menilai mulai tanggal berlakunya.

**Larangan:** angka 5 tidak boleh ditulis di komponen UI, tidak boleh disalin ke
banyak berkas. Satu-satunya tempatnya `rule_conditions.nilai_ambang`.

Catatan lapangan: `op_settings` sudah menyimpan `manajemen_fee: 5` padahal
bawaannya `3` (`src/lib/ops/settings-types.ts:15`). Jadi ambang memang sudah
disesuaikan lewat halaman pengaturan, dan tabelnya memang dipakai.

---

## AD-03 · §34-3 — Pemecahan Utilitas

**Utilitas dipecah menjadi KPI terpisah: Electricity, Water, Internet, Cleaning.**

Tujuannya supaya empat KPI itu bisa dihitung sendiri-sendiri. Sekarang tidak
bisa: `op_expenses.utilitas` adalah satu kolom tunggal
(`src/lib/ops/categories.ts:3`).

**Skema tidak diubah sekarang.** Urutan yang wajib dilalui lebih dulu:

1. periksa skema `op_expenses` apa adanya
2. periksa template unggah (`src/lib/ops/template-unggah.ts`)
3. periksa seluruh pembaca dan penulisnya
4. periksa data yang sudah ada
5. pastikan perubahannya bisa aditif
6. baru diimplementasikan pada phase yang sesuai

**Hasil periksa awal (16 September 2026):**

- `op_expenses`: 174 baris, 58 outlet, Juli–September 2026
- `utilitas` terisi di **128 baris**, total **Rp 1.390.752.683**
- pembaca/penulis: `src/lib/data/ops-finance.ts` (satu-satunya yang menyentuh
  tabelnya), `src/lib/data/ops-dashboard.ts`
- `EXPENSE_COLS` dipakai 9 berkas — menambah kolom menyentuh semuanya

**Kesimpulan: aditif, bisa.** Tambah empat kolom baru bernilai null, biarkan
`utilitas` tetap ada sebagai jumlah. Baris lama yang cuma punya angka gabungan
tetap sah dan tetap terbaca; yang baru mengisi rinciannya. **Rp 1,39 miliar data
utilitas existing tidak boleh hilang.**

---

## AD-04 · §34-4 — Outlet `gross_manual`

**Outlet `gross_manual` TIDAK boleh dianggap punya penjualan harian otomatis.**

Per 16 September 2026 ada **5 outlet** ber-`gross_manual = true` dari 58 outlet
aktif.

Yang dilarang, tanpa kecuali:

- membuat rumus perkiraan omzet sendiri
- mengarang penjualan harian
- memakai angka sintetis sebagai actual
- membuat Impact terlihat sah padahal baselinenya tidak ada

**Kalau actual atau baseline tidak bisa dihitung dari data yang sah, hasil Impact
= `INCONCLUSIVE`.** Itu jawaban yang benar, bukan kegagalan sistem.

Pengukuran manual boleh, dengan syarat lengkap: `sumber = 'manual'`, ada
persetujuan, ada bukti, tercatat di audit log, dan bisa ditelusuri siapa yang
memasukkan serta siapa yang menyetujui.

---

## AD-05 · §34-5 — Persetujuan Target Manual

**Pembuat target tidak boleh menyetujui targetnya sendiri.**
Ditegakkan di server: `approval.approver_id != target.dibuat_oleh`.

Yang boleh menyetujui:

| Peran | Boleh menyetujui target |
|---|---|
| `super_admin` | ya, sesuai governance existing |
| `head_operation` | ya, untuk target Operational |
| `area_coordinator` | **tidak** |
| `supervisor` | **tidak** |

Coordinator Area dan Supervisor tidak otomatis mendapat hak ini hanya karena bisa
melihat atau mengelola outlet.

**Dasarnya governance yang sudah berlaku, bukan hierarki baru.**
`src/lib/kpi/akses.ts:31` sudah memutuskan hal yang sama untuk angka bulanan per
outlet: yang dinilai tidak boleh mengetik angka yang menilainya, karena ketiga
angka itu bergerak searah dengan skornya. Target adalah angka yang sama sifatnya.
Pembanding lain yang sudah ada: persetujuan komplain dipegang `area_coordinator`
atau `super_admin` (`src/lib/complaints-access.ts:55`), dan pengaturan KPI hanya
`super_admin` (`src/lib/kpi/akses.ts:15`).

---

## AD-06 · §34-6 — Peta Izin V.1

| Peran | Kemampuan |
|---|---|
| `super_admin` | seluruh izin V.1 |
| `head_operation` | seluruh izin V.1 kecuali `manage_rules`, bila governance memang memisahkannya |
| `area_coordinator` | lihat sesuai cakupan · `create_diagnosis` · `assign_action` · `verify_execution` |
| `supervisor` | lihat action miliknya · jalankan action · unggah bukti · submit action |
| `member` | izin existing + departemen/bidang + cakupan outlet (`src/lib/ops/bidang.ts`) |

**Supervisor tidak boleh memverifikasi action miliknya sendiri**, baik verifikasi
eksekusi maupun verifikasi dampak.

**Aturan yang mengikat seluruh verifikasi:**

```
verification.verifier_id != action.primary_owner_id
```

Ditegakkan di server, bukan di UI. Tombol yang tidak tampil bukan berarti aksinya
tidak bisa dipanggil.

---

## Keputusan yang masih terbuka

Yang berikut **belum** diputuskan dan tidak boleh ditebak. Nomor mengikuti §34
pada blueprint.

| # | Pertanyaan | Memblokir |
|---|---|---|
| 7 | PBJT masuk ke kategori mana? Tidak ditemukan di skema mana pun | PHASE 2B |
| 8 | Platform fee / delivery fee / ekspedisi masuk `potongan`, `ongkos_kirim`, atau `lainnya`? | PHASE 2B |
| 9 | Sumber data cuaca dan kompetitor untuk External Factor | PHASE 10 |
| 10 | Audit log menyimpan IP dan user-agent? Ada implikasi privasi karyawan | PHASE 12 |
| 11 | Playbooks muncul di dua menu (Intelligence + Learning) — perlu atau membingungkan? | PHASE 11 |
| 12 | Capaian divisi: rata-rata per posisi atau per orang? | — |
| 13 | Radika ikut rata-rata PDQ? | — |
| 14 | Ambang kelengkapan data sebelum Signal boleh lahir — usul 95% | PHASE 4 |
| 15 | Cabang ESB `57-fnb_nord` tanpa outlet — outlet baru atau sisa? | **sudah diselidiki, lihat di bawah** |
| 16 | Signal boleh lahir dari baris ber-`sumber_sah = false`? Usul: tidak | PHASE 4 |

**Nomor 7 dan 8 memblokir PHASE 2B, bukan 2A.** Pemiliknya sudah menjelaskan
asalnya: PBJT dan platform fee keduanya datang dari laporan keuangan, dimasukkan
lewat template unggah bulanan. Yang belum diputuskan **kolom mana yang
menampungnya** — dan `op_expenses` belum punya kolom untuk keduanya.

Satu hal yang wajib diperiksa sebelum kolomnya ditambahkan:
`op_expenses.ongkos_kirim` sudah berisi Rp 101.641.586 pada 74 baris. Kalau
sebagiannya sudah memuat potongan platform, menambah kolom baru tanpa memeriksa
itu lebih dulu akan menghitung biaya yang sama dua kali — dan hasilnya tetap
terlihat masuk akal.

---

## Temuan PHASE 1 — dua cabang ESB tanpa outlet

Diselidiki 16 September 2026. **Tidak ada pemetaan yang diubah, tidak ada outlet
yang dibuat, tidak ada baris yang dihapus.**

`seasonal_daily` memuat 60 cabang; 58 di antaranya cocok dengan outlet. Dua yang
tidak:

### `1-fnb_nord` — HEAD OFFICE, dan itu memang benar

52 hari (18 Juli – 7 September 2026), **net Rp 0**.

Ada outlet bernama **HEAD OFFICE** yang `code`-nya justru `1-fnb_nord`, tapi
`esb_branch_id`-nya null dan tetap aktif. Jadi kantor pusat terdaftar sebagai
cabang di ESB, wajar tidak berjualan.

Ini sekaligus menjawab temuan audit "1 outlet aktif tanpa cabang ESB": outlet
itu HEAD OFFICE, bukan gerai. **Tidak ada satu pun gerai yang kehilangan
penjualannya.** Tidak ada yang perlu diperbaiki.

### `57-fnb_nord` — kemungkinan besar Nordu Coffee Singkawang Garden

78 hari (23 Juni – 8 September 2026), Rp 164.030.635, lalu berhenti — sembilan
hari sebelum data terakhir tabelnya (17 September).

Ada outlet **Nordu Coffee Singkawang Garden** (`code` NCGN) yang
`esb_branch_id`-nya null dan `active = false`. Pola berhentinya cocok dengan
outlet yang ditutup.

**Ini HIPOTESIS, bukan fakta.** Tidak ada satu kolom pun yang menghubungkan
keduanya; yang cocok cuma waktunya. Yang bisa memastikan: catatan ESB tentang
cabang 57, atau orang yang tahu kapan Singkawang Garden tutup.

**Dampaknya nol untuk V.1 sekarang.** Aturan `sales-fact.ts` sudah membuang
kedua cabang ini karena tidak punya outlet. Rp 164 juta itu tidak ikut ke angka
mana pun, dan itu memang yang benar selama pemetaannya belum dipastikan.

**Kalau kelak terbukti benar** dan outletnya perlu dihidupkan lagi beserta
penjualannya, itu perubahan master data — bukan pekerjaan fondasi, dan bukan
sesuatu yang boleh diputuskan dari sini.

---

## Temuan PHASE 2A — direktori migrasi bukan salinan skema produksi

Diperiksa 16 September 2026, lewat SELECT saja. **Tidak ada satu pun perintah
yang mengubah produksi.**

| | Jumlah |
|---|---|
| Catatan di `supabase_migrations.schema_migrations` (produksi) | **158** |
| Berkas di `supabase/migrations/` | **102** |
| Catatan produksi yang TIDAK punya berkas di repo | **68** |
| Berkas di repo yang tidak ada catatannya di produksi | 11 |

Di antara yang tidak punya berkas: `init_operation_gwg_schema`,
`assessment_schema`, `op_finance_expenses_purchases`, `seasonal_daily_cache`,
`system_requests`, `marcomm_reviews`, `performance_indexes`, `outlet_owner`, dan
seluruh rangkaian `elearning_phase*`.

Buku besar produksi juga memakai versi bertanggal (`20260916093259`), bukan
nomor urut `0103`, jadi tidak ada bentrokan nomor ke arah mana pun.

**Akibatnya untuk seluruh phase berikutnya:** migrasi V.1 ditulis terhadap
**skema produksi yang diperiksa langsung**, bukan terhadap hasil pemutaran ulang
berkas-berkas di direktori itu. Memutar ulang direktori ini pada basis data
kosong menghasilkan 60 dari 102 — dan bentuk yang dihasilkannya bukan bentuk
produksi.

**Yang sudah dilakukan:** perancah `scripts/test-db.mjs` memakai tipe kolom hasil
periksa langsung (`outlets.id`, `areas.id`, `users.id` semuanya `text`).

**Yang belum dan bukan pekerjaan phase ini:** merapikan direktori migrasi supaya
benar-benar mereproduksi produksi. Itu pekerjaan tersendiri, dan mengerjakannya
setengah jadi lebih berbahaya daripada tidak sama sekali.

---

## Temuan PHASE 2A — angka Agustus 2026, terbukti

Dijalankan pada PostgreSQL lokal dengan data Agustus 2026 yang sesungguhnya
(1.860 baris `seasonal_daily`, 59 outlet, 174 baris `esb_net_bulanan`).
Produksi hanya dibaca.

| | |
|---|---|
| `SUM(net)` mentah seluruh tabel | Rp 26.651.072.202 |
| setelah aturan `sales-fact.ts` | **Rp 13.244.568.329** |
| selisih | Rp 13.406.503.873 |

Yang dibuang, satu per satu:

| Cabang | Baris | Net | Kenapa |
|---|---|---|---|
| `''` | 31 | Rp 13.325.523.600 | balasan ESB untuk "seluruh cabang" — bukan outlet |
| `1-fnb_nord` | 31 | Rp 0 | cabang HEAD OFFICE; outletnya memang tidak punya `esb_branch_id` |
| `57-fnb_nord` | 31 | Rp 80.980.273 | tidak dimiliki outlet mana pun |

Baris korporat Rp 13.325.523.600 versus jumlah seluruh cabang
Rp 13.325.548.602 — **beda Rp 25.002**, data cabang yang datang belakangan,
bukan kesalahan hitung.

**Koreksi terhadap catatan PHASE 1.** Di atas tertulis "58 di antaranya cocok
dengan outlet". Yang benar **57**: 58 outlet aktif, satu di antaranya
(HEAD OFFICE) tidak punya `esb_branch_id`, jadi cabang yang terpetakan 57 dan
cabang yatim ada dua, bukan satu. Kesimpulannya tidak berubah — tidak ada satu
gerai pun yang kehilangan penjualannya — tapi angkanya diperbaiki di sini supaya
tidak dipakai orang lain sebagai patokan.

**Rekonsiliasi:** untuk 57 outlet, A (halaman Daily) = B (`sales-fact.ts`) =
C (KPI V.1 yang sudah tersimpan). Tidak ada satu pun yang berbeda.

---

## Nomor 16 · Angka ESB yang sudah dinyatakan tidak berlaku — DIPUTUSKAN SEMENTARA

**Pertanyaannya.** `outlets.esb_mulai` dan `outlets.esb_abaikan` menandai
bulan-bulan yang angka ESB-nya sudah dinyatakan salah bagi sebuah outlet
(`grossDiketik()`, `src/lib/data/kpi.ts`). KPI Coordinator Area menghormatinya:
bulan yang ditandai memakai angka ketikan, bukan ESB.

Halaman Daily **tidak** menghormatinya — ia membaca `seasonal_daily` apa adanya.

Jadi KPI Sales V.1 harus ikut yang mana?

**Yang dilakukan PHASE 2A, dan kenapa.** Angkanya **tetap dicatat apa adanya**,
tapi barisnya ditandai `kpi_values.sumber_sah = false` beserta catatannya.

- Membuangnya akan membuat V.1 berbeda dari halaman Daily tanpa sebab yang bisa
  dibaca siapa pun dari layar.
- Menerimanya diam-diam akan membuat angka yang sudah dinyatakan salah ikut
  menilai orang.

Menandainya menjaga dua-duanya: rekonsiliasi tetap bersih, dan yang menilai
punya alasan untuk menolak memakainya.

**Agustus 2026:** satu outlet terkena — Nordu Coffee Siantan
(`esb_mulai = 2026-09`), dan nilainya memang Rp 0, jadi dampaknya nol untuk
sekarang.

**Yang masih terbuka bagi pemilik:** apakah PHASE 4 boleh melahirkan Signal dari
baris ber-`sumber_sah = false`. Usul: tidak boleh. Belum diputuskan.

---

## Backfill PRODUKSI Agustus 2026 — sudah dijalankan

Disetujui pemilik dan dijalankan 16 September 2026.

### Yang dijalankan

| Catatan di buku besar produksi | Isi |
|---|---|
| `kpi_target` | migrasi 0103 — tiga tabel, lima definisi KPI Sales |
| `backfill_kpi_sales_2026_08_a` | 150 baris `kpi_values` (30 outlet) |
| `backfill_kpi_sales_2026_08_b` | 142 baris `kpi_values` (28 outlet + 2 korporat) |
| `backfill_target_sales_2026_08` | 44 baris `targets` |

Ditulis lewat jalur migrasi karena `execute_sql` pada sambungan ini bersifat
read-only — dan itu penjagaan yang benar. Proyek ini memang sudah memakai
migrasi untuk perubahan data (`pasang_banjarbaru_2`,
`nonaktifkan_singkawang_garden`, `dita_jabatan_social_media`).

### Kenapa isinya tidak disimpan sebagai berkas di repo

292 + 44 baris itu **angka turunan**, bukan keputusan. Satu-satunya sumbernya
`hitungSales()` dan `hitungTargetSales()`; menyalinnya ke repo membuat salinan
kedua yang bisa berbeda dari yang menghasilkannya. Yang disimpan di repo
**pembangkitnya**:

```
npm run test:db -- --data <folder> --keluar backfill-2026-08.sql
```

Berkas data masukannya tidak disimpan di repo — isinya penjualan harian tiap
outlet.

### Bukti bahwa masukannya memang data produksi

Sebelum satu baris pun ditulis, isi basis data lokal dibandingkan dengan
produksi lewat md5 atas seluruh baris, dengan urutan `collate "C"` di kedua
sisi:

| | Produksi | Lokal |
|---|---|---|
| `seasonal_daily` Agustus 2026 | `db364ea0315385416cb7e4c51ec6cc9e` | sama |
| `outlets` | `dfeaee7e8ca5d3e19a09623ee24c606c` | sama |

1.860 baris, total mentah Rp 26.651.072.202 — cocok di kedua sisi.

### Verifikasi SESUDAH ditulis, terhadap data produksi sendiri

Bukan terhadap berkas yang barusan dikirim, melainkan terhadap `seasonal_daily`
dan `esb_net_bulanan` produksi:

| Yang diperiksa | Hasil |
|---|---|
| `net_sales` vs `sum(seasonal_daily.net)` per outlet | **0 berbeda** |
| `gross_sales` vs sumber yang sama | **0 berbeda** |
| `average_transaction` vs `net / bills` | **0 berbeda** |
| `achievement` vs `net / target × 100` | **0 berbeda** |
| `targets.nilai` vs `kpi_values.monthly_target` | **0 berbeda** |
| `targets.nilai` vs rata-rata tiga bulan `esb_net_bulanan` × 1,15 | **0 berbeda** |
| target bersumber tangan | **0** |
| target tanpa rumus atau tanpa `dasar` | **0** |

Jumlah akhir: 292 baris `kpi_values` (58 outlet × 5 + 2 korporat) dan 44 baris
`targets`. Jumlah seluruh outlet = angka korporat = **Rp 13.244.568.329**.

### RLS sesudah backfill

`kpi_definitions`, `kpi_values`, dan `targets` kini ikut dalam 109 tabel
ber-`rls_enabled_no_policy` — level **INFO**, bukan temuan keamanan, dan memang
sikap yang dikunci `0004_lockdown_rls_and_rpc.sql`. Tidak ada policy permisif
yang ditambahkan. Dua peringatan lain pada proyek (`pg_net` di schema public,
proteksi kata sandi bocor) sudah ada sebelumnya dan tidak berhubungan.

### Yang BELUM ada, dan jangan dikira ada

**Belum ada jalur tulis berulang.** Backfill ini sekali jalan. Belum ada cron,
belum ada server action, belum ada halaman yang memanggil `hitungSales()`.
September 2026 dan seterusnya **tidak akan terisi sendiri**.

Membangunnya butuh satu rute yang berjalan di server dengan service role —
pekerjaan kecil, tapi pekerjaan yang belum dilakukan, dan menyebutnya selesai
sekarang berarti seseorang akan menunggu angka yang tidak akan pernah datang.
