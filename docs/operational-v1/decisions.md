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

---

## AD-07 · PHASE 2B — unggah data finansial

Dikunci pemiliknya 17 September 2026, sesudah audit pra-terbang.

### Nomor 7 dan 8 — TERJAWAB

| | Keputusan |
|---|---|
| **PBJT** | Kolom **baru** `op_expenses.pbjt`. Diperlakukan sebagai **beban operasional**: Pendapatan − HPP − Beban(termasuk PBJT) = Laba. Tidak ada tafsir akuntansi pajak lain di phase ini |
| **Platform fee** | Kolom **baru** `op_expenses.platform_fee`. Belum pernah ada sebelumnya |
| **`ongkos_kirim`** | **Bukan** platform fee. Field finansial tersendiri sesuai laporan keuangan, tetap seperti apa adanya |

### Yang TIDAK dilakukan, dan itu yang terpenting

**Tidak ada reklasifikasi historis.** `lainnya`, `ongkos_kirim`, dan `potongan`
tetap di tempatnya. Tidak satu rupiah pun dipindahkan ke `platform_fee` atau
`pbjt`.

Keduanya mulai terisi ketika penggunanya mengisinya — bukan ditebak dari data
lama. Sebabnya: tidak ada yang bisa memastikan bagian mana dari Rp 994.759.528
di `lainnya` yang sebenarnya komisi platform, dan menebaknya berarti menulis
ulang laporan keuangan yang sudah ditutup.

Risiko yang diterima sadar: sampai ada bulan yang mengisi `platform_fee`, biaya
yang sama mungkin masih tercatat di `lainnya`. Perbandingan antar bulan harus
membaca catatan ini lebih dulu.

### Utilitas — satu angka, dua asal

`utilitas` TETAP ADA dan tetap berarti total. Yang berubah asalnya:

| Baris | `utilitas` | Rincian |
|---|---|---|
| Historis (128 baris, Rp 1.390.752.683) | angka agregat apa adanya | **NULL** — belum pernah ada |
| V.1 | **listrik + air + internet + kebersihan** | diisi penggunanya |

Kolom "Utilitas" tetap ada di template demi berkas lama, tapi **bukan lagi
sumber**: begitu satu rincian terisi, angka ketikan diabaikan.

**Yang dijaga uji:** empat kolom rincian TIDAK ikut dijumlah ke total beban —
mereka sudah ada di dalam `utilitas`. Menjumlahkan keduanya membuat tiap rupiah
listrik dihitung dua kali, dan hasilnya tetap terlihat wajar di layar.

### NULL versus 0 — batas yang diterima

| | NULL ≠ 0 |
|---|---|
| 6 kolom baru | ✅ nullable |
| **14** kolom angka lama | ❌ `not null default 0` sejak `0017_op_finance.sql` |

**KOREKSI.** Laporan pra-terbang menyebut "11 kolom existing". Yang benar
**14**: delapan di `op_expenses`, dua di `op_purchases`, empat di `op_pnl`.
Angkanya sekarang dihitung uji, bukan diingat.

Keterbatasan ini **tidak diperbaiki** di phase ini — mengubahnya berarti
menyentuh empat belas kolom yang sedang dipakai. Akibatnya harus diingat siapa
pun yang membaca angka lama: **0 pada kolom lama tidak berarti benar-benar
nol.** Ia bisa berarti belum dilaporkan.

### Duplikat dan idempotensi

| Keadaan | Perlakuan |
|---|---|
| Kode outlet kembar dalam **satu berkas** | **DITOLAK**, kodenya disebutkan. Bukan "yang terakhir menang" |
| Berkas **sama** diunggah ulang | Dikenali lewat sidik isi, tidak ditulis ulang, dilaporkan apa adanya |
| Unggahan **gagal** | Boleh diulang — index uniknya hanya menjaga yang berstatus tersimpan |

Sidiknya dihitung dari isi berkas setelah diurutkan, bukan dari berkas mentah:
Excel gemar mengubah urutan baris tanpa mengubah satu angka pun.

### Rent 5%

Belum disimpan di mana pun. `op_settings.sewa` tetap 3 dan tidak disentuh.
Angka 5 **tidak ditulis** di berkas mana pun — rule versioning-nya Phase 3,
dan menyebarkannya sekarang berarti tetapan yang harus dicari di banyak tempat
saat hendak diubah.

---

## AD-08 · PHASE 2C — empat belas KPI keuangan

Dikunci 17 September 2026. Pemiliknya memilih rekomendasi audit pra-terbang.

### Dua konflik yang diputuskan

**Q1 · Dasar omzet KPI pembelian.** Indikator existing `hpp_kpk` (KPI Supervisor)
memakai `esb_net_bulanan` lewat `grossOutlet()`. V.1 memakai `seasonal_daily`
lewat `sales-fact.ts`, sumber yang sama dengan seluruh Phase 2A.

Untuk Agustus 2026 keduanya berbeda **Rp 25.002 dari Rp 13,2 miliar** pada 10
dari 57 outlet — 0,0002%. Beda sekecil itu tidak sepadan dengan punya dua
sumber omzet.

**Yang lama TIDAK diubah.** `hppKpkPersen()` tetap melayani KPI Supervisor apa
adanya, dan ada uji yang menjaganya tetap ada.

**Q2 · Outlet tanpa belanja.** Yang lama membuangnya (6 outlet Agustus). V.1
memberinya status `tidak_tersedia` — outlet yang hilang dari hasil tidak bisa
dibedakan dari outlet yang terlewat dihitung.

