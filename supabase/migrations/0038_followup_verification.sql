-- Temuan hygiene: putaran perbaikan + verifikasi.
--
-- Sebelumnya temuan langsung "selesai" begitu supervisor mengunggah bukti. Itu
-- membuat penilaian akhir ada di tangan orang yang diperiksa. Sekarang bukti
-- masuk ke status VERIFIKASI, dan pelapor (koordinator area) yang memutuskan:
-- ACC, atau kembalikan untuk dibersihkan ulang.
--
-- `attempts` menyimpan SETIAP putaran — foto sebelum/sesudah, catatan, siapa
-- yang menilai, dan hasilnya. Tanpa riwayat ini, temuan yang tiga kali ditolak
-- terlihat sama saja dengan yang sekali langsung beres.
alter table public.hygiene_followups
  add column if not exists attempts jsonb not null default '[]'::jsonb;

-- Status yang mungkin: 'menunggu' (supervisor harus bertindak),
-- 'verifikasi' (menunggu penilaian pelapor), 'selesai' (sudah di-ACC).
comment on column public.hygiene_followups.status is
  'menunggu | verifikasi | selesai';

-- "Temuan mana yang menunggu SAYA nilai" — kueri koordinator, sesering
-- kueri supervisor untuk temuannya sendiri.
create index if not exists hygiene_followups_raiser_idx
  on public.hygiene_followups (raised_by, status);
