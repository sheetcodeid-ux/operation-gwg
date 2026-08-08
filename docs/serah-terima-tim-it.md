# Panduan Serah Terima ke Tim IT

Runbook langkah-demi-langkah: apa yang diklik, apa yang diketik di terminal, dan
apa yang dikirim. Mencakup GitHub, ESB (data void & cancel), Vercel, Supabase,
dan Cloudflare R2.

**Identitas sistem** (dipakai di banyak perintah di bawah):

| | |
| --- | --- |
| Repositori | `sheetcodeid-ux/operation-gwg` (privat) |
| Vercel team | `gwg-operation` |
| Supabase project | `operation-gwg` · ref `igbbqtfyqlibzuaygiwl` · region Seoul |
| ESB | `https://erp.esb.co.id` |

---

## Bagian 0 — Tentukan ini dulu

Jawaban seluruh dokumen bercabang di satu pertanyaan. **Tanyakan ke tim IT
sebelum memberi apa pun:**

> "Kalian mau membangun sistem sendiri yang menarik data dari ESB, atau ikut
> mengembangkan aplikasi Operation GWG yang sudah ada?"

| | **A. Sistem terpisah** | **B. Ikut kembangkan app ini** |
| --- | --- | --- |
| GitHub | ✅ Perlu (sebagai rujukan) | ✅ Perlu |
| Kredensial ESB | ✅ Perlu | ⬜ Tidak — yang ada sudah jalan |
| Vercel | ⬜ **Tidak perlu** | ✅ Perlu |
| Supabase | ⬜ **Tidak perlu** | ✅ Perlu (proyek dev terpisah) |
| Cloudflare R2 | ⬜ **Tidak perlu** | Hanya bila menggarap fitur unggah |

**Kalau jawabannya A, Vercel dan Supabase tidak perlu diberikan sama sekali.**
Mereka punya sendiri; memberi akses ke milik Anda hanya menambah risiko tanpa
memberi mereka manfaat.

Tiap bagian ditandai **[A]**, **[B]**, atau **[A+B]**.

---

## Bagian 1 — GitHub **[A+B]**

### 1.1 Kunci branch `main` — SEBELUM mengundang siapa pun

Setiap push ke `main` **langsung tayang ke produksi** lewat Vercel. Tanpa
penguncian, satu `git push --force` salah target bisa menimpa seluruh riwayat
kerja dan langsung sampai ke pengguna. Ini terjadi pada developer paling senior
sekalipun.

**Klik:**
1. Buka repo → tab **Settings**
2. Menu kiri → **Rules** → **Rulesets** → **New ruleset** → *New branch ruleset*
3. **Ruleset Name**: `lindungi-main`
4. **Enforcement status**: **Active**
5. **Target branches** → *Add target* → *Include default branch*
6. Centang di bagian **Rules**:
   - ✅ **Restrict deletions**
   - ✅ **Block force pushes**
   - ✅ **Require a pull request before merging**
     → *Required approvals*: **1**
   - ✅ **Require status checks to pass**
     → *Add checks* → cari **`verify`** (nama job di `.github/workflows/ci.yml`)
7. **Create**

Setelah ini, Anda pun tidak bisa push langsung ke `main` — semua lewat Pull
Request. Itu memang tujuannya.

> **Kalau Anda ingin tetap bisa push langsung**, tambahkan diri Anda di
> **Bypass list** → *Add bypass* → *Repository admin*. Tapi lebih aman tidak.

### 1.2 Undang tim IT

**Klik:** Settings → **Collaborators and teams** → **Add people** → ketik
username GitHub atau emailnya → pilih peran:

| Peran | Bisa apa | Untuk siapa |
| --- | --- | --- |
| **Read** | clone & baca saja | kalau cuma perlu membaca kode rujukan |
| **Write** ← *pilih ini* | clone, push branch, buka PR | developer |
| **Admin** | + ubah setelan repo, hapus repo | jangan, kecuali sangat perlu |

