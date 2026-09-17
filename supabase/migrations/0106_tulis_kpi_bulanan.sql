-- Operational V.1 · TASK #85 — penulisan KPI bulanan yang berversi dan utuh.
--
-- ┌─ KENAPA INI SEBUAH FUNGSI BASIS DATA ────────────────────────────────────┐
-- │                                                                          │
-- │ Klien data aplikasi ini PostgREST (`src/lib/data/db.ts`), dan PostgREST  │
-- │ tidak punya transaksi lintas-pernyataan. Menulis `kpi_values` lalu       │
-- │ `targets` lewat dua panggilan berarti panggilan pertama sudah ter-commit │
-- │ ketika yang kedua gagal — KPI sudah naik ke versi baru sementara         │
-- │ targetnya masih versi lama, dan tidak ada satu pun layar yang            │
-- │ menunjukkannya. Generasi setengah jadi seperti itu lebih berbahaya       │
-- │ daripada generasi yang gagal seluruhnya, karena ia terlihat berhasil.    │
-- │                                                                          │
-- │ Jadi seluruh penulisan dipindahkan ke SATU fungsi: satu transaksi, satu  │
-- │ kunci, satu nomor versi.                                                 │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- TIDAK ADA SATU PUN RUMUS KPI DI SINI. Angkanya sudah jadi ketika sampai —
-- dihitung `hitungSales()`, `hitungTargetSales()`, dan `hitungKeuangan()` di
-- TypeScript, mesin yang sama dengan yang dipakai Phase 2A dan 2C. Fungsi ini
-- hanya mengurus tiga hal yang memang milik basis data: versi, keutuhan, dan
-- tabrakan antar-jalan.
--
-- ┌─ IDENTITAS BERBASIS ISI ─────────────────────────────────────────────────┐
-- │                                                                          │
-- │ Dua jalan dianggap sama bila HASILNYA sama, bukan bila kunci buatan      │
-- │ tertentu sama. Kunci buatan bisa gagal menangkap masukan yang berubah,   │
-- │ dan kegagalan seperti itu tidak kelihatan dari mana pun. Perbandingan    │
-- │ isi tidak bisa salah menurut definisinya: kalau masukan berubah tapi     │
-- │ angkanya tidak, tidak membuat versi baru memang yang benar.              │
-- │                                                                          │
-- │ Akibatnya cron yang memanggil dua kali dalam satu hari WIB adalah        │
-- │ no-op — bukan versi 4, 5, 6.                                             │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Cakupannya SATU PERIODE saja, dan periodenya disebut pemanggil. Bulan lain
-- tidak pernah tersentuh — termasuk Agustus 2026 yang sudah final dari
-- TASK #86.

