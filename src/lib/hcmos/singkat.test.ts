import { describe, expect, it } from "vitest";
import { labelSumbu, singkat, singkatPeriode } from "./singkat";

describe("singkatan label sumbu", () => {
  it("memakai singkatan yang sudah dipakai orang, bukan potongan huruf", () => {
    expect(singkat("Supervisor")).toBe("SPV");
    expect(singkat("Product Development & Quality")).toBe("PDQ");
    expect(singkat("Human Capital")).toBe("HC");
    expect(singkat("Operational")).toBe("OPS");
  });

  it("tidak peduli huruf besar-kecil maupun spasi berlebih", () => {
    expect(singkat("  supervisor ")).toBe("SPV");
    expect(singkat("HUMAN   CAPITAL")).toBe("HC");
  });

  it("beberapa kata jadi huruf awal tiap kata", () => {
    expect(singkat("Finance Accounting Tax")).toBe("FAT");
    expect(singkat("Kualitas Makanan Minuman")).toBe("KMM");
  });

  it("kata sambung tidak ikut disingkat", () => {
    expect(singkat("Sarana dan Prasarana")).toBe("SP");
  });

  it("satu kata panjang jadi tiga huruf pertama", () => {
    expect(singkat("Marketing")).toBe("MAR");
    expect(singkat("Purchasing")).toBe("PUR");
  });

  it("kamus hanya berlaku untuk frasa penuhnya", () => {
    // "Marketing Communication" punya singkatan resmi; "Marketing" saja tidak.
    expect(singkat("Marketing Communication")).toBe("MKT");
    expect(singkat("Marketing")).toBe("MAR");
  });

  it("nama yang memang sudah pendek dibiarkan utuh", () => {
    expect(singkat("HRD")).toBe("HRD");
    expect(singkat("Bar")).toBe("BAR");
  });

  it("kosong tidak menghasilkan huruf sampah", () => {
    expect(singkat("")).toBe("—");
    expect(singkat("   ")).toBe("—");
  });

  it("lebih dari empat kata dipotong di empat huruf awal", () => {
    expect(singkat("Satu Dua Tiga Empat Lima Enam")).toBe("SDTE");
  });
});

describe("singkatan periode", () => {
  it("2026-08 jadi AGU", () => {
    expect(singkatPeriode("2026-08")).toBe("AGU");
    expect(singkatPeriode("2026-01")).toBe("JAN");
  });

  it("nama bulan Indonesia ikut dikenali", () => {
    expect(singkatPeriode("Agustus 2026")).toBe("AGU");
    expect(singkatPeriode("Desember 2025")).toBe("DES");
  });

  it("bulan di luar 1–12 ditampilkan apa adanya, bukan disamarkan", () => {
    expect(singkatPeriode("2026-13")).toBe("2026-13");
  });

  it("yang bukan periode jatuh ke aturan singkatan biasa", () => {
    expect(singkatPeriode("Supervisor")).toBe("SPV");
  });
});

describe("labelSumbu", () => {
  it("menyingkat selama singkatannya masih saling berbeda", () => {
    expect(labelSumbu(["Finance Accounting Tax", "Supervisor"])).toEqual(["FAT", "SPV"]);
  });

  it("memakai nama utuh begitu singkatannya bertabrakan", () => {
    // "Batch 01/2026" dan "Batch 02/2026" sama-sama jadi "B02" — tiga titik
    // pada grafik tren jadi tidak bisa dibedakan sama sekali.
    const nama = ["Batch 01/2026", "Batch 02/2026", "Batch 03/2026"];
    expect(labelSumbu(nama)).toEqual(nama);
  });

  it("nama yang memang kembar tidak memaksa label panjang", () => {
    expect(labelSumbu(["Supervisor", "Supervisor"])).toEqual(["SPV", "SPV"]);
  });

  it("bisa dipakai dengan penyingkat periode", () => {
    expect(labelSumbu(["2026-01", "2026-02"], singkatPeriode)).toEqual(["JAN", "FEB"]);
  });
});