**Satu undangan per orang.** Jangan akun bersama — dengan akun bersama Anda
tidak akan pernah tahu siapa mengubah apa, dan mencabut akses satu orang jadi
mustahil.

Undangan berlaku 7 hari. Cek statusnya di halaman yang sama.

### 1.2b Cara yang sama, lewat terminal

Kalau lebih suka bash daripada klik. Sekali pasang:

```bash
brew install gh          # macOS
gh auth login            # GitHub.com → HTTPS/SSH → Login with a web browser
```

Simpan nama repo sekali supaya perintah di bawah pendek:

```bash
REPO=sheetcodeid-ux/operation-gwg
```

**Undang satu orang** (`push` = peran Write):

```bash
gh api --method PUT "/repos/$REPO/collaborators/USERNAME_GITHUB" -f permission=push
```

**Undang beberapa orang sekaligus:**

```bash
for u in usernameA usernameB usernameC; do
  gh api --method PUT "/repos/$REPO/collaborators/$u" -f permission=push \
    && echo "✓ diundang: $u"
done
```

Nilai `permission` yang sah: `pull` (Read) · `triage` · `push` (**Write**) ·
`maintain` · `admin`.

**Cek undangan yang belum diterima:**

```bash
gh api "/repos/$REPO/invitations" --jq '.[] | "\(.invitee.login) — \(.permissions)"'
```

**Lihat siapa saja yang sudah punya akses:**

```bash
gh api "/repos/$REPO/collaborators" --jq '.[] | "\(.login) — \(.role_name)"'
```

**Cabut akses seseorang:**

```bash
gh api --method DELETE "/repos/$REPO/collaborators/USERNAME_GITHUB"
```

**Batalkan undangan yang belum diterima:**

```bash
gh api "/repos/$REPO/invitations" --jq '.[] | "\(.id) \(.invitee.login)"'   # ambil id-nya
gh api --method DELETE "/repos/$REPO/invitations/ID_UNDANGAN"
```

#### Kunci `main` lewat terminal juga

Setara dengan langkah klik di 1.1. Jalankan sekali:

```bash
gh api --method POST "/repos/$REPO/rulesets" --input - <<'JSON'
{
  "name": "lindungi-main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [{ "context": "verify" }]
      }
    }
  ]
}
JSON
```

`non_fast_forward` = blokir force push · `deletion` = branch tidak bisa dihapus ·
`verify` = nama job di `.github/workflows/ci.yml`.

Periksa hasilnya:

```bash
gh api "/repos/$REPO/rulesets" --jq '.[] | "\(.id) \(.name) \(.enforcement)"'
gh api "/repos/$REPO/rulesets/ID" --jq '.rules[].type'
```

Kalau ternyata terlalu ketat, hapus:

```bash
gh api --method DELETE "/repos/$REPO/rulesets/ID"
```

### 1.3 Yang dikerjakan tim IT di terminal

Kirimkan langkah ini ke mereka.

**a. Terima undangan** — cek email atau
`https://github.com/sheetcodeid-ux/operation-gwg/invitations`

**b. Siapkan kunci SSH** (sekali seumur hidup per laptop):

```bash
ssh-keygen -t ed25519 -C "email-kantor@gwg.co"     # Enter tiga kali
cat ~/.ssh/id_ed25519.pub                          # salin seluruh isinya
```
Tempel ke **GitHub → Settings (akun, bukan repo) → SSH and GPG keys → New SSH key**.

Uji:
```bash
ssh -T git@github.com
# "Hi <username>! You've successfully authenticated..."
```

**c. Clone & jalankan:**

```bash
git clone git@github.com:sheetcodeid-ux/operation-gwg.git
cd operation-gwg
npm install
npm run dev            # http://localhost:3000
```

Aplikasi langsung jalan penuh dalam **mode demo** — data contoh, pilih persona
di layar login. **Tanpa kredensial apa pun.** Cukup untuk membaca kode,
menggarap tampilan, dan menjalankan tes.

**d. Alur kerja harian** (karena `main` terkunci):