**Q3 · Kelengkapan.** Tidak ada konvensi kelengkapan bulanan finansial di mana
pun, dan untuk 14 kolom lama aturan berbasis nilai memang tidak mungkin dibuat.
Yang dipakai konvensi yang sudah ada di `kpi-sales.ts`: periode selesai →
`final`, periode berjalan → `sementara`.

**Q4 · Nol pada kolom lama.** Dibaca apa adanya sebagai 0%. Keterbatasannya
ditulis di `keterangan` tiap definisi KPI, bukan disembunyikan.

### Catatan istilah — jangan dilewati

Indikator existing `hpp_kpk` **bukan harga pokok**. Ia pembelian warehouse +
non-warehouse dibagi omzet; komentar di `src/lib/data/kpi.ts` menyatakannya
sendiri. Istilah lamanya tidak diubah.

| Lama | V.1 |
|---|---|
| `hpp_kpk` | `biaya.total_purchase_pct` |
| — | `biaya.hpp_pct` = harga pokok dari `op_pnl.hpp` |

### Yang TIDAK dibuat

- **Tidak ada `financial_facts`.** `kpi_definitions` dan `kpi_values` dari 0103
  sudah menampung seluruhnya: `kelompok='biaya'` dan `satuan='persen'` sudah ada
  di CHECK-nya sejak awal. Migrasi 0105 hanya menambah 14 baris katalog.
- **Tidak ada ambang.** Rent 5% tidak ditulis di mana pun; `op_settings.sewa`
  tetap 3 dan ada uji yang menjaganya. Governance tetap Phase 3.
- **Tidak ada Signal, Diagnosis, Action, maupun AI.**

### Korporat bukan rata-rata persen

`Σ biaya ÷ Σ omzet`. Agustus 2026 membuktikan bedanya nyata: Labor tertimbang
**14,11%**, rata-rata persen outlet **16,61%**. Rata-rata membuat outlet
beromzet Rp 20 juta sama beratnya dengan outlet beromzet Rp 900 juta.

Outlet yang omzetnya nol atau belum melapor tidak menyumbang pembilang maupun
penyebut — memasukkan biayanya tanpa omzetnya membuat persen korporat naik
tanpa sebab.

---

## AD-09 · TASK #85 — identitas generasi berbasis isi

Jalur tulis berulang perlu menjawab satu pertanyaan sebelum apa pun bisa
ditulis: **kapan dua jalan dianggap sama?**

Jawaban yang dipakai: **dua jalan sama bila HASILNYA sama.** Bukan bila sebuah
kunci buatan — periode + tanggal + sidik masukan — kebetulan sama.

Kunci buatan bisa gagal menangkap masukan yang berubah, dan kegagalan seperti
itu tidak kelihatan dari mana pun: angkanya tetap masuk akal, cuma basi.
Perbandingan isi tidak bisa salah menurut definisinya. Kalau masukan berubah
tapi angkanya tidak, tidak melahirkan versi baru memang yang benar.

Yang dibandingkan, per grain `(kpi, cakupan, cakupan_id, periode, skala)`:

| Tabel | Kolom pembanding |
|---|---|
| `kpi_values` | `nilai`, `status`, `catatan` |
| `targets` | `nilai` |

Konsekuensinya sengaja: `hitungSales()` ikut menulis `hariBerjalan` dan
`kelengkapanPersen`, yang berubah tiap hari selama bulan berjalan.
`hariBerjalan()` memakai tanggal WIB, jadi stabil di dalam satu hari WIB.
Hasilnya **paling banyak satu versi baru per hari WIB**, dan cron yang
berangkat dua kali dalam sehari adalah no-op.

**Tidak ada kolom baru.** `kpi_values` tidak punya kolom jsonb, dan menambah
kolom `sidik` hanya demi identitas berarti migrasi yang tidak dibutuhkan.

Lifecycle versinya memakai yang sudah disiapkan 0103 dan belum pernah dipakai:
baris lama `terkini = false` (target juga `status = 'diganti'`), baris baru
`versi + 1`, `terkini = true`. **Versi lama tidak pernah dihapus.**

### Kenapa penulisannya sebuah fungsi basis data

PostgREST tidak punya transaksi lintas-pernyataan. Menulis `kpi_values` lalu
`targets` lewat dua panggilan berarti panggilan pertama sudah ter-commit ketika
yang kedua gagal — KPI naik versi, targetnya tertinggal, dan tidak ada layar
yang menunjukkannya. Karena itu `gwg_tulis_kpi_bulanan` (migrasi 0106): satu
transaksi, satu `pg_advisory_xact_lock` per periode, satu nomor versi.

Fungsinya **tidak memuat satu pun rumus KPI** — ia menerima baris yang sudah
jadi. Ada uji basis data yang gagal begitu ada pembagian atau persentase
menyelinap ke dalamnya.

---

## AD-10 · TASK #85 — generasi pertama hanya bulan berjalan

`periodeSelesai` sebelumnya tidak pernah dihitung di mana pun: kedua mesin
menerimanya sebagai MASUKAN, dan tidak ada pemanggil yang mengisinya.
`src/lib/ops/finalisasi.ts` yang menjawabnya sekarang.

### Aturan finalisasi

```
bulan berjalan             → BELUM final, apa pun tanggalnya
bulan lalu, tanggal ≤ 15   → BELUM final
bulan lalu, tanggal > 15   → final
bulan yang lebih lama      → final
```

Tanggal 15 bukan angka baru: ia `TANGGAL_TUTUP_KPI` yang sudah berlaku lewat
`periodeSekarang()` di `src/lib/data/kpi.ts`. Ditulis ulang di `finalisasi.ts`
karena berkas itu murni sementara `data/kpi.ts` menempel pada Supabase — dan
dijaga uji yang membaca kedua berkas, sama seperti `TANGGAL_BATAS_BUKA`.

