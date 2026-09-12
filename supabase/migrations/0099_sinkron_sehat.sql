-- Kesehatan tiap penarikan otomatis.
--
-- KENAPA INI ADA. Cron-nya selama ini selalu melapor "berhasil" walau
-- pekerjaannya gagal: pg_cron cuma mencatat bahwa permintaan HTTP terkirim,
-- bukan hasilnya. Akibatnya katalog menu ESB macet DUA BELAS HARI tanpa satu
-- pun tanda di layar mana pun, dan bug yang membuat angkanya tiga puluh kali
-- lipat hidup berbulan-bulan dengan cara yang sama — sampai akhirnya
-- ditemukan orang, bukan oleh sistem.
--
-- Yang dicatat di sini bukan "apakah jalan terakhir sukses" melainkan KAPAN
-- TERAKHIR KALI TUNTAS. Itu bedanya: kegagalan sesekali memang wajar dan akan
-- sembuh sendiri pada jalan berikutnya, sedangkan yang berbahaya adalah
-- pekerjaan yang tidak pernah lagi sampai selesai — dan itu justru tidak
-- terlihat kalau yang diperiksa cuma jalan terakhir.
create table if not exists public.sinkron_sehat (
  job              text primary key,
  terakhir_coba    timestamptz,
  terakhir_sukses  timestamptz,
  terakhir_tuntas  timestamptz,
  gagal_beruntun   integer not null default 0,
  pesan            text,
  hasil            jsonb
);

-- Pagar yang sama dengan seluruh tabel lain di proyek ini: RLS DINYALAKAN tanpa
-- satu pun policy, sehingga hanya server (service role, yang memang melewati
-- RLS) bisa menyentuhnya. Tanpa ini, tabel di skema public bisa terbaca lewat
-- API publik — dan dua tabel yang dibuat belakangan sempat lolos dari pola itu.
alter table public.sinkron_sehat enable row level security;
alter table public.esb_menu_stage enable row level security;
