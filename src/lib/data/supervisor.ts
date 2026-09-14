import "server-only";

import { laporanKpi, picDinamis } from "./kpi";
import { getOutlets, getUsers } from "./store";
import { outletKpk, type KodePosisi } from "@/lib/kpi/struktur";
import { indikatorPosisi } from "@/lib/kpi/indikator";
import { peringkat, type LabelPeringkat } from "@/lib/kpi/manajemen";

/**
 * Rapor KPI SELURUH OUTLET yang disupervisi, dalam satu bulan.
 *
 * YANG DINILAI OUTLETNYA, bukan supervisornya. Seluruh angka yang masuk
 * hitungan — penjualan, laba bersih, komplain, pembelian — melekat pada
 * outlet; supervisor yang memegangnya bisa berganti di tengah bulan. Rapor
 * bernama orang akan terbelah dua tanpa ada yang bisa menjumlahkannya kembali,
 * sementara rapor bernama outlet tetap satu dan utuh. Nama supervisornya ikut
 * sebagai keterangan, bukan sebagai kunci.
 *
 * HANYA OUTLET YANG SUDAH BERJALAN DI ATAS TIGA BULAN. Aturan itu sudah
 * berlaku di dalam mesin hitungnya; di sini ia dipakai juga untuk MENYARING
 * daftarnya, supaya outlet yang memang belum waktunya dinilai tidak berjajar
 * dengan angka kosong di antara yang sudah.
 *
 * DIHITUNG DENGAN MESIN YANG SAMA, `laporanKpi`, bukan rumus singkat yang
 * ditulis ulang di sini — angka di daftar ini dan di halaman rincian outletnya
 * harus berasal dari satu perhitungan.
 */

/** Satu indikator dalam rapor outlet — dipakai kolom PDF dan layar. */
export interface IndikatorOutlet {
  key: string;
  label: string;
  bobot: number;
  /** Capaian indikator itu, 0–100+. Null = belum bisa dihitung. */
  persen: number | null;
}

export interface BarisSupervisor {
  outletId: string;
  nama: string;
  /** Supervisor yang memegangnya — keterangan, bukan kunci. */
  supervisor: string;
  posisi: KodePosisi;
  jenis: "Umum" | "KPK";
  /** 0–100. Null = belum ada satu pun angka yang bisa dihitung bulan itu. */
  nilai: number | null;
  peringkat: LabelPeringkat | null;
  indikator: IndikatorOutlet[];
  alasan: string | null;
}

export interface RekapSupervisor {
  periode: string;
  baris: BarisSupervisor[];
  rata: number | null;
  /** Sudah lolos tiga bulan tapi angkanya belum lengkap. */
  belumDinilai: number;
  /** Outlet yang DIKELUARKAN karena belum genap tiga bulan berjalan. */
  belumTigaBulan: string[];
  /** Label indikator tiap jenis — penyusun kolom tabel dan PDF. */
  kolom: Record<"Umum" | "KPK", IndikatorOutlet[]>;
}

/** Siapa supervisor tiap outlet. Kosong berarti belum ada yang memegang. */
function supervisorOutlet(): Map<string, string> {
  const peta = new Map<string, string>();
  for (const u of getUsers()) {
    if (u.role !== "supervisor" || u.active === false) continue;
    for (const id of u.outletIds ?? []) peta.set(id, u.name);
  }
  return peta;
}

const kerangka = (posisi: KodePosisi): IndikatorOutlet[] =>
  indikatorPosisi(posisi).map((i) => ({ key: i.key, label: i.label, bobot: i.bobot, persen: null }));

export async function rekapSupervisor(periode: string, hanyaOutlet?: readonly string[]): Promise<RekapSupervisor> {
  const pemegang = supervisorOutlet();
  const daftar: { outletId: string; nama: string; posisi: KodePosisi }[] = [];
  for (const posisi of ["supervisor_umum", "supervisor_kpk"] as const) {
    for (const p of picDinamis(posisi)) daftar.push({ outletId: p.value, nama: p.label, posisi });
  }

  // Coordinator Area hanya melihat outletnya sendiri, supervisor hanya
  // outletnya. Disaring DI SINI, bukan di komponennya: baris yang disaring di
  // layar tetap terkirim ke peramban dan bisa dibaca dari sana.
  const boleh = hanyaOutlet ? new Set(hanyaOutlet) : null;
  const dipakai = boleh ? daftar.filter((d) => boleh.has(d.outletId)) : daftar;

  const belumTigaBulan: string[] = [];
  const hasil = await Promise.all(
    dipakai.map(async (d) => {
      const l = await laporanKpi(d.posisi, periode, d.outletId).catch(() => null);
      // Outlet yang tidak lolos aturan tiga bulan sama sekali tidak punya
      // outlet yang dinilai — itu penandanya, dan ia dikeluarkan dari daftar.
      const lolosTiga = (l?.ca?.outlet.length ?? 0) > 0;
      if (!lolosTiga) {
        belumTigaBulan.push(d.nama);
        return null;
      }
      const nilai = l?.ringkas.skorSetara ?? null;
      const baris: BarisSupervisor = {
        outletId: d.outletId,
        nama: d.nama,
        supervisor: pemegang.get(d.outletId) ?? "belum ada supervisor",
        posisi: d.posisi,
        jenis: d.posisi === "supervisor_kpk" ? "KPK" : "Umum",
        nilai,
        peringkat: nilai === null ? null : peringkat(nilai),
        indikator: (l?.baris ?? []).map((b) => ({
          key: b.key,
          label: b.label,
          bobot: b.bobot,
          persen: b.persentase,
        })),
        alasan: nilai !== null ? null : (l?.baris.find((b) => b.alasan)?.alasan ?? null),
      };
      return baris;
    }),
  );

  const baris = hasil.filter((b): b is BarisSupervisor => b !== null);
  baris.sort((a, b) => (b.nilai ?? -1) - (a.nilai ?? -1) || a.nama.localeCompare(b.nama, "id"));
  const ada = baris.map((b) => b.nilai).filter((n): n is number => n !== null);

  return {
    periode,
    baris,
    rata: ada.length ? ada.reduce((x, y) => x + y, 0) / ada.length : null,
    belumDinilai: baris.length - ada.length,
    belumTigaBulan: belumTigaBulan.sort((a, b) => a.localeCompare(b, "id")),
    kolom: { Umum: kerangka("supervisor_umum"), KPK: kerangka("supervisor_kpk") },
  };
}

/** Outlet mana yang boleh dilihat seseorang. Null = semuanya. */
export function outletTerlihat(user: { role: string; id: string; outletIds?: string[] }): readonly string[] | null {
  if (user.role === "supervisor" || user.role === "area_coordinator") return user.outletIds ?? [];
  return null;
}

/** Jenis penilaian sebuah outlet, dari namanya. */
export const posisiOutlet = (nama: string): KodePosisi => (outletKpk(nama) ? "supervisor_kpk" : "supervisor_umum");

/** Seluruh outlet aktif beserta jenisnya — pengisi tabel Problem Solver. */
export function daftarOutletSupervisor(): { id: string; nama: string; kode: string; jenis: "Umum" | "KPK" }[] {
  return getOutlets()
    .filter((o) => o.active)
    .map((o) => ({ id: o.id, nama: o.name, kode: o.code, jenis: outletKpk(o.name) ? ("KPK" as const) : ("Umum" as const) }))
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}
