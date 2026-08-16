-- Memisahkan DUA meja yang selama ini menumpuk di satu antrean.
--
--  • system   — perangkat & POS di cabang (mesin kasir, printer struk, jaringan
--               outlet). Ditangani tim System Support.
--  • helpdesk — aplikasi web ini sendiri (error, permintaan fitur, hak akses,
--               data yang perlu dikoreksi). Ditangani pemilik Help Desk.
--
-- Keduanya ditangani ORANG YANG BERBEDA. Digabung berarti keluhan printer kasir
-- menumpuk di antrean yang sama dengan permintaan fitur web, dan dua-duanya
-- jadi lebih lambat ditemukan.
--
-- Yang sengaja TIDAK dipisah: tabelnya. Membangun tabel tiket kedua
-- mengembalikan persoalan yang mau diselesaikan — data IT tercecer di dua
-- tempat, dan tidak ada satu pun tampilan yang bisa menghitung keduanya.

alter table public.system_requests
  add column if not exists desk text not null default 'system';

alter table public.system_requests
  drop constraint if exists system_requests_desk_check;
alter table public.system_requests
  add constraint system_requests_desk_check
  check (desk in ('system', 'helpdesk'));

-- Kategori baru khusus meja Help Desk: data yang salah atau tidak muncul.
-- Keluhan ini sering dan tidak sama dengan "aplikasi error" — halamannya
-- terbuka normal, isinya yang keliru — jadi menyatukannya menyembunyikan
-- kelompok masalah yang penanganannya berbeda.
alter table public.system_requests
  drop constraint if exists system_requests_request_type_check;
alter table public.system_requests
  add constraint system_requests_request_type_check
  check (request_type = any (array[
    'jaringan','bug','hardware','printer','salah_data','akses','fitur','training','lainnya'
  ]));

-- Tiket lama yang jelas-jelas soal aplikasi dipindahkan ke meja Help Desk.
-- Sisanya dibiarkan di 'system': menebak-nebak kategori yang ambigu lebih buruk
-- daripada membiarkannya, karena tiket yang salah meja tidak akan dilihat
-- orang yang seharusnya mengerjakannya.
update public.system_requests
set desk = 'helpdesk'
where request_type in ('bug', 'fitur', 'akses');

-- Tiap antrean dibuka per meja, terurut waktu.
create index if not exists system_requests_desk_created_idx
  on public.system_requests (desk, created_at desc);
