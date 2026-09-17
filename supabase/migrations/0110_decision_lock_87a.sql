-- Operational V.1 · TASK #87A — DECISION LOCK.
--
-- ┌─ TIGA ANGKA YANG TIDAK PERNAH JADI KEPUTUSAN ────────────────────────────┐
-- │                                                                          │
-- │ `listrik_persen` 4%, `air_persen` 1%, `internet_persen` 1% tersemai di    │
-- │ `0109` dengan sumber yang jujur menyebut asalnya: prompt TASK #87.        │
-- │ Audit #87A menegaskan angka itu tidak ada di `op_settings`, tidak ada di  │
-- │ `blueprint.md`, tidak ada di `decisions.md`. Pemiliknya lalu memutuskan   │
-- │ TUNDA: tidak ada ambang resmi untuk ketiganya.                            │
-- │                                                                          │
-- │ Sebuah angka yang tidak pernah diputuskan siapa pun tidak boleh punya     │
-- │ kekuatan menilai.                                                        │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ MENONAKTIFKAN, BUKAN MENGHAPUS ─────────────────────────────────────────┐
-- │                                                                          │
-- │ `rule_versions` dan `rule_conditions` TIDAK DISENTUH sama sekali — baris  │
-- │ versinya tetap ada beserta ambang 4/1/1 dan `sumber`-nya. Justru kalimat  │
-- │ sumber itulah buktinya: ia menyebut asalnya prompt, bukan keputusan.      │
-- │ Menghapusnya akan menghilangkan satu-satunya jejak bahwa angka itu        │
-- │ pernah ada dan ditarik.                                                   │
-- │                                                                          │
-- │ Dua jalan lain sengaja tidak dipakai:                                     │
-- │                                                                          │
-- │   DELETE        — ditolak pemicu, dan memang seharusnya                   │
-- │   berlaku_sampai — akan menyatakan "sah dari 2026-08 sampai X", padahal   │
-- │                    ia tidak pernah sah sehari pun. Itu menulis sejarah    │
-- │                    yang keliru.                                          │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Pembacanya sudah siap: `bacaKatalogAturan()` menyaring `aktif = true`, lalu
-- melewati versi milik rule yang tidak aktif. Ketiga KPI itu kembali
-- `tanpa_aturan` — bukan `aman`, sebab belum pernah dinilai.
--
-- TIDAK ADA HASIL PENILAIAN YANG BERUBAH HARI INI. Seluruh 354 baris
-- Electricity/Water/Internet di Agustus dan September berstatus
-- `tidak_tersedia` — `op_expenses.utilitas` masih satu kolom tunggal (AD-03),
-- jadi ketiga ambang ini belum pernah menilai satu angka pun. Yang ditutup
-- adalah masa depan: begitu kolom utilitas dipecah, angka yang tidak pernah
-- dikukuhkan itu akan langsung mulai menghakimi.
--
-- Pengukuhan kelak lewat jalur normal: kalau 4/1/1 yang disetujui, cukup
-- `aktif = true`; kalau angka lain, ia jadi v2 dengan rentang v1 ditutup.
-- Tidak ada sejarah yang perlu dihapus untuk itu.
--
-- Lihat AD-13 · docs/operational-v1/decisions.md

update rules
   set aktif   = false,
       catatan = 'DECISION LOCK #87A (17 September 2026): TUNDA — tidak ada threshold resmi. '
                 || 'Angka dari prompt TASK #87, bukan keputusan bisnis. Versi dan syaratnya '
                 || 'sengaja TIDAK dihapus supaya jejaknya tetap terbaca. Lihat AD-13.'
 where kode in ('listrik_persen', 'air_persen', 'internet_persen')
   and aktif;
