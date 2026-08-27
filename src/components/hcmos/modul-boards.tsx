"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import {
  AlertCircle,
  AlertTriangle,
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
import {
  BilahModul,
  KerangkaModul,
  LegendaHitung,
  LencanaHak,
  useLayarPenuh,
} from "@/components/hcmos/kit-modul";
import { RekamanBoard, type BarisRekaman, type Bidang } from "./rekaman";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ARTI_LEVEL,
  JABATAN_STANDAR,
  SKALA_KOMPETENSI,
  STANDAR_OUTLET,
} from "@/lib/hcmos/kompetensi";
import { SCOPE_LABEL, type HcScope } from "@/lib/hcmos/pillars";
import { brandOutlet } from "@/lib/hcmos/kontrak";
import { AlurLangkah } from "./alur";
import {
  ESKALASI,
  TAHAP_OFFBOARDING,
  alasanKeluar,
  kategoriKasus,
  keluarPerBrand,
  lamaHari,
  ringkasKasus,
  ringkasKeluar,
  type Eskalasi,
  type KeluarPerBrand,
  type PerkaraRingkas,
} from "@/lib/hcmos/relasi";
import { ALASAN_SISA, type SisaPenutupan } from "@/lib/hcmos/offboarding";
import { GrafikBatang, GrafikDonat, GrafikGaris } from "./grafik";
import {
  STATUS_MODUL_META,
  fastTrackPerBrand,
  jumlahPeserta,
  ringkasBatch,
  trenKelulusan,
  type RekamanPelatihan,
} from "@/lib/hcmos/pelatihan";
import {
  KATEGORI_KASUS,
  KATEGORI_KELUAR,
  DURASI_POST_TEST_MENIT,
  KESIAPAN,
  LEVEL_LABEL,
  MATERI_FAST_TRACK,
  NILAI_LULUS,
  PROGRAM_FAST,
  STATUS_PERKARA,
  type StatusPerkara,
  lulus,
  peningkatan,
  senjangKompetensi,
} from "@/lib/hcmos/lanjutan";
import { formatDate } from "@/lib/utils";

/** Ambil nilai kolom sebagai teks tanpa memaksa tipe di setiap pemakaian. */
/** Baris mentah `hc_cases` → bentuk yang dipakai perhitungan di lib/relasi. */
const bacaPerkara = (r: BarisRekaman): PerkaraRingkas => ({
  nama: t(r, "nama"),
  scope: t(r, "scope") || "manajemen",
  kategori: t(r, "kategori"),
  status: t(r, "status"),
  eskalasi: t(r, "eskalasi") || "normal",
  tanggal: t(r, "tanggal") || null,
  tglSelesai: t(r, "tgl_selesai") || null,
  exitInterview: r.exit_interview === true,
  serahAset: r.serah_aset === true,
  payrollFinal: r.payroll_final === true,
});

export const t = (r: BarisRekaman, k: string) => (r[k] === null || r[k] === undefined ? "" : String(r[k]));
export const n = (r: BarisRekaman, k: string) => (r[k] === null || r[k] === undefined ? null : Number(r[k]));

export const opsiScope = [
  { value: "manajemen", label: SCOPE_LABEL.manajemen },
  { value: "outlet", label: SCOPE_LABEL.outlet },
];

export interface PilihanOutlet {
  id: string;
  name: string;
}
export const opsiOutlet = (outlets: PilihanOutlet[]) => [
  { value: "", label: "—" },
  ...outlets.map((o) => ({ value: o.id, label: o.name })),
];

/**
 * Tombol scope Manajemen (GWG) / Outlet di dalam halaman — Juknis Bab 2.2.
 *
 * Bentuknya sama di setiap modul supaya letaknya bisa ditebak: satu baris tepat
 * di atas tab isi, tidak pernah di dalam tabel atau di dalam formulir.
 */
