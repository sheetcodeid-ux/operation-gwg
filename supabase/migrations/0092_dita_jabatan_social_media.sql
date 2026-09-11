-- Dita masuk tim Sosial Media, atas keputusan pemiliknya.
--
-- Yang membuka sidebar Sosial Media adalah JABATAN, bukan departemen. Marta
-- dan Zia sudah berjabatan "Social Media" dan otomatis mendapatkannya; Dita
-- masih tercatat "Digital Marketing", jadi sidebarnya tidak pernah muncul
-- untuknya meski ia disebut sebagai anggotanya.
--
-- DEPARTEMENNYA TIDAK DIUBAH. Ketiganya tetap Marketing Communication:
-- memindahkan departemen berarti memindahkan nilainya keluar dari rata-rata
-- KPI Marketing Communication, dan itu keputusan terpisah yang belum diminta.
update public.users
set jabatan = 'Social Media'
where id = 'usr_a70f145c-4c70-4214-b2cc-9a660286eca6'
  and lower(name) = 'dita';
