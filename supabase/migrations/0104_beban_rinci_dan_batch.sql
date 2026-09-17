-- Operational V.1 · PHASE 2B — rincian beban, dua beban baru, dan jejak unggahan.
--
-- SELURUHNYA ADITIF. Tidak ada kolom yang dihapus, tidak ada tipe yang diubah,
-- tidak ada satu pun dari 174 baris finansial yang tersentuh. Migrasi ini bisa
-- dijalankan pada basis data yang sedang melayani produksi tanpa mengubah satu
-- angka pun yang sudah ada.

/* ═══════════════ 1 · rincian utilitas + dua beban yang belum pernah ada ═══════════════ */

-- ┌─ KENAPA KEENAMNYA NULL-ABLE, PADAHAL SEBELAS KOLOM LAMA TIDAK ──────────┐
-- │                                                                          │
-- │ Sebelas kolom angka di `op_expenses`, `op_purchases`, dan `op_pnl`       │
-- │ semuanya `numeric not null default 0` sejak `0017_op_finance.sql`. Di    │
-- │ tabel-tabel itu, 0 dan "belum dilaporkan" TIDAK BISA DIBEDAKAN — outlet  │
-- │ yang belum mengisi sewa terbaca sama dengan outlet yang memang tidak     │
-- │ membayar sewa.                                                           │
-- │                                                                          │
-- │ Itu keterbatasan skema lama, dan diterima apa adanya: membuatnya         │
-- │ nullable berarti mengubah sebelas kolom yang sedang dipakai, dan         │
-- │ perubahan itu harus ditinjau sendiri, bukan disisipkan di sini.          │
-- │                                                                          │
-- │ Yang BARU tidak mewarisi keterbatasan itu. Kosong tetap NULL.            │
-- │ Baris historis mendapat NULL — bukan 0 — karena rinciannya memang belum  │
-- │ pernah ada, dan menuliskannya 0 berarti mengklaim outlet tidak memakai   │
-- │ listrik.                                                                 │
-- └──────────────────────────────────────────────────────────────────────────┘

alter table public.op_expenses
  add column if not exists listrik      numeric,
  add column if not exists air          numeric,
  add column if not exists internet     numeric,
  add column if not exists kebersihan   numeric,
  add column if not exists platform_fee numeric,
  add column if not exists pbjt         numeric;

comment on column public.op_expenses.listrik      is 'Rincian utilitas V.1. NULL = belum pernah dirinci, bukan nol.';
comment on column public.op_expenses.air          is 'Rincian utilitas V.1. NULL = belum pernah dirinci, bukan nol.';
comment on column public.op_expenses.internet     is 'Rincian utilitas V.1. NULL = belum pernah dirinci, bukan nol.';
comment on column public.op_expenses.kebersihan   is 'Rincian utilitas V.1. NULL = belum pernah dirinci, bukan nol.';

-- `utilitas` TETAP ADA dan tetap berarti sama: total biaya utilitas bulan itu.
-- Yang berubah hanya ASALNYA untuk baris baru — dijumlahkan dari empat kolom di
-- atas, bukan diketik. Baris lama tidak disentuh dan tetap sah.
comment on column public.op_expenses.utilitas is
  'Total utilitas. Baris V.1: listrik + air + internet + kebersihan. Baris historis: angka agregat apa adanya, rinciannya NULL.';

-- Platform fee dan PBJT BELUM PERNAH ADA sebagai kolom. Keduanya mulai terisi
-- ketika penggunanya mengisinya — tidak ada satu baris historis pun yang
-- dipindahkan ke sini.
--
-- `lainnya`, `ongkos_kirim`, dan `potongan` historis TETAP di tempatnya.
-- Memindahkan sebagiannya ke sini berarti menulis ulang laporan keuangan yang
-- sudah ditutup, dan tidak ada seorang pun yang bisa memastikan bagian mana.
comment on column public.op_expenses.platform_fee is
  'Komisi platform (GoFood/GrabFood/ShopeeFood) dari laporan keuangan. Kolom baru V.1 — NULL untuk seluruh baris sebelum Phase 2B. TIDAK sama dengan ongkos_kirim.';
