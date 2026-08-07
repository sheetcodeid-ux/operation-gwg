-- Tindak lanjut temuan hygiene.
--
-- Alurnya: pemeriksa membuka foto audit, menemukan bagian yang kotor, lalu
-- mengirimkannya ke supervisor outlet lewat Pesan. Temuan itu MENGGANTUNG —
-- ditandai merah di obrolan — sampai supervisornya menutupnya dengan bukti foto.
--
-- Dicatat sebagai barisnya sendiri, bukan sekadar pesan biasa, karena statusnya
-- harus bisa ditanya ulang: "mana temuan yang belum ditutup?" tidak mungkin
-- dijawab dari isi percakapan.
create table if not exists public.hygiene_followups (
  id            text primary key,
  hygiene_id    text not null,
  outlet_id     text not null,
  -- Foto temuan: satu objek {path,name,type} seperti lampiran obrolan.
  photo         jsonb not null default '{}'::jsonb,
  -- Bagian mana yang kotor (nama grup foto) + catatan pemeriksa.
  area          text not null default '',
  note          text not null default '',
  raised_by     text not null,
  assigned_to   text not null,
  -- Obrolan tempat temuan ini dikirim, supaya bisa dibuka kembali dari mana pun.
  thread_id     text,
  status        text not null default 'menunggu',
  -- Penutupan WAJIB berbukti; kolom ini yang menjadi buktinya.
  proof         jsonb not null default '[]'::jsonb,
  resolution    text not null default '',
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- "Temuan apa saja yang menggantung untuk supervisor ini" — kueri paling sering.
create index if not exists hygiene_followups_assignee_idx
  on public.hygiene_followups (assigned_to, status);
-- Menampilkan penanda pada audit yang temuannya sudah dikirim.
create index if not exists hygiene_followups_hygiene_idx
  on public.hygiene_followups (hygiene_id);

alter table public.hygiene_followups enable row level security;

-- Indeks untuk statistik kecepatan balas: mengurutkan pesan satu percakapan
-- menurut waktu sudah dilayani chat_messages_thread_idx, tapi perhitungan
-- per-pengirim juga menyaring sender_id.
create index if not exists chat_messages_sender_idx
  on public.chat_messages (sender_id, created_at);
