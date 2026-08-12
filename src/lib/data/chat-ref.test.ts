import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { previewOf } from "../chat-shared";

const CHAT = readFileSync(join(process.cwd(), "src/lib/data/chat.ts"), "utf8");
const ACTION = readFileSync(join(process.cwd(), "src/lib/actions/chat.ts"), "utf8");
const THREAD = readFileSync(join(process.cwd(), "src/components/chat/message-thread.tsx"), "utf8");
const BUTTON = readFileSync(join(process.cwd(), "src/components/chat/forward-request.tsx"), "utf8");

/**
 * Request System bisa dilampirkan ke obrolan, sama seperti pengajuan HC.
 *
 * Keduanya hidup di TABEL BERBEDA, jadi yang paling mudah salah adalah
 * memakai jalur yang sama untuk keduanya — kartunya lalu dicari di tabel yang
 * keliru dan selalu tampil "sudah dihapus".
 */
describe("rujukan request system di obrolan", () => {
  it("punya pembacanya sendiri, terpisah dari pengajuan HC", () => {
    expect(CHAT).toContain("async function systemRefMap");
    expect(CHAT).toContain('.from("system_requests")');
  });

  it("keempat jenis rujukan dibaca sekali untuk seluruh percakapan", () => {
    // Satu kueri per pesan adalah jeda yang langsung terasa saat berpindah
    // percakapan — itu pernah diperbaiki, dan tidak boleh kembali.
    expect(CHAT).toContain("const [refs, hyg, sys, doc] = await Promise.all([");
    expect(CHAT).toContain('systemRefMap(rows.filter((r) => r.ref_kind === "system"');
    expect(CHAT).toContain('docRefMap(rows.filter((r) => r.ref_kind === "dokumen"');
  });

  it("pemilihan peta ditulis eksplisit, bukan rantai dengan cabang \"sisanya\"", () => {
    // Bentuk "sisanya" itulah yang membuat rujukan system sempat dibaca dari
    // tabel pengajuan begitu jenis ketiga ditambahkan. Jenis keempat akan
    // mengulanginya kalau polanya dibiarkan.
    const fn = CHAT.slice(CHAT.indexOf("function REF_MAPS"), CHAT.indexOf("/** Temuan hygiene sebagai kartu obrolan"));
    for (const k of ["hygiene", "system", "dokumen"]) {
      expect(fn, `jenis ${k} tidak dipetakan eksplisit`).toContain(`kind === "${k}"`);
    }
  });

  it("request yang terhapus tetap tampil, tapi ditandai mati", () => {
    const blok = CHAT.slice(CHAT.indexOf("async function systemRefMap"));
    expect(blok).toContain("Request system sudah dihapus");
    expect(blok).toContain("missing: true");
  });

  it("cuplikan daftar percakapan membedakan jenisnya", () => {
    expect(previewOf({ body: "", attachments: [], ref: { kind: "system" } })).toBe("Meneruskan sebuah request system");
    expect(previewOf({ body: "", attachments: [], ref: { kind: "pengajuan" } })).toBe("Meneruskan sebuah pengajuan");
    expect(previewOf({ body: "", attachments: [], ref: { kind: "hygiene" } })).toBe("Temuan hygiene");
    expect(previewOf({ body: "", attachments: [], ref: { kind: "dokumen" } })).toBe("Meneruskan sebuah dokumen HC");
    // Isi pesan tetap menang atas label rujukan.
    expect(previewOf({ body: "halo", attachments: [], ref: { kind: "system" } })).toBe("halo");
  });
});

describe("izin meneruskan request system", () => {
  const fn = ACTION.slice(ACTION.indexOf("export async function chatForwardSystemAction"));

  it("hanya System Support, pemohonnya sendiri, atau admin", () => {
    // Tanpa batas ini, id tebakan bisa menarik judul request cabang lain ke
    // dalam obrolan.
    expect(fn).toContain("isSystemSupport(user)");
    expect(fn).toContain("req.requester_id !== user.id");
    expect(fn).toContain('user.role !== "super_admin"');
  });

  it("requestnya diambil dari basis data, bukan dipercaya dari argumen", () => {
    expect(fn).toContain("await getSystemRequestRow(input.requestId)");
    expect(fn).toContain('return { error: "Request tidak ditemukan." }');
  });

  it("melampirkan rujukan bertipe system", () => {
    expect(fn).toContain('ref: { kind: "system", id: req.id }');
  });
});

describe("kartu rujukan di dalam obrolan", () => {
  it("rujukan system TIDAK dibuka lewat panel pengajuan HC", () => {
    // Panel itu membaca tabel hc_requests; request system akan tampil kosong.
    expect(THREAD).toContain('r.kind === "system" || r.kind === "dokumen"');
    expect(THREAD).toContain("router.push(r.href)");
  });

  it("tombol Tanya memakai satu komponen untuk kedua jenis", () => {
    expect(BUTTON).toContain('source?: "pengajuan" | "system"');
    expect(BUTTON).toContain("chatForwardSystemAction");
    // Satu pemanggilan untuk semua jenis; yang berbeda hanya fungsinya.
    expect(BUTTON).toContain("await kirim({ requestId, toUserIds: picked, note })");
  });
});

describe("rujukan dokumen HC di obrolan", () => {
  const fn = ACTION.slice(ACTION.indexOf("export async function chatForwardDocAction"));

  it("punya pembacanya sendiri di tabel hc_submissions", () => {
    expect(CHAT).toContain("async function docRefMap");
    expect(CHAT).toContain('.from("hc_submissions")');
  });

  it("judulnya memakai jenis dokumen + nama karyawan", () => {
    // "PKWT Andi" adalah cara orang menyebut berkasnya; nomor barisnya bukan.
    expect(CHAT).toContain("HC_DOC_LABEL[r.doc_type]");
    expect(CHAT).toContain("r.employee_name");
  });

  it("dibatasi tim HC, supervisor pengaju, atau admin", () => {
    // Dokumen HC memuat data pribadi karyawan — batasnya lebih penting
    // daripada pada jenis rujukan lain.
    expect(fn).toContain('canReachMenu(user, "hc_review")');
    expect(fn).toContain("doc.supervisor_id !== user.id");
    expect(fn).toContain('user.role !== "super_admin"');
  });

  it("dokumennya diambil dari basis data, bukan dipercaya dari argumen", () => {
    expect(fn).toContain("await getHcSubmissionRow(input.requestId)");
  });

  it("kartunya membuka halaman antreannya, bukan panel pengajuan HC", () => {
    expect(THREAD).toContain('r.kind === "system" || r.kind === "dokumen"');
  });

  it("tombolnya tetap satu komponen untuk keempat jenis", () => {
    expect(BUTTON).toContain('source?: "pengajuan" | "system" | "dokumen"');
    expect(BUTTON).toContain("chatForwardDocAction");
  });
});
