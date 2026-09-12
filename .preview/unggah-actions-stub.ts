/**
 * Tiruan aksi unggah data untuk pratinjau.
 *
 * Aksi aslinya menarik seluruh lapisan server — termasuk penulis basis data.
 * Pratinjau hanya untuk melihat tampilannya; tidak ada yang boleh benar-benar
 * tersimpan dari sini.
 */
export const simpanUnggahAction = async () => ({ error: "Pratinjau — tidak menyimpan apa pun." });
