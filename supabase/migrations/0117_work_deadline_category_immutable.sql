-- Operational V.1 · Z-02 / STEP 8A — `tenggat_kategori` ikut dibekukan.
--
-- ┌─ SATU KOLOM YANG TERLEWAT, DAN KENAPA IA PENTING ────────────────────────┐
-- │                                                                          │
-- │ T-G pada `0116` membekukan empat kolom snapshot perhitungan tenggat:     │
-- │ `tenggat_anchor`, `tenggat_anchor_pada`, `tenggat_zona`, dan             │
-- │ `tenggat_kebijakan_versi`. `tenggat_kategori` tidak ikut — padahal       │
-- │ DIALAH masukan kebijakan yang melahirkan tenggatnya.                     │
-- │                                                                          │
-- │ Akibatnya satu `UPDATE works SET tenggat_kategori = 'urgent'` berhasil   │
-- │ tanpa jejak, tanpa alasan, dan bahkan pada Work yang sudah `completed`.  │
-- │ Layar lalu menulis "Urgent" di sebelah tenggat yang dihitung dari        │
-- │ "Normal" — dan tidak ada satu pun yang terlihat salah dari mana pun.     │
-- │                                                                          │
-- │ Ditemukan Z-02 Step 8 Discovery (GAP-03); dikunci Owner sebagai          │
-- │ OD-STEP8-01 = A: DIBEKUKAN, bukan diberi riwayat.                        │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ YANG TIDAK BERUBAH SAMA SEKALI ─────────────────────────────────────────┐
-- │                                                                          │
-- │   `tenggat`   TETAP dapat digeser lewat `gwg_ubah_work` — beralasan dan  │
-- │               beriwayat, persis seperti sebelumnya (O-09, I-19).         │
-- │                                                                          │
-- │ Dua fakta yang sejak awal ingin dibedakan `0114` karena itu tetap        │
-- │ terbaca selamanya: tenggat hasil kebijakan, dan tenggat yang digeser     │
-- │ orang. Yang ditutup di sini justru jalan ketiga yang tidak pernah        │
-- │ dimaksudkan ada — menggeser KEBIJAKANNYA, diam-diam.                     │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ MEMPERKETAT, TIDAK MENAMBAH ────────────────────────────────────────────┐
-- │                                                                          │
-- │ Tidak ada tabel, kolom, constraint, index, enum, FK, jenis riwayat,      │
-- │ trigger, maupun RPC yang dibuat atau diubah bentuknya. Yang ada hanya    │
-- │ SATU fungsi trigger yang digantikan isinya lewat                         │
-- │ `create or replace function` — pola yang sama dengan `0113` dan `0116`.  │
-- │ Seluruh aturan lama disalin apa adanya; tidak satu pun dicabut.          │
-- │                                                                          │
-- │ `0114`, `0115`, dan `0116` TIDAK DIUBAH.                                 │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Lihat AD-19 dan AD-20 · docs/operational-v1/decisions.md —
-- I-09 · I-10 · I-11 · I-19 · I-20 · I-21 · I-22 · I-23 · I-24 · I-25.

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
   * yang tidak boleh adalah menghapus jejak perhitungan aslinya.
   *
   * ┌─ `tenggat_kategori` IKUT DI SINI, DAN ITU KOREKSI ──────────────────┐
   * │                                                                     │
   * │ Ia MASUKAN kebijakan, bukan hasilnya: `urgent` melahirkan satu hari,│
   * │ `normal` melahirkan lima. Membiarkannya bergerak sementara tenggat  │
   * │ yang lahir darinya tidak ikut bergerak menghasilkan baris yang      │
   * │ membantah dirinya sendiri — dan pertanyaan "kenapa Work urgent ini  │
   * │ tenggatnya lima hari" tidak akan bisa dijawab siapa pun.            │
   * │                                                                     │
   * │ Dibekukan tanpa memandang status: `open`, `in_progress`,            │
   * │ `completed`, maupun `cancelled`. Tidak ada jalan pintas lewat       │
   * │ keadaan mana pun (OD-STEP8-01 = A).                                 │
   * └─────────────────────────────────────────────────────────────────────┘ */
  if new.tenggat_kategori        is distinct from old.tenggat_kategori
     or new.tenggat_anchor       is distinct from old.tenggat_anchor
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
-- Tidak ada trigger kedua yang lahir, dan urutan abjad tidak pernah jadi soal.