```bash
git checkout -b fitur/nama-pekerjaan
# ...ubah kode...
npm run lint && npx tsc --noEmit && npx vitest run
git add -A && git commit -m "penjelasan singkat"
git push -u origin fitur/nama-pekerjaan
```
Lalu buka Pull Request di GitHub.

### 1.4 Yang mereka dapat otomatis dari akses repo

| Berkas | Isi |
| --- | --- |
| `docs/esb-fraud-integration.md` | **Cara ambil void & cancel dari ESB** — alur lengkap + 8 jebakan |
| `src/lib/integrations/esb-client.ts` | Implementasi login, generate export, antrean serial |
| `src/lib/integrations/esb.ts` | Pengurai grid HTML ESB |
| `supabase/migrations/0022_fraud_sync.sql` | Skema `fraud_orders` + `fraud_sync` |
| `src/app/api/cron/fraud-sync/` | Cron harian |
| `.env.example` | Daftar 15 variabel yang dibaca aplikasi |

**Dokumen integrasi fraud terkirim otomatis lewat akses GitHub** — tidak perlu
mengirim berkas terpisah.

### 1.5 Tidak ada yang perlu dibersihkan

Repositori dan seluruh riwayat commit-nya sudah dipindai: **tidak ada satu pun
kredensial yang pernah ter-commit**, dan pola `.env*` diblokir `.gitignore`.
Memberi akses repo tidak memberi mereka kunci apa pun.

---

## Bagian 2 — ESB: data Void & Cancel **[A]**

### 2.1 Yang dikirim

```
ESB_BASE_URL   = https://erp.esb.co.id
ESB_USERNAME   = (akun laporan untuk sistem MEREKA)
ESB_PASSWORD   = (kata sandinya)
```

Letak nilai yang sekarang: **Vercel → project `operation-gwg` → Settings →
Environment Variables** → klik ikon mata pada baris `ESB_USERNAME` /
`ESB_PASSWORD`.

> Kalau variabelnya dulu dibuat dengan centang **Sensitive**, Vercel membuatnya
> write-only — nilainya **tidak bisa dibaca kembali oleh siapa pun**, termasuk
> Anda. Kalau itu terjadi, reset kata sandinya di ESB.

### 2.2 Kalau memakai akun yang sama, atur jadwalnya

Idealnya tiap sistem punya akun ESB sendiri. Kalau tetap memakai satu akun
bersama, **jadwalnya wajib dipisah** — ini soal integritas data, bukan akses:

> **Antrean export ESB terikat pada AKUN, bukan sesi login.** Dua sistem yang
> menarik bersamaan mengantre di tempat yang sama, lalu masing-masing mengurai
> **berkas milik yang lain** — tanpa error, tanpa log, hanya baris tanggal atau
> outlet salah yang diam-diam masuk basis data.

Cron Anda: **21:30 UTC = 04:30 WIB** setiap hari (`vercel.json`).

Minta mereka menjadwalkan di jam yang jelas berbeda, misalnya **09:00 UTC
(16:00 WIB)**. Jarak setengah hari lebih dari cukup — sinkronisasi harian
selesai dalam hitungan menit.

### 2.3 Hak akses akunnya

Cukup bisa membuka menu **Report**. **Jangan master admin** — seluruh alur ini
hanya MEMBACA laporan, tidak pernah menulis ke POS.

### 2.4 Yang wajib mereka baca lebih dulu

Waktu mereka akan habis bukan di login atau parsing, tapi di empat hal ini —
semuanya gagal **tanpa satu pun pesan error**:

| # | Jebakan | Akibat |
| --- | --- | --- |
| 2 | ESB melayani satu export per sesi | ±40% baris milik hari lain |
| 3 | Ukuran halaman beda: Cancel/Void 50, Delete 20 | ±58% item Delete hilang |
| 4 | Sel hilang karena `rowspan` | ±58% item hilang |
| 5 | Nilai `typeVoid` asing | SELURUH filter dibuang, tanggal termasuk |

