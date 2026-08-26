-- Kunci asing `hc_raci.updated_by` tanpa indeks penutup.
--
-- Selama tabelnya kecil dampaknya tidak terasa pada RACI-nya sendiri. Yang
-- terasa ada di sisi lain: setiap penghapusan atau perubahan baris `users`
-- harus memindai seluruh `hc_raci` untuk memastikan tidak ada yang menunjuk ke
-- sana. Menambahkannya sekarang jauh lebih murah daripada menambahkannya
-- setelah matriksnya terisi penuh.
create index if not exists hc_raci_updated_by_idx on public.hc_raci (updated_by);
