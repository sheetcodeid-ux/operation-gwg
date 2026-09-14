/**
 * Berkas logo tiap merek — SATU TEMPAT, supaya menambahkannya satu baris.
 *
 * Kosong berarti kartunya memakai huruf depan merek di atas warnanya sendiri.
 * Itu bukan tempat kosong menunggu gambar: huruf berwarna sudah membedakan
 * keempat kartu dari kejauhan, jadi halamannya utuh sejak hari pertama dan
 * logonya bisa menyusul kapan pun tanpa mengubah apa pun selain berkas ini.
 *
 * Cara menambah: taruh berkasnya di `public/merek/`, lalu tulis jalurnya di
 * sini, mis. `Nordu: "/merek/nordu.png"`. Ukuran yang dipakai 28×28 piksel dan
 * dipotong bulat, jadi logo persegi dengan ruang kosong di tepinya paling rapi.
 */
export const LOGO_MEREK: Record<string, string> = {};
