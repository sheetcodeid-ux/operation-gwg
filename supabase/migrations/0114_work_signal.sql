-- Operational V.1 · Z-02 / STEP 1 — lapisan Work.
--
-- ┌─ DUA HAL YANG TIDAK BOLEH TERTUKAR ──────────────────────────────────────┐
-- │                                                                          │
-- │   signals    apa yang terdeteksi, dan apakah masih terjadi               │
-- │   works      apa yang dilakukan orang tentangnya                         │
-- │                                                                          │
-- │ Deteksi ulang boleh mengubah jawaban pertama tiap hari; ia tidak pernah  │
-- │ menyentuh jawaban kedua. Dan sebaliknya: Work yang selesai tidak         │
-- │ memulihkan Signal, Signal yang pulih tidak menutup Work.                 │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ `tasks` TIDAK DISENTUH, DAN ITU KEPUTUSAN ──────────────────────────────┐
-- │                                                                          │
-- │ 3.939 baris `tasks` tetap menjadi Work Tracker umum/ad-hoc. Ia bukan     │
-- │ Work Z-02: tidak di-rename, tidak dimigrasikan, tidak diberi `signal_id`.│
-- │ Work Z-02 selalu lahir dari Signal (D14); `tasks` tidak pernah punya     │
-- │ Signal. Kalau suatu hari keduanya perlu tampil dalam satu daftar, itu    │
-- │ urusan read model — bukan alasan menyatukan entitasnya.                  │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ YANG SENGAJA BELUM ADA DI BERKAS INI ───────────────────────────────────┐
-- │                                                                          │
-- │   trigger invariant   I-03 · I-17 · I-18 · append-only riwayat           │
-- │                       → Z-02 STEP 2                                      │
-- │   fungsi penulis      gwg_buat_work dan saudara-saudaranya               │
-- │                       → Z-02 STEP 3                                      │
-- │                                                                          │
-- │ Berkas ini HANYA bentuk: tabel, kunci, batasan, index, dan RLS. Ia tidak │
-- │ menghitung tenggat, tidak menilai apa pun, dan tidak menyisipkan satu    │
-- │ baris pun. Menaruh trigger di sini supaya "terlihat lengkap" akan        │
-- │ membuat gerbang berikutnya kehilangan bahan ujinya sendiri.              │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Lihat AD-19 · docs/operational-v1/decisions.md.

/* ─────────────────────────────── works ─────────────────────────────── */

