-- `diubah_oleh` seharusnya TEXT, bukan uuid.
--
-- Id pengguna di aplikasi ini berbentuk "usr_001", bukan UUID — tujuh tabel
-- KPI lainnya sudah menyimpannya sebagai text, dan tabel ini satu-satunya yang
-- menyimpang. Akibatnya Simpan selalu gagal dengan pesan dari Postgres apa
-- adanya: invalid input syntax for type uuid: "usr_001".
--
-- Migrasi 0101 sudah diperbaiki untuk pemasangan baru; berkas ini memperbaiki
-- basis data yang terlanjur dibuat dengan tipe lama.
alter table public.kpi_posisi_setelan
  alter column diubah_oleh type text using diubah_oleh::text;
