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
| 7 | PBJT masuk ke kategori mana? Tidak ditemukan di skema mana pun | PHASE 2 |
| 8 | Platform fee / delivery fee / ekspedisi masuk `potongan`, `ongkos_kirim`, atau `lainnya`? | PHASE 2 |
| 9 | Sumber data cuaca dan kompetitor untuk External Factor | PHASE 10 |
| 10 | Audit log menyimpan IP dan user-agent? Ada implikasi privasi karyawan | PHASE 12 |
| 11 | Playbooks muncul di dua menu (Intelligence + Learning) — perlu atau membingungkan? | PHASE 11 |
| 12 | Capaian divisi: rata-rata per posisi atau per orang? | — |
| 13 | Radika ikut rata-rata PDQ? | — |
| 14 | Ambang kelengkapan data sebelum Signal boleh lahir — usul 95% | PHASE 4 |
| 15 | Cabang ESB `57-fnb_nord` tanpa outlet — outlet baru atau sisa? | PHASE 1 |
