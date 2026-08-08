# Panduan Memulai — Operation GWG

Dokumen ini untuk **developer yang baru bergabung**. Ikuti dari atas ke bawah;
sekitar 15 menit sampai aplikasinya jalan di laptop Anda.

**Kabar baiknya: Anda tidak butuh kredensial apa pun untuk mulai.** Aplikasi
jalan penuh dalam mode demo dengan data contoh. Kredensial baru diperlukan
kalau Anda memang harus menyentuh data sungguhan.

---

## Tentang aplikasi ini

Platform operasional internal GWG Group (Nordu Coffee, Cattu, Busari, Lesung
Pipi) — memantau 50+ outlet: hospitality, hygiene, work tracker, event,
komplain, HPP, e-learning, assessment, KPI, dan analisis fraud POS.

| | |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| Bahasa | TypeScript (strict) |
| Tampilan | Tailwind CSS v4, komponen dibuat sendiri |
| Basis data | Supabase (Postgres) |
| Penyimpanan | Cloudflare R2 |
| Deploy | Vercel |
| Tes | Vitest |

> ⚠️ **Next.js 16 berbeda cukup jauh dari versi yang mungkin Anda kenal.** API,
> konvensi, dan struktur berkasnya banyak berubah. Sebelum menulis kode, baca
> panduan yang relevan di `node_modules/next/dist/docs/` — bukan artikel blog
> lama atau jawaban Stack Overflow. Perhatikan juga catatan deprecation.

**Seluruh komentar kode dan teks antarmuka memakai Bahasa Indonesia.** Ikuti
kebiasaan ini saat menambah kode.

---

## Langkah 1 — Prasyarat

```bash
node -v      # butuh v20 atau lebih baru (kami pakai v22)
npm -v
git --version
```

