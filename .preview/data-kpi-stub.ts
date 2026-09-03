/**
 * Tiruan lapisan data KPI untuk pratinjau.
 *
 * Yang dibutuhkan komponen dari modul ini hanya TIPE-nya, dan tipe hilang saat
 * dikompilasi. Tanpa tiruan ini, penggabung berkas tetap menarik modul aslinya
 * beserta seluruh rantai server di belakangnya — termasuk yang membaca
 * kredensial basis data. Tidak ada satu pun dari itu yang boleh masuk ke bundel
 * peramban, sekalipun cuma untuk pratinjau di mesin sendiri.
 */
export {};
