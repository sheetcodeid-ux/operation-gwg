-- Pesan — favorit dan arsip per pengguna.
--
-- Keduanya melekat pada PESERTA, bukan pada percakapannya: menandai favorit
-- atau mengarsipkan adalah keputusan pribadi, dan tidak boleh ikut mengubah
-- tampilan lawan bicara.
--
-- Arsip berbeda dari `hidden_at`. Yang diarsipkan tetap tersimpan dan bisa
-- dibuka lewat baris "Diarsipkan"; yang disembunyikan hilang dari daftar sampai
-- ada pesan baru.
alter table public.chat_participants
  add column if not exists favorite    boolean     not null default false,
  add column if not exists archived_at timestamptz;