**`TANGGAL_TUTUP` BUKAN `TANGGAL_BATAS_BUKA`.** Keduanya kebetulan 15. Yang
pertama soal sampai kapan sebuah bulan masih boleh berubah; yang kedua soal
outlet yang buka tanggal 31 tidak dihitung berjalan sebulan penuh. Menyatukan
keduanya berarti menggeser jadwal tutup buku diam-diam mengubah cara outlet
baru dinilai. Ada uji yang menolak `finalisasi.ts` menyebut konstanta yang satu
lagi.

### Cakupan generasi pertama

`periodeGenerasi()` mengembalikan **satu periode: bulan berjalan.**

Bulan lalu sengaja tidak ikut, dan itu keputusan pemiliknya:

- **Agustus 2026 adalah data historis yang terkunci.** 826 baris hasil TASK #86
  berstatus final. TASK #85 tidak membandingkannya, tidak memversikannya, tidak
  menulis ulangnya, dan tidak mem-backfill-nya.
- **Tidak ada catch-up historis.** Backfill adalah pekerjaan sekali jalan yang
  punya gerbang sendiri, bukan sesuatu yang boleh terjadi diam-diam karena
  sebuah cron kebetulan berangkat.

Aturan bulan-lalu di atas sudah ada di `periodeSelesai()` dan sudah diuji, tapi
belum dipakai `periodeGenerasi()`. Mengaktifkannya kelak cukup mengubah daftar
itu — dan itu keputusan tersendiri, bukan efek samping.

---

## AD-11 · TASK #85A — sebuah bulan selesai begitu kalendernya habis

**Menggantikan aturan finalisasi di AD-10.**

AD-10 memakai "bulan lalu, tanggal > 15", meminjam `TANGGAL_TUTUP_KPI` yang
dipakai `periodeSekarang()` untuk memilih bulan mana yang DIBUKA di layar KPI
Coordinator Area. Keputusan pemiliknya di TASK #85A: finalitas periode KPI
memakai berakhirnya bulan kalender.

```
2026-09 pada 2026-09-30 WIB  →  belum selesai
2026-09 pada 2026-10-01 WIB  →  SELESAI
```

Keduanya menjawab pertanyaan yang berbeda, dan itu sebabnya keduanya boleh
berbeda. Tanggal 15 menjawab "bulan mana yang sedang dikerjakan orang"; yang di
sini menjawab "bulan mana yang angkanya tidak akan berubah lagi".
`periodeSekarang()` di `src/lib/data/kpi.ts` tetap memakai tanggal 15 dan tidak
disentuh — ada uji yang menjaganya.

Perubahannya aman diperiksa: satu-satunya pemakai `periodeSelesai()` adalah
generator, dan generator hanya menyentuh bulan berjalan — yang mengembalikan
`false` pada kedua aturan. Tidak ada satu angka pun yang sudah tertulis berubah
artinya.

`TANGGAL_TUTUP` di `finalisasi.ts` dihapus: aturannya sekarang murni
perbandingan bulan, dan menyimpan tetapan bertanggal yang tidak dipakai justru
mengundang orang memakainya lagi. Ada uji yang menolak `finalisasi.ts` menyebut
`getUTCDate` maupun angka 15.

### Finalisasi adalah perpindahan keadaan, bukan perhitungan ulang

```
versi 1 · terkini · sementara   →   versi 1 · terkini · final
```

**BUKAN versi 2.** Bulan yang ditutup bukan bulan yang dihitung ulang;
melahirkan versi baru untuknya berarti riwayat versi berisi dua baris yang
angkanya sama persis, dan yang membacanya akan mencari perbedaan yang tidak
pernah ada.

Karena itu `gwg_finalisasi_kpi_bulanan` (migrasi 0108) tidak membaca satu pun
tabel sumber, tidak memanggil satu pun mesin KPI, dan tidak menyentuh `targets`.
Satu-satunya pernyataan tulisnya sebuah `update ... set status = 'final'`. Ada
uji yang membaca berkas migrasinya dan gagal begitu ada `insert`, `delete`,
`versi + 1`, atau nama tabel sumber di dalamnya.

### Yang TIDAK ikut jadi final

Hanya `sementara` yang berpindah. `tidak_tersedia` dan `invalid` dibiarkan apa
adanya:

```
Warehouse %      sementara       → final
Platform Fee %   tidak_tersedia  → tidak_tersedia
PBJT %           tidak_tersedia  → tidak_tersedia
```

Kalimatnya jadi utuh: bulannya sudah ditutup, dan KPI itu memang tidak ada
angkanya. Menjadikannya `final` berarti mengklaim Platform Fee September adalah
angka yang sudah pasti — padahal kolomnya belum pernah diisi.

Akibat langsungnya: **Agustus 2026 tidak pernah masuk daftar periksa.** Ia tidak
punya satu pun baris `sementara`, jadi saringan pertama fungsinya sudah
melewatinya — bukan karena ada pengecualian yang ditulis tangan untuknya.

### Siklus hidup target tidak berubah

`targets.status` tetap `draf → berlaku → diganti`. Tidak ada `final` di sana,
dan `berlaku` tidak pernah berarti periodenya sudah ditutup.

### Urutan di rute cron

```
1. generasi    — menulis ulang bulan berjalan
2. finalisasi  — menutup bulan yang kalendernya sudah habis
```

Himpunan periodenya terpisah, jadi urutannya tidak bisa saling merusak.
Generasi didahulukan karena ia jalur utamanya: kalau ia gagal, rute berhenti dan
tidak ada periode yang ditutup atas dasar data yang tidak jadi ditulis.
Keduanya transaksi sendiri-sendiri; generasi yang sudah berhasil tidak
dibatalkan karena finalisasi gagal — tapi kegagalannya tetap membuat rute
membalas 500 dan `sinkron_sehat` mencatat galat.

