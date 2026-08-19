import { describe, expect, it } from "vitest";
import { DIVISION_GROUPS, kunciEntri, NAV_MENUS, type NavGroupEntry } from "../nav";
import { HC_PILLARS } from "./pillars";

/**
 * Sidebar dan isi halaman harus memuat kerangka yang SAMA.
 *
 * Kerangka HC-MOS ditulis di dua tempat karena keduanya memang berbeda
 * urusannya: `HC_PILLARS` memegang arti tiap aktivitas (fungsi, PIC, matriks
 * RACI), sementara `DIVISION_GROUPS` memegang tampilannya di sidebar. Yang
 * tidak boleh adalah keduanya menyebut pilar atau sub-menu yang berbeda —
 * pembacanya lalu melihat satu susunan di sidebar dan susunan lain di halaman,
 * tanpa cara tahu mana yang benar.
 *
 * Uji ini yang menjaganya. Kalau nanti satu sub-menu ditambah di salah satu
 * tempat saja, ia gagal di sini, bukan di layar orang HRD.
 */

const grup = DIVISION_GROUPS["Human Capital"] ?? [];
const MENU_BY_KEY = Object.fromEntries(NAV_MENUS.map((m) => [m.key, m]));

/** Alamat sebuah baris sidebar, apa pun bentuk entrinya. */
const hrefEntri = (e: NavGroupEntry): string =>
  typeof e === "string" ? (MENU_BY_KEY[e]?.href ?? "") : e.href;

/** Grup yang memang bukan pilar — baris pembuka dan menu administrasi. */
const BUKAN_PILAR = ["HC-MOS", "Menu Administrasi"];
const grupPilar = grup.filter((g) => !BUKAN_PILAR.includes(g.name));

describe("kerangka HC-MOS: sidebar vs definisi pilar", () => {
  it("sembilan pilar, dengan nama dan urutan yang sama", () => {
    expect(grupPilar.map((g) => g.name)).toEqual(HC_PILLARS.map((p) => p.label));
  });

  it("urutannya ditetapkan, bukan abjad", () => {
    // Tanpa nomor urut, "Compensation & Benefit" naik ke atas dan
    // "Recruitment & Selection" turun ke bawah — alur kerjanya (direkrut →
    // dilatih → dinilai) hilang sama sekali.
    for (const g of grup) expect(g.urutan, `${g.name} tidak punya nomor urut`).toBeTypeOf("number");
    const nomor = grup.map((g) => g.urutan!);
    expect([...nomor].sort((a, b) => a - b)).toEqual(nomor);
    expect(new Set(nomor).size, "ada nomor urut kembar").toBe(nomor.length);
  });

  it("tiap pilar memuat sub-menu yang sama dengan definisinya", () => {
    for (const [i, pilar] of HC_PILLARS.entries()) {
      const diSidebar = grupPilar[i].menus.map(hrefEntri);
      const diDefinisi = pilar.submenus
        // Kontrak Tracker milik pilar ini, tapi tempatnya di Menu Administrasi.
        .filter((s) => !s.diAdministrasi)
        .map((s) => s.href)
        .filter((h): h is string => !!h);
      expect(diSidebar, `pilar ${pilar.label}`).toEqual(diDefinisi);
    }
  });

  it("Matriks RACI dan Dashboard jadi baris lepas di paling atas", () => {
    // Keduanya tujuan pertama orang saat membuka divisinya. Di balik satu
    // lipatan berarti dua klik untuk sesuatu yang seharusnya langsung terlihat.
    const pembuka = grup[0];
    expect(pembuka.datar, "grup pembuka harus datar").toBe(true);
    expect(pembuka.menus.map(kunciEntri)).toEqual(["hcmos_raci", "hcmos"]);
    // Grup lain TIDAK boleh datar — tanpa kepala lipat, sembilan pilar akan
    // tumpah jadi satu daftar panjang tanpa pembatas.
    for (const g of grup.slice(1)) expect(g.datar, g.name).toBeFalsy();
  });

  it("setiap baris sidebar punya alamat", () => {
    for (const g of grup) {
      for (const e of g.menus) {
        expect(hrefEntri(e), `${g.name} → ${kunciEntri(e)}`).not.toBe("");
      }
    }
  });
});

describe("revisi hasil Meeting Fitur HRD", () => {
  const semuaSub = HC_PILLARS.flatMap((p) => p.submenus);
  const adaSlug = (slug: string) => semuaSub.some((s) => s.slug === slug);

  it("kandidat, jadwal interview, dan onboarding jadi satu pintu", () => {
    expect(adaSlug("rekrutmen-seleksi")).toBe(true);
    for (const lama of ["database-kandidat", "jadwal-interview", "onboarding"]) {
      expect(adaSlug(lama), `"${lama}" seharusnya sudah lebur`).toBe(false);
    }
  });

  it("Fast Start & Fast Track dan Pre/Post Test berdiri sendiri di sebelah Self-Learning", () => {
    // Sempat dilebur jadi satu pintu, lalu dikembalikan mengikuti rujukan
    // HC-MOS terbaru. Ketiganya menjawab pertanyaan yang berbeda: dua yang
    // pertama dibuka Human Capital untuk memantau jalannya program, yang
    // terakhir dibuka karyawan untuk belajar.
    for (const slug of ["fast-start-fast-track", "pre-post-test", "self-learning"]) {
      expect(adaSlug(slug), `sub-menu "${slug}" hilang`).toBe(true);
    }
  });

  it("Fast Start & Fast Track dan Pre/Post Test hanya berlaku untuk outlet", () => {
    for (const slug of ["fast-start-fast-track", "pre-post-test"]) {
      expect(semuaSub.find((x) => x.slug === slug)!.scopeOnly, slug).toBe("outlet");
    }
    // Self-Learning justru TIDAK boleh dibatasi satu scope — staf manajemen
    // punya kurikulum onboarding-nya sendiri di sana.
    expect(semuaSub.find((x) => x.slug === "self-learning")!.scopeOnly).toBeUndefined();
  });

  it("Appraisal Review diganti Request Intervensi", () => {
    expect(adaSlug("appraisal-review")).toBe(false);
    expect(adaSlug("request-intervensi")).toBe(true);
  });

  it("Antrian Dokumen berada di dalam HC-MOS, bukan menu HC yang berdiri sendiri", () => {
    const od = grup.find((g) => g.name === "Organization Development");
    expect(od?.menus.map(kunciEntri)).toContain("hc_review");
  });

  it("Kontrak Tracker ada di Menu Administrasi HC-MOS", () => {
    const adm = grup.find((g) => g.name === "Menu Administrasi");
    expect(adm?.menus.map(kunciEntri)).toContain("hc_kontrak");
  });

  it("Kontrak Tracker tidak lagi digambarkan sebagai milik outlet", () => {
    const kontrak = semuaSub.find((s) => s.slug === "kontrak-tracker");
    expect(kontrak, "sub-menu kontrak-tracker hilang").toBeTruthy();
    expect(kontrak!.fungsi.toLowerCase()).not.toContain("outlet");
  });
});
