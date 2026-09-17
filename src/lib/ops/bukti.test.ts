import { describe, expect, it } from "vitest";
import {
  buktiBiaya,
  buktiBiayaRinci,
  buktiRataTransaksi,
  buktiSales,
  buktiTarget,
  buktiTraffic,
  kelayakanTindakan,
  keyakinan,
  minimalMedium,
  rangkumBukti,
  type Bukti,
  type Keyakinan,
  type StatusBukti,
} from "./bukti";
import { takTahu, terukur } from "./mingguan";

/**
 * TEST CONTRACT N-13 — Root Cause, Confidence, dan Action Eligibility.
 *
 * Dua kalimat yang dijaga seluruh berkas ini:
 *
 *   1. SIGNAL BUKAN ROOT CAUSE. Tidak ada jalan dari "ada Signal" ke
 *      "sebabnya terbukti" — yang ada justru sebaliknya.
 *   2. CONFIDENCE TIDAK PERNAH MENGUBAH STATUS. `UNKNOWN` + `HIGH` tetap
 *      `UNKNOWN`, dan tetap tidak layak ditindaklanjuti.
 */

/* ─────────────────── status bukti: tiga, dan ketiganya beda ─────────────────── */

describe("buktiSales — dugaan 'penjualan turun'", () => {
  it("turun → SUPPORTED", () => {
    expect(buktiSales(terukur(80), terukur(100)).status).toBe("SUPPORTED");
  });

  it("naik → NOT_SUPPORTED, BUKAN UNKNOWN", () => {
    const b = buktiSales(terukur(120), terukur(100));
    expect(b.status).toBe("NOT_SUPPORTED");
    expect(b.alasan).toBeNull();
  });

  it("sama → NOT_SUPPORTED — 'tidak turun' adalah jawaban", () => {
    expect(buktiSales(terukur(100), terukur(100)).status).toBe("NOT_SUPPORTED");
  });

  it("tanpa pembanding → UNKNOWN / tanpa_pembanding", () => {
    const b = buktiSales(terukur(100), takTahu("tanpa_minggu_sebelumnya"));
    expect(b.status).toBe("UNKNOWN");
    expect(b.alasan).toBe("tanpa_pembanding");
  });

  it("sumber tidak sah diteruskan sebagai alasannya sendiri", () => {
    expect(buktiSales(takTahu("sumber_tidak_sah"), terukur(100)).alasan).toBe("sumber_tidak_sah");
  });
});

describe("buktiTarget — dugaan 'realisasi di bawah target bulanan'", () => {
  it("di bawah target → SUPPORTED", () => {
    expect(buktiTarget(terukur(20_000_000), terukur(30_000_000)).status).toBe("SUPPORTED");
  });

  it("mencapai target → NOT_SUPPORTED", () => {
    expect(buktiTarget(terukur(31_000_000), terukur(30_000_000)).status).toBe("NOT_SUPPORTED");
  });

  it("tanpa target → UNKNOWN / tanpa_target, bukan 'gagal mencapai 0'", () => {
    const b = buktiTarget(terukur(20_000_000), takTahu("tanpa_target"));
    expect(b.status).toBe("UNKNOWN");
    expect(b.alasan).toBe("tanpa_target");
  });

  it("target nol tidak dipakai sebagai pembanding", () => {
    expect(buktiTarget(terukur(10), terukur(0)).alasan).toBe("penyebut_tidak_sah");
  });

  it("yang dibandingkan REALISASI BULANAN, bukan satu minggu", () => {
    // Pengaman terhadap regresi: kalau kelak seseorang mengirim angka satu
    // minggu ke sini, bukti ini akan selalu SUPPORTED untuk setiap outlet
    // setiap minggu — angka yang tidak pernah salah dan tidak pernah berguna.
    expect(buktiTarget(terukur(30_000_000), terukur(30_000_000)).status).toBe("NOT_SUPPORTED");
  });
});

