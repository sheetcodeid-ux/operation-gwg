#!/usr/bin/env node --experimental-strip-types
/**
 * BASIS DATA UJI OPERATIONAL V.1 — PostgreSQL lokal, bukan produksi.
 *
 * ┌─ KENAPA ADA BERKAS INI ──────────────────────────────────────────────────┐
 * │                                                                          │
 * │ Migrasi 0103 memasang foreign key, CHECK, unique index, dan RLS. Tidak   │
 * │ satu pun dari itu bisa diuji dengan vitest: `expect()` tidak tahu apa    │
 * │ yang akan ditolak PostgreSQL. Satu-satunya cara memastikan sebuah CHECK  │
 * │ benar-benar menolak adalah MENCOBA MEMASUKKAN yang salah dan melihatnya  │
 * │ ditolak.                                                                 │
 * │                                                                          │
 * │ Dan itu tidak boleh dicoba di produksi. Jadi: PostgreSQL yang sudah      │
 * │ terpasang di mesin ini, basis data sendiri, dibuat dan dihancurkan tiap  │
 * │ kali dijalankan.                                                         │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * TIDAK MENYENTUH PRODUKSI, TITIK. Tidak ada kredensial Supabase yang dibaca,
 * tidak ada jaringan yang dihubungi, tidak ada variabel lingkungan produksi
 * yang dipakai. Kalau berkas ini suatu hari butuh salah satunya, yang benar
 * adalah menolak menjalankannya — bukan menambahkannya.
 *
 * MEMAKAI `psql`, BUKAN PUSTAKA NPM. Menambah `pg` ke package.json berarti
 * menambah dependensi produksi demi sebuah skrip uji, dan CI ikut mengunduhnya
 * tiap kali. `psql` sudah ada bersama PostgreSQL-nya.
 *
 * Jalankan:  npm run test:db
 *            npm run test:db -- --data <folder>    ← dengan data Agustus asli
 *            npm run test:db -- --simpan           ← sisakan basis datanya
 *            npm run test:db -- --keluar <berkas>  ← tulis SQL backfill-nya
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { petaCabangOutlet, saringFakta, outletTanpaCabang } from "../src/lib/ops/sales-fact.ts";
import { hitungSales, KPI } from "../src/lib/ops/kpi-sales.ts";
import { hitungKeuangan, KPI_KEUANGAN } from "../src/lib/ops/kpi-finansial.ts";
import { hitungTargetSales } from "../src/lib/ops/target-sales.ts";
import { hariBerjalan, jumlahHari } from "../src/lib/ops/waktu.ts";

const DB = "gwg_v1_uji";
const AKAR = process.cwd();
const MIGRASI = join(AKAR, "supabase/migrations/0103_kpi_target.sql");

const arg = (nama) => {
  const i = process.argv.indexOf(nama);
  return i === -1 ? null : (process.argv[i + 1] ?? true);
};
const DATA = arg("--data");
const SIMPAN = process.argv.includes("--simpan");
const PERIODE = arg("--periode") || "2026-08";
/** Tempat menulis SQL backfill, kalau diminta. Tidak pernah dijalankan skrip ini. */
const KELUAR = arg("--keluar");

/**
 * Outlet yang dipakai uji batasan.
 *
 * Diganti isi data sungguhan begitu `--data` diberikan. Kalau tetap `o1`
 * padahal outletnya bernama lain, seluruh uji batasan ditolak karena outletnya
 * tidak ada — bukan karena batasan yang sedang diuji. Ditolak karena alasan
 * yang salah terlihat persis seperti lulus.
 */
let outletUji = "o1";

/* ─────────────────────────── alat ─────────────────────────── */

let lulus = 0;
let gagal = 0;
const catatanGagal = [];

const rp = (n) =>
  n === null || n === undefined ? "—" : `Rp ${Math.round(n).toLocaleString("id-ID")}`;

function ok(nama, benar, rinci = "") {
  if (benar) {
    lulus += 1;
    console.log(`  ✓ ${nama}${rinci ? ` — ${rinci}` : ""}`);
  } else {
    gagal += 1;
    catatanGagal.push(nama);
    console.log(`  ✗ ${nama}${rinci ? ` — ${rinci}` : ""}`);
  }
}

function judul(teks) {
  console.log(`\n${teks}\n${"─".repeat(teks.length)}`);
}

/** Jalankan SQL sebagai superuser lokal. SQL lewat stdin, bukan lewat berkas.
 *
 *  Lewat berkas pernah menipu: berkas di folder sementara tidak terbaca oleh
 *  pengguna `postgres`, `psql` gagal membukanya, dan seluruh uji "lulus" karena
 *  tabelnya memang tidak pernah ada. Lewat stdin, kegagalan semacam itu tidak
 *  bisa menyamar jadi keberhasilan. */
function sql(perintah, { db = DB, peran = null, diam = false } = {}) {
  const args = ["-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-X", "-q", "-A", "-t", "-d", db];
  if (peran) args.push("-c", `set role ${peran};`);
  args.push("-f", "-");
  try {
    return execFileSync("sudo", args, { input: perintah, encoding: "utf8" }).trim();
  } catch (e) {
    if (diam) throw e;
    const pesan = (e.stderr || e.message || "").toString().trim();
    throw new Error(pesan);
  }
}

/** Benar bila SQL-nya DITOLAK — dan galatnya memuat `pola`. */
function ditolak(nama, perintah, pola) {
  try {
    sql(perintah, { diam: true });
    ok(nama, false, "DITERIMA padahal seharusnya ditolak");
  } catch (e) {
    const pesan = (e.stderr || e.message || "").toString();
    const cocok = !pola || pesan.includes(pola);
    ok(nama, cocok, cocok ? "ditolak" : `ditolak, tapi bukan karena ${pola}`);
  }
}

const satu = (perintah, opsi) => sql(perintah, opsi).split("\n")[0] ?? "";

/**
 * Jawaban boolean dari psql.
 *
 * `boolean::text` menghasilkan "true"/"false", sedangkan psql menampilkan tipe
 * boolean apa adanya sebagai "t"/"f". Membandingkan dengan salah satunya saja
 * membuat uji GAGAL padahal basis datanya benar — dan gagal karena alasan yang
 * salah sama membingungkannya dengan lulus karena alasan yang salah.
 */
const benar = (jawab) => jawab === "t" || jawab === "true";

/* ─────────────────────────── 1 · klaster ─────────────────────────── */

function pastikanHidup() {
  judul("1 · PostgreSQL lokal");
  const status = execFileSync("pg_lsclusters", { encoding: "utf8" });
  if (!/online/.test(status)) {
    console.log("  klaster mati, dinyalakan…");
    execFileSync("sudo", ["pg_ctlcluster", "16", "main", "start"], { stdio: "inherit" });
  }
  const versi = satu("select version();", { db: "postgres" });
  ok("klaster hidup", versi.includes("PostgreSQL"), versi.split(" ").slice(0, 2).join(" "));
}

function basisDataBaru() {
  // Dijatuhkan lebih dulu: sisa dari jalan sebelumnya membuat uji unique
  // "lulus" karena barisnya memang sudah ada dari kemarin.
  sql(`drop database if exists ${DB};`, { db: "postgres" });
  sql(`create database ${DB};`, { db: "postgres" });
  ok("basis data uji dibuat bersih", true, DB);
}

/* ─────────────────── 2 · perancah: bentuk tabel produksi ─────────────────── */

/**
 * Tabel yang ditunjuk migrasi 0103, dengan TIPE KOLOM YANG SAMA PERSIS seperti
 * produksi (diperiksa lewat information_schema, 16 September 2026).
 *
 * `outlets.id`, `areas.id`, dan `users.id` semuanya `text`, bukan uuid. Kalau
 * perancah ini memakai uuid, foreign key-nya gagal dipasang dan seluruh uji di
 * bawah menguji tabel yang tidak punya pengait apa pun — hijau, dan tidak
 * berarti apa-apa.
 */
const PERANCAH = `
create table users (
  id text primary key,
  name text not null,
  email text not null unique,
  role text not null,
  area_id text,
  outlet_ids jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  department text,
  jabatan text,
  created_at timestamptz not null default now()
);

create table areas (
  id text primary key,
  name text not null,
  code text not null,
  coordinator_id text not null references users (id)
);

create table outlets (
  id text primary key,
  name text not null,
  code text not null,
  city text not null,
  area_id text not null references areas (id),
  supervisor_id text not null references users (id),
  pic_id text not null references users (id),
  active boolean not null default true,
  esb_branch_id text,
  gross_manual boolean not null default false,
  esb_mulai text check (esb_mulai is null or esb_mulai ~ '^\\d{4}-\\d{2}$'),
  buka_tanggal date,
  esb_abaikan text[],
  owner text
);

create table seasonal_daily (
  day date not null,
  branch text not null default '',
  gross numeric not null default 0,
  net numeric not null default 0,
  pax integer,
  bills integer,
  synced_at timestamptz not null default now(),
  primary key (day, branch)
);

-- Bentuk LAMA persis seperti 0017_op_finance.sql: sebelas kolom angka
-- not-null-default-nol. Itulah keterbatasan yang diuji, bukan diperbaiki.
create table op_expenses (
  month         text not null,
  outlet_code   text not null,
  outlet_name   text not null default '',
  utilitas      numeric not null default 0,
  sewa          numeric not null default 0,
  tenaga_kerja  numeric not null default 0,
  potongan      numeric not null default 0,
  manajemen_fee numeric not null default 0,
  pemasaran     numeric not null default 0,
  ongkos_kirim  numeric not null default 0,
  lainnya       numeric not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (month, outlet_code)
);

create table op_purchases (
  month         text not null,
  outlet_code   text not null,
  outlet_name   text not null default '',
  warehouse     numeric not null default 0,
  non_warehouse numeric not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (month, outlet_code)
);

create table op_pnl (
  month        text not null,
  outlet_code  text not null,
  outlet_name  text not null default '',
  pendapatan   numeric not null default 0,
  hpp          numeric not null default 0,
  beban        numeric not null default 0,
  laba_bersih  numeric not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (month, outlet_code)
);

create table esb_net_bulanan (
  branch text not null,
  periode text not null,
  net numeric not null default 0,
  bills integer,
  pax integer,
  primary key (branch, periode)
);
`;

function perancah() {
  judul("2 · perancah tabel yang ditunjuk migrasi");
  sql(PERANCAH);
  const n = satu(`select count(*) from information_schema.tables where table_schema='public';`);
  ok("tabel penunjuk berdiri", Number(n) === 8, `${n} tabel`);
  const tipe = satu(`select data_type from information_schema.columns where table_name='outlets' and column_name='id';`);
  ok("outlets.id bertipe text, seperti produksi", tipe === "text", tipe);
}

/* ─────────────────────── 3 · migrasi 0103 ─────────────────────── */

function jalankanMigrasi() {
  judul("3 · migrasi 0103_kpi_target.sql");
  if (!existsSync(MIGRASI)) throw new Error(`migrasi tidak ditemukan: ${MIGRASI}`);
  sql(readFileSync(MIGRASI, "utf8"));

  const tabel = sql(
    `select table_name from information_schema.tables where table_schema='public' and table_name in ('kpi_definitions','kpi_values','targets') order by 1;`,
  ).split("\n");
  ok("tiga tabel V.1 lahir", tabel.length === 3, tabel.join(", "));

  const definisi = Number(satu(`select count(*) from kpi_definitions where kelompok='sales';`));
  ok("lima definisi KPI Sales terpasang", definisi === 5, `${definisi} definisi`);

  const rls = sql(
    `select relname from pg_class where relname in ('kpi_definitions','kpi_values','targets') and relrowsecurity order by 1;`,
  ).split("\n");
  ok("RLS aktif di ketiganya", rls.length === 3, rls.join(", "));

  const policy = satu(
    `select count(*) from pg_policies where tablename in ('kpi_definitions','kpi_values','targets');`,
  );
  ok("TANPA policy permisif — anon tertolak secara bawaan", Number(policy) === 0, `${policy} policy`);
}

/* ────────────────────── 4 · isi contoh minimum ────────────────────── */

function isiContoh() {
  sql(`
    insert into users (id, name, email, role) values ('u1', 'Uji', 'uji@gwg.test', 'super_admin');
    insert into areas (id, name, code, coordinator_id) values ('a1', 'Area Uji', 'AU', 'u1');
    insert into outlets (id, name, code, city, area_id, supervisor_id, pic_id, esb_branch_id)
      values ('o1', 'Outlet Uji', 'OU', 'Pontianak', 'a1', 'u1', 'u1', 'b1');
  `);
}

/* ────────────────────── 5 · yang harus DITOLAK ────────────────────── */

function ujiBatasan() {
  judul("5 · batasan basis data — yang salah harus DITOLAK");

  ditolak(
    "FK: kpi_definition_id yang tidak ada",
    `insert into kpi_values (kpi_definition_id, cakupan, outlet_id, periode, skala, nilai, sumber, rumus)
     values ('sales.tidak_ada', 'outlet', '${outletUji}', '2026-08', 'bulanan', 1, 's', 'r');`,
    "foreign key",
  );

  ditolak(
    "FK: outlet_id yang tidak ada",
    `insert into kpi_values (kpi_definition_id, cakupan, outlet_id, periode, skala, nilai, sumber, rumus)
     values ('sales.net_sales', 'outlet', 'o-hantu', '2026-08', 'bulanan', 1, 's', 'r');`,
    "foreign key",
  );

  ditolak(
    "FK restrict: outlet yang punya angka tidak bisa dihapus",
    `insert into kpi_values (kpi_definition_id, cakupan, outlet_id, periode, skala, nilai, sumber, rumus)
       values ('sales.net_sales', 'outlet', '${outletUji}', '2026-01', 'bulanan', 1, 's', 'r');
     delete from outlets where id = '${outletUji}';`,
    "foreign key",
  );

  // Skala karangan ditolak DUA KALI: oleh `kpi_values_skala_check`, dan oleh
  // `kpi_values_periode_bentuk` yang memang tidak punya cabang untuknya.
  // PostgreSQL tidak menjanjikan mana yang diperiksa lebih dulu, jadi yang
  // diuji di sini "ditolak", bukan "ditolak oleh yang ini". Bahwa batasannya
  // sendiri terpasang dibuktikan terpisah, di bawah.
  ditolak(
    "CHECK skala: 'harianan' bukan skala",
    `insert into kpi_values (kpi_definition_id, cakupan, outlet_id, periode, skala, nilai, sumber, rumus)
     values ('sales.net_sales', 'outlet', '${outletUji}', '2026-08', 'harianan', 1, 's', 'r');`,
    "kpi_values_",
  );

  const daftarCheck = sql(
    `select conname from pg_constraint where conrelid = 'kpi_values'::regclass and contype = 'c' order by 1;`,
  ).split("\n");
  for (const nama of [
    "kpi_values_skala_check",
    "kpi_values_status_check",
    "kpi_values_periode_bentuk",
    "kpi_values_cakupan_cocok",
    "kpi_values_nilai_sepakat",
    "kpi_values_kelengkapan_check",
    "kpi_values_versi_check",
  ]) {
    ok(`batasan ${nama} terpasang`, daftarCheck.includes(nama));
  }

  ditolak(
    "CHECK periode: '2026-8' bukan bentuk bulanan",
    `insert into kpi_values (kpi_definition_id, cakupan, outlet_id, periode, skala, nilai, sumber, rumus)
     values ('sales.net_sales', 'outlet', '${outletUji}', '2026-8', 'bulanan', 1, 's', 'r');`,
    "kpi_values_periode_bentuk",
  );

  ditolak(
    "CHECK periode: tanggal penuh tidak sah untuk skala bulanan",
    `insert into kpi_values (kpi_definition_id, cakupan, outlet_id, periode, skala, nilai, sumber, rumus)
     values ('sales.net_sales', 'outlet', '${outletUji}', '2026-08-01', 'bulanan', 1, 's', 'r');`,
    "kpi_values_periode_bentuk",
  );

  ditolak(
    "CHECK cakupan: 'outlet' tanpa outlet_id",
    `insert into kpi_values (kpi_definition_id, cakupan, periode, skala, nilai, sumber, rumus)
     values ('sales.net_sales', 'outlet', '2026-08', 'bulanan', 1, 's', 'r');`,
    "kpi_values_cakupan_cocok",
  );

  ditolak(
    "CHECK cakupan: 'korporat' yang justru membawa outlet_id",
    `insert into kpi_values (kpi_definition_id, cakupan, outlet_id, periode, skala, nilai, sumber, rumus)
     values ('sales.net_sales', 'korporat', '${outletUji}', '2026-08', 'bulanan', 1, 's', 'r');`,
    "kpi_values_cakupan_cocok",
  );

  ditolak(
    "CHECK: status tidak_tersedia TIDAK BOLEH membawa angka",
    `insert into kpi_values (kpi_definition_id, cakupan, outlet_id, periode, skala, nilai, status, sumber, rumus)
     values ('sales.net_sales', 'outlet', '${outletUji}', '2026-08', 'bulanan', 0, 'tidak_tersedia', 's', 'r');`,
    "kpi_values_nilai_sepakat",
  );

  ditolak(
    "CHECK: target berumus wajib menyebut rumusnya",
    `insert into targets (kpi_definition_id, cakupan, outlet_id, periode, skala, nilai, sumber)
     values ('sales.monthly_target', 'outlet', '${outletUji}', '2026-08', 'bulanan', 1, 'rumus');`,
    "targets_asal_jelas",
  );

  ditolak(
    "CHECK: target tangan wajib menyebut pembuatnya",
    `insert into targets (kpi_definition_id, cakupan, outlet_id, periode, skala, nilai, sumber)
     values ('sales.monthly_target', 'outlet', '${outletUji}', '2026-08', 'bulanan', 1, 'manual');`,
    "targets_asal_jelas",
  );
}

