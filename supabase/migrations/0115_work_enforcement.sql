-- Operational V.1 · Z-02 / STEP 2A — penjaga invariant lapisan Work.
--
-- ┌─ KENAPA TRIGGER, PADAHAL SUDAH ADA FUNGSI PENULIS ───────────────────────┐
-- │                                                                          │
-- │ Data layer memakai service role, dan service role bisa menulis langsung  │
-- │ ke tabel mana pun tanpa melewati fungsi. Jaminan yang hanya hidup di     │
-- │ dalam fungsi penulis karena itu bukan jaminan — ia anjuran yang kebetulan│
-- │ selalu diikuti sampai suatu hari tidak.                                  │
-- │                                                                          │
-- │ Yang di berkas ini menolak di lapisan yang tidak bisa dilewati siapa pun.│
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ YANG SENGAJA TIDAK DIJAGA DI SINI ──────────────────────────────────────┐
-- │                                                                          │
-- │ Trio pelepasan (`dilepas_pada`/`dilepas_oleh`/`alasan`), kelengkapan     │
-- │ departemen, daftar status, daftar kategori tenggat, keunikan pasangan    │
-- │ Signal–Work dan Executor — seluruhnya sudah dijamin CHECK, PK, dan FK di │
-- │ `0114_work_signal.sql`. Menambahkan trigger untuk hal yang sama berarti  │
-- │ dua penjaga untuk satu aturan, dan yang kedua akan menyimpang diam-diam. │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Lihat AD-19 · docs/operational-v1/decisions.md — I-01 · I-03 · I-04 · I-11 ·
-- I-16 · I-17 · I-18 · I-19 · I-20.

/* ───────────── works · mutasi tercatat, snapshot beku, owner bukan pelaksana ───────────── */

-- ┌─ SATU FUNGSI UNTUK TIGA URUSAN, DAN ITU DISENGAJA ───────────────────────┐
-- │                                                                          │
-- │ Ketiganya menyala pada peristiwa yang sama: BEFORE UPDATE pada `works`.  │
-- │ Dipecah jadi tiga trigger, urutan jalannya ditentukan abjad namanya —    │
-- │ dan pesan galat yang muncul jadi bergantung pada nama, bukan pada mana   │
-- │ yang paling penting diberitahukan lebih dulu.                            │
-- └──────────────────────────────────────────────────────────────────────────┘
create or replace function works_mutasi_tercatat()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_xid xid := pg_current_xact_id()::xid;
  v_ada integer;
