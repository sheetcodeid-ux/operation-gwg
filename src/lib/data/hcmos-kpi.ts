import "server-only";

import { db, dbEnabled } from "./db";
import { listKontrak, listUpdateBulanan, outletsForUser } from "./hcmos";
import { listOnboarding } from "./hcmos-rekrutmen";
import { listTabel } from "./hcmos-lanjutan";
import { periodeKey } from "@/lib/hcmos/kontrak";
import { progresOnboarding } from "@/lib/hcmos/rekrutmen";
import { lulus } from "@/lib/hcmos/lanjutan";
import type { BarisKpi } from "@/lib/hcmos/kpi";
import type { UserProfile } from "@/lib/types";

/**
 * Menghitung keenam indikator KPI Human Capital dari data yang sudah ada.
 * Lihat lib/hcmos/kpi.ts untuk alasan tiap angka harus dihitung, bukan diketik.
 */

interface PermintaanPegawai {
  diminta: number;
  direkrut: number;
  /** Rata-rata hari dari diajukan sampai terlaksana. */
  rataHari: number | null;
  jumlahSelesai: number;
}

/** Permintaan pegawai dari modul Pengajuan — sumber dua indikator rekrutmen. */
async function permintaanPegawai(): Promise<PermintaanPegawai> {
  const kosong = { diminta: 0, direkrut: 0, rataHari: null, jumlahSelesai: 0 };
  if (!dbEnabled) return kosong;

  const { data, error } = await db()
    .from("hc_requests")
    .select("headcount,recruited,status,created_at,completed_at")
    .eq("kind", "rekrutmen");
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as {
    headcount: number | null;
    recruited: number | null;
    status: string | null;
    created_at: string | null;
    completed_at: string | null;
  }[];

  let diminta = 0;
  let direkrut = 0;
  const durasi: number[] = [];
  for (const r of rows) {
    diminta += Number(r.headcount ?? 0);
    direkrut += Number(r.recruited ?? 0);
    if (r.status === "terlaksana" && r.created_at && r.completed_at) {
      const hari = (new Date(r.completed_at).getTime() - new Date(r.created_at).getTime()) / 86_400_000;
      if (hari >= 0) durasi.push(hari);
    }
  }

  return {
    diminta,
    direkrut,
    rataHari: durasi.length ? Math.round((durasi.reduce((a, b) => a + b, 0) / durasi.length) * 10) / 10 : null,
    jumlahSelesai: durasi.length,
  };
}

export interface HasilKpi {
  periode: string;
  baris: BarisKpi[];
  /** Kelulusan Fast Start — ditampilkan sebagai pelengkap, di luar keenam indikator. */
  kelulusanFastStart: { lulus: number; dinilai: number } | null;
}

export async function hitungKpiHc(user: UserProfile, periode = periodeKey()): Promise<HasilKpi> {
  const [minta, kontrak, updates, onboarding, latihan] = await Promise.all([
    permintaanPegawai(),
    listKontrak(user),
    listUpdateBulanan(user, periode),
    listOnboarding(),
    listTabel("hc_training_records"),
  ]);

  const outlets = outletsForUser(user);
  const aktif = kontrak.filter((k) => !k.keluar);
  const keluar = kontrak.filter((k) => k.keluar);
  const berkontrak = aktif.filter((k) => k.status === "aktif" || k.status === "segera_berakhir");

  const baris: BarisKpi[] = [
    {
      key: "pemenuhan_rekrutmen",
      realisasi: minta.diminta > 0 ? Math.round((minta.direkrut / minta.diminta) * 100) : null,
      rincian:
        minta.diminta > 0
          ? `${minta.direkrut} direkrut dari ${minta.diminta} diminta`
          : "belum ada permintaan pegawai",
    },
    {
      key: "kecepatan_rekrutmen",
      realisasi: minta.rataHari,
      rincian:
        minta.rataHari !== null
          ? `rata-rata dari ${minta.jumlahSelesai} permintaan yang sudah terpenuhi`
          : "belum ada permintaan yang terpenuhi",
    },
    {
      key: "kepatuhan_kontrak",
      realisasi: aktif.length > 0 ? Math.round((berkontrak.length / aktif.length) * 100) : null,
      rincian:
        aktif.length > 0
          ? `${berkontrak.length} berkontrak dari ${aktif.length} karyawan outlet`
          : "belum ada data karyawan outlet",
    },
    {
      key: "kepatuhan_laporan",
      realisasi: outlets.length > 0 ? Math.round((updates.length / outlets.length) * 100) : null,
      rincian:
        outlets.length > 0 ? `${updates.length} dari ${outlets.length} outlet melapor` : "belum ada outlet",
    },
    {
      key: "penyelesaian_onboarding",
      realisasi: onboarding.length
        ? Math.round(
            onboarding.reduce((a, o) => a + progresOnboarding(o.scope, o.ceklis), 0) / onboarding.length,
          )
        : null,
      rincian: onboarding.length
        ? `rata-rata dari ${onboarding.length} karyawan baru`
        : "belum ada karyawan yang di-onboarding",
    },
    {
      key: "turnover",
      // Pembaginya jumlah karyawan yang PERNAH tercatat, bukan yang tersisa —
      // memakai yang tersisa membuat outlet yang banyak ditinggalkan justru
      // terlihat punya turnover paling rendah.
      realisasi: kontrak.length > 0 ? Math.round((keluar.length / kontrak.length) * 100) : null,
      rincian:
        kontrak.length > 0
          ? `${keluar.length} keluar dari ${kontrak.length} karyawan tercatat`
          : "belum ada data karyawan outlet",
    },
  ];

  const dinilai = latihan.filter((r) => r.post_test !== null && r.post_test !== undefined);
  const kelulusanFastStart = dinilai.length
    ? { lulus: dinilai.filter((r) => lulus(Number(r.post_test))).length, dinilai: dinilai.length }
    : null;

  return { periode, baris, kelulusanFastStart };
}
