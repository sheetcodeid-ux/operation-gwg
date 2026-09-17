# Operational V.1

Sistem operational intelligence GWG: dari angka penjualan sampai pembelajaran yang
bisa diulang.

```
DATA → DETECT → DIAGNOSE → PRIORITIZE → ASSIGN → EXECUTE
     → VERIFY → MEASURE IMPACT → LEARN → SCALE
```

**Status: BELUM FINAL — blueprint terkunci, siap PHASE 1.**

---

## Berkas di folder ini

| Berkas | Isi | Kapan dibaca |
|---|---|---|
| [`decisions.md`](./decisions.md) | Keputusan pemilik yang sudah dikunci | **Sebelum menulis satu baris kode** |
| [`blueprint.md`](./blueprint.md) | Rancangan lengkap: domain, tabel, alur, UI | Saat merancang phase |
| `README.md` | Halaman ini — peta dan aturan kerja | Saat mulai |

Ketiganya adalah rujukan tunggal. **Jangan membuat dokumen keempat yang isinya
blueprint dengan bentuk berbeda** — dua blueprint berarti dua kebenaran, dan yang
kedua selalu yang dibaca orang yang salah.

---

## Aturan tiap phase

Sebelum mulai:

1. baca `decisions.md` — keputusan yang sudah dikunci tidak dibuka lagi
2. baca bagian blueprint yang relevan
3. pakai data existing, master existing, API existing
4. jangan membuat source of truth kedua
5. `/operational/daily` adalah acuan UI/UX

Sesudah selesai:

6. jalankan `npm run lint` (wajib **0 error**), `npx tsc --noEmit`, `npx vitest run`, `npm run build`
   — dan `npm run test:db` bila phase-nya menyentuh skema (lihat di bawah)
7. uji izin dan cakupan outlet untuk 5 peran
8. laporkan berkas yang diubah, migration yang dibuat, dan hasil test
9. kalau belum selesai, **jangan bilang selesai**

---

## Tiga aturan yang paling mudah dilanggar

**1. `seasonal_daily` tidak boleh diagregasi mentah.**
Tabel ini memuat baris korporat (`branch = ''`, 348 hari, Rp 118 miliar) dan
cabang yatim (`57-fnb_nord`, tanpa outlet). `SUM(net)` mentah menghitung ganda —
terbukti dua kali lipat pada Agustus 2026. Selalu saring lewat
`outlets.esb_branch_id`. Rinciannya di blueprint §3.2.

**2. Tabel V.1 tidak masuk `SEED`/`hydrate.ts`.**
Query langsung per permintaan. `src/lib/data/hydrate.ts:50` mencatat TTL 3 detik
pernah mematikan produksi; tabel bervolume di array memori mengulang risiko itu.

**3. Eksekusi selesai bukan berarti berhasil.**

```
SUBMITTED → VERIFICATION → IMPACT_WAIT → SUCCESS / PARTIAL / FAILED / INCONCLUSIVE
```

`SUBMITTED → SUCCESS` dilarang, ditegakkan di server. Ini premis seluruh V.1.

---

## Urutan phase

| Phase | Isi | Status |
|---|---|---|
| 0 | Keputusan arsitektur | **selesai** |
| 1 | Fondasi: scope, waktu, aturan baca sales, gerbang kelengkapan | **selesai** |
| 2A | KPI Sales + Target: tabel, layanan hitung, backfill Agustus 2026 | **selesai** — tabel terpasang di produksi, Agustus 2026 terisi dan terverifikasi |
| 2A+ | Jalur tulis berulang (cron/rute) supaya bulan berikutnya terisi sendiri | **selesai** — pg_cron → `/api/cron/kpi-bulanan` → orkestrator → `gwg_tulis_kpi_bulanan`, berversi dan idempoten (AD-09, AD-10) |
| 2B | Unggah data finansial: rincian utilitas, PBJT, platform fee, jejak unggahan | **siap ditinjau** — schema + unggah selesai, KPI-nya belum |
| 3 | Rule Engine | |
| 4 | Signal | |
| 5 | **Command Center** ← nilai terlihat pertama kali | |
| 6 | Diagnosis + Evidence + Recommendation | |
| 7 | Business Case + Approval | |
| 8 | Action + read-model gabungan | |
| 9 | Verification | |
| 10 | Impact | |
| 11 | Learning + Playbook | |
| 12 | Audit Log + Data Quality | |
| 13 | AI | |
| 14 | Reports + rule editor | |
| 15 | QA penuh + production readiness | |