Selengkapnya (8 jebakan) di `docs/esb-fraud-integration.md`.

---

## Bagian 3 — Vercel **[B saja]**

Untuk skenario A, lewati bagian ini seluruhnya.

### 3.1 Setting: undang ke team

**Klik:** vercel.com → pilih team **`gwg-operation`** (pojok kiri atas) →
**Settings** → **Members** → **Invite** → masukkan email → peran:

| Peran | Bisa apa |
| --- | --- |
| **Member** ← *pilih ini* | lihat deployment, log, preview |
| **Developer** | + kelola environment variable |
| **Owner** | + tagihan, hapus project |

> ⚠️ **Menambah anggota team butuh paket Pro.** Paket Hobby hanya untuk satu
> orang. Kalau Anda masih di Hobby, Vercel akan menawarkan upgrade berbayar
> saat mengundang. Kalau tidak mau upgrade: tim IT tidak perlu akses Vercel —
> mereka cukup jalan di lokal, dan Anda yang menekan deploy.

### 3.2 Jangan kirim nilai environment variable

Beri akses ke project-nya, biar Vercel yang mengurus. Untuk pengembangan mereka
pakai `.env.local` sendiri.

### 3.3 Terminal: Vercel CLI

```bash
npm i -g vercel
vercel login                     # buka browser, login
cd operation-gwg
vercel link                      # pilih team gwg-operation → project operation-gwg
```

Perintah harian:

```bash
vercel env pull .env.local       # tarik env var ke lokal (butuh peran Developer)
vercel dev                       # jalankan seperti di Vercel (bukan `npm run dev`)
vercel                           # deploy preview (URL sementara)
vercel --prod                    # deploy produksi ⚠️ langsung ke pengguna
vercel logs <url-deployment>     # lihat log runtime
```

> `vercel env pull` menulis **seluruh rahasia produksi** sebagai teks polos ke
> disk. Berkasnya sudah diblokir `.gitignore`, tapi hapus setelah selesai.

### 3.4 Yang perlu diketahui tentang project ini

| | |
| --- | --- |
| Region | `sin1` (Singapura) |
| Cron | `/api/cron/fraud-sync` tiap hari 21:30 UTC (04:30 WIB) |
| Auto-deploy | Setiap push/merge ke `main` langsung ke produksi |
| Batas fungsi | 60 detik — alasan sinkronisasi ESB dipecah per hari |

---

## Bagian 4 — Supabase

### 4.1 Skenario A: mereka pakai database sendiri

**Tidak perlu memberi akses apa pun.** Skema tabelnya sudah ada di repo dan
bisa dijalankan di Postgres mana pun.

Yang mereka lakukan di terminal:

```bash
npm i -g supabase
supabase login
supabase init                                  # kalau proyek baru
supabase link --project-ref <REF-MILIK-MEREKA>
supabase db push                               # jalankan semua migrasi
```

Atau kalau cuma butuh tabel fraud, jalankan satu berkas ini di SQL Editor
Supabase mereka: `supabase/migrations/0022_fraud_sync.sql`.

> **Kalau ternyata mereka hanya butuh DATANYA, bukan integrasinya:** data ini
> sudah lengkap di database Anda — **154.892 baris, 32 MB, 1 Januari 2026
> sampai sekarang, 57 outlet**. Jauh lebih cepat memberi akses baca ke tabel itu
> daripada menyuruh mereka menarik ulang dari ESB. Bilang saja kalau mau
> disiapkan.

### 4.2 Skenario B: buatkan proyek DEV terpisah

**Jangan bagikan proyek produksi.** `SUPABASE_SERVICE_ROLE_KEY` melewati
seluruh Row Level Security — setara kata sandi root database. Siapa pun yang
memegangnya bisa membaca dan menulis semua tabel: data karyawan, gaji,
penilaian, seluruhnya. Satu `delete` salah ketik saat development langsung
mengenai data produksi.

**Klik + terminal:**

