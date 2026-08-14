import "server-only";

import { db, dbEnabled } from "./db";
import { listKontrak, outletsForUser, rekapOutlet } from "./hcmos";
import { listKandidat, listOnboarding } from "./hcmos-rekrutmen";
import { listDokumen } from "./hcmos-dokumen";
import { listTabel } from "./hcmos-lanjutan";
import { getUsers } from "./store";
import { STATUS_KONTRAK_META, bulanKeluar, periodeKey } from "@/lib/hcmos/kontrak";
import { STATUS_BERLAKU_META } from "@/lib/hcmos/dokumen";
import { JENIS_DOKUMEN_META } from "@/lib/hcmos/dokumen";
import {
  JENIS_CUTI,
  KESIAPAN,
  PROGRAM_FAST,
  lulus,
  predikatKinerja,
  skorKinerja,
  takeHomePay,
} from "@/lib/hcmos/lanjutan";
import { TAHAP_META } from "@/lib/hcmos/rekrutmen";
import { progresOnboarding } from "@/lib/hcmos/rekrutmen";
import type { UserProfile } from "@/lib/types";

/**
 * Dashboard Monitoring — sebelas tab metrik, sesuai Juknis Bab 4.9 & 7.3.
 *
 * Berkas HTML dari Human Capital memakai angka contoh yang ditulis langsung di
 * berkasnya (219 headcount, 18 hari time-to-hire, 2.1% turnover). Susunannya
 * dipertahankan persis — kartu angka, tabel, lalu grafik per tab — tapi seluruh
 * angkanya dihitung dari data nyata. Angka contoh yang terlihat meyakinkan
 * justru berbahaya: ia dipakai orang untuk mengambil keputusan tanpa sadar itu
 * karangan.
 *
 * Tab yang datanya memang belum ada akan tampil kosong beserta keterangannya,
 * bukan diisi angka pengganti.
 */

export interface Angka {
  label: string;
  nilai: string | number;
  catatan?: string;
}
export interface Titik {
  nama: string;
  nilai: number;
}
export interface BarisTabel {
  kolom: string[];
}

export interface TabMonitoring {
  key: string;
  label: string;
  ikon: string;
  angka: Angka[];
  tabelJudul?: string;
  tabelKepala?: string[];
  tabel?: BarisTabel[];
  grafik: {
    bentuk: "batang" | "garis" | "donat";
    judul: string;
    subjudul?: string;
    data: Titik[];
  }[];
  /** Ditampilkan bila seluruh angkanya nol — menjelaskan mengapa, bukan diam. */
  catatanKosong?: string;
}

const hitung = <T,>(xs: T[], kunci: (x: T) => string | null): Titik[] => {
  const m = new Map<string, number>();
  for (const x of xs) {
    const k = kunci(x);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([nama, nilai]) => ({ nama, nilai })).sort((a, b) => b.nilai - a.nilai);
};

/** Permintaan pegawai yang masih berjalan — dipakai tab Recruitment. */
async function permintaanBerjalan(): Promise<{ terbuka: number; total: number; baris: BarisTabel[] }> {
  if (!dbEnabled) return { terbuka: 0, total: 0, baris: [] };
  const { data, error } = await db()
    .from("hc_requests")
    .select("title,department,headcount,recruited,status")
    .eq("kind", "rekrutmen")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as {
    title: string | null;
    department: string | null;
    headcount: number | null;
    recruited: number | null;
    status: string | null;
  }[];
  const berjalan = rows.filter((r) => r.status !== "terlaksana" && r.status !== "ditolak_hc" && r.status !== "ditolak_finance");
  return {
    terbuka: berjalan.reduce((a, r) => a + Number(r.headcount ?? 0), 0),
    total: rows.length,
    baris: berjalan.slice(0, 10).map((r) => ({
      kolom: [r.title ?? "—", r.department ?? "—", String(r.headcount ?? 0), r.status ?? "—"],
    })),
  };
}

