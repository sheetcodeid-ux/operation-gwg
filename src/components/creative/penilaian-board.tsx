"use client";

import * as React from "react";
import { Building2, CalendarClock, ClipboardCheck, Gauge, TriangleAlert, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { StatTile } from "@/components/ui/stat";
import { BilahModul, KerangkaModul, LegendaHitung, LencanaHak, useLayarPenuh } from "@/components/hcmos/kit-modul";
import {
  AMBANG_HIJAU,
  AMBANG_KUNING,
  BOBOT_BRIEF,
  BOBOT_WAKTU,
  BUTIR_BRIEF,
  HARI_WAJAR,
  LABEL_META,
  WAKTU_META,
  type Label,
} from "@/lib/creative/penilaian-request";
import type { BarisDashboard, DashboardPenilaian } from "@/lib/data/creative-penilaian";
import { formatDate } from "@/lib/utils";

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
 * permintaan cabang ini masuk H-1" tidak.
 */

type Tampilan = "outlet" | "pemohon" | "riwayat";

export function PenilaianBoard({ data }: { data: DashboardPenilaian }) {
  const { bingkai, layarPenuh, alih } = useLayarPenuh();
  const [tampilan, setTampilan] = React.useState<Tampilan>("outlet");
  const [cari, setCari] = React.useState("");
  const [sorotLabel, setSorotLabel] = React.useState<Label | null>(null);

  const q = cari.trim().toLowerCase();
  const rekap = tampilan === "pemohon" ? data.perPemohon : data.perOutlet;
  const rekapTampil = rekap.filter(
    (r) => (!sorotLabel || r.label === sorotLabel) && (!q || `${r.nama} ${r.outletNama ?? ""}`.toLowerCase().includes(q)),
  );
  const riwayatTampil = data.baris.filter(
    (b) =>
      (!sorotLabel || b.hasil.label === sorotLabel) &&
      (!q || `${b.judul} ${b.pemohonNama} ${b.outletNama ?? ""}`.toLowerCase().includes(q)),
  );

  const total = data.baris.length;
  const mendadak = data.baris.filter((b) => b.waktu === "mendadak").length;
  const berhari = data.baris.filter((b) => b.hari !== null).map((b) => b.hari!);
  const rataHari = berhari.length ? Math.round((berhari.reduce((a, b) => a + b, 0) / berhari.length) * 10) / 10 : null;

  // Legenda dihitung dari SELURUH baris, bukan dari yang sedang tampak:
  // menyorot merah tidak boleh membuat hijau jatuh ke nol.
  const legenda = (["merah", "kuning", "hijau"] as Label[]).map((l) => ({
    key: l,
    kode: l === "merah" ? "M" : l === "kuning" ? "K" : "H",
    label: LABEL_META[l].label,
    jumlah: rekap.filter((r) => r.label === l).length,
    warna: (l === "merah" ? ["#dc2626", "#f87171"] : l === "kuning" ? ["#d97706", "#fbbf24"] : ["#059669", "#34d399"]) as [
      string,
      string,
    ],
    judulPenuh: LABEL_META[l].arti,
  }));

  return (
    <KerangkaModul ref={bingkai}>
      <BilahModul
        ikon={Gauge}
        gradien="from-rose-500 via-orange-500 to-amber-500 shadow-orange-500/20"
        judul="Penilaian Request Design"
        ringkas={
          total === 0
            ? "Belum ada permintaan design selesai yang sudah dinilai"
            : `${total} permintaan dinilai · ${mendadak} mendadak (${Math.round((mendadak / total) * 100)}%) · rata-rata ${rataHari ?? "—"} hari tenggang`
        }
        cari={cari}
        onCari={setCari}
        cariPlaceholder="Cari outlet, pemohon, atau judul…"
        hitung={{
          tampil: tampilan === "riwayat" ? riwayatTampil.length : rekapTampil.length,
          total: tampilan === "riwayat" ? data.baris.length : rekap.length,
        }}
        menyaring={q !== "" || sorotLabel !== null}
        onBersihkan={() => {
          setCari("");
          setSorotLabel(null);
        }}
        tampilan={
          <SegmentedTabs
            className="w-full sm:w-auto"
            size="sm"
            value={tampilan}
            onChange={(v) => setTampilan(v as Tampilan)}
            items={[
              { value: "outlet", label: "Per Outlet", icon: Building2 },
              { value: "pemohon", label: "Per Pemohon", icon: UserRound },
              { value: "riwayat", label: "Riwayat", icon: ClipboardCheck },
            ]}
          />
        }
        layarPenuh={layarPenuh}
        onLayarPenuh={alih}
      />

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={ClipboardCheck} label="Permintaan Dinilai" value={total} sub="design yang sudah selesai" />
          <StatTile
            icon={TriangleAlert}
            label="Mendadak (H-1 / hari-H)"
            value={total === 0 ? "—" : `${Math.round((mendadak / total) * 100)}%`}
            sub={`${mendadak} dari ${total} permintaan`}
          />
          <StatTile
            icon={CalendarClock}
            label="Rata-rata Tenggang"
            value={rataHari === null ? "—" : `${rataHari} hari`}
            sub={`wajar bila ≥ ${HARI_WAJAR} hari`}
          />
          <StatTile
            icon={Gauge}
            label="Belum Dinilai"
            value={data.belumDinilai}
            sub={data.belumDinilai === 0 ? "semua sudah dinilai" : "menunggu penilaian saat ACC"}
          />
        </div>

        {/* Cara bacanya ditulis di halaman, bukan disimpan di kepala pembuatnya.
            Dashboard yang angkanya tidak bisa dijelaskan akan dibantah, dan
            bantahannya tidak bisa dijawab. */}
        <div className="mb-3 rounded-xl border border-border bg-muted/20 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cara angkanya dihitung</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-foreground/85">
            <b>{BOBOT_WAKTU} poin</b> dari selisih hari antara permintaan dikirim dan tanggal dibutuhkannya — dihitung
            otomatis dari data, tidak ada yang mengisinya.{" "}
            <b>{BOBOT_BRIEF} poin</b> dari ceklis fakta kelengkapan brief ({BUTIR_BRIEF.map((b) => b.label.toLowerCase()).join(", ")}),
            dicentang saat hasil design di-ACC. Label: hijau ≥ {AMBANG_HIJAU}, kuning ≥ {AMBANG_KUNING}, di bawah itu merah.
            Rata-ratanya dari seluruh permintaan, bukan dari yang terakhir.
          </p>
        </div>

        {tampilan === "riwayat" ? (
          <Riwayat rows={riwayatTampil} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <Th className="w-10">#</Th>
                  <Th>{tampilan === "pemohon" ? "Pemohon" : "Outlet"}</Th>
                  <Th className="w-24">Label</Th>
                  <Th className="w-24">Skor</Th>
                  <Th className="w-32">Mendadak</Th>
                  <Th className="w-32">Rata-rata tenggang</Th>
                  <Th className="w-24">Permintaan</Th>
                </tr>
              </thead>
              <tbody>
                {rekapTampil.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      {rekap.length === 0
                        ? "Belum ada permintaan design selesai yang dinilai. Penilaiannya terisi saat hasil design di-ACC."
                        : "Tidak ada yang cocok dengan saringan ini."}
                    </td>
                  </tr>
                ) : (
                  rekapTampil.map((r, i) => (
                    <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                      <Td className="tabular-nums text-muted-foreground">{i + 1}</Td>
                      <Td>
                        <p className="font-medium text-foreground">{r.nama}</p>
                        {tampilan === "pemohon" && r.outletNama && (
                          <p className="text-[11px] text-muted-foreground">{r.outletNama}</p>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={LABEL_META[r.label].tone} dot>
                          {LABEL_META[r.label].label}
                        </Badge>
                      </Td>
                      <Td className="tabular-nums font-medium">{r.rataSkor}</Td>
                      <Td>
                        <span className="tabular-nums">{r.persenMendadak}%</span>
                        <span className="ml-1 text-[11px] text-muted-foreground">({r.mendadak})</span>
                      </Td>
                      <Td className="tabular-nums">{r.rataHari === null ? "—" : `${r.rataHari} hari`}</Td>
                      <Td className="tabular-nums text-muted-foreground">{r.jumlah}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <LegendaHitung
        butir={legenda}
        sorot={sorotLabel}
        onSorot={(k) => setSorotLabel((v) => (v === k ? null : (k as Label)))}
        kiri={<LencanaHak bolehUbah={false} catatan="Dinilai saat ACC hasil" />}
      />
    </KerangkaModul>
  );
}

function Riwayat({ rows }: { rows: BarisDashboard[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Belum ada permintaan yang dinilai pada saringan ini.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {rows.map((b) => (
        <div key={b.requestId} className="rounded-xl border border-border bg-card p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{b.judul}</p>
              <p className="text-[11px] text-muted-foreground">
                {b.pemohonNama}
                {b.outletNama ? ` · ${b.outletNama}` : ""} · diminta {formatDate(b.dibuat)}
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

          <div className="mt-2 flex flex-wrap gap-1.5">
            {BUTIR_BRIEF.map((butir) => (
              <span
                key={butir.key}
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

          {b.catatan && <p className="mt-2 whitespace-pre-wrap text-[12px] text-foreground/85">{b.catatan}</p>}
          <p className="mt-1 text-[11px] text-muted-foreground">Dinilai {b.dinilaiNama}</p>
        </div>
      ))}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-top ${className}`}>{children}</td>;
}
