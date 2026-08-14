"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import {
  AlertCircle,
  Award,
  Building2,
  Banknote,
  CalendarCheck,
  ChartColumnBig,
  ClipboardCheck,
  GitBranch,
  LogOut,
  Rocket,
  ShieldCheck,
  Store,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { StatTile } from "@/components/ui/stat";
import { RekamanBoard, type BarisRekaman, type Bidang } from "./rekaman";
import { SCOPE_LABEL, type HcScope } from "@/lib/hcmos/pillars";
import {
  JENIS_CUTI,
  KATEGORI_KASUS,
  KATEGORI_KELUAR,
  DURASI_POST_TEST_MENIT,
  KESIAPAN,
  LEVEL_LABEL,
  MATERI_FAST_TRACK,
  NILAI_LULUS,
  PROGRAM_FAST,
  STATUS_BPJS,
  STATUS_CUTI,
  STATUS_PERKARA,
  fmtRupiah,
  lamaCuti,
  lulus,
  peningkatan,
  senjangKompetensi,
  takeHomePay,
} from "@/lib/hcmos/lanjutan";
import { formatDate } from "@/lib/utils";

/** Ambil nilai kolom sebagai teks tanpa memaksa tipe di setiap pemakaian. */
const t = (r: BarisRekaman, k: string) => (r[k] === null || r[k] === undefined ? "" : String(r[k]));
const n = (r: BarisRekaman, k: string) => (r[k] === null || r[k] === undefined ? null : Number(r[k]));

const opsiScope = [
  { value: "manajemen", label: SCOPE_LABEL.manajemen },
  { value: "outlet", label: SCOPE_LABEL.outlet },
];

export interface PilihanOutlet {
  id: string;
  name: string;
}
const opsiOutlet = (outlets: PilihanOutlet[]) => [
  { value: "", label: "—" },
  ...outlets.map((o) => ({ value: o.id, label: o.name })),
];

/**
 * Tombol scope Manajemen (GWG) / Outlet di dalam halaman — Juknis Bab 2.2.
 *
 * Bentuknya sama di setiap modul supaya letaknya bisa ditebak: satu baris tepat
 * di atas tab isi, tidak pernah di dalam tabel atau di dalam formulir.
 */
function ScopeTabs({
  value,
  onChange,
}: {
  value: HcScope | "semua";
  onChange: (v: HcScope | "semua") => void;
}) {
  return (
    <SegmentedTabs
      className="max-w-md"
      size="sm"
      value={value}
      onChange={(v) => onChange(v as HcScope | "semua")}
      items={[
        { value: "semua", label: "Semua" },
        { value: "manajemen", label: SCOPE_LABEL.manajemen, icon: Building2 },
        { value: "outlet", label: SCOPE_LABEL.outlet, icon: Store },
      ]}
    />
  );
}

const kolomNama: ColumnDef<BarisRekaman>[] = [
  {
    accessorKey: "nama",
    header: "Nama",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{t(row.original, "nama")}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {t(row.original, "jabatan") || SCOPE_LABEL[(t(row.original, "scope") as "manajemen" | "outlet") || "manajemen"]}
          {row.original.outletName ? ` · ${row.original.outletName}` : ""}
        </p>
      </div>
    ),
  },
];

/* ═════════════════════════ Compensation & Benefit ═════════════════════════ */