PHASE 1–4 tidak menghasilkan layar baru. Itu disengaja — fondasinya dulu. Yang
menunggu perlu tahu supaya tidak terbaca sebagai tidak ada kemajuan.

---

## Yang tidak boleh disentuh

| Area | Alasan |
|---|---|
| `src/lib/integrations/esb-client.ts` | scraping bersesi tunggal, rapuh; memutusnya memutus seluruh data penjualan |
| `src/lib/data/seasonal.ts`, `fraud.ts`, `esb-*.ts` | ingestion; 183.825 + 15.241 baris bergantung padanya |
| `seasonal_daily`, `fraud_orders`, `sales_*`, `esb_net_*` | data historis tak terulang |
| `src/lib/auth.ts` | penandatanganan sesi |
| `src/lib/data/db.ts`, `hydrate.ts`, `seed.ts`, `store.ts` | menopang seluruh jalur baca; dijaga `hydrate-v1.test.ts` supaya tidak pernah menjangkau modul V.1 |
| `src/lib/data/kpi.ts` | KPI Coordinator Area yang sedang melayani produksi; tiga uji membaca kode sumbernya baris per baris |
| `users`, `credentials`, `outlets` | master; `outlets.esb_branch_id` jangkar seluruh sales |
| `src/app/(app)/operational/daily/page.tsx`, bawaan `tabel-harian.tsx` | dijaga `daily-utuh.test.ts`, dipakai tiap hari |
| `tasks` | 3.552 baris, Work Tracker dipakai harian |
| `DIVISION_MENUS` existing di `nav.ts` | mengubahnya mengubah sidebar orang tanpa diminta |

---

## Menguji perubahan basis data

Migrasi V.1 **tidak pernah dicoba di produksi**. `npm run test:db` membuat basis
data sendiri di PostgreSQL lokal, memasang perancah bertipe kolom sama persis
seperti produksi, menjalankan migrasinya, lalu MENCOBA MEMASUKKAN YANG SALAH dan
memastikan basis datanya menolak — foreign key, CHECK, unique, dan RLS.
Sesudahnya basis datanya dihancurkan.

```
npm run test:db                       # batasan saja, dengan isi contoh
npm run test:db -- --data <folder>    # plus rekonsiliasi satu periode nyata
npm run test:db -- --simpan           # basis datanya dibiarkan untuk diperiksa
```

Berkas data untuk `--data` berisi tiga berkas teks: `<periode>.outlets.txt`,
`<periode>.seasonal.txt`, dan `esb-net-bulanan.txt`. **Tidak disimpan di repo** —
isinya penjualan harian tiap outlet, dan repo bukan tempatnya.

`npm run test:db` **tidak ikut CI**: CI tidak punya PostgreSQL, dan menambahkan
layanan basis data ke CI demi ini akan memperlambat setiap pull request untuk
sesuatu yang cuma berubah ketika skema berubah. Yang menyentuh migrasi
menjalankannya sendiri dan melampirkan hasilnya.

---

## Kapan boleh disebut FINAL

Hanya kalau **seluruhnya** terpenuhi: 8 area target selesai dengan data nyata ·
workflow end-to-end berhasil · Signal persistent · Diagnosis, Business Case,
Action, Evidence tersedia · Verification terpisah dari eksekusi · Impact dan
Learning tersedia · Playbook tersedia · tidak ada source of truth ganda ·
rekonsiliasi dengan Performance Daily cocok · izin dan cakupan outlet teruji ·
keputusan RLS diterapkan · dark/light · responsif · loading/empty/error state ·
lint 0 error · TypeScript bersih · seluruh test lulus · production build sukses ·
tidak ada blocker CRITICAL/HIGH.

Selama salah satu belum, statusnya **BELUM FINAL**. Halaman yang sudah bisa dibuka
dan UI yang sudah bagus bukan tanda selesai.
