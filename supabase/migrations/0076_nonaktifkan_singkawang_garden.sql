-- Menonaktifkan outlet yang sudah tutup.
--
-- "Nordu Coffee Singkawang Garden" tidak ada di daftar cabang aktif ESB, dan
-- dikonfirmasi memang sudah tutup. Selama masih ditandai aktif, ia ikut muncul
-- di setiap tabel yang meminta pengisian — Realisasi Beban Operasional, ceklis
-- Management Fee — sebagai baris yang selamanya kosong. Baris seperti itu bukan
-- sekadar mengganggu: ia membuat "belum diisi" terlihat wajar, dan outlet lain
-- yang benar-benar belum diisi ikut tenggelam di antaranya.
--
-- Tidak ada satu pun pengguna yang terikat padanya, jadi tidak ada yang
-- kehilangan akses. Datanya yang lama tetap utuh — yang berubah hanya
-- kemunculannya di daftar pilihan.
update public.outlets
   set active = false
 where name = 'Nordu Coffee Singkawang Garden' and active;