begin
  /* ── T-G · snapshot perhitungan tenggat tidak pernah bergeser (I-11) ──
   *
   * Diperiksa PALING DULU. Kalau kebijakan tenggat berubah bulan depan dan
   * snapshot ini ikut ditulis ulang, seluruh Work lama berpindah tenggat
   * tanpa seorang pun melakukan apa pun — dan "terlambat" berubah jadi
   * "tepat waktu" dengan sendirinya. Tenggatnya sendiri BOLEH digeser orang;
   * yang tidak boleh adalah menghapus jejak perhitungan aslinya. */
  if new.tenggat_anchor          is distinct from old.tenggat_anchor
     or new.tenggat_anchor_pada  is distinct from old.tenggat_anchor_pada
     or new.tenggat_zona         is distinct from old.tenggat_zona
     or new.tenggat_kebijakan_versi is distinct from old.tenggat_kebijakan_versi then
    raise exception 'snapshot perhitungan tenggat work % tidak boleh diubah — ia yang membedakan tenggat hasil kebijakan dari tenggat yang digeser orang', old.id;
  end if;

  /* ── T-A arah kedua · owner tidak boleh merangkap pelaksana (I-03) ──
   *
   * Arah pertamanya dijaga `work_executors_bukan_owner`. Tanpa arah ini,
   * aturan yang sama bisa dilanggar dari sisi sebaliknya: tinggal jadikan
   * pelaksana yang sudah ada sebagai owner, dan yang menanggung sama dengan
   * yang dinilai. */
  if new.owner_id is distinct from old.owner_id then
    select count(*) into v_ada
      from work_executors e
     where e.work_id = old.id and e.user_id = new.owner_id and e.dilepas_pada is null;
    if v_ada > 0 then
      raise exception 'owner baru work % masih menjadi pelaksana aktif — yang menanggung tidak boleh merangkap yang mengerjakan', old.id;
    end if;
  end if;

  /* ── T-F · tiga mutasi yang wajib meninggalkan jejak (I-19, I-20) ──
   *
   * ┌─ KENAPA "DI TRANSAKSI YANG SAMA", BUKAN SEKADAR "ADA" ──────────────┐
   * │                                                                     │
   * │ Riwayat yang ditanam kemarin akan mengesahkan mutasi hari ini kalau │
   * │ yang diperiksa cuma keberadaannya. `xmin` baris riwayat mengikat    │
   * │ pemeriksaan ini pada transaksi yang sedang berjalan, jadi jejaknya  │
   * │ lahir bersama perubahannya — atau tidak ada perubahan sama sekali.  │
   * │                                                                     │
   * │ Akibatnya penulis WAJIB menyisipkan riwayat LEBIH DULU, baru        │
   * │ memperbarui `works`. Trigger BEFORE tidak bisa melihat baris yang   │
   * │ belum ada; urutan terbalik akan ditolak, dan itu memang maksudnya.  │
   * └─────────────────────────────────────────────────────────────────────┘ */
  if new.owner_id is distinct from old.owner_id then
    select count(*) into v_ada
      from work_riwayat r
     where r.work_id = old.id
       and r.jenis = 'owner'
       and r.nilai_lama is not distinct from old.owner_id
       and r.nilai_baru = new.owner_id
       and coalesce(trim(r.alasan), '') <> ''
       and r.xmin = v_xid;
    if v_ada = 0 then
      raise exception 'perubahan owner work % wajib disertai riwayat beralasan pada transaksi yang sama', old.id;
    end if;
  end if;

  if new.primary_department is distinct from old.primary_department then
    select count(*) into v_ada
      from work_riwayat r
     where r.work_id = old.id
       and r.jenis = 'departemen'
       and r.nilai_lama is not distinct from old.primary_department
       and r.nilai_baru = new.primary_department
       and coalesce(trim(r.alasan), '') <> ''
       and r.xmin = v_xid;
    if v_ada = 0 then
      raise exception 'perubahan departemen work % wajib disertai riwayat beralasan pada transaksi yang sama', old.id;
    end if;
  end if;

  -- Tenggat dibandingkan sebagai WAKTU, bukan sebagai teks: format teks
  -- bergantung `DateStyle`, dan dua penulis dengan setelan berbeda akan
  -- menghasilkan dua ejaan untuk satu titik waktu yang sama.
  if new.tenggat is distinct from old.tenggat then
    select count(*) into v_ada
      from work_riwayat r
     where r.work_id = old.id
       and r.jenis = 'tenggat'
       and r.nilai_lama::timestamptz is not distinct from old.tenggat
       and r.nilai_baru::timestamptz = new.tenggat
       and coalesce(trim(r.alasan), '') <> ''
       and r.xmin = v_xid;
    if v_ada = 0 then
      raise exception 'perubahan tenggat work % wajib disertai riwayat beralasan pada transaksi yang sama', old.id;
    end if;
  end if;

  return new;
end;
$$;

create or replace trigger works_mutasi_tercatat_trg
  before update on works
  for each row execute function works_mutasi_tercatat();

/* ───────────── work_executors · bukan owner, dan tidak boleh habis ───────────── */

create or replace function work_executors_terjaga()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_owner text;
  v_sisa  integer;
