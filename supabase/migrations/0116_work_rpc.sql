-- Operational V.1 · Z-02 / STEP 3 — penjaga status Work dan enam fungsi penulis.
--
-- ┌─ APA YANG BELUM DIJAGA SAMPAI BERKAS INI ────────────────────────────────┐
-- │                                                                          │
-- │ `0115` menjaga tiga mutasi (owner, departemen, tenggat), snapshot        │
-- │ tenggat, pemisahan owner/pelaksana, dan dua "yang terakhir tidak boleh   │
-- │ habis". Ia TIDAK pernah membaca kolom `status` satu kali pun.            │
-- │                                                                          │
-- │ Akibatnya hari ini sebuah Work bisa melompat dari `open` langsung ke     │
-- │ `completed`, dibatalkan tanpa satu baris alasan, lalu dibuka kembali     │
-- │ keesokan harinya — dan tidak ada yang menolak satu pun di antaranya.     │
-- │ Berkas ini menutup ketiganya di lapisan yang tidak bisa dilewati.        │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ KENAPA `CREATE OR REPLACE FUNCTION`, BUKAN TRIGGER BARU ────────────────┐
-- │                                                                          │
-- │ Aturan baru menyala pada peristiwa yang sama dengan aturan lama:         │
-- │ BEFORE UPDATE pada `works`, BEFORE INSERT/UPDATE pada baris anak.        │
-- │ Trigger kedua akan berjalan berurutan menurut ABJAD namanya — dan pesan  │
-- │ galat yang muncul jadi ditentukan nama, bukan mana yang paling penting.  │
-- │                                                                          │
-- │ Polanya sama dengan `0113_signal_diakui.sql`, yang memperluas            │
-- │ `signals_tak_tersunting()` tanpa menyentuh triggernya. Seluruh aturan    │
-- │ `0115` DISALIN APA ADANYA di bawah — tidak satu pun dicabut.             │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- `0114_work_signal.sql` dan `0115_work_enforcement.sql` TIDAK DIUBAH.
--
-- Lihat AD-19 dan AD-20 · docs/operational-v1/decisions.md —
-- I-01 · I-03 · I-04 · I-11 · I-16 · I-17 · I-18 · I-19 · I-20 ·
-- I-21 · I-22 · I-23 · I-24 · I-25 · I-26 · I-27 · I-28.

/* ═══════════════════ BAGIAN A · PERLUASAN PENJAGA BASIS DATA ═══════════════════ */

/* ───────────── works · status, terminal, dan jejak yang lahir bersamanya ───────────── */

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

  /* ── T-H · yang sudah berhenti, berhenti seluruhnya (I-24, AD-20 · G) ──
   *
   * ┌─ CATATAN YANG SUDAH DITUTUP LALU BERUBAH ISINYA BUKAN CATATAN ──────┐
   * │                                                                     │
   * │ AD-20 · B saja menyisakan lubang: Work yang sudah dinyatakan selesai │
   * │ masih bisa berpindah pemilik, berpindah departemen, dan bergeser    │
   * │ tenggatnya. Seluruh nilai `works` sebagai rekam audit bertumpu pada │
   * │ isinya berhenti bergerak ketika pekerjaannya berhenti.              │
   * │                                                                     │
   * │ Yang dikunci PERSIS empat kolom yang dieja AD-20 · G nomor 1-4.     │
   * │ `judul` dan `deskripsi` TIDAK ikut dikunci di sini — kontraknya     │
   * │ tidak menyebutnya, dan penjaga yang lebih luas dari kontraknya akan │
   * │ menolak hal yang tidak pernah diputuskan siapa pun.                 │
   * └─────────────────────────────────────────────────────────────────────┘ */
  if old.status in ('completed', 'cancelled') then
    if new.status is distinct from old.status then
      raise exception 'work % sudah % dan tidak dapat dibuka kembali — pekerjaan lanjutan adalah work baru, bukan work lama yang dihidupkan', old.id, old.status;
    end if;

    if new.owner_id is distinct from old.owner_id
       or new.primary_department is distinct from old.primary_department
       or new.tenggat is distinct from old.tenggat then
      raise exception 'work % sudah % — owner, departemen, dan tenggatnya tidak boleh diubah lagi', old.id, old.status;
    end if;
  end if;

  /* ── T-I · mesin status, dan hanya empat arah (I-22, AD-20 · B) ──
   *
   *   open ─┬─> in_progress ─┬─> completed
   *         │                └─> cancelled
   *         └─> cancelled
   *
   * `open → completed` sengaja DITOLAK: yang dinyatakan selesai harus lebih
   * dulu dinyatakan dikerjakan. Tanpa arah, `completed` bisa dikembalikan
   * menjadi `open` — persis penyakit yang sudah dicegah pada `signals` lewat
   * larangan `diabaikan → terbuka`. */
  if new.status is distinct from old.status then
    if (old.status, new.status) not in (
      ('open', 'in_progress'),
      ('in_progress', 'completed'),
      ('open', 'cancelled'),
      ('in_progress', 'cancelled')
    ) then
      raise exception 'transisi status work % dari % ke % tidak sah — hanya open→in_progress, in_progress→completed, open→cancelled, dan in_progress→cancelled yang dikenal', old.id, old.status, new.status;
    end if;

    /* ── T-J · setiap perubahan status meninggalkan jejak (I-21, I-25) ──
     *
     * Mekanismenya sama persis dengan T-F: `xmin` baris riwayat harus sama
     * dengan transaksi yang sedang berjalan, jadi jejaknya lahir bersama
     * perubahannya — riwayat yang ditanam kemarin tidak mengesahkan apa pun.
     * Penulis WAJIB menyisipkan riwayat LEBIH DULU, baru memperbarui `works`.
     *
     * Alasan hanya WAJIB untuk pembatalan. Pembatalan menghentikan pekerjaan,
     * dan yang menghentikan pekerjaan tanpa alasan tertulis tidak dapat
     * ditagih siapa pun. Transisi normal tidak menuntutnya, dan alasan kosong
     * tidak boleh menyamar sebagai alasan. */
    select count(*) into v_ada
      from work_riwayat r
     where r.work_id = old.id
       and r.jenis = 'status'
       and r.nilai_lama is not distinct from old.status
       and r.nilai_baru = new.status
       and (new.status <> 'cancelled' or coalesce(trim(r.alasan), '') <> '')
       and r.xmin = v_xid;
    if v_ada = 0 then
      if new.status = 'cancelled' then
        raise exception 'pembatalan work % wajib disertai riwayat status beralasan pada transaksi yang sama', old.id;
      end if;
      raise exception 'perubahan status work % wajib disertai riwayat status pada transaksi yang sama', old.id;
    end if;
  end if;

  /* ── T-A arah kedua · owner tidak boleh merangkap pelaksana (I-03) ──
   *
   * Arah pertamanya dijaga `work_executors_terjaga`. Tanpa arah ini, aturan
   * yang sama bisa dilanggar dari sisi sebaliknya: tinggal jadikan pelaksana
   * yang sudah ada sebagai owner, dan yang menanggung sama dengan yang
   * dinilai. */
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

