"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Banknote,
  CalendarCheck,
  CalendarClock,
  ChartColumnBig,
  CircleCheck,
  ShieldCheck,
  TriangleAlert,
  UserMinus,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { StatTile } from "@/components/ui/stat";
import { RekamanBoard, type BarisRekaman } from "./rekaman";
import { GrafikDonat } from "./grafik";
import {
  ScopeTabs,
  kolomNama,
  n,
  opsiOutlet,
  opsiScope,
  t,
  type PilihanOutlet,
} from "./modul-boards";
import { SCOPE_LABEL, type HcScope } from "@/lib/hcmos/pillars";
import { brandOutlet } from "@/lib/hcmos/kontrak";
import { GOLONGAN_OUTLET } from "@/lib/hcmos/struktur";
import {
  JENIS_CUTI,
  STATUS_BPJS,
  STATUS_CUTI,
  fmtRupiah,
  lamaCuti,
  takeHomePay,
} from "@/lib/hcmos/lanjutan";
import {
  belumTerdaftarKeduanya,
  cutiAktif,
  masaKerja,
  periodeBulanLalu,
  persenKehadiran,
  programTerpenuhi,
  rekapBpjs,
  rekapPayroll,
  type BarisBpjs,
  type BarisCuti,
  type BarisPayroll,
  type KelompokPayroll,
} from "@/lib/hcmos/kompensasi";
import { formatDate } from "@/lib/utils";

/**
 * Compensation & Benefit — Attendance & Cuti, Payroll, BPJS & Benefit, dan
 * Struktur Kompensasi.
 *
 * Tiap tab dibuka dengan RINGKASAN, baru tabel isian di bawahnya. Urutannya
 * disengaja: yang dibawa orang saat membuka halaman ini adalah pertanyaan
 * ringkas — "hari ini berapa yang masuk", "gaji bulan lalu sudah beres belum",
 * "siapa yang belum punya BPJS". Menyodorkan tabel mentah lebih dulu memaksa
 * mereka menghitung sendiri sesuatu yang bisa dihitungkan.
 *
 * Scope Manajemen/Outlet di sini TIDAK punya pilihan "Semua". Gaji manajemen
 * dan gaji crew outlet berasal dari sumber berbeda dan diproses terpisah;
 * satu angka gabungan tidak menjawab pertanyaan siapa pun dan menyembunyikan
 * bahwa salah satunya mungkin belum selesai.
 */

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const STATUS_PROSES = {
  selesai: { label: "Selesai Diproses", tone: "success" as const },
  proses: { label: "Dalam Proses", tone: "warning" as const },
};

const HIJAU = "#10b981";
const MERAH = "#ef4444";

/** Judul tabel selalu menyebut scope-nya, supaya tangkapan layar tetap terbaca
 *  ketika tombol scope-nya tidak ikut terlihat. */
const berscope = (judul: string, scope: HcScope) => `${judul} — ${scope === "outlet" ? "Outlet" : "Manajemen"}`;

