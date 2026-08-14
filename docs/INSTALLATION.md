# Panduan Instalasi

Panduan lengkap dari nol sampai aplikasi berjalan di komputer Anda. Perkiraan
waktu: **15 menit**.

> **Anda tidak memerlukan kredensial apa pun untuk memulai.** Aplikasi berjalan
> penuh dalam mode demo dengan data contoh. Kredensial hanya diperlukan bila
> Anda memang harus mengakses data produksi.

---

## Daftar Isi

1. [Prasyarat](#1-prasyarat)
2. [Menyalin repositori](#2-menyalin-repositori)
3. [Memasang dependensi](#3-memasang-dependensi)
4. [Memeriksa lingkungan](#4-memeriksa-lingkungan)
5. [Menjalankan aplikasi](#5-menjalankan-aplikasi)
6. [Struktur proyek](#6-struktur-proyek)
7. [Perintah harian](#7-perintah-harian)
8. [Alur kerja kontribusi](#8-alur-kerja-kontribusi)
9. [Menghubungkan data produksi](#9-menghubungkan-data-produksi-opsional)
10. [Pemecahan masalah](#10-pemecahan-masalah)

---

## Tentang aplikasi ini

Platform operasional internal GWG Group (Nordu Coffee, Cattu, Busari, Lesung
Pipi) untuk memantau 50+ outlet: hospitality, hygiene, work tracker, event,
komplain, HPP, e-learning, assessment, dan analisis fraud POS.

| Komponen | Teknologi |
| --- | --- |
| Framework | Next.js 16 — App Router, Server Components, Server Actions |
| Bahasa | TypeScript (mode strict) |
| Antarmuka | Tailwind CSS v4, komponen dibangun sendiri |
| Basis data | Supabase (PostgreSQL 17) |
| Penyimpanan berkas | Cloudflare R2 |
| Deployment | Vercel |
| Pengujian | Vitest |

### Dua catatan sebelum menulis kode

**Next.js 16 berbeda cukup jauh dari versi sebelumnya.** API, konvensi, dan
struktur berkasnya banyak berubah. Rujukan yang benar ada di
`node_modules/next/dist/docs/` — bukan artikel blog lama atau jawaban Stack
Overflow yang menargetkan versi 13/14. Perhatikan juga catatan deprecation.

**Seluruh komentar kode dan teks antarmuka menggunakan Bahasa Indonesia.**
Mohon ikuti konvensi ini saat menambahkan kode.

---

## 1. Prasyarat

Periksa dulu apa yang sudah terpasang:

```bash
node -v      # butuh v20.0.0 atau lebih baru
npm -v
git --version
```

### Bila Node belum ada atau versinya terlalu lama

Gunakan [nvm](https://github.com/nvm-sh/nvm) agar versi Node bisa berpindah
per proyek:

```bash
# macOS / Linux
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# tutup dan buka ulang terminal, lalu:
nvm install 22
nvm use 22
```

Pengguna Windows: gunakan [nvm-windows](https://github.com/coreybutler/nvm-windows)
atau jalankan melalui WSL2.

> Proyek ini akan menolak berjalan pada Node di bawah v20. Next.js 16
> membutuhkannya, dan gejala kegagalannya menyesatkan bila dipaksakan.

---

## 2. Menyalin repositori

### Cara A — Git (disarankan)

Cara ini yang Anda perlukan bila akan ikut mengembangkan aplikasi.

```bash
git clone https://github.com/sheetcodeid-ux/operation-gwg.git
cd operation-gwg
```

Bila menggunakan SSH:

```bash
git clone git@github.com:sheetcodeid-ux/operation-gwg.git
cd operation-gwg
```

<details>
<summary><strong>Menyiapkan kunci SSH</strong> (sekali per komputer)</summary>

```bash
ssh-keygen -t ed25519 -C "email-anda@contoh.com"   # tekan Enter tiga kali
cat ~/.ssh/id_ed25519.pub                          # salin seluruh isinya
```

Tempelkan ke **GitHub → foto profil → Settings → SSH and GPG keys →
New SSH key**.

Uji koneksinya:

```bash
ssh -T git@github.com
# Hi <username>! You've successfully authenticated...
```

Pesan `The authenticity of host 'github.com' can't be established` pada koneksi
pertama adalah normal — ketik `yes`.
</details>

### Cara B — Unduh tanpa riwayat Git

Bila Anda hanya ingin membaca atau menjadikannya rujukan, dan tidak
memerlukan riwayat commit:

```bash
# Kode terbaru saja, tanpa folder .git
curl -L https://github.com/sheetcodeid-ux/operation-gwg/archive/refs/heads/main.tar.gz | tar -xz
cd operation-gwg-main
```

Atau melalui antarmuka GitHub: tombol hijau **Code** → **Download ZIP**.

Alternatif lain, clone dangkal — hanya commit terakhir, `.git` tetap ada tetapi
jauh lebih kecil:

```bash
git clone --depth 1 https://github.com/sheetcodeid-ux/operation-gwg.git
```

### Yang TIDAK ikut tersalin

| Berkas | Status |
| --- | --- |
| `.env`, `.env.local`, `.env.production` | **Tidak pernah ada di repositori** |
| Kredensial ESB, Supabase, Cloudflare R2 | **Tidak pernah ada di repositori** |
| Kunci API atau token apa pun | **Tidak pernah ada di repositori** |

Pola `.env*` diblokir oleh `.gitignore`, dan seluruh riwayat commit sudah
diaudit — tidak ada satu pun rahasia yang pernah masuk. Yang tersedia hanyalah
`.env.example`, berisi nama variabel beserta keterangannya tanpa satu pun nilai
sungguhan.

Folder `.git` melekat pada mekanisme clone dan berisi riwayat perubahan kode —
bukan kredensial. Gunakan **Cara B** bila memang tidak menginginkannya.

---

## 3. Memasang dependensi

```bash
npm install
```

Membutuhkan 1–2 menit pada koneksi normal.

> **Peringatan `npm audit` boleh diabaikan.** Kerentanan yang dilaporkan berada
> pada dependensi tidak langsung dan tidak memengaruhi aplikasi.
>
> **Jangan menjalankan `npm audit fix --force`** — perintah tersebut menaikkan
> versi mayor beberapa paket dan akan merusak build.

---

## 4. Memeriksa lingkungan

```bash
npm run doctor
```

Perintah ini memeriksa hal-hal yang pernah menghabiskan waktu berjam-jam karena
gejalanya menyesatkan — aplikasi tampak rusak padahal kodenya baik-baik saja:

- Versi Node
- Kelengkapan pemasangan dependensi
- **Lockfile nyasar di folder induk** (penyebab halaman membalas 404 secara acak)
- Cache build yang basi
- Mode yang sedang aktif: demo atau data produksi
- `.gitignore` benar-benar memblokir berkas `.env`

Keluaran yang sehat:

```
  Pemeriksaan lingkungan Operation GWG
  ────────────────────────────────────────────────
  ✓ Node 22.22.2
  ✓ Next.js 16.2.9 terpasang
  ✓ Tidak ada lockfile nyasar di folder induk
  ✓ Mode DEMO (belum ada .env.local)
  ✓ .env* diblokir .gitignore
  ────────────────────────────────────────────────
  Semua siap. Jalankan:  npm run dev
```

Jalankan perintah ini lebih dulu setiap kali ada yang tidak beres, sebelum
menelusuri kode.

---

## 5. Menjalankan aplikasi

```bash
npm run dev
```

Buka **http://localhost:3000** — Anda akan diarahkan ke halaman login.

### Memilih persona demo

Setiap persona menerapkan aturan hak akses dan pembatasan data yang sungguhan,
sama persis seperti di produksi:

| Persona | Cakupan yang terlihat |
| --- | --- |
| GWG Admin (Super Admin) | Seluruh modul + manajemen pengguna |
| Head of Operations | Seluruh outlet + audit log |
| Coordinator Area | Hanya area yang dipegangnya |
| Supervisor | Hanya outlet yang ditugaskan kepadanya |

Data yang tampil adalah **data contoh yang dibangkitkan di memori**, bukan data
produksi. Ini perilaku yang benar selama berkas `.env.local` belum ada.

---

## 6. Struktur proyek

```
operation-gwg/
├── docs/
│   ├── INSTALLATION.md            panduan ini
│   └── FRAUD_INTEGRATION.md       integrasi analisis fraud dari POS ESB
├── scripts/
│   └── doctor.mjs                 pemeriksa lingkungan
├── src/
│   ├── app/                       rute aplikasi (App Router)
│   │   ├── (app)/                 halaman yang memerlukan login
│   │   ├── (auth)/login/          halaman login
│   │   └── api/cron/              tugas terjadwal
│   ├── components/                komponen antarmuka per modul
│   │   ├── ui/                    primitif dasar (Button, DataTable, …)
│   │   └── operation/             modul Operation termasuk analisis fraud
│   └── lib/
│       ├── actions/               Server Actions — seluruh penulisan data
│       ├── data/                  lapisan baca basis data (server-only)
│       ├── integrations/          klien ESB (sistem POS)
│       ├── nav.ts                 definisi menu + aturan hak akses
│       └── rbac.ts                pembatasan data per peran
└── supabase/
    └── migrations/                39 migrasi skema, dijalankan berurutan
```

### Tiga aturan yang menjaga keamanan aplikasi

**1. Seluruh penulisan data melalui Server Action.** Setiap action mengambil
sesinya sendiri melalui `getSessionUser()` dan tidak pernah menerima ID pengguna
dari argumen. Bila menerima, siapa pun yang memanggil server dapat bertindak
atas nama orang lain.

**2. Hak akses diperiksa di server, bukan pada tombol.** Tombol yang
disembunyikan hanya menutup jalur normal; pemanggilan langsung ke server tetap
harus ditolak. Setiap halaman dan setiap Server Action memiliki pemeriksaannya
sendiri.

**3. Modul di `lib/data/` memakai `import "server-only"`.** Saat ini diterapkan
pada 51 berkas, memastikan kode basis data tidak pernah ikut ke bundel browser.

---

## 7. Perintah harian

```bash
npm run dev          # server pengembangan
npm run doctor       # periksa lingkungan
npm run lint         # ESLint — wajib 0 error
npm run typecheck    # tsc --noEmit
npm test             # Vitest (161 pengujian)
npm run build        # build produksi
```

Jalankan **lint, typecheck, test, dan build** sebelum membuka Pull Request. CI
menjalankan hal yang sama, dan PR tidak dapat digabungkan bila ada yang gagal.

---

## 8. Alur kerja kontribusi

Branch `main` dilindungi — tidak ada yang dapat melakukan push langsung ke sana.
Seluruh perubahan melalui Pull Request.

```bash
# 1. Mulai dari main terbaru
git checkout main
git pull origin main

# 2. Buat branch baru
git checkout -b fitur/nama-pekerjaan

# 3. Kerjakan perubahannya, lalu verifikasi
npm run lint && npm run typecheck && npm test

# 4. Commit dan push
git add -A
git commit -m "penjelasan singkat perubahan dan alasannya"
git push -u origin fitur/nama-pekerjaan
```

Selanjutnya buka Pull Request di GitHub. Diperlukan satu persetujuan dan CI
berstatus hijau agar dapat digabungkan.

> **Setiap penggabungan ke `main` langsung tayang ke produksi** melalui Vercel.

### Konvensi penamaan branch

| Awalan | Untuk |
| --- | --- |
| `fitur/` | fitur baru |
| `perbaikan/` | perbaikan bug |
| `docs/` | perubahan dokumentasi |

---

## 9. Menghubungkan data produksi (opsional)

Hanya diperlukan bila Anda memang harus mengakses data sungguhan.

```bash
cp .env.example .env.local
```

Berkas `.env.example` menjelaskan setiap variabel dan dari mana nilainya
diambil. Isi hanya yang relevan dengan pekerjaan Anda:

| Pekerjaan | Variabel yang perlu diisi |
| --- | --- |
| Antarmuka, komponen, pengujian | *(tidak ada — mode demo sudah cukup)* |
| Membaca/menulis data produksi | `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `GWG_SUPABASE_URL`, `GWG_SESSION_SECRET` |
| Analisis Fraud (void & cancel) | `ESB_USERNAME`, `ESB_PASSWORD` |
| Unggah berkas dan foto | `R2_*` |

`GWG_SESSION_SECRET` dibuat sendiri, tidak perlu diminta:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### Aturan penanganan kredensial

- **Mintalah kredensial melalui pengelola kata sandi** (1Password, Bitwarden) —
  jangan melalui chat, email, atau WhatsApp. Pesan dapat diteruskan, tersimpan
  di cadangan, dan tidak dapat ditarik kembali.
- `SUPABASE_SERVICE_ROLE_KEY` **melewati seluruh Row Level Security** — setara
  kata sandi root basis data. Untuk pengembangan, gunakan proyek Supabase
  terpisah, bukan produksi.
- `.env.local` sudah diblokir `.gitignore`. Pastikan tetap demikian.

---

## 10. Pemecahan masalah

Jalankan `npm run doctor` lebih dulu — sebagian besar masalah di bawah ini
terdeteksi otomatis oleh perintah tersebut.

<details>
<summary><strong>Sebagian halaman membalas 404 padahal rutenya ada</strong></summary>

Dua kemungkinan penyebab:

**a. Cache build basi** setelah menarik banyak perubahan:

```bash
rm -rf .next && npm run dev
```

**b. Lockfile nyasar di folder induk.** Turbopack menentukan akar proyek dengan
menelusuri ke atas mencari `package-lock.json`. Satu berkas nyasar di folder
home membuatnya memilih folder home sebagai akar, sehingga sebagian rute hidup
dan sebagian lain membalas 404 tanpa penjelasan apa pun.

Proyek ini sudah mematok akarnya melalui `turbopack.root` di `next.config.ts`,
jadi seharusnya tidak terjadi. Bila tetap terjadi, `npm run doctor` akan
menunjukkan lokasi berkas nyasarnya.
</details>

<details>
<summary><strong>Error "Cannot find module" saat menjalankan npm run dev</strong></summary>

Dependensi belum disamakan setelah `git pull` — berkas `package.json` sering
ikut berubah.

```bash
npm install
```

Bila masih gagal:

```bash
rm -rf node_modules package-lock.json && npm install
```
</details>

<details>
<summary><strong>git pull ditolak: "local changes would be overwritten"</strong></summary>

```bash
git stash              # simpan perubahan lokal sementara
git pull origin main
git stash pop          # kembalikan
```

Bila terjadi konflik saat `git stash pop`, selesaikan konfliknya lalu
`git add` berkas yang bersangkutan.
</details>

<details>
<summary><strong>Aplikasi berjalan tetapi seluruh datanya contoh</strong></summary>

Ini perilaku yang benar. Aplikasi berjalan dalam mode demo selama `.env.local`
belum ada. Lihat [bagian 9](#9-menghubungkan-data-produksi-opsional).
</details>

<details>
<summary><strong>Port 3000 sudah digunakan</strong></summary>

```bash
npm run dev -- -p 3001
```

Atau hentikan proses yang memakainya:

```bash
lsof -ti:3000 | xargs kill -9      # macOS / Linux
```
</details>

<details>
<summary><strong>npm audit melaporkan kerentanan</strong></summary>

Berada pada dependensi tidak langsung dan tidak memengaruhi aplikasi.
**Jangan menjalankan `npm audit fix --force`** — perintah tersebut menaikkan
versi mayor dan merusak build.
</details>

<details>
<summary><strong>git clone gagal: "Repository not found"</strong></summary>

Repositori ini publik, sehingga clone melalui HTTPS selalu berhasil. Bila Anda
menggunakan SSH dan menemui pesan ini, kunci SSH Anda belum terpasang di GitHub.
Ujilah dengan `ssh -T git@github.com`, atau gunakan URL HTTPS.
</details>

---

## Daftar periksa sebelum Pull Request pertama

- [ ] `npm run doctor` — seluruhnya hijau
- [ ] `npm run lint` — 0 error
- [ ] `npm run typecheck` — bersih
- [ ] `npm test` — seluruh pengujian lulus
- [ ] `npm run build` — berhasil
- [ ] Komentar kode dan teks antarmuka menggunakan Bahasa Indonesia
- [ ] Tidak ada kredensial atau rahasia yang ikut ter-commit
- [ ] Pesan commit menjelaskan **alasan**, bukan sekadar **apa** yang berubah

---

## Dokumen terkait

- **[FRAUD_INTEGRATION.md](FRAUD_INTEGRATION.md)** — cara menarik data void &
  cancel dari sistem POS ESB, lengkap dengan jebakan yang perlu dihindari
- **`.env.example`** — daftar seluruh variabel lingkungan beserta keterangannya