-- Triggernya TIDAK dibuat ulang: `0115` sudah memasangnya pada peristiwa yang
-- sama, dan `create or replace function` sudah cukup menggantikan isinya.

/* ───────────── work_executors · bukan owner, tidak habis, dan berhenti saat work berhenti ───────────── */

create or replace function work_executors_terjaga()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_baris  work_executors;
  v_owner  text;
  v_status text;
  v_sisa   integer;
begin
  -- DELETE tidak punya `new`; INSERT tidak punya `old`. Satu variabel supaya
  -- sisa fungsi tidak perlu bercabang tiap kali menyebut `work_id`.
  if tg_op = 'DELETE' then v_baris := old; else v_baris := new; end if;

  /* ── FOR SHARE, DAN BUKAN SEKADAR SELECT ──
   *
   * Yang dibaca di sini milik BARIS LAIN (`works`), dan keputusannya
   * bergantung pada nilai yang bisa berubah pada saat yang sama. Tanpa kunci
   * berbagi, urutan ini lolos di bawah READ COMMITTED: transaksi A membaca
   * `status = 'open'`, transaksi B menyelesaikan Work-nya dan COMMIT, lalu A
   * menyisipkan pelaksana ke Work yang sudah selesai. `for share` menahan A
   * sampai B selesai — dan sesudahnya A membaca keadaan yang sebenarnya.
   *
   * `for share` dipilih, bukan `for update`: yang dibutuhkan jaminan bahwa
   * baris `works` tidak berubah sampai transaksi ini selesai, bukan hak
   * mengubahnya. */
  select w.owner_id, w.status into v_owner, v_status
    from works w
   where w.id = v_baris.work_id
     for share;

  /* ── T-H · penugasan berhenti saat pekerjaannya berhenti (I-24, AD-20 · G) ── */
  if v_status in ('completed', 'cancelled') then
    raise exception 'work % sudah % — pelaksananya tidak boleh ditambah, diubah, dilepas, maupun dihapus', v_baris.work_id, v_status;
  end if;

  /* ── T-D arah pelaksana · penugasan tidak dihapus, ia dilepas ──
   *
   * Alasannya sama dengan `signal_work`: menghapus barisnya menghapus juga
   * fakta bahwa orang itu pernah ditugaskan di sini. Yang dilepas ditandai
   * `dilepas_pada`, bukan dihilangkan.
   *
   * Sebelum berkas ini, DELETE pada Work non-terminal tidak ditolak siapa pun.
   * Ia ditutup di sini karena DELETE melewati audit pelepasan seluruhnya —
   * tidak ada `dilepas_pada`, tidak ada `dilepas_oleh` — dan karena larangan
   * yang hanya berlaku sesudah Work selesai bisa dilewati dengan menghapus
   * barisnya sebelum Work selesai, yang melemahkan I-18 (AD-20 · J, I-27). */
  if tg_op = 'DELETE' then
    raise exception 'penugasan % pada work % tidak boleh dihapus — lepaskan lewat dilepas_pada supaya jejaknya tetap terbaca', old.user_id, old.work_id;
  end if;

  /* ── T-M · pelepasan pelaksana tidak bisa ditarik kembali (AD-20 · K, I-28) ──
   *
   * ┌─ ALASANNYA SAMA PERSIS DENGAN T-L PADA `signal_work` ───────────────┐
   * │                                                                     │
   * │ `dilepas_pada` dan `dilepas_oleh` adalah satu-satunya jejak bahwa   │
   * │ orang ini pernah berhenti mengerjakan Work ini, kapan, dan atas     │
   * │ perintah siapa. Mengosongkannya kembali menugaskan ulang orang lama │
   * │ TANPA menyebut siapa yang menugaskannya — dan jejak pelepasannya    │
   * │ hilang tanpa bekas.                                                 │
   * │                                                                     │
   * │ Melarang DELETE saja tidak cukup: mengosongkan kedua kolom ini      │
   * │ menghapus audit yang sama tanpa menghapus satu baris pun.           │
   * │ Keduanya karena itu DIBEKUKAN begitu terisi — tidak dikosongkan,    │
   * │ tidak diganti, tidak digeser.                                       │
   * └─────────────────────────────────────────────────────────────────────┘
   *
   * `work_executors_pelepasan_utuh` pada `0114` sudah menjamin keduanya
   * terisi bersama atau kosong bersama; yang di sini menjaga arah waktunya. */
  if tg_op = 'UPDATE' and (old.dilepas_pada is not null or old.dilepas_oleh is not null) then
    if new.dilepas_pada is distinct from old.dilepas_pada
       or new.dilepas_oleh is distinct from old.dilepas_oleh then
      raise exception 'pelepasan pelaksana % pada work % sudah tercatat dan tidak boleh diubah maupun ditarik kembali', old.user_id, old.work_id;
    end if;
  end if;

  /* ── T-A arah pertama · pelaksana bukan owner (I-03) ── */
  if tg_op = 'INSERT' or new.user_id is distinct from old.user_id or new.dilepas_pada is null then
    if v_owner = new.user_id then
      raise exception 'orang yang menanggung work % tidak boleh sekaligus mengerjakannya — pekerjaan yang ditutup sendiri oleh pelaksananya tidak pernah diperiksa siapa pun', new.work_id;
    end if;
  end if;

  /* ── T-K · snapshot departemen dibekukan seperti snapshot tenggat ──
   *
   * Departemen orang berubah. Kalau snapshot ini ikut ditulis ulang,
   * pertanyaan "pekerjaan ini lintas departemen atau tidak" berubah jawabannya
   * berbulan-bulan kemudian tanpa ada yang mengubah pekerjaannya. */
  if tg_op = 'UPDATE'
     and new.departemen_saat_ditugaskan is distinct from old.departemen_saat_ditugaskan then
    raise exception 'departemen saat ditugaskan pada work % tidak boleh diubah — ia keadaan saat penugasan, bukan departemen orangnya sekarang', new.work_id;
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

