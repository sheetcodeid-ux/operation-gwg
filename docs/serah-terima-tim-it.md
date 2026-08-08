# Panduan Serah Terima ke Tim IT

Dokumen ini menjawab satu pertanyaan: **apa yang perlu diberikan ke tim IT, dan
apa yang harus disiapkan lebih dulu.**

Mencakup GitHub, ESB (data void & cancel), Vercel, Supabase, dan Cloudflare R2.

---

## Bagian 0 — Tentukan ini dulu

Jawaban seluruh dokumen ini bercabang di satu pertanyaan. **Tanyakan ke tim IT
sebelum memberi apa pun:**

> "Kalian mau membangun sistem sendiri yang menarik data dari ESB, atau mau ikut
> mengembangkan aplikasi Operation GWG yang sudah ada?"

| | **A. Sistem terpisah** | **B. Ikut kembangkan app ini** |
| --- | --- | --- |
| GitHub | ✅ Perlu (sebagai rujukan) | ✅ Perlu |
| Kredensial ESB | ✅ Perlu (akun sendiri) | ⬜ Tidak — akun yang ada sudah jalan |
| Vercel | ⬜ **Tidak perlu** | ✅ Perlu |
| Supabase | ⬜ **Tidak perlu** | ✅ Perlu (proyek terpisah) |
| Cloudflare R2 | ⬜ **Tidak perlu** | ⬜ Hanya kalau menggarap fitur unggah |

**Kalau jawabannya A — dan dari pembicaraan sejauh ini kemungkinan besar
memang A — maka Vercel dan Supabase TIDAK perlu diberikan sama sekali.** Mereka
akan punya Vercel dan database sendiri. Memberi akses ke milik Anda hanya
menambah risiko tanpa memberi mereka manfaat apa pun.

Sisa dokumen ini menandai tiap bagian dengan **[A]**, **[B]**, atau **[A+B]**.

---

## Bagian 1 — GitHub **[A+B]**

### 1.1 Kunci branch `main` — lakukan SEBELUM mengundang siapa pun

Kondisi sekarang: **`main` tidak terproteksi**, dan setiap push ke `main`
**langsung tayang ke produksi** lewat Vercel. Memberi akses Write pada kondisi
ini berarti satu perintah salah di terminal bisa menimpa seluruh riwayat kerja
dan langsung sampai ke pengguna.

Ini bukan soal percaya atau tidak. Ini soal `git push --force` yang salah target
— dan itu terjadi pada developer paling senior sekalipun.

**Caranya:** Settings → Branches → *Add branch ruleset* → target `main`, aktifkan:

- ✅ **Require a pull request before merging**
- ✅ **Block force pushes**
- ✅ **Require status checks to pass** → pilih **CI** (workflow-nya sudah ada di
  `.github/workflows/ci.yml`)

Hasilnya: tim IT tetap bisa bekerja penuh, hanya saja perubahan masuk lewat Pull
Request. Riwayat kerja Anda tidak bisa hilang.

### 1.2 Undang sebagai collaborator

Settings → Collaborators → **Add people** → username GitHub mereka → peran
**Write**.

- **Satu undangan per orang.** Jangan akun bersama — dengan akun bersama Anda
  tidak akan pernah tahu siapa mengubah apa, dan mencabut akses satu orang jadi
  mustahil.
- Peran **Admin** hanya untuk yang memang perlu mengubah pengaturan repo.

### 1.3 Yang TIDAK perlu dilakukan

Repositori dan seluruh riwayat commit-nya sudah dipindai: **tidak ada satu pun
kredensial yang pernah ter-commit**, dan pola `.env*` diblokir `.gitignore`.

Memberi akses repo **tidak** memberi mereka kunci apa pun. Tidak ada yang perlu
dibersihkan.

### 1.4 Yang mereka dapat otomatis dari akses ini

| Berkas | Isi |
| --- | --- |
| `docs/esb-fraud-integration.md` | **Cara mengambil void & cancel dari ESB** — alur lengkap + 8 jebakan |
| `src/lib/integrations/esb-client.ts` | Implementasi login, generate export, antrean serial |
| `src/lib/integrations/esb.ts` | Pengurai grid HTML ESB |
| `supabase/migrations/0022_fraud_sync.sql` | Skema tabel `fraud_orders` + `fraud_sync` |
| `src/app/api/cron/fraud-sync/` | Cron harian |
| `.env.example` | Daftar 15 variabel yang dibaca aplikasi |
| `README.md` | Bagian *Onboarding developer baru* |

