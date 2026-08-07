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
const SHEET = readFileSync(join(process.cwd(), "src/components/chat/followup-sheet.tsx"), "utf8");
const CAMERA = readFileSync(join(process.cwd(), "src/components/ui/camera-capture.tsx"), "utf8");
const code = DATA.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

function bodyOf(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}`);
  expect(start, `${name} tidak ditemukan`).toBeGreaterThan(-1);
  const next = src.indexOf("\nexport ", start + 1);
  return src.slice(start, next === -1 ? undefined : next);
}

describe("pengiriman bukti perbaikan", () => {
  const submit = bodyOf(code, "submitFollowup");

  it("ditolak di server saat tidak ada foto", () => {
    expect(submit).toMatch(/photos\.length === 0/);
    expect(submit).toContain("Wajib melampirkan foto bukti perbaikan.");
  });

  it("hanya menerima lampiran yang benar-benar gambar", () => {
    // Tanpa saringan ini, sebuah PDF kosong bisa lewat sebagai "bukti foto".
    expect(submit).toMatch(/startsWith\("image\/"\)/);
  });

  it("hanya supervisor yang ditugaskan yang boleh menindaklanjuti", () => {
    expect(submit).toMatch(/assigned_to !== input\.userId/);
  });

  it("temuan yang sudah ditutup tidak bisa dibuka lagi", () => {
    expect(submit).toMatch(/status === "selesai"/);
  });

  it("bukti yang masih menunggu penilaian tidak bisa ditimpa", () => {
    // Kalau boleh, supervisor bisa mengirim ulang terus dan penilaian pelapor
    // selalu menunjuk foto yang sudah bukan yang ia lihat.
    expect(submit).toMatch(/status === "verifikasi"/);
  });

  it("TIDAK menutup temuan sendiri — hanya menaikkannya ke verifikasi", () => {
    // Inti aturannya: orang yang diperiksa tidak boleh jadi penilai hasilnya.
    expect(submit).toMatch(/status: "verifikasi"/);
    expect(submit).not.toMatch(/status: "selesai"/);
    expect(submit).not.toMatch(/resolved_at:/);
  });

  it("menyimpan setiap putaran sebagai riwayat, bukan menimpanya", () => {
    // Temuan yang tiga kali dikembalikan harus bisa dibedakan dari yang
    // sekali langsung beres.
    expect(submit).toMatch(/attempts\.push\(/);
    expect(submit).toMatch(/verdict: "menunggu"/);
  });
});

describe("penilaian hasil perbaikan", () => {
  const review = bodyOf(code, "reviewFollowup");

  it("hanya pelapor yang boleh menilai", () => {
    expect(review).toMatch(/raised_by !== input\.userId/);
  });

  it("tidak bisa menilai kalau belum ada bukti yang masuk", () => {
    expect(review).toMatch(/status !== "verifikasi"/);
  });

  it("pengembalian wajib beralasan", () => {
    // "Dikembalikan" tanpa alasan membuat supervisornya menebak-nebak bagian
    // mana yang masih kotor.
    expect(review).toMatch(/!input\.accept && !input\.note\.trim\(\)/);
    expect(review).toContain("Tulis alasan pengembaliannya.");
  });

  it("penolakan mengembalikan temuan ke MENGGANTUNG, bukan menutupnya", () => {
    expect(review).toMatch(/status: input\.accept \? "selesai" : "menunggu"/);
    expect(review).toMatch(/resolved_at: input\.accept \? new Date\(\)\.toISOString\(\) : null/);
  });

  it("mencatat putusannya di putaran terakhir", () => {
    expect(review).toMatch(/last\.verdict = input\.accept \? "acc" : "tolak"/);
  });
});

describe("bukti diambil langsung dari kamera", () => {
  it("lembar tindak lanjut tidak memakai pemilih berkas biasa", () => {
    // Foto lama dari galeri tidak membuktikan kondisi hari ini.
    expect(SHEET).toContain("CameraCapture");
    expect(SHEET).not.toMatch(/<input[^>]*type="file"/);
  });

  it("kamera belakang dipaksa, bukan galeri", () => {
    expect(CAMERA).toMatch(/capture="environment"/);
    expect(CAMERA).toMatch(/accept="image\/\*"/);
  });

  it("waktu dibakar ke dalam gambar", () => {
    // Kalau hanya ditulis di sebelah foto, waktunya bisa dipisahkan dari
    // gambarnya saat foto diteruskan ke mana-mana.
    expect(CAMERA).toMatch(/ctx\.fillText\(caption/);
    expect(CAMERA).toMatch(/toLocaleString\("id-ID"/);
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

describe("pencarian supervisor outlet", () => {
  const fn = ACTIONS.slice(ACTIONS.indexOf("function supervisorOf"), ACTIONS.indexOf("export async function hygieneSupervisorAction"));

  it("memakai penugasan di users.outletIds LEBIH DULU", () => {
    // `outlets.supervisorId` di basis data ini menunjuk akun Admin untuk SETIAP
    // outlet, jadi memakainya lebih dulu membuat semua temuan terkirim ke Admin
    // alih-alih ke supervisor cabangnya.
    const byAssignment = fn.indexOf("outletIds");
    const legacy = fn.indexOf("outlet.supervisorId");
    expect(byAssignment).toBeGreaterThan(-1);
    expect(legacy).toBeGreaterThan(-1);
    expect(byAssignment).toBeLessThan(legacy);
  });

  it("tidak pernah mengembalikan akun yang bukan supervisor", () => {
    // Termasuk lewat jalur cadangan — kalau tidak, temuan bisa terkirim ke akun
    // Admin dan supervisor cabangnya tidak pernah tahu.
    const checks = [...fn.matchAll(/role === "supervisor"/g)];
    expect(checks.length).toBeGreaterThanOrEqual(2);
  });

  it("hanya pengguna aktif", () => {
    const checks = [...fn.matchAll(/u\.active/g)];
    expect(checks.length).toBeGreaterThanOrEqual(2);
  });
});
