import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { dayLabel, previewOf, shortTime } from "../chat-shared";

/**
 * Penjaga batas percakapan.
 *
 * Pesan terbuka untuk SEMUA pengguna — itu memang tujuannya. Yang tidak boleh
 * longgar adalah batas per percakapan: menebak id percakapan orang lain tidak
 * boleh membocorkan apa pun, dan tidak boleh bisa menitipkan pesan ke sana.
 *
 * Setiap fungsi yang menerima `threadId` dari luar karena itu WAJIB memanggil
 * `isParticipant` lebih dulu.
 */

const SRC = readFileSync(join(process.cwd(), "src/lib/data/chat.ts"), "utf8");
const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/** Potong badan satu fungsi bernama `name` sampai fungsi ekspor berikutnya. */
function bodyOf(name: string): string {
  const start = code.indexOf(`export async function ${name}`);
  expect(start, `${name} tidak ditemukan`).toBeGreaterThan(-1);
  const next = code.indexOf("\nexport ", start + 1);
  return code.slice(start, next === -1 ? undefined : next);
}

describe("batas akses percakapan", () => {
  for (const fn of ["readThread", "sendMessage", "hideThread", "threadPeople"]) {
    it(`${fn} memeriksa keanggotaan sebelum menyentuh percakapan`, () => {
      expect(bodyOf(fn)).toContain("isParticipant(");
    });
  }

  it("readThread mengembalikan null, bukan melempar, saat bukan peserta", () => {
    // Melempar akan membedakan "percakapan ada tapi bukan milikmu" dari
    // "tidak ada" — itu sendiri sudah membocorkan keberadaannya.
    expect(bodyOf("readThread")).toMatch(/isParticipant\([^)]*\)\)\)\s*return null/);
  });

  it("hitungan belum dibaca dibatasi jendela waktu, bukan sejak awal", () => {
    // Tanpa batas, satu percakapan yang belum pernah dibuka membuat setiap
    // penggambaran daftar membaca SELURUH riwayat.
    expect(code).toContain("UNREAD_WINDOW_MS");
    expect(code).toMatch(/Math\.max\(oldest, floor\)/);
  });
});

describe("aksi Pesan selalu tahu siapa penggunanya", () => {
  const actions = readFileSync(join(process.cwd(), "src/lib/actions/chat.ts"), "utf8");

  it("tidak ada aksi yang bekerja tanpa sesi", () => {
    // Tiap aksi ekspor harus mengambil sesi; id pengirim TIDAK BOLEH datang
    // dari argumen, karena itu bisa dipalsukan pemanggil.
    const fns = [...actions.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
    expect(fns.length).toBeGreaterThan(5);
    for (const fn of fns) {
      const start = actions.indexOf(`export async function ${fn}`);
      const next = actions.indexOf("\nexport ", start + 1);
      const body = actions.slice(start, next === -1 ? undefined : next);
      expect(body, `${fn} tidak mengambil sesi`).toContain("await getSessionUser()");
    }
  });

  it("meneruskan pengajuan memeriksa hak lihat pengajuannya", () => {
    // Kalau tidak, obrolan jadi jalan pintas membaca pengajuan cabang lain
    // lewat id tebakan.
    const start = actions.indexOf("export async function chatForwardRequestAction");
    const body = actions.slice(start, actions.indexOf("\nexport ", start + 1));
    expect(body).toContain("canSeeRequest(");
  });
});

describe("pembantu tampilan", () => {
  const now = Date.parse("2026-08-07T12:00:00Z");

  it("waktu singkat mengikuti jaraknya", () => {
    expect(shortTime(new Date(now - 30_000).toISOString(), now)).toBe("baru saja");
    expect(shortTime(new Date(now - 5 * 60_000).toISOString(), now)).toBe("5m");
    expect(shortTime(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe("3j");
    expect(shortTime(new Date(now - 30 * 3_600_000).toISOString(), now)).toBe("kemarin");
  });

  it("waktu singkat tidak pecah pada tanggal ngawur", () => {
    expect(shortTime("bukan tanggal")).toBe("");
  });

  it("hari ini dan kemarin diberi label, bukan tanggal", () => {
    const today = new Date();
    expect(dayLabel(today.toISOString(), today)).toBe("Hari ini");
    const yest = new Date(today);
    yest.setDate(today.getDate() - 1);
    expect(dayLabel(yest.toISOString(), today)).toBe("Kemarin");
  });

  it("ringkasan menjelaskan pesan tanpa teks", () => {
    expect(previewOf({ body: "halo", attachments: [], ref: null })).toBe("halo");
    expect(previewOf({ body: "", attachments: [], ref: { id: "x" } })).toBe("Meneruskan sebuah pengajuan");
    expect(previewOf({ body: "  ", attachments: [1, 2], ref: null })).toBe("2 lampiran");
    expect(previewOf({ body: "", attachments: [], ref: null })).toBe("");
  });
});
