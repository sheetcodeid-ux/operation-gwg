import { describe, expect, it } from "vitest";
import { DICT } from "./dict";
import { NAV_MENUS, DIVISION_GROUPS } from "../nav";

/**
 * Penjaga terhadap sidebar dua bahasa.
 *
 * Terjemahan dicari lewat kunci yang DIBENTUK dari labelnya (`nav.<label>`,
 * `group.<nama>`). Begitu sebuah label diganti atau menu baru ditambah tanpa
 * kuncinya ikut ditambah, terjemahannya diam-diam hilang: menunya tetap
 * berbahasa Indonesia walau bahasa sudah diubah ke Inggris, sementara menu di
 * sebelahnya sudah berganti. Tidak ada yang gagal, tidak ada yang merah —
 * cuma satu sidebar berisi dua bahasa, dan itu justru yang membingungkan.
 *
 * Uji ini yang menangkapnya, bukan pengguna.
 */
describe("kelengkapan terjemahan menu", () => {
  const bahasa = ["en", "id"] as const;

  it("setiap menu punya kunci terjemahan di SEMUA bahasa", () => {
    const kurang: string[] = [];
    for (const m of NAV_MENUS) {
      for (const b of bahasa) {
        if (!DICT[b][`nav.${m.label}`]) kurang.push(`${b}: nav.${m.label}`);
      }
    }
    expect(kurang).toEqual([]);
  });

  it("setiap nama bidang di sidebar punya kunci terjemahan", () => {
    const nama = new Set<string>();
    for (const grup of Object.values(DIVISION_GROUPS)) {
      for (const g of grup ?? []) nama.add(g.name);
    }
    const kurang: string[] = [];
    for (const n of nama) {
      for (const b of bahasa) {
        if (!DICT[b][`group.${n}`]) kurang.push(`${b}: group.${n}`);
      }
    }
    expect(kurang).toEqual([]);
  });

  it("kedua bahasa memuat kunci yang sama persis", () => {
    // Kunci yang hanya ada di satu bahasa berarti separuh pengguna melihat
    // teks mentah — dan itu tidak akan terlihat sampai bahasanya diganti.
    const en = Object.keys(DICT.en).sort();
    const id = Object.keys(DICT.id).sort();
    expect(id.filter((k) => !DICT.en[k])).toEqual([]);
    expect(en.filter((k) => !DICT.id[k])).toEqual([]);
  });

  it("tidak ada terjemahan yang kosong", () => {
    for (const b of bahasa) {
      for (const [k, v] of Object.entries(DICT[b])) {
        expect(v.trim(), `${b}: ${k} kosong`).not.toBe("");
      }
    }
  });

  it("penamaan antrean seragam tapi tetap dibedakan", () => {
    // "Antrian POS" dan "Antrian IT" — bentuknya sama, isinya beda. Kalau
    // salah satunya berubah bentuk, keseragamannya hilang tanpa disadari.
    expect(DICT.id["nav.Antrian POS"]).toBe("Antrian POS");
    expect(DICT.id["nav.Antrian IT"]).toBe("Antrian IT");
    expect(DICT.en["nav.Antrian POS"]).toBe("POS Queue");
    expect(DICT.en["nav.Antrian IT"]).toBe("IT Queue");
  });
});