describe("buktiTraffic — pertanyaannya KETERSEDIAAN", () => {
  it("pax dan bills dua-duanya ada → SUPPORTED", () => {
    expect(buktiTraffic(terukur(500), terukur(400)).status).toBe("SUPPORTED");
  });

  it("pax = 0 tetap SUPPORTED — nol adalah pengukuran", () => {
    expect(buktiTraffic(terukur(0), terukur(0)).status).toBe("SUPPORTED");
  });

  it("pax null → UNKNOWN, tidak pernah NOT_SUPPORTED", () => {
    const b = buktiTraffic(takTahu("data_tidak_tersedia"), terukur(400));
    expect(b.status).toBe("UNKNOWN");
    expect(b.status).not.toBe("NOT_SUPPORTED");
  });

  it("bills null → UNKNOWN", () => {
    expect(buktiTraffic(terukur(500), takTahu("data_tidak_tersedia")).status).toBe("UNKNOWN");
  });
});

describe("buktiRataTransaksi", () => {
  it("terhitung → SUPPORTED", () => {
    expect(buktiRataTransaksi(terukur(17_500)).status).toBe("SUPPORTED");
  });

  it("struk nol → UNKNOWN / penyebut_tidak_sah", () => {
    const b = buktiRataTransaksi(takTahu("tanpa_struk"));
    expect(b.status).toBe("UNKNOWN");
    expect(b.alasan).toBe("penyebut_tidak_sah");
  });
});

/* ─────────────────────────── CASE 9 ─────────────────────────── */

describe("CASE 9 — detailed cost kosong", () => {
  it("belum dirinci → UNKNOWN / belum_dirinci", () => {
    const b = buktiBiayaRinci(false);
    expect(b.status).toBe("UNKNOWN");
    expect(b.alasan).toBe("belum_dirinci");
  });

  it("BUKAN zero-cost dan BUKAN 'efisien'", () => {
    expect(JSON.stringify(buktiBiayaRinci(false))).not.toMatch(/SUPPORTED|efisien|0/);
  });

  it("sudah dirinci → SUPPORTED", () => {
    expect(buktiBiayaRinci(true).status).toBe("SUPPORTED");
  });

  it("sumbernya menyebut keenam kolomnya, supaya bisa ditelusuri", () => {
    const s = buktiBiayaRinci(false).sumber;
    for (const k of ["listrik", "air", "internet", "kebersihan", "platform_fee", "pbjt"]) {
      expect(s).toContain(k);
    }
  });
});

describe("buktiBiaya", () => {
  it("ada laporan + sumber sah → SUPPORTED", () => {
    expect(buktiBiaya(true, true).status).toBe("SUPPORTED");
  });

  it("sumber tidak sah mengalahkan adanya laporan", () => {
    const b = buktiBiaya(true, false);
    expect(b.status).toBe("UNKNOWN");
    expect(b.alasan).toBe("sumber_tidak_sah");
  });
});

describe("pagar bentuk — alasan hanya ada saat UNKNOWN", () => {
  const semua: Bukti[] = [
    buktiSales(terukur(80), terukur(100)),
    buktiSales(terukur(120), terukur(100)),
    buktiSales(terukur(80), takTahu("tanpa_minggu_sebelumnya")),
    buktiTarget(terukur(1), terukur(2)),
    buktiTraffic(terukur(1), terukur(1)),
    buktiBiayaRinci(false),
  ];

  it("SUPPORTED dan NOT_SUPPORTED tidak pernah membawa alasan", () => {
    for (const b of semua.filter((x) => x.status !== "UNKNOWN")) expect(b.alasan).toBeNull();
  });

  it("UNKNOWN SELALU membawa alasan — 'tidak tahu' tanpa sebab tak bisa ditindaklanjuti", () => {
    for (const b of semua.filter((x) => x.status === "UNKNOWN")) expect(b.alasan).not.toBeNull();
  });

  it("setiap bukti menyebut sumbernya", () => {
    for (const b of semua) expect(b.sumber.length).toBeGreaterThan(0);
  });
});

/* ─────────────────────────── confidence ─────────────────────────── */

