import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NAV_MENUS, DIVISION_GROUPS, DIVISION_ICON } from "./nav";

/**
 * Setiap ikon yang disebut sidebar harus benar-benar ada.
 *
 * Sidebar merender `{Icon && <Icon />}` — ikon yang tidak terdaftar TIDAK
 * membuat aplikasi rusak, ia cuma hilang. Barisnya tetap bisa diklik, hanya
 * tanpa gambar, dan tidak ada satu pun galat yang muncul di mana pun. Tujuh
 * menu sempat begitu selama beberapa hari sampai ada yang menyadarinya dengan
 * mata sendiri.
 */
const berkas = readFileSync(join(process.cwd(), "src/components/layout/icons.tsx"), "utf8");
const peta = berkas.slice(berkas.indexOf("export const NAV_ICONS"));
const terdaftar = new Set([...peta.matchAll(/^ {2}([A-Z][A-Za-z0-9]*),/gm)].map((m) => m[1]));

describe("ikon sidebar", () => {
  it("setiap menu memakai ikon yang terdaftar", () => {
    const kurang = NAV_MENUS.filter((m) => !terdaftar.has(m.icon)).map((m) => `${m.label} → ${m.icon}`);
    expect(kurang).toEqual([]);
  });

  it("setiap bidang kerja memakai ikon yang terdaftar", () => {
    const kurang: string[] = [];
    for (const [divisi, grup] of Object.entries(DIVISION_GROUPS)) {
      for (const g of grup ?? []) {
        if (!terdaftar.has(g.icon)) kurang.push(`${divisi}/${g.name} → ${g.icon}`);
        for (const e of g.menus) {
          if (typeof e !== "string" && !terdaftar.has(e.icon)) kurang.push(`${divisi}/${g.name}/${e.label} → ${e.icon}`);
        }
      }
    }
    expect(kurang).toEqual([]);
  });

  it("setiap divisi memakai ikon yang terdaftar", () => {
    const kurang = Object.entries(DIVISION_ICON)
      .filter(([, ikon]) => !terdaftar.has(ikon))
      .map(([d, i]) => `${d} → ${i}`);
    expect(kurang).toEqual([]);
  });
});
