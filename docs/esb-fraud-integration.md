# Cara Mengambil Analisis Fraud (Void & Cancel) dari ESB

Dokumen serah terima untuk tim IT. Isinya alur teknis yang dipakai Operation GWG
untuk menarik detail **Void**, **Cancel**, dan **Void + Cancel** dari
`erp.esb.co.id`, beserta jebakan-jebakan yang sudah kami temukan di produksi.

> **Baca dulu bagian [Jalan pintas](#jalan-pintas-datanya-sudah-tersedia)** sebelum
> membangun apa pun. Sebagian besar kebutuhan tidak memerlukan integrasi ini.

---

## Yang perlu diketahui lebih dulu

**ESB tidak menyediakan API.** Tidak ada REST, tidak ada token, tidak ada
dokumentasi. Yang ada hanya aplikasi web (PHP/Yii2) dengan laporan yang
digenerate secara asinkron dan dikirim sebagai **potongan HTML**.

Artinya integrasi ini bekerja dengan cara meniru persis apa yang dilakukan
browser: login, ambil CSRF token, minta export, tunggu selesai, lalu urai
tabel HTML-nya. Rapuh menurut definisinya — kalau ESB mengubah tampilan
laporannya, ini ikut rusak.

Laporan sumbernya: **`/report/report-cancel-menu-detail`**
("Cancel Menu Detail Report").

---

## Jalan pintas: datanya sudah tersedia

Sebelum membangun ulang semua ini, pertimbangkan bahwa Operation GWG **sudah**
menarik data ini setiap hari dan menyimpannya di Postgres (Supabase). Per
Agustus 2026: **154.892 baris**, rentang 1 Januari 2026 sampai sekarang, 57
outlet.

Tabel `fraud_orders` — satu baris per item yang di-void/cancel:

| Kolom | Isi |
| --- | --- |
| `kind` | `cv` = Cancel/Void · `delete` = Delete Order |
| `day` | tanggal |
| `branch` | nama outlet |
| `sales_number` | nomor struk |
| `menu`, `menu_category` | item dan kategorinya |
| `order_by`, `order_time` | siapa yang input order, jam berapa |
| `void_by`, `void_time` | **siapa yang melakukan void**, jam berapa |
| `type` | teks mentah dari ESB — `Void`, `Cancel`, dst. |
| `notes` | alasan yang diketik kasir |
| `qty`, `total` | jumlah dan nilai rupiah |

Tabel pendukung: `fraud_sync` (hari mana sudah tersinkron dan apakah lengkap),
`sales_daily` & `sales_period` (omzet, untuk menghitung fraud sebagai % dari
penjualan).

Membaca dari sini **selalu lebih baik** daripada menarik ulang dari ESB: sudah
bersih, sudah lengkap ke belakang, tidak menambah beban ESB, dan tidak rusak
saat ESB ganti tampilan. Hubungi pemilik sistem untuk akses baca.

---

## Alur lengkap (kalau tetap perlu menarik sendiri)

### Prasyarat

Akun ESB dengan izin membuka menu Report. **Gunakan akun laporan khusus, bukan
master admin** — seluruh alur ini hanya MEMBACA, tidak pernah menulis.

```
ESB_BASE_URL = https://erp.esb.co.id
ESB_USERNAME = <akun laporan>
ESB_PASSWORD = <kata sandi>
```

### Langkah 1 — Login (Yii2 + CSRF)

```
GET /site/login
```

Ambil dua hal dari responsnya:
- Cookie sesi (dari header `Set-Cookie`)
- CSRF token dari `<meta name="csrf-token" content="…">`, atau dari input
  tersembunyi `_csrf-esb-fnb-backend`

Lalu kirim ulang **seluruh field form login apa adanya** — bukan hanya username
dan password:

```
POST /site/login
Content-Type: application/x-www-form-urlencoded
Cookie: <cookie dari langkah sebelumnya>
Referer: https://erp.esb.co.id/site/login

_csrf-esb-fnb-backend=…&username=…&password=…&<seluruh input hidden lainnya>
```

> **Penting.** Form login memuat input tersembunyi lain (antara lain
> `challengeToken`). Mengirim hanya username + password akan ditolak. Cara
> paling tahan banting: urai semua `<input name=… value=…>` dari halaman login,
> timpa hanya field username dan password, kirim seluruhnya kembali.

Berhasil ditandai munculnya cookie **`_jwt-token`** atau **`_identity`**.
Yii2 membalas dengan redirect 302 — pada beberapa kasus cookie autentikasi baru
muncul di respons redirect-nya, jadi ikuti redirect itu sekali sambil membawa
cookie.

Pesan galat login ada di elemen ber-class `help-block`.

### Langkah 2 — Buka halaman laporan

```
GET /report/report-cancel-menu-detail
Cookie: <cookie sesi>
```

Ambil tiga hal dari HTML-nya:

1. **CSRF token baru** (`<meta name="csrf-token">`) — pakai yang ini untuk
   panggilan data, bukan yang dari halaman login.
2. **`POST_USER_SESSION`** — token anti-replay per sesi, tertanam sebagai input
   tersembunyi atau assignment JavaScript. Harus dikirim balik di langkah 3.
3. **Opsi dropdown "Type Void"** — dari
   `<select name="CancelMenuDetailReport[typeVoid]">`. Baca `value` **dan**
   labelnya langsung dari halaman; jangan menebak nilainya (lihat Jebakan #5).

Sesi bertahan sekitar 30 menit. Setelah itu login ulang.

### Langkah 3 — Minta export dibuat

```
POST /report/report-cancel-menu-detail
Content-Type: application/x-www-form-urlencoded
X-Requested-With: XMLHttpRequest
X-Csrf-Token: <csrf dari langkah 2>
Cookie: <cookie sesi>
Referer: https://erp.esb.co.id/report/report-cancel-menu-detail
```

Isi body (`P` = `CancelMenuDetailReport`):

| Field | Nilai |
| --- | --- |
| `_csrf-esb-fnb-backend` | csrf langkah 2 |
| `P[reportDate]` | `DD-MM-YYYY - DD-MM-YYYY` |
| `P[dateFrom]`, `P[dateTo]` | `DD-MM-YYYY` |
| `P[selectedBranchText]` | `All Branch` |
| `P[branchID]` | *(kosong = semua outlet)* |
| `P[statusCancelFilter]` | `all` |
| `P[typeVoid]` | nilai dari dropdown langkah 2 |
| `P[isPreviewBill]` | `1` |
| `P[salesNum]`, `P[menuName]`, `P[visitPurposeID]`, `P[menuCategory]`, `P[menuCategoryDetail]`, `P[menuCode]`, `P[cancelNotes]` | kosong |
| `POST_USER_SESSION` | dari langkah 2 |

> **Format tanggal `DD-MM-YYYY`, bukan `YYYY-MM-DD`.** Salah format tidak
> menghasilkan galat — ESB hanya mengembalikan data kosong.

Balasannya JSON `{ status, data }`. Isi `data` adalah **URL berkas export
internal**, dipakai di langkah 4.

### Langkah 4 — Baca export, halaman per halaman

```
POST /report_service/main/get-data-report
X-Requested-With: XMLHttpRequest
X-Csrf-Token: <csrf>
Cookie: <cookie sesi>

url=<URL dari langkah 3>&page=<0,1,2,…>
```

Export dibuat **asinkron**, jadi permintaan pertama biasanya belum siap. Lihat
Jebakan #1 untuk cara menunggunya.

Balasannya HTML grid (Krajee GridView). Kolomnya dikenali dari label `<th>`,
bukan dari posisi — susunan kolom laporan Cancel/Void **berbeda** dengan laporan
Delete:

```
Sales Number · Branch · Menu · Menu Code · Menu Category · Category Detail ·
Order By · Order Time · Cancel/Void By · Cancel/Void Time · Type · Notes ·
Qty · Subtotal · Service Charge · Tax · Total
```

Jumlah total item dibaca dari teks `Showing 1-N of X` pada grid.

---

## Memisahkan Void, Cancel, dan gabungannya

Export default berisi **keduanya sekaligus**. Pemisahannya dari kolom `Type`:

```js
const isVoid   = /void/i.test(row.type);
const isCancel = /cancel/i.test(row.type) && !/void/i.test(row.type);
```

Urutannya penting: sebagian nilai `type` memuat kedua kata, dan tanpa
`&& !/void/i` baris yang sama akan terhitung dua kali.

| Yang diminta | Caranya |
| --- | --- |
| Void saja | saring `isVoid` |
| Cancel saja | saring `isCancel` |
| Void + Cancel | seluruh baris export default |
| Delete Order | export terpisah, lihat di bawah |

### Delete Order (item dihapus sebelum struk disimpan)

Laporan berbeda, dipilih lewat dropdown `typeVoid` yang sama. Nilai yang benar
adalah **`Removed Before Save`** — sudah diverifikasi dari form aslinya. Cari
opsi ini dari halaman; kalau tidak ketemu, ambil export default lalu saring
sendiri berdasarkan kolom `Type`.

---

## Jebakan yang sudah kami temukan di produksi

Bagian ini yang paling berharga. Semuanya ditemukan setelah data salah lebih
dulu masuk ke sistem — bukan dari dokumentasi.

**#1 — Export asinkron, dan "belum siap" menyamar sebagai galat.**
Saat berkas belum jadi, ESB membalas HTTP 404 **dan juga** HTTP 200 dengan body
`{"code":404}`. Body-nya kadang ter-encode ganda (`\"code\":404`). Periksa
keduanya sebelum menyerah; ulangi tiap 2 detik. Di antara percobaan, panggil
`GET /site/get-data-report-queue?draw=1&start=0&length=10` — inilah yang
dilakukan browser untuk mendorong worker ESB melanjutkan pekerjaannya.

**#2 — ESB melayani SATU export per sesi. Panggilan paralel memberi berkas yang salah.**
Terverifikasi di produksi: dua hari yang diproses bersamaan saling tertukar
export-nya, dan pembacaan halaman mengembalikan **±40% baris milik hari lain**.
Tidak ada galat sama sekali — datanya sekadar salah. **Seluruh** proses generate
dan pembacaan halaman wajib dijalankan berurutan lewat satu antrean.

**#3 — Ukuran halaman berbeda antar laporan.**
Cancel/Void = **50 baris/halaman**. Delete = **20 baris/halaman**. Mengasumsikan
50 untuk keduanya diam-diam membuang **±58%** item Delete. Baca ukuran halaman
dari grid-nya sendiri, jangan dipatok.

**#4 — Sel kosong mewarisi baris sebelumnya (`rowspan`).**
Grid Krajee menggabungkan kolom tingkat struk: mulai item kedua dalam satu
struk, `<td>` untuk nomor struk/outlet/kasir **tidak ada sama sekali** di baris
itu. Melewati baris seperti ini kehilangan ±58% item. Aturannya: sel **teks**
yang tidak ada mewarisi nilai baris sebelumnya; sel **angka** yang tidak ada
bernilai 0 — kalau angka ikut mewarisi, nominalnya terhitung dobel.

**#5 — Nilai `typeVoid` yang tidak dikenal membuang SELURUH filter.**
Mengirim nilai dropdown yang tidak ada di form membuat ESB mengabaikan semua
filter — **termasuk rentang tanggalnya** — dan mengembalikan data yang salah
tanpa galat. Selalu baca opsinya dari halaman laporan yang hidup.

**#6 — `fetch` bawaan Node tidak punya batas waktu.**
Satu permintaan yang menggantung menggantungkan seluruh proses. Pasang timeout
per permintaan (kami pakai 15 detik) dan tenggat untuk keseluruhan rangkaian.
Menunggu 22 × 2 detik saja sudah melewati batas 60 detik serverless.

**#7 — Validasi silang yang tersedia gratis.**
Baris ringkasan di grid memuat total keseluruhan rentang yang diminta, dan
subtotalnya **sama persis** dengan angka di dashboard ESB. Pakai ini untuk
memastikan hasil parsing Anda benar.

**#8 — DUA SISTEM TIDAK BOLEH MEMAKAI SATU AKUN ESB YANG SAMA.**
Ini konsekuensi langsung dari #2, dan baru terasa saat sistem kedua mulai
jalan. Antrean export ESB (`/site/get-data-report-queue`) terikat pada **akun**,
bukan pada sesi login. Dua sistem yang login dengan akun yang sama akan
mengantre di tempat yang sama: sistem A meminta export, sistem B ikut membaca
antrean itu, lalu **keduanya mengurai berkas milik yang lain**.

Gejalanya persis seperti #2 — tidak ada galat, tidak ada log merah, hanya baris
milik tanggal atau outlet yang salah masuk ke basis data. Diam-diam, dan baru
ketahuan saat ada yang mempertanyakan angkanya berminggu-minggu kemudian.

**Setiap sistem wajib punya akun laporan ESB-nya sendiri.** Ini bukan soal
pembatasan akses — ini supaya kedua sistem tidak saling merusak datanya.
Sebagai bonus, kalau satu akun terkunci atau kena rate-limit, yang satunya
tetap jalan.

---

## Arsitektur yang kami sarankan

Jangan menarik dari ESB saat halaman dibuka — terlalu lambat dan terlalu rapuh.

1. **Cron harian** menarik data ke tabel Anda sendiri, satu hari per satuan
   kerja, dan mencatat mana yang sudah lengkap.
2. **Aplikasi membaca dari tabel itu**, tidak pernah langsung dari ESB.
3. **Catat kelengkapannya** (`total_items` vs `rows_read`, `complete`) supaya
   hari yang gagal bisa diulang tanpa mengulang semuanya dari nol.

Tanpa langkah 3, hari yang tersinkron sebagian akan terlihat seperti hari yang
memang sepi — dan itu justru menyembunyikan fraud, bukan menemukannya.

---

## Mulai dari mana

Dokumen ini menjelaskan alurnya, tapi **implementasi yang sudah jalan di
produksi ada di repositori ini** dan itu rujukan yang paling akurat. Urutan baca
yang kami sarankan:

1. **`src/lib/integrations/esb-client.ts`** — inti seluruh integrasi: login,
   generate export, baca halaman, antrean serial. Kalau hanya sempat membaca
   satu berkas, baca ini.
2. **`src/lib/integrations/esb.ts`** — pengurai grid HTML. Di sinilah penanganan
   `rowspan` (#4) dan pengenalan kolom lewat label `<th>` berada.
3. **`supabase/migrations/0022_fraud_sync.sql`** — skema tabel. Bisa dipakai apa
   adanya di Postgres mana pun.
4. **`src/lib/data/fraud-store.ts`** — pola tulis ke basis data + penandaan
   kelengkapan.
5. **`src/app/api/cron/fraud-sync/`** — cron harian, termasuk pembagian anggaran
   waktu supaya tidak kena batas 60 detik serverless.
6. **`src/lib/data/fraud.ts`** — agregasi dan pemisahan void/cancel untuk
   ditampilkan.

Alurnya sengaja dipisah begini supaya tiap lapisan bisa diuji sendiri. Kalau
sistem Anda berbeda arsitekturnya, yang wajib ditiru hanya `esb-client.ts` dan
`esb.ts` — sisanya menyesuaikan.

## Rujukan kode

| Berkas | Isi |
| --- | --- |
| `src/lib/integrations/esb-client.ts` | login, generate export, baca halaman, antrean serial |
| `src/lib/integrations/esb.ts` | pengurai grid HTML, pengenalan kolom |
| `src/lib/data/fraud.ts` | agregasi, pemisahan void/cancel |
| `src/lib/data/fraud-store.ts` | cache basis data |
| `src/app/api/cron/fraud-sync/` | cron harian |
| `supabase/migrations/0022_fraud_sync.sql` | skema `fraud_orders` + `fraud_sync` |
