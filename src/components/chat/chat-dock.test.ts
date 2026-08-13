import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOCK = readFileSync(join(process.cwd(), "src/components/chat/chat-dock.tsx"), "utf8");
const BELL = readFileSync(join(process.cwd(), "src/components/chat/chat-bell.tsx"), "utf8");
const LAYOUT = readFileSync(join(process.cwd(), "src/app/(app)/layout.tsx"), "utf8");

/**
 * Jendela obrolan mengambang: balasan singkat tanpa meninggalkan halaman.
 *
 * Yang diuji di sini adalah keputusan yang mudah tergerus di perubahan
 * berikutnya — batas jumlah jendela, perilaku di layar sempit, dan penyegaran
 * yang tidak boleh jalan diam-diam di latar.
 */
describe("jendela obrolan mengambang", () => {
  it("terpasang di layout supaya bisa dibuka dari halaman mana pun", () => {
    expect(LAYOUT).toContain("<ChatDockProvider>");
    expect(LAYOUT).toContain("</ChatDockProvider>");
  });

  it("dibatasi tiga jendela, yang terlama dibuang", () => {
    // Facebook membiarkannya menumpuk sampai memenuhi layar; di aplikasi kerja
    // itu menutupi tabel yang sedang dibaca.
    expect(DOCK).toContain("const MAX_WINDOWS = 3");
    expect(DOCK).toContain("slice(-MAX_WINDOWS)");
  });

  it("percakapan yang sama tidak digandakan", () => {
    expect(DOCK).toContain("if (ada) return cur.map((x) => (x.id === t.id ? { ...x, minimized: false } : x))");
  });

  it("di layar sempit dialihkan ke halaman Pesan, bukan dipaksa mengambang", () => {
    // Jendela 21rem di layar 360px bukan jendela mengambang, itu halaman penuh
    // yang menyamar.
    expect(DOCK).toContain("if (!wide) {");
    expect(DOCK).toContain("router.push(`/pesan?t=${t.id}`)");
  });

  it("layar yang menyempit menutup jendela yang terlanjur terbuka", () => {
    expect(DOCK).toContain("if (!mq.matches) setThreads([])");
  });

  it("penyegaran berhenti saat dikecilkan dan saat tab tak terlihat", () => {
    // Jendela yang tertinggal terbuka di latar tidak boleh jadi permintaan
    // paling sering di aplikasi.
    expect(DOCK).toContain("if (thread.minimized) return;");
    expect(DOCK).toContain('document.visibilityState !== "visible"');
  });

  it("tulisan yang gagal terkirim dikembalikan, tidak hilang", () => {
    expect(DOCK).toContain("setBody(teks);");
  });

  it("Enter mengirim, Shift+Enter baris baru", () => {
    expect(DOCK).toContain('e.key === "Enter" && !e.shiftKey');
  });

  it("bisa melampirkan pengajuan design, seperti di halaman Pesan", () => {
    // Menanyakan revisi tanpa melampirkan pengajuannya berarti tim Creative
    // menerima pesan yang tidak jelas menunjuk brief yang mana.
    expect(DOCK).toContain('chatPickableRequestsAction("design")');
    expect(DOCK).toContain("refRequestId: lampiran?.id ?? null");
  });

  it("melampirkan pengajuan saja sudah cukup — catatan boleh kosong", () => {
    expect(DOCK).toContain("if ((!teks && !ref) || sending) return;");
    expect(DOCK).toContain("disabled={(!body.trim() && !ref) || sending}");
  });

  it("lampiran dikembalikan bila pengirimannya gagal", () => {
    expect(DOCK).toContain("setRef(lampiran);");
  });

  it("daftar pengajuan diambil saat pemilihnya dibuka, bukan saat jendela dibuka", () => {
    // Bisa ada tiga jendela sekaligus; tidak satu pun perlu memuatnya sebelum
    // benar-benar dipakai.
    expect(DOCK).toContain("if (buka && pick === null)");
  });

  it("selalu ada jalan ke detail lengkap", () => {
    expect(DOCK).toContain("Buka detail di halaman Pesan");
  });

  it("hook di luar provider gagal terang-terangan, bukan diam-diam", () => {
    expect(DOCK).toContain("useChatDock dipakai di luar <ChatDockProvider>");
  });
});

describe("lonceng chat", () => {
  it("membuka daftar percakapan, bukan langsung melompat ke halaman", () => {
    expect(BELL).toContain("<Popover");
    expect(BELL).toContain("dock.open({");
  });

  it("daftarnya diambil saat panel dibuka, bukan saat halaman dirender", () => {
    // Lonceng ini ada di setiap halaman dan hampir semuanya tidak pernah diklik.
    expect(BELL).toContain("if (!open) void muat();");
  });

  it("hitungan belum dibaca berhenti saat tab tak terlihat", () => {
    expect(BELL).toContain('document.visibilityState !== "visible"');
  });

  it("tetap menyediakan jalan ke halaman Pesan penuh", () => {
    expect(BELL).toContain("Lihat semua di Pesan");
    expect(BELL).toContain("Buka semua");
  });
});
