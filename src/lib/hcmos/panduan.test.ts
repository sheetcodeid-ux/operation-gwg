import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PANDUAN, PANDUAN_IDS, panduanUntuk, periksaPanduan, tujuanSambungan } from "./panduan";

/**
 * Panduan tiap halaman Human Capital.
 *
 * Yang dikunci di sini bukan kalimatnya — itu boleh diperbaiki kapan saja —
 * melainkan tiga hal yang kalau salah membuat panduannya berbahaya:
 *
 *   1. petanya nyambung dua arah (A bilang "keluar ke B", B bilang "masuk
 *      dari A"). Peta setengah tersambung membuat orang percaya satu modul
 *      tidak punya hilir padahal punya;
 *   2. setiap tautan menunjuk halaman yang benar-benar ada;
 *   3. setiap halaman HC benar-benar memasangnya, bukan cuma tersedia di
 *      berkas panduannya.
 */

describe("petanya utuh", () => {
  it("tidak ada sambungan yang menggantung atau tidak berbalas", () => {
    expect(periksaPanduan()).toEqual([]);
  });

  it("setiap panduan bisa dicari dari id-nya", () => {
    for (const id of PANDUAN_IDS) expect(panduanUntuk(id)?.id, id).toBe(id);
    expect(panduanUntuk("tidak-ada")).toBeUndefined();
  });

  it("setiap sambungan punya tujuan yang bisa digambar", () => {
    for (const p of PANDUAN) {
      for (const s of p.sambungan) {
        const t = tujuanSambungan(s);
        expect(t, `${p.id} → ${s.ke}`).toBeTruthy();
        expect(t!.href.startsWith("/"), `${s.ke} tanpa rute`).toBe(true);
      }
    }
  });
});

describe("rutenya benar-benar ada di aplikasi", () => {
  const NAV = readFileSync(join(process.cwd(), "src/lib/nav.ts"), "utf8");

  it("setiap panduan menunjuk rute yang terdaftar di menu", () => {
    for (const p of PANDUAN) {
      // Rute ber-tab (…?tab=…) diperiksa bagian jalurnya saja; tabnya urusan
      // halamannya sendiri.
      const jalur = p.href.split("?")[0];
      // Halaman pilar dinamis: rutenya /hc-mos/<slug>, bukan entri menu.
      if (jalur.startsWith("/hc-mos/") && p.id === "pilar") continue;
      expect(NAV.includes(`"${jalur}"`) || NAV.includes(`"${p.href}"`), `${p.id} → ${p.href}`).toBe(true);
    }
  });

  it("halaman pilar menunjuk pilar yang memang ada", async () => {
    const { pillarBySlug } = await import("./pillars");
    const slug = panduanUntuk("pilar")!.href.replace("/hc-mos/", "");
    expect(pillarBySlug(slug), slug).toBeTruthy();
  });
});

describe("isinya benar-benar menuntun, bukan mengulang judul", () => {
  it("halaman isian menerangkan kolomnya, termasuk mana yang wajib", () => {
    for (const p of PANDUAN.filter((x) => x.jenis === "isi")) {
      expect(p.isian.length, p.id).toBeGreaterThan(0);
      expect(p.isian.some((i) => i.wajib), `${p.id}: tidak ada kolom wajib sama sekali`).toBe(true);
      for (const i of p.isian) {
        // Keterangan yang cuma mengulang nama kolomnya tidak menolong siapa pun.
        expect(i.cara.length, `${p.id}/${i.nama}`).toBeGreaterThan(i.nama.length);
      }
    }
  });

  it("setiap halaman menyebut siapa pengisinya dan kapan", () => {
    for (const p of PANDUAN) {
      expect(p.siapa.trim().length, p.id).toBeGreaterThan(0);
      expect(p.kapan.trim().length, p.id).toBeGreaterThan(0);
    }
  });
});

