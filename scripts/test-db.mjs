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

/* ─────────────────────────── 11 · bersih-bersih ─────────────────────────── */

function bersihkan() {
  judul("11 · bersih-bersih");
  if (SIMPAN) {
    console.log(`  --simpan diberikan: basis data ${DB} DIBIARKAN hidup.`);
    console.log(`  Hapus sendiri dengan: sudo -u postgres dropdb ${DB}`);
    return;
  }
  sql(`drop database if exists ${DB};`, { db: "postgres" });
  sql(`drop role if exists uji_anon; drop role if exists uji_service;`, { db: "postgres" });
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
     values ('2026-10', 'xyz', 1, 1, 'Uji', 'entahlah');`,
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
