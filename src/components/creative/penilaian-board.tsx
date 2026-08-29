"use client";

import * as React from "react";
import {
  CalendarClock,
  CalendarRange,
  ClipboardCheck,
  History,
  Info,
  ListChecks,
  MapPinned,
  TableProperties,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import {
  BatangPersen,
  BilahSaring,
  DropdownCreative,
  KartuTabel,
  KosongCreative,
  KotakCari,
  PitaCreative,
  StripAngka,
  Td,
  Th,
} from "./kit-creative";
import { LaporanDialog } from "./laporan-dialog";
import {
  AMBANG_HIJAU,
  AMBANG_KUNING,
  BOBOT_BRIEF,
  BOBOT_WAKTU,
  BUTIR_BRIEF,
  HARI_WAJAR,
  HEAD_OFFICE,
  LABEL_META,
  SEMUA_PERIODE,
  WAKTU_META,
  dalamPeriode,
  daftarPeriode,
  labelPeriode,
  rekapPemohon,
  type Label,
} from "@/lib/creative/penilaian-request";
import type { BarisDashboard, DashboardPenilaian, PenerimaLaporan } from "@/lib/data/creative-penilaian";
import { formatDate, formatNumber } from "@/lib/utils";

/**
 * Dashboard penilaian pemohon design.
 *
 * BUKAN untuk menghukum siapa pun. Ia menjawab satu perdebatan yang selama ini
 * tidak punya wasit: tim Creative dituduh lambat, tim Operational merasa sudah
 * meminta jauh-jauh hari, dan tidak ada catatan yang bisa memutuskan. Angka di
 * sini sudah tercatat sejak permintaannya dikirim — sebelum ada yang punya
 * kepentingan atas hasilnya.
 *
 * Yang ditonjolkan karena itu bukan skornya, melainkan PERSEN PERMINTAAN
 * MENDADAK. Skor gabungan mudah diperdebatkan bobotnya; "tujuh dari sepuluh
 * permintaan wilayah ini masuk H-1" tidak.
 *
 * SATU TABEL, BUKAN DUA. Dulu ada "Per Outlet" dan "Per Pemohon" — dua tampilan
 * untuk pertanyaan yang sama, dan yang per outlet tidak pernah bisa menjawabnya
 * untuk permintaan kantor yang memang tidak punya cabang. Sekarang wilayahnya
 * jadi KOLOM PERTAMA: satu baris per orang, areanya di sebelah namanya.
 */

type Tampilan = "rekap" | "riwayat";

const WARNA_LABEL: Record<Label, string> = { merah: "#ef4444", kuning: "#f59e0b", hijau: "#22c55e" };

export function PenilaianBoard({
  data,
  bolehKirim,
  penerima,
  lingkupArea,
}: {
  data: DashboardPenilaian;
  /** Tim Creative mengirim laporannya; Coordinator Area hanya membaca. */
  bolehKirim: boolean;
  penerima: PenerimaLaporan[];
  /**
   * Wilayah yang sedang dilihat.
   *
   * `null` berarti seluruh wilayah. Daftar KOSONG bukan hal yang sama: itu
   * akun yang belum ditugaskan cabang mana pun, dan tabelnya akan kosong bukan
   * karena tidak ada permintaan. Membedakannya penting — tanpa itu orangnya
   * mengira dashboard-nya rusak.
   */
  lingkupArea: string[] | null;
}) {
  const [tampilan, setTampilan] = React.useState<Tampilan>("rekap");
  const [cari, setCari] = React.useState("");
  const [periode, setPeriode] = React.useState<string>(SEMUA_PERIODE);
  const [label, setLabel] = React.useState<Label | "">("");

  // Bulan yang benar-benar punya permintaan — termasuk yang belum dinilai,
  // supaya bulan yang isinya "semua belum dinilai" tetap bisa dipilih dan
  // terlihat sisa pekerjaannya.
  const periodeAda = React.useMemo(
    () => daftarPeriode([...data.baris, ...data.belum]),
    [data.baris, data.belum],
  );

  const barisPeriode = React.useMemo(() => dalamPeriode(data.baris, periode), [data.baris, periode]);
  const rekap = React.useMemo(() => rekapPemohon(barisPeriode), [barisPeriode]);
  const belumPeriode = React.useMemo(() => dalamPeriode(data.belum, periode).length, [data.belum, periode]);

  const q = cari.trim().toLowerCase();
  const cocok = (teks: string) => !q || teks.toLowerCase().includes(q);

  const rekapTampil = rekap.filter((r) => (!label || r.label === label) && cocok(`${r.nama} ${r.areaNama} ${r.outletNama ?? ""}`));
  const riwayatTampil = barisPeriode.filter(
    (b) => (!label || b.hasil.label === label) && cocok(`${b.judul} ${b.pemohonNama} ${b.areaNama} ${b.outletNama ?? ""}`),
  );

  const total = barisPeriode.length;
  const mendadak = barisPeriode.filter((b) => b.waktu === "mendadak").length;
  const berhari = barisPeriode.filter((b) => b.hari !== null).map((b) => b.hari!);
  const rataHari = berhari.length ? Math.round((berhari.reduce((a, b) => a + b, 0) / berhari.length) * 10) / 10 : null;
  // Desimal dengan KOMA. "5.5 hari" terbaca sebagai angka asing di layar yang
  // seluruh isinya berbahasa Indonesia.
  const hari = (n: number) => `${formatNumber(n, { maximumFractionDigits: 1 })} hari`;
  const merah = rekap.filter((r) => r.label === "merah").length;

  const pilihanPeriode = [{ value: SEMUA_PERIODE, label: "Semua bulan" }, ...periodeAda];
  const pilihanLabel = [
    { value: "", label: "Semua label" },
    ...(["merah", "kuning", "hijau"] as Label[]).map((l) => ({
      value: l,
      label: LABEL_META[l].label,
      warna: WARNA_LABEL[l],
      hint: String(rekap.filter((r) => r.label === l).length),
    })),
  ];

  return (
    <div className="flex w-full flex-col gap-3">
      <PitaCreative
        ikon="Gauge"
        eyebrow="Creative · Monitoring"
        judul="Penilaian Request Design"
        ringkas={
          <>
            Menilai permintaannya, bukan orangnya —{" "}
            <b className="text-foreground">{BOBOT_WAKTU} poin dihitung otomatis</b> dari jarak hari permintaan ke
            tanggal dibutuhkan, {BOBOT_BRIEF} poin dari ceklis kelengkapan brief.
            {lingkupArea !== null &&
              (lingkupArea.length > 0 ? (
                <> Wilayah Anda: <b className="text-foreground">{lingkupArea.join(", ")}</b>.</>
              ) : (
                <>
                  {" "}
                  <b className="text-amber-600 dark:text-amber-400">
                    Akun Anda belum ditugaskan cabang mana pun
                  </b>
                  , jadi tabelnya kosong sampai penugasannya diisi admin.
                </>
              ))}
            {merah > 0 && (
              <>
                {" "}
                <b className="text-red-600 dark:text-red-400">
                  {merah} pemohon berlabel merah
                </b>{" "}
                pada periode ini.
              </>
            )}
          </>
        }
        aksi={
          bolehKirim ? (
            <LaporanDialog
              periode={periode}
              periodeLabel={periode ? labelPeriode(periode) : "seluruh periode"}
              penerima={penerima}
              areaTerlihat={[...new Set(barisPeriode.map((b) => b.areaId))]}
              jumlahPermintaan={total}
            />
          ) : null
        }
      />

      <StripAngka
        butir={[
          {
            ikon: ClipboardCheck,
            label: "Permintaan dinilai",
            nilai: total,
            sub: periode ? labelPeriode(periode) : "seluruh periode",
          },
          {
            ikon: TriangleAlert,
            label: "Mendadak (H-1 / hari-H)",
            nilai: total === 0 ? "—" : `${Math.round((mendadak / total) * 100)}%`,
            sub: `${mendadak} dari ${total} permintaan`,
            sorot: total > 0 && mendadak / total >= 0.5 ? "bahaya" : "netral",
          },
          {
            ikon: CalendarClock,
            label: "Rata-rata tenggang",
            nilai: rataHari === null ? "—" : hari(rataHari),
            sub: `wajar bila ≥ ${HARI_WAJAR} hari`,
            sorot: rataHari !== null && rataHari >= HARI_WAJAR ? "aman" : "netral",
          },
          {
            ikon: ListChecks,
            label: "Belum dinilai",
            nilai: belumPeriode,
            sub: belumPeriode === 0 ? "semua sudah dinilai" : "menunggu penilaian saat ACC",
          },
        ]}
      />

      <BilahSaring>
        <KotakCari
          nilai={cari}
          onNilai={setCari}
          placeholder="Cari nama, area, atau judul…"
          hitung={
            q || label
              ? {
                  tampil: tampilan === "riwayat" ? riwayatTampil.length : rekapTampil.length,
                  total: tampilan === "riwayat" ? barisPeriode.length : rekap.length,
                }
              : null
          }
          className="w-full min-w-0 sm:w-72"
        />

        <DropdownCreative
          pilihan={pilihanPeriode}
          nilai={periode}
          onNilai={setPeriode}
          ikon={CalendarRange}
          className="w-[calc(50%-0.25rem)] sm:w-44"
        />
        <DropdownCreative
          pilihan={pilihanLabel}
          nilai={label}
          onNilai={(v) => setLabel(v as Label | "")}
          className="w-[calc(50%-0.25rem)] sm:w-40"
        />

        <SegmentedTabs
          className="ml-auto w-full sm:w-auto"
          size="sm"
          value={tampilan}
          onChange={(v) => setTampilan(v as Tampilan)}
          items={[
            { value: "rekap", label: "Rekap Pemohon", icon: TableProperties },
            { value: "riwayat", label: "Riwayat", icon: History },
          ]}
        />
      </BilahSaring>

      {tampilan === "rekap" ? (
        <KartuTabel>
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <Th className="w-12">#</Th>
                <Th className="w-52">Area</Th>
                <Th>Nama</Th>
                <Th className="w-28">Label</Th>
                <Th className="w-20" align="right">Skor</Th>
                <Th className="w-36">Mendadak</Th>
                <Th className="w-32" align="right">Rata-rata tenggang</Th>
                <Th className="w-28" align="right">Permintaan</Th>
              </tr>
            </thead>
            <tbody>
              {rekapTampil.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <KosongCreative
                      judul={rekap.length === 0 ? "Belum ada permintaan dinilai" : "Tidak ada yang cocok dengan saringan ini"}
                      uraian={
                        rekap.length === 0
                          ? "Penilaiannya terisi saat hasil design di-ACC. Selama belum ada yang di-ACC pada periode ini, tabelnya memang kosong."
                          : "Coba ganti bulan, label, atau kosongkan pencariannya."
                      }
                    />
                  </td>
                </tr>
              ) : (
                rekapTampil.map((r, i) => (
                  <tr key={r.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30">
                    <Td className="tabular-nums text-muted-foreground">{i + 1}</Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPinned
                          className={
                            r.areaId === HEAD_OFFICE ? "size-3.5 shrink-0 text-muted-foreground/60" : "size-3.5 shrink-0 text-orange-500"
                          }
                        />
                        <span className="truncate text-[13px] text-foreground/90">{r.areaNama}</span>
                      </span>
                    </Td>
                    <Td>
                      <p className="font-medium text-foreground">{r.nama}</p>
                      {r.outletNama && <p className="text-[11px] text-muted-foreground">{r.outletNama}</p>}
                    </Td>
                    <Td>
                      <Badge tone={LABEL_META[r.label].tone} dot title={LABEL_META[r.label].arti}>
                        {LABEL_META[r.label].label}
                      </Badge>
                    </Td>
                    <Td align="right" className="tabular-nums font-semibold">
                      {r.rataSkor}
                    </Td>
                    <Td>
                      <BatangPersen persen={r.persenMendadak} warna={WARNA_LABEL[r.label]} />
                      <span className="text-[11px] text-muted-foreground">
                        {r.mendadak} dari {r.jumlah}
                      </span>
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {r.rataHari === null ? "—" : hari(r.rataHari)}
                    </Td>
                    <Td align="right" className="tabular-nums text-muted-foreground">
                      {r.jumlah}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </KartuTabel>
      ) : (
        <Riwayat rows={riwayatTampil} kosongTotal={barisPeriode.length === 0} />
      )}

      <CaraBaca />
    </div>
  );
}

/* ─────────────────────────────── riwayat ─────────────────────────────── */

function Riwayat({ rows, kosongTotal }: { rows: BarisDashboard[]; kosongTotal: boolean }) {
  if (rows.length === 0) {
    return (
      <KartuTabel>
        <KosongCreative
          judul={kosongTotal ? "Belum ada permintaan dinilai" : "Tidak ada yang cocok dengan saringan ini"}
          uraian={
            kosongTotal
              ? "Riwayat terisi begitu ada hasil design yang di-ACC pada periode ini."
              : "Coba ganti bulan, label, atau kosongkan pencariannya."
          }
        />
      </KartuTabel>
    );
  }
  return (
    <div className="grid gap-2.5 lg:grid-cols-2">
      {rows.map((b) => (
        <article key={b.requestId} className="rounded-2xl border border-border bg-card p-3.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{b.judul}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                {b.pemohonNama} · {b.areaNama}
                {b.outletNama ? ` · ${b.outletNama}` : ""}
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Diminta {formatDate(b.dibuat)}
                {b.deadline ? ` untuk ${formatDate(b.deadline)}` : " · tanpa tanggal dibutuhkan"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <Badge tone={WAKTU_META[b.waktu].tone}>{WAKTU_META[b.waktu].label}</Badge>
              <Badge tone={LABEL_META[b.hasil.label].tone} dot>
                {b.skor}/100
              </Badge>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {BUTIR_BRIEF.map((butir) => (
              <span
                key={butir.key}
                title={butir.bantu}
                className={
                  b.ceklis[butir.key]
                    ? "rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600 dark:text-emerald-400"
                    : "rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground line-through"
                }
              >
                {butir.label}
              </span>
            ))}
          </div>

          {b.catatan && <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/85">{b.catatan}</p>}
          <p className="mt-1.5 text-[11px] text-muted-foreground">Dinilai {b.dinilaiNama}</p>
        </article>
      ))}
    </div>
  );
}

/* ────────────────────────────── cara baca ────────────────────────────── */

/**
 * Cara angkanya dihitung, ditulis di halaman.
 *
 * Bisa ditutup karena yang membukanya tiap hari sudah hafal, tapi TERBUKA saat
 * pertama kali: dashboard yang angkanya tidak bisa dijelaskan akan dibantah,
 * dan bantahannya tidak bisa dijawab.
 */
function CaraBaca() {
  const [buka, setBuka] = React.useState(true);
  return (
    <div className="rounded-2xl border border-border bg-muted/20">
      <button
        type="button"
        onClick={() => setBuka((v) => !v)}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left"
      >
        <Info className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          Cara angkanya dihitung
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">{buka ? "Sembunyikan" : "Tampilkan"}</span>
      </button>
      {buka && (
        <div className="space-y-2 px-3.5 pb-3.5 text-[12.5px] leading-relaxed text-foreground/85">
          <p>
            <b>{BOBOT_WAKTU} poin</b> dari selisih hari antara permintaan dikirim dan tanggal dibutuhkannya — dihitung
            otomatis dari data, tidak ada yang mengisinya. <b>{BOBOT_BRIEF} poin</b> dari ceklis fakta kelengkapan brief
            ({BUTIR_BRIEF.map((b) => b.label.toLowerCase()).join(", ")}), dicentang saat hasil design di-ACC.
          </p>
          <p>
            Label: <b>hijau ≥ {AMBANG_HIJAU}</b>, <b>kuning ≥ {AMBANG_KUNING}</b>, di bawah itu <b>merah</b>. Rata-ratanya
            dari seluruh permintaan pada periode terpilih, bukan dari yang terakhir — satu permintaan rapi tidak menghapus
            sepuluh yang mendadak sebelumnya.
          </p>
          <p className="text-muted-foreground">
            Area diambil dari cabang pemohonnya. Permintaan dari divisi kantor tercatat sebagai Head Office karena memang
            tidak berasal dari cabang mana pun.
          </p>
        </div>
      )}
    </div>
  );
}
