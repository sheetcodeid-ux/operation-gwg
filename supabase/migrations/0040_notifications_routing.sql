-- Notifikasi per departemen + tautan tujuan.
--
-- Sebelumnya notifikasi hanya bisa ditujukan ke satu orang (`target_user`) atau
-- ke seluruh pemilik outlet. Tidak ada cara mengirimkannya ke sebuah TIM, jadi
-- aktivitas seperti "pengajuan design masuk" tidak pernah sampai ke Creative —
-- notifikasinya tidak punya penerima yang tepat, sehingga tidak pernah dibuat.
alter table public.notifications
  add column if not exists department text,
  add column if not exists href text,
  add column if not exists dismissed boolean not null default false,
  add column if not exists actor_name text;

-- "Notifikasi untuk saya" = ditujukan ke saya ATAU ke departemen saya, dan
-- belum ditutup. Dua indeks ini melayani masing-masing cabangnya.
create index if not exists notifications_target_idx
  on public.notifications (target_user, dismissed, created_at desc);
create index if not exists notifications_department_idx
  on public.notifications (department, dismissed, created_at desc);

comment on column public.notifications.department is
  'Penerima berupa TIM. Diisi bila notifikasi ditujukan ke seluruh anggota departemen, bukan satu orang.';
comment on column public.notifications.href is
  'Halaman tujuan saat notifikasi diklik. Tanpa ini, notifikasi hanya bisa dibaca, tidak bisa ditindaklanjuti.';
comment on column public.notifications.dismissed is
  'Ditutup pengguna lewat tombol x. Berbeda dari `read`: dibaca berarti sudah dilihat, ditutup berarti disingkirkan dari daftar.';
