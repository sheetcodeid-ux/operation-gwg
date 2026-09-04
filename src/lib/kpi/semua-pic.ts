/**
 * Nilai khusus "seluruh PIC" pada saringan KPI.
 *
 * Ditaruh di berkasnya sendiri supaya bisa dipakai komponen di peramban tanpa
 * ikut menarik seluruh lapisan data — berkas itu membaca kredensial basis data,
 * dan menariknya ke peramban bukan sekadar memberatkan.
 *
 * Bukan string kosong: kosong sudah berarti "posisi ini dinilai satu tim", dan
 * memakai satu nilai untuk dua hal yang berbeda membuat penjagaan di server
 * tidak bisa membedakan mana yang mana.
 */
export const SEMUA_PIC = "__semua__";
