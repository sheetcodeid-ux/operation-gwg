-- Pesan — obrolan internal antar seluruh pengguna.
--
-- Tiga tabel, sengaja sesederhana mungkin:
--   chat_threads      satu percakapan (japri atau grup)
--   chat_participants siapa saja di dalamnya + sampai mana ia sudah membaca
--   chat_messages     isinya
--
-- Ringkasan percakapan (pesan terakhir + waktunya) DISIMPAN di chat_threads,
-- bukan dihitung ulang dari chat_messages tiap kali daftar dibuka. Tanpa itu,
-- membuka daftar percakapan berarti satu subquery per baris — beban yang
-- tumbuh terus seiring bertambahnya pesan.

create table if not exists public.chat_threads (
  id                text primary key,
  -- 'dm'  = japri dua orang; 'group' = beberapa orang dengan judul sendiri.
  kind              text not null default 'dm',
  title             text,
  created_by        text not null,
  created_at        timestamptz not null default now(),
  -- Ringkasan untuk daftar percakapan.
  last_message_at   timestamptz not null default now(),
  last_message_text text not null default '',
  last_sender_id    text
);

create table if not exists public.chat_participants (
  thread_id    text not null references public.chat_threads(id) on delete cascade,
  user_id      text not null,
  -- Batas baca: pesan setelah waktu ini dihitung belum dibaca.
  last_read_at timestamptz not null default 'epoch',
  -- Percakapan yang dihapus pengguna hanya disembunyikan DARINYA; lawan
  -- bicaranya tetap punya riwayatnya. Menghapus beneran akan menghapus pesan
  -- orang lain juga, dan itu tidak bisa dibatalkan.
  hidden_at    timestamptz,
  primary key (thread_id, user_id)
);

create table if not exists public.chat_messages (
  id          text primary key,
  thread_id   text not null references public.chat_threads(id) on delete cascade,
  sender_id   text not null,
  body        text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  -- Rujukan ke catatan lain di aplikasi (mis. sebuah pengajuan), supaya sebuah
  -- pengajuan bisa diteruskan ke obrolan dan dibahas di sana.
  ref_kind    text,
  ref_id      text,
  created_at  timestamptz not null default now()
);

-- Daftar percakapan seseorang, terbaru dulu.
create index if not exists chat_participants_user_idx on public.chat_participants (user_id);
-- Membuka satu percakapan = membaca pesannya urut waktu.
create index if not exists chat_messages_thread_idx on public.chat_messages (thread_id, created_at);

alter table public.chat_threads      enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages     enable row level security;