/** Ringkasan Self-Learning dari modul E-Learning yang sudah berjalan. */
async function selfLearning(): Promise<{ peserta: number; selesai: number; sertifikat: number }> {
  if (!dbEnabled) return { peserta: 0, selesai: 0, sertifikat: 0 };
  try {
    const [prog, sert] = await Promise.all([
      db().from("elearning_progress").select("user_id,completed"),
      db().from("elearning_certificates").select("user_id"),
    ]);
    const rows = (prog.data ?? []) as { user_id: string; completed: boolean | null }[];
    return {
      peserta: new Set(rows.map((r) => r.user_id)).size,
      selesai: rows.filter((r) => r.completed).length,
      sertifikat: (sert.data ?? []).length,
    };
  } catch {
    return { peserta: 0, selesai: 0, sertifikat: 0 };
  }
}

export async function monitoringHcmos(user: UserProfile, periode = periodeKey()): Promise<TabMonitoring[]> {
  const [
    kontrak,
    rekap,
    kandidat,
    onboarding,
    dokumen,
    cuti,
    payroll,
    latihan,
    kinerja,
    suksesi,
    karier,
    minta,
    belajar,
  ] = await Promise.all([
    listKontrak(user),
    rekapOutlet(user, periode),
    listKandidat(),
    listOnboarding(),
    listDokumen(),
    listTabel("hc_leaves"),
    listTabel("hc_payroll"),
    listTabel("hc_training_records"),
    listTabel("hc_reviews"),
    listTabel("hc_succession"),
    listTabel("hc_career_paths"),
    permintaanBerjalan(),
    selfLearning(),
  ]);

  const users = getUsers().filter((u) => u.active);
  const outlets = outletsForUser(user);
  const aktif = kontrak.filter((k) => !k.keluar);
  const keluar = kontrak.filter((k) => k.keluar);

  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

  /* ── 1. Headcount ── */
  const perDep = hitung(users, (u) => (u.department ?? "").trim() || "Tanpa Departemen");
  const perBrand = hitung(aktif, (k) => k.brand ?? "Tanpa Brand");

  /* ── 3. Turnover ── */
  const perBulanKeluar = hitung(keluar, (k) => bulanKeluar(k.tglResign));
  const perKategoriKeluar = hitung(keluar, (k) => (k.kategoriTurnover ?? "").trim() || "Tidak Dicatat");
  const turnoverPersen = kontrak.length ? Math.round((keluar.length / kontrak.length) * 1000) / 10 : 0;

  /* ── 5. Payroll ── */
  const thpPerPeriode = new Map<string, number>();
  for (const p of payroll) {
    const per = s(p.periode) || "—";
    const thp = takeHomePay({
      gajiPokok: n(p.gaji_pokok),
      tunjangan: n(p.tunjangan),
      lembur: n(p.lembur),
      potongan: n(p.potongan),
    });
    thpPerPeriode.set(per, (thpPerPeriode.get(per) ?? 0) + thp);
  }

  /* ── 6. Training ── */
  const dinilai = latihan.filter((r) => r.post_test !== null && r.post_test !== undefined);
  const jmlLulus = dinilai.filter((r) => lulus(n(r.post_test))).length;

  /* ── 7. Performance ── */
  const skorKinerjaSemua = kinerja.map((k) => skorKinerja((k.nilai as Record<string, number>) ?? {}));
  const rerataKinerja = skorKinerjaSemua.length
    ? Math.round(skorKinerjaSemua.reduce((a, b) => a + b, 0) / skorKinerjaSemua.length)
    : 0;
  const perPredikat = hitung(skorKinerjaSemua, (x) => predikatKinerja(x).label);

  /* ── 10. Contract Tracker ── */
  const perStatusKontrak = hitung(aktif, (k) => STATUS_KONTRAK_META[k.status].label);

  return [
    {
      key: "headcount",
      label: "Headcount",
      ikon: "Users",
      angka: [
        { label: "Total Headcount", nilai: users.length + aktif.length, catatan: `${users.length} manajemen · ${aktif.length} outlet` },
        { label: "Departemen", nilai: perDep.length, catatan: "di kantor pusat" },
        { label: "Outlet Beroperasi", nilai: outlets.length, catatan: "dalam lingkup Anda" },
        { label: "Brand", nilai: perBrand.length, catatan: "punya karyawan tercatat" },
      ],
      tabelJudul: "Headcount per Departemen (Manajemen)",
      tabelKepala: ["Departemen", "Jumlah"],
      tabel: perDep.map((d) => ({ kolom: [d.nama, String(d.nilai)] })),
      grafik: [
        { bentuk: "batang", judul: "Headcount per Departemen", subjudul: "Sumber: User Management", data: perDep.slice(0, 10) },
        { bentuk: "donat", judul: "Karyawan Outlet per Brand", subjudul: "Sumber: Kontrak Tracker", data: perBrand },
      ],
    },
    {
      key: "recruitment",
      label: "Recruitment",
      ikon: "UserPlus",
      angka: [
        { label: "Posisi Dibutuhkan", nilai: minta.terbuka, catatan: "dari permintaan berjalan" },
        { label: "Kandidat Berjalan", nilai: kandidat.filter((k) => !["diterima", "ditolak"].includes(k.tahap)).length },
        { label: "Diterima", nilai: kandidat.filter((k) => k.tahap === "diterima").length },
        { label: "Sedang Onboarding", nilai: onboarding.length },
      ],
      tabelJudul: "Permintaan Manpower Berjalan",
      tabelKepala: ["Permintaan", "Departemen", "Jumlah", "Status"],
      tabel: minta.baris,
      grafik: [
        {
          bentuk: "batang",
          judul: "Pipeline Rekrutmen",
          subjudul: "Jumlah kandidat per tahap seleksi",
          data: hitung(kandidat, (k) => TAHAP_META[k.tahap].label),
        },
        { bentuk: "donat", judul: "Sumber Kandidat", data: hitung(kandidat, (k) => (k.sumber ?? "").trim() || "Tidak Dicatat") },
      ],
      catatanKosong: "Belum ada kandidat maupun permintaan pegawai yang tercatat.",
    },
    {
      key: "turnover",
      label: "Turnover",
      ikon: "TrendingUp",
      angka: [
        { label: "Turnover Kumulatif", nilai: `${turnoverPersen}%`, catatan: `${keluar.length} dari ${kontrak.length} karyawan tercatat` },
        { label: "Karyawan Keluar", nilai: keluar.length },
        { label: "Masih Aktif", nilai: aktif.length },
        { label: "Kategori Tercatat", nilai: perKategoriKeluar.length },
      ],
      tabelJudul: "Turnover per Kategori",
      tabelKepala: ["Kategori", "Jumlah"],
      tabel: perKategoriKeluar.map((k) => ({ kolom: [k.nama, String(k.nilai)] })),
      grafik: [
        { bentuk: "garis", judul: "Tren Karyawan Keluar per Bulan", data: [...perBulanKeluar].reverse() },
        { bentuk: "donat", judul: "Turnover per Kategori", data: perKategoriKeluar },
      ],
      catatanKosong: "Belum ada karyawan keluar yang tercatat di Kontrak Tracker.",
    },
    {
      key: "attendance",
      label: "Attendance",
      ikon: "CalendarCheck",
      angka: [
        { label: "Pengajuan", nilai: cuti.length, catatan: "seluruh periode" },
        { label: "Disetujui", nilai: cuti.filter((c) => s(c.status) === "disetujui").length },
        { label: "Menunggu", nilai: cuti.filter((c) => s(c.status) === "diajukan").length },
        { label: "Alpa Tercatat", nilai: cuti.filter((c) => s(c.jenis) === "alpa").length },
      ],
      grafik: [
        {
          bentuk: "donat",
          judul: "Komposisi per Jenis",
          data: hitung(cuti, (c) => JENIS_CUTI[s(c.jenis) as keyof typeof JENIS_CUTI]?.label ?? "Lainnya"),
        },
        { bentuk: "batang", judul: "Pengajuan per Bulan", data: hitung(cuti, (c) => s(c.tgl_mulai).slice(0, 7) || null) },
      ],
      catatanKosong: "Belum ada pengajuan cuti atau izin yang dicatat.",
    },
    {
      key: "payroll",
      label: "Payroll",
      ikon: "Banknote",
      angka: [
        { label: "Baris Payroll", nilai: payroll.length },
        { label: "Periode Tercatat", nilai: thpPerPeriode.size },
        {
          label: "Total Take Home",
          nilai: "Rp" + Math.round([...thpPerPeriode.values()].reduce((a, b) => a + b, 0)).toLocaleString("id-ID"),
        },
        { label: "Karyawan Digaji", nilai: new Set(payroll.map((p) => s(p.nama))).size },
      ],
      grafik: [
        {
          bentuk: "batang",
          judul: "Total Take Home per Periode",
          subjudul: "Dihitung dari komponennya, bukan angka tersimpan",
          data: [...thpPerPeriode.entries()].map(([nama, nilai]) => ({ nama, nilai: Math.round(nilai) })).sort((a, b) => a.nama.localeCompare(b.nama)),
        },
        { bentuk: "donat", judul: "Sebaran per Scope", data: hitung(payroll, (p) => (s(p.scope) === "outlet" ? "Outlet" : "Manajemen")) },
      ],
      catatanKosong: "Belum ada baris payroll yang dimasukkan.",
    },
    {
      key: "training",
      label: "Training",
      ikon: "GraduationCap",
      angka: [
        { label: "Peserta", nilai: latihan.length, catatan: "Fast Start & Fast Track" },
        { label: "Sudah Dinilai", nilai: dinilai.length },
        { label: "Lulus", nilai: jmlLulus, catatan: dinilai.length ? `${Math.round((jmlLulus / dinilai.length) * 100)}% kelulusan` : undefined },
        { label: "Batch", nilai: new Set(latihan.map((r) => s(r.batch)).filter(Boolean)).size },
      ],
      grafik: [
        { bentuk: "batang", judul: "Peserta per Materi", data: hitung(latihan, (r) => s(r.materi) || null) },
        {
          bentuk: "donat",
          judul: "Sebaran Program",
          data: hitung(latihan, (r) => PROGRAM_FAST[s(r.program) as keyof typeof PROGRAM_FAST] ?? "Lainnya"),
        },
      ],
      catatanKosong: "Belum ada peserta Fast Start atau Fast Track yang dicatat.",
    },
    {
      key: "performance",
      label: "Performance",
      ikon: "Target",
      angka: [
        { label: "Penilaian", nilai: kinerja.length },
        { label: "Rerata Skor", nilai: rerataKinerja, catatan: "dari 100" },
        { label: "Sudah Ditinjau", nilai: kinerja.filter((k) => s(k.status) === "ditinjau").length },
        { label: "Masih Draf", nilai: kinerja.filter((k) => s(k.status) === "draf").length },
      ],
      grafik: [
        { bentuk: "donat", judul: "Sebaran Predikat", data: perPredikat },
        {
          bentuk: "batang",
          judul: "Jumlah Penilaian per Periode",
          data: hitung(kinerja, (k) => s(k.periode) || null),
        },
      ],
      catatanKosong: "Belum ada penilaian kinerja yang dibuat.",
    },
    {
      key: "talent",
      label: "Talent",
      ikon: "Award",
      angka: [
        { label: "Posisi Kunci", nilai: suksesi.length },
        { label: "Penerus Siap", nilai: suksesi.filter((x) => s(x.kesiapan) === "siap_sekarang").length },
        { label: "Jenjang Jabatan", nilai: karier.length },
        { label: "Kompetensi Dipetakan", nilai: 0, catatan: "lihat tab Kinerja & Kompetensi" },
      ],
      grafik: [
        {
          bentuk: "donat",
          judul: "Kesiapan Penerus",
          data: hitung(suksesi, (x) => KESIAPAN[s(x.kesiapan) as keyof typeof KESIAPAN]?.label ?? "Lainnya"),
        },
        { bentuk: "batang", judul: "Jenjang per Level", data: hitung(karier, (x) => `Level ${s(x.level) || "?"}`) },
      ],
      catatanKosong: "Belum ada rencana suksesi maupun jenjang karier yang disusun.",
    },
    {
      key: "dokumen",
      label: "Dokumen",
      ikon: "FileText",
      angka: [
        { label: "Total Dokumen", nilai: dokumen.length },
        { label: "Aktif", nilai: dokumen.filter((d) => d.status === "aktif").length },
        { label: "PKS Kemitraan", nilai: dokumen.filter((d) => d.jenis === "pks").length },
        {
          label: "Segera Habis",
          nilai: dokumen.filter((d) => d.masaBerlaku === "segera_habis").length,
          catatan: "≤ 90 hari lagi",
        },
      ],
      tabelJudul: "Dokumen dengan Masa Berlaku",
      tabelKepala: ["Judul", "Pihak", "Berlaku Sampai", "Status"],
      tabel: dokumen
        .filter((d) => d.berlakuSampai)
        .map((d) => ({
          kolom: [d.judul, d.pihak ?? "—", d.berlakuSampai ?? "—", STATUS_BERLAKU_META[d.masaBerlaku].label],
        })),
      grafik: [
        { bentuk: "donat", judul: "Dokumen per Jenis", data: hitung(dokumen, (d) => JENIS_DOKUMEN_META[d.jenis].label) },
        { bentuk: "batang", judul: "Dokumen per Pilar", data: hitung(dokumen, (d) => d.pilar ?? "Lintas Pilar") },
      ],
      catatanKosong: "Belum ada dokumen yang dimasukkan ke Pusat Dokumen.",
    },
    {
      key: "kontrak",
      label: "Contract Tracker",
      ikon: "FileSignature",
      angka: [
        { label: "Karyawan Outlet", nilai: aktif.length },
        { label: "Segera Berakhir", nilai: aktif.filter((k) => k.status === "segera_berakhir").length, catatan: "≤ 60 hari" },
        { label: "Berakhir", nilai: aktif.filter((k) => k.status === "berakhir").length },
        {
          label: "Kepatuhan Lapor",
          nilai: `${rekap.length ? Math.round((rekap.filter((o) => o.sudahLapor).length / rekap.length) * 100) : 0}%`,
          catatan: `${rekap.filter((o) => o.sudahLapor).length} dari ${rekap.length} outlet`,
        },
      ],
      tabelJudul: "Outlet dengan Kontrak Perlu Tindakan",
      tabelKepala: ["Outlet", "Segera Berakhir", "Berakhir", "Tanpa Kontrak"],
      tabel: rekap
        .filter((o) => o.segera + o.berakhir + o.belumAdaKontrak > 0)
        .map((o) => ({ kolom: [o.name, String(o.segera), String(o.berakhir), String(o.belumAdaKontrak)] })),
      grafik: [
        { bentuk: "donat", judul: "Status Kontrak", data: perStatusKontrak },
        {
          bentuk: "batang",
          judul: "Karyawan per Outlet",
          data: rekap.filter((o) => o.aktif > 0).map((o) => ({ nama: o.name, nilai: o.aktif })).slice(0, 12),
        },
      ],
      catatanKosong: "Belum ada data karyawan outlet di Kontrak Tracker.",
    },
    {
      key: "self-learning",
      label: "Self-Learning",
      ikon: "MonitorPlay",
      angka: [
        { label: "Peserta E-Learning", nilai: belajar.peserta },
        { label: "Materi Diselesaikan", nilai: belajar.selesai },
        { label: "Sertifikat Terbit", nilai: belajar.sertifikat },
        {
          label: "Rerata Onboarding",
          nilai: onboarding.length
            ? `${Math.round(onboarding.reduce((a, o) => a + progresOnboarding(o.scope, o.ceklis), 0) / onboarding.length)}%`
            : "—",
          catatan: "ceklis orientasi karyawan baru",
        },
      ],
      grafik: [
        {
          bentuk: "batang",
          judul: "Progres Onboarding per Karyawan",
          subjudul: "Persentase butir ceklis yang tuntas",
          data: onboarding.map((o) => ({ nama: o.nama, nilai: progresOnboarding(o.scope, o.ceklis) })),
        },
      ],
      catatanKosong: "Belum ada aktivitas belajar mandiri maupun onboarding yang tercatat.",
    },
  ];
}