-- Daftar peristiwanya BERTAMBAH `delete`, jadi triggernya ikut diganti.
-- `create or replace trigger` (PG14+) mengganti di tempat — tidak ada trigger
-- kedua yang lahir, dan urutan abjad tidak pernah jadi soal.
create or replace trigger work_executors_terjaga_trg
  before insert or update or delete on work_executors
  for each row execute function work_executors_terjaga();

/* ───────────── signal_work · tidak terhapus, tidak habis, dan tidak bertambah setelah work berhenti ───────────── */

create or replace function signal_work_terjaga()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_baris  signal_work;
  v_status text;
  v_sisa   integer;
begin
  /* ── T-D · kaitan tidak pernah dihapus (I-16) ──
   *
   * Diperiksa PALING DULU, sebelum apa pun dibaca dari `works`: penghapusan
   * ditolak tanpa syarat, jadi keadaan Work tidak relevan untuk menjawabnya.
   *
   * `ON DELETE RESTRICT` menjaga baris INDUKNYA, bukan baris kaitan ini.
   * Menghapusnya berarti menghapus fakta bahwa Signal itu pernah dianggap
   * ditangani di sini — justru pertanyaan yang menjadi alasan Signal
   * disimpan permanen sejak `0111`. Yang dilepas ditandai, bukan dihilangkan. */
  if tg_op = 'DELETE' then
    raise exception 'kaitan signal % dengan work % tidak boleh dihapus — lepaskan lewat dilepas_pada supaya jejaknya tetap terbaca', old.signal_id, old.work_id;
  end if;

  v_baris := new;

  -- Alasan `for share` sama persis dengan `work_executors_terjaga`.
  select w.status into v_status
    from works w
   where w.id = v_baris.work_id
     for share;

  /* ── T-H · kaitan berhenti saat pekerjaannya berhenti (I-24, AD-20 · H) ──
   *
   * Ketiga arah ditutup sekaligus: mengaitkan Signal baru, melepas kaitan
   * aktif, dan menghapus barisnya. Mengaitkan Signal baru memperbesar himpunan
   * kaitan aktif sebuah Work terminal, sehingga ia mutasi — dan I-24 berlaku.
   * Kaitan yang sudah ada tetap tersimpan sebagai rekam audit; tidak ada satu
   * baris pun yang dihapus, dan lifecycle Signal tidak tersentuh. */
  if v_status in ('completed', 'cancelled') then
    raise exception 'work % sudah % — kaitan signalnya tidak boleh ditambah maupun dilepas lagi', v_baris.work_id, v_status;
  end if;

  /* ── T-L · pelepasan tidak bisa ditarik kembali (AD-20 · J, I-26) ──
   *
   * ┌─ YANG SUDAH DILEPAS TETAP DILEPAS ──────────────────────────────────┐
   * │                                                                     │
   * │ Trio pelepasan (`dilepas_pada`/`dilepas_oleh`/`alasan`) adalah satu │
   * │ satunya jejak bahwa Signal ini pernah dianggap salah kait di sini.  │
   * │ Mengosongkannya kembali menghidupkan kaitan lama TANPA menyebut     │
   * │ siapa yang menghidupkannya dan kenapa — dan jejak pelepasannya      │
   * │ hilang tanpa bekas.                                                 │
   * │                                                                     │
   * │ Karena itu ketiganya DIBEKUKAN begitu terisi: tidak bisa dikosongkan│
   * │ dan tidak bisa ditulis ulang. Kalau kebutuhannya kaitan baru, itu   │
   * │ belum termasuk kontrak Z-02 dan ditolak untuk saat ini.             │
   * └─────────────────────────────────────────────────────────────────────┘ */
  if tg_op = 'UPDATE' and old.dilepas_pada is not null then
    if new.dilepas_pada is distinct from old.dilepas_pada
       or new.dilepas_oleh is distinct from old.dilepas_oleh
       or new.alasan      is distinct from old.alasan then
      raise exception 'pelepasan kaitan signal % dari work % sudah tercatat dan tidak boleh diubah maupun ditarik kembali', old.signal_id, old.work_id;
    end if;
  end if;

  /* ── T-B · kaitan aktif terakhir tidak boleh dilepas (I-01, I-17) ──
   *
   * D14 mengunci bahwa Work Z-02 selalu berasal dari Signal. Melepas kaitan
   * terakhir akan meninggalkan Work yang tidak berasal dari mana pun.
   * Lifecycle Signal tidak disentuh sama sekali di sini. */
  if tg_op = 'UPDATE' and old.dilepas_pada is null and new.dilepas_pada is not null then
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