Jadi **dokumen integrasi fraud terkirim otomatis lewat akses GitHub.** Tidak
perlu mengirim berkas terpisah.

---

## Bagian 2 — ESB: data Void & Cancel **[A]**

### 2.1 Yang dikirim

```
ESB_BASE_URL   = https://erp.esb.co.id
ESB_USERNAME   = (akun laporan KHUSUS untuk sistem mereka)
ESB_PASSWORD   = (kata sandinya)
```

### 2.2 Akun ESB WAJIB terpisah — ini soal data, bukan akses

Mintakan ke pihak ESB **satu akun laporan baru** khusus untuk sistem mereka.
Jangan pakai akun yang sekarang dipakai Operation GWG.

Alasannya teknis, bukan kepercayaan:

> **Antrean export ESB terikat pada AKUN, bukan pada sesi login.** Dua sistem
> yang login dengan akun sama akan mengantre di tempat yang sama, lalu
> **masing-masing mengurai berkas milik yang lain**.
>
> Gejalanya: tidak ada error, tidak ada log merah — hanya baris tanggal atau
> outlet yang salah masuk ke basis data. Kami pernah kena versi ringannya:
> **±40% baris milik hari lain**, baru ketahuan setelah angkanya dipertanyakan.

Bonusnya: kalau satu akun terkunci atau kena rate-limit, sistem yang satunya
tetap jalan.

Beri tahu juga pihak ESB bahwa akan ada sistem kedua yang menarik laporan,
supaya tidak dikira serangan.

### 2.3 Hak akses akun tersebut

Cukup bisa membuka menu **Report**. **Jangan master admin** — seluruh alur ini
hanya MEMBACA laporan, tidak pernah menulis apa pun ke POS.

### 2.4 Yang perlu mereka baca

Semua ada di `docs/esb-fraud-integration.md`. Ringkasnya:

**ESB tidak punya API.** Yang ada hanya aplikasi web PHP/Yii2 dengan laporan
asinkron yang dikirim sebagai potongan HTML. Integrasi bekerja dengan meniru
persis apa yang dilakukan browser.

Alurnya 4 langkah:
1. **Login** — `GET /site/login` ambil CSRF → `POST /site/login` dengan
   **seluruh input tersembunyi** form-nya (ada `challengeToken`)
2. **Buka halaman laporan** — ambil CSRF baru, `POST_USER_SESSION`, opsi
   dropdown `typeVoid`
3. **Minta export** — `POST /report/report-cancel-menu-detail`, tanggal
   format **`DD-MM-YYYY`**
4. **Baca per halaman** — `POST /report_service/main/get-data-report`

Pemisahan Void / Cancel dari kolom `Type`:

```js
const isVoid   = /void/i.test(row.type);
const isCancel = /cancel/i.test(row.type) && !/void/i.test(row.type);
```

| Yang diminta | Caranya |
| --- | --- |
| Void saja | saring `isVoid` |
| Cancel saja | saring `isCancel` |
| Void + Cancel | seluruh baris export default |
| Delete Order | export terpisah (`typeVoid` = `Removed Before Save`) |

### 2.5 Suruh mereka baca bagian "Jebakan" SEBELUM koding

Waktu mereka akan habis bukan di login atau parsing, tapi di tiga hal ini —
semuanya gagal **tanpa satu pun pesan error**:

| # | Jebakan | Akibat |
| --- | --- | --- |
| 2 | ESB melayani satu export per sesi | ±40% baris milik hari lain |
| 3 | Ukuran halaman beda: Cancel/Void 50, Delete 20 | ±58% item Delete hilang |
| 4 | Sel hilang karena `rowspan` | ±58% item hilang |
| 5 | Nilai `typeVoid` asing | SELURUH filter dibuang, tanggal termasuk |

Selengkapnya (8 jebakan) ada di dokumen.

---

## Bagian 3 — Vercel

### Skenario A: sistem terpisah → **tidak perlu diberikan apa pun**

Mereka akan deploy ke Vercel/server mereka sendiri. Akun Vercel Anda tidak ada
hubungannya dengan pekerjaan mereka.

### Skenario B: ikut kembangkan app ini

**Jangan memberikan nilai environment variable-nya.** Beri akses ke
project-nya, biar Vercel yang mengurus.

**Caranya:** Vercel → project **operation-gwg** → Settings → **Members** →
Invite. Peran **Member** (bukan Owner).