1. supabase.com → **New project** → nama `operation-gwg-dev`, region **Southeast
   Asia (Singapore)**, simpan kata sandi database-nya
2. Salin **Project ref** dari Settings → General
3. Bangun skemanya:
   ```bash
   cd operation-gwg
   supabase login
   supabase link --project-ref <REF-DEV-BARU>
   supabase db push
   supabase migration list        # pastikan semua 39 migrasi tercatat
   ```
4. Ambil kuncinya: **Settings → API Keys** → salin *Project URL*, *anon key*,
   *service_role key*
5. Berikan kunci **dev** itu ke tim IT untuk `.env.local` mereka

### 4.3 Kalau memang harus akses ke produksi

Misalnya untuk menelusuri bug data. **Klik:** supabase.com → **Organization** →
**Team** → **Invite member** → peran:

| Peran | Bisa apa |
| --- | --- |
| **Read-only** ← *pilih ini* | lihat tabel & data, tidak bisa mengubah |
| **Developer** | + ubah data & skema |
| **Administrator** | + kelola anggota |
| **Owner** | + tagihan, hapus proyek |

**Cabut kembali setelah selesai** — Organization → Team → ⋯ → Remove.

### 4.4 Perintah Supabase CLI yang berguna

```bash
supabase projects list                    # daftar proyek Anda
supabase migration list                   # migrasi mana yang sudah/belum jalan
supabase db push                          # jalankan migrasi yang belum
supabase db diff -f nama_perubahan        # buat migrasi baru dari perubahan skema
supabase gen types typescript --linked    # tipe TypeScript dari skema
```

> **Jangan pernah** `supabase db reset` pada proyek produksi — itu MENGHAPUS
> seluruh data lalu membangun ulang dari migrasi.

---

## Bagian 5 — Cloudflare R2 **[B, dan hanya bila perlu]**

Penyimpanan lampiran: berkas pengajuan, foto hygiene, bukti tindak lanjut,
lampiran obrolan.

Hanya perlu kalau mereka menggarap fitur unggah. Kalau iya: **buatkan bucket +
API token terpisah untuk development** (Cloudflare → R2 → *Manage API Tokens*),
jangan bagikan yang produksi — supaya berkas uji coba tidak bercampur dengan
dokumen asli.

---

## Bagian 6 — Aturan penanganan kredensial

1. **Jangan pernah mengirim nilai rahasia lewat chat, email, atau WhatsApp.**
   Pesan bisa diteruskan, ter-backup ke cloud, dan tidak bisa ditarik kembali.
   Pakai pengelola kata sandi bersama (1Password / Bitwarden).
2. **Lebih baik mereka membuat akunnya sendiri** daripada Anda membagikan milik
   Anda. Berlaku untuk GitHub, Supabase, Vercel, R2 — semuanya.
3. **Kredensial produksi tinggal di Vercel → Environment Variables**, bukan di
   berkas yang beredar antar orang.
4. **Kalau ada rahasia yang terlanjur tersebar:** ganti di sumbernya
   (ESB / Supabase / Cloudflare), lalu perbarui di Vercel. Menghapus pesannya
   tidak membatalkan rahasianya.

---

## Bagian 7 — Checklist

**Sebelum mengundang siapa pun**
- [ ] Kunci branch `main` (Bagian 1.1)
- [ ] Tanyakan: sistem terpisah, atau ikut kembangkan app ini? (Bagian 0)
- [ ] *(bila menarik dari ESB)* siapkan akun ESB + sepakati jadwal tarikan

**Mengundang**
- [ ] GitHub → Collaborators → Add people, peran **Write**, satu per orang
- [ ] *(skenario B)* Vercel → Members → Invite, peran **Member**
- [ ] *(skenario B)* buat proyek Supabase dev + `supabase db push`

**Mengirim kredensial**
- [ ] Lewat pengelola kata sandi, **bukan chat**
- [ ] ESB: hak akses Report saja, bukan master admin
- [ ] Beri tahu pihak ESB akan ada sistem kedua yang menarik laporan