function Ringkas({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

/** Tabel ringkasan sederhana — bukan DataTable: tidak ada yang perlu dicari,
 *  disortir, atau dibuka di sini. Barisnya paling banyak segelintir. */
function TabelRingkas({
  judul,
  subjudul,
  kepala,
  baris,
  kosong,
  kaki,
}: {
  judul: string;
  subjudul?: string;
  kepala: string[];
  baris: React.ReactNode[][];
  kosong: string;
  kaki?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{judul}</CardTitle>
        {subjudul && <p className="text-[11px] text-muted-foreground">{subjudul}</p>}
      </CardHeader>
      <CardContent>
        {baris.length === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed border-border bg-muted/20 py-10 text-center text-xs text-muted-foreground">
            {kosong}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="border-b border-border">
                  {kepala.map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {baris.map((r, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    {r.map((c, j) => (
                      <td key={j} className="px-3 py-2.5 align-middle text-foreground">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {kaki && <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{kaki}</p>}
      </CardContent>
    </Card>
  );
}

const bacaCuti = (r: BarisRekaman): BarisCuti => ({
  nama: t(r, "nama"),
  divisi: t(r, "jabatan"),
  scope: t(r, "scope") || "manajemen",
  jenis: t(r, "jenis"),
  status: t(r, "status"),
  mulai: t(r, "tgl_mulai") || null,
  selesai: t(r, "tgl_selesai") || null,
});

const bacaPayroll = (r: BarisRekaman): BarisPayroll => ({
  nama: t(r, "nama"),
  scope: t(r, "scope") || "manajemen",
  periode: t(r, "periode"),
  sumber: t(r, "sumber"),
  outletName: r.outletName ?? null,
  status: t(r, "status"),
});

const bacaBpjs = (r: BarisRekaman): BarisBpjs => ({
  nama: t(r, "nama"),
  scope: t(r, "scope") || "manajemen",
  tk: t(r, "status_tk"),
  kes: t(r, "status_kes"),
  tglMasuk: t(r, "tgl_masuk") || null,
});

export function KompensasiBoard({
  cuti,
  payroll,
  benefit,
  program,
  golongan,
  outlets,
  jumlahKaryawan,
  hariIniIso,
  bolehUbah,
  tabAwal = "cuti",
}: {
  cuti: BarisRekaman[];
  payroll: BarisRekaman[];
  benefit: BarisRekaman[];
  program: BarisRekaman[];
  golongan: BarisRekaman[];
  outlets: PilihanOutlet[];
  /** Penyebut kehadiran per scope — datang dari User Management dan Kontrak
   *  Tracker, bukan dari tabel cuti. */
  jumlahKaryawan: Record<HcScope, number>;
  /** Tanggal server, bukan tanggal peramban: jam di perangkat orang bisa
   *  meleset dan angka kehadiran tidak boleh ikut meleset karenanya. */
  hariIniIso: string;
  bolehUbah: boolean;
  tabAwal?: string;
}) {
  const [tab, setTab] = React.useState(tabAwal);
  const [scope, setScope] = React.useState<HcScope>("manajemen");
  const rute = "/hc-mos/kompensasi";
  const hariIni = React.useMemo(() => new Date(`${hariIniIso}T00:00:00Z`), [hariIniIso]);

  const perScope = React.useCallback(
    (rows: BarisRekaman[]) => rows.filter((r) => (t(r, "scope") || "manajemen") === scope),
    [scope],
  );

  const cutiScope = React.useMemo(() => perScope(cuti), [perScope, cuti]);
  const payrollScope = React.useMemo(() => perScope(payroll), [perScope, payroll]);
  const benefitScope = React.useMemo(() => perScope(benefit), [perScope, benefit]);

  /* ── Attendance & Cuti ── */
  const sedangCuti = React.useMemo(
    () => cutiAktif(cutiScope.map(bacaCuti), hariIniIso),
    [cutiScope, hariIniIso],
  );
  const totalKaryawan = jumlahKaryawan[scope];

  /* ── Payroll ── */
  const periode = React.useMemo(() => periodeBulanLalu(hariIni), [hariIni]);
  const kelompokGaji: KelompokPayroll[] = React.useMemo(() => {
    const rows = payrollScope.map(bacaPayroll);
    return scope === "outlet"
      ? rekapPayroll(rows, periode, (r) => (r.outletName ? brandOutlet(r.outletName) ?? r.outletName : "Tanpa Brand"))
      : rekapPayroll(rows, periode, (r) => LABEL_SUMBER[r.sumber] ?? "Lainnya");
  }, [payrollScope, periode, scope]);
  const digaji = kelompokGaji.reduce((a, k) => a + k.jumlah, 0);

  /* ── BPJS ── */
  const barisBpjs = React.useMemo(() => benefitScope.map(bacaBpjs), [benefitScope]);
  const bpjs = React.useMemo(() => rekapBpjs(barisBpjs), [barisBpjs]);
  const belum = React.useMemo(() => belumTerdaftarKeduanya(barisBpjs), [barisBpjs]);
  const persen = (v: number) => (bpjs.total ? Math.round((v / bpjs.total) * 100) : 0);

  return (
    <div className="space-y-4">
      <SegmentedTabs
        className="max-w-2xl"
        value={tab}
        onChange={setTab}
        items={[
          { value: "cuti", label: "Attendance & Cuti", icon: CalendarCheck },
          { value: "payroll", label: "Payroll", icon: Banknote },
          { value: "bpjs", label: "BPJS & Benefit", icon: ShieldCheck },
          { value: "golongan", label: "Struktur", icon: ChartColumnBig },
        ]}
      />

      <ScopeTabs value={scope} onChange={(v) => setScope(v as HcScope)} semua={false} />

      {tab === "cuti" && (
        <>
          <Ringkas>
            <StatTile
              icon={CircleCheck}
              label="Kehadiran Hari Ini"
              value={`${persenKehadiran(totalKaryawan, sedangCuti.length)}%`}
              sub={`${HARI[hariIni.getUTCDay()]}, ${formatDate(hariIniIso)}`}
            />
            <StatTile
              icon={UserMinus}
              label="Cuti/Izin Aktif"
              value={sedangCuti.length}
              sub={sedangCuti.length ? sedangCuti.map((c) => c.nama).join(", ") : "tidak ada yang sedang cuti"}
            />
            <StatTile
              icon={UsersRound}
              label="Total Karyawan Terpantau"
              value={totalKaryawan}
              sub={SCOPE_LABEL[scope]}
            />
          </Ringkas>
          <TabelRingkas
            judul={berscope("Pengajuan Cuti & Izin", scope)}
            kepala={["Nama", "Divisi", "Jenis", "Tanggal", "Status"]}
            kosong="Belum ada pengajuan cuti atau izin untuk scope ini."
            baris={cutiScope.slice(0, 12).map((r) => {
              const jenis = JENIS_CUTI[t(r, "jenis") as keyof typeof JENIS_CUTI];
              const st = STATUS_CUTI[t(r, "status") as keyof typeof STATUS_CUTI];
              const a = t(r, "tgl_mulai");
              const b = t(r, "tgl_selesai");
              return [
                <span key="n" className="font-medium">{t(r, "nama") || "—"}</span>,
                <span key="d" className="text-muted-foreground">
                  {t(r, "jabatan") || r.outletName || "—"}
                </span>,
                jenis?.label ?? "—",
                <span key="t" className="text-muted-foreground">
                  {a ? `${formatDate(a)}${b && b !== a ? ` – ${formatDate(b)}` : ""}` : "—"}
                </span>,
                <Badge key="s" tone={st?.tone ?? "neutral"}>{st?.label ?? "—"}</Badge>,
              ];
            })}
          />
        </>
      )}

      {tab === "payroll" && (
        <>
          <Ringkas>
            <StatTile
              icon={UsersRound}
              label={scope === "outlet" ? "Crew Digaji Bulan Lalu" : "Karyawan Digaji Bulan Lalu"}
              value={digaji}
              sub={`periode ${periode}`}
            />
            <StatTile icon={CalendarClock} label="Jadwal Payroll Rutin" value="Tanggal 25" sub="setiap bulan" />
          </Ringkas>
          <TabelRingkas
            judul={berscope("Status Payroll", scope)}
            subjudul={`Periode ${periode}`}
            kepala={[scope === "outlet" ? "Brand" : "Sumber", "Jumlah Karyawan", "Status"]}
            kosong={`Belum ada baris payroll periode ${periode} untuk scope ini.`}
            baris={kelompokGaji.map((k) => [
              <span key="a" className="font-medium">{k.nama}</span>,
              <span key="b" className="tabular-nums">{k.jumlah}</span>,
              <Badge key="c" tone={STATUS_PROSES[k.status].tone}>{STATUS_PROSES[k.status].label}</Badge>,
            ])}
          />
        </>
      )}

      {tab === "bpjs" && (
        <>
          <Ringkas>
            <StatTile
              icon={ShieldCheck}
              label="BPJS Ketenagakerjaan (TK) Selesai"
              value={`${bpjs.tkSelesai}/${bpjs.total}`}
              sub={`${persen(bpjs.tkSelesai)}% dari karyawan tercatat`}
            />
            <StatTile
              icon={ShieldCheck}
              label="BPJS Kesehatan (KES) Selesai"
              value={`${bpjs.kesSelesai}/${bpjs.total}`}
              sub={`${persen(bpjs.kesSelesai)}% dari karyawan tercatat`}
            />
            <StatTile
              icon={CircleCheck}
              label="TK & KES Lengkap Keduanya"
              value={`${bpjs.keduanya}/${bpjs.total}`}
              sub="terlindungi penuh"
            />
            <StatTile
              icon={TriangleAlert}
              label="Belum Terdaftar Sama Sekali"
              value={`${bpjs.belumSamaSekali}/${bpjs.total}`}
              sub="prioritas tindak lanjut"
            />
          </Ringkas>

          <div className="grid gap-3 lg:grid-cols-2">
            <GrafikDonat
              judul="Status BPJS Ketenagakerjaan"
              subjudul={`Dari ${bpjs.total} karyawan tercatat`}
              pesanKosong="Belum ada karyawan tercatat untuk scope ini."
              data={[
                { nama: "Selesai", nilai: bpjs.tkSelesai, warna: HIJAU },
                { nama: "Belum Terdaftar", nilai: bpjs.total - bpjs.tkSelesai, warna: MERAH },
              ]}
            />
            <GrafikDonat
              judul="Status BPJS Kesehatan"
              subjudul={`Dari ${bpjs.total} karyawan tercatat`}
              pesanKosong="Belum ada karyawan tercatat untuk scope ini."
              data={[
                { nama: "Selesai", nilai: bpjs.kesSelesai, warna: HIJAU },
                { nama: "Belum Terdaftar", nilai: bpjs.total - bpjs.kesSelesai, warna: MERAH },
              ]}
            />
          </div>

          <TabelRingkas
            judul="Karyawan Belum Terdaftar BPJS Sama Sekali (TK & KES)"
            subjudul="Prioritas tindak lanjut Human Capital"
            kepala={["Nama", "Masa Kerja", "BPJS TK", "BPJS KES"]}
            kosong="Tidak ada — seluruh karyawan tercatat sudah terdaftar di salah satu program."
            kaki={
              bpjs.total > 0 && bpjs.total - bpjs.kesSelesai > bpjs.total - bpjs.tkSelesai
                ? `BPJS Kesehatan menjadi celah terbesar — ${bpjs.total - bpjs.kesSelesai} dari ${bpjs.total} karyawan tercatat (termasuk yang BPJS TK-nya sudah selesai) belum terdaftar BPJS Kesehatan.`
                : undefined
            }
            baris={belum.map((r) => [
              <span key="n" className="font-medium">{r.nama || "—"}</span>,
              <span key="m" className="text-muted-foreground">{masaKerja(r.tglMasuk, hariIni)}</span>,
              <Badge key="tk" tone="danger">Belum</Badge>,
              <Badge key="ks" tone="danger">Belum</Badge>,
            ])}
          />

          <TabelRingkas
            judul="Benefit Lainnya"
            subjudul="Program di luar BPJS"
            kepala={["Program", "Peserta Terdaftar", "Status"]}
            kosong="Belum ada program benefit yang dicatat."
            baris={program
              .filter((r) => (t(r, "scope") || "manajemen") === scope)
              .map((r) => {
                const p = {
                  program: t(r, "program"),
                  peserta: n(r, "peserta") ?? 0,
                  target: n(r, "target") ?? 0,
                };
                const ok = programTerpenuhi(p);
                return [
                  <span key="a" className="font-medium">{p.program || "—"}</span>,
                  <span key="b" className="tabular-nums">{p.peserta}/{p.target}</span>,
                  <Badge key="c" tone={ok ? "success" : "warning"}>{ok ? "Terpenuhi" : "Belum Terpenuhi"}</Badge>,
                ];
              })}
          />
        </>
      )}

      {/* Acuan golongan dibuka lebih dulu, tabel nominalnya menyusul. Yang
          ditanyakan orang saat membuka Struktur Kompensasi hampir selalu
          "golongan saya dapat tunjangan apa saja" — pertanyaan tentang
          kerangkanya, bukan tentang isi tabel. */}
      {tab === "golongan" && (
        <TabelRingkas
          judul="Kerangka Golongan Outlet"
          subjudul="Acuan komponen tunjangan — nominalnya diisi di tabel di bawah"
          kepala={["Golongan", "Jabatan", "Komponen Tunjangan"]}
          kosong="—"
          baris={GOLONGAN_OUTLET.map((g) => [
            <span key="g" className="font-medium">{g.golongan}</span>,
            g.jabatan,
            <span key="t" className="text-muted-foreground">{g.tunjangan}</span>,
          ])}
          kaki="Golongan di atas MENAMBAH komponen dari golongan di bawahnya, bukan menggantinya."
        />
      )}

      <PapanIsian
        tab={tab}
        rute={rute}
        scope={scope}
        cuti={cutiScope}
        payroll={payrollScope}
        benefit={benefitScope}
        program={program.filter((r) => (t(r, "scope") || "manajemen") === scope)}
        golongan={golongan.filter((r) => (t(r, "scope") || "manajemen") === scope)}
        outlets={outlets}
        bolehUbah={bolehUbah}
      />
    </div>
  );
}

/** Label sumber payroll manajemen. Disimpan sebagai kode di basis data supaya
 *  penulisan bebas ("office", "Office", "kantor") tidak memecah kelompoknya. */
const LABEL_SUMBER: Record<string, string> = { office: "Office", warehouse: "Warehouse" };

const opsiSumber = [
  { value: "office", label: "Office" },
  { value: "warehouse", label: "Warehouse" },
];

const opsiStatusProses = [
  { value: "proses", label: "Dalam Proses" },
  { value: "selesai", label: "Selesai Diproses" },
];

const opsiStatusBpjs = Object.entries(STATUS_BPJS).map(([v, m]) => ({ value: v, label: m.label }));

/** Status satu program BPJS, dengan awalan programnya — "TK Terdaftar" terbaca
 *  utuh, sedangkan dua lencana bertulisan "Terdaftar" berdampingan tidak. */
function LencanaBpjs({ awalan, nilai }: { awalan: string; nilai: string }) {
  const m = STATUS_BPJS[nilai as keyof typeof STATUS_BPJS];
  return (
    <Badge tone={m?.tone ?? "danger"}>
      {awalan} {m?.label ?? "Belum"}
    </Badge>
  );
}

/** Tabel isian di bawah ringkasan — bagian yang bisa ditambah dan disunting. */
function PapanIsian({
  tab,
  rute,
  scope,
  cuti,
  payroll,
  benefit,
  program,
  golongan,
  outlets,
  bolehUbah,
}: {
  tab: string;
  rute: string;
  scope: HcScope;
  cuti: BarisRekaman[];
  payroll: BarisRekaman[];
  benefit: BarisRekaman[];
  program: BarisRekaman[];
  golongan: BarisRekaman[];
  outlets: PilihanOutlet[];
  bolehUbah: boolean;
}) {
  if (tab === "cuti") {
    return (
      <RekamanBoard
        tabel="hc_leaves"
        rute={rute}
        tableId="hcmos-cuti"
        rows={cuti}
        bolehUbah={bolehUbah}
        labelTambah="Pengajuan"
        searchPlaceholder="Cari nama…"
        bawaan={{ scope, jenis: "cuti", status: "diajukan" }}
        columns={[
          ...kolomNama,
          {
            accessorKey: "jenis",
            header: "Jenis",
            cell: ({ row }) => {
              const m = JENIS_CUTI[t(row.original, "jenis") as keyof typeof JENIS_CUTI];
              return <Badge tone={m?.tone ?? "neutral"}>{m?.label ?? "—"}</Badge>;
            },
          },
          {
            id: "periode",
            header: "Tanggal",
            cell: ({ row }) => {
              const a = t(row.original, "tgl_mulai");
              const b = t(row.original, "tgl_selesai");
              return (
                <div className="min-w-0">
                  <p className="text-foreground">
                    {a ? formatDate(a) : "—"} – {b ? formatDate(b) : "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{lamaCuti(a || null, b || null)} hari</p>
                </div>
              );
            },
          },
          {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
              const m = STATUS_CUTI[t(row.original, "status") as keyof typeof STATUS_CUTI];
              return (
                <Badge tone={m?.tone ?? "neutral"} dot>
                  {m?.label ?? "—"}
                </Badge>
              );
            },
          },
        ]}
        bidang={[
          { key: "nama", label: "Nama Karyawan", tipe: "teks", wajib: true },
          { key: "scope", label: "Scope", tipe: "pilihan", opsi: opsiScope },
          { key: "outlet_id", label: "Outlet", tipe: "pilihan", opsi: opsiOutlet(outlets) },
          {
            key: "jenis",
            label: "Jenis",
            tipe: "pilihan",
            opsi: Object.entries(JENIS_CUTI).map(([v, m]) => ({ value: v, label: m.label })),
          },
          { key: "tgl_mulai", label: "Mulai", tipe: "tanggal", wajib: true },
          { key: "tgl_selesai", label: "Selesai", tipe: "tanggal", wajib: true },
          {
            key: "status",
            label: "Status",
            tipe: "pilihan",
            opsi: Object.entries(STATUS_CUTI).map(([v, m]) => ({ value: v, label: m.label })),
          },
          { key: "disetujui_oleh", label: "Disetujui Oleh", tipe: "teks" },
          { key: "alasan", label: "Alasan", tipe: "panjang", span: 3 },
        ]}
      />
    );
  }

  if (tab === "payroll") {
    return (
      <RekamanBoard
        tabel="hc_payroll"
        rute={rute}
        tableId="hcmos-payroll"
        rows={payroll}
        bolehUbah={bolehUbah}
        labelTambah="Baris Gaji"
        searchPlaceholder="Cari nama, periode…"
        bawaan={{ scope, sumber: scope === "outlet" ? "" : "office", status: "proses", gaji_pokok: 0, tunjangan: 0, lembur: 0, potongan: 0 }}
        columns={[
          ...kolomNama,
          { accessorKey: "periode", header: "Periode" },
          {
            id: "komponen",
            header: "Komponen",
            cell: ({ row }) => (
              <div className="min-w-0 text-[11px] text-muted-foreground">
                <p>Pokok {fmtRupiah(n(row.original, "gaji_pokok") ?? 0)}</p>
                <p>
                  Tunjangan {fmtRupiah(n(row.original, "tunjangan") ?? 0)} · Lembur{" "}
                  {fmtRupiah(n(row.original, "lembur") ?? 0)}
                </p>
              </div>
            ),
          },
          {
            id: "thp",
            header: "Take Home",
            cell: ({ row }) => (
              <div className="min-w-0">
                <p className="font-medium tabular-nums text-foreground">
                  {fmtRupiah(
                    takeHomePay({
                      gajiPokok: n(row.original, "gaji_pokok") ?? 0,
                      tunjangan: n(row.original, "tunjangan") ?? 0,
                      lembur: n(row.original, "lembur") ?? 0,
                      potongan: n(row.original, "potongan") ?? 0,
                    }),
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  potongan {fmtRupiah(n(row.original, "potongan") ?? 0)}
                </p>
              </div>
            ),
          },
          {
            accessorKey: "status",
            header: "Proses",
            cell: ({ row }) => {
              const m = STATUS_PROSES[t(row.original, "status") as keyof typeof STATUS_PROSES];
              return <Badge tone={m?.tone ?? "warning"} dot>{m?.label ?? "Dalam Proses"}</Badge>;
            },
          },
        ]}
        bidang={[
          { key: "periode", label: "Periode", tipe: "teks", hint: "Format 2026-08", wajib: true },
          { key: "nama", label: "Nama Karyawan", tipe: "teks", wajib: true },
          { key: "scope", label: "Scope", tipe: "pilihan", opsi: opsiScope },
          { key: "sumber", label: "Sumber", tipe: "pilihan", opsi: opsiSumber, hint: "Untuk manajemen" },
          { key: "outlet_id", label: "Outlet", tipe: "pilihan", opsi: opsiOutlet(outlets) },
          { key: "gaji_pokok", label: "Gaji Pokok", tipe: "angka" },
          { key: "tunjangan", label: "Tunjangan", tipe: "angka" },
          { key: "lembur", label: "Lembur", tipe: "angka" },
          { key: "potongan", label: "Potongan", tipe: "angka" },
          { key: "status", label: "Status Proses", tipe: "pilihan", opsi: opsiStatusProses },
          { key: "catatan", label: "Catatan", tipe: "panjang", span: 3 },
        ]}
      />
    );
  }

  if (tab === "bpjs") {
    return (
      <div className="space-y-4">
        <RekamanBoard
          tabel="hc_benefits"
          rute={rute}
          tableId="hcmos-bpjs"
          rows={benefit}
          bolehUbah={bolehUbah}
          labelTambah="Karyawan"
          searchPlaceholder="Cari nama…"
          bawaan={{ scope, status_tk: "belum", status_kes: "belum" }}
          columns={[
            ...kolomNama,
            {
              id: "nomor",
              header: "Nomor",
              cell: ({ row }) => (
                <div className="min-w-0 text-[11px] text-muted-foreground">
                  <p>Kesehatan: {t(row.original, "bpjs_kesehatan") || "—"}</p>
                  <p>Ketenagakerjaan: {t(row.original, "bpjs_tk") || "—"}</p>
                </div>
              ),
            },
            {
              id: "status",
              header: "TK / KES",
              cell: ({ row }) => (
                <div className="flex flex-wrap gap-1">
                  <LencanaBpjs awalan="TK" nilai={t(row.original, "status_tk")} />
                  <LencanaBpjs awalan="KES" nilai={t(row.original, "status_kes")} />
                </div>
              ),
            },
            {
              accessorKey: "tgl_masuk",
              header: "Masa Kerja",
              cell: ({ row }) => (
                <span className="text-muted-foreground">
                  {masaKerja(t(row.original, "tgl_masuk") || null, new Date())}
                </span>
              ),
            },
          ]}
          bidang={[
            { key: "nama", label: "Nama Karyawan", tipe: "teks", wajib: true },
            { key: "scope", label: "Scope", tipe: "pilihan", opsi: opsiScope },
            { key: "outlet_id", label: "Outlet", tipe: "pilihan", opsi: opsiOutlet(outlets) },
            { key: "bpjs_kesehatan", label: "No. BPJS Kesehatan", tipe: "teks" },
            { key: "bpjs_tk", label: "No. BPJS Ketenagakerjaan", tipe: "teks" },
            { key: "status_tk", label: "Status BPJS Ketenagakerjaan", tipe: "pilihan", opsi: opsiStatusBpjs },
            { key: "status_kes", label: "Status BPJS Kesehatan", tipe: "pilihan", opsi: opsiStatusBpjs },
            { key: "tgl_masuk", label: "Tanggal Masuk Kerja", tipe: "tanggal" },
            { key: "tgl_daftar", label: "Tanggal Daftar BPJS", tipe: "tanggal" },
            { key: "catatan", label: "Catatan", tipe: "panjang", span: 2 },
          ]}
        />
        <RekamanBoard
          tabel="hc_benefit_programs"
          rute={rute}
          tableId="hcmos-benefit-program"
          rows={program}
          bolehUbah={bolehUbah}
          labelTambah="Program"
          searchPlaceholder="Cari program…"
          bawaan={{ scope, peserta: 0, target: 0 }}
          columns={[
            {
              accessorKey: "program",
              header: "Program",
              cell: ({ row }) => (
                <span className="font-medium text-foreground">{t(row.original, "program") || "—"}</span>
              ),
            },
            {
              id: "peserta",
              header: "Peserta",
              cell: ({ row }) => (
                <span className="tabular-nums text-foreground">
                  {n(row.original, "peserta") ?? 0}/{n(row.original, "target") ?? 0}
                </span>
              ),
            },
            {
              accessorKey: "catatan",
              header: "Catatan",
              cell: ({ row }) => (
                <span className="text-muted-foreground">{t(row.original, "catatan") || "—"}</span>
              ),
            },
          ]}
          bidang={[
            { key: "program", label: "Nama Program", tipe: "teks", wajib: true },
            { key: "scope", label: "Scope", tipe: "pilihan", opsi: opsiScope },
            { key: "peserta", label: "Peserta Terdaftar", tipe: "angka" },
            { key: "target", label: "Sasaran Peserta", tipe: "angka" },
            { key: "catatan", label: "Catatan", tipe: "panjang", span: 3 },
          ]}
        />
      </div>
    );
  }

  return (
    <RekamanBoard
      tabel="hc_salary_grades"
      rute={rute}
      tableId="hcmos-golongan"
      rows={golongan}
      bolehUbah={bolehUbah}
      labelTambah="Golongan"
      searchPlaceholder="Cari golongan, jabatan…"
      bawaan={{ scope, gaji_min: 0, gaji_max: 0 }}
      columns={golonganColumns}
      bidang={[
        { key: "golongan", label: "Golongan", tipe: "teks", wajib: true },
        { key: "jabatan", label: "Jabatan", tipe: "teks" },
        { key: "scope", label: "Scope", tipe: "pilihan", opsi: opsiScope },
        { key: "gaji_min", label: "Gaji Minimum", tipe: "angka" },
        { key: "gaji_max", label: "Gaji Maksimum", tipe: "angka" },
        { key: "tunjangan", label: "Tunjangan", tipe: "teks", span: 2 },
      ]}
    />
  );
}

const golonganColumns: ColumnDef<BarisRekaman>[] = [
  {
    accessorKey: "golongan",
    header: "Golongan",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{t(row.original, "golongan")}</p>
        <p className="truncate text-[11px] text-muted-foreground">{t(row.original, "jabatan") || "—"}</p>
      </div>
    ),
  },
  {
    accessorKey: "scope",
    header: "Scope",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {SCOPE_LABEL[(t(row.original, "scope") as HcScope) || "manajemen"]}
      </span>
    ),
  },
  {
    id: "rentang",
    header: "Rentang Gaji",
    cell: ({ row }) => (
      <span className="tabular-nums text-foreground">
        {fmtRupiah(n(row.original, "gaji_min") ?? 0)} – {fmtRupiah(n(row.original, "gaji_max") ?? 0)}
      </span>
    ),
  },
  {
    accessorKey: "tunjangan",
    header: "Tunjangan",
    cell: ({ row }) => <span className="text-muted-foreground">{t(row.original, "tunjangan") || "—"}</span>,
  },
];
