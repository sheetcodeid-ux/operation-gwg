import { describe, expect, it } from "vitest";
import { requestStage, stageFilters, type HcRequestKind, type HcRequestStatus } from "./hc-request";

const r = (kind: HcRequestKind, status: HcRequestStatus, revisi = 0) => ({
  kind,
  status,
  revisions: Array.from({ length: revisi }, () => ({ at: "2026-08-01T00:00:00Z" })),
});

/**
 * Tahapan diturunkan dari data, bukan kolom tersendiri. Yang diuji di sini
 * adalah batas antar tahap — satu kesalahan di sini membuat pengajuan hilang
 * dari saringan yang seharusnya memuatnya.
 */
describe("tahapan pengajuan", () => {
  it("menunggu tinjauan tim penerima", () => {
    for (const k of ["design", "rekrutmen", "pelatihan"] as const) {
      expect(requestStage(r(k, "menunggu_hc"))).toBe("menunggu");
    }
  });

  it("ditolak di tahap mana pun tetap ditolak", () => {
    expect(requestStage(r("design", "ditolak_hc"))).toBe("ditolak");
    expect(requestStage(r("pelatihan", "ditolak_finance"))).toBe("ditolak");
  });

  it("terlaksana = selesai", () => {
    for (const k of ["design", "rekrutmen", "pelatihan"] as const) {
      expect(requestStage(r(k, "terlaksana"))).toBe("selesai");
    }
  });

  it("design yang disetujui tapi BELUM pernah direvisi = sedang dikerjakan", () => {
    expect(requestStage(r("design", "disetujui_hc", 0))).toBe("dikerjakan");
  });

  it("design yang disetujui DAN punya riwayat revisi = sedang direvisi", () => {
    // Meminta revisi mengembalikan design terkirim ke `disetujui_hc`, jadi
    // statusnya sama dengan pekerjaan baru. Riwayat revisilah pembedanya.
    expect(requestStage(r("design", "disetujui_hc", 1))).toBe("revisi");
    expect(requestStage(r("design", "disetujui_hc", 3))).toBe("revisi");
  });

  it("riwayat revisi TIDAK mengubah tahap setelah designnya dikirim lagi", () => {
    // Yang sudah terlaksana tetap selesai, berapa pun kali pernah direvisi.
    expect(requestStage(r("design", "terlaksana", 2))).toBe("selesai");
  });

  it("jenis selain design tidak pernah masuk tahap revisi", () => {
    for (const k of ["rekrutmen", "pelatihan"] as const) {
      expect(requestStage(r(k, "disetujui_hc", 5))).toBe("dikerjakan");
    }
  });

  it("tahap tengah pelatihan (menunggu & disetujui Finance) dihitung diproses", () => {
    expect(requestStage(r("pelatihan", "menunggu_finance"))).toBe("dikerjakan");
    expect(requestStage(r("pelatihan", "disetujui_finance"))).toBe("dikerjakan");
  });
});

describe("saringan antrian", () => {
  it("semua jenis memakai urutan yang sama", () => {
    for (const k of ["design", "rekrutmen", "pelatihan"] as const) {
      const v = stageFilters(k).map((f) => f.value);
      expect(v[0]).toBe("all");
      expect(v[1]).toBe("menunggu");
      expect(v[2]).toBe("dikerjakan");
      expect(v[v.length - 1]).toBe("ditolak");
    }
  });

  it("hanya design yang punya saringan Revisi", () => {
    // Menampilkannya di jenis lain hanya jadi tombol yang selalu nol.
    expect(stageFilters("design").map((f) => f.value)).toContain("revisi");
    expect(stageFilters("rekrutmen").map((f) => f.value)).not.toContain("revisi");
    expect(stageFilters("pelatihan").map((f) => f.value)).not.toContain("revisi");
  });

  it("labelnya menyesuaikan jenis pekerjaannya", () => {
    const label = (k: HcRequestKind) => stageFilters(k).find((f) => f.value === "dikerjakan")!.label;
    expect(label("design")).toBe("Sedang Dikerjakan");
    expect(label("rekrutmen")).toBe("Diproses");
  });

  it("setiap tahap yang mungkin punya saringannya", () => {
    // Kalau ada tahap tanpa saringan, pengajuan di tahap itu hanya bisa
    // ditemukan lewat "Semua" — dan praktis tidak terlihat.
    for (const k of ["design", "rekrutmen", "pelatihan"] as const) {
      const punya = new Set(stageFilters(k).map((f) => f.value));
      const semua: HcRequestStatus[] = [
        "menunggu_hc", "ditolak_hc", "disetujui_hc",
        "menunggu_finance", "ditolak_finance", "disetujui_finance", "terlaksana",
      ];
      for (const st of semua) {
        for (const rev of [0, 1]) {
          expect(punya, `${k}/${st} rev=${rev} tanpa saringan`).toContain(requestStage(r(k, st, rev)));
        }
      }
    }
  });
});