/* ────────────── 6 · unique: termasuk baris korporat ber-NULL ────────────── */

function ujiUnik() {
  judul("6 · unique — termasuk baris korporat yang penunjuknya NULL");

  const baris = (cakupan, outlet, versi, terkini) =>
    `insert into kpi_values (kpi_definition_id, cakupan, ${outlet ? "outlet_id, " : ""}periode, skala, nilai, sumber, rumus, versi, terkini)
     values ('sales.net_sales', '${cakupan}', ${outlet ? `'${outlet}', ` : ""}'2026-09', 'bulanan', 1, 's', 'r', ${versi}, ${terkini});`;

  const takTerkini = (cakupan, outlet) =>
    `update kpi_values set terkini = false where cakupan = '${cakupan}' and periode = '2026-09'
       and ${outlet ? `outlet_id = '${outlet}'` : "outlet_id is null"};`;

  // Dua penjaga yang berbeda, dan keduanya diuji sendiri-sendiri. Kalau
  // duplikatnya dimasukkan dalam keadaan terkini, `terkini_unik` yang menangkap
  // lebih dulu — dan `versi_unik` tidak pernah terbukti bekerja.

  /* ── satu angka berlaku per periode ── */

  sql(baris("outlet", outletUji, 1, true));
  ditolak(
    "hanya satu baris yang boleh terkini per outlet per periode",
    baris("outlet", outletUji, 2, true),
    "kpi_values_terkini_unik",
  );

  /* ── versi yang sama tidak boleh masuk dua kali ── */

  sql(takTerkini("outlet", outletUji));
  ditolak(
    "versi yang sama ditolak walau keduanya tidak terkini",
    baris("outlet", outletUji, 1, false),
    "kpi_values_versi_unik",
  );

  /* ── inilah celah yang ditutup kolom `cakupan_id` ── */

  sql(baris("korporat", null, 1, true));
  ditolak(
    "KORPORAT terkini kembar ditolak walau kedua penunjuknya NULL",
    baris("korporat", null, 2, true),
    "kpi_values_terkini_unik",
  );
  sql(takTerkini("korporat", null));
  ditolak(
    "KORPORAT versi kembar ditolak walau kedua penunjuknya NULL",
    baris("korporat", null, 1, false),
    "kpi_values_versi_unik",
  );

  const nKorporat = satu(`select count(*) from kpi_values where cakupan='korporat' and periode='2026-09';`);
  ok("hanya satu baris korporat yang lolos", Number(nKorporat) === 1, `${nKorporat} baris`);

  const kunci = satu(`select distinct cakupan_id from kpi_values where cakupan='korporat' and periode='2026-09';`);
  ok("kunci korporat tidak pernah NULL", kunci === "~korporat", kunci);

  // Pembuktian dari sisi sebaliknya: penunjuknya MEMANG null, jadi celah yang
  // ditutup `cakupan_id` itu nyata — bukan masalah yang dikarang.
  const nullKunci = satu(
    `select count(*) from kpi_values where cakupan='korporat' and outlet_id is null and area_id is null;`,
  );
  ok("baris korporat memang berpenunjuk NULL, jadi celahnya nyata", Number(nullKunci) === 1, `${nullKunci} baris`);

  /* ── riwayat versi hidup berdampingan ── */

  sql(baris("outlet", outletUji, 2, true));
  const versi = sql(
    `select versi || ':' || terkini from kpi_values where cakupan='outlet' and outlet_id='${outletUji}' and periode='2026-09' order by versi;`,
  ).split("\n");
  ok("riwayat versi tersimpan, tidak ditimpa", versi.length === 2, versi.join(" · "));

  const terkini = satu(
    `select versi from kpi_values where cakupan='outlet' and outlet_id='${outletUji}' and periode='2026-09' and terkini;`,
  );
  ok("yang terkini tepat versi terbaru", terkini === "2", `versi ${terkini}`);
}

/* ─────────────────────────── 7 · RLS ─────────────────────────── */

function ujiRls() {
  judul("7 · RLS — anon tidak boleh membaca satu baris pun");

  sql(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname='uji_anon') then create role uji_anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname='uji_service') then create role uji_service nologin bypassrls; end if;
    end $$;
    grant usage on schema public to uji_anon, uji_service;
    grant select on all tables in schema public to uji_anon, uji_service;
  `);

  const total = Number(satu(`select count(*) from kpi_values;`));
  ok("sebagai superuser, barisnya memang ada", total > 0, `${total} baris`);

  const anon = Number(satu(`select count(*) from kpi_values;`, { peran: "uji_anon" }));
  ok("anon membaca NOL baris kpi_values", anon === 0, `${anon} baris`);

  const anonTarget = Number(satu(`select count(*) from targets;`, { peran: "uji_anon" }));
  ok("anon membaca NOL baris targets", anonTarget === 0, `${anonTarget} baris`);

  const anonDef = Number(satu(`select count(*) from kpi_definitions;`, { peran: "uji_anon" }));
  ok("anon membaca NOL baris kpi_definitions", anonDef === 0, `${anonDef} baris`);

  const layanan = Number(satu(`select count(*) from kpi_values;`, { peran: "uji_service" }));
  ok("service role tetap membaca seluruhnya", layanan === total, `${layanan} baris`);

  // Dan penjaganya sendiri terbukti bekerja: begitu policy ditambahkan, anon
  // melihat sesuatu. Tanpa pembuktian ini, "anon melihat nol" bisa saja berarti
  // tabelnya memang kosong.
  sql(`create policy uji_buka on kpi_values for select to uji_anon using (true);`);
  const setelah = Number(satu(`select count(*) from kpi_values;`, { peran: "uji_anon" }));
  ok("nol tadi memang karena RLS, bukan karena tabelnya kosong", setelah === total, `${setelah} baris setelah policy`);
  sql(`drop policy uji_buka on kpi_values;`);
  ok("policy uji dicabut lagi", Number(satu(`select count(*) from pg_policies where tablename='kpi_values';`)) === 0);
}

/* ──────────────── 8 · data Agustus: perancah + isi ──────────────── */

function muatData() {
  const fOutlet = join(DATA, "agustus-2026.outlets.txt");
  const fHarian = join(DATA, "agustus-2026.seasonal.txt");
  const fBulanan = join(DATA, "esb-net-bulanan.txt");
  for (const f of [fOutlet, fHarian, fBulanan]) {
    if (!existsSync(f)) throw new Error(`berkas data tidak ada: ${f}`);
  }

  const baris = (f) => readFileSync(f, "utf8").split("\n").filter((b) => b.length > 0);
  const kutip = (s) => (s === null ? "null" : `'${String(s).replace(/'/g, "''")}'`);

  // ── outlets ──
  const outlets = baris(fOutlet).map((b) => {
    const [id, nama, kode, areaId, cabang, aktif, manual, buka, esbMulai] = b.split("|");
    return {
      id,
      name: nama,
      code: kode,
      areaId,
      esbBranchId: cabang || null,
      active: aktif === "1",
      grossManual: manual === "1",
      bukaTanggal: buka || null,
      esbMulai: esbMulai || null,
    };
  });

  const areaIds = [...new Set(outlets.map((o) => o.areaId))];
  sql(`
    insert into users (id, name, email, role) values ('u1', 'Uji', 'uji@gwg.test', 'super_admin');
    ${areaIds.map((a, i) => `insert into areas (id, name, code, coordinator_id) values (${kutip(a)}, 'Area ${i + 1}', 'A${i + 1}', 'u1');`).join("\n")}
  `);
  sql(
    outlets
      .map(
        (o) =>
          `insert into outlets (id, name, code, city, area_id, supervisor_id, pic_id, active, esb_branch_id, gross_manual, buka_tanggal, esb_mulai) values (${kutip(o.id)}, ${kutip(o.name)}, ${kutip(o.code)}, 'Pontianak', ${kutip(o.areaId)}, 'u1', 'u1', ${o.active}, ${kutip(o.esbBranchId)}, ${o.grossManual}, ${kutip(o.bukaTanggal)}, ${kutip(o.esbMulai)});`,
      )
      .join("\n"),
  );

  // ── seasonal_daily ──
  const angka = (s) => (s === "" ? null : Number(s));
  const harian = [];
  for (const b of baris(fHarian)) {
    const [cabang, nets, paxs, bills] = b.split(";");
    const n = nets.split(",");
    const p = paxs.split(",");
    const t = bills.split(",");
    for (let i = 0; i < n.length; i += 1) {
      harian.push({
        branch: cabang,
        day: `${PERIODE}-${String(i + 1).padStart(2, "0")}`,
        // Agustus 2026 diperiksa: gross sama persis dengan net di SELURUH
        // 1.860 barisnya (migrasi 0072, `gross_ikut_net_sales`).
        net: angka(n[i]),
        gross: angka(n[i]),
        pax: angka(p[i]),
        bills: angka(t[i]),
      });
    }
  }
  const nilaiHarian = harian
    .map((r) => `(${kutip(r.day)}::date, ${kutip(r.branch)}, ${r.gross ?? 0}, ${r.net ?? 0}, ${r.pax ?? "null"}, ${r.bills ?? "null"})`)
    .join(",\n");
  sql(`insert into seasonal_daily (day, branch, gross, net, pax, bills) values\n${nilaiHarian};`);

  // ── esb_net_bulanan ──
  const bulanan = baris(fBulanan).map((b) => {
    const [periode, cabang, net] = b.split("|");
    return { periode, branch: cabang, net: Number(net) };
  });
  sql(
    `insert into esb_net_bulanan (branch, periode, net) values\n${bulanan
      .map((r) => `(${kutip(r.branch)}, ${kutip(r.periode)}, ${r.net})`)
      .join(",\n")};`,
  );

  // Uji batasan memakai outlet yang BENAR-BENAR ada di data ini.
  outletUji = outlets.find((o) => o.active && o.esbBranchId)?.id ?? outlets[0].id;

  return { outlets, jumlahHarian: harian.length, jumlahBulanan: bulanan.length };
}

/* ──────────── 9 · rekonsiliasi A = B = C ──────────── */

/**
 * A — halaman Daily yang berjalan sekarang.
 *
 * Ditiru persis: daftar cabang dari outlet aktif yang punya `esb_branch_id`
 * (`cabangDaily()`, `src/lib/data/kelengkapan-daily.ts`), lalu
 * `.in("branch", cabang)` pada rentang bulan itu (`netHarian()`,
 * `src/lib/data/daily-outlet.ts`). Ditulis sebagai SQL supaya benar-benar
 * dijalankan basis data, bukan dihitung ulang di JavaScript dengan angka yang
 * sama — dua hitungan JavaScript yang sama hanya membuktikan JavaScript
 * konsisten dengan dirinya sendiri.
 */
function metodeA() {
  const keluaran = sql(`
    with cabang as (
      select id as outlet_id, esb_branch_id as branch
      from outlets where active and esb_branch_id is not null
    )
    select c.outlet_id || '|' || coalesce(sum(s.net), 0) || '|' || count(s.day)
    from cabang c
    left join seasonal_daily s
      on s.branch = c.branch
     and s.day between '${PERIODE}-01' and '${PERIODE}-${String(jumlahHari(PERIODE)).padStart(2, "0")}'
    group by c.outlet_id
    order by c.outlet_id;
  `);
  return new Map(
    keluaran
      .split("\n")
      .filter(Boolean)
      .map((b) => {
        const [outletId, net, hari] = b.split("|");
        return [outletId, { net: Number(net), hari: Number(hari) }];
      }),
  );
}

/** B — `sales-fact.ts`: baris mentah disaring lewat peta cabang→outlet. */
function metodeB(outlets) {
  const mentah = sql(`
    select branch || '|' || day || '|' || net || '|' || gross || '|' || coalesce(pax::text,'') || '|' || coalesce(bills::text,'')
    from seasonal_daily
    where day between '${PERIODE}-01' and '${PERIODE}-${String(jumlahHari(PERIODE)).padStart(2, "0")}'
    order by branch, day;
  `);
  const baris = mentah
    .split("\n")
    .filter(Boolean)
    .map((b) => {
      const [branch, day, net, gross, pax, bills] = b.split("|");
      return {
        branch,
        day,
        net: Number(net),
        gross: Number(gross),
        pax: pax === "" ? null : Number(pax),
        bills: bills === "" ? null : Number(bills),
      };
    });
  return { baris, hasil: saringFakta(baris, petaCabangOutlet(outlets)) };
}

/* ─────────────────── laporan rekonsiliasi ─────────────────── */

