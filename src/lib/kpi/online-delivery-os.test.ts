import { describe, expect, it } from "vitest";
import { MENU_POSISI, POSISI, posisiDepartemen } from "./struktur";
import { INDIKATOR, indikatorPosisi } from "./indikator";
import { SKEMA_ENTRI } from "./entri-skema";

/**
 * Online Delivery Officer & Operating System Officer.
 *
 * Dokumennya menyebut keduanya "DO" dan "OS". Singkatan itu TIDAK dipakai
 * sebagai nama posisi — yang membaca daftar KPI belum tentu pernah membaca
 * dokumennya, dan "OS" sama saja artinya dengan tidak ada namanya.
 */

const doo = indikatorPosisi("operational_do");
const os = indikatorPosisi("operational_os");

describe("kedua posisi berdiri di Operational", () => {
  it("terdaftar di departemen operational, bukan departemen sendiri", () => {
    const kode = posisiDepartemen("operational").map((p) => p.kode);
    expect(kode).toContain("operational_do");
    expect(kode).toContain("operational_os");
  });

  it("punya PIC dan menu sidebarnya sendiri", () => {
    const cari = (k: string) => POSISI.find((p) => p.kode === k)!;
    expect(cari("operational_do").pic).toEqual(["Adinda Latifah"]);
    expect(cari("operational_os").pic).toEqual(["Pricil"]);
    expect(MENU_POSISI.operational_do).toBe("kpi_op_do");
    expect(MENU_POSISI.operational_os).toBe("kpi_op_os");
  });

  it("namanya dieja penuh, bukan singkatan DO dan OS", () => {
    expect(POSISI.find((p) => p.kode === "operational_do")!.nama).toBe("Online Delivery Officer");
    expect(POSISI.find((p) => p.kode === "operational_os")!.nama).toBe("Operating System Officer");
  });
});

describe("indikatornya persis daftar di dokumen", () => {
  it("Online Delivery punya keenam indikatornya, bobot berjumlah 100", () => {
    expect(doo.map((i) => i.label)).toEqual([
      "Outlet Online Accuracy",
      "Menu & Price Accuracy",
      "Issue Resolution Time",
      "Merchant Registration Success",
      "Delivery Menu Availability",
      "Order Failure by System / Menu",
    ]);
    expect(doo.reduce((a, i) => a + i.bobot, 0)).toBe(100);
  });

  it("Operating System punya ketujuh indikatornya, bobot berjumlah 100", () => {
    expect(os.map((i) => i.label)).toEqual([
      "POS Availability",
      "Master Data Accuracy",
      "Menu Configuration Accuracy",
      "Issue Resolution Time",
      "Transaction Error Rate",
      "System Improvement",
      "Outlet / User Satisfaction",
    ]);
    expect(os.reduce((a, i) => a + i.bobot, 0)).toBe(100);
  });

  it("keduanya terdaftar di peta indikator posisi", () => {
    expect(INDIKATOR.operational_do).toHaveLength(6);
    expect(INDIKATOR.operational_os).toHaveLength(7);
  });
});

describe("arah penilaian yang mudah terbalik", () => {
  it("Transaction Error Rate dinilai sebagai BATAS ATAS", () => {
    // Tanpa ini, error 5% dari batas 1% menghasilkan 500% lalu dipotong jadi
    // 100% — yang paling banyak transaksinya gagal justru bernilai penuh.
    expect(os.find((i) => i.key === "os_error")!.penilaian).toBe("batas_maks");
  });

  it("gangguan dan pesanan gagal dihitung sebagai PENGURANG, bukan penambah", () => {
    // Gangguan yang banyak bukan prestasi. Menghitungnya sebagai penambah
    // memberi nilai lebih tinggi justru pada bulan yang paling banyak rusak.
    for (const key of ["do_issue", "do_gagal"]) {
      expect(doo.find((i) => i.key === key)!.actual.sumber, key).toBe("pengurang");
    }
    expect(os.find((i) => i.key === "os_issue")!.actual.sumber).toBe("pengurang");
  });
});

describe("setiap indikator berbentuk catatan punya bentuk isiannya", () => {
  it("tidak ada jenis entri yang formnya belum dijelaskan", () => {
    // Jenis tanpa skema tetap terbuka, tapi memakai form lama tanpa kategori —
    // dan sebaran per kategorinya lalu kosong tanpa ada pesan apa pun.
    for (const i of [...doo, ...os]) {
      if (i.actual.sumber === "entri" || i.actual.sumber === "pengurang" || i.actual.sumber === "harian") {
        expect(SKEMA_ENTRI[i.actual.entri], i.key).toBeTruthy();
      }
    }
  });
});
