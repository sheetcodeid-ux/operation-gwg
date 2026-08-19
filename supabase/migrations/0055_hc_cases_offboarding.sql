-- Kolom yang dibutuhkan Case Management dan Offboarding untuk bisa menjawab
-- pertanyaannya sendiri.
--
-- Semua tambahan di sini menyimpan FAKTA, bukan tafsiran:
--
--   tgl_selesai     : kapan perkaranya ditutup. Tanpa ini, "rata-rata waktu
--                     penyelesaian" tidak bisa dihitung sama sekali — status
--                     "selesai" hanya bercerita bahwa ia sudah selesai, bukan
--                     kapan. Lamanya dihitung dari selisihnya, tidak disimpan,
--                     supaya tidak ada dua angka yang bisa berbeda.
--   eskalasi        : seberapa jauh perkara ini naik. Dulu diperkirakan dari
--                     kategori, dan itu keliru: "Pelanggaran SOP" bisa berakhir
--                     teguran lisan maupun sampai ke pengadilan hubungan
--                     industrial.
--   exit_interview  : tiga langkah offboarding yang selama ini hanya hidup di
--   serah_aset        kepala dan di grup WhatsApp. Disimpan terpisah, bukan
--   payroll_final     dilebur jadi satu kolom status, karena ketiganya berjalan
--                     paralel dan dipegang orang berbeda — Adrian menggali exit
--                     interview, Uswatun memastikan aset, Finance memproses gaji
--                     terakhir. Satu kolom status memaksa ketiganya berurutan
--                     padahal tidak, dan menyembunyikan mana yang tertinggal.

alter table public.hc_cases add column if not exists tgl_selesai    date;
alter table public.hc_cases add column if not exists eskalasi       text not null default 'normal';
alter table public.hc_cases add column if not exists exit_interview boolean not null default false;
alter table public.hc_cases add column if not exists serah_aset     boolean not null default false;
alter table public.hc_cases add column if not exists payroll_final  boolean not null default false;

-- Batasan ditaruh di basis data, bukan hanya di formulir: kiriman bisa datang
-- dari mana saja, dan batas yang cuma ada di layar bukan batas.
alter table public.hc_cases drop constraint if exists hc_cases_eskalasi_check;
alter table public.hc_cases
  add constraint hc_cases_eskalasi_check check (eskalasi in ('rendah', 'normal', 'tinggi'));

create index if not exists hc_cases_tgl_selesai_idx on public.hc_cases (tgl_selesai desc);