function rekonsiliasi(outlets) {
  judul(`9 · rekonsiliasi ${PERIODE} — A (Daily) vs B (sales-fact) vs C (KPI V.1)`);

  const aktif = outlets.filter((o) => o.active);
  const peta = petaCabangOutlet(outlets);
  const a = metodeA();
  const { baris, hasil } = metodeB(outlets);
  const { fakta, dibuang } = hasil;

  // ── C: lewat mesin KPI V.1 yang sesungguhnya ──
  const riwayat = new Map();
  const bulanan = sql(`select branch || '|' || periode || '|' || net from esb_net_bulanan order by 1;`)
    .split("\n")
    .filter(Boolean);
  const outletDariCabang = new Map(aktif.filter((o) => o.esbBranchId).map((o) => [o.esbBranchId, o.id]));
  for (const b of bulanan) {
    const [cabang, periode, net] = b.split("|");
    const id = outletDariCabang.get(cabang);
    if (id) riwayat.set(`${id}|${periode}`, Number(net));
  }

  const PERTUMBUHAN = Number(arg("--tumbuh") ?? 15);
  const target = hitungTargetSales({ periode: PERIODE, outlets: aktif, riwayat, pertumbuhan: PERTUMBUHAN });

  const selesai = PERIODE < new Date().toISOString().slice(0, 7);
  const c = hitungSales({
    periode: PERIODE,
    outlets: aktif.map((o) => ({
      id: o.id,
      areaId: o.areaId,
      // Aturan `grossDiketik()`: bulan sebelum `esb_mulai` angkanya ditandai
      // tidak berlaku. `esb_abaikan` tidak ada di berkas data ini.
      esbTidakBerlaku: !!(o.esbMulai && PERIODE < o.esbMulai),
    })),
    fakta,
    cacat: dibuang.cacat,
    ambang: { persen: Number(arg("--ambang") ?? 95), sumber: "parameter" },
    target,
    hariBerjalan: selesai ? jumlahHari(PERIODE) : hariBerjalan(PERIODE),
    periodeSelesai: selesai,
  });

  const netC = new Map(
    c.nilai
      .filter((n) => n.kpiDefinitionId === KPI.net && n.cakupan === "outlet")
      .map((n) => [n.outletId, n.nilai]),
  );

  /* ── yang dibuang, disebut satu per satu ── */

  console.log("\n  Baris yang TIDAK ikut, dan kenapa");
  console.log("  ─────────────────────────────────");
  const korporatNet = baris.filter((r) => (r.branch ?? "").trim() === "").reduce((n, r) => n + r.net, 0);
  console.log(`  branch = ''        ${String(dibuang.korporat).padStart(5)} baris   ${rp(korporatNet)}`);
  console.log(`                     balasan ESB untuk "seluruh cabang" — bukan sebuah outlet`);
  let yatimNet = 0;
  for (const cabang of dibuang.cabangYatim) {
    const n = baris.filter((r) => r.branch === cabang).reduce((s, r) => s + r.net, 0);
    yatimNet += n;
    const hari = baris.filter((r) => r.branch === cabang).length;
    console.log(`  ${cabang.padEnd(18)} ${String(hari).padStart(5)} baris   ${rp(n)}`);
  }
  console.log(`  baris cacat        ${String(dibuang.cacat).padStart(5)} baris`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  TOTAL DIBUANG                      ${rp(korporatNet + yatimNet)}`);

  const totalMentah = baris.reduce((n, r) => n + r.net, 0);
  const totalBersih = fakta.reduce((n, r) => n + r.net, 0);
  console.log("");
  console.log(`  SUM(net) mentah seluruh tabel      ${rp(totalMentah)}`);
  console.log(`  setelah disaring aturan V.1        ${rp(totalBersih)}`);
  console.log(`  selisih                            ${rp(totalMentah - totalBersih)}`);
  console.log(
    `  baris korporat vs jumlah cabang    ${rp(korporatNet)} vs ${rp(totalMentah - korporatNet)} → beda ${rp(totalMentah - korporatNet - korporatNet)}`,
  );
  console.log(`                                     (data cabang yang datang belakangan, bukan kesalahan hitung)`);

  const tanpaCabang = outletTanpaCabang(outlets);
  console.log("");
  console.log(`  Outlet aktif                       ${aktif.length}`);
  console.log(`  Outlet aktif tanpa cabang ESB      ${tanpaCabang.length}${tanpaCabang.length ? ` — ${tanpaCabang.map((o) => o.name).join(", ")}` : ""}`);
  console.log(`  Cabang yang terpetakan             ${peta.size}`);

  /* ── perbandingan per outlet ── */

  judul("   A = B = C, per outlet");
  let beda = 0;
  const bedaRinci = [];
  for (const o of aktif) {
    if (!o.esbBranchId) continue; // tidak punya cabang → tidak ada A sama sekali
    const nA = a.get(o.id)?.net ?? 0;
    const nB = fakta.filter((f) => f.outletId === o.id).reduce((n, f) => n + f.net, 0);
    const nC = netC.get(o.id) ?? null;
    const cocok = nA === nB && nB === (nC ?? 0);
    if (!cocok) {
      beda += 1;
      bedaRinci.push(`${o.name}: A=${rp(nA)} B=${rp(nB)} C=${rp(nC)}`);
    }
  }
  ok(`${aktif.filter((o) => o.esbBranchId).length} outlet: A = B = C`, beda === 0, beda === 0 ? "tidak ada satu pun yang berbeda" : `${beda} berbeda`);
  for (const b of bedaRinci) console.log(`     ${b}`);

  const totalA = [...a.values()].reduce((n, r) => n + r.net, 0);
  const korporatC = c.nilai.find((n) => n.cakupan === "korporat" && n.kpiDefinitionId === KPI.net)?.nilai ?? 0;
  ok("total A = total B", totalA === totalBersih, rp(totalA));
  ok("total B = total korporat C", totalBersih === korporatC, rp(korporatC));

  /* ── outlet yang ditandai ── */

  const ditandai = c.nilai.filter((n) => n.kpiDefinitionId === KPI.net && n.sumberSah === false);
  console.log("");
  console.log(`  Outlet yang angka ESB-nya ditandai tidak berlaku pada ${PERIODE}: ${ditandai.length}`);
  for (const n of ditandai) {
    const o = aktif.find((x) => x.id === n.outletId);
    console.log(`     ${o?.name} (esb_mulai ${o?.esbMulai}) — nilai ${rp(n.nilai)}, ditandai sumber_sah = false`);
  }

  /* ── target ── */

  judul("   Target bulanan");
  const punya = target.filter((t) => t.nilai !== null);
  const belum = target.filter((t) => t.alasan === "belum-tiga-bulan");
  const tanpa = target.filter((t) => t.alasan === "tanpa-riwayat");
  console.log(`  pertumbuhan yang dipakai           ${PERTUMBUHAN}%`);
  console.log(`  outlet bertarget                   ${punya.length}`);
  console.log(`  belum genap tiga bulan             ${belum.length}`);
  console.log(`  tanpa riwayat yang bisa dipakai    ${tanpa.length}${tanpa.length ? ` — ${tanpa.map((t) => aktif.find((o) => o.id === t.outletId)?.name).join(", ")}` : ""}`);
  console.log(`  total target seluruh outlet        ${rp(punya.reduce((n, t) => n + t.nilai, 0))}`);
  ok("tidak ada outlet yang hilang dari daftar target", target.length === aktif.length, `${target.length} dari ${aktif.length}`);
  ok("tidak ada target bersumber tangan", c.target.every((t) => t.sumber === "rumus"), `${c.target.length} baris target`);

  /* ── kelengkapan ── */

  judul("   Kelengkapan");
  console.log(`  ${c.kelengkapan.alasan}`);
  console.log(`  wajib ${c.kelengkapan.wajib} · ada ${c.kelengkapan.ada} · hilang ${c.kelengkapan.hilang} · cacat ${c.kelengkapan.cacat}`);

  return c;
}

/* ──────────── 10 · dry-run: tulis ke basis data LOKAL, lalu baca ──────────── */

function dryRun(c) {
  judul("10 · dry-run — ditulis ke basis data LOKAL, lalu dibaca ulang");

  const kutip = (s) => (s === null || s === undefined ? "null" : `'${String(s).replace(/'/g, "''")}'`);
  const num = (n) => (n === null || n === undefined || !Number.isFinite(n) ? "null" : String(n));

  const nilai = c.nilai
    .map(
      (n) =>
        `(${kutip(n.kpiDefinitionId)}, ${kutip(n.cakupan)}, ${kutip(n.outletId)}, ${kutip(n.areaId)}, ${kutip(n.periode)}, ${kutip(n.skala)}, ${num(n.nilai)}, ${kutip(n.status)}, ${kutip(n.sumber)}, ${kutip(n.rumus)}, ${n.rumusVersi}, ${n.sumberSah}, ${num(n.kelengkapanPersen)}, ${n.jumlahHari === null ? "null" : n.jumlahHari}, ${kutip(n.catatan)})`,
    )
    .join(",\n");

  sql(`
    insert into kpi_values
      (kpi_definition_id, cakupan, outlet_id, area_id, periode, skala, nilai, status, sumber, rumus, rumus_versi, sumber_sah, kelengkapan_persen, jumlah_hari, catatan)
    values
${nilai};
  `);
  const nTulis = Number(satu(`select count(*) from kpi_values where periode = '${PERIODE}';`));
  ok("seluruh baris KPI diterima basis data", nTulis === c.nilai.length, `${nTulis} dari ${c.nilai.length}`);

  const target = c.target
    .map(
      (t) =>
        `(${kutip(t.kpiDefinitionId)}, ${kutip(t.cakupan)}, ${kutip(t.outletId)}, ${kutip(t.periode)}, ${kutip(t.skala)}, ${t.nilai}, 'rumus', ${kutip(t.rumus)}, ${t.rumusVersi}, ${kutip(JSON.stringify(t.dasar))}::jsonb)`,
    )
    .join(",\n");
  // ── berkas backfill: persis yang akan ditulis, supaya bisa dibaca dulu ──
  //
  // SQL-nya dibangkitkan dari hasil hitungan yang SAMA dengan yang barusan
  // diterima basis data lokal — bukan diketik ulang. Yang dibaca orang sebelum
  // menyetujui adalah yang benar-benar dijalankan.
  if (KELUAR && typeof KELUAR === "string") {
    writeFileSync(
      KELUAR,
      [
        `-- Backfill Operational V.1 · periode ${PERIODE}`,
        `-- Dibangkitkan scripts/test-db.mjs dari hasil hitungan yang sudah`,
        `-- direkonsiliasi: halaman Daily = sales-fact.ts = KPI ini.`,
        `-- ${c.nilai.length} baris kpi_values, ${c.target.length} baris targets.`,
        "",
        "begin;",
        "",
        "insert into kpi_values",
        "  (kpi_definition_id, cakupan, outlet_id, area_id, periode, skala, nilai, status, sumber, rumus, rumus_versi, sumber_sah, kelengkapan_persen, jumlah_hari, catatan)",
        "values",
        `${nilai};`,
        "",
        "insert into targets",
        "  (kpi_definition_id, cakupan, outlet_id, periode, skala, nilai, sumber, rumus, rumus_versi, dasar)",
        "values",
        `${target};`,
        "",
        "commit;",
        "",
      ].join("\n"),
      "utf8",
    );
    ok("berkas backfill ditulis", true, KELUAR);
  }

  sql(`
    insert into targets
      (kpi_definition_id, cakupan, outlet_id, periode, skala, nilai, sumber, rumus, rumus_versi, dasar)
    values
${target};
  `);
  const nTarget = Number(satu(`select count(*) from targets where periode = '${PERIODE}';`));
  ok("seluruh baris target diterima basis data", nTarget === c.target.length, `${nTarget} dari ${c.target.length}`);

  // ── C dibaca KEMBALI dari basis data; inilah C yang sesungguhnya ──
  const korporatDb = satu(
    `select nilai::text from kpi_values where periode='${PERIODE}' and cakupan='korporat' and kpi_definition_id='${KPI.net}';`,
  );
  const korporatHitung = c.nilai.find((n) => n.cakupan === "korporat" && n.kpiDefinitionId === KPI.net)?.nilai;
  ok("angka korporat yang TERSIMPAN sama dengan yang dihitung", Number(korporatDb) === korporatHitung, rp(Number(korporatDb)));

  const totalDb = Number(
    satu(`select coalesce(sum(nilai),0)::text from kpi_values where periode='${PERIODE}' and cakupan='outlet' and kpi_definition_id='${KPI.net}';`),
  );
  ok("jumlah seluruh outlet yang TERSIMPAN = angka korporat", totalDb === Number(korporatDb), rp(totalDb));

  // Menjalankannya dua kali tidak boleh menghasilkan baris kembar.
  try {
    sql(
      `insert into kpi_values (kpi_definition_id, cakupan, outlet_id, area_id, periode, skala, nilai, status, sumber, rumus, rumus_versi, sumber_sah, kelengkapan_persen, jumlah_hari, catatan) values\n${nilai};`,
      { diam: true },
    );
    ok("dijalankan dua kali menghasilkan baris kembar", false, "TIDAK ditolak");
  } catch {
    ok("dijalankan dua kali DITOLAK basis data, bukan menggandakan baris", true);
  }

  console.log("");
  console.log("  Isi tabel setelah dry-run");
  console.log("  ─────────────────────────");
  for (const b of sql(`
    select d.kode || ' · ' || v.cakupan || ' · ' || count(*) || ' baris · ' ||
           count(*) filter (where v.nilai is null) || ' null · ' ||
           coalesce(sum(v.nilai)::text, '—')
    from kpi_values v join kpi_definitions d on d.id = v.kpi_definition_id
    where v.periode = '${PERIODE}'
    group by d.kode, d.urutan, v.cakupan order by d.urutan, v.cakupan;
  `).split("\n")) {
    console.log(`  ${b}`);
  }
}

/* ─────────────────────────── 15 · bersih-bersih ─────────────────────────── */

function bersihkan() {
  judul("15 · bersih-bersih");
  if (SIMPAN) {
    console.log(`  --simpan diberikan: basis data ${DB} DIBIARKAN hidup.`);
    console.log(`  Hapus sendiri dengan: sudo -u postgres dropdb ${DB}`);
    return;
  }
  sql(`drop database if exists ${DB};`, { db: "postgres" });
  sql(`drop role if exists uji_anon; drop role if exists uji_service;`, { db: "postgres" });
  sql(`drop role if exists anon; drop role if exists authenticated; drop role if exists service_role;`, { db: "postgres" });
  const sisa = satu(`select count(*) from pg_database where datname = '${DB}';`, { db: "postgres" });
  ok("basis data uji dihancurkan", Number(sisa) === 0);
}


/* ══════════════ 8 · PHASE 2B — rincian beban, kolom baru, jejak unggahan ══════════════ */

const MIGRASI_2B = join(AKAR, "supabase/migrations/0104_beban_rinci_dan_batch.sql");

/**
 * Baris beban bergaya LAMA — persis bentuk 174 baris yang sudah ada di
 * produksi: delapan kolom, tanpa satu pun kolom baru.
 *
 * Dimasukkan SEBELUM migrasi 0104 dijalankan. Itulah intinya: yang diuji bukan
 * "apakah kolom barunya ada", melainkan "apakah baris lama selamat, dan apakah
 * kolom barunya NULL — bukan nol".
 */
function bebanLamaSebelumMigrasi() {
  sql(`
    insert into op_expenses (month, outlet_code, outlet_name, utilitas, sewa, tenaga_kerja, potongan, manajemen_fee, pemasaran, ongkos_kirim, lainnya)
    values
      ('2026-08', 'LAMA1', 'Outlet Lama Satu', 1000000, 500000, 2000000, 100000, 300000, 50000, 70000, 400000),
      ('2026-08', 'LAMA2', 'Outlet Lama Dua',  2000000,      0, 3000000,      0,      0,     0,     0,       0);
    insert into op_purchases (month, outlet_code, outlet_name, warehouse, non_warehouse)
      values ('2026-08', 'LAMA1', 'Outlet Lama Satu', 50000000, 2000000);
    insert into op_pnl (month, outlet_code, outlet_name, pendapatan, hpp, beban, laba_bersih)
      values ('2026-08', 'LAMA1', 'Outlet Lama Satu', 0, 20000000, 4420000, 9000000);
  `);
}

function jalankanMigrasi2B() {
  judul("8 · migrasi 0104_beban_rinci_dan_batch.sql");
  if (!existsSync(MIGRASI_2B)) throw new Error(`migrasi tidak ditemukan: ${MIGRASI_2B}`);

  const sebelum = sql(
    `select utilitas || '|' || sewa || '|' || tenaga_kerja || '|' || potongan || '|' || manajemen_fee || '|' || pemasaran || '|' || ongkos_kirim || '|' || lainnya
     from op_expenses where month='2026-08' order by outlet_code;`,
  );

  sql(readFileSync(MIGRASI_2B, "utf8"));

  const kolom = sql(
    `select column_name || ':' || is_nullable from information_schema.columns
     where table_name='op_expenses' and column_name in ('listrik','air','internet','kebersihan','platform_fee','pbjt','batch_id') order by 1;`,
  ).split("\n");
  ok("enam kolom beban baru + batch_id lahir", kolom.length === 7, `${kolom.length} kolom`);
  ok("seluruhnya NULL-able", kolom.every((k) => k.endsWith(":YES")), kolom.join(" "));

  // ── inilah yang paling penting: baris lama tidak berubah sedikit pun ──
  const sesudah = sql(
    `select utilitas || '|' || sewa || '|' || tenaga_kerja || '|' || potongan || '|' || manajemen_fee || '|' || pemasaran || '|' || ongkos_kirim || '|' || lainnya
     from op_expenses where month='2026-08' order by outlet_code;`,
  );
  ok("delapan kolom lama TIDAK berubah satu angka pun", sebelum === sesudah, sebelum.replace(/\n/g, " · "));

  const nul = satu(
    `select count(*) from op_expenses
     where listrik is null and air is null and internet is null and kebersihan is null and platform_fee is null and pbjt is null;`,
  );
  ok("baris historis mendapat NULL, BUKAN nol", Number(nul) === 2, `${nul} dari 2 baris`);

  const nolPalsu = satu(
    `select count(*) from op_expenses where listrik = 0 or platform_fee = 0 or pbjt = 0;`,
  );
  ok("tidak ada satu pun yang diam-diam jadi nol", Number(nolPalsu) === 0, `${nolPalsu} baris`);

  // EMPAT BELAS, bukan sebelas: delapan di `op_expenses`, dua di
  // `op_purchases`, empat di `op_pnl`. Angkanya dihitung di sini, bukan
  // diingat — hitungan dari ingatan itulah yang sebelumnya salah.
  const lamaNotNull = sql(
    `select table_name || ':' || count(*) from information_schema.columns
     where table_name in ('op_expenses','op_purchases','op_pnl')
       and is_nullable='NO' and data_type='numeric'
     group by table_name order by 1;`,
  ).split("\n");
  const jumlahLama = lamaNotNull.reduce((a, b) => a + Number(b.split(":")[1] ?? 0), 0);
  ok("empat belas kolom lama TETAP not null — tidak ikut di-ALTER", jumlahLama === 14, lamaNotNull.join(" · "));

  ok(
    "tabel jejak unggahan berdiri",
    Number(satu(`select count(*) from information_schema.tables where table_name='financial_upload_batch';`)) === 1,
  );
  ok(
    "RLS aktif tanpa policy, sama seperti tabel lain",
    Number(satu(`select count(*) from pg_class where relname='financial_upload_batch' and relrowsecurity;`)) === 1 &&
      Number(satu(`select count(*) from pg_policies where tablename='financial_upload_batch';`)) === 0,
  );
}

