-- Catatan galat sisi server.
--
-- Di build produksi Next MENYUNTING pesan galat sebelum sampai ke pengguna;
-- yang terlihat hanya "An error occurred in the Server Components render"
-- beserta sebuah `digest`. Isinya memang tidak boleh bocor ke peramban, tapi
-- akibatnya satu-satunya cara mengetahui apa yang sebenarnya salah adalah
-- membaca log platform — dan saat ekspor log itu kosong, kegagalan produksi
-- jadi mustahil didiagnosis selain dengan menebak.
--
-- Diisi oleh hook `onRequestError` (instrumentation.ts) dengan galat ASLINYA.
create table if not exists public.app_errors (
  id bigserial primary key,
  at timestamptz not null default now(),
  digest text,
  path text,
  method text,
  kind text,
  message text,
  stack text,
  user_id text,
  user_name text
);

-- Dibaca hampir selalu "yang terbaru dulu", atau dicari lewat digest yang
-- ditunjukkan aplikasi ke pengguna.
create index if not exists app_errors_at_idx on public.app_errors (at desc);
create index if not exists app_errors_digest_idx on public.app_errors (digest);

alter table public.app_errors enable row level security;

comment on table public.app_errors is
  'Galat sisi server yang tertangkap onRequestError. Pesannya disunting di build produksi sebelum sampai ke pengguna, jadi hanya di sini isinya utuh.';