comment on column public.op_expenses.pbjt is
  'PBJT dari laporan keuangan, diperlakukan sebagai beban operasional. Kolom baru V.1 — NULL untuk seluruh baris sebelum Phase 2B.';

/* ═══════════════════════ 2 · jejak unggahan ═══════════════════════ */

-- ┌─ KENAPA PERLU ──────────────────────────────────────────────────────────┐
-- │                                                                          │
-- │ Sebelum ini, satu-satunya jejak sebuah unggahan adalah `updated_at`.     │
-- │ Tidak ada cara tahu berkas mana yang menulis angka mana, siapa yang      │
-- │ mengunggahnya, atau apakah berkas yang sama sudah pernah masuk.          │
-- │                                                                          │
-- │ Akibatnya: mengunggah ulang berkas yang sama diam-diam menulis ulang     │
-- │ seluruh barisnya. Hasilnya kebetulan sama, jadi tidak ada yang tahu —    │
-- │ sampai suatu hari berkasnya BUKAN yang sama, dan tidak ada yang bisa     │
-- │ menunjukkan apa yang berubah.                                            │
-- └──────────────────────────────────────────────────────────────────────────┘
create table if not exists public.financial_upload_batch (
  id           bigint generated always as identity primary key,
  periode      text not null,
  -- Sidik jari isi berkas SESUDAH dinormalkan, bukan berkas mentahnya. Dua
  -- berkas dengan angka yang sama persis tapi urutan baris berbeda harus
  -- dikenali sebagai unggahan yang sama — yang menentukan isinya, bukan
  -- bagaimana Excel kebetulan menyusunnya.
  sidik        text not null,
  jumlah_baris integer not null,
  jumlah_outlet integer not null,
  status       text not null default 'tersimpan',
  oleh_id      text references public.users (id) on delete restrict,
  oleh_nama    text not null default '',
  catatan      text,
  dibuat_pada  timestamptz not null default now(),

  constraint financial_upload_batch_periode_bentuk check (periode ~ '^\d{4}-\d{2}$'),
  constraint financial_upload_batch_status_check check (status in ('tersimpan', 'diulang', 'gagal')),
  constraint financial_upload_batch_jumlah_check check (jumlah_baris >= 0 and jumlah_outlet >= 0)
);

-- Inilah penjaga idempotensi: berkas yang isinya sama untuk bulan yang sama
-- tidak bisa tercatat dua kali sebagai unggahan yang tersimpan.
create unique index if not exists financial_upload_batch_sidik_unik
  on public.financial_upload_batch (periode, sidik)
  where status = 'tersimpan';

create index if not exists financial_upload_batch_periode_idx
  on public.financial_upload_batch (periode, dibuat_pada desc);

alter table public.financial_upload_batch enable row level security;

-- Penunjuk balik: baris mana ditulis unggahan mana. NULL untuk seluruh baris
-- yang sudah ada — memang tidak diketahui, dan menebaknya lebih buruk daripada
-- mengakuinya tidak diketahui.
alter table public.op_expenses  add column if not exists batch_id bigint references public.financial_upload_batch (id) on delete set null;
alter table public.op_purchases add column if not exists batch_id bigint references public.financial_upload_batch (id) on delete set null;
alter table public.op_pnl       add column if not exists batch_id bigint references public.financial_upload_batch (id) on delete set null;

create index if not exists op_expenses_batch_idx  on public.op_expenses (batch_id)  where batch_id is not null;
create index if not exists op_purchases_batch_idx on public.op_purchases (batch_id) where batch_id is not null;
create index if not exists op_pnl_batch_idx       on public.op_pnl (batch_id)       where batch_id is not null;

comment on column public.op_expenses.batch_id is 'Unggahan yang terakhir menulis baris ini. NULL = ditulis sebelum jejak unggahan ada.';
