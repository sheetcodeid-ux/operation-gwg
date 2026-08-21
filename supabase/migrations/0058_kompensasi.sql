-- Compensation & Benefit — kolom yang dituntut tampilan rujukan Human Capital.
--
-- Tiga hal yang diminta layar tapi belum bisa diwakili skema:
--
--  1. Payroll manajemen dipisah Office vs Warehouse. Tidak ada kolom yang
--     menyimpannya, dan menebaknya dari nama karyawan berarti angka gaji
--     bergantung pada tebakan.
--  2. Payroll punya status pengerjaan per periode ("Selesai Diproses" /
--     "Dalam Proses"). Statusnya disimpan PER BARIS, bukan per kelompok —
--     status kelompok diturunkan dari barisnya di `lib/hcmos/kompensasi.ts`,
--     supaya tidak ada kelompok bertanda selesai yang masih menyisakan baris
--     menggantung di dalamnya.
--  3. Daftar prioritas BPJS menyebut masa kerja. Tanggal masuk kerja tidak ada
--     di mana pun untuk karyawan manajemen — `users.created_at` itu tanggal
--     akun dibuat, bukan tanggal orangnya mulai bekerja, dan memakainya akan
--     memberi masa kerja yang salah bagi setiap karyawan lama.
alter table public.hc_payroll add column if not exists sumber text;
alter table public.hc_payroll add column if not exists status text not null default 'proses';
alter table public.hc_benefits add column if not exists tgl_masuk date;

-- BPJS Ketenagakerjaan dan BPJS Kesehatan didaftarkan TERPISAH dan berjalan
-- dengan kecepatan berbeda — itulah temuan yang ingin ditunjukkan layarnya.
-- Satu kolom `status` bersama tidak bisa menyatakan "TK sudah, KES belum",
-- sehingga dua angka yang seharusnya berbeda akan selalu tampak sama dan
-- celah yang nyata jadi tidak kelihatan.
alter table public.hc_benefits add column if not exists status_tk text not null default 'belum';
alter table public.hc_benefits add column if not exists status_kes text not null default 'belum';
update public.hc_benefits set status_tk = status, status_kes = status
where status is not null and status_tk = 'belum' and status_kes = 'belum';

-- Benefit di luar BPJS (THR, tunjangan lain) — jumlah peserta terhadap
-- sasarannya. Ditaruh di tabelnya sendiri, bukan menumpang `hc_benefits`:
-- yang itu satu baris per KARYAWAN, yang ini satu baris per PROGRAM. Menumpuk
-- dua bentuk berbeda di satu tabel berarti setiap pembacaan harus menyaring
-- dulu, dan cepat atau lambat ada yang lupa menyaring.
create table if not exists public.hc_benefit_programs (
  id uuid primary key default gen_random_uuid(),
  program text not null,
  scope text not null default 'manajemen',
  peserta integer not null default 0,
  target integer not null default 0,
  catatan text,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Seperti seluruh tabel lain: aplikasi menyentuhnya lewat service_role dari
-- server, tidak pernah dari peramban. RLS dinyalakan tanpa policy supaya tidak
-- ada jalan masuk dari anon/authenticated.
alter table public.hc_benefit_programs enable row level security;
