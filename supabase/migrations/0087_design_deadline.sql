-- Tenggat pengajuan desain: kategorinya dan tanggal jatuh temponya.
--
-- Tanggalnya DISIMPAN, bukan dihitung ulang saat dibaca. Aturan hari per
-- kategori bisa berubah suatu saat, dan kalau tanggalnya dihitung ulang,
-- permintaan lama ikut berpindah tenggat — pekerjaan yang dulu tepat waktu
-- mendadak jadi terlambat tanpa ada yang menyentuhnya.
alter table hc_requests
  add column if not exists design_deadline_kategori text,
  add column if not exists design_deadline date;

create index if not exists hc_requests_design_deadline_idx
  on hc_requests (design_deadline)
  where kind = 'design';