const yakin = (p: Partial<Parameters<typeof keyakinan>[0]> = {}) =>
  keyakinan({
    kelengkapan: terukur(100),
    trafficAda: true,
    targetAda: true,
    sumberSah: true,
    biayaRinciAda: true,
    ...p,
  });

describe("confidence", () => {
  it("lengkap seluruhnya → HIGH", () => {
    expect(yakin()).toBe("HIGH");
  });

  it("sumber tidak sah → LOW, apa pun yang lain", () => {
    expect(yakin({ sumberSah: false })).toBe("LOW");
  });

  it("traffic tidak tersedia → LOW", () => {
    expect(yakin({ trafficAda: false })).toBe("LOW");
  });

  it("kelengkapan tidak diketahui → LOW", () => {
    expect(yakin({ kelengkapan: takTahu("data_tidak_tersedia") })).toBe("LOW");
  });

  it("kelengkapan nol → LOW", () => {
    expect(yakin({ kelengkapan: terukur(0) })).toBe("LOW");
  });

  it("minggunya belum penuh → MEDIUM", () => {
    expect(yakin({ kelengkapan: terukur(40) })).toBe("MEDIUM");
  });

  it("tanpa target → MEDIUM", () => {
    expect(yakin({ targetAda: false })).toBe("MEDIUM");
  });

  it("biaya rinci kosong → MEDIUM (keadaan produksi hari ini)", () => {
    expect(yakin({ biayaRinciAda: false })).toBe("MEDIUM");
  });

  it("TIDAK ADA angka ambang yang dikarang di sumbernya", () => {
    // Keputusan #14 — berapa persen kelengkapan yang cukup — masih terbuka.
    // Yang boleh muncul cuma dua ujung skalanya: 0 dan 100.
    const src = keyakinan.toString();
    const angka = src.match(/\b\d+(\.\d+)?\b/g) ?? [];
    expect(angka.filter((a) => a !== "0" && a !== "100")).toEqual([]);
  });
});

/* ─────────────────────── CASE 6 & 7 — action eligibility ─────────────────────── */

const layak = (rootCause: StatusBukti, k: Keyakinan, adaSignal = false, sudahDiperiksa = true) =>
  kelayakanTindakan({ rootCause, keyakinan: k, adaSignal, sudahDiperiksa });

describe("CASE 6 — Signal ada tapi root cause tidak terbukti", () => {
  it("UNKNOWN + ada Signal → NOT ELIGIBLE / investigation_required", () => {
    expect(layak("UNKNOWN", "HIGH", true)).toEqual({ layak: false, alasan: "investigation_required" });
  });

  it("Signal TIDAK pernah membuat tindakan jadi layak", () => {
    for (const k of ["HIGH", "MEDIUM", "LOW"] as Keyakinan[]) {
      expect(layak("UNKNOWN", k, true).layak).toBe(false);
    }
  });

  it("UNKNOWN tanpa Signal → evidence_unavailable", () => {
    expect(layak("UNKNOWN", "HIGH", false)).toEqual({ layak: false, alasan: "evidence_unavailable" });
  });
});

describe("CASE 7 — Root Cause SUPPORTED + confidence MEDIUM", () => {
  it("→ ELIGIBLE", () => {
    expect(layak("SUPPORTED", "MEDIUM")).toEqual({ layak: true, alasan: null });
  });

  it("SUPPORTED + HIGH juga ELIGIBLE", () => {
    expect(layak("SUPPORTED", "HIGH").layak).toBe(true);
  });

  it("SUPPORTED + LOW → NOT ELIGIBLE / low_confidence", () => {
    expect(layak("SUPPORTED", "LOW")).toEqual({ layak: false, alasan: "low_confidence" });
  });
});

