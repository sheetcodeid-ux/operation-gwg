import { describe, expect, it } from "vitest";
import {
  fastTrackPerBrand,
  jumlahPeserta,
  kurikulumScope,
  ringkasBatch,
  ringkasModul,
  statusModul,
  trenKelulusan,
  type RekamanPelatihan,
} from "./pelatihan";

const baris = (p: Partial<RekamanPelatihan>): RekamanPelatihan => ({
  nama: "Budi",
  materi: "Company Profile",
  program: "fast_start",
  batch: "B1",
  outletName: null,
  tanggal: "2026-01-10",
  postTest: null,
  ...p,
});

describe("kurikulumScope", () => {
  it("memberi kurikulum berbeda untuk manajemen dan outlet", () => {
    const m = kurikulumScope("manajemen");
    const o = kurikulumScope("outlet");
    expect(m.length).toBeGreaterThan(0);
    expect(o.length).toBeGreaterThan(0);
    expect(m.map((x) => x.judul)).not.toEqual(o.map((x) => x.judul));
  });

  it("nomor modulnya berurutan tanpa lompat", () => {
    for (const scope of ["manajemen", "outlet"] as const) {
      const no = kurikulumScope(scope).map((m) => m.no);
      expect(no).toEqual(no.map((_, i) => i + 1));
    }
  });
});

describe("statusModul", () => {
  it("tanpa peserta berarti belum dijadwalkan", () => {
    expect(statusModul([])).toBe("belum");
  });

  it("ada yang belum dinilai berarti masih berjalan", () => {
    expect(statusModul([{ postTest: 80 }, { postTest: null }])).toBe("berjalan");
  });

  it("semua sudah dinilai berarti selesai, walau ada yang tidak lulus", () => {
    expect(statusModul([{ postTest: 80 }, { postTest: 40 }])).toBe("selesai");
  });
});

describe("ringkasModul", () => {
  it("mencocokkan materi tanpa peduli huruf besar-kecil dan spasi tepi", () => {
    const rows = ringkasModul("outlet", [baris({ materi: "  company profile " , postTest: 90 })]);
    const cp = rows.find((r) => r.judul === "Company Profile")!;
    expect(cp.peserta).toBe(1);
    expect(cp.lulus).toBe(1);
    expect(cp.status).toBe("selesai");
  });

  it("modul tanpa peserta tetap muncul dengan status belum dijadwalkan", () => {
    const rows = ringkasModul("outlet", []);
    expect(rows).toHaveLength(kurikulumScope("outlet").length);
    expect(rows.every((r) => r.status === "belum" && r.peserta === 0)).toBe(true);
  });

  it("nilai di bawah ambang tidak dihitung lulus", () => {
    const rows = ringkasModul("outlet", [baris({ postTest: 60 })]);
    const cp = rows.find((r) => r.judul === "Company Profile")!;
    expect(cp.peserta).toBe(1);
    expect(cp.lulus).toBe(0);
  });
});

describe("ringkasBatch", () => {
  it("menghitung peserta per orang, bukan per baris materi", () => {
    const rows = ringkasBatch([
      baris({ nama: "Budi", materi: "Company Profile" }),
      baris({ nama: "Budi", materi: "Finance" }),
      baris({ nama: "Sari", materi: "Finance" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].peserta).toBe(2);
  });

  it("persen kelulusan dihitung dari yang sudah dinilai saja", () => {
    const rows = ringkasBatch([
      baris({ nama: "A", postTest: 90 }),
      baris({ nama: "B", postTest: 30 }),
      baris({ nama: "C", postTest: null }),
    ]);
    expect(rows[0].dinilai).toBe(2);
    expect(rows[0].persenLulus).toBe(50);
    expect(rows[0].status).toBe("berjalan");
  });

  it("batch tanpa nilai sama sekali memberi persen null, bukan nol", () => {
    expect(ringkasBatch([baris({ postTest: null })])[0].persenLulus).toBeNull();
  });

  it("baris tanpa batch dikelompokkan sebagai Tanpa Batch", () => {
    expect(ringkasBatch([baris({ batch: "  " })])[0].batch).toBe("Tanpa Batch");
  });

  it("periode diambil dari tanggal terawal dan terakhir", () => {
    const rows = ringkasBatch([
      baris({ nama: "A", tanggal: "2026-03-01" }),
      baris({ nama: "B", tanggal: "2026-01-15" }),
    ]);
    expect(rows[0].mulai).toBe("2026-01-15");
    expect(rows[0].selesai).toBe("2026-03-01");
  });
});

describe("trenKelulusan", () => {
  it("mengabaikan batch yang belum punya nilai apa pun", () => {
    const batch = ringkasBatch([
      baris({ nama: "A", batch: "B1", tanggal: "2026-01-01", postTest: 90 }),
      baris({ nama: "B", batch: "B2", tanggal: "2026-02-01", postTest: null }),
    ]);
    expect(trenKelulusan(batch)).toEqual([{ nama: "B1", nilai: 100 }]);
  });

  it("urut dari batch terlama ke terbaru", () => {
    const batch = ringkasBatch([
      baris({ nama: "A", batch: "B2", tanggal: "2026-02-01", postTest: 90 }),
      baris({ nama: "B", batch: "B1", tanggal: "2026-01-01", postTest: 30 }),
    ]);
    expect(trenKelulusan(batch).map((t) => t.nama)).toEqual(["B1", "B2"]);
  });
});

describe("fastTrackPerBrand", () => {
  const brandDari = (nama: string) => nama.split(" ")[0] ?? "";

  it("hanya menghitung program fast_track", () => {
    const hasil = fastTrackPerBrand(
      [
        baris({ nama: "A", program: "fast_track", outletName: "Nordu Antasari" }),
        baris({ nama: "B", program: "fast_start", outletName: "Cattu Sudirman" }),
      ],
      brandDari,
    );
    expect(hasil).toEqual([{ nama: "Nordu", nilai: 1 }]);
  });

  it("satu orang dengan banyak materi tetap dihitung sekali", () => {
    const hasil = fastTrackPerBrand(
      [
        baris({ nama: "A", program: "fast_track", materi: "Finance", outletName: "Nordu Antasari" }),
        baris({ nama: "A", program: "fast_track", materi: "Hospitality", outletName: "Nordu Antasari" }),
      ],
      brandDari,
    );
    expect(hasil).toEqual([{ nama: "Nordu", nilai: 1 }]);
  });

  it("outlet tanpa nama masuk Tanpa Brand", () => {
    const hasil = fastTrackPerBrand([baris({ program: "fast_track", outletName: null })], brandDari);
    expect(hasil).toEqual([{ nama: "Tanpa Brand", nilai: 1 }]);
  });
});

describe("jumlahPeserta", () => {
  it("menghitung orang berbeda, mengabaikan nama kosong", () => {
    expect(jumlahPeserta([baris({ nama: "A" }), baris({ nama: "a" }), baris({ nama: " " })])).toBe(1);
  });
});