create table if not exists works (
  id                      bigint generated always as identity primary key,

  judul                   text not null,
  deskripsi               text not null default '',

  -- ── KEPEMILIKAN ── satu orang, dan satu saja (D1).
  --
  -- Owner adalah yang MENANGGUNG, bukan yang mengerjakan. Pemisahannya dijaga
  -- trigger di STEP 2, bukan di sini: `works` tidak bisa melihat isi
  -- `work_executors` lewat CHECK.
  --
  -- `diakui_oleh` pada `signals` TIDAK ADA hubungannya dengan kolom ini.
  -- Yang mengakui menyatakan "saya sudah melihat"; yang di sini menanggung
  -- penyelesaiannya. Dua peristiwa berbeda, dua tabel berbeda (D13).
  owner_id                text not null references users (id) on delete restrict,

  -- ── DEPARTEMEN ── satu, dan sengaja TANPA kunci asing.
  --
  -- Registry yang berwenang adalah `user_departments` (O-01), tetapi kolom ini
  -- tetap teks pada Z-02. Alasannya: empat kosakata departemen hidup
  -- berdampingan di basis data ini dan isinya belum sama. Memasang FK sekarang
  -- berarti memilih salah satunya diam-diam. Kalau kelak sumbernya dikunci,
  -- constraint-nya tinggal ditambahkan — bentuk tabel ini tidak berubah.
  primary_department      text not null,

  -- ── KEADAAN KERJA ── empat, dan hanya empat (O-05).
  --
  -- `overdue` BUKAN nilai di sini. Ia turunan: tenggat sudah lewat DAN
  -- pekerjaannya belum selesai maupun dibatalkan. Menjadikannya status berarti
  -- ada pekerjaan yang berubah sendiri tengah malam tanpa seorang pun
  -- memutuskannya.
  status                  text not null,

  -- ── TENGGAT ── kebijakan, titik tolak, dan hasilnya, ketiganya dibekukan.
  --
  -- ┌─ KENAPA TUJUH KOLOM UNTUK SATU TANGGAL ────────────────────────────┐
  -- │                                                                    │
  -- │ Kalau yang disimpan cuma tanggalnya, perubahan kebijakan bulan     │
  -- │ depan akan menggeser tenggat seluruh Work lama — dan "terlambat"   │
  -- │ berubah jadi "tepat waktu" tanpa seorang pun melakukan apa pun.    │
  -- │                                                                    │
  -- │ Dengan versi kebijakan dan nilai titik tolak ikut dibekukan, dua   │
  -- │ hal tetap bisa dibedakan selamanya: tenggat hasil kebijakan saat   │
  -- │ itu, dan tenggat yang kemudian digeser orang (I-11).               │
  -- └────────────────────────────────────────────────────────────────────┘
  --
  -- Berkas ini TIDAK menghitung apa pun. Perhitungannya milik STEP 3.
  tenggat_kategori        text not null,
  tenggat_anchor          text not null,
  tenggat_anchor_pada     timestamptz not null,
  tenggat_zona            text not null,
  tenggat_kebijakan_versi text not null,
  tenggat                 timestamptz not null,
  tenggat_dihitung_pada   timestamptz not null,

  -- ── JEJAK PEMBUATAN ── `tasks` tidak punya ini, dan 3.939 barisnya kini
  -- tidak bisa menjawab siapa yang menugaskannya. Kesalahan itu tidak diulang.
  dibuat_oleh             text not null references users (id) on delete restrict,
  dibuat_pada             timestamptz not null default now(),
  diperbarui_pada         timestamptz not null default now(),

  constraint works_judul_terisi
    check (trim(judul) <> ''),

  constraint works_departemen_terisi
    check (trim(primary_department) <> ''),

  constraint works_status_sah
    check (status in ('open', 'in_progress', 'completed', 'cancelled')),

  constraint works_tenggat_kategori_sah
    check (tenggat_kategori in ('urgent', 'high', 'normal', 'low')),

  -- Satu nilai hari ini, dan enumnya tetap dieja: titik tolak lain bisa
  -- ditambahkan kelak tanpa mengubah arti baris yang sudah ada (O-02).
  constraint works_tenggat_anchor_sah
    check (tenggat_anchor in ('work_dibuat')),

  constraint works_tenggat_zona_terisi
    check (trim(tenggat_zona) <> ''),

  constraint works_tenggat_versi_terisi
    check (trim(tenggat_kebijakan_versi) <> '')
);

create index if not exists works_kerja_idx
  on works (status, dibuat_pada);

create index if not exists works_departemen_idx
  on works (primary_department, status);

-- Dua index parsial di bawah menyempit ke pekerjaan yang MASIH berjalan —
-- itulah satu-satunya himpunan yang ditanyakan daftar kerja dan penagihan
-- tenggat. Yang sudah selesai dan dibatalkan tidak perlu ikut dipindai.
create index if not exists works_pemilik_aktif_idx
  on works (owner_id)
  where status not in ('completed', 'cancelled');

create index if not exists works_tenggat_aktif_idx
  on works (tenggat)
  where status not in ('completed', 'cancelled');

/* ────────────────────────────── signal_work ────────────────────────────── */

-- ┌─ N:N, DAN ITU BUKAN KEMEWAHAN ───────────────────────────────────────────┐
-- │                                                                          │
-- │ 94 dari 106 pasangan outlet × periode di produksi membawa lebih dari     │
-- │ satu Signal terbuka; satu kunjungan ke satu outlet menjawab beberapa     │
-- │ sekaligus. Sebaliknya satu Signal biaya tenaga kerja bisa melahirkan     │
-- │ pekerjaan Operational dan Human Capital yang terpisah.                   │
-- │                                                                          │
-- │ Karena itu kaitannya tabel sendiri, bukan kolom `signal_id` di `works`   │
-- │ (D3). Kolom tunggal akan memaksa memilih satu Signal favorit, dan tidak  │
-- │ ada dasar untuk memilihnya.                                              │
-- └──────────────────────────────────────────────────────────────────────────┘
create table if not exists signal_work (
  signal_id      bigint not null references signals (id) on delete restrict,
  work_id        bigint not null references works (id) on delete restrict,

  dikaitkan_oleh text not null references users (id) on delete restrict,
  dikaitkan_pada timestamptz not null default now(),

  -- ── PELEPASAN YANG LUNAK ──
  --
  -- Barisnya TIDAK PERNAH dihapus. Salah kait pasti terjadi di bawah N:N, dan
  -- menghapus barisnya akan menghapus juga fakta bahwa Signal itu pernah
  -- dianggap ditangani di sini — justru pertanyaan yang menjadi alasan Signal
  -- disimpan permanen. Yang dilepas ditandai, bukan dihilangkan (I-16).
  dilepas_pada   timestamptz,
  dilepas_oleh   text references users (id) on delete restrict,
  alasan         text,

  primary key (signal_id, work_id),

  -- Bertiga terisi atau bertiga kosong. Pelepasan tanpa nama tidak bisa
  -- ditagih, dan pelepasan tanpa alasan tidak bisa diaudit siapa pun.
  constraint signal_work_pelepasan_utuh
    check (
      (dilepas_pada is null and dilepas_oleh is null and alasan is null)
      or (dilepas_pada is not null and dilepas_oleh is not null
          and coalesce(trim(alasan), '') <> '')
    )
);

