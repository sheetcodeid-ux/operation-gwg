import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PenilaianBoard } from "./penilaian-board";
import type { BarisDashboard, DashboardPenilaian } from "@/lib/data/creative-penilaian";
import { nilaiPermintaan } from "@/lib/creative/penilaian-request";

/**
 * Papannya benar-benar DIRENDER di sini, bukan dibaca sebagai teks.
 *
 * Alasannya mahal dan masih segar: satu kali komponen ikon dikirim sebagai prop
 * dari halaman server ke komponen klien, dan enam halaman mati di produksi
 * dengan "An error occurred in the Server Components render" — sementara tsc,
 * lint, seluruh tes, dan build semuanya hijau. Semuanya memeriksa berkas; tak
 * satu pun pernah merender apa pun.
 */

const baris = (o: Partial<BarisDashboard> = {}): BarisDashboard => {
  const ceklis = { tujuanJelas: true, ukuranMedia: false, materiLengkap: false, tanggalTayang: false };
  const hasil = nilaiPermintaan("2026-08-22", "2026-08-22", ceklis);
  return {
    requestId: "req_1",
    judul: "Poster Menu Baru",
    dibuat: "2026-08-22T03:00:00Z",
    deadline: "2026-08-22",
    pemohonId: "spv_kayla",
    pemohonNama: "Kayla",
    areaId: "area_poetri",
    areaNama: "Area Poetri",
    outletNama: "Nordu Bakes Tanjung Duren",
    periode: "2026-08",
    skor: hasil.skor,
    hari: hasil.hari,
    waktu: hasil.waktu,
    dinilaiNama: "Dimas",
    catatan: "",
    ceklis,
    hasil,
    ...o,
  };
};

const render = (data: DashboardPenilaian, extra?: Partial<Parameters<typeof PenilaianBoard>[0]>) =>
  renderToStaticMarkup(
    <PenilaianBoard data={data} bolehKirim penerima={[]} lingkupArea={null} {...extra} />,
  );

describe("papan penilaian benar-benar bisa dirender", () => {
  it("tanpa satu pun penilaian pun tetap tampil, bukan layar kosong", () => {
    const html = render({ baris: [], belum: [] });
    expect(html).toContain("Penilaian Request Design");
    expect(html).toContain("Belum ada permintaan dinilai");
  });

  it("menampilkan area di kolom pertama, bukan nama outlet", () => {
    // Keluhan aslinya: permintaan Kayla tercatat "Manajemen (tanpa outlet)"
    // padahal ia supervisor dengan cabang dan wilayah yang jelas.
    const html = render({ baris: [baris()], belum: [] });
    expect(html).toContain("Area Poetri");
    expect(html.indexOf("Area Poetri")).toBeLessThan(html.indexOf("Kayla"));
    expect(html).not.toContain("tanpa outlet");
  });

  it("permintaan kantor tampil sebagai Head Office", () => {
    const html = render({
      baris: [baris({ areaId: "__head_office", areaNama: "Head Office", outletNama: null, pemohonNama: "Marketing" })],
      belum: [],
    });
    expect(html).toContain("Head Office");
  });

  it("dua saringan berdiri sendiri: bulan dan label", () => {
    // Isi menunya baru dirender saat dibuka (itu memang cara Popover bekerja),
    // jadi yang diperiksa di sini pemicunya — keduanya harus ada, dan keduanya
    // harus punya keadaan awal "semua", bukan tersaring diam-diam.
    const html = render({ baris: [baris()], belum: [] });
    expect(html).toContain("Semua bulan");
    expect(html).toContain("Semua label");
  });

  it("permintaan yang belum dinilai ikut dihitung", () => {
    const html = render({
      baris: [baris()],
      belum: [{ requestId: "r2", judul: "X", pemohonNama: "Y", areaNama: "Area Poetri", periode: "2026-08" }],
    });
    expect(html).toContain("menunggu penilaian saat ACC");
  });

  it("akun tanpa cabang diberi tahu, bukan dibiarkan mengira dashboard-nya rusak", () => {
    const html = render({ baris: [], belum: [] }, { bolehKirim: false, lingkupArea: [] });
    expect(html).toContain("belum ditugaskan cabang");
  });

  it("Coordinator Area melihat keterangan wilayahnya, tanpa tombol kirim", () => {
    const html = render({ baris: [baris()], belum: [] }, { bolehKirim: false, lingkupArea: ["Area Poetri"] });
    expect(html).toContain("Wilayah Anda");
    expect(html).not.toContain("Report ke CA");
  });

  it("tim Creative mendapat tombol kirim laporannya", () => {
    const html = render({ baris: [baris()], belum: [] });
    expect(html).toContain("Report ke CA");
  });
});
