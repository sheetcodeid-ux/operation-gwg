-- IT Help Desk: nomor tiket, waktu respons, dan penilaian kepuasan.
--
-- Alur pengajuan System/IT sudah ada sejak awal, tapi tiga hal yang membuatnya
-- bisa DIPANTAU belum ada:
--
--  • Nomor tiket. Tanpa nomor, satu keluhan tidak punya sebutan. Orang merujuk
--    "yang printer kemarin", dan begitu ada dua printer bermasalah, tidak ada
--    lagi cara menunjuk yang mana.
--  • Waktu respons pertama. Selisih "dibuat" dan "selesai" tidak memisahkan
--    tiket yang lama karena sulit dari tiket yang lama karena tidak ada yang
--    membukanya. Yang kedua jauh lebih perlu diketahui.
--  • Penilaian pelapor. Tiket ditutup sepihak oleh penanganya; tanpa umpan
--    balik, tidak ada yang tahu apakah masalahnya benar-benar beres.

alter table public.system_requests
  add column if not exists ticket_no text,
  add column if not exists first_response_at timestamptz,
  add column if not exists satisfaction smallint,
  add column if not exists satisfaction_note text,
  add column if not exists satisfaction_at timestamptz;

-- Nilai kepuasan dibatasi di basis data, bukan hanya di formulir. Kiriman bisa
-- datang dari mana saja; batas yang hanya ada di layar bukan batas.
alter table public.system_requests
  drop constraint if exists system_requests_satisfaction_range;
alter table public.system_requests
  add constraint system_requests_satisfaction_range
  check (satisfaction is null or satisfaction between 1 and 5);

-- Nomor untuk tiket yang sudah terlanjur ada, urut menurut waktu dibuat supaya
-- nomornya sejalan dengan urutan kejadian.
with urut as (
  select id,
         to_char(created_at, 'YYYYMM') as periode,
         row_number() over (partition by to_char(created_at, 'YYYYMM') order by created_at, id) as n
  from public.system_requests
  where ticket_no is null
)
update public.system_requests s
set ticket_no = 'IT-' || u.periode || '-' || lpad(u.n::text, 4, '0')
from urut u
where s.id = u.id;

-- Satu nomor hanya boleh menunjuk satu tiket.
create unique index if not exists system_requests_ticket_no_idx
  on public.system_requests (ticket_no)
  where ticket_no is not null;

-- Antrian selalu dibuka terurut waktu dan disaring status.
create index if not exists system_requests_status_created_idx
  on public.system_requests (status, created_at desc);

-- Kategori khusus keluhan IT harian: jaringan/internet dan printer.
-- Dulu daftarnya berorientasi permintaan pengembangan sistem ("fitur", "bug"),
-- jadi keluhan lapangan yang paling sering — wifi mati, printer kasir macet —
-- tidak punya tempat dan selalu jatuh ke "lainnya". Kategori yang selalu
-- "lainnya" tidak bisa dipakai menghitung apa pun.
alter table public.system_requests
  drop constraint if exists system_requests_request_type_check;
alter table public.system_requests
  add constraint system_requests_request_type_check
  check (request_type = any (array[
    'jaringan','bug','hardware','printer','akses','fitur','training','lainnya'
  ]));