describe("terpasang di halamannya, bukan cuma tersedia", () => {
  const HALAMAN: Record<string, string> = {
    hcmos: "src/app/(app)/hc-mos/page.tsx",
    pilar: "src/app/(app)/hc-mos/[pilar]/page.tsx",
    // Dua kanvas ini memang tidak punya kepala halaman — panduannya duduk di
    // bilah alat komponennya, bukan di berkas halamannya.
    raci: "src/components/hcmos/matriks-raci.tsx",
    bagan: "src/components/hcmos/bagan-organisasi.tsx",
    struktur: "src/app/(app)/hc-mos/struktur/page.tsx",
    karyawan: "src/app/(app)/hc-mos/karyawan/page.tsx",
    kontrak: "src/app/(app)/hc-mos/kontrak/page.tsx",
    rekrutmen: "src/app/(app)/hc-mos/rekrutmen/page.tsx",
    modul: "src/app/(app)/hc-mos/modul/page.tsx",
    "fast-track": "src/app/(app)/hc-mos/fast-track/page.tsx",
    assessment: "src/app/(app)/hc-mos/assessment/page.tsx",
    kinerja: "src/app/(app)/hc-mos/kinerja/page.tsx",
    appraisal: "src/app/(app)/hc-mos/appraisal/page.tsx",
    talent: "src/app/(app)/hc-mos/talent/page.tsx",
    kompensasi: "src/app/(app)/hc-mos/kompensasi/page.tsx",
    relasi: "src/app/(app)/hc-mos/relasi/page.tsx",
    dokumen: "src/app/(app)/hc-mos/dokumen/page.tsx",
    monitoring: "src/app/(app)/hc-mos/monitoring/page.tsx",
    kpi: "src/app/(app)/hc-mos/kpi/page.tsx",
    hc_pengajuan: "src/app/(app)/hc/pengajuan/page.tsx",
    hc_antrian: "src/app/(app)/hc/antrian/page.tsx",
    hc_permintaan: "src/app/(app)/hc/permintaan/page.tsx",
    hc_pelatihan: "src/app/(app)/hc/pelatihan/page.tsx",
  };

  it("tiap halaman HC memasang panduannya sendiri", () => {
    for (const [id, berkas] of Object.entries(HALAMAN)) {
      const isi = readFileSync(join(process.cwd(), berkas), "utf8");
      expect(isi, `${berkas} belum memasang PanduanModul`).toContain("PanduanModul");
      // Halaman bertab memilih panduannya lewat peta tab, bukan menuliskannya
      // langsung di atributnya — keduanya sah.
      const terpasang = isi.includes(`panduan="${id}"`) || isi.includes(`: "${id}"`);
      expect(terpasang, `${berkas} memasang panduan dengan id yang salah`).toBe(true);
    }
  });

  it("tab yang punya panduannya sendiri ikut terpasang", () => {
    // Kompetensi dan Intervensi tinggal di halaman Kinerja sebagai tab, tapi
    // pengisi dan sambungannya berbeda — panduannya ikut berganti. Satu panduan
    // untuk ketiganya akan keliru untuk dua di antaranya.
    const isi = readFileSync(join(process.cwd(), "src/app/(app)/hc-mos/kinerja/page.tsx"), "utf8");
    expect(isi).toContain('kompetensi: "kompetensi"');
    expect(isi).toContain('intervensi: "intervensi"');
    expect(isi).toContain("PANDUAN_TAB[tab]");
  });

  it("tidak ada panduan yatim — semuanya dipakai", () => {
    const dipakai = new Set([...Object.keys(HALAMAN), "kompetensi", "intervensi"]);
    for (const id of PANDUAN_IDS) expect(dipakai.has(id), `panduan "${id}" tidak dipasang di halaman mana pun`).toBe(true);
  });
});

describe("konteks pilar dibaca, bukan diketik ulang", () => {
  it("setiap halaman modul menyebut pilar pemiliknya", async () => {
    const { pillarBySlug } = await import("./pillars");
    for (const p of PANDUAN) {
      // Dashboard dan halaman pilar memang bukan milik satu pilar tertentu.
      if (p.id === "hcmos" || p.id === "pilar") {
        expect(p.pilar, `${p.id} seharusnya tanpa pilar`).toBeUndefined();
        continue;
      }
      expect(p.pilar, `${p.id} belum punya pilar`).toBeTruthy();
      expect(pillarBySlug(p.pilar!), `${p.id} → pilar "${p.pilar}" tidak ada`).toBeTruthy();
    }
  });

  it("nama PIC tidak lagi diketik di halaman mana pun", () => {
    // Dulu dua belas halaman menuliskannya sebagai Badge. Begitu seseorang
    // berpindah peran, semuanya menyebut nama yang salah sekaligus.
    for (const [id, berkas] of Object.entries({
      appraisal: "src/app/(app)/hc-mos/appraisal/page.tsx",
      modul: "src/app/(app)/hc-mos/modul/page.tsx",
      rekrutmen: "src/app/(app)/hc-mos/rekrutmen/page.tsx",
      kompensasi: "src/app/(app)/hc-mos/kompensasi/page.tsx",
      talent: "src/app/(app)/hc-mos/talent/page.tsx",
    })) {
      const isi = readFileSync(join(process.cwd(), berkas), "utf8");
      expect(isi, `${berkas} masih mengetik PIC-nya`).not.toContain("PIC:");
      expect(isi, `${berkas} belum memasang bilah konteks`).toContain("KonteksModul");
      expect(isi).toContain(id);
    }
  });

  it("bilah konteksnya mengambil pilar dan PIC dari sumbernya", () => {
    const K = readFileSync(join(process.cwd(), "src/components/hcmos/konteks-modul.tsx"), "utf8");
    expect(K).toContain("pillarBySlug");
    expect(K).toContain("pilar.pic");
    // Dan pilarnya bisa diklik — yang membacanya biasanya sedang mencari jalan
    // ke pilar itu.
    expect(K).toContain("href={`/hc-mos/${pilar.slug}`}");
  });
});