begin
  /* ── T-A arah pertama · pelaksana bukan owner (I-03) ── */
  if tg_op = 'INSERT' or new.user_id is distinct from old.user_id or new.dilepas_pada is null then
    select w.owner_id into v_owner from works w where w.id = new.work_id;
    if v_owner = new.user_id then
      raise exception 'orang yang menanggung work % tidak boleh sekaligus mengerjakannya — pekerjaan yang ditutup sendiri oleh pelaksananya tidak pernah diperiksa siapa pun', new.work_id;
    end if;
  end if;

  /* ── T-C · pelaksana aktif terakhir tidak boleh dilepas (I-04, I-18) ──
   *
   * Advisory lock DIPERLUKAN di sini, dan alasannya berbeda dari `works`:
   * yang dihitung baris LAIN, bukan baris yang sedang dikunci. Tanpa kunci,
   * dua pelepasan bersamaan sama-sama melihat masih ada sisa, lalu keduanya
   * lolos — dan Work berakhir tanpa satu pelaksana pun. Polanya sama dengan
   * `rule_versions_tanpa_tumpang` di `0109_rule_versioning.sql`. */
  if tg_op = 'UPDATE' and old.dilepas_pada is null and new.dilepas_pada is not null then
    perform pg_advisory_xact_lock(hashtext('gwg_work_executor'), hashtext(new.work_id::text));

    select count(*) into v_sisa
      from work_executors e
     where e.work_id = new.work_id
       and e.dilepas_pada is null
       and e.user_id <> new.user_id;   -- baris yang sedang dilepas tidak ikut dihitung

    if v_sisa = 0 then
      raise exception 'pelaksana terakhir work % tidak boleh dilepas — pekerjaan tanpa pelaksana tidak akan pernah dikerjakan maupun ditutup', new.work_id;
    end if;
  end if;

  return new;
end;
$$;

create or replace trigger work_executors_terjaga_trg
  before insert or update on work_executors
  for each row execute function work_executors_terjaga();

/* ───────────── signal_work · tidak terhapus, dan tidak boleh habis ───────────── */

create or replace function signal_work_terjaga()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_sisa integer;
begin
  /* ── T-D · kaitan tidak pernah dihapus (I-16) ──
   *
   * `ON DELETE RESTRICT` menjaga baris INDUKNYA, bukan baris kaitan ini.
   * Menghapusnya berarti menghapus fakta bahwa Signal itu pernah dianggap
   * ditangani di sini — justru pertanyaan yang menjadi alasan Signal
   * disimpan permanen sejak `0111`. Yang dilepas ditandai, bukan dihilangkan. */
  if tg_op = 'DELETE' then
    raise exception 'kaitan signal % dengan work % tidak boleh dihapus — lepaskan lewat dilepas_pada supaya jejaknya tetap terbaca', old.signal_id, old.work_id;
  end if;

  /* ── T-B · kaitan aktif terakhir tidak boleh dilepas (I-01, I-17) ──
   *
   * D14 mengunci bahwa Work Z-02 selalu berasal dari Signal. Melepas kaitan
   * terakhir akan meninggalkan Work yang tidak berasal dari mana pun.
   * Lifecycle Signal tidak disentuh sama sekali di sini. */
  if old.dilepas_pada is null and new.dilepas_pada is not null then
    perform pg_advisory_xact_lock(hashtext('gwg_work_signal'), hashtext(new.work_id::text));

    select count(*) into v_sisa
      from signal_work s
     where s.work_id = new.work_id
       and s.dilepas_pada is null
       and s.signal_id <> new.signal_id;   -- yang sedang dilepas tidak ikut dihitung

    if v_sisa = 0 then
      raise exception 'kaitan signal terakhir work % tidak boleh dilepas — work selalu berasal dari signal', new.work_id;
    end if;
  end if;

  return new;
end;
$$;

create or replace trigger signal_work_terjaga_trg
  before update or delete on signal_work
  for each row execute function signal_work_terjaga();

/* ───────────── work_riwayat · hanya bertambah ───────────── */

-- ┌─ RIWAYAT YANG BISA DISUNTING BUKAN RIWAYAT ──────────────────────────────┐
-- │                                                                          │
-- │ Seluruh jaminan T-F bertumpu pada baris di tabel ini. Kalau baris itu    │
-- │ bisa diubah atau dihapus sesudahnya, jejak yang dituntut hari ini bisa   │
-- │ dibersihkan besok — dan mutasinya berakhir tanpa alasan, persis keadaan  │
-- │ yang hendak dicegah.                                                     │
-- └──────────────────────────────────────────────────────────────────────────┘
create or replace function work_riwayat_hanya_bertambah()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'riwayat work % tidak boleh diubah maupun dihapus — ia satu-satunya jejak kenapa sesuatu berubah',
    coalesce(old.work_id, new.work_id);
end;
$$;

create or replace trigger work_riwayat_hanya_bertambah_trg
  before update or delete on work_riwayat
  for each row execute function work_riwayat_hanya_bertambah();
