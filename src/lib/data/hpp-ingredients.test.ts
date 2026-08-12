import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GOLONGAN_LABEL, INGREDIENT_GOLONGAN, asGolongan, parseGolongan } from "../hpp/golongan";

const SRC = readFileSync(join(process.cwd(), "src/lib/data/hpp-ingredients.ts"), "utf8");

describe("golongan bahan baku", () => {
  it("hanya tiga golongan, semuanya punya label", () => {
    expect([...INGREDIENT_GOLONGAN]).toEqual(["makanan", "minuman", "general"]);
    for (const g of INGREDIENT_GOLONGAN) expect(GOLONGAN_LABEL[g]).toBeTruthy();
  });

  it("nilai kosong atau tak dikenal jatuh ke general", () => {
    // Baris lama tidak boleh salah tergolong hanya karena kolomnya baru ada,
    // dan menebak "makanan" untuk data kotor lebih berbahaya daripada general.
    expect(asGolongan(null)).toBe("general");
    expect(asGolongan(undefined)).toBe("general");
    expect(asGolongan("")).toBe("general");
    expect(asGolongan("entah apa")).toBe("general");
  });

  it("nilai yang sah dibaca apa adanya", () => {
    expect(asGolongan("makanan")).toBe("makanan");
    expect(asGolongan("minuman")).toBe("minuman");
  });

  it("impor yang tidak menyebut golongan TIDAK mengembalikannya ke general", () => {
    // Impor harga rutin tidak mengirim kolom golongan. Kalau bawaannya dipakai
    // langsung, satu impor akan menghapus pengelompokan seluruh 375 bahan.
    expect(SRC).toContain('golongan: input.golongan ?? existing?.golongan ?? "general"');
  });

  it("golongan ikut tersimpan ke basis data", () => {
    expect(SRC).toContain("golongan: r.golongan,");
    expect(SRC).toContain("golongan: asGolongan(r.golongan),");
  });
});

describe("pembacaan golongan dari berkas impor", () => {
  // Diuji lewat perilakunya, bukan sumbernya, supaya penulisan bebas
  // ("Food", "bar", "Makanan") benar-benar terbukti terbaca.

  it("mengenali penulisan Indonesia maupun Inggris", () => {
    for (const kata of ["Makanan", "makan", "MAKANAN", " food ", "Kitchen", "dapur"]) {
      expect(parseGolongan(kata), `"${kata}" harusnya makanan`).toBe("makanan");
    }
    for (const kata of ["Minuman", "minum", "Beverage", "drink", "BAR"]) {
      expect(parseGolongan(kata), `"${kata}" harusnya minuman`).toBe("minuman");
    }
  });

  it("sisanya general, bukan tebakan", () => {
    for (const kata of ["", "   ", "lain-lain", "kemasan", null, undefined]) {
      expect(parseGolongan(kata)).toBe("general");
    }
  });
});
