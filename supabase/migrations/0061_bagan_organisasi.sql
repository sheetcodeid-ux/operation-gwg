-- Bagan struktur organisasi yang bisa disusun sendiri.
--
-- Sebelumnya struktur organisasi ditulis sebagai kode di `lib/hcmos/struktur.ts`,
-- jadi setiap kali ada divisi baru atau garis pelaporan berubah, aplikasinya
-- harus ditempatkan ulang. Struktur organisasi berubah lebih sering daripada
-- kode seharusnya berubah.
--
-- Menumpang di `user_departments` — bukan tabel baru — karena daftar
-- departemennya sudah dikelola di situ lewat "Kelola Departemen & Jabatan" di
-- User Management. Tabel terpisah berarti dua daftar departemen yang harus
-- disamakan terus-menerus, dan cepat atau lambat keduanya berbeda diam-diam.
alter table public.user_departments add column if not exists level integer;
alter table public.user_departments add column if not exists parent_id text;
-- Urutan dalam satu level, untuk tampilan Per Level.
alter table public.user_departments add column if not exists urutan integer;
-- Posisi bebas hasil geseran di tampilan Bagan. NULL berarti "ikut tata letak
-- otomatis" — itu bedanya dengan 0,0 yang berarti "memang ditaruh di pojok".
alter table public.user_departments add column if not exists pos_x double precision;
alter table public.user_departments add column if not exists pos_y double precision;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_departments_parent_fk') then
    alter table public.user_departments
      add constraint user_departments_parent_fk foreign key (parent_id)
      references public.user_departments(id) on delete set null;
  end if;
end $$;

create index if not exists user_departments_parent_idx on public.user_departments(parent_id) where parent_id is not null;

-- Enam level jabatan GWG Group. Garis pelaporannya SENGAJA dibiarkan kosong:
-- menebak enam puluh garis atasan-bawahan berarti menampilkan bagan yang
-- terlihat resmi padahal karangan, dan bagan yang salah lebih berbahaya
-- daripada bagan yang belum diisi. Pemiliknya yang menyusun sendiri.
insert into public.user_departments (id, name, level, urutan) values
  ('dep_managing-director', 'Managing Director', 1, 0),
  ('dep_executive-assistant', 'Executive Assistant', 2, 0),
  ('dep_internal-audit', 'Internal Audit', 2, 1),
  ('dep_legal', 'Legal', 2, 2),
  ('dep_business-development', 'Business Development', 3, 0),
  ('dep_creative-director', 'Creative Director', 3, 1),
  ('dep_finance-accounting-tax', 'Finance, Accounting Tax', 3, 2),
  ('dep_human-capital', 'Human Capital', 3, 3),
  ('dep_it', 'IT', 3, 4),
  ('dep_marketing', 'Marketing', 3, 5),
  ('dep_operasional', 'Operasional', 3, 6),
  ('dep_procurement', 'Procurement', 3, 7),
  ('dep_product-development', 'Product Development', 3, 8),
  ('dep_supply-chain-dan-warehouse', 'Supply Chain & Warehouse', 3, 9),
  ('dep_accounting-dan-verification', 'Accounting & Verification', 4, 0),
  ('dep_administration', 'Administration', 4, 1),
  ('dep_area-coordinator', 'Area Coordinator', 4, 2),
  ('dep_beverage-development', 'Beverage Development', 4, 3),
  ('dep_brand-dan-marketing-strategy', 'Brand & Marketing Strategy', 4, 4),
  ('dep_business-system', 'Business System', 4, 5),
  ('dep_community-dan-customer-relation', 'Community & Customer Relation', 4, 6),
  ('dep_data-dan-bi-analytics', 'Data & BI Analytics', 4, 7),
  ('dep_digital-marketing', 'Digital Marketing', 4, 8),
  ('dep_driver', 'Driver', 4, 9),
  ('dep_expansion-dan-partnership', 'Expansion & Partnership', 4, 10),
  ('dep_finance', 'Finance', 4, 11),
  ('dep_food-development', 'Food Development', 4, 12),
  ('dep_graphic-designer', 'Graphic Designer', 4, 13),
  ('dep_it-insfrastruktur-dan-support', 'IT Insfrastruktur & Support', 4, 14),
  ('dep_ldand-and-compensation-benefit', 'L&D And Compensation Benefit', 4, 15),
  ('dep_management-investasi', 'Management Investasi', 4, 16),
  ('dep_photo-video', 'Photo/Video', 4, 17),
  ('dep_procurement-dan-purchasing', 'Procurement & Purchasing', 4, 18),
  ('dep_procurement-administration-dan-asset', 'Procurement Administration & Asset', 4, 19),
  ('dep_project-dan-asset-management', 'Project & Asset Management', 4, 20),
  ('dep_purchasing-dan-sales', 'Purchasing & Sales', 4, 21),
  ('dep_quality-assurance-dan-control', 'Quality Assurance & Control', 4, 22),
  ('dep_software-development', 'Software Development', 4, 23),
  ('dep_strategic-sourcing-vendor-dan-contract', 'Strategic Sourcing Vendor & Contract', 4, 24),
  ('dep_system-support', 'System Support', 4, 25),
  ('dep_talent-aquisition', 'Talent Aquisition', 4, 26),
  ('dep_tax', 'Tax', 4, 27),
  ('dep_treasury', 'Treasury', 4, 28),
  ('dep_warehouse-management', 'Warehouse Management', 4, 29),
  ('dep_admin-purchasing', 'Admin Purchasing', 5, 0),
  ('dep_admin-sales', 'Admin Sales', 5, 1),
  ('dep_ar-staff', 'AR Staff', 5, 2),
  ('dep_beverage-staff', 'Beverage Staff', 5, 3),
  ('dep_design', 'Design', 5, 4),
  ('dep_food-staff', 'Food Staff', 5, 5),
  ('dep_project', 'Project', 5, 6),
  ('dep_social-media', 'Social Media', 5, 7),
  ('dep_supervisor-outlet', 'Supervisor Outlet', 5, 8),
  ('dep_system-support-staff', 'System Support - Staff', 5, 9),
  ('dep_warehouse-basah', 'Warehouse Basah', 5, 10),
  ('dep_warehouse-kering', 'Warehouse Kering', 5, 11),
  ('dep_beverage-trainer', 'Beverage Trainer', 6, 0),
  ('dep_food-trainer', 'Food Trainer', 6, 1),
  ('dep_packing-dan-helper-basah', 'Packing & Helper Basah', 6, 2),
  ('dep_packing-dan-helper-kering', 'Packing & Helper Kering', 6, 3),
  ('dep_staff-outlet', 'Staff Outlet', 6, 4)
on conflict (id) do update set level = excluded.level, urutan = excluded.urutan;
