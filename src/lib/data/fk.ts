/**
 * Nilai untuk kolom yang menunjuk ke tabel lain (kunci asing).
 *
 * String kosong BUKAN id — ia berarti "tidak dipilih". Tapi bagi Postgres ia
 * tetap sebuah nilai, dan karena tidak ada baris ber-id string kosong di tabel
 * tujuan, kunci asingnya menolak seluruh penyimpanan.
 *
 * Itu benar-benar terjadi: sebuah tiket IT Help Desk diajukan tanpa memilih
 * cabang, formulirnya menyimpan `''`, dan saat tiket itu hendak diteruskan ke
 * Work Tracker penyimpanannya gagal dengan pesan "Gagal menyimpan ke database".
 * Tiketnya tidak bisa diproses sama sekali, dan tidak ada satu pun petunjuk di
 * layar bahwa penyebabnya adalah cabang yang tidak diisi.
 *
 * Dinormalkan di tempat-tempat yang dilewati SELURUH penulisan — bukan di
 * masing-masing pemanggil. Pemanggil berikutnya yang lupa akan aman dengan
 * sendirinya, dan itulah bedanya memperbaiki penyebab dengan menambal gejala.
 */
export const fk = (v: string | null | undefined): string | null => (v ? v : null);
