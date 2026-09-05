-- Harga pokok penjualan disimpan dalam RUPIAH, bukan persen.
--
-- Persen yang diketik tidak bisa diperiksa ulang terhadap apa pun: kalau
-- seseorang mengetik 37,5 sementara angka sebenarnya 41, tidak ada satu pun
-- data lain yang bisa membantahnya. Nominal bisa — persentasenya dihitung
-- sendiri terhadap gross sales, dan keduanya tampil berdampingan sehingga
-- selisih yang tidak masuk akal langsung kelihatan.
--
-- Aman diubah begitu saja: tabelnya masih kosong saat ini.
alter table public.kpi_outlet_bulanan rename column hpp to hpp_nominal;

comment on column public.kpi_outlet_bulanan.hpp_nominal is
  'Harga pokok penjualan dalam RUPIAH. Persentasenya dihitung terhadap gross sales, bukan diketik.';
