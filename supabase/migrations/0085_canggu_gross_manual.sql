-- Nordu Coffee Canggu baru masuk ESB pada Agustus 2026.
--
-- ESB sudah mencatat angka sejak Juni (Rp 108.000 dari 3 bill) dan Juli
-- (Rp 10,4 jt dari 154 bill), tapi itu bukan omzet sebenarnya — kasir baru
-- dipasang sebagian. Angka kecil yang tampak masuk akal justru yang berbahaya:
-- tidak ada yang mencurigainya, dan outletnya diam-diam menyeret rata-rata.
--
-- `esb_mulai` menandai batasnya: seluruh bulan sebelum Agustus memakai angka
-- ketikan, Agustus dan seterusnya otomatis. `gross_manual` membuat outletnya
-- muncul di form Gross Sales Manual supaya Mei-Juli bisa diisi tangan.
update outlets
   set esb_mulai = '2026-08',
       gross_manual = true
 where esb_branch_id = '51-fnb_nord';
