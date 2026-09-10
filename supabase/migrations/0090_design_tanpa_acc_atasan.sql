-- Tahap "Menunggu ACC Atasan" dihapus dari alur pengajuan design.
--
-- Hasil designer kini langsung sampai ke pemohonnya. Gerbang itu dulu ada
-- supaya setiap hasil pernah dilihat orang yang berwenang, tapi yang terjadi
-- sebenarnya: berkasnya sudah dilampirkan dan sudah bisa dibuka, dan yang
-- menahannya cuma satu klik yang tidak menambah pemeriksaan apa pun —
-- sementara pemohon menunggu tanpa tahu pekerjaannya sudah jadi.
--
-- SATU BARIS TERLANJUR BERHENTI DI SANA dan tidak boleh ditinggalkan: tanpa
-- tahap itu, tidak ada lagi tombol yang bisa memajukannya, dan pemohonnya akan
-- menunggu selamanya sebuah desain yang sebenarnya sudah selesai dikerjakan.
-- Barisnya dimajukan ke "terlaksana", dan hasilnya distempel diterima pada
-- waktu tahap ini dihapus — bukan dibiarkan kosong, karena kolom itu yang
-- dibaca halaman pemohon sebagai bukti hasilnya sah.
update public.hc_requests
set status = 'terlaksana',
    hasil = jsonb_set(
      jsonb_set(hasil::jsonb, '{accAt}', to_jsonb(now()::text)),
      '{accByName}', '"Sistem — tahap ACC dihapus"'::jsonb
    )
where kind = 'design'
  and status = 'menunggu_atasan'
  and hasil is not null;