---

## AD-12 · TASK #87 / PHASE 3 — lapisan aturan yang berversi

Angka dan artinya dipisah:

```
kpi_values.nilai   20.364919      ← fakta
rule_conditions    gt 30          ← tafsir
```

Tafsirnya tidak pernah disimpan ke dalam angkanya. Kalau menempel, mengubah
kebijakan berarti mengubah sejarah: laporan September yang sudah dibaca orang
berbeda artinya begitu ambang Desember ditetapkan, tanpa jejak bahwa yang
berubah adalah aturannya, bukan kinerjanya.

Tabelnya mengikuti rancangan yang sudah ada di `blueprint.md` bagian 8 —
`rules`, `rule_versions`, `rule_conditions` — bukan rancangan baru.

### Operator menyatakan pelanggaran, bukan kesehatan

`gt 5` berarti "dilanggar bila LEBIH DARI 5", jadi tepat 5 masih aman. Bentuknya
diambil dari contoh AD-02 di blueprint, dan ia yang membuat perilaku di titik
batas tidak pernah jadi tebakan. Dokumen lama menulis `Warehouse < 30%` yang
secara harfiah membuat 30 sudah tidak sehat; yang dipakai konvensi AD-02, dan
aturan yang ingin sebaliknya memakai `gte` di barisnya sendiri — bukan di kode.

### Versi tidak pernah disunting

UPDATE dan DELETE pada kolom yang menentukan arti sebuah versi ditolak pemicu.
Satu-satunya suntingan yang diizinkan: **menutup** rentang yang masih terbuka
(`berlaku_sampai` dari null menjadi sebuah periode). Tanpa itu, versi terbuka
bertumpang dengan penggantinya selamanya dan ambang tidak akan pernah bisa
berubah — cacat yang ditemukan uji basis data, bukan produksi. Rentang yang
sudah ditutup tidak boleh diubah lagi maupun dibuka kembali.

### Versi dipilih oleh periode KPI

Menilai September memakai aturan yang berlaku untuk September, bukan aturan yang
kebetulan berlaku saat laporannya dibuka. Dua versi tidak boleh berlaku untuk
periode yang sama — dijaga pemicu berkunci nasihat, dan diperiksa ulang mesin
hitungnya.

### Hasil penilaian TIDAK disimpan

Sebuah kondisi bisa dihasilkan ulang kapan saja dari dua hal yang sudah
tersimpan dan sama-sama berversi: angka di `kpi_values` dan aturan di
`rule_versions`. Menyimpannya berarti sumber kebenaran ketiga yang bisa basi
diam-diam, dan hari ini tidak ada pembacanya. `kpi_rule_evaluations` baru masuk
akal ketika Signal butuh mengingat "sudah pernah ditangani belum".

### `op_settings` disalin, bukan dipindah

Angkanya jadi benih versi 1. Halaman `/operation/settings` dan dashboard lama
tetap membacanya. Batas peralihannya: aturan V.1 membaca tabel rule, layar lama
membaca `op_settings`.

### Sewa — AD-02 ditegakkan di sini

`sewa_melebihi_ambang` v1: `gt 5`, berlaku mulai **2026-10**, sumber AD-02.
`op_settings.expenseThresholds.sewa` **tetap 3** dan tidak disentuh. Periode
sebelum Oktober 2026 sengaja tidak punya aturan sewa V.1, dan itu jawaban yang
benar — bukan lubang.

### Yang TIDAK dibuatkan aturan

Tidak ada sumber berwenang untuk **HPP %**, **Cleaning %**, **Platform Fee %**,
dan **PBJT %**, maupun untuk kelima KPI Sales. Keduanya dibiarkan tanpa aturan,
dan mesinnya mengembalikan `tanpa_aturan` — sengaja dibedakan dari `aman`.
Menyebutnya aman berarti mengklaim ia sudah dinilai dan lolos.

`marginBands` memuat `sehat 30`, `cukup 29`, `kritis 15`, yang menyisakan rentang
15–29 tanpa nama. Hanya batas sehat yang dipakai; pita tengahnya tidak dikarang.

---

## AD-13 · TASK #87A — decision lock: yang dikukuhkan, yang ditunda

Audit #87A menelusuri setiap KPI yang belum punya aturan dan mencari sumber
berwenangnya di dalam repositori. Hasilnya dibawa ke pemiliknya, dan pada
**17 September 2026** ia mengunci tiga belas keputusan sekaligus.

Yang dicari adalah **kondisi bisnis**, bukan rumus. `achievement = net ÷ target`
adalah rumus dan ia sudah ada. "Achievement di atas 100% berarti aman" adalah
kondisi bisnis, dan kalimat itu tidak ada di mana pun.

### Tujuh yang dikukuhkan

| Aturan | Operator | Ambang | Berlaku | Sumber |
|---|---|---|---|---|
| `warehouse_persen` | `gt` | 30 | 2026-08 | `op_settings.purchaseLimits.warehouse` |
| `non_warehouse_persen` | `gt` | 5 | 2026-08 | `op_settings.purchaseLimits.nonWarehouse` |
| `total_pembelian_persen` | `gt` | 35 | 2026-08 | `op_settings.purchaseLimits.total` |
| `tenaga_kerja_persen` | `gt` | 13 | 2026-08 | `op_settings.expenseThresholds.tenaga_kerja` |
| `lainnya_persen` | `gt` | 3 | 2026-08 | `op_settings.expenseThresholds.lainnya` |
| `laba_bersih_persen` | `lt` | 30 | 2026-08 | `op_settings.marginBands.sehat` |
| `sewa_melebihi_ambang` | `gt` | 5 | 2026-10 | AD-02 |