Dengan itu mereka dapat:
- Preview deployment otomatis untuk tiap Pull Request
- Log runtime & build untuk debugging
- Riwayat deployment dan tombol rollback

Yang **tidak** otomatis mereka dapat: nilai environment variable produksi.
Biarkan begitu — untuk pengembangan mereka pakai `.env.local` sendiri.

**Yang perlu diketahui tentang project ini:**

| | |
| --- | --- |
| Region | `sin1` (Singapura) |
| Cron | `/api/cron/fraud-sync` tiap hari 21:30 UTC (04:30 WIB) |
| Auto-deploy | Setiap push ke `main` langsung ke produksi |
| Batas fungsi | 60 detik — alasan sinkronisasi ESB dipecah per hari |

---

## Bagian 4 — Supabase

### Skenario A: sistem terpisah → **tidak perlu diberikan apa pun**

Mereka bikin database sendiri. Skema tabelnya sudah tersedia di repo
(`supabase/migrations/0022_fraud_sync.sql`) — tinggal dijalankan di Postgres
mana pun.

> **Kalau ternyata mereka hanya butuh DATANYA, bukan integrasinya:** data ini
> sudah lengkap di database Anda — **154.892 baris, 32 MB, 1 Januari 2026
> sampai sekarang, 57 outlet**. Jauh lebih cepat memberi akses baca ke tabel itu
> daripada menyuruh mereka menarik ulang dari ESB. Bilang saja kalau mau
> disiapkan.

### Skenario B: ikut kembangkan app ini

**Buatkan proyek Supabase TERPISAH untuk development.** Jangan bagikan yang
produksi.

Alasannya: `SUPABASE_SERVICE_ROLE_KEY` **melewati seluruh Row Level Security** —
setara kata sandi root database. Siapa pun yang memegangnya bisa membaca dan
menulis semua tabel: data karyawan, gaji, penilaian, seluruhnya. Satu `delete`
salah ketik saat development langsung mengenai data produksi.

**Caranya:**
1. Buat proyek Supabase baru (mis. `operation-gwg-dev`)
2. Jalankan migrasinya: `supabase link --project-ref <ref-baru>` lalu
   `supabase db push` — seluruh skema terbentuk dari `supabase/migrations/`
3. Berikan kunci proyek **dev** itu ke mereka

Kalau memang harus akses ke produksi (misal menelusuri bug data): Supabase →
Organization → **Team** → Invite, peran **Developer**, dan cabut setelah selesai.

**Yang perlu diketahui tentang proyek ini:**

| | |
| --- | --- |
| Nama | `operation-gwg` |
| Region | `ap-northeast-2` (Seoul) |
| Postgres | 17.6 |
| Tabel fraud | `fraud_orders` (32 MB), `fraud_sync`, `sales_daily`, `sales_period` |

---

## Bagian 5 — Cloudflare R2 **[B, dan hanya bila perlu]**

Penyimpanan lampiran: berkas pengajuan, foto hygiene, bukti tindak lanjut,
lampiran obrolan.

Hanya diperlukan kalau mereka menggarap fitur unggah berkas. Kalau iya,
**buatkan bucket + API token terpisah untuk development**, jangan bagikan yang
produksi — supaya berkas uji coba tidak bercampur dengan dokumen asli.

---

## Bagian 6 — Aturan penanganan kredensial

Berlaku untuk semua di atas.

1. **Jangan pernah mengirim nilai rahasia lewat chat, email, atau WhatsApp.**
   Pesan bisa diteruskan, ter-backup ke cloud, dan tidak bisa ditarik kembali.
   Pakai pengelola kata sandi bersama (1Password / Bitwarden).
2. **Lebih baik mereka membuat akunnya sendiri** daripada Anda membagikan milik
   Anda. Berlaku untuk ESB, Supabase, Vercel, R2 — semuanya.
3. **Kredensial produksi tinggal di Vercel → Environment Variables**, bukan di
   berkas yang beredar antar orang.
4. **Kalau ada rahasia yang terlanjur tersebar:** ganti di sumbernya
   (ESB / Supabase / Cloudflare), lalu perbarui di Vercel. Menghapus pesannya
   tidak membatalkan rahasianya.

---

## Bagian 7 — Checklist

