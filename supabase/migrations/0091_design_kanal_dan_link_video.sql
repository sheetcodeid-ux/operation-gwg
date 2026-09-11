-- Pengajuan design dipecah menurut FORMNYA, bukan menurut departemen pemohon.
--
-- Sebelumnya antrian dipisah dengan menebak: pengajuan dari Marketing
-- Communication dianggap materi konten, sisanya materi operasional. Tebakan itu
-- salah di dua arah — MarComm juga meminta poster cetak, dan tim lain juga
-- meminta materi untuk diunggah. Yang menentukan sekarang form mana yang
-- dipakai, dan itu keputusan pemohonnya sendiri, bukan kesimpulan aplikasi.
--
-- Kolomnya diberi nilai bawaan 'umum' supaya baris lama tidak menjadi kosong:
-- pengajuan yang sudah ada semuanya lewat form lama, dan itu memang pengajuan
-- umum.
alter table public.hc_requests
  add column if not exists design_kanal text not null default 'umum',
  -- Video tidak bisa diunggah: satu file mentah gampang melewati 100 MB, dan
  -- yang mengerjakannya tetap perlu membukanya di tempat aslinya. Yang dicatat
  -- tautannya — Drive, YouTube, atau folder mana pun yang dipakai timnya.
  add column if not exists design_link_video text;

comment on column public.hc_requests.design_kanal is 'Form asal pengajuan design: umum (seluruh departemen) atau sosmed (Sosial Media).';
comment on column public.hc_requests.design_link_video is 'Tautan materi video — hanya pada pengajuan Sosial Media.';

create index if not exists hc_requests_design_kanal_idx
  on public.hc_requests (design_kanal)
  where kind = 'design';