**Net Profit tetap dua keadaan.** `marginBands.cukup = 29` dan
`kritis = 15` TIDAK dijadikan aturan; rentang 15–29 tetap tanpa nama, dan
`op_settings.marginBands` tidak diubah. Menamai pita yang belum diputuskan
berarti mengarang tiga kelas dari angka yang cuma menyediakan satu batas.

### Tiga yang ditarik — listrik, air, internet

Ambang **4% / 1% / 1%** ikut tersemai di `0109` dengan `sumber` yang jujur
menyebut asalnya: prompt TASK #87. Audit menegaskan angka itu tidak ada di
`op_settings`, tidak ada di `blueprint.md`, tidak ada di `decisions.md`.
Keputusannya **TUNDA** — tidak ada ambang resmi.

**Ditarik dengan `rules.aktif = false`, bukan dihapus.** `rule_versions` dan
`rule_conditions` tidak disentuh sama sekali. Alasannya tiga:

1. `DELETE` ditolak pemicu, dan memang seharusnya — sejarah tidak dihapus.
2. Menutup `berlaku_sampai` akan menyatakan "sah dari 2026-08 sampai X",
   padahal ia tidak pernah sah sehari pun. Itu menulis sejarah yang keliru.
3. Barisnya yang tetap ada — beserta kalimat `sumber` yang menyebut asal-usulnya
   — justru satu-satunya jejak bahwa angka itu pernah ada dan ditarik.

`bacaKatalogAturan()` menyaring `aktif`, jadi ketiga KPI itu kembali
`tanpa_aturan`. Pengukuhan kelak lewat jalur normal: kalau 4/1/1 yang disetujui,
cukup dinyalakan lagi; kalau angka lain, ia jadi v2 dan rentang v1 ditutup.

**Tidak ada satu pun hasil penilaian yang berubah hari ini.** Seluruh 354 baris
Electricity/Water/Internet di Agustus dan September berstatus `tidak_tersedia` —
`op_expenses.utilitas` masih satu kolom tunggal (AD-03), jadi ketiga ambang itu
belum pernah menilai satu angka pun. Yang ditutup adalah masa depan: begitu
kolom utilitas dipecah, angka yang tidak pernah dikukuhkan itu akan langsung
mulai menghakimi.

### HPP — 40% tidak dipindahkan

`indikator.ts:531` memang memuat `hpp: { jenis: "tetap", nilai: 40 }`, dan angka
itu hidup di produksi lewat `tabel-monitor.tsx:603`. Tapi ia melekat pada
`hpp_area`:

```
hpp_area      = Σ kpi_outlet_bulanan.hpp_nominal ÷ Σ grossOutlet
biaya.hpp_pct = op_pnl.hpp                       ÷ sales-fact
```

Pembilang dan penyebutnya dua-duanya berbeda — jebakan yang sama yang sudah
ditandai AD-08 untuk `hpp_kpk`. Memindahkan 40% ke `biaya.hpp_pct` berarti
menilai sebuah rasio dengan ambang yang dibuat untuk rasio lain.
**`biaya.hpp_pct` tetap `tanpa_aturan`.** Rumus KPI HPP tidak diubah.

### Delapan lain yang tetap tanpa aturan

**Cleaning**, **Platform Fee**, **PBJT** — tidak ada sumber berwenang. Cleaning
TIDAK memakai ambang `lainnya`; ia KPI tersendiri. PBJT TIDAK disamakan dengan
HPP.

**Sales Achievement**, **Gross Sales**, **Net Sales**, **Average Transaction** —
ditunda. Dua kandidat sumber diperiksa dan **ditolak**, supaya tidak ada yang
terpakai diam-diam:

- `pencairan.ts:28-29` `AMBANG_PENUH = 86` / `AMBANG_SEPARUH = 62` — itu ambang
  **pencairan payroll atas skor divisi**, bukan ambang KPI.
- `blueprint.md:465-467` `≥100 / 50–100 / <50` — itu milik **Impact** (bagian 16,
  Phase 10), bukan pita KPI.

**`sales.monthly_target`** dikukuhkan sebagai **target, bukan kondisi**. Ia tidak
pernah dievaluasi sebagai syarat aturan.

### Prinsipnya

```
NO RULE → NO CONDITION → NO SIGNAL
```

Tujuh aturan aktif, dua belas KPI `tanpa_aturan`. Signal, kalau dibangun nanti,
hanya boleh berpijak pada tujuh itu. `tanpa_aturan` adalah hasil yang sah; yang
tidak sah adalah menyebutnya aman.

**Operational V.1 belum final.**

---

## AD-14 · TASK #88A — decision lock Signal (PHASE 4)

Audit arsitektur #88 menelusuri seluruh repositori untuk mekanisme deteksi yang
sudah ada, menelusuri rantai `kpi_definitions → kpi_values → rules →
rule_versions → rule_conditions → evaluasi()`, dan menemukan bahwa **desain
Signal sudah tertulis di `blueprint.md` bagian 9** — bukan rancangan baru.
Pada **17 September 2026** pemiliknya mengunci enam keputusan yang tersisa.

### Enam keputusan

**1 · Gerbang kelengkapan — DITUNDA.**

Blueprint bagian 19-22 menuntut "Signal tidak boleh lahir untuk periode
ber-kelengkapan di bawah ambang", dan keputusan terbuka #14 mengusulkan 95%.
Pemeriksaan produksi menunjukkan `kelengkapan_persen` hanya terisi di **234 dari
1.118** baris terkini per periode; seluruh **826 baris KPI keuangan bernilai
NULL**. Gerbang 95% hari ini akan memblokir seluruh Signal biaya — yaitu seluruh
341 pelanggaran yang justru sudah bisa dievaluasi.

