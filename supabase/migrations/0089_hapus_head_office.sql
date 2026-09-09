-- HEAD OFFICE bukan outlet.
--
-- Ia terdaftar di tabel outlets dan ikut terhitung sebagai satu dari 58 outlet
-- aktif, padahal tidak berjualan: omzetnya nol di SELURUH bulan, tidak punya
-- satu pun baris KPI bulanan, dan tidak punya satu pun entri kegiatan. Yang
-- ditimbulkannya bukan sekadar baris kosong — ia ikut ditagih laporan bulanan
-- Kontrak Tracker, dan pemberitahuan "HEAD OFFICE belum mengirim laporan
-- bulanan" itulah bukti bahwa aplikasinya memperlakukannya sebagai outlet.
--
-- Dihapus, bukan dinonaktifkan, atas keputusan pemiliknya. Pemberitahuan yang
-- menunjuk kepadanya ikut dihapus lebih dulu: ia hanya masuk akal selama HEAD
-- OFFICE dianggap outlet, dan membiarkannya berarti menyisakan tagihan untuk
-- outlet yang sudah tidak ada. HEAD OFFICE tidak ada di data awal aplikasi,
-- jadi ia tidak akan muncul lagi saat boot.
delete from public.notifications
where outlet_id = 'out_a15d3631-b4f5-4a26-a578-95d2d7c1d144';

delete from public.outlets
where id = 'out_a15d3631-b4f5-4a26-a578-95d2d7c1d144'
  and upper(name) = 'HEAD OFFICE';
