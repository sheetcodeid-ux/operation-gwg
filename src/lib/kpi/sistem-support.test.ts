import { describe, expect, it } from "vitest";
import { INDIKATOR, TENGGAT } from "./indikator";
import { MENU_POSISI, POSISI, posisiDari } from "./struktur";
import { persentaseCapaian } from "./hitung";
import { KATEGORI_MENU_PROMO, SKEMA_ENTRI, skemaEntri, tanggalOtomatis } from "./entri-skema";
import { hariBulan } from "./minggu";
import { canReachMenu, type MenuKey } from "../nav";

/**
 * KPI Coordinator Software dan Coordinator POS.
 *
 * Dua posisi yang menopang SISTEM, bukan outlet. Yang dijaga di sini bukan
 * susunan tabelnya melainkan tiga hal yang salahnya tidak akan terlihat di
 * layar: bobot yang tidak genap seratus, uptime yang tidak menyesuaikan
 * panjang bulan, dan baris otomatis yang jatuh di tanggal yang tidak ada.
 */

const ind = (posisi: "operational_software" | "operational_pos", key: string) => {
  const i = INDIKATOR[posisi].find((x) => x.key === key);
  if (!i) throw new Error(`indikator ${key} tidak ada`);
  return i;
};

describe("bobot dan susunan", () => {
  it("keduanya genap seratus", () => {
    for (const p of ["operational_software", "operational_pos"] as const) {
      expect(INDIKATOR[p].reduce((a, i) => a + i.bobot, 0), p).toBe(100);
    }
  });

  it("bobotnya persis seperti yang diminta", () => {
    expect(ind("operational_software", "data_integrity").bobot).toBe(40);
    expect(ind("operational_software", "reporting_timeliness").bobot).toBe(30);
    expect(ind("operational_software", "software_complaint").bobot).toBe(20);
    expect(ind("operational_software", "problem_solver_data").bobot).toBe(10);

    expect(ind("operational_pos", "pos_masterdata").bobot).toBe(35);
    expect(ind("operational_pos", "pos_sla").bobot).toBe(25);
    expect(ind("operational_pos", "pos_refresh").bobot).toBe(20);
    expect(ind("operational_pos", "pos_uptime").bobot).toBe(20);
  });

  it("keduanya terdaftar sebagai posisi dan punya menunya sendiri", () => {
    for (const kode of ["operational_software", "operational_pos"] as const) {
      expect(posisiDari(kode), kode).toBeTruthy();
      expect(MENU_POSISI[kode], kode).toBeTruthy();
    }
    // Menu yang dipakai bersama dua posisi berarti satu halaman menampilkan
    // indikator posisi lain tanpa ada yang menyadarinya.
    const menu = POSISI.map((p) => MENU_POSISI[p.kode]);
    expect(new Set(menu).size).toBe(menu.length);
  });
});

describe("uptime dihitung dari porsi hari", () => {
  // Actual-nya (hari tercatat ÷ hari bulan) × 100 — rumus yang sama dipakai
  // lapisan data. Yang diuji di sini akibatnya: bulan panjang dan bulan pendek
  // sama-sama berujung 100% saat seluruh harinya termonitor.
  const uptime = (tercatat: number, periode: string) => (tercatat / hariBulan(periode)) * 100;

  it("satu hari bernilai lebih besar di bulan yang lebih pendek", () => {
    expect(uptime(1, "2026-01")).toBeCloseTo(3.2258, 3); // 31 hari
    expect(uptime(1, "2026-04")).toBeCloseTo(3.3333, 3); // 30 hari
    expect(uptime(1, "2026-02")).toBeCloseTo(3.5714, 3); // 28 hari
  });

  it("sebulan penuh tepat seratus persen, bukan lebih dan bukan kurang", () => {
    for (const p of ["2026-01", "2026-02", "2024-02", "2026-04"]) {
      expect(uptime(hariBulan(p), p), p).toBeCloseTo(100, 9);
    }
  });

  it("setengah bulan bernilai setengah, bukan nol", () => {
    const i = ind("operational_pos", "pos_uptime");
    expect(persentaseCapaian(uptime(15, "2026-04"), 100, i.penilaian)).toBeCloseTo(50, 6);
  });
});

describe("complaint Coordinator Software", () => {
  const i = ind("operational_software", "software_complaint");

  it("tiap komplain memotong seperlima capaian", () => {
    expect(persentaseCapaian(0, 5, i.penilaian)).toBe(100);
    expect(persentaseCapaian(1, 5, i.penilaian)).toBeCloseTo(80, 6);
    expect(persentaseCapaian(5, 5, i.penilaian)).toBe(0);
  });

  it("lebih dari batasnya tidak menghasilkan capaian negatif", () => {
    // Capaian minus akan MENARIK TURUN indikator lain lewat penjumlahan, dan
    // hukuman satu indikator tidak boleh merembet ke yang tidak ada kaitannya.
    expect(persentaseCapaian(9, 5, i.penilaian)).toBe(0);
  });
});

