-- Permintaan karyawan dipisah dua scope: Manajemen dan Outlet.
--
-- Hasil Meeting Fitur HRD. Bukan sekadar label: dua scope ini ditangani orang
-- yang berbeda dan diukur dengan cara yang berbeda.
--
--   Manajemen — permintaan dari divisi kantor, ditangani Dini (Talent
--               Acquisition). Yang dicari biasanya satu orang untuk satu
--               posisi, dan lamanya proses dihitung dari kebutuhan divisinya.
--   Outlet    — permintaan dari cabang, datang lewat Supervisor. Jumlahnya
--               banyak, berulang, dan waktunya diukur terhadap jadwal buka
--               cabang, bukan terhadap kebutuhan divisi.
--
-- Menggabungkannya di satu daftar membuat kedua ukuran itu bercampur, dan
-- rata-rata waktu rekrutmen berhenti berarti bagi keduanya.
--
-- Baris lama seluruhnya menjadi 'manajemen'. Sebelum ini permintaan outlet
-- memang belum bisa diajukan lewat sistem, jadi tidak ada satu pun yang salah
-- ditempatkan.

alter table public.hc_requests
  add column if not exists scope text not null default 'manajemen';

alter table public.hc_requests drop constraint if exists hc_requests_scope_check;
alter table public.hc_requests
  add constraint hc_requests_scope_check check (scope in ('manajemen', 'outlet'));

-- Outlet mana yang meminta. Kosong untuk scope manajemen.
--
-- Disimpan sebagai kolom sendiri, bukan ditebak dari penugasan pemohonnya:
-- Supervisor bisa berpindah cabang, dan permintaan lama harus tetap tercatat
-- atas cabang yang benar-benar mengajukannya.
alter table public.hc_requests
  add column if not exists outlet_id text;

create index if not exists hc_requests_scope_idx on public.hc_requests (kind, scope, created_at desc);
