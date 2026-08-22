-- Hasil design ditahan di atasan sebelum sampai ke pemohon.
--
-- Sebelumnya designer menandai pekerjaannya selesai dan berkasnya LANGSUNG
-- terkirim ke pemohon — supervisor cabang, kepala divisi, siapa pun yang
-- meminta. Tidak ada satu pun titik di mana tim Creative sempat melihat apa
-- yang keluar atas nama mereka, sehingga koreksi baru terjadi setelah
-- pemohonnya sendiri yang menagih revisi. Permintaan Seka: hasilnya di-submit
-- dulu, di-ACC atasan, baru boleh terkirim.
--
-- Dua perubahan, keduanya sekecil mungkin:
--
--  • satu status baru, `menunggu_atasan`, di antara "sedang dikerjakan" dan
--    "selesai";
--  • satu kolom `hasil`, tempat berkas yang di-submit designer MENUNGGU tanpa
--    tercampur ke `attachments`. Ini bukan kerapian belaka: `attachments` adalah
--    yang dilihat pemohon, jadi menaruh hasil yang belum di-ACC di sana sama
--    saja dengan mengirimkannya. Hasilnya baru dipindah ke `attachments` pada
--    detik atasannya menyetujui.

alter table public.hc_requests drop constraint if exists hc_requests_status_check;
alter table public.hc_requests
  add constraint hc_requests_status_check check (
    status in (
      'menunggu_hc',
      'ditolak_hc',
      'disetujui_hc',
      'menunggu_atasan',
      'menunggu_finance',
      'ditolak_finance',
      'disetujui_finance',
      'terlaksana'
    )
  );

alter table public.hc_requests add column if not exists hasil jsonb;

comment on column public.hc_requests.hasil is
  'Design yang sudah di-submit designer dan menunggu ACC atasan: { at, byId, byName, note, attachments[], tolakan[], accAt, accByName }. Belum terlihat pemohon sampai statusnya terlaksana.';