create index if not exists signal_work_aktif_idx
  on signal_work (work_id)
  where dilepas_pada is null;

/* ──────────────────────────── work_executors ──────────────────────────── */

create table if not exists work_executors (
  work_id                    bigint not null references works (id) on delete restrict,
  user_id                    text not null references users (id) on delete restrict,

  ditugaskan_oleh            text not null references users (id) on delete restrict,
  ditugaskan_pada            timestamptz not null default now(),

  -- ── SNAPSHOT, BUKAN RUJUKAN HIDUP ──
  --
  -- Departemen orang bisa berubah. Tanpa membekukannya di sini, pertanyaan
  -- "pekerjaan ini lintas departemen atau tidak" akan berubah jawabannya
  -- berbulan-bulan kemudian, tanpa ada yang mengubah pekerjaannya. D4
  -- mengizinkan lintas departemen, jadi faktanya harus terbaca dari baris.
  --
  -- Tanpa kunci asing, dan itu disengaja — sama alasannya dengan
  -- `works.primary_department`.
  departemen_saat_ditugaskan text not null,

  dilepas_pada               timestamptz,
  dilepas_oleh               text references users (id) on delete restrict,

  primary key (work_id, user_id),

  constraint work_executors_departemen_terisi
    check (trim(departemen_saat_ditugaskan) <> ''),

  constraint work_executors_pelepasan_utuh
    check (
      (dilepas_pada is null and dilepas_oleh is null)
      or (dilepas_pada is not null and dilepas_oleh is not null)
    )
);

-- "Pekerjaan apa saja yang sedang saya pegang" — satu-satunya pertanyaan yang
-- ditanyakan dari sisi orang, dan hanya yang masih aktif yang relevan.
create index if not exists work_executors_aktif_idx
  on work_executors (user_id)
  where dilepas_pada is null;

/* ───────────────────────────── work_riwayat ───────────────────────────── */

-- ┌─ EMPAT JENIS, DAN `executor` BUKAN SALAH SATUNYA ────────────────────────┐
-- │                                                                          │
-- │ Riwayat penugasan sudah hidup di `work_executors` sendiri: barisnya      │
-- │ append-only, membawa siapa menugaskan, kapan, dan kapan dilepas.         │
-- │ Menyalinnya ke sini berarti dua catatan untuk satu peristiwa, dan yang   │
-- │ kedua akan menyimpang diam-diam.                                         │
-- │                                                                          │
-- │ `signal` juga tidak ada di sini, alasannya sama: `signal_work` sudah     │
-- │ merekamnya sendiri.                                                      │
-- └──────────────────────────────────────────────────────────────────────────┘
create table if not exists work_riwayat (
  id         bigint generated always as identity primary key,
  work_id    bigint not null references works (id) on delete restrict,

  jenis      text not null,
  nilai_lama text,
  nilai_baru text not null,
  alasan     text,

  oleh       text not null references users (id) on delete restrict,
  pada       timestamptz not null default now(),

  constraint work_riwayat_jenis_sah
    check (jenis in ('owner', 'tenggat', 'status', 'departemen'))
);

create index if not exists work_riwayat_urut_idx
  on work_riwayat (work_id, pada);

/* ──────────────────────────────── RLS ──────────────────────────────── */

-- Sama dengan 113 tabel lain: RLS menyala, NOL policy — menolak secara bawaan.
-- Seluruh otorisasi ada di TypeScript (`src/lib/ops/scope-v1.ts`, `rbac.ts`),
-- dan jalur tulisnya akan melewati fungsi ber-`security definer` pada STEP 3.
alter table works          enable row level security;
alter table signal_work    enable row level security;
alter table work_executors enable row level security;
alter table work_riwayat   enable row level security;

revoke all on table works          from anon, authenticated;
revoke all on table signal_work    from anon, authenticated;
revoke all on table work_executors from anon, authenticated;
revoke all on table work_riwayat   from anon, authenticated;