describe("tabel keputusan N-09 — lengkap", () => {
  it("belum diperiksa mengalahkan segalanya", () => {
    expect(layak("SUPPORTED", "HIGH", false, false)).toEqual({ layak: false, alasan: "not_investigated" });
  });

  it("NOT_SUPPORTED → cause_rejected, apa pun confidence-nya", () => {
    for (const k of ["HIGH", "MEDIUM", "LOW"] as Keyakinan[]) {
      expect(layak("NOT_SUPPORTED", k)).toEqual({ layak: false, alasan: "cause_rejected" });
    }
  });

  it("sebab yang TERBANTAH tidak jadi layak hanya karena buktinya kuat", () => {
    expect(layak("NOT_SUPPORTED", "HIGH").layak).toBe(false);
  });

  it("CONFIDENCE TIDAK PERNAH MENGUBAH STATUS: UNKNOWN + HIGH tetap tidak layak", () => {
    expect(layak("UNKNOWN", "HIGH").layak).toBe(false);
  });

  it("satu-satunya jalan menuju ELIGIBLE adalah SUPPORTED + minimal MEDIUM", () => {
    const semua: { rc: StatusBukti; k: Keyakinan }[] = [];
    for (const rc of ["SUPPORTED", "NOT_SUPPORTED", "UNKNOWN"] as StatusBukti[]) {
      for (const k of ["HIGH", "MEDIUM", "LOW"] as Keyakinan[]) semua.push({ rc, k });
    }
    const eligible = semua.filter((x) => layak(x.rc, x.k).layak);
    expect(eligible).toEqual([
      { rc: "SUPPORTED", k: "HIGH" },
      { rc: "SUPPORTED", k: "MEDIUM" },
    ]);
  });

  it("minimalMedium menerima HIGH dan MEDIUM saja", () => {
    expect(minimalMedium("HIGH")).toBe(true);
    expect(minimalMedium("MEDIUM")).toBe(true);
    expect(minimalMedium("LOW")).toBe(false);
  });
});

/* ─────────────────────────── rangkuman ─────────────────────────── */

describe("rangkumBukti", () => {
  const konteks = { adaSignal: false, sudahDiperiksa: true };

  it("satu domain SUPPORTED sudah cukup membuat Root Cause SUPPORTED", () => {
    const r = rangkumBukti([buktiSales(terukur(80), terukur(100)), buktiBiayaRinci(false)], "MEDIUM", konteks);
    expect(r.rootCause).toBe("SUPPORTED");
    expect(r.kelayakan.layak).toBe(true);
  });

  it("tanpa SUPPORTED tapi ada NOT_SUPPORTED → NOT_SUPPORTED", () => {
    const r = rangkumBukti([buktiSales(terukur(120), terukur(100)), buktiBiayaRinci(false)], "HIGH", konteks);
    expect(r.rootCause).toBe("NOT_SUPPORTED");
    expect(r.kelayakan.alasan).toBe("cause_rejected");
  });

  it("seluruhnya UNKNOWN → UNKNOWN", () => {
    const r = rangkumBukti([buktiBiayaRinci(false), buktiTraffic(takTahu("data_tidak_tersedia"), terukur(1))], "LOW", konteks);
    expect(r.rootCause).toBe("UNKNOWN");
  });

  it("daftar kosong → UNKNOWN, bukan SUPPORTED", () => {
    expect(rangkumBukti([], "HIGH", konteks).rootCause).toBe("UNKNOWN");
  });

  it("TIDAK menjumlahkan bukti jadi skor — tidak ada angka bobot di hasilnya", () => {
    const r = rangkumBukti([buktiSales(terukur(80), terukur(100))], "MEDIUM", konteks);
    expect(Object.keys(r)).toEqual(["daftar", "rootCause", "keyakinan", "kelayakan"]);
    expect(JSON.stringify(r)).not.toMatch(/skor|score|bobot|weight/i);
  });

  it("ada Signal + seluruh bukti UNKNOWN → perlu diselidiki, bukan ditindak", () => {
    const r = rangkumBukti([buktiBiayaRinci(false)], "LOW", { adaSignal: true, sudahDiperiksa: true });
    expect(r.rootCause).toBe("UNKNOWN");
    expect(r.kelayakan).toEqual({ layak: false, alasan: "investigation_required" });
  });
});