**Menyusul**
- [ ] Pastikan mereka membaca bagian **Jebakan** di
      `docs/esb-fraud-integration.md` **sebelum** mulai koding
- [ ] Cek Pull Request pertama mereka masuk dengan benar

---

## Bagian 8 — Contoh pesan untuk dikirim

> Halo, berikut akses untuk Operation GWG.
>
> **Repo:** https://github.com/sheetcodeid-ux/operation-gwg
> Undangan collaborator sudah dikirim ke akun GitHub kalian — cek notifikasi GitHub.
>
> **Mulai:**
> ```
> git clone git@github.com:sheetcodeid-ux/operation-gwg.git
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
> **Akun ESB dikirim terpisah lewat password manager.**
> Sinkronisasi kami jalan tiap hari 04:30 WIB — tolong jadwalkan tarikan kalian
> di jam lain (misal 16:00 WIB). Antrean export ESB terikat ke akun, jadi kalau
> bertabrakan kedua sistem bisa saling mengambil berkas yang salah, tanpa error
> apa pun.
>
> **Catatan:** `main` terkunci, perubahan lewat Pull Request.

---

## Bagian 9 — Masalah yang mungkin mereka temui

**`/login` balas 404, sebagian halaman lain normal**
Turbopack salah menebak akar proyek karena ada `package-lock.json` nyasar di
folder induk. Sudah dicegah lewat `turbopack.root` di `next.config.ts`. Kalau
masih terjadi: `rm -rf .next && npm run dev`.

**`npm run dev` error modul tidak ditemukan**
Lupa `npm install` setelah `git pull`. `package.json` sering ikut berubah.

**`git pull` menolak: "local changes would be overwritten"**
```bash
git stash && git pull origin main && git stash pop
```

**`npm audit` melaporkan vulnerability**
Ada di dependensi tidak langsung dan tidak memengaruhi aplikasi.
**Jangan jalankan `npm audit fix --force`** — perintah itu menaikkan versi mayor
dan merusak build.

**Aplikasi jalan tapi datanya contoh semua**
Normal — itu mode demo, terjadi saat `.env.local` belum ada. Memang begitu
sampai kredensial diberikan.

---

## Lampiran — 15 environment variable

Daftar lengkap beserta keterangan ada di `.env.example`.

| Variabel | Untuk apa | A | B |
| --- | --- | --- | --- |
| `ESB_BASE_URL` | Alamat ESB | ✅ | ⬜ |
| `ESB_USERNAME` | Akun laporan ESB | ✅ | ⬜ |
| `ESB_PASSWORD` | Kata sandinya | ✅ | ⬜ |
| `NEXT_PUBLIC_SUPABASE_URL` | Alamat proyek Supabase | ⬜ | ✅ dev |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Kunci publik (aman di browser) | ⬜ | ✅ dev |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ **Melewati seluruh RLS** | ⬜ | ✅ dev |
| `GWG_SUPABASE_URL` | Alamat untuk lapisan data | ⬜ | ✅ dev |
| `GWG_SUPABASE_KEY` | Cadangan service key | ⬜ | ⬜ |
| `GWG_SESSION_SECRET` | Penanda tangan cookie sesi | ⬜ | ✅ buat sendiri |
| `GWG_ADMIN_RPC_SECRET` | Rahasia RPC pembuatan akun | ⬜ | ✅ dev |
| `R2_ENDPOINT` | Alamat penyimpanan | ⬜ | bila perlu |
| `R2_BUCKET` | Nama bucket | ⬜ | bila perlu |
| `R2_ACCESS_KEY_ID` | Kunci akses R2 | ⬜ | bila perlu |
| `R2_SECRET_ACCESS_KEY` | Rahasia R2 | ⬜ | bila perlu |
| `CRON_SECRET` | Pelindung endpoint cron | ⬜ | diisi Vercel otomatis |

`GWG_SESSION_SECRET` tidak perlu dibagikan — mereka buat sendiri:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```
