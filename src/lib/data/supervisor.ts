import "server-only";

import { laporanKpi, picDinamis } from "./kpi";
import { getOutlets, getUsers } from "./store";
import { outletKpk, type KodePosisi } from "@/lib/kpi/struktur";
import { peringkat, type LabelPeringkat } from "@/lib/kpi/manajemen";

/**
 * Rapor SELURUH supervisor dalam satu bulan.
 *
 * Halaman ini menjawab pertanyaan yang tidak bisa dijawab rapor per orang:
 * siapa yang tertinggal di antara lima puluh tiga orang. Dan ia juga yang jadi
 * dasar PDF pencairan — yang membagikan perlu satu daftar bernama, bukan lima
 * puluh tiga berkas yang harus dibuka satu per satu.
 *
 * DIHITUNG DENGAN MESIN YANG SAMA, `laporanKpi`, bukan rumus singkat yang
 * ditulis ulang di sini. Angka di daftar ini dan angka di halaman rincian
 * orangnya harus berasal dari satu perhitungan; kalau ditulis dua kali, suatu
 * hari yang satu diperbaiki dan yang lain tidak, lalu tidak ada cara
 * memutuskan mana yang benar saat keduanya dipertanyakan.
 *
 * Yang membuatnya tetap cepat bukan jalan pintas melainkan memo per-permintaan
 * di pembaca bulanannya — lihat `netBulananPerCabang`. Tanpa itu daftar ini
 * membaca empat bulan yang sama sebanyak lima puluh tiga kali.
 */

export interface BarisSupervisor {
  userId: string;
  nama: string;
  /** Posisi yang menilainya — penentu indikator mana yang dipakai. */
  posisi: KodePosisi;
  jenis: "Umum" | "KPK";
  /** Outlet yang dipegang. Hampir selalu satu. */
  outlet: string[];
  /** 0–100. Null = belum ada satu pun angka yang bisa dihitung bulan itu. */
  nilai: number | null;
  peringkat: LabelPeringkat | null;
  /** Kenapa nilainya kosong — dibawa apa adanya dari laporan. */
  alasan: string | null;
}

export interface RekapSupervisor {
  periode: string;
  baris: BarisSupervisor[];
  /** Rata-rata yang ADA nilainya. Null bila belum satu pun terisi. */
  rata: number | null;
  /** Berapa yang belum bisa dinilai — dipakai memberi tahu, bukan disembunyikan. */
  belumDinilai: number;
}

/** Nama outlet tiap supervisor, untuk keterangan di bawah namanya. */
function outletMilik(userId: string): string[] {
  const nama = new Map(getOutlets().map((o) => [o.id, o.name]));
  const u = getUsers().find((x) => x.id === userId);
  return (u?.outletIds ?? []).map((id) => nama.get(id) ?? "").filter(Boolean);
}

export async function rekapSupervisor(periode: string, hanyaUserId?: string): Promise<RekapSupervisor> {
  const daftar: { userId: string; nama: string; posisi: KodePosisi }[] = [];
  for (const posisi of ["supervisor_umum", "supervisor_kpk"] as const) {
    for (const p of picDinamis(posisi)) daftar.push({ userId: p.value, nama: p.label, posisi });
  }

  // Supervisor hanya melihat barisnya sendiri. Disaring DI SINI, bukan di
  // komponennya: baris yang disaring di layar tetap terkirim ke peramban, dan
  // siapa pun bisa membacanya dari sana.
  const dipakai = hanyaUserId ? daftar.filter((d) => d.userId === hanyaUserId) : daftar;

  const baris = await Promise.all(
    dipakai.map(async (d): Promise<BarisSupervisor> => {
      const outlet = outletMilik(d.userId);
      const l = await laporanKpi(d.posisi, periode, d.userId).catch(() => null);
      const nilai = l?.ringkas.skorSetara ?? null;
      return {
        userId: d.userId,
        nama: d.nama,
        posisi: d.posisi,
        jenis: d.posisi === "supervisor_kpk" ? "KPK" : "Umum",
        outlet,
        nilai,
        peringkat: nilai === null ? null : peringkat(nilai),
        // Alasan dari baris pertama yang kosong — hampir selalu sama untuk
        // seluruh indikator orang itu (outlet belum tiga bulan, dan seterusnya).
        alasan: nilai !== null ? null : (l?.baris.find((b) => b.alasan)?.alasan ?? null),
      };
    }),
  );

  baris.sort((a, b) => (b.nilai ?? -1) - (a.nilai ?? -1) || a.nama.localeCompare(b.nama, "id"));
  const ada = baris.map((b) => b.nilai).filter((n): n is number => n !== null);
  return {
    periode,
    baris,
    rata: ada.length ? ada.reduce((x, y) => x + y, 0) / ada.length : null,
    belumDinilai: baris.length - ada.length,
  };
}

/** Jenis supervisor seseorang, dari outlet yang dipegangnya. Null = bukan supervisor. */
export function jenisSupervisor(userId: string): KodePosisi | null {
  const u = getUsers().find((x) => x.id === userId);
  if (!u || u.role !== "supervisor") return null;
  const nama = new Map(getOutlets().map((o) => [o.id, o.name]));
  const punya = u.outletIds ?? [];
  if (punya.length === 0) return null;
  return punya.some((id) => outletKpk(nama.get(id) ?? "")) ? "supervisor_kpk" : "supervisor_umum";
}