-- Daftar peristiwanya BERTAMBAH `insert` — tanpa itu, Signal baru bisa
-- dikaitkan ke Work yang sudah selesai dan tidak ada yang menolaknya.
create or replace trigger signal_work_terjaga_trg
  before insert or update or delete on signal_work
  for each row execute function signal_work_terjaga();

/* ───────────── work_riwayat · tetap hanya bertambah ───────────── */

-- TIDAK DIUBAH. `work_riwayat_hanya_bertambah()` di `0115` sudah menolak
-- seluruh UPDATE dan DELETE, dan itu persis yang dituntut kontrak. Menulis
-- ulang fungsi yang isinya sama hanya memindahkan barisnya ke berkas lain.
--
-- Jenis riwayat tetap empat (`owner`, `tenggat`, `status`, `departemen`),
-- dibatasi CHECK `work_riwayat_jenis_sah` pada `0114`. Tidak ada jenis baru.

/* ═══════════════════ BAGIAN B · ENAM FUNGSI PENULIS ═══════════════════ */

-- ┌─ KENAPA FUNGSI, BUKAN BEBERAPA PERINTAH DARI KLIEN ──────────────────────┐
-- │                                                                          │
-- │ PostgREST tidak punya transaksi lintas permintaan. Membuat Work lewat    │
-- │ tiga permintaan terpisah akan meninggalkan Work tanpa Signal dan tanpa   │
-- │ pelaksana begitu permintaan kedua gagal — dan tidak ada yang terlihat    │
-- │ salah dari luar. Alasan yang sama sudah tercatat di `0111` baris 217.    │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ `p_oleh` BUKAN MEKANISME AUTENTIKASI ───────────────────────────────────┐
-- │                                                                          │
-- │ Fungsi-fungsi ini berjalan sebagai `service_role` tanpa konteks          │
-- │ autentikasi; ia tidak bisa membuktikan siapa pemanggilnya. Seluruh       │
-- │ otorisasi tetap di lapisan aplikasi (`src/lib/rbac.ts`,                  │
-- │ `src/lib/ops/scope-v1.ts`) sesuai O-12 dan AD-20 · C.                    │
-- │                                                                          │
-- │ Yang ADA di sini cuma satu penjaga konsistensi yang dikunci AD-20 · C:   │
-- │ penyelesaian Work ditolak bila pelaku yang disampaikan bukan Ownernya.   │
-- │ Ia memastikan penyelesaian tidak tercatat atas nama orang yang bukan     │
-- │ pemiliknya — bukan memastikan pemanggilnya benar orang itu.              │
-- └──────────────────────────────────────────────────────────────────────────┘

/* ───────────────────────── 1 · gwg_buat_work ───────────────────────── */