```
BELUM ADA SUMBER + AMBANG KELENGKAPAN RESMI
→ JANGAN PAKAI KELENGKAPAN SEBAGAI GERBANG SIGNAL
```

Yang dikunci adalah **gerbangnya belum dibuat**, BUKAN bahwa kelengkapan
dianggap aman, dan BUKAN bahwa ambangnya 95%. Membuat pengecualian berdasarkan
ada-tidaknya kolom kelengkapan akan melahirkan kebijakan yang tidak pernah
disetujui siapa pun. `kelengkapan_persen` tidak diisi, `kpi_values` tidak
disentuh. Keputusan terbuka #14 tetap terbuka.

**2 · `sumber_sah = false` tidak boleh melahirkan Signal.**

Menjawab keputusan terbuka #16 — usulnya "tidak", dan itu yang dikunci.
`outlets.esb_mulai` dan `outlets.esb_abaikan` menandai bulan yang angka ESB-nya
sudah dinyatakan salah. Menilai angka yang sudah dinyatakan salah berarti
menerbitkan tuduhan di atas data yang diketahui keliru.

Yang diblokir **hanya Signal**. Angka KPI-nya tidak diubah, statusnya tidak
diubah, barisnya tidak dihapus — ia tetap tampil di layar seperti biasa.
Produksi hari ini punya 5 baris demikian, seluruhnya KPI Sales tanpa aturan.

**3 · Signal punya DUA keadaan kerja: `terbuka` dan `diabaikan`.**

Blueprint bagian 9 mengusulkan tujuh. Lima ditunda ke phase yang benar-benar
membutuhkannya: `acknowledged` (Phase 5 — belum ada layar tempat orang menekan
"saya lihat"), `diagnosing` (Phase 6), `escalated` dan `resolved` (Phase 7 —
"selesai" berarti tindakannya berhasil, dan tanpa Action kata itu kosong),
`expired` (tidak diperlukan sama sekali).

Yang menjaga jumlahnya tetap dua adalah pemisahan tegas:

```
kondisi_terakhir  ← HASIL DETEKSI   ditulis hanya mesin
status            ← KEADAAN KERJA   ditulis hanya manusia
```

"Masalahnya sudah membaik" adalah hasil deteksi, bukan keadaan kerja, jadi ia
tidak pernah menjadi state. Daftar kerja cukup menyaring
`status = 'terbuka' and kondisi_terakhir = 'lewat_ambang'`.

**4 · KPI berstatus `sementara` BOLEH melahirkan Signal.**

Menunggu sampai bulan ditutup berarti pembengkakan tenaga kerja September baru
terlihat 1 Oktober — bulannya sudah habis dan tidak ada lagi yang bisa
diperbaiki. Itu menghapus alasan Signal ada.

`sementara` BUKAN keadaan Signal; ia kematangan ANGKANYA, dan disimpan di
`status_kpi` (beku) serta `status_kpi_terakhir` (diperbarui mesin). Tidak ada
state `provisional`.

Yang membuat ini bersih adalah AD-11: finalisasi mengubah `status` **di baris
`kpi_values` yang sama tanpa melahirkan versi baru**. Jadi Signal yang lahir dari
angka berjalan menjadi Signal berbasis final dengan sendirinya — `id` sama,
`terdeteksi_pada` sama, tanpa duplikat, tanpa transisi state.

**5 · Tiga koreksi terhadap blueprint bagian 9 — DISETUJUI.**

*Koreksi 1 — wajib, dan ini bug nyata.* Blueprint menulis unik pada
`(rule_kode, rule_version, outlet_id, periode, skala)`. Di PostgreSQL **NULL
tidak pernah sama dengan NULL di dalam unique index**, sedangkan Signal korporat
ber-`outlet_id` NULL. Dua baris korporat yang identik dua-duanya akan lolos, dan
jumlahnya berlipat tiap kali cron jalan. `kpi_values` sudah memecahkan ini di
tempat yang sama, dan Signal memakai pola yang sama persis:

```
cakupan_id = coalesce(outlet_id, area_id, '~korporat')

IDENTITAS = (rule_version_id, cakupan, cakupan_id, periode, skala)
```

*Koreksi 2.* `rule_kode` + `rule_version` adalah dua kolom yang wajib selalu
konsisten dengan satu baris di tabel lain, tanpa foreign key yang bisa
menegakkannya. Diganti satu `rule_version_id` — satu FK, menunjuk tepat satu
versi.

*Koreksi 3.* `gap` dan `gap_persen` bisa dihitung kapan saja dari dua kolom yang
sudah tersimpan. `revenue_gap` lebih serius: ia menuntut menghitung rupiah dari
sumber mentah, padahal Signal dilarang menghitung ulang dari sumber. Ketiganya
dikeluarkan; `revenue_gap` menjadi urusan Impact di Phase 10.

**6 · Signal `critical` belum memicu notifikasi — DITUNDA ke Phase 5.**

Blueprint bagian 19-22 memang menyebut Signal critical sebagai pemicu
notifikasi, dan `notifications` memang dipakai ulang apa adanya. Tapi Phase 4
belum punya layar tujuan, jadi `href`-nya belum punya alamat, dan notifikasi
tanpa tautan tujuan nyaris tidak berguna. Phase 4 berhenti di Signal yang
tersimpan. `notifications` tidak diubah, tidak ada notifikasi yang lahir dari
cron Phase 4.

### Kontrak Phase 4

