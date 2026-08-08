#!/usr/bin/env node
/**
 * Pemeriksa lingkungan — jalankan `npm run doctor` sebelum melapor "tidak jalan".
 *
 * Semua yang diperiksa di sini pernah benar-benar terjadi dan memakan waktu
 * berjam-jam, karena gejalanya menyesatkan: aplikasi tampak rusak padahal
 * kodenya baik-baik saja. Lebih murah memeriksanya dalam dua detik.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const hasil = [];
const catat = (status, judul, pesan = "") => hasil.push({ status, judul, pesan });

/* ── 1. Versi Node ──────────────────────────────────────────────────────── */
{
  const mayor = Number(process.versions.node.split(".")[0]);
  if (mayor >= 20) catat("ok", `Node ${process.versions.node}`);
  else
    catat(
      "gagal",
      `Node ${process.versions.node} terlalu lama`,
      "Next.js 16 butuh Node 20+. Pasang lewat nvm:  nvm install 22 && nvm use 22",
    );
}

/* ── 2. Dependensi sudah dipasang ───────────────────────────────────────── */
{
  if (!existsSync(join(ROOT, "node_modules"))) {
    catat("gagal", "node_modules belum ada", "Jalankan:  npm install");
  } else if (!existsSync(join(ROOT, "node_modules", "next"))) {
    catat("gagal", "Pemasangan tidak lengkap", "Jalankan:  rm -rf node_modules && npm install");
  } else {
    const v = JSON.parse(readFileSync(join(ROOT, "node_modules/next/package.json"), "utf8")).version;
    catat("ok", `Next.js ${v} terpasang`);
  }
}

/* ── 3. Lockfile nyasar di folder induk ─────────────────────────────────── */
/*
 * Turbopack menentukan akar proyek dengan MENCARI KE ATAS sebuah lockfile.
 * Satu berkas nyasar di folder home membuatnya memilih folder home sebagai
 * akar — akibatnya sebagian rute hidup dan sebagian lain membalas 404 tanpa
 * penjelasan. Sudah dijinakkan lewat `turbopack.root` di next.config.ts, tapi
 * tetap diperiksa supaya penyebabnya kelihatan kalau ada gejala aneh.
 */
{
  const LOCKFILES = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb"];
  const nyasar = [];
  let dir = dirname(ROOT);
  let naik = 0;
  while (naik < 5 && dir !== dirname(dir)) {
    for (const f of LOCKFILES) if (existsSync(join(dir, f))) nyasar.push(join(dir, f));
    dir = dirname(dir);
    naik += 1;
  }

  const dipatok = readFileSync(join(ROOT, "next.config.ts"), "utf8").includes("turbopack");
  if (nyasar.length === 0) catat("ok", "Tidak ada lockfile nyasar di folder induk");
  else if (dipatok)
    catat(
      "info",
      `${nyasar.length} lockfile ditemukan di folder induk`,
      `Tidak berbahaya — akar proyek sudah dipatok di next.config.ts.\n     ${nyasar.join("\n     ")}`,
    );
  else
    catat(
      "gagal",
      "Lockfile nyasar TANPA akar yang dipatok",
      `Bisa membuat sebagian halaman balas 404. Hapus berkasnya, atau atur turbopack.root.\n     ${nyasar.join("\n     ")}`,
    );
}

/* ── 4. Cache build basi ────────────────────────────────────────────────── */
{
  if (!existsSync(join(ROOT, ".next"))) catat("ok", "Tidak ada cache build (bersih)");
  else catat("info", "Cache .next ada", "Kalau ada halaman balas 404 aneh:  rm -rf .next");
}

/* ── 5. Mode: demo atau data sungguhan ──────────────────────────────────── */
{
  const envLocal = join(ROOT, ".env.local");
  if (!existsSync(envLocal)) {
    catat("ok", "Mode DEMO (belum ada .env.local)", "Normal. Datanya contoh, pilih persona di layar login.");
  } else {
    const isi = readFileSync(envLocal, "utf8");
    const terisi = (k) => new RegExp(`^${k}=.+`, "m").test(isi);
    const db = terisi("GWG_SUPABASE_URL") && (terisi("SUPABASE_SERVICE_ROLE_KEY") || terisi("GWG_SUPABASE_KEY"));
    catat(
      "ok",
      db ? "Mode DATA SUNGGUHAN (Supabase tersambung)" : "Ada .env.local tetapi Supabase belum lengkap",
      db ? "" : "Aplikasi tetap jalan dalam mode demo sampai GWG_SUPABASE_URL + kunci terisi.",
    );
    if (terisi("ESB_USERNAME") && terisi("ESB_PASSWORD")) catat("ok", "Kredensial ESB terisi (Analisis Fraud aktif)");
    else catat("info", "Kredensial ESB kosong", "Analisis Fraud akan tampil kosong. Normal kalau tidak menggarap modul itu.");
  }
}

/* ── 6. Rahasia tidak boleh ikut ter-commit ─────────────────────────────── */
{
  const diabaikan = readFileSync(join(ROOT, ".gitignore"), "utf8");
  if (/^\.env\*/m.test(diabaikan)) catat("ok", ".env* diblokir .gitignore");
  else catat("gagal", ".env* TIDAK diblokir .gitignore", "Rahasia bisa ikut ter-commit. Perbaiki sebelum commit apa pun.");
}

/* ── Ringkasan ──────────────────────────────────────────────────────────── */
const IKON = { ok: "  ✓", info: "  •", gagal: "  ✗" };
console.log("\n  Pemeriksaan lingkungan Operation GWG\n  " + "─".repeat(48));
for (const { status, judul, pesan } of hasil) {
  console.log(`${IKON[status]} ${judul}`);
  if (pesan) for (const baris of pesan.split("\n")) console.log(`     ${baris}`);
}

const gagal = hasil.filter((h) => h.status === "gagal");
console.log("  " + "─".repeat(48));
if (gagal.length === 0) {
  console.log("  Semua siap. Jalankan:  npm run dev\n");
} else {
  console.log(`  ${gagal.length} hal perlu diperbaiki lebih dulu (tanda ✗ di atas).\n`);
  process.exit(1);
}
