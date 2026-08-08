# Operation GWG — Executive Command Center

Internal operations platform for monitoring **50 outlets** across **5 areas** in real time:
hospitality, hygiene, work, events and complaints — a single source of truth for operational
performance, built as a premium dark-mode SaaS command center.

> Runs out of the box in **demo mode** (seeded data + role switching). Add Supabase credentials to
> go live — see [`supabase/README.md`](supabase/README.md).

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions) · **TypeScript**
- **Tailwind CSS v4** design system (glassmorphism, brand tokens, dark-mode-first)
- **shadcn-style** hand-built UI primitives · **Framer Motion** (`motion`) · **Lucide** icons
- **TanStack Table** (data grids) · **Recharts** (analytics)
- **Supabase** — Postgres + Auth + Storage (migrations in `supabase/`)
- **Vitest** unit tests

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000  (demo mode)
```

On the login screen, pick any **demo persona** — each enforces real RBAC + row-level scoping:

| Persona | Role | Sees |
| --- | --- | --- |
| GWG Admin | Super Admin | Everything + user/org management |
| Direktur Utama | Director | All dashboards & reports (read-only) |
| Head of Operations | Head Operation | All outlets + audit logs |
| (coordinator) | Area Coordinator | Their area; can create all operational data |
| (supervisor) | Supervisor | Assigned outlets; can create tasks |
| (pic) | PIC Outlet | Their single outlet (dashboard only) |

## Modules

1. **Executive Dashboard** — 8 live KPIs, complaint trend, outlet & area rankings.
2. **Hospitality Assessment** — cashier / F&B / dining checklists (1–5), auto outlet/staff/area scores.
3. **Work Tracker** — tasks with priority, status, progress, due-date/overdue tracking, filters.
4. **Event Tracker** — milestones (planning→evaluation), budget, status, Gantt timeline.
5. **Hygiene Monitoring** — six-section audit (Excellent/Good/Fair/Poor), findings, auto hygiene score.
6. **Complaint Management** — multi-channel intake, categories, 5M root-cause, corrective action, dashboard.
7. **Analytics** — score trend, complaints-by-area, performance heatmap, outlet leaderboard.
8. **Notification Center** — overdue tasks/complaints/hygiene, event deadlines, score drops.
9. **Admin** — user management, organization, audit logs.

## Onboarding developer baru (serah terima ke tim IT)

> **Developer baru:** langsung ke **[`docs/panduan-tim-it.md`](docs/panduan-tim-it.md)** —
> panduan lengkap dari clone sampai Pull Request pertama, ±15 menit.
> Bagian di bawah ini untuk pemilik sistem yang memberikan aksesnya.

Urutannya sengaja begini: **kode dulu, kredensial belakangan.** Developer baru bisa
menjalankan seluruh aplikasi dalam mode demo tanpa satu pun rahasia, jadi tidak ada
alasan membagikan kredensial produksi di hari pertama.

**1 — Akses repositori.** Repo ini privat. Pemilik menambahkan tiap orang lewat
GitHub → Settings → Collaborators → *Add people*. Beri peran **Write**; *Admin*
hanya untuk yang memang perlu mengubah pengaturan repo. Undangannya per akun
GitHub masing-masing — jangan pakai satu akun bersama, karena riwayat commit jadi
tidak bisa ditelusuri dan pencabutan akses jadi mustahil per orang.

**2 — Jalankan mode demo.** Cukup ini untuk membaca kode, mengerjakan tampilan,
dan menjalankan tes:

```bash
git clone https://github.com/sheetcodeid-ux/operation-gwg.git
cd operation-gwg && npm install && npm run dev
```

**3 — Kredensial, hanya kalau memang perlu data sungguhan.** Salin `.env.example`
ke `.env.local` dan isi yang dibutuhkan saja:

| Yang dikerjakan | Yang perlu diisi |
| --- | --- |
| Tampilan, komponen, tes | *(tidak ada — mode demo cukup)* |
| Baca/tulis data sungguhan | `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `GWG_SUPABASE_URL`, `GWG_SESSION_SECRET` |
| **Analisis Fraud (void & cancel)** | `ESB_USERNAME`, `ESB_PASSWORD` |
| Unggah berkas & foto | `R2_*` |

### Aturan kredensial

- **Jangan pernah mengirim nilai rahasia lewat chat, email, atau WhatsApp.** Pakai
  pengelola kata sandi bersama (1Password/Bitwarden), atau minta orangnya membuat
  akunnya sendiri. Pesan bisa diteruskan, di-backup, dan tidak bisa ditarik kembali.
- **ESB: buatkan akun laporan terpisah per orang**, bukan akun master admin dan
  bukan akun bersama. Aplikasi ini hanya MEMBACA laporan void/cancel; akun master
  admin memberi kemampuan mengubah data POS yang tidak pernah dibutuhkan.
- `SUPABASE_SERVICE_ROLE_KEY` melewati seluruh Row Level Security — setara kata
  sandi root basis data. Untuk pengembangan, lebih baik pakai proyek Supabase
  terpisah daripada membagikan kunci produksi.
- Kredensial produksi tinggal di **Vercel → Settings → Environment Variables**,
  bukan di berkas yang beredar antar orang.
- Kalau sebuah rahasia terlanjur tersebar: ganti di sumbernya (ESB/Supabase/R2)
  lalu perbarui di Vercel. Menghapus pesannya tidak membatalkan rahasianya.

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run start      # serve production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm test           # vitest (RBAC scoping + scoring/ranking math)
```

## Project structure

```
src/
  app/
    (auth)/login            # split-screen login + demo personas
    (app)/                  # protected shell (sidebar + topbar)
      dashboard analytics outlets
      hospitality work-tracker events hygiene complaints
      admin/{users,organization,audit}
  components/{ui,layout,dashboard,charts,hospitality,work,events,hygiene,complaints,auth}
  lib/
    types.ts constants.ts rbac.ts nav.ts auth.ts utils.ts
    data/{seed,store,mutations}.ts   # repository layer (swap to Supabase in Phase 11)
    actions/                          # server actions per module
    supabase/{client,server,env}.ts
  proxy.ts                            # Next 16 route protection (was middleware)
supabase/migrations/                  # schema + RLS + storage
```

## Architecture notes

- **Data layer is swappable.** Pages/actions only call `lib/data/store.ts` (reads) and
  `lib/data/mutations.ts` (writes). Demo mode uses a deterministic in-memory seed; Phase 11 swaps
  the bodies to Supabase without touching the UI. RLS in `supabase/migrations/0002_rls.sql` mirrors
  the `lib/rbac.ts` scoping at the database layer.
- **RBAC is enforced twice** — in the UI/server actions (`can`, `canAccessOutlet`) and (when live)
  in Postgres RLS.

## Deployment

Production-ready for **Vercel**:

1. Import the repo, framework auto-detected (Next.js).
2. Add env vars from `.env.example` (optional for demo; required for live Supabase).
3. Deploy. `npm run build` is the build command.

For live data, run the Supabase migrations (`supabase db push`) and set the three env vars.
```