```
KPI VALUE → ACTIVE RULE → RULE VERSION → RULE CONDITION → evaluasi()
                                                              │
                                                     lewat_ambang
                                                              │
                                                           SIGNAL
```

Tidak ada `KPI → Signal` tanpa aturan. Tidak ada `KPI → Signal` dari ambang yang
ditulis di kode. Tidak ada `KPI → AI → Signal`.

Signal lahir HANYA bila kesembilan syarat terpenuhi: angkanya ada · finite ·
bukan `invalid` · bukan `tidak_tersedia` · `sumber_sah` bukan false · ada aturan
aktif · ada versi yang berlaku untuk periodenya · ada syaratnya · `evaluasi()`
menghasilkan `lewat_ambang`. Satu saja gagal → **tidak ada Signal**.

`tanpa_aturan` tidak pernah melahirkan Signal, dan itu ditegakkan secara
struktural, bukan lewat percabangan: Signal wajib punya `rule_version_id` yang
menunjuk versi yang benar-benar berlaku. Tidak ada aturan → tidak ada
`rule_version_id` → barisnya tidak bisa dibuat.

`kpi_value_id` adalah **bukti, bukan identitas**. Bulan berjalan ditulis ulang
tiap hari dan melahirkan `id` baru tiap kali isinya berubah; kalau identitasnya
di situ, 158 pelanggaran September akan menjadi ribuan baris dalam sebulan dan
Signal yang sudah diabaikan kemarin muncul lagi hari ini.

Tujuh aturan yang boleh melahirkan Signal adalah tujuh yang dikukuhkan AD-13.
`listrik_persen`, `air_persen`, dan `internet_persen` tetap non-aktif.
Dua belas KPI tanpa aturan tetap `tanpa_aturan`.

Penjadwalnya yang sudah ada, dengan urutan yang mengikat:

```
pg_cron 'kpi-bulanan-harian' → /api/cron/kpi-bulanan
  1. generasi KPI  2. finalisasi periode  3. deteksi Signal  4. lapor sinkron_sehat
```

Tidak ada cron baru, tidak ada Vercel Cron, tidak ada n8n, `vercel.json` tidak
disentuh.

Keamanannya pola yang sama dengan 113 tabel lain: RLS menyala, nol policy,
`anon`/`authenticated` di-`revoke`. Deteksi hanya lewat jalur server tepercaya;
klien tidak pernah menyisipkan maupun menyunting. Perubahan `status` oleh
manusia wajib membawa `diabaikan_oleh` yang menunjuk pengguna nyata.

Phase 4 berhenti di **peristiwa deteksi**. Tidak ada Diagnosis, Action, Case,
Impact, AI, Command Center, maupun alur notifikasi.

---

## AD-15 · TASK #88B — Signal dibangun (PHASE 4)

Kontrak AD-14 diwujudkan. Satu tabel, satu pemicu, satu fungsi penulis, satu
lapisan deteksi, satu langkah tambahan di rute cron yang sudah ada.

### Yang menjaga kebenarannya, dan di mana

| Jaminan | Ditegakkan oleh |
|---|---|
| Tidak ada Signal tanpa aturan | `signals.rule_version_id NOT NULL` — tanpa aturan tidak ada nilainya, jadi barisnya tidak bisa dibuat |
| Korporat tidak pernah kembar | `cakupan_id` generated + `signals_unik` |
| Snapshot deteksi tidak bisa ditulis ulang | `signals_tak_tersunting_trg` |
| Signal tidak bisa dihapus | pemicu yang sama, DELETE selalu ditolak |
| Yang diabaikan tidak dibuka mesin | pemicu yang sama, `diabaikan → terbuka` ditolak |
| Upsert tidak menyentuh keadaan kerja | daftar `set` pada `on conflict` hanya memuat lima kolom pengamatan |
| Dua jalan bersamaan tidak berlipat | `pg_advisory_xact_lock('gwg_signal', periode)` + `signals_unik` |
| Tidak ada mesin penilai kedua | `gwg_deteksi_signal` tidak memuat satu pun operator bisnis; `boleh_sisip` datang jadi dari TypeScript |

### Dua hal yang baru ketahuan saat membangunnya

**`status_kpi` dan `status_kpi_terakhir` tidak boleh punya batasan yang sama.**
Signal hanya lahir dari angka `final` atau `sementara`, jadi snapshot-nya cukup
dua. Tapi pengamatannya bisa berakhir di `tidak_tersedia` atau `invalid` —
angkanya hilang, atau sumbernya belakangan dinyatakan tidak sah. Menyamakan
kedua batasan akan membuat pembaruan pengamatan ditolak basis data tepat pada
kasus yang justru paling perlu dicatat.

**Menolak `diabaikan → terbuka` di pemicu, bukan cuma tidak melakukannya.**
Fungsi penulis memang tidak pernah menyentuh `status`. Tapi "tidak pernah
menyentuh" adalah sifat kode yang bisa berubah; "ditolak basis data" tidak.
Membuka kembali yang sudah diabaikan adalah keputusan workflow Phase 5/6, dan
sampai keputusan itu diambil ia tidak boleh bisa terjadi secara tidak sengaja.

### Yang TIDAK dibangun

Tidak ada Diagnosis, Action, Case, Impact, Learning, AI, Command Center, maupun
alur notifikasi — termasuk untuk `severity = 'critical'`. Tidak ada cron baru;
`vercel.json` tidak disentuh. `kpi_values`, `targets`, `rules`, `rule_versions`,
`rule_conditions`, `op_settings`, dan seluruh sumber finansial tidak diubah.

