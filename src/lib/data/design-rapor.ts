import "server-only";

import { listHcRequests } from "./hc-requests";
import { TENGGAT, lewatTenggat, nilaiTenggat } from "@/lib/kpi/deadline";
import { merekOutlet } from "@/lib/kpi/merek";

/**
 * Rekap Antrian Design — ringkasan papan dan rapot pihak yang meminta.
 *
 * DUA PIHAK DINILAI DARI DATA YANG SAMA. Tim Creative dinilai atas ketepatan
 * waktunya; yang meminta dinilai atas kelonggaran yang ia sisakan. Menghitung
 * keduanya dari satu sumber membuat keduanya mustahil berbeda — kalau dihitung
 * terpisah, dua halaman akan menyebut jumlah permintaan yang berbeda dan tidak
 * ada yang tahu mana yang benar.
 */

export interface RingkasDesign {
  request: number;
  menunggu: number;
  dikerjakan: number;
  selesai: number;
  lewatDeadline: number;
}

export interface BarisRaporPeminta {
  id: string;
  nama: string;
  divisi: string;
  jabatan: string;
  total: number;
  /** Jumlah permintaan per kategori tenggat, urut sesuai `TENGGAT`. */
  perKategori: number[];
  /** Bagian permintaan mendesak (H-3 dan H-1) terhadap totalnya, 0–100. */
  persenMendesak: number;
  rapor: { label: string; tone: "success" | "warning" | "danger" };
}

export interface BarisKerjaCreative {
  nama: string;
  selesai: number;
  dikerjakan: number;
  lewatDeadline: number;
}

export interface PapanDesign {
  ringkas: RingkasDesign;
  peminta: BarisRaporPeminta[];
  creative: BarisKerjaCreative[];
  /** Permintaan per brand — dari mana bebannya datang. */
  sebaranBrand: BarisSebaran[];
  /** Permintaan per jenis materi — berbentuk apa bebannya. */
  sebaranJenis: BarisSebaran[];
}

/** Status yang berarti permintaannya sudah rampung. */
const SELESAI = new Set(["terlaksana"]);
/** Status yang berarti permintaannya sudah mati — tidak dihitung apa pun. */
const BATAL = new Set(["ditolak_hc", "ditolak_finance"]);

/**
 * Rapor pihak peminta.
 *
 * Yang dinilai BUKAN banyaknya permintaan — meminta banyak desain bukan
 * kesalahan — melainkan seberapa sering ia menyisakan waktu terlalu sempit.
 * Ambangnya di bagian permintaan mendesak, bukan jumlahnya, supaya yang
 * meminta dua kali sebulan dan yang meminta tiga puluh kali diukur dengan
 * ukuran yang sama.
 */
function raporPeminta(persenMendesak: number, total: number): BarisRaporPeminta["rapor"] {
  if (total === 0) return { label: "Belum ada request", tone: "success" };
  if (persenMendesak >= 60) return { label: "Perlu dievaluasi", tone: "danger" };
  if (persenMendesak >= 30) return { label: "Perlu diperhatikan", tone: "warning" };
  return { label: "Baik", tone: "success" };
}

/** Papan Antrian Design untuk satu bulan, "YYYY-MM"; kosong = seluruh riwayat. */
/** Satu baris sebaran: berapa permintaan, berapa yang lewat tenggat. */
export interface BarisSebaran {
  label: string;
  total: number;
  lewatDeadline: number;
}