create or replace function public.gwg_tulis_kpi_bulanan(
  p_periode text,
  p_nilai   jsonb,
  p_target  jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_versi        integer;
  v_sidik_masuk  text;
  v_sidik_lama   text;
  v_sidik_tmasuk text;
  v_sidik_tlama  text;
  v_nilai_lama   integer;
  v_target_lama  integer;
  v_nilai_baru   integer;
  v_target_baru  integer;
begin
  if p_periode !~ '^\d{4}-\d{2}$' then
    raise exception 'periode harus berbentuk YYYY-MM, bukan %', p_periode;
  end if;

  -- Satu jalan per periode. Jalan kedua yang berbarengan menunggu di sini,
  -- lalu melihat hasil jalan pertama sudah tersimpan dan jatuh ke jalur
  -- no-op. Terikat transaksi, jadi lepas sendiri apa pun yang terjadi —
  -- tidak ada yang bisa terkunci selamanya.
  perform pg_advisory_xact_lock(hashtext('gwg_kpi_bulanan'), hashtext(p_periode));

  -- `drop table if exists` di bawah selalu berbunyi NOTICE pada panggilan
  -- pertama, dan bunyi itu ikut sampai ke log rute cron tiap kali ia berjalan.
  -- Peringatan yang muncul pada jalan yang SEHAT adalah cara tercepat membuat
  -- orang berhenti membaca log.
  perform set_config('client_min_messages', 'warning', true);

  -- `on commit drop` baru melepas tabelnya saat COMMIT, bukan saat fungsinya
  -- selesai. Dua panggilan di dalam SATU transaksi karena itu bertabrakan di
  -- nama yang sama — "relation masuk_nilai already exists" — dan generasi kedua
  -- gagal karena alasan yang tidak ada hubungannya dengan datanya. Ditemukan
  -- uji basis data, bukan produksi.
  drop table if exists masuk_nilai;
  drop table if exists masuk_target;

  create temp table masuk_nilai on commit drop as
  select x.kpi, x.cakupan, x.outlet_id, x.area_id, x.nilai, x.status, x.sumber,
         x.rumus, x.rumus_versi, x.sumber_sah, x.kelengkapan_persen, x.jumlah_hari, x.catatan,
         coalesce(x.outlet_id, x.area_id, '~korporat') as cakupan_id
  from jsonb_to_recordset(coalesce(p_nilai, '[]'::jsonb)) as x(
    kpi text, cakupan text, outlet_id text, area_id text, nilai numeric, status text,
    sumber text, rumus text, rumus_versi integer, sumber_sah boolean,
    kelengkapan_persen numeric, jumlah_hari integer, catatan text
  );

  create temp table masuk_target on commit drop as
  select x.kpi, x.cakupan, x.outlet_id, x.area_id, x.nilai, x.sumber,
         x.rumus, x.rumus_versi, x.dasar,
         coalesce(x.outlet_id, x.area_id, '~korporat') as cakupan_id
  from jsonb_to_recordset(coalesce(p_target, '[]'::jsonb)) as x(
    kpi text, cakupan text, outlet_id text, area_id text, nilai numeric,
    sumber text, rumus text, rumus_versi integer, dasar jsonb
  );

  -- Muatan kosong DITOLAK. Kalau diteruskan, seluruh baris terkini periode ini
  -- akan dipensiunkan tanpa ada penggantinya — dan periodenya jadi kosong
  -- tanpa satu pun pesan.
  if (select count(*) from masuk_nilai) = 0 then
    raise exception 'muatan KPI kosong untuk periode % — tidak ada yang ditulis', p_periode;
  end if;

  /* ── sidik isi: yang masuk versus yang sekarang terkini ── */

  select md5(coalesce(string_agg(t, chr(10) order by t collate "C"), '')) into v_sidik_masuk
  from (
    select m.kpi || '|' || m.cakupan || '|' || m.cakupan_id || '|' ||
           coalesce(m.nilai::text, '') || '|' || m.status || '|' || coalesce(m.catatan, '') as t
    from masuk_nilai m
  ) z;

  select md5(coalesce(string_agg(t, chr(10) order by t collate "C"), '')), count(*)
    into v_sidik_lama, v_nilai_lama
  from (
    select v.kpi_definition_id || '|' || v.cakupan || '|' || v.cakupan_id || '|' ||
           coalesce(v.nilai::text, '') || '|' || v.status || '|' || coalesce(v.catatan, '') as t
    from kpi_values v
    where v.periode = p_periode and v.skala = 'bulanan' and v.terkini
  ) z;

  select md5(coalesce(string_agg(t, chr(10) order by t collate "C"), '')) into v_sidik_tmasuk
  from (
    select m.kpi || '|' || m.cakupan || '|' || m.cakupan_id || '|' || m.nilai::text as t
    from masuk_target m
  ) z;

  select md5(coalesce(string_agg(t, chr(10) order by t collate "C"), '')), count(*)
    into v_sidik_tlama, v_target_lama
  from (
    select g.kpi_definition_id || '|' || g.cakupan || '|' || g.cakupan_id || '|' || g.nilai::text as t
    from targets g
    where g.periode = p_periode and g.skala = 'bulanan' and g.terkini
  ) z;

  -- Hasilnya persis sama dengan yang sudah tersimpan: tidak ada yang perlu
  -- ditulis, dan tidak ada versi baru yang perlu dilahirkan.
  if v_sidik_masuk = v_sidik_lama and v_sidik_tmasuk = v_sidik_tlama then
    return jsonb_build_object(
      'periode', p_periode,
      'berubah', false,
      'versi', (select coalesce(max(versi), 0) from kpi_values where periode = p_periode and skala = 'bulanan' and terkini),
      'nilai_disisipkan', 0,
      'nilai_digantikan', 0,
      'target_disisipkan', 0,
      'target_digantikan', 0,
      'nilai_terkini', v_nilai_lama,
      'target_terkini', v_target_lama
    );
  end if;

  /* ── berubah: pensiunkan yang lama, sisipkan versi berikutnya ── */

  v_versi := greatest(
    coalesce((select max(versi) from kpi_values where periode = p_periode and skala = 'bulanan'), 0),
    coalesce((select max(versi) from targets     where periode = p_periode and skala = 'bulanan'), 0)
  ) + 1;

  -- URUTANNYA WAJIB: pensiunkan dulu, sisipkan kemudian. Dibalik, index parsial
  -- `kpi_values_terkini_unik` menolak barisnya karena yang lama masih terkini.
  update kpi_values set terkini = false
   where periode = p_periode and skala = 'bulanan' and terkini;

  update targets set terkini = false, status = 'diganti'
   where periode = p_periode and skala = 'bulanan' and terkini;

  insert into kpi_values
    (kpi_definition_id, cakupan, outlet_id, area_id, periode, skala, nilai, status,
     sumber, rumus, rumus_versi, sumber_sah, kelengkapan_persen, jumlah_hari,
     versi, terkini, catatan)
  select m.kpi, m.cakupan, m.outlet_id, m.area_id, p_periode, 'bulanan', m.nilai, m.status,
         m.sumber, m.rumus, m.rumus_versi, coalesce(m.sumber_sah, true), m.kelengkapan_persen, m.jumlah_hari,
         v_versi, true, m.catatan
  from masuk_nilai m;
  get diagnostics v_nilai_baru = row_count;

  insert into targets
    (kpi_definition_id, cakupan, outlet_id, area_id, periode, skala, nilai,
     sumber, rumus, rumus_versi, dasar, status, versi, terkini)
  select m.kpi, m.cakupan, m.outlet_id, m.area_id, p_periode, 'bulanan', m.nilai,
         m.sumber, m.rumus, m.rumus_versi, m.dasar, 'berlaku', v_versi, true
  from masuk_target m;
  get diagnostics v_target_baru = row_count;

  return jsonb_build_object(
    'periode', p_periode,
    'berubah', true,
    'versi', v_versi,
    'nilai_disisipkan', v_nilai_baru,
    'nilai_digantikan', v_nilai_lama,
    'target_disisipkan', v_target_baru,
    'target_digantikan', v_target_lama,
    'nilai_terkini', v_nilai_baru,
    'target_terkini', v_target_baru
  );
end;
$$;

comment on function public.gwg_tulis_kpi_bulanan(text, jsonb, jsonb) is
  'Penulisan KPI bulanan berversi untuk satu periode: satu transaksi, kunci per periode, dan no-op bila hasilnya sama dengan yang sudah tersimpan. Tidak memuat rumus KPI.';

-- Hak jalannya dicabut dari `public`, `anon`, dan `authenticated`. `authenticated`
-- disebut TERPISAH karena Supabase memberi hak itu secara bawaan untuk fungsi
-- baru di skema public — mencabut dari `public` saja tidak cukup, dan sisanya
-- akan ditandai linter sebagai SECURITY DEFINER yang bisa dijalankan siapa pun
-- yang sudah login. Yang boleh memanggilnya hanya lapisan data aplikasi.
revoke all on function public.gwg_tulis_kpi_bulanan(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.gwg_tulis_kpi_bulanan(text, jsonb, jsonb) to service_role;