-- ┌─ KEBIJAKAN TENGGAT Z02-SLA-v1 (O-04) ────────────────────────────────────┐
-- │                                                                          │
-- │   urgent  1 hari    high  3 hari    normal  5 hari    low  7 hari        │
-- │                                                                          │
-- │ Alurnya `policy input → anchor → calculation → stored deadline`. Hasilnya │
-- │ DISIMPAN, tidak dihitung ulang saat render — perubahan kebijakan bulan   │
-- │ depan tidak boleh menggeser tenggat Work yang sudah ada.                 │
-- │                                                                          │
-- │ OFFSET MURNI dari anchor, dan itu keputusan yang dieja. TIDAK ada        │
-- │ pembulatan ke akhir hari, tidak ada 23:59:59, tidak ada aturan hari      │
-- │ kerja: Work yang dibuat pukul 10.17 WIB berkategori `high` jatuh tempo   │
-- │ pukul 10.17 WIB tiga hari kemudian, bukan tengah malam.                  │
-- │                                                                          │
-- │ `tenggat_zona` tetap disimpan sebagai snapshot kalender bisnisnya (O-03),│
-- │ supaya tenggat ini dibaca dan ditagih dalam WIB — bukan zona peramban    │
-- │ orang yang kebetulan membukanya.                                         │
-- └──────────────────────────────────────────────────────────────────────────┘
create or replace function gwg_buat_work(
  p_judul        text,
  p_deskripsi    text,
  p_owner        text,
  p_departemen   text,
  p_kategori     text,
  p_signal_ids   bigint[],
  p_executor_ids text[],
  p_oleh         text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_signals  bigint[];
  v_execs    text[];
  v_hari     integer;
  v_anchor   timestamptz := now();
  v_tenggat  timestamptz;
  v_id       bigint;
  v_kurang   text;
begin
  if coalesce(trim(p_judul), '') = '' then
    raise exception 'judul work wajib diisi';
  end if;

  if coalesce(trim(p_departemen), '') = '' then
    raise exception 'departemen utama work wajib diisi';
  end if;

  if coalesce(trim(p_oleh), '') = '' then
    raise exception 'pembuat work wajib disebut';
  end if;

  v_hari := case p_kategori
              when 'urgent' then 1
              when 'high'   then 3
              when 'normal' then 5
              when 'low'    then 7
            end;
  if v_hari is null then
    raise exception 'kategori tenggat % tidak dikenal kebijakan Z02-SLA-v1 — hanya urgent, high, normal, dan low', coalesce(p_kategori, '(kosong)');
  end if;

  -- Kembaran di dalam satu panggilan bukan kesalahan pemanggil yang perlu
  -- ditolak; ia cuma daftar yang sama disebut dua kali. Yang dipakai
  -- himpunannya, bukan urutannya.
  select array_agg(distinct x) into v_signals from unnest(coalesce(p_signal_ids, '{}')) x where x is not null;
  select array_agg(distinct x) into v_execs   from unnest(coalesce(p_executor_ids, '{}')) x where coalesce(trim(x), '') <> '';

  if coalesce(array_length(v_signals, 1), 0) = 0 then
    raise exception 'work wajib berasal dari sedikitnya satu signal — work tanpa signal tidak berasal dari mana pun';
  end if;

  if coalesce(array_length(v_execs, 1), 0) = 0 then
    raise exception 'work wajib punya sedikitnya satu pelaksana — pekerjaan tanpa pelaksana tidak akan pernah dikerjakan';
  end if;

  if p_owner = any(v_execs) then
    raise exception 'owner % tidak boleh sekaligus menjadi pelaksana — yang menanggung tidak boleh merangkap yang mengerjakan', p_owner;
  end if;

  -- ── sasaran yang tidak ditemukan, disebut namanya ──
  --
  -- Kunci asing `0114` sudah menolak id yang tidak ada, tetapi pesannya
  -- menyebut nama constraint. Yang dibaca orang di sini id mana yang salah.
  if not exists (select 1 from users u where u.id = p_owner and u.active) then
    raise exception 'owner % tidak ditemukan atau sudah tidak aktif', coalesce(p_owner, '(kosong)');
  end if;

  select string_agg(x::text, ', ' order by x::text) into v_kurang
    from unnest(v_signals) x where not exists (select 1 from signals s where s.id = x);
  if v_kurang is not null then
    raise exception 'signal tidak ditemukan: %', v_kurang;
  end if;

  select string_agg(x, ', ' order by x) into v_kurang
    from unnest(v_execs) x where not exists (select 1 from users u where u.id = x and u.active);
  if v_kurang is not null then
    raise exception 'pelaksana tidak ditemukan atau sudah tidak aktif: %', v_kurang;
  end if;

  select string_agg(x, ', ' order by x) into v_kurang
    from unnest(v_execs) x
   where coalesce(trim((select u.department from users u where u.id = x)), '') = '';
  if v_kurang is not null then
    raise exception 'pelaksana belum punya departemen sehingga snapshotnya kosong: %', v_kurang;
  end if;

  v_tenggat := v_anchor + make_interval(days => v_hari);

  insert into works (
    judul, deskripsi, owner_id, primary_department, status,
    tenggat_kategori, tenggat_anchor, tenggat_anchor_pada, tenggat_zona,
    tenggat_kebijakan_versi, tenggat, tenggat_dihitung_pada, dibuat_oleh
  ) values (
    trim(p_judul), coalesce(p_deskripsi, ''), p_owner, trim(p_departemen), 'open',
    p_kategori, 'work_dibuat', v_anchor, 'Asia/Jakarta',
    'Z02-SLA-v1', v_tenggat, now(), p_oleh
  )
  returning id into v_id;

  insert into signal_work (signal_id, work_id, dikaitkan_oleh)
  select x, v_id, p_oleh from unnest(v_signals) x;

  insert into work_executors (work_id, user_id, ditugaskan_oleh, departemen_saat_ditugaskan)
  select v_id, u.id, p_oleh, trim(u.department)
    from users u
   where u.id = any(v_execs);

  return jsonb_build_object(
    'id',              v_id,
    'tenggat',         v_tenggat,
    'jumlah_signal',   array_length(v_signals, 1),
    'jumlah_executor', array_length(v_execs, 1),
    'berubah',         true
  );
end;
$$;

revoke all on function gwg_buat_work(text, text, text, text, text, bigint[], text[], text) from public, anon, authenticated;
grant execute on function gwg_buat_work(text, text, text, text, text, bigint[], text[], text) to service_role;

/* ────────────────────── 2 · gwg_kaitkan_signal_work ────────────────────── */

-- ┌─ `for share` PADA `works`, BUKAN SEKADAR MEMBACA STATUSNYA ──────────────┐
-- │                                                                          │
-- │ Tanpa kunci, urutan ini lolos: fungsi ini membaca `status = 'open'`,     │
-- │ transaksi lain menyelesaikan Work-nya dan COMMIT, lalu penyisipan di     │
-- │ sini berjalan atas Work yang sudah selesai. Triggernya memang menolak    │
-- │ hal yang sama — dua lapis, dan yang di sini yang memberi pesan jelas.    │
-- └──────────────────────────────────────────────────────────────────────────┘
create or replace function gwg_kaitkan_signal_work(
  p_work_id   bigint,
  p_signal_id bigint,
  p_oleh      text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status  text;
  v_dilepas timestamptz;
begin
  if coalesce(trim(p_oleh), '') = '' then
    raise exception 'pelaku pengaitan signal wajib disebut';
  end if;

  select w.status into v_status from works w where w.id = p_work_id for share;
  if not found then
    raise exception 'work % tidak ditemukan', coalesce(p_work_id::text, '(kosong)');
  end if;

  if v_status in ('completed', 'cancelled') then
    raise exception 'work % sudah % — signal baru tidak boleh dikaitkan padanya; pekerjaan lanjutan adalah work baru', p_work_id, v_status;
  end if;

  if not exists (select 1 from signals s where s.id = p_signal_id) then
    raise exception 'signal % tidak ditemukan', coalesce(p_signal_id::text, '(kosong)');
  end if;

  select s.dilepas_pada into v_dilepas
    from signal_work s
   where s.signal_id = p_signal_id and s.work_id = p_work_id;

  if found then
    -- Sudah aktif: keadaannya sudah sama dengan yang diminta, dan mengulang
    -- permintaan yang tidak berbahaya bukan kegagalan (AD-20 · E).
    if v_dilepas is null then
      return jsonb_build_object('work_id', p_work_id, 'signal_id', p_signal_id, 'berubah', false);
    end if;

    -- Pernah dilepas. Mengaktifkannya kembali berarti mengosongkan trio
    -- pelepasan yang sudah tercatat — dan jejak "pernah dilepas, dengan
    -- alasan ini, oleh orang ini" hilang tanpa bekas. Ditolak di sini supaya
    -- pesannya terbaca, dan ditolak lagi oleh T-L supaya penyisipan langsung
    -- di luar fungsi ini tidak punya jalan lain (AD-20 · J).
    raise exception 'kaitan signal % dengan work % pernah dilepas dan tidak dapat dikaitkan ulang — jejak pelepasannya tidak boleh dihapus', p_signal_id, p_work_id;
  end if;

  insert into signal_work (signal_id, work_id, dikaitkan_oleh)
  values (p_signal_id, p_work_id, p_oleh);

  return jsonb_build_object('work_id', p_work_id, 'signal_id', p_signal_id, 'berubah', true);
end;
$$;

revoke all on function gwg_kaitkan_signal_work(bigint, bigint, text) from public, anon, authenticated;
grant execute on function gwg_kaitkan_signal_work(bigint, bigint, text) to service_role;

/* ─────────────────────── 3 · gwg_lepas_signal_work ─────────────────────── */

-- Pelepasan LUNAK (O-10): barisnya tidak pernah dihapus, ia ditandai. Kaitan
-- aktif terakhir ditolak triggernya — bukan di sini, karena penghitungan sisa
-- butuh advisory lock yang sudah terbukti pada `0115`.
create or replace function gwg_lepas_signal_work(
  p_work_id   bigint,
  p_signal_id bigint,
  p_alasan    text,
  p_oleh      text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status  text;
  v_dilepas timestamptz;
begin
  if coalesce(trim(p_oleh), '') = '' then
    raise exception 'pelaku pelepasan signal wajib disebut';
  end if;

  select w.status into v_status from works w where w.id = p_work_id for share;
  if not found then
    raise exception 'work % tidak ditemukan', coalesce(p_work_id::text, '(kosong)');
  end if;

  if v_status in ('completed', 'cancelled') then
    raise exception 'work % sudah % — kaitan signalnya tidak boleh dilepas lagi; yang sudah tercatat tetap menjadi rekam audit', p_work_id, v_status;
  end if;

  select s.dilepas_pada into v_dilepas
    from signal_work s
   where s.signal_id = p_signal_id and s.work_id = p_work_id;

  if not found then
    raise exception 'kaitan signal % dengan work % tidak ditemukan', coalesce(p_signal_id::text, '(kosong)'), p_work_id;
  end if;

  if v_dilepas is not null then
    return jsonb_build_object('work_id', p_work_id, 'signal_id', p_signal_id, 'berubah', false);
  end if;

  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'pelepasan kaitan signal % dari work % wajib beralasan — pelepasan tanpa alasan tidak bisa diaudit siapa pun', p_signal_id, p_work_id;
  end if;

  update signal_work
     set dilepas_pada = now(),
         dilepas_oleh = p_oleh,
         alasan       = trim(p_alasan)
   where signal_id = p_signal_id and work_id = p_work_id;

  return jsonb_build_object('work_id', p_work_id, 'signal_id', p_signal_id, 'berubah', true);
end;
$$;

revoke all on function gwg_lepas_signal_work(bigint, bigint, text, text) from public, anon, authenticated;
grant execute on function gwg_lepas_signal_work(bigint, bigint, text, text) to service_role;

/* ────────────────────── 4 · gwg_kelola_executor_work ────────────────────── */

-- Satu fungsi untuk dua arah, dan itu disengaja: keduanya membaca Work yang
-- sama, memeriksa keadaan terminal yang sama, dan mengembalikan bentuk jawaban
-- yang sama. Dipecah jadi dua, pemeriksaan yang sama ditulis dua kali — dan
-- salinan kedua akan menyimpang diam-diam.
create or replace function gwg_kelola_executor_work(
  p_work_id bigint,
  p_user_id text,
  p_aksi    text,
  p_oleh    text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status  text;
  v_owner   text;
  v_dilepas timestamptz;
  v_ada     boolean;
  v_dep     text;
begin
  if p_aksi not in ('tambah', 'lepas') then
    raise exception 'aksi pelaksana % tidak dikenal — hanya tambah dan lepas', coalesce(p_aksi, '(kosong)');
  end if;

  if coalesce(trim(p_oleh), '') = '' then
    raise exception 'pelaku pengelolaan pelaksana wajib disebut';
  end if;

  select w.status, w.owner_id into v_status, v_owner from works w where w.id = p_work_id for share;
  if not found then
    raise exception 'work % tidak ditemukan', coalesce(p_work_id::text, '(kosong)');
  end if;

  if v_status in ('completed', 'cancelled') then
    raise exception 'work % sudah % — pelaksananya tidak boleh ditambah maupun dilepas lagi', p_work_id, v_status;
  end if;

  select (e.work_id is not null), e.dilepas_pada into v_ada, v_dilepas
    from work_executors e
   where e.work_id = p_work_id and e.user_id = p_user_id;
  v_ada := coalesce(v_ada, false);

  if p_aksi = 'tambah' then
    if v_ada and v_dilepas is null then
      return jsonb_build_object('work_id', p_work_id, 'user_id', p_user_id, 'aksi', p_aksi, 'berubah', false);
    end if;

    -- Pernah dilepas. Alasannya sama dengan pengaitan ulang Signal: jejak
    -- pelepasan yang sudah tercatat tidak boleh dikosongkan kembali. Ditolak
    -- di sini supaya pesannya terbaca, dan ditolak lagi oleh T-M supaya
    -- penulisan langsung di luar fungsi ini tidak punya jalan lain.
    if v_ada then
      raise exception 'pelaksana % pada work % pernah dilepas dan tidak dapat ditugaskan ulang — jejak pelepasannya tidak boleh dihapus', p_user_id, p_work_id;
    end if;

    if v_owner = p_user_id then
      raise exception 'owner work % tidak boleh sekaligus menjadi pelaksananya', p_work_id;
    end if;

    select trim(u.department) into v_dep from users u where u.id = p_user_id and u.active;
    if not found then
      raise exception 'pelaksana % tidak ditemukan atau sudah tidak aktif', coalesce(p_user_id, '(kosong)');
    end if;
    if coalesce(v_dep, '') = '' then
      raise exception 'pelaksana % belum punya departemen sehingga snapshotnya kosong', p_user_id;
    end if;

    -- Departemen pelaksana BOLEH berbeda dari `primary_department` Work (D4).
    -- Yang dibekukan faktanya, bukan kesamaannya.
    insert into work_executors (work_id, user_id, ditugaskan_oleh, departemen_saat_ditugaskan)
    values (p_work_id, p_user_id, p_oleh, v_dep);

    return jsonb_build_object('work_id', p_work_id, 'user_id', p_user_id, 'aksi', p_aksi, 'berubah', true);
  end if;

  -- ── p_aksi = 'lepas' ──
  if not v_ada then
    raise exception 'pelaksana % tidak pernah ditugaskan pada work %', coalesce(p_user_id, '(kosong)'), p_work_id;
  end if;

  if v_dilepas is not null then
    return jsonb_build_object('work_id', p_work_id, 'user_id', p_user_id, 'aksi', p_aksi, 'berubah', false);
  end if;

  -- Pelaksana aktif terakhir ditolak triggernya, memakai advisory lock yang
  -- sudah terbukti pada `0115`. Tidak ada kunci kedua ditambahkan di sini.
  update work_executors
     set dilepas_pada = now(),
         dilepas_oleh = p_oleh
   where work_id = p_work_id and user_id = p_user_id;

  return jsonb_build_object('work_id', p_work_id, 'user_id', p_user_id, 'aksi', p_aksi, 'berubah', true);
end;
$$;

revoke all on function gwg_kelola_executor_work(bigint, text, text, text) from public, anon, authenticated;
grant execute on function gwg_kelola_executor_work(bigint, text, text, text) to service_role;

/* ───────────────────────────── 5 · gwg_ubah_work ───────────────────────────── */

-- ┌─ URUTANNYA TIDAK BOLEH TERBALIK ─────────────────────────────────────────┐
-- │                                                                          │
-- │ Riwayat DISISIPKAN LEBIH DULU, `works` diperbarui sesudahnya. T-F pada   │
-- │ trigger BEFORE UPDATE tidak bisa melihat baris yang belum ada; urutan    │
-- │ terbalik akan ditolak, dan itu memang maksudnya. Keduanya satu transaksi:│
-- │ kalau pembaruannya gagal, riwayatnya ikut batal.                         │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- `null` pada sebuah parameter berarti "tidak diubah", BUKAN "kosongkan".
-- Ketiga kolomnya NOT NULL, jadi tidak ada arti kedua yang hilang karenanya.
--
-- `tenggat_kategori` dan seluruh snapshot perhitungan tenggat TIDAK ikut
-- berubah (O-09): dua fakta harus tetap dapat dibedakan selamanya — tenggat
-- hasil kebijakan awal, dan tenggat yang kemudian digeser orang.
create or replace function gwg_ubah_work(
  p_work_id    bigint,
  p_owner      text,
  p_departemen text,
  p_tenggat    timestamptz,
  p_alasan     text,
  p_oleh       text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_w          works;
  v_owner      text;
  v_dep        text;
  v_tenggat    timestamptz;
  v_ubah_owner boolean;
  v_ubah_dep   boolean;
  v_ubah_teng  boolean;
  v_alasan     text;
begin
  if coalesce(trim(p_oleh), '') = '' then
    raise exception 'pelaku perubahan work wajib disebut';
  end if;

  -- `for update`: keputusan di bawah bergantung pada nilai baris ini, dan
  -- barisnya memang akan diubah. Dua perubahan bersamaan atas Work yang sama
  -- karena itu berbaris, bukan saling menimpa.
  select * into v_w from works w where w.id = p_work_id for update;
  if not found then
    raise exception 'work % tidak ditemukan', coalesce(p_work_id::text, '(kosong)');
  end if;

  if v_w.status in ('completed', 'cancelled') then
    raise exception 'work % sudah % — owner, departemen, dan tenggatnya tidak boleh diubah lagi', p_work_id, v_w.status;
  end if;

  if p_owner is not null and coalesce(trim(p_owner), '') = '' then
    raise exception 'owner baru work % tidak boleh kosong', p_work_id;
  end if;

  if p_departemen is not null and coalesce(trim(p_departemen), '') = '' then
    raise exception 'departemen baru work % tidak boleh kosong', p_work_id;
  end if;

  v_owner   := coalesce(p_owner, v_w.owner_id);
  v_dep     := coalesce(trim(p_departemen), v_w.primary_department);
  v_tenggat := coalesce(p_tenggat, v_w.tenggat);

  v_ubah_owner := v_owner   is distinct from v_w.owner_id;
  v_ubah_dep   := v_dep     is distinct from v_w.primary_department;
  v_ubah_teng  := v_tenggat is distinct from v_w.tenggat;

  -- Tidak ada yang berbeda: keadaannya sudah sama dengan yang diminta, dan
  -- tidak satu baris pun berubah. Itu bukan pelanggaran (AD-20 · E).
  if not (v_ubah_owner or v_ubah_dep or v_ubah_teng) then
    return jsonb_build_object('id', p_work_id, 'berubah', false);
  end if;

  v_alasan := trim(coalesce(p_alasan, ''));
  if v_alasan = '' then
    raise exception 'perubahan owner, departemen, maupun tenggat work % wajib beralasan — perubahan senyap tidak bisa dijelaskan riwayatnya', p_work_id;
  end if;

  if v_ubah_owner then
    if not exists (select 1 from users u where u.id = v_owner and u.active) then
      raise exception 'owner baru % tidak ditemukan atau sudah tidak aktif', v_owner;
    end if;

    -- Triggernya memeriksa hal yang sama; yang di sini yang memberi pesan
    -- sebelum satu baris riwayat pun terlanjur ditulis.
    if exists (
      select 1 from work_executors e
       where e.work_id = p_work_id and e.user_id = v_owner and e.dilepas_pada is null
    ) then
      raise exception 'owner baru % masih menjadi pelaksana aktif work % — yang menanggung tidak boleh merangkap yang mengerjakan', v_owner, p_work_id;
    end if;

    insert into work_riwayat (work_id, jenis, nilai_lama, nilai_baru, alasan, oleh)
    values (p_work_id, 'owner', v_w.owner_id, v_owner, v_alasan, p_oleh);
  end if;

  if v_ubah_dep then
    insert into work_riwayat (work_id, jenis, nilai_lama, nilai_baru, alasan, oleh)
    values (p_work_id, 'departemen', v_w.primary_department, v_dep, v_alasan, p_oleh);
  end if;

  if v_ubah_teng then
    insert into work_riwayat (work_id, jenis, nilai_lama, nilai_baru, alasan, oleh)
    values (p_work_id, 'tenggat', v_w.tenggat::text, v_tenggat::text, v_alasan, p_oleh);
  end if;

  update works
     set owner_id           = v_owner,
         primary_department = v_dep,
         tenggat            = v_tenggat,
         diperbarui_pada    = now()
   where id = p_work_id;

  return jsonb_build_object('id', p_work_id, 'berubah', true);
end;
$$;

revoke all on function gwg_ubah_work(bigint, text, text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function gwg_ubah_work(bigint, text, text, timestamptz, text, text) to service_role;

/* ──────────────────────── 6 · gwg_ubah_status_work ──────────────────────── */

-- ┌─ PENJAGA OWNER PADA PENYELESAIAN BUKAN AUTENTIKASI (AD-20 · C) ──────────┐
-- │                                                                          │
-- │ Fungsi ini tidak bisa membuktikan siapa pemanggilnya. Yang bisa ia       │
-- │ lakukan menolak pelaku yang JELAS-JELAS bukan Owner, supaya penyelesaian │
-- │ tidak pernah tercatat atas nama orang yang bukan pemiliknya. Otorisasi   │
-- │ sesungguhnya tetap di lapisan aplikasi, dan tidak dipindahkan ke sini.   │
-- └──────────────────────────────────────────────────────────────────────────┘
create or replace function gwg_ubah_status_work(
  p_work_id bigint,
  p_status  text,
  p_alasan  text,
  p_oleh    text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_owner  text;
  v_alasan text;
begin
  if coalesce(trim(p_oleh), '') = '' then
    raise exception 'pelaku perubahan status work wajib disebut';
  end if;

  if p_status not in ('open', 'in_progress', 'completed', 'cancelled') then
    raise exception 'status work % tidak dikenal — hanya open, in_progress, completed, dan cancelled', coalesce(p_status, '(kosong)');
  end if;

  select w.status, w.owner_id into v_status, v_owner from works w where w.id = p_work_id for update;
  if not found then
    raise exception 'work % tidak ditemukan', coalesce(p_work_id::text, '(kosong)');
  end if;

  -- Diperiksa SEBELUM penjaga terminal: status yang diminta sama dengan status
  -- sekarang tidak mengubah apa pun, termasuk pada Work yang sudah selesai.
  -- Yang dilarang AD-20 · G perubahannya, bukan penyebutannya (AD-20 · E).
  if v_status = p_status then
    return jsonb_build_object('id', p_work_id, 'status', v_status, 'berubah', false);
  end if;

  if v_status in ('completed', 'cancelled') then
    raise exception 'work % sudah % dan tidak dapat dibuka kembali — pekerjaan lanjutan adalah work baru, bukan work lama yang dihidupkan', p_work_id, v_status;
  end if;

  if (v_status, p_status) not in (
    ('open', 'in_progress'),
    ('in_progress', 'completed'),
    ('open', 'cancelled'),
    ('in_progress', 'cancelled')
  ) then
    raise exception 'transisi status work % dari % ke % tidak sah — yang dinyatakan selesai harus lebih dulu dinyatakan dikerjakan', p_work_id, v_status, p_status;
  end if;

  v_alasan := nullif(trim(coalesce(p_alasan, '')), '');

  if p_status = 'cancelled' and v_alasan is null then
    raise exception 'pembatalan work % wajib beralasan — yang menghentikan pekerjaan tanpa alasan tertulis tidak dapat ditagih siapa pun', p_work_id;
  end if;

  if p_status = 'completed' and p_oleh is distinct from v_owner then
    raise exception 'penyelesaian work % hanya tercatat atas nama ownernya (%), bukan %', p_work_id, v_owner, p_oleh;
  end if;

  -- Riwayat lebih dulu, `works` sesudahnya — sama dengan `gwg_ubah_work`.
  insert into work_riwayat (work_id, jenis, nilai_lama, nilai_baru, alasan, oleh)
  values (p_work_id, 'status', v_status, p_status, v_alasan, p_oleh);

  update works
     set status          = p_status,
         diperbarui_pada = now()
   where id = p_work_id;

  return jsonb_build_object('id', p_work_id, 'status', p_status, 'berubah', true);
end;
$$;

revoke all on function gwg_ubah_status_work(bigint, text, text, text) from public, anon, authenticated;
grant execute on function gwg_ubah_status_work(bigint, text, text, text) to service_role;