export function ScopeTabs({
  value,
  onChange,
  semua = true,
}: {
  value: HcScope | "semua";
  onChange: (v: HcScope | "semua") => void;
  /** Sediakan pilihan "Semua". Dimatikan di modul yang angkanya memang tidak
   *  bisa digabung — gaji manajemen dan gaji crew outlet dihitung dari sumber
   *  yang berbeda, jadi satu angka gabungan tidak menjawab pertanyaan siapa
   *  pun. */
  semua?: boolean;
}) {
  return (
    <SegmentedTabs
      className="max-w-md"
      size="sm"
      value={value}
      onChange={(v) => onChange(v as HcScope | "semua")}
      items={[
        ...(semua ? [{ value: "semua", label: "Semua" }] : []),
        { value: "manajemen", label: SCOPE_LABEL.manajemen, icon: Building2 },
        { value: "outlet", label: SCOPE_LABEL.outlet, icon: Store },
      ]}
    />
  );
}

export const kolomNama: ColumnDef<BarisRekaman>[] = [
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
  const [cari, setCari] = React.useState("");
  const { bingkai, layarPenuh, alih } = useLayarPenuh();
  const rute = "/hc-mos/talent";
  const siap = suksesi.filter((s) => t(s, "kesiapan") === "siap_sekarang").length;

  const q = cari.trim().toLowerCase();
  const saring = React.useCallback(
    (rows: BarisRekaman[]) =>
      q
        ? rows.filter((r) =>
            `${t(r, "jabatan")} ${t(r, "nama")} ${t(r, "posisi")} ${t(r, "kandidat")}`.toLowerCase().includes(q),
          )
        : rows,
    [q],
  );
  const karierTampil = React.useMemo(() => saring(karier), [karier, saring]);
  const suksesiTampil = React.useMemo(() => saring(suksesi), [suksesi, saring]);

  return (
    <KerangkaModul ref={bingkai}>
      <BilahModul
        ikon={tab === "suksesi" ? UsersRound : GitBranch}
        gradien="from-lime-500 via-green-500 to-emerald-600 shadow-green-500/20"
        judul={tab === "suksesi" ? "Succession Plan" : "Career Path"}
        ringkas={
          <>
            {karier.length} jenjang jabatan · {suksesi.length} posisi kunci dipetakan · {siap} penerus siap sekarang
          </>
        }
        cari={cari}
        onCari={setCari}
        cariPlaceholder="Cari jabatan, nama, posisi…"
        hitung={{
          tampil: tab === "suksesi" ? suksesiTampil.length : karierTampil.length,
          total: tab === "suksesi" ? suksesi.length : karier.length,
        }}
        menyaring={q !== ""}
        onBersihkan={() => setCari("")}
        panduan="talent"
        tampilan={
          <SegmentedTabs
            className="w-full sm:w-auto"
            size="sm"
            value={tab}
            onChange={setTab}
            items={[
              { value: "karier", label: "Career Path", icon: GitBranch },
              { value: "suksesi", label: "Succession Plan", icon: UsersRound },
            ]}
          />
        }
        layarPenuh={layarPenuh}
        onLayarPenuh={alih}
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile icon={GitBranch} label="Jenjang Jabatan" value={karier.length} sub="career path" />
        <StatTile icon={UsersRound} label="Posisi Kunci" value={suksesi.length} sub="dipetakan" />
        <StatTile icon={Award} label="Penerus Siap" value={siap} sub="siap sekarang" />
      </div>

      {tab === "karier" && (
        <RekamanBoard
          tabel="hc_career_paths"
          rute={rute}
          tableId="hcmos-karier"
          rows={karierTampil}
          bolehUbah={bolehUbah}
          labelTambah="Jenjang"
          showSearch={false}
          maxHeight="none"
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
          rows={suksesiTampil}
          bolehUbah={bolehUbah}
          labelTambah="Posisi Kunci"
          showSearch={false}
          maxHeight="none"
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
    </KerangkaModul>
  );
}

/* ═════════════════════ Employee & Industrial Relations ═════════════════════ */

export function RelasiBoard({
  kasus,
  keluar,
  outlets,
  orangManajemen,
  orangOutlet,
  sisaPenutupan,
  bolehUbah,
  tabAwal = "kasus",
}: {
  kasus: BarisRekaman[];
  keluar: BarisRekaman[];
  outlets: PilihanOutlet[];
  /** Karyawan manajemen yang akunnya masih aktif — untuk penunjuk offboarding. */
  orangManajemen: PilihanOutlet[];
  /** Crew outlet yang kontraknya masih berjalan. */
  orangOutlet: PilihanOutlet[];
  /** Perkara selesai yang jejaknya belum tuntas. */
  sisaPenutupan: SisaPenutupan[];
  bolehUbah: boolean;
  tabAwal?: string;
}) {
  const [tab, setTab] = React.useState(tabAwal);
  // Scope di sini pilihan tunggal, bukan "semua". Kasus hubungan industrial di
  // kantor dan di outlet ditangani orang berbeda dengan aturan berbeda;
  // menjumlahkan keduanya menghasilkan angka yang tidak dipakai siapa pun.
  const [scope, setScope] = React.useState<HcScope>("manajemen");
  const [cari, setCari] = React.useState("");
  const [sorotStatus, setSorotStatus] = React.useState<StatusPerkara | null>(null);
  const { bingkai, layarPenuh, alih } = useLayarPenuh();
  const rute = "/hc-mos/relasi";
  const tahun = new Date().getFullYear();

  const perScope = React.useCallback(
    (rows: BarisRekaman[]) => rows.filter((r) => (t(r, "scope") || "manajemen") === scope),
    [scope],
  );

  /**
   * Pencarian dan saringan status berlaku untuk KEDUA tab.
   *
   * Perkara dan proses keluar sering menyangkut orang yang sama — seseorang
   * yang kasusnya berujung resign muncul di dua tab sekaligus. Saringan yang
   * hilang saat berpindah tab memaksa mengetik ulang nama yang sama.
   */
  const q = cari.trim().toLowerCase();
  const perTampilan = React.useCallback(
    (rows: BarisRekaman[]) => {
      let hasil = perScope(rows);
      if (sorotStatus) hasil = hasil.filter((r) => (t(r, "status") || "terbuka") === sorotStatus);
      if (!q) return hasil;
      return hasil.filter((r) =>
        `${t(r, "nama")} ${t(r, "jabatan")} ${t(r, "kategori")} ${t(r, "ringkasan")}`.toLowerCase().includes(q),
      );
    },
    [perScope, sorotStatus, q],
  );

  const kasusTampil = React.useMemo(() => perTampilan(kasus), [kasus, perTampilan]);
  const keluarTampil = React.useMemo(() => perTampilan(keluar), [keluar, perTampilan]);
  const menyaring = q !== "" || sorotStatus !== null;

  const kasusScope = React.useMemo(() => perScope(kasus).map(bacaPerkara), [kasus, perScope]);
  const keluarScope = React.useMemo(() => perScope(keluar).map(bacaPerkara), [keluar, perScope]);
  const rk = React.useMemo(() => ringkasKasus(kasusScope, tahun), [kasusScope, tahun]);
  const rl = React.useMemo(() => ringkasKeluar(keluarScope, tahun), [keluarScope, tahun]);
  const alasan = React.useMemo(() => alasanKeluar(keluarScope), [keluarScope]);
  const kategori = React.useMemo(() => kategoriKasus(kasusScope), [kasusScope]);
  // Brand diambil dari nama outlet baris aslinya, bukan dari `keluarScope`:
  // ringkasan perkara sengaja tidak membawa outlet karena seluruh hitungan
  // lain di modul ini tidak membutuhkannya.
  const perBrand = React.useMemo(
    () =>
      keluarPerBrand(
        perScope(keluar).map((r) => ({
          brand: r.outletName ? (brandOutlet(r.outletName) ?? r.outletName) : "",
          kategori: t(r, "kategori"),
        })),
      ),
    [keluar, perScope],
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
        const lama = lamaHari(t(row.original, "tanggal") || null, t(row.original, "tgl_selesai") || null);
        return (
          <div className="min-w-0">
            <Badge tone={m?.tone ?? "neutral"} dot>
              {m?.label ?? "—"}
            </Badge>
            {lama !== null && <p className="mt-0.5 text-[11px] text-muted-foreground">selesai dalam {lama} hari</p>}
          </div>
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
    { key: "tgl_selesai", label: "Tanggal Selesai", tipe: "tanggal", hint: "Diisi saat perkaranya ditutup — dari sinilah lama penyelesaian dihitung." },
    ...(jenis === "kasus"
      ? ([
          {
            key: "eskalasi",
            label: "Tingkat Eskalasi",
            tipe: "pilihan",
            opsi: (Object.keys(ESKALASI) as Eskalasi[]).map((v) => ({ value: v, label: ESKALASI[v].label })),
          },
        ] as Bidang[])
      : ([
          {
            key: "user_id",
            label: "Akun Karyawan (Manajemen)",
            tipe: "pilihan",
            opsi: opsiOutlet(orangManajemen),
            hint: "Akun ini otomatis dinonaktifkan begitu status diubah jadi Selesai.",
          },
          {
            key: "kontrak_id",
            label: "Baris Kontrak (Outlet)",
            tipe: "pilihan",
            opsi: opsiOutlet(orangOutlet),
            hint: "Tanggal resign kontrak ini otomatis diisi saat perkara ditutup.",
          },
          { key: "exit_interview", label: "Exit Interview Selesai", tipe: "boolean" },
          { key: "serah_aset", label: "Serah Terima Aset Selesai", tipe: "boolean" },
          { key: "payroll_final", label: "Payroll Final Diproses", tipe: "boolean" },
        ] as Bidang[])),
    { key: "ringkasan", label: "Ringkasan", tipe: "panjang", span: 3 },
    { key: "tindakan", label: "Tindakan / Kesepakatan", tipe: "panjang", span: 3 },
  ];

  // Legenda dihitung dari seluruh baris scope ini, bukan dari yang tampak:
  // menyorot satu status tidak boleh membuat dua lainnya jatuh ke nol.
  const dasarLegenda = tab === "kasus" ? perScope(kasus) : perScope(keluar);
  const rekapStatus = (Object.keys(STATUS_PERKARA) as StatusPerkara[]).map((st) => ({
    key: st,
    kode: KODE_PERKARA[st],
    label: STATUS_PERKARA[st].label,
    jumlah: dasarLegenda.filter((r) => (t(r, "status") || "terbuka") === st).length,
    warna: WARNA_PERKARA[st],
    judulPenuh: STATUS_PERKARA[st].label,
  }));

  const tampil = tab === "kasus" ? kasusTampil.length : keluarTampil.length;
  const total = dasarLegenda.length;

  return (
    <KerangkaModul ref={bingkai}>
      <BilahModul
        ikon={tab === "kasus" ? AlertCircle : LogOut}
        gradien="from-rose-500 via-pink-500 to-fuchsia-600 shadow-pink-500/20"
        judul={tab === "kasus" ? "Case Management" : "Offboarding / Exit Process"}
        ringkas={
          <>
            {SCOPE_LABEL[scope]} · {rk.berjalan} kasus berjalan · {rl.keluarTahunIni} keluar {tahun}
            {rk.eskalasiTinggi > 0 && ` · ${rk.eskalasiTinggi} eskalasi tinggi`}
          </>
        }
        cari={cari}
        onCari={setCari}
        cariPlaceholder="Cari nama, kategori, ringkasan…"
        hitung={{ tampil, total }}
        menyaring={menyaring}
        onBersihkan={() => {
          setCari("");
          setSorotStatus(null);
        }}
        panduan="relasi"
        saringan={
          <SegmentedTabs
            className="w-full sm:w-auto"
            size="sm"
            value={scope}
            onChange={(v) => setScope(v as HcScope)}
            items={[
              { value: "manajemen", label: SCOPE_LABEL.manajemen, icon: Building2 },
              { value: "outlet", label: SCOPE_LABEL.outlet, icon: Store },
            ]}
          />
        }
        tampilan={
          <SegmentedTabs
            className="w-full sm:w-auto"
            size="sm"
            value={tab}
            onChange={setTab}
            items={[
              { value: "kasus", label: "Kasus", icon: AlertCircle },
              { value: "keluar", label: "Offboarding", icon: LogOut },
            ]}
          />
        }
        layarPenuh={layarPenuh}
        onLayarPenuh={alih}
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3">

      {tab === "kasus" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile icon={AlertCircle} label="Kasus Berjalan" value={rk.berjalan} sub="belum selesai" />
          <StatTile icon={ClipboardCheck} label={`Selesai (${tahun})`} value={rk.selesaiTahunIni} sub="ditutup tahun ini" />
          <StatTile
            icon={AlertTriangle}
            label="Eskalasi Tinggi"
            value={rk.eskalasiTinggi}
            sub={rk.eskalasiTinggi === 0 ? "tidak ada" : "masih berjalan"}
          />
          <StatTile
            icon={CalendarCheck}
            label="Rata-rata Waktu Penyelesaian"
            value={rk.rataHari === null ? "—" : `${rk.rataHari} hari`}
            sub={rk.rataHari === null ? "belum ada kasus yang ditutup" : "dari kasus yang sudah ditutup"}
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile icon={LogOut} label={`Karyawan Keluar (${tahun})`} value={rl.keluarTahunIni} sub={`${rl.total} sepanjang riwayat`} />
          <StatTile
            icon={ClipboardCheck}
            label="Exit Interview Selesai"
            value={`${rl.exitInterview}/${rl.keluarTahunIni}`}
            sub="digali Human Capital"
          />
          <StatTile
            icon={ShieldCheck}
            label="Serah Terima Aset Selesai"
            value={`${rl.serahAset}/${rl.keluarTahunIni}`}
            sub="aset & akses dikembalikan"
          />
          <StatTile
            icon={Banknote}
            label="Payroll Final Diproses"
            value={`${rl.payrollFinal}/${rl.keluarTahunIni}`}
            sub="gaji terakhir & pesangon"
          />
        </div>
      )}

      {/* Yang ditanyakan setelah "berapa kasusnya" adalah "kasus APA" — sebaran
          kategorinya menjawab itu tanpa perlu membaca tabelnya baris demi
          baris. Donat, bukan batang: bagian dari satu keseluruhan. */}
      {tab === "kasus" && (
        <GrafikDonat
          judul="Kasus per Kategori"
          subjudul={`Rekap seluruh kasus yang tercatat — ${SCOPE_LABEL[scope]}`}
          data={kategori}
          pesanKosong="Belum ada kasus yang tercatat untuk scope ini."
        />
      )}

      {/* Manajemen ditanya "alasannya apa", outlet ditanya "di brand mana".
          Sembilan crew keluar terbagi rata di empat brand adalah keadaan yang
          sama sekali berbeda dari sembilan-sembilanya dari satu brand, padahal
          grafik alasan menampilkan keduanya persis sama. */}
      {tab === "keluar" && sisaPenutupan.length > 0 && <SisaPenutupanKartu rows={sisaPenutupan} />}

      {tab === "keluar" && scope === "manajemen" && (
        <GrafikBatang
          judul={`Alasan Keluar (${tahun})`}
          subjudul={`Sumber: catatan proses keluar — ${SCOPE_LABEL[scope]}`}
          data={alasan}
          satuan="orang"
          labelPenuh
          pesanKosong="Belum ada karyawan keluar yang tercatat untuk scope ini."
        />
      )}

      {tab === "keluar" && scope === "outlet" && <RekapBrandKeluar rows={perBrand} />}

      {tab === "kasus" && (
        <RekamanBoard
          tabel="hc_cases"
          rute={rute}
          tableId="hcmos-kasus"
          rows={kasusTampil}
          bolehUbah={bolehUbah}
          labelTambah="Kasus"
          showSearch={false}
          maxHeight="none"
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
          rows={keluarTampil}
          bolehUbah={bolehUbah}
          labelTambah="Proses Keluar"
          showSearch={false}
          maxHeight="none"
          bawaan={{ jenis: "offboarding", scope: "manajemen", status: "terbuka" }}
          columns={kolomPerkara("Alasan Keluar")}
          bidang={bidangPerkara("offboarding", KATEGORI_KELUAR)}
        />
      )}

      {tab === "keluar" && (
        <AlurLangkah
          judul="Alur Offboarding"
          ringkas="Standar proses karyawan keluar — berlaku untuk Manajemen & Outlet"
          langkah={TAHAP_OFFBOARDING}
        />
      )}
      </div>

      <LegendaHitung
        butir={rekapStatus}
        sorot={sorotStatus}
        onSorot={(k) => setSorotStatus((v) => (v === k ? null : (k as StatusPerkara)))}
        kiri={<LencanaHak bolehUbah={bolehUbah} />}
      />
    </KerangkaModul>
  );
}

const KODE_PERKARA: Record<StatusPerkara, string> = { terbuka: "T", proses: "P", selesai: "S" };
const WARNA_PERKARA: Record<StatusPerkara, [string, string]> = {
  terbuka: ["#dc2626", "#f87171"],
  proses: ["#d97706", "#fbbf24"],
  selesai: ["#059669", "#34d399"],
};

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
  const [cari, setCari] = React.useState("");
  const { bingkai, layarPenuh, alih } = useLayarPenuh();

  const q = cari.trim().toLowerCase();
  const tersaring = React.useMemo(() => {
    const hasil = program === "all" ? rows : rows.filter((r) => t(r, "program") === program);
    if (!q) return hasil;
    return hasil.filter((r) =>
      `${t(r, "nama")} ${t(r, "batch")} ${t(r, "materi")} ${r.outletName ?? ""}`.toLowerCase().includes(q),
    );
  }, [rows, program, q]);

  const rerataPre = rataRata(rows.map((r) => n(r, "pre_test")));
  const rerataPost = rataRata(rows.map((r) => n(r, "post_test")));

  // Bentuk mentah tabel diubah sekali jadi bentuk yang dipakai perhitungan,
  // supaya seluruh rekap di bawah membaca sumber yang sama persis dengan
  // Modul Pelatihan — bukan menghitung ulang dengan aturan sendiri.
  const rekaman = React.useMemo<RekamanPelatihan[]>(
    () =>
      rows.map((r) => ({
        nama: t(r, "nama"),
        materi: t(r, "materi"),
        program: t(r, "program"),
        batch: t(r, "batch"),
        outletName: r.outletName ?? null,
        tanggal: t(r, "tanggal") || null,
        preTest: n(r, "pre_test"),
        rolePlay: n(r, "role_play"),
        postTest: n(r, "post_test"),
      })),
    [rows],
  );

  const batch = React.useMemo(() => ringkasBatch(rekaman), [rekaman]);
  const tren = React.useMemo(() => trenKelulusan(batch), [batch]);
  const perBrand = React.useMemo(
    () => fastTrackPerBrand(rekaman, (nama) => brandOutlet(nama) ?? ""),
    [rekaman],
  );

  const batchBerjalan = batch.filter((b) => b.status === "berjalan").length;
  const fastStart = rekaman.filter((r) => r.program === "fast_start" && r.postTest !== null);
  const lulusFastStart = fastStart.filter((r) => lulus(r.postTest) === true).length;
  const persenFastStart = fastStart.length === 0 ? null : Math.round((lulusFastStart / fastStart.length) * 100);
  const jalurFastTrack = perBrand.reduce((a, b) => a + b.nilai, 0);

  // Legenda dihitung dari SELURUH baris: menyorot satu program tidak boleh
  // membuat program lain jatuh ke nol.
  const rekapProgram = (Object.keys(PROGRAM_FAST) as (keyof typeof PROGRAM_FAST)[]).map((pr) => ({
    key: pr as string,
    kode: pr === "fast_track" ? "FT" : "FS",
    label: PROGRAM_FAST[pr],
    jumlah: rows.filter((r) => t(r, "program") === pr).length,
    warna: (pr === "fast_track" ? ["#4f46e5", "#818cf8"] : ["#0891b2", "#22d3ee"]) as [string, string],
    judulPenuh: PROGRAM_FAST[pr],
  }));

  return (
    <KerangkaModul ref={bingkai}>
      <BilahModul
        ikon={Rocket}
        gradien="from-cyan-500 via-sky-500 to-blue-600 shadow-sky-500/20"
        judul="Fast Start & Fast Track"
        ringkas={
          <>
            {batch.length} batch · {batchBerjalan} berjalan · {jumlahPeserta(rekaman)} crew ·{" "}
            {persenFastStart === null ? "belum dinilai" : `${persenFastStart}% lulus Fast Start`}
          </>
        }
        cari={cari}
        onCari={setCari}
        cariPlaceholder="Cari nama, batch, materi…"
        hitung={{ tampil: tersaring.length, total: rows.length }}
        menyaring={program !== "all" || q !== ""}
        onBersihkan={() => {
          setProgram("all");
          setCari("");
        }}
        panduan="fast-track"
        saringan={
          <Combobox
            portal
            searchable={false}
            value={program}
            onChange={setProgram}
            className="w-full shrink-0 sm:w-44"
            options={[
              { value: "all", label: "Semua Program" },
              ...Object.entries(PROGRAM_FAST).map(([v, l]) => ({ value: v, label: l })),
            ]}
          />
        }
        layarPenuh={layarPenuh}
        onLayarPenuh={alih}
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={Rocket}
          label="Batch Berjalan"
          value={batchBerjalan}
          sub={`dari ${batch.length} batch tercatat`}
        />
        <StatTile
          icon={UsersRound}
          label="Crew Terdaftar"
          value={jumlahPeserta(rekaman)}
          sub="orang berbeda, bukan jumlah baris"
        />
        <StatTile
          icon={ClipboardCheck}
          label="Kelulusan Fast Start"
          value={persenFastStart === null ? "—" : `${persenFastStart}%`}
          sub={
            fastStart.length === 0
              ? "belum ada Post Test yang dinilai"
              : `${lulusFastStart} lulus dari ${fastStart.length} dinilai`
          }
        />
        <StatTile
          icon={Store}
          label="Jalur Fast Track"
          value={jalurFastTrack}
          sub={perBrand.length === 0 ? "belum ada peserta Fast Track" : `tersebar di ${perBrand.length} brand`}
        />
      </div>

      {/* ── Jadwal batch ─────────────────────────────────────────────────
          Rekap per batch dulu, daftar pesertanya belakangan. Yang ditanyakan
          orang saat membuka halaman ini hampir selalu "batch mana yang masih
          jalan dan sudah sampai mana", bukan nilai satu orang tertentu. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Jadwal Batch</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Periode diambil dari tanggal catatan pesertanya — tidak diketik terpisah
          </p>
        </CardHeader>
        <CardContent>
          {batch.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada batch tercatat. Tambahkan peserta di tabel bawah untuk memulainya.
            </p>
          ) : (
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <ThKecil>Batch</ThKecil>
                    <ThKecil>Program</ThKecil>
                    <ThKecil>Peserta</ThKecil>
                    <ThKecil>Periode</ThKecil>
                    <ThKecil>Kelulusan</ThKecil>
                    <ThKecil>Status</ThKecil>
                  </tr>
                </thead>
                <tbody>
                  {batch.map((b) => (
                    <tr key={b.batch} className="border-b border-border/60 last:border-0">
                      <TdKecil className="font-medium text-foreground">{b.batch}</TdKecil>
                      <TdKecil>
                        <div className="flex flex-wrap gap-1">
                          {b.program.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            b.program.map((pr) => (
                              <Badge key={pr} tone={pr === "fast_track" ? "brand" : "neutral"}>
                                {PROGRAM_FAST[pr as keyof typeof PROGRAM_FAST] ?? pr}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TdKecil>
                      <TdKecil className="tabular-nums">{b.peserta}</TdKecil>
                      <TdKecil className="whitespace-nowrap">
                        {b.mulai ? `${formatDate(b.mulai)} — ${formatDate(b.selesai ?? b.mulai)}` : "—"}
                      </TdKecil>
                      <TdKecil className="tabular-nums">
                        {b.persenLulus === null ? (
                          <span className="text-muted-foreground">belum dinilai</span>
                        ) : (
                          `${b.persenLulus}% (${b.lulus}/${b.dinilai})`
                        )}
                      </TdKecil>
                      <TdKecil>
                        <Badge tone={STATUS_MODUL_META[b.status].tone} dot>
                          {STATUS_MODUL_META[b.status].label}
                        </Badge>
                      </TdKecil>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <GrafikGaris
          judul="Tren Kelulusan per Batch"
          subjudul={
            rerataPre !== null && rerataPost !== null
              ? `Rerata Pre Test ${rerataPre} → Post Test ${rerataPost}`
              : "Persen peserta yang lulus Post Test di tiap batch"
          }
          data={tren}
          satuan="%"
          pesanKosong="Belum ada batch yang Post Test-nya sudah dinilai."
        />
        <GrafikBatang
          judul="Jalur Fast Track per Brand"
          subjudul="Crew yang mengikuti modul lanjutan, dihitung per orang"
          data={perBrand}
          satuan="orang"
          pesanKosong="Belum ada peserta Fast Track yang tercatat."
        />
      </div>

      <RekamanBoard
        tabel="hc_training_records"
        rute="/hc-mos/fast-track"
        tableId="hcmos-fasttrack"
        rows={tersaring}
        bolehUbah={bolehUbah}
        labelTambah="Peserta"
        showSearch={false}
        maxHeight="none"
        bawaan={{ program: "fast_start" }}
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

      <LegendaHitung
        butir={rekapProgram}
        sorot={program === "all" ? null : program}
        onSorot={(k) => setProgram((v) => (v === k ? "all" : k))}
        kiri={<LencanaHak bolehUbah={bolehUbah} />}
      />
    </KerangkaModul>
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

      <StandarKompetensiCard />

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


/**
 * Standar kompetensi jabatan outlet — acuan, bukan penilaian.
 *
 * Ditaruh di atas daftar penilaiannya karena tanpa acuan di layar yang sama,
 * angka "level aktual 3" tidak bisa dibaca sebagai kurang atau cukup: yang
 * menentukan itu standar jabatannya, dan standar yang harus dicari di dokumen
 * lain adalah standar yang tidak dipakai.
 */
function StandarKompetensiCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Standar Kompetensi Jabatan Outlet</CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Skala {SKALA_KOMPETENSI.min} (dasar) – {SKALA_KOMPETENSI.max} (panutan). Angkanya level yang diharapkan, bukan
          nilai seseorang.
        </p>
      </CardHeader>
      <CardContent>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Kompetensi
                </th>
                {JABATAN_STANDAR.map((j) => (
                  <th
                    key={j}
                    className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {j}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STANDAR_OUTLET.map((r) => (
                <tr key={r.kompetensi} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2.5 font-medium text-foreground">{r.kompetensi}</td>
                  {JABATAN_STANDAR.map((j) => (
                    <td key={j} className="px-3 py-2.5 text-center">
                      <span
                        title={ARTI_LEVEL[r.level[j]]}
                        className="inline-grid size-7 place-items-center rounded-lg bg-muted text-[12px] font-semibold tabular-nums text-foreground ring-1 ring-border"
                      >
                        {r.level[j]}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          {Object.entries(ARTI_LEVEL)
            .map(([n, arti]) => `${n} = ${arti}`)
            .join(" · ")}
        </p>
      </CardContent>
    </Card>
  );
}

/* Sel tabel ringkas — dipakai rekap batch yang tidak butuh DataTable penuh. */
function ThKecil({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</th>
  );
}

function TdKecil({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-top text-muted-foreground ${className}`}>{children}</td>;
}

/** Rekap karyawan keluar per brand — pengganti grafik alasan untuk scope outlet. */
function RekapBrandKeluar({ rows }: { rows: KeluarPerBrand[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Riwayat Crew Keluar per Brand</CardTitle>
        <p className="text-[11px] text-muted-foreground">Dihitung dari catatan proses keluar tiap outlet</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed border-border bg-muted/20 py-10 text-center text-xs text-muted-foreground">
            Belum ada crew outlet keluar yang tercatat.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Brand", "Jumlah Keluar", "Alasan Terbanyak"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.brand} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2.5 align-middle font-medium text-foreground">{r.brand}</td>
                    <td className="px-3 py-2.5 align-middle tabular-nums text-foreground">{r.jumlah}</td>
                    <td className="px-3 py-2.5 align-middle text-muted-foreground">{r.alasanTerbanyak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


/**
 * Perkara offboarding yang sudah ditandai selesai tapi jejaknya belum tuntas.
 *
 * Ditaruh di ATAS grafik, bukan di kaki halaman: ini satu-satunya kartu di
 * modul ini yang menuntut tindakan, dan kartu yang menuntut tindakan tidak
 * boleh perlu digulir untuk ditemukan.
 */
function SisaPenutupanKartu({ rows }: { rows: SisaPenutupan[] }) {
  return (
    <Card className="border-amber-500/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500" />
          Perlu Ditutup — {rows.length} perkara
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Sudah ditandai selesai, tapi aksesnya belum benar-benar dicabut
        </p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {rows.map((r, i) => (
            <li key={`${r.kasusId}-${i}`} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{r.nama || "—"}</span>
                <span className="block text-[12px] text-muted-foreground">{ALASAN_SISA[r.alasan]}</span>
              </span>
              <Badge tone={r.alasan === "akun-masih-aktif" ? "danger" : "warning"}>
                {r.alasan === "akun-masih-aktif" ? "Akses aktif" : "Belum lengkap"}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