export function KompensasiBoard({
  cuti,
  payroll,
  benefit,
  golongan,
  outlets,
  bolehUbah,
  tabAwal = "cuti",
}: {
  cuti: BarisRekaman[];
  payroll: BarisRekaman[];
  benefit: BarisRekaman[];
  golongan: BarisRekaman[];
  outlets: PilihanOutlet[];
  bolehUbah: boolean;
  tabAwal?: string;
}) {
  const [tab, setTab] = React.useState(tabAwal);
  const [scope, setScope] = React.useState<HcScope | "semua">("semua");
  const rute = "/hc-mos/kompensasi";

  // Scope tab memindahkan tampilan di dalam halaman, bukan pindah menu —
  // Juknis Bab 2.2. "Semua" dipertahankan sebagai pilihan karena sebagian
  // pertanyaan memang lintas scope ("berapa total gaji bulan ini").
  const perScope = React.useCallback(
    (rows: BarisRekaman[]) => (scope === "semua" ? rows : rows.filter((r) => t(r, "scope") === scope)),
    [scope],
  );

  const totalThp = payroll.reduce(
    (a, p) =>
      a +
      takeHomePay({
        gajiPokok: n(p, "gaji_pokok") ?? 0,
        tunjangan: n(p, "tunjangan") ?? 0,
        lembur: n(p, "lembur") ?? 0,
        potongan: n(p, "potongan") ?? 0,
      }),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={CalendarCheck} label="Pengajuan Cuti" value={cuti.length} sub="seluruh periode" />
        <StatTile icon={Banknote} label="Baris Payroll" value={payroll.length} sub={fmtRupiah(totalThp)} />
        <StatTile
          icon={ShieldCheck}
          label="BPJS Terdaftar"
          value={benefit.filter((b) => t(b, "status") === "terdaftar").length}
          sub={`dari ${benefit.length} karyawan`}
        />
        <StatTile icon={ChartColumnBig} label="Golongan" value={golongan.length} sub="struktur kompensasi" />
      </div>

      <ScopeTabs value={scope} onChange={setScope} />

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

      {tab === "cuti" && (
        <RekamanBoard
          tabel="hc_leaves"
          rute={rute}
          tableId="hcmos-cuti"
          rows={perScope(cuti)}
          bolehUbah={bolehUbah}
          labelTambah="Pengajuan"
          searchPlaceholder="Cari nama…"
          bawaan={{ scope: "manajemen", jenis: "cuti", status: "diajukan" }}
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
                const hari = lamaCuti(a || null, b || null);
                return (
                  <div className="min-w-0">
                    <p className="text-foreground">
                      {a ? formatDate(a) : "—"} – {b ? formatDate(b) : "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{hari} hari</p>
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
      )}

      {tab === "payroll" && (
        <RekamanBoard
          tabel="hc_payroll"
          rute={rute}
          tableId="hcmos-payroll"
          rows={perScope(payroll)}
          bolehUbah={bolehUbah}
          labelTambah="Baris Gaji"
          searchPlaceholder="Cari nama, periode…"
          bawaan={{ scope: "manajemen", gaji_pokok: 0, tunjangan: 0, lembur: 0, potongan: 0 }}
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
          ]}
          bidang={[
            { key: "periode", label: "Periode", tipe: "teks", hint: "Format 2026-08", wajib: true },
            { key: "nama", label: "Nama Karyawan", tipe: "teks", wajib: true },
            { key: "scope", label: "Scope", tipe: "pilihan", opsi: opsiScope },
            { key: "outlet_id", label: "Outlet", tipe: "pilihan", opsi: opsiOutlet(outlets) },
            { key: "gaji_pokok", label: "Gaji Pokok", tipe: "angka" },
            { key: "tunjangan", label: "Tunjangan", tipe: "angka" },
            { key: "lembur", label: "Lembur", tipe: "angka" },
            { key: "potongan", label: "Potongan", tipe: "angka" },
            { key: "catatan", label: "Catatan", tipe: "panjang", span: 3 },
          ]}
        />
      )}

      {tab === "bpjs" && (
        <RekamanBoard
          tabel="hc_benefits"
          rute={rute}
          tableId="hcmos-bpjs"
          rows={perScope(benefit)}
          bolehUbah={bolehUbah}
          labelTambah="Karyawan"
          searchPlaceholder="Cari nama…"
          bawaan={{ scope: "manajemen", status: "terdaftar" }}
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
              accessorKey: "status",
              header: "Status",
              cell: ({ row }) => {
                const m = STATUS_BPJS[t(row.original, "status") as keyof typeof STATUS_BPJS];
                return (
                  <Badge tone={m?.tone ?? "neutral"} dot>
                    {m?.label ?? "—"}
                  </Badge>
                );
              },
            },
            {
              accessorKey: "tgl_daftar",
              header: "Terdaftar",
              cell: ({ row }) => {
                const v = t(row.original, "tgl_daftar");
                return <span className="text-muted-foreground">{v ? formatDate(v) : "—"}</span>;
              },
            },
          ]}
          bidang={[
            { key: "nama", label: "Nama Karyawan", tipe: "teks", wajib: true },
            { key: "scope", label: "Scope", tipe: "pilihan", opsi: opsiScope },
            { key: "outlet_id", label: "Outlet", tipe: "pilihan", opsi: opsiOutlet(outlets) },
            { key: "bpjs_kesehatan", label: "No. BPJS Kesehatan", tipe: "teks" },
            { key: "bpjs_tk", label: "No. BPJS Ketenagakerjaan", tipe: "teks" },
            {
              key: "status",
              label: "Status",
              tipe: "pilihan",
              opsi: Object.entries(STATUS_BPJS).map(([v, m]) => ({ value: v, label: m.label })),
            },
            { key: "tgl_daftar", label: "Tanggal Daftar", tipe: "tanggal" },
            { key: "catatan", label: "Catatan", tipe: "panjang", span: 2 },
          ]}
        />
      )}

      {tab === "golongan" && (
        <RekamanBoard
          tabel="hc_salary_grades"
          rute={rute}
          tableId="hcmos-golongan"
          rows={perScope(golongan)}
          bolehUbah={bolehUbah}
          labelTambah="Golongan"
          searchPlaceholder="Cari golongan, jabatan…"
          bawaan={{ scope: "manajemen", gaji_min: 0, gaji_max: 0 }}
          columns={[
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
                  {SCOPE_LABEL[(t(row.original, "scope") as "manajemen" | "outlet") || "manajemen"]}
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
          ]}
          bidang={[
            { key: "golongan", label: "Golongan", tipe: "teks", wajib: true },
            { key: "jabatan", label: "Jabatan", tipe: "teks" },
            { key: "scope", label: "Scope", tipe: "pilihan", opsi: opsiScope },
            { key: "gaji_min", label: "Gaji Minimum", tipe: "angka" },
            { key: "gaji_max", label: "Gaji Maksimum", tipe: "angka" },
            { key: "tunjangan", label: "Tunjangan", tipe: "teks" },
          ]}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ Talent & Career Management ═══════════════════════ */

export function TalentBoard({
  karier,
  suksesi,
  bolehUbah,
  tabAwal = "karier",
}: {
  karier: BarisRekaman[];
  suksesi: BarisRekaman[];
  bolehUbah: boolean;
  tabAwal?: string;
}) {
  const [tab, setTab] = React.useState(tabAwal);
  const rute = "/hc-mos/talent";
  const siap = suksesi.filter((s) => t(s, "kesiapan") === "siap_sekarang").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile icon={GitBranch} label="Jenjang Jabatan" value={karier.length} sub="career path" />
        <StatTile icon={UsersRound} label="Posisi Kunci" value={suksesi.length} sub="dipetakan" />
        <StatTile icon={Award} label="Penerus Siap" value={siap} sub="siap sekarang" />
      </div>

      <SegmentedTabs
        className="max-w-md"
        value={tab}
        onChange={setTab}
        items={[
          { value: "karier", label: "Career Path", icon: GitBranch },
          { value: "suksesi", label: "Succession Plan", icon: UsersRound },
        ]}
      />

      {tab === "karier" && (
        <RekamanBoard
          tabel="hc_career_paths"
          rute={rute}
          tableId="hcmos-karier"
          rows={karier}
          bolehUbah={bolehUbah}
          labelTambah="Jenjang"
          searchPlaceholder="Cari jabatan…"
          bawaan={{ scope: "manajemen", level: 1 }}
          columns={[
            {
              accessorKey: "jabatan",
              header: "Jabatan",
              cell: ({ row }) => (
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{t(row.original, "jabatan")}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Level {t(row.original, "level")} ·{" "}
                    {SCOPE_LABEL[(t(row.original, "scope") as "manajemen" | "outlet") || "manajemen"]}
                  </p>
                </div>
              ),
            },
            {
              accessorKey: "jabatan_berikutnya",
              header: "Naik Ke",
              cell: ({ row }) => (
                <span className="text-foreground">{t(row.original, "jabatan_berikutnya") || "—"}</span>
              ),
            },
            {
              accessorKey: "masa_minimum_bulan",
              header: "Masa Minimum",
              cell: ({ row }) => {
                const v = n(row.original, "masa_minimum_bulan");
                return <span className="text-muted-foreground">{v ? `${v} bulan` : "—"}</span>;
              },
            },
            {
              accessorKey: "syarat",
              header: "Syarat",
              cell: ({ row }) => (
                <p className="max-w-xs truncate text-muted-foreground">{t(row.original, "syarat") || "—"}</p>
              ),
            },
          ]}
          bidang={[
            { key: "jabatan", label: "Jabatan", tipe: "teks", wajib: true },
            { key: "level", label: "Level", tipe: "angka" },
            { key: "scope", label: "Scope", tipe: "pilihan", opsi: opsiScope },
            { key: "jabatan_berikutnya", label: "Jabatan Berikutnya", tipe: "teks", span: 2 },
            { key: "masa_minimum_bulan", label: "Masa Minimum (bulan)", tipe: "angka" },
            { key: "syarat", label: "Syarat Kenaikan", tipe: "panjang", span: 3 },
          ]}
        />
      )}

      {tab === "suksesi" && (
        <RekamanBoard
          tabel="hc_succession"
          rute={rute}
          tableId="hcmos-suksesi"
          rows={suksesi}
          bolehUbah={bolehUbah}
          labelTambah="Posisi Kunci"
          searchPlaceholder="Cari posisi, kandidat…"
          bawaan={{ kesiapan: "perlu_dikembangkan" }}
          columns={[
            {
              accessorKey: "posisi",
              header: "Posisi Kunci",
              cell: ({ row }) => (
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{t(row.original, "posisi")}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Pemegang: {t(row.original, "pemegang") || "—"}
                  </p>
                </div>
              ),
            },
            {
              accessorKey: "kandidat",
              header: "Calon Penerus",
              cell: ({ row }) => <span className="text-foreground">{t(row.original, "kandidat") || "—"}</span>,
            },
            {
              accessorKey: "kesiapan",
              header: "Kesiapan",
              cell: ({ row }) => {
                const m = KESIAPAN[t(row.original, "kesiapan") as keyof typeof KESIAPAN];
                return (
                  <Badge tone={m?.tone ?? "neutral"} dot>
                    {m?.label ?? "—"}
                  </Badge>
                );
              },
            },
            {
              accessorKey: "catatan",
              header: "Catatan",
              cell: ({ row }) => (
                <p className="max-w-xs truncate text-muted-foreground">{t(row.original, "catatan") || "—"}</p>
              ),
            },
          ]}
          bidang={[
            { key: "posisi", label: "Posisi Kunci", tipe: "teks", wajib: true },
            { key: "pemegang", label: "Pemegang Saat Ini", tipe: "teks" },
            { key: "kandidat", label: "Calon Penerus", tipe: "teks" },
            {
              key: "kesiapan",
              label: "Kesiapan",
              tipe: "pilihan",
              opsi: Object.entries(KESIAPAN).map(([v, m]) => ({ value: v, label: m.label })),
            },
            { key: "catatan", label: "Rencana Pengembangan", tipe: "panjang", span: 3 },
          ]}
        />
      )}
    </div>
  );
}

/* ═════════════════════ Employee & Industrial Relations ═════════════════════ */

export function RelasiBoard({
  kasus,
  keluar,
  outlets,
  bolehUbah,
  tabAwal = "kasus",
}: {
  kasus: BarisRekaman[];
  keluar: BarisRekaman[];
  outlets: PilihanOutlet[];
  bolehUbah: boolean;
  tabAwal?: string;
}) {
  const [tab, setTab] = React.useState(tabAwal);
  const [scope, setScope] = React.useState<HcScope | "semua">("semua");
  const rute = "/hc-mos/relasi";
  const terbuka = kasus.filter((k) => t(k, "status") !== "selesai").length;

  const perScope = React.useCallback(
    (rows: BarisRekaman[]) => (scope === "semua" ? rows : rows.filter((r) => t(r, "scope") === scope)),
    [scope],
  );

  const kolomPerkara = (kategoriHeader: string): ColumnDef<BarisRekaman>[] => [
    ...kolomNama,
    { accessorKey: "kategori", header: kategoriHeader },
    {
      accessorKey: "tanggal",
      header: "Tanggal",
      cell: ({ row }) => {
        const v = t(row.original, "tanggal");
        return <span className="text-muted-foreground">{v ? formatDate(v) : "—"}</span>;
      },
    },
    {
      accessorKey: "ringkasan",
      header: "Ringkasan",
      cell: ({ row }) => (
        <p className="max-w-xs truncate text-muted-foreground">{t(row.original, "ringkasan") || "—"}</p>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const m = STATUS_PERKARA[t(row.original, "status") as keyof typeof STATUS_PERKARA];
        return (
          <Badge tone={m?.tone ?? "neutral"} dot>
            {m?.label ?? "—"}
          </Badge>
        );
      },
    },
  ];

  const bidangPerkara = (jenis: "kasus" | "offboarding", kategori: string[]): Bidang[] => [
    { key: "nama", label: "Nama Karyawan", tipe: "teks", wajib: true },
    { key: "jabatan", label: "Jabatan", tipe: "teks" },
    { key: "scope", label: "Scope", tipe: "pilihan", opsi: opsiScope },
    { key: "outlet_id", label: "Outlet", tipe: "pilihan", opsi: opsiOutlet(outlets) },
    {
      key: "kategori",
      label: jenis === "kasus" ? "Kategori Kasus" : "Alasan Keluar",
      tipe: "pilihan",
      opsi: kategori.map((k) => ({ value: k, label: k })),
    },
    { key: "tanggal", label: "Tanggal", tipe: "tanggal" },
    {
      key: "status",
      label: "Status",
      tipe: "pilihan",
      opsi: Object.entries(STATUS_PERKARA).map(([v, m]) => ({ value: v, label: m.label })),
    },
    { key: "ringkasan", label: "Ringkasan", tipe: "panjang", span: 3 },
    { key: "tindakan", label: "Tindakan / Kesepakatan", tipe: "panjang", span: 3 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile icon={AlertCircle} label="Kasus Berjalan" value={terbuka} sub="belum selesai" />
        <StatTile icon={ClipboardCheck} label="Total Kasus" value={kasus.length} sub="seluruh periode" />
        <StatTile icon={LogOut} label="Proses Keluar" value={keluar.length} sub="offboarding" />
      </div>

      <ScopeTabs value={scope} onChange={setScope} />

      <SegmentedTabs
        className="max-w-md"
        value={tab}
        onChange={setTab}
        items={[
          { value: "kasus", label: "Case Management", icon: AlertCircle },
          { value: "keluar", label: "Offboarding", icon: LogOut },
        ]}
      />

      {tab === "kasus" && (
        <RekamanBoard
          tabel="hc_cases"
          rute={rute}
          tableId="hcmos-kasus"
          rows={perScope(kasus)}
          bolehUbah={bolehUbah}
          labelTambah="Kasus"
          searchPlaceholder="Cari nama, kategori…"
          bawaan={{ jenis: "kasus", scope: "manajemen", status: "terbuka" }}
          columns={kolomPerkara("Kategori")}
          bidang={bidangPerkara("kasus", KATEGORI_KASUS)}
        />
      )}

      {tab === "keluar" && (
        <RekamanBoard
          tabel="hc_cases"
          rute={rute}
          tableId="hcmos-offboarding"
          rows={perScope(keluar)}
          bolehUbah={bolehUbah}
          labelTambah="Proses Keluar"
          searchPlaceholder="Cari nama…"
          bawaan={{ jenis: "offboarding", scope: "manajemen", status: "terbuka" }}
          columns={kolomPerkara("Alasan Keluar")}
          bidang={bidangPerkara("offboarding", KATEGORI_KELUAR)}
        />
      )}
    </div>
  );
}

/* ══════════════════════ Fast Start, Fast Track & Tes ══════════════════════ */

export function FastTrackBoard({
  rows,
  outlets,
  bolehUbah,
}: {
  rows: BarisRekaman[];
  outlets: PilihanOutlet[];
  bolehUbah: boolean;
}) {
  const [program, setProgram] = React.useState("all");
  const tersaring = React.useMemo(
    () => (program === "all" ? rows : rows.filter((r) => t(r, "program") === program)),
    [rows, program],
  );

  const berNilai = rows.filter((r) => n(r, "post_test") !== null);
  const jumlahLulus = berNilai.filter((r) => lulus(n(r, "post_test"))).length;
  const rerataPre = rataRata(rows.map((r) => n(r, "pre_test")));
  const rerataPost = rataRata(rows.map((r) => n(r, "post_test")));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Rocket} label="Peserta" value={rows.length} sub="seluruh batch" />
        <StatTile
          icon={ClipboardCheck}
          label="Lulus"
          value={jumlahLulus}
          sub={`dari ${berNilai.length} yang sudah dinilai`}
        />
        <StatTile icon={ChartColumnBig} label="Rerata Pre Test" value={rerataPre ?? "—"} sub="sebelum pelatihan" />
        <StatTile
          icon={ChartColumnBig}
          label="Rerata Post Test"
          value={rerataPost ?? "—"}
          sub={rerataPre !== null && rerataPost !== null ? `naik ${Math.round((rerataPost - rerataPre) * 10) / 10}` : "sesudah pelatihan"}
        />
      </div>

      <RekamanBoard
        tabel="hc_training_records"
        rute="/hc-mos/fast-track"
        tableId="hcmos-fasttrack"
        rows={tersaring}
        bolehUbah={bolehUbah}
        labelTambah="Peserta"
        searchPlaceholder="Cari nama, batch, materi…"
        bawaan={{ program: "fast_start" }}
        toolbar={
          <Combobox
            portal
            searchable={false}
            value={program}
            onChange={setProgram}
            className="w-44 shrink-0"
            options={[
              { value: "all", label: "Semua Program" },
              ...Object.entries(PROGRAM_FAST).map(([v, l]) => ({ value: v, label: l })),
            ]}
          />
        }
        columns={[
          {
            accessorKey: "nama",
            header: "Peserta",
            cell: ({ row }) => (
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{t(row.original, "nama")}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {row.original.outletName ?? "—"}
                  {t(row.original, "batch") ? ` · batch ${t(row.original, "batch")}` : ""}
                </p>
              </div>
            ),
          },
          {
            accessorKey: "program",
            header: "Program",
            cell: ({ row }) => (
              <Badge tone={t(row.original, "program") === "fast_track" ? "brand" : "neutral"}>
                {PROGRAM_FAST[t(row.original, "program") as keyof typeof PROGRAM_FAST] ?? "—"}
              </Badge>
            ),
          },
          {
            accessorKey: "materi",
            header: "Materi",
            cell: ({ row }) => (
              <p className="max-w-xs truncate text-muted-foreground">{t(row.original, "materi") || "—"}</p>
            ),
          },
          {
            id: "nilai",
            header: "Pre / Role Play / Post",
            cell: ({ row }) => {
              const pre = n(row.original, "pre_test");
              const rp = n(row.original, "role_play");
              const post = n(row.original, "post_test");
              const naik = peningkatan(pre, post);
              return (
                <div className="min-w-0">
                  <p className="tabular-nums text-foreground">
                    {pre ?? "—"} / {rp ?? "—"} / {post ?? "—"}
                  </p>
                  {naik !== null && (
                    <p className={`text-[11px] ${naik >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {naik >= 0 ? "+" : ""}
                      {naik} poin
                    </p>
                  )}
                </div>
              );
            },
          },
          {
            id: "lulus",
            header: "Hasil",
            cell: ({ row }) => {
              const l = lulus(n(row.original, "post_test"));
              if (l === null) return <span className="text-muted-foreground">belum dinilai</span>;
              return (
                <Badge tone={l ? "success" : "danger"} dot>
                  {l ? "Lulus" : `Belum lulus (min ${NILAI_LULUS})`}
                </Badge>
              );
            },
          },
        ]}
        bidang={[
          { key: "nama", label: "Nama Peserta", tipe: "teks", wajib: true },
          { key: "outlet_id", label: "Outlet", tipe: "pilihan", opsi: opsiOutlet(outlets) },
          {
            key: "program",
            label: "Program",
            tipe: "pilihan",
            opsi: Object.entries(PROGRAM_FAST).map(([v, l]) => ({ value: v, label: l })),
          },
          { key: "batch", label: "Batch", tipe: "teks" },
          {
            key: "materi",
            label: "Materi",
            tipe: "pilihan",
            span: 2,
            hint: `Tiap materi dijalani tiga tahap: Pre Test → Role Play → Post Test (${DURASI_POST_TEST_MENIT} menit).`,
            opsi: MATERI_FAST_TRACK.map((m) => ({
              value: m.judul,
              label: `${m.no}. ${m.judul} — ${m.bentuk} · ${m.menit} menit`,
            })),
          },
          { key: "pre_test", label: "Pre Test", tipe: "angka" },
          { key: "role_play", label: "Role Play", tipe: "angka" },
          { key: "post_test", label: "Post Test", tipe: "angka", hint: `Lulus minimal ${NILAI_LULUS}.` },
          { key: "tanggal", label: "Tanggal", tipe: "tanggal" },
          { key: "catatan", label: "Catatan", tipe: "panjang", span: 2 },
        ]}
      />
    </div>
  );
}

function rataRata(xs: (number | null)[]): number | null {
  const ada = xs.filter((x): x is number => x !== null);
  if (ada.length === 0) return null;
  return Math.round((ada.reduce((a, b) => a + b, 0) / ada.length) * 10) / 10;
}

/* ═══════════════════════════ Competency Matrix ═══════════════════════════ */

export function KompetensiBoard({ rows, bolehUbah }: { rows: BarisRekaman[]; bolehUbah: boolean }) {
  const dibawah = rows.filter((r) => senjangKompetensi(n(r, "level_standar") ?? 3, n(r, "level_aktual") ?? 1) < 0).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile icon={ChartColumnBig} label="Baris Kompetensi" value={rows.length} sub="karyawan × kompetensi" />
        <StatTile icon={AlertCircle} label="Di Bawah Standar" value={dibawah} sub="perlu pengembangan" />
        <StatTile
          icon={Award}
          label="Memenuhi"
          value={rows.length - dibawah}
          sub="sesuai atau melampaui standar"
        />
      </div>

      <RekamanBoard
        tabel="hc_competency"
        rute="/hc-mos/kinerja"
        tableId="hcmos-kompetensi"
        rows={rows}
        bolehUbah={bolehUbah}
        labelTambah="Kompetensi"
        searchPlaceholder="Cari nama, kompetensi…"
        bawaan={{ scope: "manajemen", level_standar: 3, level_aktual: 1 }}
        columns={[
          ...kolomNama,
          { accessorKey: "kompetensi", header: "Kompetensi" },
          {
            id: "level",
            header: "Standar / Aktual",
            cell: ({ row }) => {
              const std = n(row.original, "level_standar") ?? 3;
              const akt = n(row.original, "level_aktual") ?? 1;
              const senjang = senjangKompetensi(std, akt);
              return (
                <div className="min-w-0">
                  <p className="tabular-nums text-foreground">
                    {std} / {akt}
                  </p>
                  <p
                    className={`text-[11px] ${senjang < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}
                  >
                    {senjang < 0 ? `kurang ${Math.abs(senjang)} level` : "memenuhi"}
                  </p>
                </div>
              );
            },
          },
          {
            accessorKey: "catatan",
            header: "Catatan",
            cell: ({ row }) => (
              <p className="max-w-xs truncate text-muted-foreground">{t(row.original, "catatan") || "—"}</p>
            ),
          },
        ]}
        bidang={[
          { key: "nama", label: "Nama Karyawan", tipe: "teks", wajib: true },
          { key: "jabatan", label: "Jabatan", tipe: "teks" },
          { key: "scope", label: "Scope", tipe: "pilihan", opsi: opsiScope },
          { key: "kompetensi", label: "Kompetensi", tipe: "teks", wajib: true, span: 3 },
          {
            key: "level_standar",
            label: "Level Standar",
            tipe: "pilihan",
            opsi: Object.entries(LEVEL_LABEL).map(([v, l]) => ({ value: v, label: l })),
          },
          {
            key: "level_aktual",
            label: "Level Aktual",
            tipe: "pilihan",
            opsi: Object.entries(LEVEL_LABEL).map(([v, l]) => ({ value: v, label: l })),
          },
          { key: "catatan", label: "Catatan", tipe: "panjang", span: 3 },
        ]}
      />
    </div>
  );
}