function ujiBatch() {
  judul("9 · idempotensi — berkas yang sama tidak masuk dua kali");

  sql(`insert into financial_upload_batch (periode, sidik, jumlah_baris, jumlah_outlet, oleh_id, oleh_nama)
       values ('2026-08', 'abc12345-58', 58, 58, 'u1', 'Uji');`);

  ditolak(
    "sidik yang sama untuk bulan yang sama DITOLAK",
    `insert into financial_upload_batch (periode, sidik, jumlah_baris, jumlah_outlet, oleh_nama)
     values ('2026-08', 'abc12345-58', 58, 58, 'Uji');`,
    "financial_upload_batch_sidik_unik",
  );

  // Unggahan yang GAGAL tidak menghalangi percobaan ulang — index-nya parsial.
  sql(`insert into financial_upload_batch (periode, sidik, jumlah_baris, jumlah_outlet, oleh_nama, status)
       values ('2026-08', 'gagal001-58', 1, 1, 'Uji', 'gagal');`);
  sql(`insert into financial_upload_batch (periode, sidik, jumlah_baris, jumlah_outlet, oleh_nama, status)
       values ('2026-08', 'gagal001-58', 1, 1, 'Uji', 'gagal');`);
  ok(
    "unggahan GAGAL boleh diulang — index-nya hanya menjaga yang tersimpan",
    Number(satu(`select count(*) from financial_upload_batch where sidik='gagal001-58';`)) === 2,
  );

  // Sidik yang sama, BULAN berbeda: sah. Laporan Agustus dan September bisa
  // kebetulan berisi angka yang sama persis.
  sql(`insert into financial_upload_batch (periode, sidik, jumlah_baris, jumlah_outlet, oleh_nama)
       values ('2026-09', 'abc12345-58', 58, 58, 'Uji');`);
  ok("sidik yang sama pada BULAN LAIN tetap diterima", true);

  ditolak(
    "periode yang bentuknya salah ditolak",
    `insert into financial_upload_batch (periode, sidik, jumlah_baris, jumlah_outlet, oleh_nama)
     values ('2026-8', 'xyz', 1, 1, 'Uji');`,
    "financial_upload_batch_periode_bentuk",
  );

  ditolak(
    "status karangan ditolak",
    `insert into financial_upload_batch (periode, sidik, jumlah_baris, jumlah_outlet, oleh_nama, status)
     values ('2027-04', 'xyz', 1, 1, 'Uji', 'entahlah');`,
    "financial_upload_batch_status_check",
  );

  // ── penunjuk balik: baris tahu ditulis unggahan yang mana ──
  const idBatch = satu(`select id from financial_upload_batch where sidik='abc12345-58' and periode='2026-08';`);
  sql(`update op_expenses set batch_id = ${idBatch} where outlet_code='LAMA1';`);
  ok("baris bisa menunjuk unggahan yang menulisnya", Number(satu(`select count(*) from op_expenses where batch_id=${idBatch};`)) === 1);

  ditolak(
    "batch_id karangan ditolak",
    `update op_expenses set batch_id = 999999 where outlet_code='LAMA2';`,
    "foreign key",
  );

  // Menghapus catatan unggahan TIDAK menghapus angkanya — `on delete set null`.
  // Angka finansial tidak boleh ikut hilang hanya karena jejaknya dibersihkan.
  sql(`delete from financial_upload_batch where id = ${idBatch};`);
  ok(
    "menghapus catatan unggahan TIDAK menghapus angkanya",
    Number(satu(`select count(*) from op_expenses where outlet_code='LAMA1';`)) === 1 &&
      satu(`select coalesce(batch_id::text,'null') from op_expenses where outlet_code='LAMA1';`) === "null",
  );
}

function ujiRincianUtilitas() {
  judul("10 · rincian utilitas — jumlahnya, bukan hitung ganda");

  sql(`insert into op_expenses (month, outlet_code, outlet_name, utilitas, sewa, tenaga_kerja, potongan, manajemen_fee, pemasaran, ongkos_kirim, lainnya, listrik, air, internet, kebersihan, platform_fee, pbjt)
       values ('2026-09', 'BARU1', 'Outlet V.1', 200000, 0, 0, 0, 0, 0, 0, 0, 100000, 50000, 30000, 20000, 75000, 125000);`);

  const r = satu(
    `select (utilitas = listrik + air + internet + kebersihan)::text from op_expenses where outlet_code='BARU1';`,
  );
  ok("utilitas sama dengan jumlah empat rinciannya", benar(r), `utilitas = ${satu(`select utilitas from op_expenses where outlet_code='BARU1';`)}`);

  const total = satu(
    `select (utilitas + sewa + tenaga_kerja + potongan + manajemen_fee + pemasaran + ongkos_kirim + lainnya + coalesce(platform_fee,0) + coalesce(pbjt,0))::text
     from op_expenses where outlet_code='BARU1';`,
  );
  // 200.000 utilitas + 75.000 platform + 125.000 PBJT = 400.000.
  // Kalau keempat rincian ikut dijumlah, hasilnya 600.000 — hitung ganda.
  ok("total beban TIDAK menghitung utilitas dua kali", Number(total) === 400_000, `Rp ${Number(total).toLocaleString("id-ID")}`);

  ok(
    "baris lama dan baris V.1 hidup berdampingan",
    Number(satu(`select count(*) from op_expenses where listrik is null;`)) === 2 &&
      Number(satu(`select count(*) from op_expenses where listrik is not null;`)) === 1,
  );

  // Nol yang memang diketik tetap dibedakan dari kosong.
  sql(`insert into op_expenses (month, outlet_code, outlet_name, utilitas, sewa, tenaga_kerja, potongan, manajemen_fee, pemasaran, ongkos_kirim, lainnya, listrik, air, internet, kebersihan)
       values ('2026-09', 'BARU2', 'Outlet Nol', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);`);
  ok(
    "nol yang diketik BUKAN kosong",
    !benar(satu(`select (listrik is null)::text from op_expenses where outlet_code='BARU2';`)) &&
      satu(`select listrik::text from op_expenses where outlet_code='BARU2';`) === "0",
  );
}


/* ══════════════ 12 · PHASE 2C — empat belas KPI keuangan ══════════════ */

const MIGRASI_2C = join(AKAR, "supabase/migrations/0105_kpi_definitions_keuangan.sql");

/** Muat angka finansial Agustus 2026 yang sesungguhnya. */
function muatFinansial() {
  const f = join(DATA, "agustus-2026.finansial.txt");
  if (!existsSync(f)) throw new Error(`berkas finansial tidak ada: ${f}`);
  const kutip = (s) => `'${String(s).replace(/'/g, "''")}'`;

  const baris = readFileSync(f, "utf8")
    .split("\n")
    .filter((b) => b.length > 0)
    .map((b) => {
      const [kode, wh, nonWh, hpp, laba, utilitas, sewa, tk, potongan, mf, pemasaran, ongkir, lainnya] = b.split("|");
      return { kode, wh, nonWh, hpp, laba, utilitas, sewa, tk, potongan, mf, pemasaran, ongkir, lainnya };
    });

  sql(
    `insert into op_purchases (month, outlet_code, outlet_name, warehouse, non_warehouse) values\n${baris
      .map((r) => `(${kutip(PERIODE)}, ${kutip(r.kode)}, '', ${r.wh}, ${r.nonWh})`)
      .join(",\n")};`,
  );
  sql(
    `insert into op_pnl (month, outlet_code, outlet_name, pendapatan, hpp, beban, laba_bersih) values\n${baris
      .map((r) => `(${kutip(PERIODE)}, ${kutip(r.kode)}, '', 0, ${r.hpp}, 0, ${r.laba})`)
      .join(",\n")};`,
  );
  sql(
    `insert into op_expenses (month, outlet_code, outlet_name, utilitas, sewa, tenaga_kerja, potongan, manajemen_fee, pemasaran, ongkos_kirim, lainnya) values\n${baris
      .map(
        (r) =>
          `(${kutip(PERIODE)}, ${kutip(r.kode)}, '', ${r.utilitas}, ${r.sewa}, ${r.tk}, ${r.potongan}, ${r.mf}, ${r.pemasaran}, ${r.ongkir}, ${r.lainnya})`,
      )
      .join(",\n")};`,
  );
  return baris.length;
}

function jalankanMigrasi2C() {
  judul("12 · migrasi 0105_kpi_definitions_keuangan.sql");
  if (!existsSync(MIGRASI_2C)) throw new Error(`migrasi tidak ditemukan: ${MIGRASI_2C}`);
  sql(readFileSync(MIGRASI_2C, "utf8"));

  const n = satu(`select count(*) from kpi_definitions where kelompok='biaya';`);
  ok("empat belas definisi KPI keuangan terpasang", Number(n) === 14, `${n} definisi`);

  // Tidak ada tabel penyimpanan KPI kedua — `kpi_values` dari 0103 dipakai apa adanya.
  const tabelKpi = sql(
    `select table_name from information_schema.tables where table_schema='public' and table_name like '%kpi%' order by 1;`,
  ).split("\n");
  ok("tidak ada tabel KPI baru — kpi_values dipakai ulang", tabelKpi.length === 2, tabelKpi.join(", "));

  const persen = satu(`select count(*) from kpi_definitions where kelompok='biaya' and satuan <> 'persen';`);
  ok("seluruhnya bersatuan persen", Number(persen) === 0);

  const arah = satu(`select arah from kpi_definitions where id='biaya.net_profit_pct';`);
  ok("Net Profit arahnya naik_baik, sisanya turun_baik", arah === "naik_baik", arah);
}

function rekonsiliasiKeuangan() {
  judul(`13 · rekonsiliasi keuangan ${PERIODE}`);

  // ── kumpulkan masukan dari basis data, bukan dari berkas ──
  const mentah = sql(`
    select o.id || '~' || coalesce(o.area_id,'') || '~' ||
           coalesce((select sum(s.net) from seasonal_daily s
                      where s.branch = o.esb_branch_id
                        and s.day between '${PERIODE}-01' and '${PERIODE}-${String(jumlahHari(PERIODE)).padStart(2, "0")}')::text, '') || '~' ||
           coalesce(p.warehouse::text,'') || '~' || coalesce(p.non_warehouse::text,'') || '~' ||
           coalesce(n.hpp::text,'') || '~' || coalesce(n.laba_bersih::text,'') || '~' ||
           coalesce(e.tenaga_kerja::text,'') || '~' || coalesce(e.sewa::text,'') || '~' || coalesce(e.lainnya::text,'') || '~' ||
           coalesce(e.listrik::text,'') || '~' || coalesce(e.air::text,'') || '~' || coalesce(e.internet::text,'') || '~' ||
           coalesce(e.kebersihan::text,'') || '~' || coalesce(e.platform_fee::text,'') || '~' || coalesce(e.pbjt::text,'') || '~' ||
           (e.outlet_code is not null)::text
    from outlets o
    left join op_expenses  e on e.outlet_code = o.code and e.month = '${PERIODE}'
    left join op_purchases p on p.outlet_code = o.code and p.month = '${PERIODE}'
    left join op_pnl       n on n.outlet_code = o.code and n.month = '${PERIODE}'
    where o.active
    order by o.id;
  `);

  const angka = (s) => (s === "" ? null : Number(s));
  const outlets = mentah
    .split("\n")
    .filter(Boolean)
    .map((b) => {
      const k = b.split("~");
      return {
        outletId: k[0],
        areaId: k[1] || null,
        sales: angka(k[2]),
        warehouse: angka(k[3]),
        nonWarehouse: angka(k[4]),
        hpp: angka(k[5]),
        labaBersih: angka(k[6]),
        tenagaKerja: angka(k[7]),
        sewa: angka(k[8]),
        lainnya: angka(k[9]),
        listrik: angka(k[10]),
        air: angka(k[11]),
        internet: angka(k[12]),
        kebersihan: angka(k[13]),
        platformFee: angka(k[14]),
        pbjt: angka(k[15]),
        adaLaporan: k[16] === "t" || k[16] === "true",
      };
    });

  const selesai = PERIODE < new Date().toISOString().slice(0, 7);
  const h = hitungKeuangan({ periode: PERIODE, outlets, periodeSelesai: selesai });

  console.log(`  outlet aktif                       ${outlets.length}`);
  console.log(`  tanpa baris finansial              ${h.tanpaLaporan.length}`);
  console.log(`  tanpa omzet sah                    ${h.tanpaOmzet.length}`);
  ok("empat belas baris per outlet, plus korporat", h.nilai.length === outlets.length * 14 + 14, `${h.nilai.length} baris`);

  /* ── korporat dibandingkan dengan SQL, bukan dengan dirinya sendiri ── */

  const dariSql = (kolom, tabel) =>
    Number(
      satu(`
      select coalesce(sum(t.${kolom}) / nullif(sum(s.net), 0) * 100, 0)::text
      from outlets o
      join ${tabel} t on t.outlet_code = o.code and t.month = '${PERIODE}'
      join lateral (select sum(x.net) as net from seasonal_daily x
                     where x.branch = o.esb_branch_id
                       and x.day between '${PERIODE}-01' and '${PERIODE}-${String(jumlahHari(PERIODE)).padStart(2, "0")}') s on true
      where o.active and s.net > 0;`),
    );

  const korporatDari = (kpi) => h.nilai.find((x) => x.cakupan === "korporat" && x.kpiDefinitionId === kpi)?.nilai ?? null;
  const dekat = (a, b) => a !== null && Math.abs(a - b) < 1e-9;

  for (const [kpi, kolom, tabel, nama] of [
    [KPI_KEUANGAN.warehouse, "warehouse", "op_purchases", "Warehouse %"],
    [KPI_KEUANGAN.nonWarehouse, "non_warehouse", "op_purchases", "Non-Warehouse %"],
    [KPI_KEUANGAN.hpp, "hpp", "op_pnl", "HPP %"],
    [KPI_KEUANGAN.netProfit, "laba_bersih", "op_pnl", "Net Profit %"],
    [KPI_KEUANGAN.labor, "tenaga_kerja", "op_expenses", "Labor %"],
    [KPI_KEUANGAN.rent, "sewa", "op_expenses", "Rent %"],
    [KPI_KEUANGAN.other, "lainnya", "op_expenses", "Other %"],
  ]) {
    const kode = korporatDari(kpi);
    const db = dariSql(kolom, tabel);
    ok(`korporat ${nama} cocok dengan SQL`, dekat(kode, db), `${kode?.toFixed(6)}% vs ${db.toFixed(6)}%`);
  }

  /* ── korporat BUKAN rata-rata persen outlet ── */

  const perOutlet = h.nilai.filter((x) => x.cakupan === "outlet" && x.kpiDefinitionId === KPI_KEUANGAN.labor && x.nilai !== null);
  const rataPersen = perOutlet.reduce((a, x) => a + (x.nilai ?? 0), 0) / perOutlet.length;
  const korporatLabor = korporatDari(KPI_KEUANGAN.labor) ?? 0;
  ok(
    "korporat BUKAN rata-rata persen outlet",
    Math.abs(rataPersen - korporatLabor) > 0.5,
    `tertimbang ${korporatLabor.toFixed(2)}% vs rata-rata ${rataPersen.toFixed(2)}%`,
  );

  /* ── omzetnya sumber yang sama dengan Phase 2A ── */

  const omzet2A = Number(satu(`select nilai::text from kpi_values where periode='${PERIODE}' and cakupan='korporat' and kpi_definition_id='sales.net_sales';`));
  const omzetPakai = outlets.filter((o) => o.adaLaporan && (o.sales ?? 0) > 0).reduce((a, o) => a + (o.sales ?? 0), 0);
  console.log("");
  console.log(`  omzet korporat Phase 2A            ${rp(omzet2A)}`);
  console.log(`  omzet penyebut KPI keuangan        ${rp(omzetPakai)}`);
  console.log(`  selisih                            ${rp(omzet2A - omzetPakai)}`);
  console.log(`                                     (outlet tanpa laporan finansial tidak ikut penyebut)`);

  /* ── kosong versus nol, pada data sungguhan ── */

  const nul = (kpi) => h.nilai.filter((x) => x.cakupan === "outlet" && x.kpiDefinitionId === kpi && x.nilai === null).length;
  console.log("");
  console.log("  Outlet ber-KPI tidak_tersedia");
  console.log("  ─────────────────────────────");
  for (const [kpi, nama] of [
    [KPI_KEUANGAN.electricity, "Electricity %"],
    [KPI_KEUANGAN.water, "Water %"],
    [KPI_KEUANGAN.internet, "Internet %"],
    [KPI_KEUANGAN.cleaning, "Cleaning %"],
    [KPI_KEUANGAN.platformFee, "Platform Fee %"],
    [KPI_KEUANGAN.pbjt, "PBJT %"],
  ]) {
    console.log(`  ${nama.padEnd(18)} ${String(nul(kpi)).padStart(3)} dari ${outlets.length}`);
  }
  ok(
    "enam kolom baru seluruhnya tidak_tersedia — belum pernah dilaporkan",
    [KPI_KEUANGAN.electricity, KPI_KEUANGAN.platformFee, KPI_KEUANGAN.pbjt].every((k) => nul(k) === outlets.length),
  );

  return h;
}

function simpanKeuangan(h) {
  judul("14 · KPI keuangan ditulis ke basis data LOKAL");

  const kutip = (s) => (s === null || s === undefined ? "null" : `'${String(s).replace(/'/g, "''")}'`);
  const num = (n) => (n === null || n === undefined || !Number.isFinite(n) ? "null" : String(n));

  sql(`
    insert into kpi_values
      (kpi_definition_id, cakupan, outlet_id, area_id, periode, skala, nilai, status, sumber, rumus, rumus_versi, sumber_sah, kelengkapan_persen, jumlah_hari, catatan)
    values
${h.nilai
  .map(
    (n) =>
      `(${kutip(n.kpiDefinitionId)}, ${kutip(n.cakupan)}, ${kutip(n.outletId)}, ${kutip(n.areaId)}, ${kutip(n.periode)}, ${kutip(n.skala)}, ${num(n.nilai)}, ${kutip(n.status)}, ${kutip(n.sumber)}, ${kutip(n.rumus)}, ${n.rumusVersi}, ${n.sumberSah}, ${num(n.kelengkapanPersen)}, ${n.jumlahHari === null ? "null" : n.jumlahHari}, ${kutip(n.catatan)})`,
  )
  .join(",\n")};
  `);

  const masuk = Number(satu(`select count(*) from kpi_values where periode='${PERIODE}' and kpi_definition_id like 'biaya.%';`));
  ok("seluruh baris KPI keuangan diterima basis data", masuk === h.nilai.length, `${masuk} dari ${h.nilai.length}`);

  // Satu outlet + satu periode + satu KPI = maksimal satu baris.
  const kembar = satu(`
    select count(*) from (
      select kpi_definition_id, cakupan, cakupan_id, periode, skala, count(*) n
      from kpi_values where periode='${PERIODE}' and terkini
      group by 1,2,3,4,5 having count(*) > 1
    ) x;`);
  ok("tidak ada grain kembar", Number(kembar) === 0, `${kembar} kombinasi kembar`);

  ditolak(
    "menulis dua kali DITOLAK basis data",
    `insert into kpi_values (kpi_definition_id, cakupan, outlet_id, periode, skala, nilai, status, sumber, rumus)
     select kpi_definition_id, cakupan, outlet_id, periode, skala, nilai, status, sumber, rumus
     from kpi_values where periode='${PERIODE}' and kpi_definition_id='${KPI_KEUANGAN.labor}' limit 1;`,
    "kpi_values_terkini_unik",
  );

  // KPI Sales Phase 2A tidak terganggu sama sekali.
  const sales2A = Number(satu(`select count(*) from kpi_values where periode='${PERIODE}' and kpi_definition_id like 'sales.%';`));
  ok("KPI Sales Phase 2A utuh di sampingnya", sales2A === 292, `${sales2A} baris`);

  console.log("");
  console.log("  Isi tabel setelah ditulis");
  console.log("  ─────────────────────────");
  for (const b of sql(`
    select d.kode || ' · ' || v.cakupan || ' · ' || count(*) || ' baris · ' ||
           count(*) filter (where v.nilai is null) || ' null'
    from kpi_values v join kpi_definitions d on d.id = v.kpi_definition_id
    where v.periode = '${PERIODE}' and d.kelompok = 'biaya'
    group by d.kode, d.urutan, v.cakupan order by d.urutan, v.cakupan;
  `).split("\n")) {
    console.log(`  ${b}`);
  }
}