**Sebelum mengundang siapa pun**
- [ ] Kunci branch `main` (require PR, block force push, require CI)
- [ ] Tanyakan ke tim IT: sistem terpisah, atau ikut kembangkan app ini?
- [ ] Kalau mereka menarik dari ESB → mintakan akun laporan ESB **baru**

**Mengundang**
- [ ] GitHub → Collaborators → Add people, peran **Write**, satu per orang
- [ ] *(hanya skenario B)* Vercel → Members → Invite, peran **Member**
- [ ] *(hanya skenario B)* Buat proyek Supabase dev + jalankan migrasi

**Mengirim kredensial**
- [ ] Lewat pengelola kata sandi, **bukan chat**
- [ ] ESB: akun terpisah, hak akses Report saja, bukan master admin
- [ ] Beri tahu pihak ESB akan ada sistem kedua yang menarik laporan

**Menyusul**
- [ ] Pastikan mereka membaca `docs/esb-fraud-integration.md` bagian **Jebakan**
      sebelum mulai koding

---

## Bagian 8 — Contoh pesan untuk dikirim

> Halo, berikut akses untuk Operation GWG.
>
> **Repo:** https://github.com/sheetcodeid-ux/operation-gwg
> Undangan collaborator sudah dikirim ke akun GitHub kalian — cek notifikasi GitHub.
>
> **Mulai:**
> ```
> git clone https://github.com/sheetcodeid-ux/operation-gwg.git
> cd operation-gwg && npm install && npm run dev
> ```
> Aplikasi langsung jalan penuh dalam mode demo (data contoh, pilih persona di
> layar login). Tidak butuh kredensial apa pun untuk baca kode dan jalankan tes.
>
> **Untuk integrasi ESB void & cancel, baca berurutan:**
> 1. `docs/esb-fraud-integration.md` — terutama bagian **Jebakan**, baca ini
>    SEBELUM mulai koding. Ada 8 kegagalan yang semuanya terjadi tanpa pesan
>    error, dan tiga di antaranya pernah membuat kami kehilangan ±58% data.
> 2. `src/lib/integrations/esb-client.ts` — implementasi yang sudah jalan di produksi
> 3. `supabase/migrations/0022_fraud_sync.sql` — skema tabelnya
>
> **Akun ESB kalian dikirim terpisah lewat password manager.** Akunnya sengaja
> berbeda dari yang dipakai sistem kami — antrean export ESB terikat ke akun,
> jadi kalau dua sistem pakai akun sama, keduanya akan mengurai berkas milik
> yang lain tanpa error apa pun.
>
> **Catatan:** `main` terkunci, perubahan lewat Pull Request.

---

## Lampiran — 15 environment variable

Daftar lengkap ada di `.env.example`. Ringkasnya siapa butuh apa:

| Variabel | Untuk apa | Skenario A | Skenario B |
| --- | --- | --- | --- |
| `ESB_BASE_URL` | Alamat ESB | ✅ | ⬜ |
| `ESB_USERNAME` | Akun laporan ESB | ✅ akun sendiri | ⬜ |
| `ESB_PASSWORD` | Kata sandinya | ✅ akun sendiri | ⬜ |
| `NEXT_PUBLIC_SUPABASE_URL` | Alamat proyek Supabase | ⬜ | ✅ proyek dev |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Kunci publik (aman di browser) | ⬜ | ✅ proyek dev |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ **Melewati seluruh RLS** | ⬜ | ✅ proyek dev |
| `GWG_SUPABASE_URL` | Alamat untuk lapisan data | ⬜ | ✅ proyek dev |
| `GWG_SUPABASE_KEY` | Cadangan service key | ⬜ | ⬜ |
| `GWG_SESSION_SECRET` | Penanda tangan cookie sesi | ⬜ | ✅ buat sendiri |
| `GWG_ADMIN_RPC_SECRET` | Rahasia RPC pembuatan akun | ⬜ | ✅ proyek dev |
| `R2_ENDPOINT` | Alamat penyimpanan | ⬜ | hanya bila perlu |
| `R2_BUCKET` | Nama bucket | ⬜ | hanya bila perlu |
| `R2_ACCESS_KEY_ID` | Kunci akses R2 | ⬜ | hanya bila perlu |
| `R2_SECRET_ACCESS_KEY` | Rahasia R2 | ⬜ | hanya bila perlu |
| `CRON_SECRET` | Pelindung endpoint cron | ⬜ | diisi Vercel otomatis |

`GWG_SESSION_SECRET` tidak perlu dibagikan — mereka buat sendiri:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```
