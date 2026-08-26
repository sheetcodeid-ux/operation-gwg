-- Kontrak karyawan Manajemen — yang tidak punya outlet.
--
-- `outlet_id` selama ini NOT NULL, jadi Kontrak Tracker hanya bisa memuat
-- karyawan cabang. Karyawan kantor pusat dan gudang — Office & Warehouse —
-- tidak punya outlet sama sekali, sehingga kontrak mereka TIDAK BISA dicatat
-- di sini dengan cara apa pun. Yang terjadi kemudian bisa ditebak: masa
-- berlaku kontrak mereka dipantau di luar aplikasi, dan satu-satunya modul
-- yang seharusnya menjawab "siapa kontraknya habis bulan depan" menjawabnya
-- hanya untuk sebagian orang.
--
-- NULL di sini berarti "Manajemen", bukan "belum diisi". Itu sebabnya kolomnya
-- dilonggarkan alih-alih diberi outlet palsu bernama "Kantor Pusat": outlet
-- palsu akan ikut terhitung di rekap cabang, di Update Bulanan Supervisor, dan
-- di setiap angka yang membagi sesuatu per outlet.

alter table public.hc_contracts alter column outlet_id drop not null;

-- Baris Manajemen dibaca terpisah dari baris cabang, jadi ia perlu jalurnya
-- sendiri; tanpa ini pembacaannya memindai seluruh tabel.
create index if not exists hc_contracts_manajemen_idx
  on public.hc_contracts (nama)
  where outlet_id is null;

comment on column public.hc_contracts.outlet_id is
  'Outlet karyawan ini. NULL berarti karyawan Manajemen (kantor pusat / gudang) yang memang tidak terikat outlet mana pun.';

-- Ketiga kolom "link" kini juga menampung berkas yang diunggah langsung.
comment on column public.hc_contracts.link_kontrak is
  'Berkas kontrak: path penyimpanan (r2:…) bila diunggah dari aplikasi, atau URL apa adanya untuk baris lama yang ditempel manual.';
