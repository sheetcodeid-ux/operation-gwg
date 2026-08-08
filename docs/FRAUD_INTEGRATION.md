# Integrasi Analisis Fraud — Void & Cancel dari POS ESB

Panduan lengkap membangun penarikan data transaksi **Void**, **Cancel**, dan
**Void + Cancel** dari `erp.esb.co.id`, dari nol sampai data masuk ke basis data
Anda.

Disusun dari implementasi yang berjalan di produksi sejak Januari 2026.

---

## Daftar Isi

1. [Yang perlu diketahui lebih dulu](#1-yang-perlu-diketahui-lebih-dulu)
2. [Prasyarat](#2-prasyarat)
3. [Langkah 1 — Login](#langkah-1--login-yii2--csrf)
4. [Langkah 2 — Membuka halaman laporan](#langkah-2--membuka-halaman-laporan)
5. [Langkah 3 — Meminta export dibuat](#langkah-3--meminta-export-dibuat)
6. [Langkah 4 — Membaca hasil export](#langkah-4--membaca-hasil-export)
7. [Langkah 5 — Mengurai grid HTML](#langkah-5--mengurai-grid-html)
8. [Langkah 6 — Memisahkan Void dan Cancel](#langkah-6--memisahkan-void-dan-cancel)
9. [Langkah 7 — Menyimpan ke basis data](#langkah-7--menyimpan-ke-basis-data)
10. [Langkah 8 — Cron harian](#langkah-8--cron-harian)
11. [Delapan jebakan](#delapan-jebakan) ← **baca sebelum menulis kode**
12. [Daftar periksa](#daftar-periksa)

---

## 1. Yang perlu diketahui lebih dulu

**ESB tidak menyediakan API.** Tidak ada REST, tidak ada token, tidak ada
dokumentasi resmi. Yang tersedia hanyalah aplikasi web berbasis PHP/Yii2 dengan
laporan yang dihasilkan secara asinkron dan dikirim sebagai **potongan HTML**.

Konsekuensinya, integrasi ini bekerja dengan meniru persis apa yang dilakukan
peramban: login, mengambil CSRF token, meminta export, menunggu selesai, lalu
mengurai tabel HTML-nya.

Pendekatan ini rapuh menurut definisinya. Bila ESB mengubah tampilan
laporannya, integrasi ini ikut rusak. Rancang dengan asumsi tersebut.

**Laporan sumber:** `/report/report-cancel-menu-detail`
("Cancel Menu Detail Report")

### Gambaran alur

```
   ┌─────────────────────────────────────────────────────────┐
   │  1. GET  /site/login              → cookie + CSRF token │
   │  2. POST /site/login              → cookie autentikasi  │
   │  3. GET  /report/report-cancel-…  → CSRF baru + token   │
   │  4. POST /report/report-cancel-…  → URL berkas export   │
   │  5. POST /report_service/main/…   → HTML grid (per hal.)│
   │  6. urai HTML → baris data                              │
   │  7. simpan ke basis data                                │
   └─────────────────────────────────────────────────────────┘
```

Langkah 5 diulang untuk setiap halaman sampai seluruh baris terbaca.

---

## 2. Prasyarat

### Akun ESB

Diperlukan akun yang dapat membuka menu **Report**.

> **Gunakan akun laporan khusus, bukan akun master admin.** Seluruh alur ini
> hanya membaca; tidak pernah menulis apa pun ke sistem POS. Memberikan akun
> master admin berarti memberikan kemampuan mengubah data penjualan yang tidak
> pernah dibutuhkan.

> **Setiap sistem sebaiknya memiliki akunnya sendiri.** Bila terpaksa berbagi
> akun dengan sistem lain, jadwal penarikannya wajib dipisah — lihat
> [Jebakan #8](#8--dua-sistem-tidak-boleh-berbagi-satu-akun-esb).

### Variabel lingkungan

```bash
ESB_BASE_URL=https://erp.esb.co.id
ESB_USERNAME=
ESB_PASSWORD=
```

### Basis data

PostgreSQL, atau apa pun yang setara. Skema tabelnya tersedia di
`supabase/migrations/0022_fraud_sync.sql` dan dapat dijalankan apa adanya.

---

## Langkah 1 — Login (Yii2 + CSRF)

### 1a. Ambil halaman login

```http
GET /site/login
Accept: text/html
```

Dari responsnya, kumpulkan dua hal:

**Cookie sesi** — dari header `Set-Cookie`. Perhatikan bahwa runtime modern
mengembalikan beberapa header `Set-Cookie`; gunakan `getSetCookie()` bila
tersedia, dan pecah header tunggalnya sebagai cadangan.

**CSRF token** — dari salah satu:
```html
<meta name="csrf-token" content="...">
<input name="_csrf-esb-fnb-backend" value="...">
```

### 1b. Kirim formulir login

> **Kirim ulang SELURUH field formulirnya, bukan hanya username dan password.**
>
> Formulir login memuat input tersembunyi lain — di antaranya `challengeToken`
> dan beberapa penanda fitur. Mengirim hanya kredensial akan ditolak.
>
> Cara paling tahan banting: urai semua `<input name=… value=…>` dari halaman
> login (lewati `type="submit"` dan `type="button"`), timpa hanya field
> username dan password, lalu kirim seluruhnya kembali.

```http
POST /site/login
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
Cookie: <cookie dari langkah 1a>
Referer: https://erp.esb.co.id/site/login

_csrf-esb-fnb-backend=…&username=…&password=…&<seluruh input tersembunyi>
```

Kirim sebagai POST peramban biasa — **bukan** XHR. Jangan mengikuti redirect
otomatis (`redirect: "manual"`).

### 1c. Pastikan berhasil

Login berhasil ditandai munculnya cookie **`_jwt-token`** atau **`_identity`**.

Yii2 membalas dengan redirect 302. Pada sebagian kasus cookie autentikasi baru
muncul pada respons redirect-nya, jadi ikuti redirect tersebut **satu kali**
sambil membawa cookie yang sudah terkumpul.

Bila gagal, pesan kesalahannya berada di elemen ber-class `help-block`:

```html
<div class="help-block">Username atau password salah</div>
```

---

## Langkah 2 — Membuka halaman laporan

```http
GET /report/report-cancel-menu-detail
Cookie: <cookie sesi>
```

Ambil tiga hal dari HTML-nya:

### 2a. CSRF token baru

```html
<meta name="csrf-token" content="...">
```

**Gunakan token ini untuk seluruh panggilan data berikutnya**, bukan token dari
halaman login.

### 2b. `POST_USER_SESSION`

Token anti-replay per sesi, tertanam sebagai input tersembunyi atau sebagai
assignment JavaScript:

```
POST_USER_SESSION = "abc123..."
POST_USER_SESSION: 'abc123...'
value="abc123..."
```

Harus dikirim kembali pada Langkah 3.

### 2c. Opsi dropdown "Type Void"

```html
<select name="CancelMenuDetailReport[typeVoid]">
  <option value="...">Cancel / Void (Default)</option>
  <option value="Removed Before Save">Deleted Item</option>
</select>
```

**Baca `value` dan labelnya langsung dari halaman yang hidup.** Jangan menebak
atau menyalin nilainya ke dalam kode — lihat
[Jebakan #5](#5--nilai-typevoid-asing-membuang-seluruh-filter).

### Masa berlaku sesi

Sekitar **30 menit**. Setelah itu login ulang. Praktik yang baik: simpan sesi
beserta waktu pembuatannya, dan perbarui bila responsnya 401, 403, atau 302.

---

## Langkah 3 — Meminta export dibuat

```http
POST /report/report-cancel-menu-detail
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
X-Requested-With: XMLHttpRequest
X-Csrf-Token: <CSRF dari langkah 2a>
Cookie: <cookie sesi>
Referer: https://erp.esb.co.id/report/report-cancel-menu-detail
```

### Isi body

Dengan `P` = `CancelMenuDetailReport`:

| Field | Nilai | Keterangan |
| --- | --- | --- |
| `_csrf-esb-fnb-backend` | CSRF langkah 2a | wajib |
| `P[reportDate]` | `DD-MM-YYYY - DD-MM-YYYY` | rentang, dipisah spasi-strip-spasi |
| `P[dateFrom]` | `DD-MM-YYYY` | |
| `P[dateTo]` | `DD-MM-YYYY` | |
| `P[selectedBranchText]` | `All Branch` | |
| `P[branchID]` | *(kosong)* | kosong = seluruh outlet |
| `P[statusCancelFilter]` | `all` | |
| `P[typeVoid]` | nilai dari langkah 2c | |
| `P[isPreviewBill]` | `1` | |
| `P[salesNum]` | *(kosong)* | |
| `P[menuName]` | *(kosong)* | |
| `P[visitPurposeID]` | *(kosong)* | |
| `P[menuCategory]` | *(kosong)* | |
| `P[menuCategoryDetail]` | *(kosong)* | |
| `P[menuCode]` | *(kosong)* | |
| `P[cancelNotes]` | *(kosong)* | |
| `POST_USER_SESSION` | dari langkah 2b | wajib |

> ### ⚠️ Format tanggal `DD-MM-YYYY`, bukan `YYYY-MM-DD`
>
> Format yang salah **tidak menghasilkan pesan kesalahan**. ESB hanya
> mengembalikan data kosong, dan Anda akan mengira memang tidak ada transaksi
> void pada tanggal tersebut.

### Respons

```json
{ "status": 200, "data": "https://oss.../export-file-xxxx" }
```

Nilai `data` adalah **URL berkas export internal**. Simpan — inilah yang dibaca
pada Langkah 4.

---

## Langkah 4 — Membaca hasil export

Export dihasilkan secara **asinkron**. Permintaan pertama hampir selalu belum
siap.

```http
POST /report_service/main/get-data-report
X-Requested-With: XMLHttpRequest
X-Csrf-Token: <CSRF>
Cookie: <cookie sesi>

url=<URL dari langkah 3>&page=0
```

### Mengenali "belum siap"

> ESB menyatakan "masih diproses" dengan **dua cara sekaligus**: HTTP 404, dan
> HTTP 200 dengan body `{"code":404}`. Body-nya kadang ter-encode ganda
> (`\"code\":404`).
>
> Periksa **keduanya** sebelum menyimpulkan gagal:

```js
const siap = res.ok && !/\\?"code\\?"\s*:\s*(404|425|202)/.test(text);
```

### Pola menunggu

1. Coba baca halaman
2. Bila belum siap, tunggu **2 detik**
3. Panggil antrean agar worker ESB melanjutkan pekerjaannya:
   ```http
   GET /site/get-data-report-queue?draw=1&start=0&length=10&_=<timestamp>
   ```
   Inilah yang dilakukan peramban. Sifatnya best-effort — abaikan bila gagal.
4. Ulangi, maksimal sekitar 22 kali

> **Pasang batas waktu.** Menunggu 22 × 2 detik saja sudah 44 detik — melewati
> batas 60 detik pada lingkungan serverless. Berhenti selagi masih sempat
> mengembalikan hasil, tandai harinya sebagai belum selesai, dan lanjutkan pada
> penarikan berikutnya.
>
> `fetch` bawaan Node **tidak memiliki batas waktu sama sekali**. Satu
> permintaan yang menggantung akan menggantungkan seluruh proses. Gunakan
> `AbortSignal.timeout(15_000)` per permintaan.

### Halaman berikutnya

Naikkan `page` (0, 1, 2, …) sampai seluruh baris terbaca. Jumlah total item
dibaca dari teks ringkasan grid:

```
Showing 1-50 of 237 items
```

---

## Langkah 5 — Mengurai grid HTML

Responsnya adalah HTML grid Krajee GridView.

### Kenali kolom dari label header, bukan dari posisinya

Susunan kolom laporan Cancel/Void **berbeda** dengan laporan Delete. Membaca
berdasarkan urutan kolom akan menghasilkan data yang tertukar.

```html
<th data-col-seq="1">Sales Number</th>
<th data-col-seq="2">Branch</th>
...
```

Bangun peta dari label `<th>` ke indeks kolomnya, lalu ambil sel berdasarkan
peta tersebut. Bila header tidak terbaca sama sekali, barulah gunakan posisi
sebagai cadangan.

### Susunan kolom Cancel/Void

```
Sales Number · Branch · Menu · Menu Code · Menu Category · Category Detail ·
Order By · Order Time · Cancel/Void By · Cancel/Void Time · Type · Notes ·
Qty · Subtotal · Service Charge · Tax · Total
```

### Baris data

```html
<tr data-key="...">
  <td>...</td>
</tr>
```

> ### ⚠️ Sel yang hilang karena `rowspan`
>
> Grid Krajee **menggabungkan kolom tingkat struk**. Mulai item kedua dalam satu
> struk, `<td>` untuk nomor struk, outlet, dan kasir **tidak ada sama sekali**
> pada baris tersebut.
>
> Aturannya:
> - Sel **teks** yang tidak ada → **mewarisi nilai baris sebelumnya**
> - Sel **angka** yang tidak ada → **bernilai 0**
>
> Bila angka ikut mewarisi, nominalnya terhitung ganda. Bila baris seperti ini
> dilewati begitu saja, sekitar **58% item hilang**.

### Format angka

Nilai rupiah datang dalam format Indonesia (`1.234.567,89`). Tulis pengurai
tersendiri — `parseFloat` akan salah membacanya.

---

## Langkah 6 — Memisahkan Void dan Cancel

Export default berisi **keduanya sekaligus**. Pemisahan dilakukan dari kolom
`Type`:

```js
const isVoid   = /void/i.test(row.type);
const isCancel = /cancel/i.test(row.type) && !/void/i.test(row.type);
```

> **Urutan pemeriksaannya penting.** Sebagian nilai `Type` memuat kedua kata
> sekaligus. Tanpa `&& !/void/i`, baris yang sama akan terhitung dua kali.

| Yang diminta | Caranya |
| --- | --- |
| **Void** saja | saring `isVoid` |
| **Cancel** saja | saring `isCancel` |
| **Void + Cancel** | seluruh baris export default |
| **Delete Order** | export terpisah, lihat di bawah |

### Delete Order

Item yang dihapus sebelum struk disimpan. Laporan berbeda, dipilih melalui
dropdown `typeVoid` yang sama dengan nilai **`Removed Before Save`**.

Cari opsi ini dari halaman yang hidup. Bila tidak ditemukan, ambil export
default lalu saring sendiri berdasarkan kolom `Type`.

> Ukuran halaman laporan Delete adalah **20 baris**, bukan 50 seperti
> Cancel/Void. Lihat [Jebakan #3](#3--ukuran-halaman-berbeda-antar-laporan).

---

## Langkah 7 — Menyimpan ke basis data

Skema yang digunakan di produksi
(`supabase/migrations/0022_fraud_sync.sql`):

```sql
create table fraud_orders (
  id            bigint generated always as identity primary key,
  kind          text not null check (kind in ('cv', 'delete')),
  day           date not null,
  branch        text not null default '',
  sales_number  text not null default '',
  menu          text not null default '',
  menu_category text not null default '',
  order_by      text not null default '',
  order_time    text not null default '',
  void_by       text not null default '',
  void_time     text not null default '',
  type          text not null default '',
  notes         text not null default '',
  qty           numeric not null default 0,
  total         numeric not null default 0
);

create index fraud_orders_kind_day on fraud_orders (kind, day);
```

### Tabel penanda kelengkapan — jangan dilewatkan

```sql
create table fraud_sync (
  kind        text not null check (kind in ('cv', 'delete')),
  day         date not null,
  total_items integer not null default 0,
  rows_read   integer not null default 0,
  complete    boolean not null default false,
  synced_at   timestamptz not null default now(),
  primary key (kind, day)
);
```

> **Tanpa tabel ini, hari yang tersinkron sebagian akan terlihat persis seperti
> hari yang memang sepi.** Dan itu justru menyembunyikan fraud, bukan
> menemukannya.
>
> Simpan `total_items` (dari teks "Showing 1-N of X") dan `rows_read` (yang
> benar-benar berhasil diurai). `complete` bernilai true hanya bila keduanya
> sama.

---

## Langkah 8 — Cron harian

Jangan menarik dari ESB saat halaman dibuka — terlalu lambat dan terlalu rapuh.

**Arsitektur yang disarankan:**

1. **Cron harian** menarik data ke tabel Anda sendiri, satu hari per satuan
   kerja, dan mencatat kelengkapannya
2. **Aplikasi membaca dari tabel itu**, tidak pernah langsung dari ESB
3. **Hari yang gagal diulang** pada penarikan berikutnya, tanpa mengulang
   semuanya dari nol

Implementasi rujukan: `src/app/api/cron/fraud-sync/route.ts`

### Anggaran waktu

Pada lingkungan serverless dengan batas 60 detik, bagi anggarannya:

```
Total 60 detik
├── ~50 detik untuk menarik data
└── ~10 detik cadangan untuk menyimpan dan membalas
```

Pasang tenggat pada titik masuk permintaan, bukan per tahap — di situlah batas
sebenarnya diketahui.

---

## Delapan jebakan

**Bagian paling penting dalam dokumen ini.** Seluruhnya ditemukan setelah data
yang salah lebih dulu masuk ke produksi, dan **tidak satu pun memunculkan pesan
kesalahan**.

### #1 — "Belum siap" menyamar sebagai galat

ESB membalas dengan HTTP 404 **dan juga** HTTP 200 berisi `{"code":404}`, kadang
ter-encode ganda. Periksa keduanya, ulangi tiap 2 detik, dan panggil
`/site/get-data-report-queue` di antara percobaan.

### #2 — ESB melayani SATU export per sesi

**Terverifikasi di produksi:** dua hari yang diproses bersamaan saling tertukar
berkas export-nya, dan pembacaan halaman mengembalikan **±40% baris milik hari
lain**. Tidak ada galat sama sekali — datanya sekadar salah.

**Seluruh** proses generate dan pembacaan halaman wajib dijalankan berurutan
melalui satu antrean.

### #3 — Ukuran halaman berbeda antar laporan

| Laporan | Baris per halaman |
| --- | --- |
| Cancel/Void | **50** |
| Delete | **20** |

Mengasumsikan 50 untuk keduanya diam-diam membuang **±58%** item Delete. Baca
ukuran halaman dari grid-nya sendiri, jangan dipatok dalam kode.

### #4 — Sel kosong mewarisi baris sebelumnya

Grid menggabungkan kolom tingkat struk dengan `rowspan`. Melewati baris seperti
ini kehilangan **±58%** item.

Sel **teks** yang tidak ada mewarisi nilai baris sebelumnya; sel **angka** yang
tidak ada bernilai 0 — bila angka ikut mewarisi, nominalnya terhitung ganda.

### #5 — Nilai `typeVoid` asing membuang SELURUH filter

Mengirim nilai dropdown yang tidak ada pada formulir membuat ESB mengabaikan
semua filter — **termasuk rentang tanggalnya** — dan mengembalikan data yang
salah tanpa galat.

Selalu baca opsinya dari halaman laporan yang hidup.

### #6 — `fetch` bawaan Node tidak punya batas waktu

Satu permintaan yang menggantung menggantungkan seluruh proses. Pasang timeout
per permintaan (15 detik memadai) dan tenggat untuk keseluruhan rangkaian.

### #7 — Validasi silang yang tersedia gratis

Baris ringkasan pada grid memuat total keseluruhan rentang yang diminta, dan
subtotalnya **sama persis** dengan angka pada dashboard ESB.

Gunakan ini untuk memastikan hasil parsing Anda benar sebelum mempercayainya.

### #8 — Dua sistem tidak boleh berbagi satu akun ESB

Konsekuensi langsung dari #2, dan baru terasa saat sistem kedua mulai berjalan.

Antrean export ESB (`/site/get-data-report-queue`) terikat pada **akun**, bukan
pada sesi login. Dua sistem yang login dengan akun sama akan mengantre di tempat
yang sama: sistem A meminta export, sistem B ikut membaca antrean itu, lalu
**keduanya mengurai berkas milik yang lain**.

Gejalanya persis seperti #2 — tanpa galat, tanpa log, hanya baris tanggal atau
outlet yang salah masuk ke basis data, dan baru ketahuan berminggu-minggu
kemudian.

**Setiap sistem wajib memiliki akun laporan ESB-nya sendiri.** Bila terpaksa
berbagi, jadwal penarikannya harus dipisah jauh — misalnya satu sistem pukul
04:30 dan yang lain pukul 16:00.

---

## Rujukan implementasi

| Berkas | Isi |
| --- | --- |
| `src/lib/integrations/esb-client.ts` | Login, generate export, baca halaman, antrean serial |
| `src/lib/integrations/esb.ts` | Pengurai grid HTML, pengenalan kolom |
| `src/lib/data/fraud.ts` | Agregasi, pemisahan void/cancel |
| `src/lib/data/fraud-store.ts` | Penyimpanan ke basis data |
| `src/app/api/cron/fraud-sync/route.ts` | Cron harian + pembagian anggaran waktu |
| `supabase/migrations/0022_fraud_sync.sql` | Skema `fraud_orders` + `fraud_sync` |

### Urutan baca yang disarankan

1. `esb-client.ts` — inti seluruh integrasi. Bila hanya sempat membaca satu
   berkas, baca ini.
2. `esb.ts` — pengurai HTML, tempat penanganan `rowspan` dan pengenalan kolom
3. `0022_fraud_sync.sql` — skema, dapat dipakai apa adanya
4. `fraud-store.ts` — pola penulisan dan penandaan kelengkapan
5. `fraud-sync/route.ts` — cron dan pembagian anggaran waktu
6. `fraud.ts` — agregasi untuk ditampilkan

Alurnya sengaja dipisah agar tiap lapisan dapat diuji sendiri. Bila arsitektur
sistem Anda berbeda, yang wajib ditiru hanyalah `esb-client.ts` dan `esb.ts`.

---

## Daftar periksa

**Sebelum menulis kode**
- [ ] Membaca seluruh bagian [Delapan jebakan](#delapan-jebakan)
- [ ] Menyiapkan akun laporan ESB tersendiri
- [ ] Menyepakati jadwal penarikan agar tidak bertabrakan dengan sistem lain

**Saat membangun**
- [ ] Seluruh field tersembunyi formulir login ikut dikirim
- [ ] Tanggal berformat `DD-MM-YYYY`
- [ ] Nilai `typeVoid` dibaca dari halaman, bukan ditulis dalam kode
- [ ] Generate dan pembacaan halaman berjalan serial, tidak paralel
- [ ] Ukuran halaman dibaca dari grid, tidak dipatok
- [ ] Sel `rowspan` ditangani: teks mewarisi, angka bernilai 0
- [ ] Setiap permintaan memiliki batas waktu
- [ ] Kelengkapan dicatat (`total_items` vs `rows_read`)

**Sebelum dipercaya**
- [ ] Subtotal hasil parsing dicocokkan dengan dashboard ESB (Jebakan #7)
- [ ] Diuji pada rentang tanggal yang diketahui berisi Void maupun Cancel
- [ ] Diuji pada tanggal yang memang tidak ada transaksinya
- [ ] Diuji saat export belum siap (jalur retry benar-benar berjalan)