/* ══════════════ 16 · TASK #85 — penulisan berversi, idempoten, dan utuh ══════════════ */

const MIGRASI_85 = join(AKAR, "supabase/migrations/0106_tulis_kpi_bulanan.sql");

/**
 * Periode uji tersendiri.
 *
 * BUKAN 2026-08 (hasil rekonsiliasi) dan bukan 2026-09 — yang kedua sudah
 * dipakai uji riwayat versi di bagian 6, dan memakainya lagi membuat uji ini
 * mulai dari versi 3 dengan baris yang bukan miliknya.
 */
const P85 = "2027-03";

/** Muatan `kpi_values` untuk RPC — kecil, cukup untuk menguji versinya. */
const muatan = (net, catatan = null) =>
  JSON.stringify([
    {
      kpi: "sales.net_sales",
      cakupan: "outlet",
      outlet_id: outletUji,
      area_id: null,
      nilai: net,
      status: "sementara",
      sumber: "seasonal_daily",
      rumus: "jumlah-harian",
      rumus_versi: 1,
      sumber_sah: true,
      kelengkapan_persen: null,
      jumlah_hari: null,
      catatan,
    },
    {
      kpi: "sales.net_sales",
      cakupan: "korporat",
      outlet_id: null,
      area_id: null,
      nilai: net,
      status: "sementara",
      sumber: "seasonal_daily",
      rumus: "jumlah-harian",
      rumus_versi: 1,
      sumber_sah: true,
      kelengkapan_persen: null,
      jumlah_hari: null,
      catatan: null,
    },
  ]);

const muatanTarget = (nilai, kpi = "sales.monthly_target") =>
  JSON.stringify([
    {
      kpi,
      cakupan: "outlet",
      outlet_id: outletUji,
      area_id: null,
      nilai,
      sumber: "rumus",
      rumus: "avg3-tumbuh",
      rumus_versi: 1,
      dasar: { bulan: [], riwayat: [], dipakai: [], pertumbuhan: 15 },
    },
  ]);

const panggil = (nilai, target, opsi) =>
  satu(
    `select gwg_tulis_kpi_bulanan('${P85}', '${nilai.replace(/'/g, "''")}'::jsonb, '${target.replace(/'/g, "''")}'::jsonb);`,
    opsi,
  );

const bidangJson = (teks, kunci) => {
  const m = new RegExp(`"${kunci}"\\s*:\\s*(true|false|-?\\d+)`).exec(teks);
  return m ? m[1] : null;
};

