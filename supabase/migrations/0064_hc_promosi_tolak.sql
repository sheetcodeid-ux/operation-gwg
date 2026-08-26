-- Dua permintaan Human Capital atas Pengajuan Dokumen Karyawan.
--
-- 1. Surat Promosi belum ada di daftar jenis, padahal HC memang menerbitkannya.
--    Selama tidak ada, permintaannya masuk lewat jalur lain (chat) dan tidak
--    pernah tercatat di antrian mana pun.
--
-- 2. Tidak ada cara MENUTUP pengajuan yang batal. Statusnya hanya bisa maju —
--    menunggu, diproses, menunggu berkas, selesai — sehingga pengajuan yang
--    dibatalkan cabang, atau yang salah kirim, menggantung di antrian
--    selamanya. Satu-satunya jalan keluarnya adalah menandainya "selesai",
--    yang berarti mencatat dokumen terbit padahal tidak pernah ada.
--
-- Status `rejected` sengaja BUKAN penghapusan: siapa yang membatalkan dan
-- alasannya tetap tersimpan, karena pertanyaan "kenapa surat itu tidak jadi"
-- muncul justru berminggu-minggu kemudian.

alter table public.hc_submissions drop constraint if exists hc_submissions_doc_type_check;
alter table public.hc_submissions
  add constraint hc_submissions_doc_type_check check (
    doc_type in (
      'bpjs', 'pkwt', 'perpanjang_pkwt', 'promosi',
      'teguran', 'sp1', 'sp2', 'sp3',
      'pengalaman', 'keterangan_kerja', 'tidak_lanjut_kontrak', 'phk', 'sppt'
    )
  );

alter table public.hc_submissions drop constraint if exists hc_submissions_status_check;
alter table public.hc_submissions
  add constraint hc_submissions_status_check check (
    status in ('waiting', 'processing', 'pending', 'done', 'rejected')
  );

comment on column public.hc_submissions.status is
  'waiting → processing → pending → done. `rejected` menutup pengajuan yang batal; alasannya disimpan di hc_note.';
