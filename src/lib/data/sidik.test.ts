import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sidikTersimpan, tabelPerluDibaca, type PetaSidik } from "./sidik";

const TABEL = ["tasks", "hygiene", "notifications"] as const;
const peta = (o: Record<string, string>): PetaSidik => new Map(Object.entries(o));

describe("tabelPerluDibaca", () => {
  it("hidrasi pertama membaca SEMUA tabel", () => {
    // Isi memori masih data contoh bawaan. Melewatinya berarti menyajikan
    // 59 nama karangan sebagai data perusahaan.
    const perlu = tabelPerluDibaca(TABEL, peta({ tasks: "1-0-0" }), null);
    expect(perlu).toEqual(new Set(TABEL));
  });

  it("sidik tidak terbaca berarti membaca SEMUA — saat ragu jangan menebak", () => {
    const perlu = tabelPerluDibaca(TABEL, null, peta({ tasks: "1-0-0" }));
    expect(perlu).toEqual(new Set(TABEL));
  });

  it("tidak ada yang berubah berarti tidak ada yang dibaca", () => {
    const s = peta({ tasks: "5-2-1", hygiene: "9-0-0", notifications: "3-3-0" });
    expect(tabelPerluDibaca(TABEL, s, new Map(s)).size).toBe(0);
  });

  it("hanya tabel yang sidiknya bergeser yang dibaca", () => {
    const lama = peta({ tasks: "5-2-1", hygiene: "9-0-0", notifications: "3-3-0" });
    const baru = peta({ tasks: "5-3-1", hygiene: "9-0-0", notifications: "3-3-0" });
    expect(tabelPerluDibaca(TABEL, baru, lama)).toEqual(new Set(["tasks"]));
  });

  it("perubahan berupa HAPUS ikut tertangkap, bukan cuma sisip", () => {
    // Pencacah dipisah tiga; kalau cuma menghitung baris, penghapusan yang
    // seimbang dengan penyisipan tidak akan terlihat sama sekali.
    const lama = peta({ tasks: "5-2-1" });
    const baru = peta({ tasks: "5-2-2" });
    expect(tabelPerluDibaca(["tasks"], baru, lama)).toEqual(new Set(["tasks"]));
  });

  it("tabel yang muncul di sidik baru tapi belum ada di sidik lama ikut dibaca", () => {
    const lama = peta({ tasks: "5-2-1" });
    const baru = peta({ tasks: "5-2-1", hygiene: "1-0-0" });
    expect(tabelPerluDibaca(TABEL, baru, lama)).toEqual(new Set(["hygiene"]));
  });

  it("tabel yang tidak ada di kedua sidik memang tidak perlu dibaca", () => {
    // `notifications` tidak muncul di mana pun: artinya belum pernah ada satu
    // baris pun yang disisipkan, diubah, atau dihapus sejak pencacah dimulai.
    // Tidak ada yang bisa berubah, jadi tidak ada yang perlu ditarik. Kalaupun
    // keliru, hidrasi pertama sudah membaca semuanya lebih dulu.
    const s = peta({ tasks: "5-2-1", hygiene: "1-0-0" });
    expect(tabelPerluDibaca(TABEL, s, new Map(s)).has("notifications")).toBe(false);
  });

  it("pencacah yang mundur (statistik di-reset) tetap memicu pembacaan", () => {
    const lama = peta({ tasks: "500-200-100" });
    const baru = peta({ tasks: "0-0-0" });
    expect(tabelPerluDibaca(["tasks"], baru, lama)).toEqual(new Set(["tasks"]));
  });
});

describe("sidikTersimpan", () => {
  it("tabel yang berhasil dibaca menyimpan sidik barunya", () => {
    const hasil = sidikTersimpan(peta({ tasks: "6-2-1" }), peta({ tasks: "5-2-1" }), []);
    expect(hasil?.get("tasks")).toBe("6-2-1");
  });

  it("tabel yang GAGAL dibaca mempertahankan sidik lamanya", () => {
    // Kalau sidik barunya ikut disimpan, kegagalan tercatat sebagai
    // keberhasilan — dan tabel itu tidak akan pernah dibaca ulang sampai
    // datanya kebetulan berubah lagi.
    const hasil = sidikTersimpan(peta({ tasks: "6-2-1", hygiene: "9-1-0" }), peta({ tasks: "5-2-1", hygiene: "9-0-0" }), ["hygiene"]);
    expect(hasil?.get("tasks")).toBe("6-2-1");
    expect(hasil?.get("hygiene")).toBe("9-0-0");
  });

  it("tabel gagal yang belum punya sidik lama dibuang, bukan disimpan", () => {
    // Menyimpannya berarti mengaku sudah pernah membaca tabel yang sebenarnya
    // belum pernah berhasil dibaca sekali pun.
    const hasil = sidikTersimpan(peta({ hygiene: "9-1-0" }), peta({}), ["hygiene"]);
    expect(hasil?.has("hygiene")).toBe(false);
  });

  it("sidik baru yang tidak terbaca mempertahankan yang lama apa adanya", () => {
    const lama = peta({ tasks: "5-2-1" });
    expect(sidikTersimpan(null, lama, [])).toBe(lama);
  });
});

describe("hidrasi bersyarat terpasang benar di hydrate.ts", () => {
  it("sidik hanya maju untuk tabel yang benar-benar selesai dibaca", () => {
    // Ada TIGA cara sebuah tabel tidak jadi dibaca: sidiknya sama, pembacaannya
    // gagal, atau jam data acuan belum jatuh tempo. Hanya yang pertama yang
    // boleh memajukan sidik. Kalau dua sisanya ikut maju, perubahannya hilang
    // tanpa galat, tanpa tanda — datanya cuma berhenti ikut berubah.
    const src = readFileSync(join(process.cwd(), "src/lib/data/hydrate.ts"), "utf8");
    expect(src).toContain("berhasil.add(table)");
    expect(src).toMatch(/tertinggal\s*=\s*\[\.\.\.perlu\]\.filter\(\(t\) => !berhasil\.has\(t\)\)/);
    expect(src).toContain("sidikTersimpan(sidikBaru, sidikLama, tertinggal)");
  });

  it("gagal membaca sidik tidak menggagalkan hidrasi, cuma mematikan penghematannya", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/data/hydrate.ts"), "utf8");
    // `bacaSidik` mengembalikan null saat gagal, dan null berarti "baca semua".
    expect(src).toMatch(/async function bacaSidik\(\)[\s\S]*?catch\s*\{\s*return null;/);
  });
});
