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

-- SELURUH tiket lama tetap di meja System, tanpa kecuali.
--
-- Sempat dipindahkan berdasarkan kategori, dan itu keliru: "Permintaan Fitur"
-- pada tiket-tiket lama berarti penambahan menu di ESB/POS — pekerjaan tim
-- System Support, bukan aplikasi web. Kategorinya sama, artinya berbeda.
--
-- Pelajarannya: kategori tidak bisa dipakai menebak meja. Meja IT Help Desk
-- dimulai dari kosong, dan diisi hanya oleh tiket yang memang dikirim ke sana.

-- Tiap antrean dibuka per meja, terurut waktu.
create index if not exists system_requests_desk_created_idx
  on public.system_requests (desk, created_at desc);