`kondisiPeriode()` bertambah dua kolom (`id` dan `sumber_sah`) dan tidak lebih.
`src/lib/ops/rules.ts` tidak disentuh sama sekali — ia tetap satu-satunya
penilai, dan ia tetap tidak tahu-menahu soal basis data, waktu sekarang, maupun
keabsahan sumber.

---

## AD-16 · TASK #88B Gate H — watermark deteksi & remediasi Agustus

Jalan pertama Phase 4 menghasilkan 161 Signal September dan **nol** Signal
Agustus. Bukan sebagian gagal — Agustus tidak pernah diperiksa.

### Sebabnya: himpunan periode yang disimpulkan, bukan dicatat

Rute cron memilih periodenya begini:

```
bulan berjalan  +  periode yang baru ditutup PADA JALAN INI
```

Asumsinya: periode lama Signal-nya sudah tercatat. Benar untuk setiap jalan
**kecuali yang pertama** — dan pada jalan pertama Agustus 2026 sudah lama
`final`, jadi tidak ada pintu yang bisa dilaluinya. 180 pelanggaran senyap,
termasuk 35 `laba_bersih_persen` ber-severity critical.

Lubang yang sama terbuka lagi setiap kali aturan baru lahir untuk bulan yang
sudah ditutup.

### "Sudah dideteksi" tidak bisa disimpulkan dari ada-tidaknya Signal

Inilah inti keputusannya. Periode yang memang nol pelanggaran sah-sah saja
tidak punya satu baris pun, dan ia **tidak bisa dibedakan** dari periode yang
belum pernah diperiksa sama sekali. Menebaknya dari jejak yang kebetulan ada
adalah persis kesalahan yang melahirkan lubang Agustus.

Karena itu penandanya dibuat eksplisit: **`app_config.signal_watermark_bulanan`**
— bulan terakhir yang deteksinya sudah tuntas. Memakai tabel key/value yang
sudah ada (`0024`), jadi **tidak ada migration, tidak ada tabel baru**.

### Aturan mainnya

```
tunggakan  =  (watermark, bulan_terakhir_selesai]     dinilai lebih dulu
berjalan   =  bulan kalender sekarang                 dinilai paling akhir
```

- Watermark **maju per periode**, tepat setelah periode itu berhasil dinilai.
  Kalau periode ketiga gagal, dua yang pertama tetap tercatat tuntas — pekerjaan
  yang sudah berhasil tidak dibuang, dan tidak ada periode yang dilangkahi.
- **Deteksi gagal → watermark tidak maju.** Galatnya melempar ke rute, rute
  membalas 500, `sinkron_sehat` mencatat.
- **Nol Signal tetap memajukan watermark.** Tidak adanya pelanggaran adalah
  hasil deteksi yang sah, bukan bukti bahwa periodenya belum diperiksa.
- **Bulan berjalan tidak pernah menggeser watermark.** Angkanya masih berubah
  tiap hari; kalau watermark melangkahinya, esok hari tunggakannya kosong dan
  bulan itu berhenti dinilai ulang — Signal berhenti mengikuti angkanya sendiri.
- Bootstrap (watermark belum ada) mulai dari **periode KPI paling awal yang ada
  di basis data**, diturunkan dengan kueri, bukan ditulis sebagai bulan tertentu
  di dalam kode. Hari ini: 2026-08.
- Tunggakan dibatasi **12 periode per jalan** — rute punya 60 detik, dan
  bootstrap yang menemukan bertahun-tahun tunggakan tidak boleh menghabiskannya
  sekaligus lalu gagal seluruhnya. Sisanya menyusul di jalan berikutnya.

`periodeDifinalisasi` tidak lagi dipakai sebagai pemicu deteksi. Ia tetap ada di
laporan kesehatan, tapi sebagai keterangan, bukan sebagai pintu.

### Watermark hanya memilih periode; aturan tetap yang memutuskan

`versiBerlaku()` tidak berubah sedikit pun. Periode yang masuk karena watermark
tetap dinilai dengan aturan yang benar-benar berlaku untuknya — `sewa_melebihi_ambang`
tetap nol untuk Agustus dan September, dan baru hidup mulai Oktober 2026.

### Pintu remediasi

```
GET /api/cron/kpi-bulanan?mode=deteksi&periode=YYYY-MM[&pratinjau=1]
```

Token dan gerbangnya sama persis dengan jalur terjadwal. Hanya deteksi: tidak
menggenerate, tidak memfinalisasi, **tidak menggeser watermark** — remediasi
menambal lubang di belakang, watermark menjaga barisan di depan; menggabungkannya
akan membuat perbaikan sekali pakai diam-diam melangkahi periode yang belum
pernah dinilai.

Periodenya dibatasi **daftar putih** (`REMEDIASI_DIIZINKAN`), bukan pemeriksaan
bentuk. Parameter yang menerima bulan apa pun asalkan formatnya benar berarti
pemegang token bisa menyuruh sistem menilai ulang bulan mana saja — pintu yang
tidak pernah diminta siapa pun. Isinya hari ini satu baris: `2026-08`.

`pratinjau=1` menghitung apa yang akan terjadi tanpa menulis apa pun, lewat
jalur yang sama persis (`kondisiPeriode` → `evaluasi` → `susunMuatan`), jadi
yang dipratinjau memang yang akan ditulis.

### Sidik isi kandidat

`sidikMuatan()` merender tiap angka dengan enam desimal tetap supaya sidiknya
bisa dihitung ulang di SQL — tanpa itu `0` dan `0.0000` memberi sidik berbeda
untuk isi yang sama. Angka 180 dan sidiknya **tidak ditulis sebagai assertion di
dalam kode**: sumber produksi yang berlaku saat eksekusi adalah kebenarannya,
dan sidik cuma penanda apakah himpunannya masih sama dengan yang disetujui.
