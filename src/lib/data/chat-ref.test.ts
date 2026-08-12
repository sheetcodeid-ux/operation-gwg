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

  it("ketiga jenis rujukan dibaca sekali untuk seluruh percakapan", () => {
    // Satu kueri per pesan adalah jeda yang langsung terasa saat berpindah
    // percakapan — itu pernah diperbaiki, dan tidak boleh kembali.
    expect(CHAT).toContain("const [refs, hyg, sys] = await Promise.all([");
    expect(CHAT).toContain('systemRefMap(rows.filter((r) => r.ref_kind === "system"');
  });

  it("tiap jenis dipetakan dari sumbernya sendiri", () => {
    expect(CHAT).toContain('(r.ref_kind === "hygiene" ? hyg : r.ref_kind === "system" ? sys : refs)');
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
    expect(THREAD).toContain('else if (r.kind === "system") router.push(r.href)');
  });

  it("tombol Tanya memakai satu komponen untuk kedua jenis", () => {
    expect(BUTTON).toContain('source?: "pengajuan" | "system"');
    expect(BUTTON).toContain("chatForwardSystemAction({ requestId, toUserIds: picked, note })");
  });
});
