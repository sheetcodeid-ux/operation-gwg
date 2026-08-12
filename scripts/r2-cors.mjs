#!/usr/bin/env node
/**
 * Atur izin CORS bucket R2.
 *
 * Kenapa ini perlu: foto audit hygiene diunggah LANGSUNG dari peramban HP
 * supervisor ke R2 memakai presigned URL. Peramban hanya mengizinkannya bila
 * bucket-nya menyatakan asal (origin) aplikasi kita boleh melakukan PUT. Tanpa
 * itu, permintaannya ditolak sebelum sempat mengirim satu byte pun — dan yang
 * terlihat di lapangan hanyalah unggahan yang berhenti di 0% lalu gagal.
 *
 * Aplikasi sudah punya jalur cadangan lewat server, jadi audit tetap tersimpan
 * tanpa skrip ini. Menjalankannya mengembalikan jalur cepatnya: foto tidak
 * melewati server sama sekali.
 *
 * Dipakai lewat S3 API (R2 mendukung PutBucketCors), memakai kredensial R2 yang
 * SUDAH ada — tidak perlu API token Cloudflare terpisah.
 *
 * Cara pakai:
 *   R2_ENDPOINT=... R2_BUCKET=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
 *     node scripts/r2-cors.mjs https://domain-anda.com [https://asal-lain.com ...]
 *
 * Tanpa argumen asal, skrip hanya MENAMPILKAN aturan yang sedang berlaku.
 */

import { AwsClient } from "aws4fetch";

const endpoint = (process.env.R2_ENDPOINT || "").trim().replace(/\/+$/, "");
const bucket = (process.env.R2_BUCKET || "").trim();
const accessKeyId = (process.env.R2_ACCESS_KEY_ID || "").trim();
const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || "").trim();

const kurang = Object.entries({ R2_ENDPOINT: endpoint, R2_BUCKET: bucket, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey })
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (kurang.length) {
  console.error(`✗ Variabel berikut belum diisi: ${kurang.join(", ")}`);
  console.error("\n  Ambil nilainya di Vercel → Settings → Environment Variables,");
  console.error("  lalu jalankan skripnya dengan variabel itu di depan perintah.");
  process.exit(1);
}

const origins = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const salah = origins.filter((o) => !/^https?:\/\/[^/]+$/.test(o));
if (salah.length) {
  // Asal HARUS berupa skema + host saja. "https://situs.com/" dengan garis
  // miring di belakang tidak akan pernah cocok, dan kegagalannya diam-diam.
  console.error(`✗ Asal berikut tidak sah (harus https://host, tanpa garis miring/jalur): ${salah.join(", ")}`);
  process.exit(1);
}

const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
const url = `${endpoint}/${bucket}?cors`;

/** Tampilkan aturan yang sedang berlaku. */
async function baca() {
  const res = await client.fetch(url, { method: "GET" });
  if (res.status === 404) return null; // belum pernah diatur
  const body = await res.text();
  if (!res.ok) throw new Error(`Gagal membaca CORS (${res.status}) — ${body.slice(0, 300)}`);
  return body;
}

function bangunXml(list) {
  // Header `content-type` ikut ditandatangani presigned URL kita, jadi ia WAJIB
  // ada di AllowedHeader — kalau tidak, preflight-nya ditolak meski origin-nya
  // sudah benar. ETag diekspos supaya pengunggah bisa memastikan berkasnya utuh.
  const rules = list
    .map(
      (o) => `  <CORSRule>
    <AllowedOrigin>${o}</AllowedOrigin>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>content-type</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<CORSConfiguration>\n${rules}\n</CORSConfiguration>`;
}

async function tulis(list) {
  const xml = bangunXml(list);
  const body = new TextEncoder().encode(xml);
  const res = await client.fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/xml", "content-length": String(body.byteLength) },
    body,
  });
  if (!res.ok) {
    throw new Error(`Gagal menyimpan CORS (${res.status}) — ${(await res.text()).slice(0, 300)}`);
  }
}

/** Jalankan dan ubah galat teknis jadi kalimat yang bisa ditindaklanjuti. */
async function coba(label, fn) {
  try {
    return await fn();
  } catch (e) {
    const pesan = e instanceof Error ? e.message : String(e);
    console.error(`✗ ${label}: ${pesan}`);
    if (/fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED/i.test(pesan)) {
      console.error("  Endpoint R2 tidak bisa dihubungi — periksa nilai R2_ENDPOINT.");
    } else if (/\b(401|403)\b|SignatureDoesNotMatch|InvalidAccessKeyId/i.test(pesan)) {
      console.error("  Kredensial ditolak — periksa R2_ACCESS_KEY_ID dan R2_SECRET_ACCESS_KEY,");
      console.error("  dan pastikan token-nya punya izin tulis untuk bucket ini.");
    } else if (/\b404\b|NoSuchBucket/i.test(pesan)) {
      console.error("  Bucket tidak ditemukan — periksa nilai R2_BUCKET.");
    }
    process.exit(1);
  }
}

const sebelum = await coba("Gagal membaca aturan yang berlaku", baca);
console.log(`Bucket : ${bucket}`);
console.log(`Aturan sekarang:\n${sebelum ? sebelum.trim() : "  (belum ada aturan CORS sama sekali)"}\n`);

if (origins.length === 0) {
  console.log("Tidak ada asal yang diberikan — hanya menampilkan.");
  console.log("Untuk mengatur, sertakan domain aplikasinya, mis.:");
  console.log("  node scripts/r2-cors.mjs https://operation-gwg.vercel.app");
  process.exit(0);
}

await coba("Gagal menyimpan aturan", () => tulis(origins));
const sesudah = await coba("Tersimpan, tapi gagal membaca ulang", baca);
console.log(`✓ Tersimpan. Aturan baru:\n${sesudah?.trim()}`);
console.log("\nSekarang minta supervisor menutup lalu membuka lagi aplikasinya, dan coba simpan audit.");