Belum ada Node? Pasang lewat [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install 22 && nvm use 22
```

---

## Langkah 2 — Akses GitHub

**a. Terima undangan.** Cek email atau buka
https://github.com/sheetcodeid-ux/operation-gwg/invitations

Repositorinya privat — tanpa menerima undangan, `git clone` akan gagal dengan
"Repository not found" (bukan "access denied", jadi pesannya menyesatkan).

**b. Siapkan kunci SSH** — sekali seumur hidup per laptop:

```bash
ssh-keygen -t ed25519 -C "email-kantor@gwg.co"     # tekan Enter tiga kali
cat ~/.ssh/id_ed25519.pub                          # salin SELURUH isinya
```

Tempel ke **GitHub → klik foto profil → Settings → SSH and GPG keys →
New SSH key** → Title bebas → Paste → **Add SSH key**.

Uji:

```bash
ssh -T git@github.com
# Hi <username>! You've successfully authenticated...
```

> Pesan `The authenticity of host 'github.com' can't be established` pada
> koneksi pertama itu normal — ketik `yes`.

---

## Langkah 3 — Salin kodenya

```bash
git clone git@github.com:sheetcodeid-ux/operation-gwg.git
cd operation-gwg
npm install
```

`npm install` butuh 1–2 menit. Peringatan `npm audit` boleh diabaikan —
**jangan** jalankan `npm audit fix --force`, itu menaikkan versi mayor dan
merusak build.

Pakai HTTPS kalau SSH bermasalah:

```bash
git clone https://github.com/sheetcodeid-ux/operation-gwg.git
```

---

## Langkah 4 — Jalankan

```bash
npm run dev
```

Buka http://localhost:3000 → Anda akan diarahkan ke layar login.

**Pilih salah satu persona demo** — masing-masing menerapkan RBAC dan
pembatasan data yang sungguhan:

| Persona | Melihat apa |
| --- | --- |
| GWG Admin (Super Admin) | Semuanya + manajemen pengguna |
| Head of Operations | Semua outlet + audit log |
| Coordinator Area | Area-nya saja |
| Supervisor | Outlet yang ditugaskan padanya |

Data yang muncul adalah **data contoh yang dibangkitkan di memori**, bukan data
produksi. Memang begitu selama `.env.local` belum ada.

---

## Langkah 5 — Kenali struktur berkasnya

```
src/
├── app/                    rute (App Router)
│   ├── (app)/              halaman yang butuh login
│   ├── (auth)/login/       layar login
│   └── api/cron/           tugas terjadwal
├── components/             komponen UI, dikelompokkan per modul
│   ├── ui/                 primitif dasar (Button, Combobox, DataTable, …)
│   └── operation/          modul Operation, termasuk analisis fraud
├── lib/
│   ├── actions/            Server Actions — SEMUA penulisan data lewat sini
│   ├── data/               lapisan baca basis data (server-only)
│   ├── integrations/       klien ESB (POS)
│   ├── nav.ts              menu + aturan hak akses
│   └── rbac.ts             pembatasan data per peran
└── supabase/migrations/    39 migrasi skema, berurutan
```

**Tiga aturan yang menjaga aplikasi ini tetap aman:**

1. **Penulisan data selalu lewat Server Action** di `src/lib/actions/`. Tiap
   action mengambil sesinya sendiri lewat `getSessionUser()` — tidak pernah
   menerima id pengguna dari argumen. Kalau menerima, siapa pun yang memanggil
   server bisa bertindak atas nama orang lain.
2. **Hak akses diperiksa di server, bukan di tombol.** Tombol yang disembunyikan
   hanya menutup jalur normal; pemanggilan langsung ke server tetap harus
   ditolak.
3. **Modul di `lib/data/` memakai `import "server-only"`** supaya tidak pernah
   ikut ke bundle browser.

---

## Langkah 6 — Perintah harian

```bash
npm run dev          # server pengembangan
npm run lint         # eslint — wajib 0 error
npm run typecheck    # tsc --noEmit
npm test             # vitest (161 tes)
npm run build        # build produksi
```

**Jalankan keempatnya sebelum membuka Pull Request.** CI menjalankan hal yang
sama, dan PR tidak bisa di-merge kalau ada yang gagal.

---

## Langkah 7 — Alur kerja

Branch `main` **terkunci** — tidak ada yang bisa push langsung ke sana, termasuk
pemilik repo. Semua perubahan lewat Pull Request.

```bash
git checkout main
git pull origin main
git checkout -b fitur/nama-pekerjaan

# ...ubah kode...

npm run lint && npm run typecheck && npm test
git add -A
git commit -m "penjelasan singkat apa yang berubah dan kenapa"
git push -u origin fitur/nama-pekerjaan
```

Lalu buka Pull Request di GitHub. Butuh 1 persetujuan + CI hijau untuk merge.

**Setiap merge ke `main` langsung tayang ke produksi** lewat Vercel. Perlakukan
`main` sebagaimana mestinya.

---

## Menghubungkan data sungguhan (opsional)

Hanya kalau Anda memang perlu menyentuh data asli. Minta kredensialnya lewat
pengelola kata sandi — **jangan lewat chat atau WhatsApp**.

```bash
cp .env.example .env.local
```

Isi variabel yang relevan saja. `.env.example` menjelaskan tiap variabel dan
dari mana nilainya diambil.

| Yang dikerjakan | Yang perlu diisi |
| --- | --- |
| Tampilan, komponen, tes | *(tidak ada — mode demo cukup)* |
| Baca/tulis data sungguhan | `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `GWG_SUPABASE_URL`, `GWG_SESSION_SECRET` |
| Analisis Fraud (void & cancel) | `ESB_USERNAME`, `ESB_PASSWORD` |
| Unggah berkas & foto | `R2_*` |

`GWG_SESSION_SECRET` buat sendiri, jangan minta:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`.env.local` sudah diblokir `.gitignore` — pastikan tetap begitu.

---

## Kalau Anda menggarap integrasi ESB (void & cancel)

**Baca `docs/esb-fraud-integration.md` LEBIH DULU, khususnya bagian Jebakan.**

ESB tidak punya API. Integrasinya bekerja dengan meniru browser: login Yii2 +
CSRF, minta export asinkron, lalu mengurai HTML grid-nya.

Ada delapan kegagalan yang sudah kami temui, dan **semuanya terjadi tanpa satu
pun pesan error** — datanya sekadar salah dan baru ketahuan berminggu-minggu
kemudian. Tiga di antaranya pernah membuat kami kehilangan ±58% data.

Urutan baca yang disarankan:

1. `docs/esb-fraud-integration.md` — alur lengkap + jebakan
2. `src/lib/integrations/esb-client.ts` — login, generate export, antrean serial
3. `src/lib/integrations/esb.ts` — pengurai grid HTML
4. `supabase/migrations/0022_fraud_sync.sql` — skema tabelnya
5. `src/app/api/cron/fraud-sync/` — cron harian

---

## Kalau ada yang tidak jalan

**`git clone` gagal: "Repository not found"**
Undangan belum diterima, atau kunci SSH belum terpasang. Uji dengan
`ssh -T git@github.com`.

**`npm run dev` error modul tidak ditemukan**
Lupa `npm install` setelah `git pull`. `package.json` sering ikut berubah.

```bash
npm install
```

**Halaman balas 404 padahal rutenya ada**
Cache Turbopack basi setelah pull besar.

```bash
rm -rf .next && npm run dev
```

**`git pull` menolak: "local changes would be overwritten"**

```bash
git stash && git pull origin main && git stash pop
```

**Aplikasi jalan tapi semua datanya contoh**
Normal — itu mode demo, terjadi selama `.env.local` belum ada.

**Port 3000 sudah dipakai**

```bash
npm run dev -- -p 3001
```

**`npm audit` melaporkan vulnerability**
Ada di dependensi tidak langsung dan tidak memengaruhi aplikasi.
**Jangan** jalankan `npm audit fix --force`.

---

## Sebelum Pull Request pertama

- [ ] `npm run lint` → 0 error
- [ ] `npm run typecheck` → bersih
- [ ] `npm test` → semua lulus
- [ ] `npm run build` → sukses
- [ ] Komentar kode dan teks antarmuka memakai Bahasa Indonesia
- [ ] Tidak ada kredensial atau rahasia yang ikut ter-commit
- [ ] Pesan commit menjelaskan **kenapa**, bukan hanya **apa**