function jalankanMigrasi85() {
  judul("16 · migrasi 0106_tulis_kpi_bulanan.sql");
  if (!existsSync(MIGRASI_85)) throw new Error(`migrasi tidak ditemukan: ${MIGRASI_85}`);

  // Peran Supabase dibuat dulu supaya berkas migrasinya bisa dijalankan APA
  // ADANYA — termasuk baris revoke/grant-nya. Menjalankan versi yang sudah
  // dipotong berarti menguji sesuatu yang bukan yang akan naik ke produksi.
  sql(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
    end $$;
  `);
  sql(readFileSync(MIGRASI_85, "utf8"));

  const ada = satu(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='gwg_tulis_kpi_bulanan';`);
  ok("fungsi gwg_tulis_kpi_bulanan terpasang", Number(ada) === 1, `${ada} fungsi`);

  const definer = satu(`select prosecdef::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='gwg_tulis_kpi_bulanan';`);
  ok("berjalan sebagai SECURITY DEFINER dengan search_path terkunci", benar(definer), definer);
  const konfig = satu(`select array_to_string(proconfig, ', ') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='gwg_tulis_kpi_bulanan';`);
  ok("search_path disetel di fungsinya", konfig.includes("search_path"), konfig);

  // Hak jalan: hanya service_role. `authenticated` disebut terpisah karena
  // Supabase memberinya secara bawaan untuk fungsi baru di skema public.
  for (const peran of ["public", "anon", "authenticated"]) {
    const boleh = satu(`select has_function_privilege('${peran}', 'public.gwg_tulis_kpi_bulanan(text, jsonb, jsonb)', 'execute')::text;`);
    ok(`${peran} TIDAK boleh menjalankannya`, !benar(boleh), boleh);
  }
  const svc = satu(`select has_function_privilege('service_role', 'public.gwg_tulis_kpi_bulanan(text, jsonb, jsonb)', 'execute')::text;`);
  ok("service_role boleh menjalankannya", benar(svc), svc);

  // Tidak ada rumus KPI yang menyelinap ke PL/pgSQL.
  const badan = readFileSync(MIGRASI_85, "utf8");
  ok(
    "tidak ada rumus KPI di dalam fungsinya",
    !/\/\s*nullif\(sum|sum\([a-z_]+\)\s*\/|\* 100/.test(badan.replace(/--.*$/gm, "")),
    "tidak ditemukan pembagian/persentase",
  );
}

function ujiTulisBerversi() {
  judul(`17 · penulisan berversi ${P85}`);

  const hitungNilai = () => Number(satu(`select count(*) from kpi_values where periode='${P85}';`));
  const hitungTerkini = () => Number(satu(`select count(*) from kpi_values where periode='${P85}' and terkini;`));
  const versiMaks = () => Number(satu(`select coalesce(max(versi),0) from kpi_values where periode='${P85}';`));

  /* ── jalan pertama ── */

  const r1 = panggil(muatan(1000), muatanTarget(2000));
  ok("jalan pertama menyatakan berubah", bidangJson(r1, "berubah") === "true", r1.slice(0, 120));
  ok("versi pertama adalah 1", bidangJson(r1, "versi") === "1", bidangJson(r1, "versi"));
  ok("dua baris nilai tersimpan", hitungNilai() === 2, `${hitungNilai()} baris`);
  ok("keduanya terkini", hitungTerkini() === 2, `${hitungTerkini()} terkini`);
  const t1 = Number(satu(`select count(*) from targets where periode='${P85}' and terkini and status='berlaku';`));
  ok("satu target berlaku", t1 === 1, `${t1} target`);

  /* ── jalan kedua, muatan SAMA PERSIS ── */

  const r2 = panggil(muatan(1000), muatanTarget(2000));
  ok("jalan kedua menyatakan TIDAK berubah", bidangJson(r2, "berubah") === "false", r2.slice(0, 120));
  ok("tidak ada baris baru", hitungNilai() === 2, `${hitungNilai()} baris`);
  ok("tidak ada versi baru", versiMaks() === 1, `versi maks ${versiMaks()}`);
  ok("tidak ada baris yang disisipkan", bidangJson(r2, "nilai_disisipkan") === "0", bidangJson(r2, "nilai_disisipkan"));
  const t2 = Number(satu(`select count(*) from targets where periode='${P85}';`));
  ok("target tidak berlipat", t2 === 1, `${t2} target`);

  /* ── jalan ketiga, angkanya BERUBAH ── */

  const r3 = panggil(muatan(1500), muatanTarget(2000));
  ok("jalan ketiga menyatakan berubah", bidangJson(r3, "berubah") === "true", r3.slice(0, 120));
  ok("versi naik ke 2", bidangJson(r3, "versi") === "2", bidangJson(r3, "versi"));
  ok("versi lama DIPERTAHANKAN, bukan ditimpa", hitungNilai() === 4, `${hitungNilai()} baris`);
  ok("hanya dua yang terkini", hitungTerkini() === 2, `${hitungTerkini()} terkini`);

  const lama = Number(satu(`select count(*) from kpi_values where periode='${P85}' and versi=1 and terkini;`));
  ok("versi 1 tidak lagi terkini", lama === 0, `${lama} baris versi 1 masih terkini`);
  const baru = Number(satu(`select nilai::text from kpi_values where periode='${P85}' and terkini and cakupan='korporat';`));
  ok("yang terkini adalah angka baru", baru === 1500, `${baru}`);

  const tLama = satu(`select status from targets where periode='${P85}' and versi=1;`);
  ok("target versi lama berstatus diganti", tLama === "diganti", tLama);
  const tBaru = Number(satu(`select count(*) from targets where periode='${P85}' and terkini and versi=2 and status='berlaku';`));
  ok("target versi baru berlaku dan terkini", tBaru === 1, `${tBaru}`);

  /* ── perubahan yang HANYA di catatan tetap terhitung berubah ── */

  const r4 = panggil(muatan(1500, "alasan baru"), muatanTarget(2000));
  ok("catatan yang berubah melahirkan versi baru", bidangJson(r4, "versi") === "3", bidangJson(r4, "versi"));

  /* ── perubahan yang HANYA di target ── */

  const r5 = panggil(muatan(1500, "alasan baru"), muatanTarget(2500));
  ok("target yang berubah melahirkan versi baru walau KPI-nya sama", bidangJson(r5, "versi") === "4", bidangJson(r5, "versi"));

  /* ── grain: satu terkini per kombinasi, termasuk baris korporat ber-NULL ── */

  const kembar = satu(`
    select count(*) from (
      select kpi_definition_id, cakupan, cakupan_id, periode, skala
      from kpi_values where terkini group by 1,2,3,4,5 having count(*) > 1
    ) x;`);
  ok("tidak ada grain terkini yang kembar di seluruh tabel", Number(kembar) === 0, `${kembar} kembar`);

  /* ── Agustus tidak tersentuh ── */

  const agustus = Number(satu(`select count(*) from kpi_values where periode='2026-08';`));
  const agustusVersi = satu(`select coalesce(max(versi),0)::text from kpi_values where periode='2026-08';`);
  const agustusTerkini = Number(satu(`select count(*) from kpi_values where periode='2026-08' and terkini;`));
  ok("Agustus tetap satu versi", agustusVersi === "1", `versi maks ${agustusVersi}`);
  ok("seluruh baris Agustus masih terkini", agustus === agustusTerkini, `${agustusTerkini} dari ${agustus}`);
}

function ujiTolakDanUtuh() {
  judul("18 · yang DITOLAK, dan keutuhan saat gagal");

  const sebelumNilai = Number(satu(`select count(*) from kpi_values where periode='${P85}';`));
  const sebelumVersi = Number(satu(`select coalesce(max(versi),0) from kpi_values where periode='${P85}';`));
  const sebelumTarget = Number(satu(`select count(*) from targets where periode='${P85}';`));

  ditolak(
    "periode yang tidak berbentuk YYYY-MM ditolak",
    `select gwg_tulis_kpi_bulanan('2026-9', '${muatan(1).replace(/'/g, "''")}'::jsonb, '[]'::jsonb);`,
    "YYYY-MM",
  );

  ditolak(
    "muatan kosong ditolak — tidak boleh mengosongkan periode diam-diam",
    `select gwg_tulis_kpi_bulanan('${P85}', '[]'::jsonb, '[]'::jsonb);`,
    "kosong",
  );

  /* ── ROLLBACK: KPI lolos, target gagal → tidak ada yang tersisa ── */

  // Targetnya menunjuk definisi KPI yang tidak ada, jadi penyisipan target
  // melanggar foreign key SESUDAH kpi_values berhasil disisipkan. Kalau
  // keduanya tidak dalam satu transaksi, di sinilah generasi setengah jadi
  // lahir: KPI sudah naik versi, targetnya tertinggal.
  ditolak(
    "target yang melanggar foreign key membatalkan SELURUH generasi",
    `select gwg_tulis_kpi_bulanan('${P85}', '${muatan(9999).replace(/'/g, "''")}'::jsonb, '${muatanTarget(1, "sales.tidak_ada").replace(/'/g, "''")}'::jsonb);`,
    "foreign key",
  );

  const sesudahNilai = Number(satu(`select count(*) from kpi_values where periode='${P85}';`));
  const sesudahVersi = Number(satu(`select coalesce(max(versi),0) from kpi_values where periode='${P85}';`));
  const sesudahTarget = Number(satu(`select count(*) from targets where periode='${P85}';`));
  ok("tidak ada baris KPI yang tertinggal dari generasi yang gagal", sesudahNilai === sebelumNilai, `${sebelumNilai} → ${sesudahNilai}`);
  ok("versi tidak ikut naik saat gagal", sesudahVersi === sebelumVersi, `${sebelumVersi} → ${sesudahVersi}`);
  ok("target tidak ikut berubah saat gagal", sesudahTarget === sebelumTarget, `${sebelumTarget} → ${sesudahTarget}`);

  const terkiniLagi = Number(satu(`select count(*) from kpi_values where periode='${P85}' and terkini;`));
  ok("baris yang terkini kembali seperti semula", terkiniLagi === 2, `${terkiniLagi} terkini`);
  const nilaiLagi = Number(satu(`select nilai::text from kpi_values where periode='${P85}' and terkini and cakupan='korporat';`));
  ok("angkanya tidak berubah jadi 9999", nilaiLagi === 1500, `${nilaiLagi}`);
}

function ujiKunciPeriode() {
  judul("19 · kunci per periode");

  // Kuncinya terikat TRANSAKSI, jadi ia cuma bisa dilihat dari dalam transaksi
  // yang sama. Memanggil fungsinya di dalam `begin` lalu menghitung kunci
  // advisory yang dipegang sesi ini membuktikan kuncinya memang diambil —
  // bukan sekadar tertulis di berkas migrasinya.
  const dipegang = sql(`
    begin;
    select gwg_tulis_kpi_bulanan('${P85}', '${muatan(1500, "alasan baru").replace(/'/g, "''")}'::jsonb, '${muatanTarget(2500).replace(/'/g, "''")}'::jsonb);
    select count(*) from pg_locks where locktype='advisory' and pid = pg_backend_pid();
    rollback;
  `).split("\n").filter(Boolean).pop();
  ok("satu kunci advisory dipegang selama menulis", Number(dipegang) === 1, `${dipegang} kunci`);

  const dua = sql(`
    begin;
    select gwg_tulis_kpi_bulanan('${P85}', '${muatan(1).replace(/'/g, "''")}'::jsonb, '[]'::jsonb);
    select gwg_tulis_kpi_bulanan('2027-04', '${muatan(1).replace(/'/g, "''")}'::jsonb, '[]'::jsonb);
    select count(*) from pg_locks where locktype='advisory' and pid = pg_backend_pid();
    rollback;
  `).split("\n").filter(Boolean).pop();
  ok("periode berbeda memakai kunci berbeda — bukan satu kunci global", Number(dua) === 2, `${dua} kunci`);

  const sisa = Number(satu(`select count(*) from pg_locks where locktype='advisory';`));
  ok("kunci lepas sendiri begitu transaksinya berakhir", sisa === 0, `${sisa} kunci tersisa`);

  const sesudah = Number(satu(`select count(*) from kpi_values where periode='2027-04';`));
  ok("yang di-rollback tidak meninggalkan jejak", sesudah === 0, `${sesudah} baris periode tetangga`);
}


/* ══════════════ 20 · TASK #85A — menutup periode yang sudah berakhir ══════════════ */

const MIGRASI_85A = join(AKAR, "supabase/migrations/0108_finalisasi_kpi_bulanan.sql");

const tutup = (bulanBerjalan, opsi) =>
  satu(`select gwg_finalisasi_kpi_bulanan('${bulanBerjalan}');`, opsi);

/** Cacah status baris terkini satu periode: "final=1, sementara=2". */
const statusTerkini = (periode) =>
  satu(`select coalesce(string_agg(status || '=' || n, ', ' order by status), 'kosong')
        from (select status, count(*) n from kpi_values
              where periode='${periode}' and terkini group by status) x;`);

/** Sidik seluruh baris sebuah periode — termasuk versi lama. */
const sidikPeriode = (periode) =>
  satu(`select coalesce(md5(string_agg(kpi_definition_id||'|'||cakupan||'|'||coalesce(cakupan_id,'')||'|'||
                              coalesce(nilai::text,'')||'|'||status||'|'||versi||'|'||terkini::text, chr(10) order by id)), 'kosong')
        from kpi_values where periode='${periode}';`);

function jalankanMigrasi85A() {
  judul("20 · migrasi 0108_finalisasi_kpi_bulanan.sql");
  if (!existsSync(MIGRASI_85A)) throw new Error(`migrasi tidak ditemukan: ${MIGRASI_85A}`);
  sql(readFileSync(MIGRASI_85A, "utf8"));

  const ada = satu(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='gwg_finalisasi_kpi_bulanan';`);
  ok("fungsi gwg_finalisasi_kpi_bulanan terpasang", Number(ada) === 1, `${ada} fungsi`);

  const definer = satu(`select prosecdef::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='gwg_finalisasi_kpi_bulanan';`);
  ok("SECURITY DEFINER", benar(definer), definer);

  for (const peran of ["public", "anon", "authenticated"]) {
    const boleh = satu(`select has_function_privilege('${peran}', 'public.gwg_finalisasi_kpi_bulanan(text)', 'execute')::text;`);
    ok(`${peran} TIDAK boleh menutup periode`, !benar(boleh), boleh);
  }
  const svc = satu(`select has_function_privilege('service_role', 'public.gwg_finalisasi_kpi_bulanan(text)', 'execute')::text;`);
  ok("service_role boleh menutup periode", benar(svc), svc);

  ditolak(
    "bulan berjalan yang tidak berbentuk YYYY-MM ditolak",
    `select gwg_finalisasi_kpi_bulanan('2027-3');`,
    "YYYY-MM",
  );
}

function ujiFinalisasi() {
  judul(`21 · sementara → final pada ${P85}`);

  // Versi terkini periode uji dilengkapi supaya memuat KETIGA keadaan yang
  // mungkin. Tanpa `tidak_tersedia` dan `final` di dalamnya, "yang lain tidak
  // ikut berubah" tidak terbukti apa-apa.
  const versiKini = Number(satu(`select max(versi) from kpi_values where periode='${P85}';`));
  sql(`
    insert into kpi_values
      (kpi_definition_id, cakupan, outlet_id, periode, skala, nilai, status, sumber, rumus, versi, terkini)
    values
      ('sales.gross_sales', 'outlet', '${outletUji}', '${P85}', 'bulanan', null, 'tidak_tersedia', 'seasonal_daily', 'jumlah-harian', ${versiKini}, true),
      ('sales.average_transaction', 'outlet', '${outletUji}', '${P85}', 'bulanan', 123, 'final', 'seasonal_daily', 'jumlah-harian', ${versiKini}, true);
  `);

  const sebelum = statusTerkini(P85);
  const barisSebelum = Number(satu(`select count(*) from kpi_values where periode='${P85}';`));
  const versiSebelum = satu(`select string_agg(distinct versi::text, ',' order by versi::text) from kpi_values where periode='${P85}';`);
  const lamaSebelum = satu(`select coalesce(string_agg(status||'/v'||versi, ',' order by id), 'kosong') from kpi_values where periode='${P85}' and not terkini;`);
  ok("keadaan awal memuat ketiga status", sebelum.includes("sementara") && sebelum.includes("tidak_tersedia") && sebelum.includes("final"), sebelum);

  /* ── periode BELUM berakhir: diperiksa, tapi tidak ditutup ── */

  const belum = tutup(P85); // bulan berjalan = periodenya sendiri
  ok("periode yang belum berakhir tetap DIPERIKSA", belum.includes(P85), belum.slice(0, 140));
  ok("…tapi tidak ada baris yang diubah", bidangJson(belum, "baris_diubah") === "0", bidangJson(belum, "baris_diubah"));
  ok("…dan tidak masuk daftar yang difinalisasi", /"periode_difinalisasi"\s*:\s*\[\s*\]/.test(belum), belum.slice(0, 140));
  ok("statusnya belum bergerak", statusTerkini(P85) === sebelum, statusTerkini(P85));

  /* ── bulan berikutnya tiba: periode ditutup ── */

  const hasil = tutup("2027-04");
  ok("dua baris sementara berpindah jadi final", bidangJson(hasil, "baris_diubah") === "2", bidangJson(hasil, "baris_diubah"));
  ok("periodenya masuk daftar yang difinalisasi", new RegExp(`"periode_difinalisasi"[^\\]]*${P85}`).test(hasil), hasil.slice(0, 200));

  const sesudah = statusTerkini(P85);
  ok("tidak ada lagi sementara yang terkini", !sesudah.includes("sementara"), sesudah);
  ok("tidak_tersedia TETAP tidak_tersedia", sesudah.includes("tidak_tersedia=1"), sesudah);
  ok("final bertambah persis sebanyak yang berpindah", sesudah.includes("final=3"), sesudah);

  /* ── yang TIDAK boleh ikut berubah ── */

  ok("tidak ada baris yang disisipkan atau dihapus", Number(satu(`select count(*) from kpi_values where periode='${P85}';`)) === barisSebelum, `${barisSebelum} baris`);
  const versiSesudah = satu(`select string_agg(distinct versi::text, ',' order by versi::text) from kpi_values where periode='${P85}';`);
  ok("tidak ada versi baru yang lahir", versiSesudah === versiSebelum, `${versiSebelum} → ${versiSesudah}`);
  const lamaSesudah = satu(`select coalesce(string_agg(status||'/v'||versi, ',' order by id), 'kosong') from kpi_values where periode='${P85}' and not terkini;`);
  ok("versi lama tidak tersentuh sama sekali", lamaSesudah === lamaSebelum, lamaSesudah.slice(0, 80));
  const nilaiUtuh = Number(satu(`select count(*) from kpi_values where periode='${P85}' and terkini and kpi_definition_id='sales.average_transaction' and nilai = 123;`));
  ok("nilai tidak ikut disentuh", nilaiUtuh === 1, `${nilaiUtuh}`);

  const kembar = satu(`
    select count(*) from (
      select kpi_definition_id, cakupan, cakupan_id, periode, skala
      from kpi_values where terkini group by 1,2,3,4,5 having count(*) > 1
    ) x;`);
  ok("tidak ada grain terkini yang kembar", Number(kembar) === 0, `${kembar} kembar`);

  /* ── idempotensi ── */

  const ulang = tutup("2027-04");
  ok("jalan kedua tidak mengubah apa pun", bidangJson(ulang, "baris_diubah") === "0", bidangJson(ulang, "baris_diubah"));
  ok("periode yang sudah bersih tidak lagi diperiksa", !ulang.includes(P85), ulang.slice(0, 160));
  ok("statusnya tetap", statusTerkini(P85) === sesudah, statusTerkini(P85));

  /* ── Agustus: tidak pernah disebut, tidak pernah tersentuh ── */

  const agustusSebelum = sidikPeriode("2026-08");
  const lihatAgustus = tutup("2027-04");
  ok("Agustus tidak pernah masuk daftar periksa — ia tidak punya sementara", !lihatAgustus.includes("2026-08"), lihatAgustus.slice(0, 160));
  ok("sidik Agustus tidak berubah", sidikPeriode("2026-08") === agustusSebelum, agustusSebelum);
}

function ujiFinalisasiUtuh() {
  judul("22 · keutuhan dan kunci saat menutup periode");

  // Periode kedua supaya ada DUA periode yang bisa ditutup sekaligus — itu yang
  // membuat "batal separuh jalan" benar-benar mungkin terjadi.
  sql(`
    insert into kpi_values
      (kpi_definition_id, cakupan, outlet_id, periode, skala, nilai, status, sumber, rumus, versi, terkini)
    values
      ('sales.net_sales', 'outlet', '${outletUji}', '2027-05', 'bulanan', 10, 'sementara', 'seasonal_daily', 'jumlah-harian', 1, true),
      ('sales.net_sales', 'korporat', null, '2027-05', 'bulanan', 10, 'sementara', 'seasonal_daily', 'jumlah-harian', 1, true),
      ('sales.net_sales', 'outlet', '${outletUji}', '2027-06', 'bulanan', 20, 'sementara', 'seasonal_daily', 'jumlah-harian', 1, true);
  `);

  const sebelum5 = statusTerkini("2027-05");
  const sebelum6 = statusTerkini("2027-06");

  /* ── ROLLBACK: satu baris menolak diubah, seluruh penutupan batal ── */

  sql(`
    create or replace function uji_tolak_final() returns trigger language plpgsql as $$
    begin
      if new.periode = '2027-06' then
        raise exception 'penolakan buatan untuk menguji rollback';
      end if;
      return new;
    end $$;
    create trigger uji_tolak_final before update on kpi_values
      for each row execute function uji_tolak_final();
  `);

  ditolak(
    "satu baris yang menolak membatalkan SELURUH penutupan",
    `select gwg_finalisasi_kpi_bulanan('2027-07');`,
    "penolakan buatan",
  );

  ok("periode yang sempat lolos ikut dibatalkan", statusTerkini("2027-05") === sebelum5, statusTerkini("2027-05"));
  ok("periode yang menolak tetap seperti semula", statusTerkini("2027-06") === sebelum6, statusTerkini("2027-06"));

  sql(`drop trigger uji_tolak_final on kpi_values; drop function uji_tolak_final();`);

  /* ── tanpa penghalang, keduanya tertutup dalam satu jalan ── */

  const hasil = tutup("2027-07");
  ok("dua periode tertutup sekaligus", bidangJson(hasil, "baris_diubah") === "3", bidangJson(hasil, "baris_diubah"));
  ok("keduanya disebut", hasil.includes("2027-05") && hasil.includes("2027-06"), hasil.slice(0, 200));

  /* ── kunci per periode, sama dengan milik penulis ── */

  sql(`update kpi_values set status='sementara' where periode='2027-05' and terkini;`);
  const dipegang = sql(`
    begin;
    select gwg_finalisasi_kpi_bulanan('2027-07');
    select count(*) from pg_locks where locktype='advisory' and pid = pg_backend_pid();
    rollback;
  `).split("\n").filter(Boolean).pop();
  ok("kunci advisory dipegang selama menutup", Number(dipegang) === 1, `${dipegang} kunci`);

  const sama = sql(`
    begin;
    select gwg_tulis_kpi_bulanan('2027-05', '${muatan(1).replace(/'/g, "''")}'::jsonb, '[]'::jsonb);
    select gwg_finalisasi_kpi_bulanan('2027-07');
    select count(*) from pg_locks where locktype='advisory' and pid = pg_backend_pid();
    rollback;
  `).split("\n").filter(Boolean).pop();
  ok(
    "menulis dan menutup periode yang SAMA memakai kunci yang sama — bukan dua kunci berbeda",
    Number(sama) === 1,
    `${sama} kunci`,
  );

  const sisa = Number(satu(`select count(*) from pg_locks where locktype='advisory';`));
  ok("kunci lepas sendiri", sisa === 0, `${sisa} tersisa`);
}


/* ══════════════ 23 · TASK #87 — lapisan aturan yang berversi ══════════════ */

const MIGRASI_87 = join(AKAR, "supabase/migrations/0109_rule_versioning.sql");

function jalankanMigrasi87() {
  judul("23 · migrasi 0109_rule_versioning.sql");
  if (!existsSync(MIGRASI_87)) throw new Error(`migrasi tidak ditemukan: ${MIGRASI_87}`);
  sql(readFileSync(MIGRASI_87, "utf8"));

  const tabel = sql(`select table_name from information_schema.tables where table_schema='public' and table_name in ('rules','rule_versions','rule_conditions') order by 1;`)
    .split("\n").filter(Boolean);
  ok("tiga tabel aturan terpasang", tabel.length === 3, tabel.join(", "));

  for (const t of ["rules", "rule_versions", "rule_conditions"]) {
    const rls = satu(`select relrowsecurity::text from pg_class where oid='public.${t}'::regclass;`);
    ok(`${t} — RLS menyala`, benar(rls), rls);
    const policy = satu(`select count(*) from pg_policies where schemaname='public' and tablename='${t}';`);
    ok(`${t} — tanpa policy, menolak secara bawaan`, Number(policy) === 0, `${policy} policy`);
  }

  const nRule = Number(satu(`select count(*) from rules;`));
  const nVersi = Number(satu(`select count(*) from rule_versions;`));
  const nSyarat = Number(satu(`select count(*) from rule_conditions;`));
  ok("sepuluh aturan tersemai", nRule === 10, `${nRule} aturan`);
  ok("sepuluh versi tersemai", nVersi === 10, `${nVersi} versi`);
  ok("sepuluh syarat tersemai", nSyarat === 10, `${nSyarat} syarat`);

  const yatim = satu(`select count(*) from rules r where not exists (select 1 from kpi_definitions d where d.id = r.kpi_definition_id);`);
  ok("tiap aturan menunjuk definisi KPI yang ada", Number(yatim) === 0, `${yatim} yatim`);

  const tanpaSyarat = satu(`select count(*) from rule_versions v where not exists (select 1 from rule_conditions c where c.rule_version_id = v.id);`);
  ok("tidak ada versi tanpa syarat", Number(tanpaSyarat) === 0, `${tanpaSyarat} versi kosong`);

  // Sewa: AD-02. Berbeda sendiri, dan memang harus berbeda.
  const sewa = satu(`select v.berlaku_mulai || ' · ' || c.operator || ' ' || c.nilai_ambang
                     from rule_versions v join rule_conditions c on c.rule_version_id = v.id
                     where v.rule_kode = 'sewa_melebihi_ambang';`);
  ok("aturan sewa berambang 5 dan baru berlaku 2026-10", sewa === "2026-10 · gt 5", sewa);

  const sumberSewa = satu(`select sumber from rule_versions where rule_kode='sewa_melebihi_ambang';`);
  ok("sumbernya menyebut AD-02", sumberSewa.includes("AD-02"), sumberSewa.slice(0, 60));

  // Tiap versi menyebut dari mana angkanya. Tanpa ini, penilaian tidak bisa
  // dijelaskan tanpa membaca kode sumber lama.
  const tanpaSumber = satu(`select count(*) from rule_versions where coalesce(trim(sumber),'') = '';`);
  ok("tiap versi menyebut sumber angkanya", Number(tanpaSumber) === 0, `${tanpaSumber} tanpa sumber`);
}

function ujiAturanTakBerubah() {
  judul("24 · versi aturan tidak bisa disunting, rentangnya tidak bisa bertumpang");

  const idWh = satu(`select id from rule_versions where rule_kode='warehouse_persen' and versi=1;`);

  /* ── tumpang tindih ── */

  ditolak(
    "versi kedua yang rentangnya bertumpang DITOLAK",
    `insert into rule_versions (rule_kode, versi, berlaku_mulai, sumber)
     values ('warehouse_persen', 2, '2026-09', 'uji');`,
    "bertumpang",
  );

  ditolak(
    "rentang yang membungkus versi lama juga ditolak",
    `insert into rule_versions (rule_kode, versi, berlaku_mulai, berlaku_sampai, sumber)
     values ('warehouse_persen', 3, '2026-01', '2099-12', 'uji');`,
    "bertumpang",
  );

  // Struktur penjaganya sendiri, bukan cuma perilakunya: satu nomor versi per
  // aturan dijaga index unik, bukan sekadar oleh pemicu tumpang tindih.
  const unik = satu(`select indexdef from pg_indexes where schemaname='public' and indexname='rule_versions_unik';`);
  ok("nomor versi dijaga index unik", unik.includes("(rule_kode, versi)"), unik.slice(0, 80));

  /* ── kekekalan ── */

  ditolak(
    "ambang tidak boleh diubah di tempat",
    `update rule_conditions set nilai_ambang = 28 where rule_version_id = ${idWh};`,
    "menuntut versi aturan baru",
  );

  ditolak(
    "operator tidak boleh diubah di tempat",
    `update rule_conditions set operator = 'gte' where rule_version_id = ${idWh};`,
    "menuntut versi aturan baru",
  );

  ditolak(
    "syarat tidak boleh dihapus",
    `delete from rule_conditions where rule_version_id = ${idWh};`,
    "menuntut versi aturan baru",
  );

  ditolak(
    "versi aturan tidak boleh dihapus",
    `delete from rule_versions where id = ${idWh};`,
    "jangan menghapus sejarahnya",
  );

  ditolak(
    "severity tidak boleh diubah di tempat",
    `update rule_versions set severity_default = 'critical' where id = ${idWh};`,
    "tidak boleh diubah di tempat",
  );

  ditolak(
    "periode mulai tidak boleh digeser",
    `update rule_versions set berlaku_mulai = '2026-01' where id = ${idWh};`,
    "tidak boleh diubah di tempat",
  );

  // `catatan` memang boleh diperbaiki — ia tidak menentukan arti apa pun.
  sql(`update rule_versions set catatan = 'catatan boleh diperbaiki' where id = ${idWh};`);
  const catatan = satu(`select catatan from rule_versions where id = ${idWh};`);
  ok("catatan boleh diperbaiki — ia tidak mengubah arti", catatan === "catatan boleh diperbaiki", catatan);

  const ambangUtuh = satu(`select nilai_ambang::text from rule_conditions where rule_version_id = ${idWh};`);
  ok("ambangnya tetap 30 setelah semua penolakan", Number(ambangUtuh) === 30, ambangUtuh);

  /* ── satu-satunya cara ambang berubah: tutup yang lama, lahirkan yang baru ── */

  sql(`update rule_versions set berlaku_sampai = '2026-11' where id = ${idWh};`);
  const tertutup = satu(`select berlaku_sampai from rule_versions where id = ${idWh};`);
  ok("versi yang masih berlaku BOLEH ditutup", tertutup === "2026-11", tertutup);

  ditolak(
    "rentang yang sudah ditutup tidak boleh diubah lagi",
    `update rule_versions set berlaku_sampai = '2027-05' where id = ${idWh};`,
    "sudah ditutup",
  );

  ditolak(
    "rentang yang sudah ditutup tidak boleh dibuka kembali",
    `update rule_versions set berlaku_sampai = null where id = ${idWh};`,
    "sudah ditutup",
  );

  sql(`
    with v as (
      insert into rule_versions (rule_kode, versi, berlaku_mulai, sumber)
      values ('warehouse_persen', 2, '2026-12', 'keputusan uji')
      returning id
    )
    insert into rule_conditions (rule_version_id, urutan, operator, nilai_ambang)
    select id, 1, 'gt', 25 from v;
  `);
  const dua = Number(satu(`select count(*) from rule_versions where rule_kode='warehouse_persen';`));
  ok("versi baru lahir berdampingan, yang lama tetap ada", dua === 2, `${dua} versi`);

  const lama = satu(`select c.nilai_ambang::text from rule_versions v join rule_conditions c on c.rule_version_id=v.id where v.rule_kode='warehouse_persen' and v.versi=1;`);
  ok("v1 masih berambang 30 — sejarahnya utuh", Number(lama) === 30, lama);

  const septemberPakai = satu(`select v.versi::text from rule_versions v where v.rule_kode='warehouse_persen'
                               and '2026-09' >= v.berlaku_mulai and '2026-09' <= coalesce(v.berlaku_sampai, '9999-99');`);
  ok("September tetap dinilai v1 walau v2 sudah ada", septemberPakai === "1", `v${septemberPakai}`);
  const desemberPakai = satu(`select v.versi::text from rule_versions v where v.rule_kode='warehouse_persen'
                               and '2026-12' >= v.berlaku_mulai and '2026-12' <= coalesce(v.berlaku_sampai, '9999-99');`);
  ok("Desember memakai v2", desemberPakai === "2", `v${desemberPakai}`);

  const bertumpang = satu(`
    select count(*) from rule_versions a join rule_versions b
      on a.rule_kode = b.rule_kode and a.id <> b.id
     and a.berlaku_mulai <= coalesce(b.berlaku_sampai, '9999-99')
     and coalesce(a.berlaku_sampai, '9999-99') >= b.berlaku_mulai;`);
  ok("tidak ada satu pun rentang yang bertumpang di seluruh tabel", Number(bertumpang) === 0, `${bertumpang} pasangan`);

  /* ── batasan bentuk ── */

  // Aturan kosong khusus uji bentuk. Aturan yang sudah punya versi terbuka
  // selalu ditolak pemicu tumpang tindih LEBIH DULU — pemicu BEFORE berjalan
  // sebelum CHECK — jadi batasan bentuknya tidak akan pernah kebagian bicara
  // kalau diuji di sana. Ditolak karena alasan yang salah sama tidak berartinya
  // dengan lolos karena alasan yang salah.
  sql(`insert into rules (kode, nama, kpi_definition_id, kategori) values ('uji_bentuk', 'Uji bentuk', 'biaya.hpp_pct', 'biaya');`);

  ditolak(
    "periode berlaku yang bukan YYYY-MM ditolak",
    `insert into rule_versions (rule_kode, versi, berlaku_mulai, sumber) values ('uji_bentuk', 1, '2026-1', 'uji');`,
    "rule_versions_mulai_bentuk",
  );

  ditolak(
    "rentang terbalik ditolak",
    `insert into rule_versions (rule_kode, versi, berlaku_mulai, berlaku_sampai, sumber) values ('uji_bentuk', 1, '2027-05', '2027-01', 'uji');`,
    "rule_versions_rentang",
  );

  ditolak(
    "severity di luar daftar ditolak",
    `insert into rule_versions (rule_kode, versi, berlaku_mulai, severity_default, sumber) values ('uji_bentuk', 1, '2027-01', 'gawat', 'uji');`,
    "rule_versions_severity_check",
  );

  ditolak(
    "between tanpa ambang kedua ditolak",
    `insert into rule_conditions (rule_version_id, urutan, operator, nilai_ambang) values (${idWh}, 2, 'between', 10);`,
    "rule_conditions_between",
  );

  ditolak(
    "aturan yang menunjuk KPI tak dikenal ditolak",
    `insert into rules (kode, nama, kpi_definition_id, kategori) values ('uji_yatim', 'Uji', 'biaya.tidak_ada', 'biaya');`,
    "foreign key",
  );

  /* ── RLS betul-betul menutup ── */

  sql(`grant select on rules, rule_versions, rule_conditions to uji_anon;`);
  for (const t of ["rules", "rule_versions", "rule_conditions"]) {
    const n = Number(satu(`select count(*) from ${t};`, { peran: "uji_anon" }));
    ok(`anon membaca NOL baris ${t}`, n === 0, `${n} baris`);
  }
}

/* ══════════ 25 · TASK #87A — decision lock: aturan yang ditarik ══════════ */

const MIGRASI_87A = join(AKAR, "supabase/migrations/0110_decision_lock_87a.sql");

const DITARIK = ["listrik_persen", "air_persen", "internet_persen"];

// Tujuh yang dikukuhkan pemiliknya. Angkanya ditulis lagi di sini dengan
// sengaja: kalau salah satunya bergeser di migrasi tanpa keputusan baru,
// pergeseran itu harus jatuh di sini, bukan di laporan yang sudah dibaca orang.
const DIKUKUHKAN = [
  ["warehouse_persen", "gt", "30", "2026-08"],
  ["non_warehouse_persen", "gt", "5", "2026-08"],
  ["total_pembelian_persen", "gt", "35", "2026-08"],
  ["tenaga_kerja_persen", "gt", "13", "2026-08"],
  ["lainnya_persen", "gt", "3", "2026-08"],
  ["laba_bersih_persen", "lt", "30", "2026-08"],
  ["sewa_melebihi_ambang", "gt", "5", "2026-10"],
];

function jalankanMigrasi87A() {
  judul("25 · migrasi 0110_decision_lock_87a.sql");
  if (!existsSync(MIGRASI_87A)) throw new Error(`migrasi tidak ditemukan: ${MIGRASI_87A}`);

  // Sejarah yang harus tetap utuh sesudahnya. Dicatat SEBELUM, supaya "tidak
  // berubah" dibuktikan, bukan dinyatakan.
  const versiSebelum = Number(satu(`select count(*) from rule_versions;`));
  const syaratSebelum = Number(satu(`select count(*) from rule_conditions;`));
  const ruleSebelum = Number(satu(`select count(*) from rules;`));
  const sidikSebelum = satu(`select md5(string_agg(v.rule_kode||'|'||v.versi||'|'||c.operator||'|'||c.nilai_ambang::text, E'\n' order by v.rule_kode, v.versi))
                               from rule_conditions c join rule_versions v on v.id = c.rule_version_id;`);
  sql(readFileSync(MIGRASI_87A, "utf8"));

  /* ── yang ditarik benar-benar berhenti menilai ── */

  for (const kode of DITARIK) {
    const aktif = satu(`select aktif::text from rules where kode = '${kode}';`);
    ok(`${kode} — dinonaktifkan`, !benar(aktif), aktif);
  }

  const nonaktif = satu(`select string_agg(kode, ', ' order by kode) from rules where not aktif;`);
  ok("tepat tiga yang ditarik, tidak lebih", nonaktif === DITARIK.slice().sort().join(", "), nonaktif);

  /* ── SEJARAHNYA TIDAK DIHAPUS ──
   *
   * Inilah yang membedakan "ditarik" dari "tidak pernah ada". Barisnya tetap
   * bisa dibaca beserta `sumber` yang menyebut asal-usulnya — dan kalimat itu
   * yang membuat penarikannya bisa ditelusuri bertahun-tahun kemudian. */

  const versiSesudah = Number(satu(`select count(*) from rule_versions;`));
  const syaratSesudah = Number(satu(`select count(*) from rule_conditions;`));
  const ruleSesudah = Number(satu(`select count(*) from rules;`));
  ok("tidak satu pun versi hilang", versiSesudah === versiSebelum, `${versiSebelum} → ${versiSesudah}`);
  ok("tidak satu pun syarat hilang", syaratSesudah === syaratSebelum, `${syaratSebelum} → ${syaratSesudah}`);
  ok("tidak satu pun aturan dihapus", ruleSesudah === ruleSebelum, `${ruleSebelum} → ${ruleSesudah}`);

  const sidikSesudah = satu(`select md5(string_agg(v.rule_kode||'|'||v.versi||'|'||c.operator||'|'||c.nilai_ambang::text, E'\n' order by v.rule_kode, v.versi))
                               from rule_conditions c join rule_versions v on v.id = c.rule_version_id;`);
  ok("tidak ada satu pun ambang yang bergeser", sidikSesudah === sidikSebelum, `${sidikSebelum} → ${sidikSesudah}`);

  for (const [kode, ambang] of [["listrik_persen", "4"], ["air_persen", "1"], ["internet_persen", "1"]]) {
    const a = satu(`select c.nilai_ambang::text from rules r
                      join rule_versions v on v.rule_kode = r.kode
                      join rule_conditions c on c.rule_version_id = v.id
                     where r.kode = '${kode}';`);
    ok(`${kode} — ambang ${ambang} masih terbaca, cuma tidak berlaku`, a === ambang, a);
  }

  const sumberJujur = satu(`select count(*) from rules r join rule_versions v on v.rule_kode = r.kode
                             where not r.aktif and v.sumber like '%TASK #87%';`);
  ok("sumbernya tetap menyebut asal-usulnya", Number(sumberJujur) === 3, `${sumberJujur} versi`);

  /* ── yang dikukuhkan tidak tersentuh ── */

  for (const [kode, operator, ambang, mulai] of DIKUKUHKAN) {
    const b = satu(`select r.aktif::text || '|' || c.operator || '|' || c.nilai_ambang::text || '|' || v.berlaku_mulai
                      from rules r
                      join rule_versions v on v.rule_kode = r.kode and v.versi = 1
                      join rule_conditions c on c.rule_version_id = v.id
                     where r.kode = '${kode}';`);
    ok(`${kode} — tetap aktif, ${operator} ${ambang}, mulai ${mulai}`, b === `true|${operator}|${ambang}|${mulai}`, b);
  }

  // `op_settings` tidak ada di perancah lokal — ia diverifikasi langsung di
  // produksi. Yang bisa dijamin di sini justru yang lebih kuat: perintah
  // migrasinya tidak menyebut satu pun tabel itu. Komentarnya dibuang dulu;
  // di sanalah nama-nama tabel itu memang disebut, dan menyebut bukan
  // menyentuh.
  const perintah = readFileSync(MIGRASI_87A, "utf8").replace(/--.*$/gm, "");
  for (const t of ["op_settings", "kpi_values", "targets", "rule_versions", "rule_conditions", "op_expenses", "op_pnl", "op_purchases"]) {
    ok(`migrasi tidak menyentuh ${t}`, !perintah.includes(t), "");
  }
  for (const p of [/\bdelete\b/i, /\bdrop\b/i, /\balter\b/i, /\binsert\b/i]) {
    ok(`migrasi tidak memuat ${String(p).slice(3, -4)}`, !p.test(perintah), "");
  }

  /* ── KPI yang tidak punya aturan aktif ──
   *
   * Empat yang memang belum pernah punya, ditambah tiga yang baru ditarik.
   * `tanpa_aturan` adalah hasil yang sah; yang tidak sah adalah menyebutnya
   * aman. */

  for (const kpi of ["biaya.electricity_pct", "biaya.water_pct", "biaya.internet_pct",
                     "biaya.cleaning_pct", "biaya.platform_fee_pct", "biaya.pbjt_pct",
                     "sales.achievement", "sales.gross_sales", "sales.net_sales",
                     "sales.average_transaction", "sales.monthly_target"]) {
    const n = satu(`select count(*) from rules where kpi_definition_id = '${kpi}' and aktif;`);
    ok(`${kpi} — tanpa aturan aktif`, Number(n) === 0, `${n} aturan`);
  }
}

/* ══════════════════ 26 · TASK #88B — lapisan Signal ══════════════════ */

const MIGRASI_88 = join(AKAR, "supabase/migrations/0111_signals.sql");

/** Periode terpencil khusus uji Signal — tidak bersinggungan dengan data mana pun. */
const P88 = "2027-09";

const muat = (baris) => `$muat$${JSON.stringify(baris)}$muat$::jsonb`;

function jalankanMigrasi88() {
  judul("26 · migrasi 0111_signals.sql");
  if (!existsSync(MIGRASI_88)) throw new Error(`migrasi tidak ditemukan: ${MIGRASI_88}`);
  sql(readFileSync(MIGRASI_88, "utf8"));

  /* ── bentuk ── */

  const ada = satu(`select count(*) from information_schema.tables where table_schema='public' and table_name='signals';`);
  ok("tabel signals terpasang", Number(ada) === 1, `${ada}`);

  const rls = satu(`select relrowsecurity::text from pg_class where oid='public.signals'::regclass;`);
  ok("RLS menyala", benar(rls), rls);
  const policy = satu(`select count(*) from pg_policies where schemaname='public' and tablename='signals';`);
  ok("tanpa policy — menolak secara bawaan", Number(policy) === 0, `${policy} policy`);

  const unik = satu(`select indexdef from pg_indexes where schemaname='public' and indexname='signals_unik';`);
  ok("identitasnya (rule_version_id, cakupan, cakupan_id, periode, skala)",
    unik.includes("rule_version_id, cakupan, cakupan_id, periode, skala"), unik.slice(0, 120));
  ok("identitasnya TIDAK memuat kpi_value_id", !unik.includes("kpi_value_id"), unik.slice(0, 80));

  const dihasilkan = satu(`select generation_expression from information_schema.columns where table_name='signals' and column_name='cakupan_id';`);
  ok("cakupan_id dihasilkan dari coalesce — lubang NULL korporat tertutup",
    dihasilkan.includes("korporat"), dihasilkan);

  const pemicu = satu(`select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid where not t.tgisinternal and c.relname='signals';`);
  ok("pemicu immutability terpasang", Number(pemicu) === 1, `${pemicu} pemicu`);

  const hakRpc = satu(`select count(*) from information_schema.routine_privileges where routine_name='gwg_deteksi_signal' and grantee in ('anon','authenticated','PUBLIC');`);
  ok("RPC tertutup untuk anon/authenticated", Number(hakRpc) === 0, `${hakRpc} hak`);

  /* ── perancah data: satu outlet, satu korporat, di periode terpencil ── */

  const idVersi = Number(satu(`select id from rule_versions where rule_kode='tenaga_kerja_persen' and versi=1;`));
  ok("versi aturan tenaga kerja ditemukan", idVersi > 0, `id ${idVersi}`);

  sql(`insert into kpi_values (kpi_definition_id, cakupan, outlet_id, periode, skala, nilai, status, sumber, rumus)
       values ('biaya.labor_pct', 'outlet', '${outletUji}', '${P88}', 'bulanan', 14.2, 'final', 'uji', 'uji')
       on conflict do nothing;`);
  sql(`insert into kpi_values (kpi_definition_id, cakupan, periode, skala, nilai, status, sumber, rumus)
       values ('biaya.labor_pct', 'korporat', '${P88}', 'bulanan', 15.1, 'final', 'uji', 'uji')
       on conflict do nothing;`);

  const idOutlet = Number(satu(`select id from kpi_values where periode='${P88}' and cakupan='outlet' and terkini;`));
  const idKorp = Number(satu(`select id from kpi_values where periode='${P88}' and cakupan='korporat' and terkini;`));
  ok("dua baris KPI uji tersedia", idOutlet > 0 && idKorp > 0, `outlet ${idOutlet} · korporat ${idKorp}`);

  const barisOutlet = (o = {}) => ({
    boleh_sisip: true,
    rule_version_id: idVersi,
    cakupan: "outlet",
    outlet_id: outletUji,
    area_id: null,
    periode: P88,
    skala: "bulanan",
    kpi_definition_id: "biaya.labor_pct",
    kpi_value_id: idOutlet,
    nilai_actual: 14.2,
    nilai_ambang: 13,
    nilai_ambang_2: null,
    operator: "gt",
    severity: "high",
    status_kpi: "final",
    kpi_value_id_terakhir: idOutlet,
    nilai_terakhir: 14.2,
    kondisi_terakhir: "lewat_ambang",
    status_kpi_terakhir: "final",
    ...o,
  });

  const barisKorp = (o = {}) => barisOutlet({
    cakupan: "korporat",
    outlet_id: null,
    kpi_value_id: idKorp,
    nilai_actual: 15.1,
    kpi_value_id_terakhir: idKorp,
    nilai_terakhir: 15.1,
    ...o,
  });

  const deteksi = (baris) => JSON.parse(satu(`select gwg_deteksi_signal('${P88}', ${muat(baris)});`));

  /* ── kelahiran ── */

  const j1 = deteksi([barisOutlet(), barisKorp()]);
  ok("jalan pertama melahirkan dua Signal", j1.disisipkan === 2 && j1.diperbarui === 0, JSON.stringify(j1));

  const nSignal = Number(satu(`select count(*) from signals where periode='${P88}';`));
  ok("dua baris tersimpan", nSignal === 2, `${nSignal} baris`);

  const cakupanKorp = satu(`select cakupan_id from signals where periode='${P88}' and cakupan='korporat';`);
  ok("Signal korporat ber-cakupan_id '~korporat'", cakupanKorp === "~korporat", cakupanKorp);

  const bawaan = satu(`select status || '|' || kondisi_terakhir from signals where periode='${P88}' and cakupan='outlet';`);
  ok("lahir sebagai terbuka + lewat_ambang", bawaan === "terbuka|lewat_ambang", bawaan);

  /* ── IDEMPOTENSI ── */

  const sidikSebelum = satu(`select md5(string_agg(id||'|'||nilai_actual::text||'|'||nilai_ambang::text||'|'||operator||'|'||severity||'|'||status_kpi||'|'||kpi_value_id::text||'|'||terdeteksi_pada::text, E'\n' order by id)) from signals where periode='${P88}';`);

  const j2 = deteksi([barisOutlet(), barisKorp()]);
  ok("jalan kedua tidak melahirkan apa pun", j2.disisipkan === 0 && j2.diperbarui === 2, JSON.stringify(j2));
  ok("jumlahnya tetap dua", Number(satu(`select count(*) from signals where periode='${P88}';`)) === 2, "");

  const sidikSesudah = satu(`select md5(string_agg(id||'|'||nilai_actual::text||'|'||nilai_ambang::text||'|'||operator||'|'||severity||'|'||status_kpi||'|'||kpi_value_id::text||'|'||terdeteksi_pada::text, E'\n' order by id)) from signals where periode='${P88}';`);
  ok("snapshot tidak bergeser sedikit pun", sidikSesudah === sidikSebelum, `${sidikSebelum} → ${sidikSesudah}`);

  /* ── DUA DETEKSI KORPORAT IDENTIK = SATU SIGNAL ── */

  deteksi([barisKorp()]);
  deteksi([barisKorp()]);
  const nKorp = Number(satu(`select count(*) from signals where periode='${P88}' and cakupan='korporat';`));
  ok("korporat tetap SATU walau dideteksi berkali-kali — lubang NULL tertutup", nKorp === 1, `${nKorp} baris`);

  /* ── bukti berganti, identitas tetap ── */

  sql(`insert into kpi_values (kpi_definition_id, cakupan, outlet_id, periode, skala, nilai, status, sumber, rumus, versi, terkini)
       values ('biaya.labor_pct', 'outlet', '${outletUji}', '${P88}', 'bulanan', 14.4, 'final', 'uji', 'uji', 2, false);`);
  const idBaru = Number(satu(`select id from kpi_values where periode='${P88}' and cakupan='outlet' and versi=2;`));

  const j3 = deteksi([barisOutlet({ kpi_value_id: idBaru, kpi_value_id_terakhir: idBaru, nilai_terakhir: 14.4 })]);
  ok("regenerasi KPI tidak melahirkan Signal baru", j3.disisipkan === 0 && j3.diperbarui === 1, JSON.stringify(j3));

  const jejak = satu(`select kpi_value_id::text || '|' || kpi_value_id_terakhir::text || '|' || nilai_actual::text || '|' || nilai_terakhir::text from signals where periode='${P88}' and cakupan='outlet';`);
  ok("bukti awal tetap, bukti terakhir berpindah", jejak === `${idOutlet}|${idBaru}|14.2|14.4`, jejak);

  /* ── KPI membaik ── */

  deteksi([barisOutlet({ boleh_sisip: false, kondisi_terakhir: "aman", nilai_terakhir: 12.1 })]);
  const membaik = satu(`select status || '|' || kondisi_terakhir || '|' || nilai_terakhir::text || '|' || nilai_actual::text from signals where periode='${P88}' and cakupan='outlet';`);
  ok("membaik: kondisi berubah, status TIDAK, snapshot TIDAK", membaik === "terbuka|aman|12.1|14.2", membaik);
  ok("Signal tidak dihapus saat membaik", Number(satu(`select count(*) from signals where periode='${P88}';`)) === 2, "");

  /* ── KPI memburuk ── */

  deteksi([barisOutlet({ nilai_terakhir: 41 })]);
  const memburuk = satu(`select nilai_actual::text || '|' || nilai_terakhir::text from signals where periode='${P88}' and cakupan='outlet';`);
  ok("memburuk: snapshot tetap 14.2, pengamatan jadi 41", memburuk === "14.2|41", memburuk);

  /* ── AD-14 · sumber_sah = false ── */

  sql(`insert into kpi_values (kpi_definition_id, cakupan, outlet_id, periode, skala, nilai, status, sumber, rumus, sumber_sah)
       values ('biaya.other_pct', 'outlet', '${outletUji}', '${P88}', 'bulanan', 9.9, 'final', 'uji', 'uji', false);`);
  const idLain = Number(satu(`select id from kpi_values where periode='${P88}' and kpi_definition_id='biaya.other_pct' and terkini;`));
  const idVersiLain = Number(satu(`select id from rule_versions where rule_kode='lainnya_persen' and versi=1;`));

  const barisLain = (o = {}) => barisOutlet({
    boleh_sisip: false,
    rule_version_id: idVersiLain,
    kpi_definition_id: "biaya.other_pct",
    kpi_value_id: idLain,
    kpi_value_id_terakhir: idLain,
    nilai_actual: 9.9,
    nilai_ambang: 3,
    severity: "medium",
    nilai_terakhir: 9.9,
    kondisi_terakhir: "tidak_tersedia",
    ...o,
  });

  const j4 = deteksi([barisLain()]);
  ok("sumber tidak sah TANPA Signal existing → tidak ada yang lahir, tidak ada yang tersentuh",
    j4.disisipkan === 0 && j4.diperbarui === 0 && j4.diamati_saja === 0, JSON.stringify(j4));
  ok("tetap dua Signal", Number(satu(`select count(*) from signals where periode='${P88}';`)) === 2, "");

  // Sekarang Signal-nya dilahirkan lebih dulu (sumbernya masih sah), baru
  // sumbernya dinyatakan tidak sah pada jalan berikutnya.
  deteksi([barisLain({ boleh_sisip: true, kondisi_terakhir: "lewat_ambang" })]);
  ok("tiga Signal setelah lainnya_persen lahir", Number(satu(`select count(*) from signals where periode='${P88}';`)) === 3, "");

  const j5 = deteksi([barisLain()]);
  ok("sumber tidak sah DENGAN Signal existing → pengamatan diperbarui, tanpa baris baru",
    j5.disisipkan === 0 && j5.diperbarui === 0 && j5.diamati_saja === 1, JSON.stringify(j5));

  const lain = satu(`select status || '|' || kondisi_terakhir from signals where periode='${P88}' and kpi_definition_id='biaya.other_pct';`);
  ok("kondisinya tidak_tersedia — BUKAN aman", lain === "terbuka|tidak_tersedia", lain);

  /* ── DIABAIKAN TIDAK PERNAH DIBUKA MESIN ── */

  sql(`update signals set status='diabaikan', diabaikan_oleh='u1', diabaikan_pada=now(), diabaikan_alasan='sudah ditangani di luar sistem'
        where periode='${P88}' and cakupan='outlet' and kpi_definition_id='biaya.labor_pct';`);

  deteksi([barisOutlet()]);
  const tetap = satu(`select status || '|' || kondisi_terakhir from signals where periode='${P88}' and cakupan='outlet' and kpi_definition_id='biaya.labor_pct';`);
  ok("diabaikan + masih melanggar → TETAP diabaikan", tetap === "diabaikan|lewat_ambang", tetap);

  // diabaikan → membaik → melanggar lagi. Inilah jalur yang paling mudah
  // melahirkan Signal kembar diam-diam.
  deteksi([barisOutlet({ boleh_sisip: false, kondisi_terakhir: "aman", nilai_terakhir: 28 })]);
  const sesudahAman = satu(`select status || '|' || kondisi_terakhir from signals where periode='${P88}' and cakupan='outlet' and kpi_definition_id='biaya.labor_pct';`);
  ok("diabaikan → aman: status tetap diabaikan", sesudahAman === "diabaikan|aman", sesudahAman);

  const j6 = deteksi([barisOutlet({ nilai_terakhir: 41 })]);
  const sesudahLanggarLagi = satu(`select status || '|' || kondisi_terakhir || '|' || nilai_terakhir::text from signals where periode='${P88}' and cakupan='outlet' and kpi_definition_id='biaya.labor_pct';`);
  ok("diabaikan → aman → melanggar lagi: TETAP diabaikan, tanpa Signal kembar",
    j6.disisipkan === 0 && sesudahLanggarLagi === "diabaikan|lewat_ambang|41", `${JSON.stringify(j6)} · ${sesudahLanggarLagi}`);
  ok("jumlahnya tetap tiga sepanjang seluruh urutan itu", Number(satu(`select count(*) from signals where periode='${P88}';`)) === 3, "");

  const idAbai = Number(satu(`select id from signals where periode='${P88}' and status='diabaikan';`));
  ditolak(
    "mesin maupun manusia tidak boleh membuka kembali yang sudah diabaikan",
    `update signals set status='terbuka', diabaikan_oleh=null, diabaikan_pada=null, diabaikan_alasan=null where id=${idAbai};`,
    "tidak boleh dibuka kembali",
  );

  /* ── snapshot & identitas tidak bisa disunting ── */

  const idUji = Number(satu(`select id from signals where periode='${P88}' and cakupan='korporat';`));

  for (const [kolom, nilai] of [
    ["rule_version_id", String(idVersiLain)],
    ["cakupan", `'outlet'`],
    ["periode", `'2027-10'`],
    ["skala", `'harian'`],
  ]) {
    ditolak(`identitas — ${kolom} tidak boleh diubah`, `update signals set ${kolom} = ${nilai} where id=${idUji};`, "identitas signal");
  }

  for (const [kolom, nilai] of [
    ["kpi_definition_id", `'biaya.other_pct'`],
    ["kpi_value_id", String(idLain)],
    ["nilai_actual", "99"],
    ["nilai_ambang", "1"],
    ["operator", `'lt'`],
    ["severity", `'low'`],
    ["status_kpi", `'sementara'`],
    ["terdeteksi_pada", "now()"],
  ]) {
    ditolak(`snapshot — ${kolom} tidak boleh diubah`, `update signals set ${kolom} = ${nilai} where id=${idUji};`, "snapshot deteksi");
  }

  ditolak("signal tidak boleh dihapus", `delete from signals where id=${idUji};`, "tidak boleh dihapus");

  sql(`update signals set nilai_terakhir = 17.7, kondisi_terakhir='lewat_ambang', diamati_pada=now() where id=${idUji};`);
  ok("pengamatan BOLEH berubah", satu(`select nilai_terakhir::text from signals where id=${idUji};`) === "17.7", "");

  /* ── batasan bentuk ── */

  ditolak(
    "mengabaikan tanpa alasan ditolak",
    `update signals set status='diabaikan', diabaikan_oleh='u1', diabaikan_pada=now() where id=${idUji};`,
    "signals_diabaikan_utuh",
  );
  // Ditolak dua batasan sekaligus, dan yang bicara duluan tidak ditentukan
  // PostgreSQL. Jadi yang diuji perilakunya — ditolak — plus keberadaan
  // batasannya secara struktural. Menuntut nama batasan tertentu di sini
  // membuat uji ini gagal karena alasan yang salah, dan itu sama tidak
  // berartinya dengan lolos karena alasan yang salah.
  ditolak(
    "keadaan kerja di luar dua yang disepakati ditolak",
    `update signals set status='resolved' where id=${idUji};`,
    "violates check constraint",
  );
  const bentukStatus = satu(`select pg_get_constraintdef(oid) from pg_constraint where conname='signals_status_check';`);
  ok("hanya terbuka dan diabaikan yang sah", bentukStatus.includes("terbuka") && bentukStatus.includes("diabaikan")
      && !bentukStatus.includes("resolved") && !bentukStatus.includes("acknowledged"), bentukStatus);
  ditolak(
    "muatan berisi periode lain ditolak",
    `select gwg_deteksi_signal('${P88}', ${muat([barisOutlet({ periode: "2027-10" })])});`,
    "memuat periode selain",
  );

  /* ── versi aturan berganti = Signal baru ── */

  const idVersiWh = Number(satu(`select id from rule_versions where rule_kode='warehouse_persen' and versi=2;`));
  deteksi([barisOutlet({ rule_version_id: idVersiWh, kpi_definition_id: 'biaya.warehouse_pct' })]);
  const nAkhir = Number(satu(`select count(*) from signals where periode='${P88}';`));
  ok("versi aturan berbeda melahirkan Signal tersendiri", nAkhir === 4, `${nAkhir} baris`);
  ok("yang lama tetap utuh", Number(satu(`select count(*) from signals where periode='${P88}' and rule_version_id=${idVersi};`)) === 2, "");

  /* ── dua panggilan dalam satu transaksi ── */

  const dua = sql(`begin;
    select gwg_deteksi_signal('${P88}', ${muat([barisOutlet()])});
    select gwg_deteksi_signal('${P88}', ${muat([barisKorp()])});
  commit;`);
  ok("dua panggilan dalam satu transaksi tidak bertabrakan di tabel sementara", dua.includes("periode"), "lolos");

  /* ── RLS ── */

  sql(`grant select on signals to uji_anon;`);
  const nAnon = Number(satu(`select count(*) from signals;`, { peran: "uji_anon" }));
  ok("anon membaca NOL baris signals", nAnon === 0, `${nAnon} baris`);

  /* ── KPI tidak tersentuh sama sekali ── */

  const kpiUtuh = satu(`select count(*) from kpi_values where periode='${P88}';`);
  ok("deteksi tidak menambah/menghapus satu baris KPI pun", Number(kpiUtuh) === 4, `${kpiUtuh} baris`);
}

/* ─────────────────────────── jalan ─────────────────────────── */

function utama() {
  console.log("╭──────────────────────────────────────────────────────────────╮");
  console.log("│  UJI BASIS DATA OPERATIONAL V.1 — PostgreSQL LOKAL            │");
  console.log("│  Produksi tidak disentuh: tidak ada kredensial, tidak ada     │");
  console.log("│  jaringan, tidak ada satu pun perintah yang keluar dari mesin │");
  console.log("│  ini.                                                         │");
  console.log("╰──────────────────────────────────────────────────────────────╯");

  pastikanHidup();
  basisDataBaru();
  perancah();
  jalankanMigrasi();

  if (DATA && typeof DATA === "string") {
    const { outlets, jumlahHarian, jumlahBulanan } = muatData();
    judul("4 · data Agustus 2026 dimuat");
    ok("outlet dimuat", outlets.length > 0, `${outlets.length} outlet`);
    ok("baris harian dimuat", jumlahHarian > 0, `${jumlahHarian} baris seasonal_daily`);
    ok("riwayat bulanan dimuat", jumlahBulanan > 0, `${jumlahBulanan} baris esb_net_bulanan`);
    ujiBatasan();
    ujiUnik();
    ujiRls();
    const c = rekonsiliasi(outlets);
    dryRun(c);
    bebanLamaSebelumMigrasi();
    jalankanMigrasi2B();
    ujiBatch();
    ujiRincianUtilitas();
    const jml = muatFinansial();
    ok("angka finansial Agustus dimuat", jml === 58, `${jml} outlet`);
    jalankanMigrasi2C();
    simpanKeuangan(rekonsiliasiKeuangan());
    jalankanMigrasi85();
    ujiTulisBerversi();
    ujiTolakDanUtuh();
    ujiKunciPeriode();
    jalankanMigrasi85A();
    ujiFinalisasi();
    ujiFinalisasiUtuh();
    jalankanMigrasi87();
    ujiAturanTakBerubah();
    jalankanMigrasi87A();
    jalankanMigrasi88();
  } else {
    judul("4 · isi contoh minimum");
    isiContoh();
    ok("isi contoh terpasang", true, "1 user · 1 area · 1 outlet");
    console.log("\n  (tanpa --data, rekonsiliasi Agustus dilewati)");
    ujiBatasan();
    ujiUnik();
    ujiRls();
    bebanLamaSebelumMigrasi();
    jalankanMigrasi2B();
    ujiBatch();
    ujiRincianUtilitas();
    jalankanMigrasi2C();
    jalankanMigrasi85();
    jalankanMigrasi85A();
    jalankanMigrasi87();
  }

  bersihkan();

  judul("HASIL");
  console.log(`  lulus ${lulus} · gagal ${gagal}`);
  for (const n of catatanGagal) console.log(`  ✗ ${n}`);
  process.exit(gagal === 0 ? 0 : 1);
}

try {
  utama();
} catch (e) {
  console.error(`\nBERHENTI: ${e.message}`);
  try {
    if (!SIMPAN) sql(`drop database if exists ${DB};`, { db: "postgres" });
  } catch {
    /* sudah tidak ada */
  }
  process.exit(1);
}