describe("baris yang dibuatkan otomatis", () => {
  it("monitoring harian sebanyak hari bulannya, tidak lebih", () => {
    const skema = skemaEntri("pos_uptime");
    expect(tanggalOtomatis(skema, hariBulan("2026-01"))).toHaveLength(31);
    expect(tanggalOtomatis(skema, hariBulan("2026-02"))).toHaveLength(28);
    expect(tanggalOtomatis(skema, hariBulan("2024-02"))).toHaveLength(29);
  });

  it("laporan tanggal 29 tidak dibuatkan pada Februari 28 hari", () => {
    const skema = skemaEntri("laporan_owner");
    expect(tanggalOtomatis(skema, hariBulan("2026-01"))).toEqual([8, 15, 22, 29]);
    // Barisnya akan ditolak server sebagai "di luar bulan yang sedang diisi" —
    // pesan yang benar untuk kesalahan yang tidak pernah dibuat siapa pun.
    expect(tanggalOtomatis(skema, hariBulan("2026-02"))).toEqual([8, 15, 22]);
  });

  it("tanggal laporan mengikuti tenggat posisinya, bukan daftar keduanya", () => {
    const skema = skemaEntri("laporan_owner");
    expect(tanggalOtomatis(skema, 31)).toEqual(TENGGAT.operational_software);
  });

  it("jenis tanpa baris otomatis tidak membuat satu baris pun", () => {
    expect(tanggalOtomatis(skemaEntri("pos_masterdata"), 31)).toEqual([]);
    expect(tanggalOtomatis(undefined, 31)).toEqual([]);
  });
});

describe("skema kolom isian", () => {
  it("kategori SLA sama persis dengan kategori master data", () => {
    // Dua daftar yang berbeda untuk pekerjaan yang sama membuat sebaran per
    // kategori tidak bisa dibandingkan antar-indikator.
    expect(SKEMA_ENTRI.pos_sla?.kategori).toEqual(KATEGORI_MENU_PROMO);
    expect(SKEMA_ENTRI.pos_masterdata?.kategori).toEqual(KATEGORI_MENU_PROMO);
  });

  it("hanya SLA yang punya tanggal selesai dan hari terlewat", () => {
    const berSla = Object.entries(SKEMA_ENTRI).filter(([, v]) => v?.sla).map(([k]) => k);
    expect(berSla).toEqual(["pos_sla"]);
  });

  it("hanya uptime yang dinilai per hari", () => {
    const perHari = Object.entries(SKEMA_ENTRI).filter(([, v]) => v?.persenHari).map(([k]) => k);
    expect(perHari).toEqual(["pos_uptime"]);
  });

  it("setiap baris otomatis punya penanda bahwa kejadiannya benar terjadi", () => {
    // Tanpa penanda, tiga puluh baris kosong tersimpan sebagai tiga puluh hari
    // yang termonitor — dan uptime-nya seratus persen tanpa satu hari pun
    // benar-benar diperiksa.
    for (const [jenis, skema] of Object.entries(SKEMA_ENTRI)) {
      if (skema?.otomatis) expect(skema.otomatis.tanda, jenis).toBeTruthy();
    }
  });

  it("laporan ke owner tidak menyangkut outlet mana pun", () => {
    expect(SKEMA_ENTRI.laporan_owner?.semuaOutlet).toBeUndefined();
    expect(SKEMA_ENTRI.pos_uptime?.semuaOutlet).toBe(true);
  });
});

describe("siapa yang bisa membukanya", () => {
  const orang = (department: string) => ({ role: "member" as const, department, jabatan: "System Support" });

  it("staf departemen Operational membaca kedua rapor barunya", () => {
    for (const menu of ["kpi_op_software", "kpi_op_pos"] as const) {
      expect(canReachMenu(orang("Operational"), menu as MenuKey), menu).toBe(true);
    }
  });

  it("departemen lain tidak ikut terbuka", () => {
    // Rapor satu departemen bukan bacaan departemen sebelah; yang berhak
    // lintas departemen hanya kepala dan pemegang menu Ringkasan KPI.
    for (const menu of ["kpi_op_software", "kpi_op_pos"] as const) {
      expect(canReachMenu(orang("Finance"), menu as MenuKey), menu).toBe(false);
      expect(canReachMenu(orang("Creative"), menu as MenuKey), menu).toBe(false);
    }
  });

  it("kepala departemen tetap bisa membaca keduanya", () => {
    const kepala = { role: "head_operation" as const, department: "Operational", jabatan: "Head of Operation" };
    expect(canReachMenu(kepala, "kpi_op_software" as MenuKey)).toBe(true);
    expect(canReachMenu(kepala, "kpi_op_pos" as MenuKey)).toBe(true);
  });
});