export async function papanDesign(periode?: string): Promise<PapanDesign> {
  const semua = await listHcRequests({ kind: "design" });
  const hariIni = new Date().toISOString().slice(0, 10);
  const baris = semua.filter((r) => !BATAL.has(r.status) && (!periode || r.createdAt.slice(0, 7) === periode));

  const ringkas: RingkasDesign = {
    request: baris.length,
    menunggu: baris.filter((r) => !SELESAI.has(r.status) && !r.assigneeId).length,
    dikerjakan: baris.filter((r) => !SELESAI.has(r.status) && !!r.assigneeId).length,
    selesai: baris.filter((r) => SELESAI.has(r.status)).length,
    lewatDeadline: baris.filter((r) =>
      lewatTenggat({ tenggat: r.deadline, selesaiPada: SELESAI.has(r.status) ? r.completedAt : null, hariIni }),
    ).length,
  };

  /**
   * Sebaran permintaan per brand dan per jenis materi.
   *
   * Ringkasan lima kartu menjawab "berapa banyak"; ini menjawab "dari mana dan
   * berbentuk apa" — dan itu yang menentukan siapa yang perlu ditambah orangnya
   * atau materi mana yang layak dibuatkan templat. Kolom lewat tenggat ikut
   * dibawa karena beban dan keterlambatan tidak selalu menumpuk di tempat yang
   * sama: brand paling ramai belum tentu brand yang paling sering telat.
   */
  const sebar = (kunci: (r: (typeof baris)[number]) => string): BarisSebaran[] => {
    const peta = new Map<string, BarisSebaran>();
    for (const r of baris) {
      const label = kunci(r) || "Tanpa keterangan";
      const b = peta.get(label) ?? { label, total: 0, lewatDeadline: 0 };
      b.total += 1;
      if (lewatTenggat({ tenggat: r.deadline, selesaiPada: SELESAI.has(r.status) ? r.completedAt : null, hariIni })) {
        b.lewatDeadline += 1;
      }
      peta.set(label, b);
    }
    return [...peta.values()].sort((a, b) => b.total - a.total);
  };
  const sebaranBrand = sebar((r) => merekOutlet(r.subjectName ?? "")?.label ?? merekOutlet(r.title ?? "")?.label ?? "Tanpa brand");
  const sebaranJenis = sebar((r) => r.designType ?? "");

  const peminta = new Map<string, BarisRaporPeminta>();
  for (const r of baris) {
    const kunci = r.requesterId || r.requesterName;
    const p =
      peminta.get(kunci) ??
      ({
        id: kunci,
        nama: r.requesterName,
        divisi: r.outletName ?? r.department ?? "—",
        jabatan: "—",
        total: 0,
        perKategori: TENGGAT.map(() => 0),
        persenMendesak: 0,
        rapor: { label: "Baik", tone: "success" },
      } satisfies BarisRaporPeminta);
    p.total += 1;
    const i = TENGGAT.findIndex((t) => t.kategori === r.deadlineKategori);
    if (i >= 0) p.perKategori[i] += 1;
    peminta.set(kunci, p);
  }
  for (const p of peminta.values()) {
    // Mendesak = dua kategori terakhir, yang memang dipilih saat waktunya
    // tinggal sedikit. Permintaan tanpa kategori tidak dihitung mendesak:
    // ia diajukan sebelum aturan tenggat ada, dan menghukumnya surut akan
    // menuduh orang atas sesuatu yang belum pernah diminta darinya.
    const mendesak = p.perKategori[2] + p.perKategori[3];
    p.persenMendesak = p.total > 0 ? (mendesak / p.total) * 100 : 0;
    p.rapor = raporPeminta(p.persenMendesak, p.total);
  }

  const creative = new Map<string, BarisKerjaCreative>();
  for (const r of baris) {
    if (!r.assigneeName) continue;
    const c = creative.get(r.assigneeName) ?? { nama: r.assigneeName, selesai: 0, dikerjakan: 0, lewatDeadline: 0 };
    if (SELESAI.has(r.status)) c.selesai += 1;
    else c.dikerjakan += 1;
    if (lewatTenggat({ tenggat: r.deadline, selesaiPada: SELESAI.has(r.status) ? r.completedAt : null, hariIni })) {
      c.lewatDeadline += 1;
    }
    creative.set(r.assigneeName, c);
  }

  return {
    ringkas,
    peminta: [...peminta.values()].sort((a, b) => b.persenMendesak - a.persenMendesak || b.total - a.total),
    creative: [...creative.values()].sort((a, b) => b.selesai - a.selesai),
    sebaranBrand,
    sebaranJenis,
  };
}

/**
 * Nilai ketepatan waktu tim Creative pada satu bulan.
 *
 * Dipakai indikator KPI Content Creator. Yang dihitung permintaan yang SUDAH
 * punya jawabannya — selesai, atau lewat tenggat — sedangkan yang masih
 * berjalan dilewati supaya skornya tidak naik-turun sendiri sepanjang bulan.
 */
export async function nilaiKetepatanDesign(periode: string, pic?: string): Promise<{ nilai: number; dinilai: number } | null> {
  const semua = await listHcRequests({ kind: "design" });
  const hariIni = new Date().toISOString().slice(0, 10);
  let nilai = 0;
  let dinilai = 0;
  for (const r of semua) {
    if (BATAL.has(r.status)) continue;
    if (r.createdAt.slice(0, 7) !== periode) continue;
    if (pic && r.assigneeName !== pic) continue;
    const n = nilaiTenggat({
      kategori: r.deadlineKategori,
      tenggat: r.deadline,
      selesaiPada: SELESAI.has(r.status) ? r.completedAt : null,
      hariIni,
    });
    if (n === null) continue;
    nilai += n;
    dinilai += 1;
  }
  return dinilai === 0 ? null : { nilai, dinilai };
}
