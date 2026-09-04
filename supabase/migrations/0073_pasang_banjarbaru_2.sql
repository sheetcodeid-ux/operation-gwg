-- Memasang "Nordu Banjarbaru 2" ke cabang ESB 55-fnb_nord.
--
-- Pekerjaan pemasangan otomatis sengaja melewatkan outlet ini: di ESB ADA DUA
-- cabang yang namanya sama setelah diseragamkan — "Nordu Banjarbaru 2"
-- (55-fnb_nord) dan "Nordu Banjarbaru 2 -" (57-fnb_nord) — dan memilih yang
-- pertama sama saja dengan memilih secara acak.
--
-- Dipilih 55 karena angkanya yang berbicara: rata-rata net sales Rp 24,7 juta
-- per hari, setara outlet ramai lain (Putussibau 21,4 juta, Banjarbaru 19,3
-- juta), sedangkan 57 hanya Rp 1,9 juta per hari dan terus turun sampai Rp 344
-- ribu pada 14 Agustus — bentuk cabang lama yang sedang dimatikan. Dikonfirmasi
-- pemiliknya sebelum ditulis.
update public.outlets
   set esb_branch_id = '55-fnb_nord'
 where name = 'Nordu Banjarbaru 2' and esb_branch_id is null;
