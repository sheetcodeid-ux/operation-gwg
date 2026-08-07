import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { isImageAttachment } from "../chat-shared";

/**
 * Penjaga aturan "tidak ada tindak lanjut tanpa bukti".
 *
 * Seluruh gunanya temuan hygiene bertumpu pada satu hal: temuan TIDAK BISA
 * ditutup tanpa foto perbaikan. Kalau penolakannya hanya berupa tombol yang
 * dinonaktifkan, siapa pun yang memanggil server langsung bisa menutupnya
 * dengan mengetik "sudah" — dan catatan ini berhenti bisa dipercaya.
 */

const DATA = readFileSync(join(process.cwd(), "src/lib/data/hygiene-followup.ts"), "utf8");
const ACTIONS = readFileSync(join(process.cwd(), "src/lib/actions/hygiene-followup.ts"), "utf8");
const code = DATA.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

function bodyOf(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}`);
  expect(start, `${name} tidak ditemukan`).toBeGreaterThan(-1);
  const next = src.indexOf("\nexport ", start + 1);
  return src.slice(start, next === -1 ? undefined : next);
}

describe("penutupan temuan wajib berbukti", () => {
  const resolve = bodyOf(code, "resolveFollowup");

  it("ditolak di server saat tidak ada foto", () => {
    expect(resolve).toMatch(/photos\.length === 0/);
    expect(resolve).toContain("Wajib melampirkan foto bukti perbaikan.");
  });

  it("hanya menerima lampiran yang benar-benar gambar", () => {
    // Tanpa saringan ini, sebuah PDF kosong bisa lewat sebagai "bukti foto".
    expect(resolve).toMatch(/startsWith\("image\/"\)/);
  });

  it("hanya supervisor yang ditugaskan yang boleh menutup", () => {
    expect(resolve).toMatch(/assigned_to !== input\.userId/);
  });

  it("temuan yang sudah ditutup tidak bisa ditutup dua kali", () => {
    expect(resolve).toMatch(/status === "selesai"/);
  });
});

describe("pengiriman temuan dijaga cakupannya", () => {
  it("hanya untuk outlet yang boleh dilihat pengirim", () => {
    // Tanpa ini, id outlet tebakan bisa dipakai mengirim temuan ke cabang mana pun.
    const raise = bodyOf(ACTIONS, "hygieneRaiseFollowupAction");
    expect(raise).toContain("canAccessOutlet(");
  });

  it("setiap aksi mengambil sesi, bukan menerima id dari argumen", () => {
    const fns = [...ACTIONS.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
    expect(fns.length).toBeGreaterThan(3);
    for (const fn of fns) {
      expect(bodyOf(ACTIONS, fn), `${fn} tidak mengambil sesi`).toContain("await getSessionUser()");
    }
  });
});

describe("pengenalan lampiran gambar", () => {
  it("mengikuti tipe MIME lebih dulu", () => {
    // Foto dari kamera ponsel sering tidak berekstensi; tipe MIME yang menentukan.
    expect(isImageAttachment({ name: "IMG_0001", type: "image/jpeg" })).toBe(true);
    expect(isImageAttachment({ name: "laporan.pdf", type: "application/pdf" })).toBe(false);
  });

  it("jatuh ke ekstensi kalau tipenya tidak tercatat", () => {
    // Lampiran lama tersimpan tanpa tipe — ekstensinya jadi satu-satunya petunjuk.
    expect(isImageAttachment({ name: "foto.JPG" })).toBe(true);
    expect(isImageAttachment({ name: "foto.heic" })).toBe(true);
    expect(isImageAttachment({ name: "dokumen.docx" })).toBe(false);
    expect(isImageAttachment({ name: "tanpa-ekstensi" })).toBe(false);
  });
});
