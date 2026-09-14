"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Info, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import type { DetailHarian, PilihanArea } from "@/lib/data/daily-outlet";
import { BATAS_TERCAPAI, type BarisHarian, type HariKolom } from "@/lib/ops/harian";
import { cn, formatIDR, formatIDRShort, formatNumber } from "@/lib/utils";

/**
 * DAILY — penjualan hari demi hari, satu baris per outlet.
 *
 * Laporan bulanan menjawab "berapa"; tabel ini menjawab "KAPAN". Outlet yang
 * turun dua puluh persen sebulan bisa berarti dua hal yang sama sekali
 * berbeda: turun sedikit tiap hari, atau tutup empat hari. Keduanya terbaca
 * sama di laporan bulanan, dan yang harus dikerjakan berbeda jauh.
 *
 * TIGA PUluh SATU KOLOM tidak muat di layar mana pun, jadi yang dijaga bukan
 * "semuanya terlihat sekaligus" melainkan "yang menggeser tidak pernah
 * kehilangan pegangannya":
 *  • kiri menempel — nomor, nama outlet, capaian bulan ini;
 *  • kanan menempel — kekurangan omset, angka yang justru paling dicari;
 *  • atas menempel — tanggal tetap terbaca sampai outlet ke-58.
 * Yang bergeser hanya tanggalnya, di antara dua tepi yang diam.
 */

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const labelBulan = (periode: string) => {
  const [th, bl] = periode.split("-").map(Number);
  return `${BULAN[bl - 1]} ${th}`;
};

const geserBulan = (periode: string, arah: number) => {
  const [th, bl] = periode.split("-").map(Number);
  const t = new Date(Date.UTC(th, bl - 1 + arah, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Lebar kolom yang menempel — dipakai tajuk dan isinya, jadi satu angka saja. */
const L_NO = 40;
const L_NAMA = 150;
const L_BULAN = 148;
const L_KURANG = 150;

/* ───────────────────────────── potongan kecil ───────────────────────────── */

/**
 * Keterangan yang hanya muncul saat ditunjuk.
 *
 * Kalimat penjelas yang dicetak permanen di tajuk kolom memakan dua baris
 * tinggi untuk seluruh tabel — dibaca sekali, lalu menghalangi selamanya.
 */
function Info1({ teks }: { teks: string }) {
  return (
    <span className="group/i relative inline-flex align-middle">
      <Info className="size-3.5 cursor-help text-muted-foreground/70" />
      <span className="pointer-events-none absolute right-0 top-5 z-50 hidden w-56 rounded-lg border border-border bg-popover p-2 text-left text-[11px] font-normal normal-case leading-relaxed tracking-normal text-popover-foreground shadow-lg group-hover/i:block">
        {teks}
      </span>
    </span>
  );
}

function Ubah({ nilai, besar = false }: { nilai: number | null; besar?: boolean }) {
  if (nilai === null) return null;
  const naik = nilai >= 0;
  const Ikon = naik ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 tabular-nums",
        besar ? "text-[11.5px] font-semibold" : "text-[10.5px]",
        naik ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
      )}
    >
      <Ikon className={besar ? "size-3.5" : "size-3"} />
      {formatNumber(Math.abs(nilai), { maximumFractionDigits: 0 })}%
    </span>
  );
}

/**
 * Nama outlet pada lebar yang sempit — BERJALAN saat ditunjuk.
 *
 * Dipotong dengan titik-titik, "Nordu Coffee Singkawang Diponegoro" dan "Nordu
 * Coffee Singkawang Sudirman" terbaca persis sama. Melebarkan kolomnya memakan
 * tempat tanggal, yang jumlahnya tiga puluh satu; jadi namanya dibiarkan
 * sempit dan digeser sendiri begitu kursor berhenti di atasnya.
 */
function NamaBerjalan({ nama }: { nama: string }) {
  // Nama yang muat tidak diberi apa-apa: tepi yang memudar pada nama pendek
  // membuatnya terbaca seakan terpotong padahal utuh.
  const panjang = nama.length > 20;
  return (
    <span className={cn("block overflow-hidden", panjang && "nama-panjang")} title={nama}>
      <span className="block whitespace-nowrap text-[12.5px] font-medium text-foreground">{nama}</span>
    </span>
  );
}

/** Warna capaian sehari — hijau tercapai, kuning mendekati, merah tertinggal. */
function nadaCapaian(c: number | null): string {
  if (c === null) return "text-muted-foreground";
  if (c >= BATAS_TERCAPAI) return "text-emerald-600 dark:text-emerald-400";
  if (c >= 80) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function SelHari({
  nilai,
  ubah,
  capaian,
  mode,
}: {
  nilai: number | null;
  ubah: number | null;
  capaian: number | null;
  mode: Mode;
}) {
  if (nilai === null) {
    return (
      <td className="border-l border-border/60 px-2 py-1.5 text-center align-middle">
        {/* Belum ditarik dari ESB — BUKAN nol. Nol berarti outletnya tidak
            berjualan sehari penuh, dan itu tuduhan yang berbeda jauh. */}
        <span className="text-[11px] text-muted-foreground/50">—</span>
      </td>
    );
  }
  const tercapai = capaian !== null && capaian >= BATAS_TERCAPAI;
  return (
    <td
      className={cn(
        "border-l border-border/60 px-2 py-1.5 text-right align-middle",
        mode === "target" && tercapai && "bg-emerald-500/10",
        mode === "target" && capaian !== null && !tercapai && "bg-rose-500/[0.07]",
      )}
    >
      <span className="block whitespace-nowrap text-[11.5px] font-medium tabular-nums text-foreground">
        {formatIDRShort(nilai)}
      </span>
      {mode === "target" ? (
        <span className={cn("block text-[10.5px] font-semibold tabular-nums", nadaCapaian(capaian))}>
          {capaian === null ? "—" : `${formatNumber(capaian, { maximumFractionDigits: 0 })}%`}
        </span>
      ) : (
        <Ubah nilai={ubah} />
      )}
    </td>
  );
}

type Mode = "banding" | "target";

function Baris({
  baris,
  nomor,
  kolom,
  mode,
  tebal = false,
}: {
  baris: BarisHarian;
  nomor: number | null;
  kolom: HariKolom[];
  mode: Mode;
  tebal?: boolean;
}) {
  const dasar = tebal ? "bg-muted" : "bg-card";
  const lunas = baris.kurang !== null && baris.kurang <= 0;
  return (
    <tr className={cn("baris-harian border-t border-border", tebal && "bg-muted font-semibold")}>
      <td className={cn("sel-tempel sticky z-20 px-2 py-1.5 text-center text-[11px] tabular-nums text-muted-foreground", dasar)} style={{ left: 0, width: L_NO }}>
        {nomor ?? ""}
      </td>
      <td className={cn("sel-tempel sticky z-20 px-2 py-1.5", dasar)} style={{ left: L_NO, width: L_NAMA, maxWidth: L_NAMA }}>
        <NamaBerjalan nama={baris.nama} />
        <span className="block truncate text-[10.5px] text-muted-foreground">{baris.area}</span>
      </td>
      <td
        className={cn("sel-tempel sticky z-20 border-r border-border px-2 py-1.5 text-right", dasar)}
        style={{ left: L_NO + L_NAMA, width: L_BULAN }}
      >
        <span className="block whitespace-nowrap text-[12.5px] font-semibold tabular-nums text-foreground">
          {baris.bulanIni === null ? "—" : formatIDR(baris.bulanIni)}
        </span>
        {mode === "target" ? (
          <span className="flex items-center justify-end gap-1 text-[10.5px] tabular-nums text-muted-foreground">
            <Target className="size-3" />
            {baris.targetBulan == null ? "tanpa target" : formatIDRShort(baris.targetBulan)}
          </span>
        ) : (
          <Ubah nilai={baris.mom} besar />
        )}
      </td>

      {kolom.map((h, i) => (
        <SelHari
          key={h.tanggal}
          nilai={baris.hari[i] ?? null}
          ubah={baris.ubah[i] ?? null}
          capaian={baris.capaian[i] ?? null}
          mode={mode}
        />
      ))}

      {/* Tepi kanan yang menempel: kekurangan omset. Ditaruh di ujung karena
          itu ujung ceritanya — sesudah membaca hari demi hari, yang dicari
          orang bukan "sudah berapa" melainkan "kurang berapa lagi". */}
      <td
        className={cn("sel-tempel sticky right-0 z-20 border-l border-border px-3 py-1.5 text-right", dasar)}
        style={{ width: L_KURANG }}
      >
        {baris.kurang === null ? (
          <span className="text-[11px] text-muted-foreground">belum bertarget</span>
        ) : lunas ? (
          <>
            <span className="block whitespace-nowrap text-[12.5px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              Tercapai
            </span>
            <span className="block text-[10.5px] tabular-nums text-muted-foreground">
              {baris.hariTercapai}/{baris.hariTerisi} hari di jalur
            </span>
          </>
        ) : (
          <>
            <span className="block whitespace-nowrap text-[12.5px] font-semibold tabular-nums text-foreground">
              {formatIDR(baris.kurang)}
            </span>
            <span className="block whitespace-nowrap text-[10.5px] tabular-nums text-muted-foreground">
              {baris.perHariSisa === null
                ? `${baris.hariTercapai}/${baris.hariTerisi} hari di jalur`
                : `${formatIDRShort(baris.perHariSisa)}/hari × ${baris.sisaHari} hari`}
            </span>
          </>
        )}
      </td>
    </tr>
  );
}

/* ────────────────────────────── tabel utuh ────────────────────────────── */

export function TabelHarian({
  detail,
  area,
  areaTerpilih,
  bisaPilihArea,
}: {
  detail: DetailHarian;
  /** Pilihan Coordinator Area; kosong berarti yang membuka tidak boleh memilih. */
  area?: PilihanArea[];
  areaTerpilih?: string;
  bisaPilihArea?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("target");

  const pindah = (p: { bulan?: string; area?: string }) => {
    const q = new URLSearchParams();
    q.set("bulan", p.bulan ?? detail.periode);
    const a = p.area ?? areaTerpilih ?? "";
    if (a) q.set("area", a);
    router.push(`/operational/daily?${q.toString()}`);
  };

  const ringkas = detail.total;

  return (
    <div className="space-y-3">
      {/* Nama animasinya ditulis di sini, bukan di berkas gaya global: satu-
          satunya yang memakainya adalah nama outlet di tabel ini. */}
      {/* Ditulis di sini, bukan di berkas gaya global: satu-satunya yang
          memakainya adalah nama outlet di tabel ini.

          TEPINYA MEMUDAR, bukan dipotong titik-titik. "Nordu Coffee Singkaw"
          yang berhenti mendadak terbaca seperti nama yang memang begitu;
          tepi yang memudar memberi tahu bahwa masih ada lanjutannya — dan
          lanjutannya ditunjukkan sendiri begitu kursor berhenti di barisnya. */}
      <style>{`
        @keyframes jalan{0%,12%{transform:translateX(0)}88%,100%{transform:translateX(calc(-100% + ${L_NAMA - 20}px))}}
        .nama-panjang{-webkit-mask-image:linear-gradient(to right,#000 78%,transparent);mask-image:linear-gradient(to right,#000 78%,transparent)}
        .baris-harian:hover .sel-tempel{background-color:var(--muted)}
        .baris-harian:hover .nama-panjang{-webkit-mask-image:none;mask-image:none}
        .baris-harian:hover .nama-panjang>span{animation:jalan 7s linear infinite}
      `}</style>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
          <button
            type="button"
            aria-label="Bulan sebelumnya"
            onClick={() => pindah({ bulan: geserBulan(detail.periode, -1) })}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[8.5rem] px-2 text-center text-[13px] font-medium text-foreground">
            {labelBulan(detail.periode)}
          </span>
          <button
            type="button"
            aria-label="Bulan berikutnya"
            onClick={() => pindah({ bulan: geserBulan(detail.periode, 1) })}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {bisaPilihArea && area && area.length > 0 && (
          <div className="w-56">
            <Combobox
              value={areaTerpilih ?? ""}
              onChange={(v) => pindah({ area: v })}
              options={[
                { value: "", label: "Semua area" },
                ...area.map((a) => ({ value: a.value, label: `${a.label} · ${a.outlet} outlet` })),
              ]}
              searchPlaceholder="Cari coordinator…"
              matchTriggerWidth
            />
          </div>
        )}

        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          {(["target", "banding"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[12px] font-medium",
                mode === m ? "bg-brand-500 text-white" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "target" ? "Capaian target" : "Banding hari lalu"}
            </button>
          ))}
        </div>
      </div>

      {/* Ringkasan sebaris — yang dicari lebih dulu sebelum menyisir tabelnya. */}
      {ringkas && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Kartu judul="Omzet bulan ini" nilai={ringkas.bulanIni === null ? "—" : formatIDR(ringkas.bulanIni)} kaki={ringkas.area} />
          <Kartu
            judul="Target bulan ini"
            nilai={ringkas.targetBulan == null ? "—" : formatIDR(ringkas.targetBulan)}
            kaki="rata-rata 3 bulan + pertumbuhan"
          />
          <Kartu
            judul={ringkas.kurang !== null && ringkas.kurang <= 0 ? "Sudah tercapai" : "Kurang untuk capai target"}
            nilai={ringkas.kurang === null ? "—" : formatIDR(ringkas.kurang)}
            kaki={
              ringkas.perHariSisa === null
                ? `${ringkas.sisaHari} hari tersisa`
                : `${formatIDRShort(ringkas.perHariSisa)} per hari × ${ringkas.sisaHari} hari`
            }
            nada={ringkas.kurang !== null && ringkas.kurang <= 0 ? "baik" : undefined}
          />
          <Kartu
            judul="Hari di jalur"
            nilai={`${ringkas.hariTercapai} / ${ringkas.hariTerisi}`}
            kaki="hari yang mencapai target hariannya"
          />
        </div>
      )}

      <div className="max-h-[70vh] overflow-auto rounded-2xl border border-border bg-card">
        <table className="w-max min-w-full border-collapse text-left">
          <thead className="sticky top-0 z-30">
            <tr className="bg-muted">
              <th className="sticky z-40 bg-muted px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" style={{ left: 0, width: L_NO }}>
                #
              </th>
              <th className="sticky z-40 bg-muted px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" style={{ left: L_NO, width: L_NAMA }}>
                Nama Outlet
              </th>
              <th
                className="sticky z-40 border-r border-border bg-muted px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                style={{ left: L_NO + L_NAMA, width: L_BULAN }}
              >
                <span className="inline-flex items-center gap-1">
                  Bulan Ini
                  <Info1
                    teks={
                      mode === "target"
                        ? "Omzet yang sudah masuk bulan ini, dengan target sebulan outlet itu di bawahnya — rata-rata tiga bulan penuh sebelumnya ditambah pertumbuhan, sama persis dengan target KPI-nya."
                        : "Omzet yang sudah masuk bulan ini, dibandingkan dengan TANGGAL YANG SAMA bulan lalu — bukan dengan sebulan penuh, yang akan membuat setiap outlet selalu terbaca minus sepanjang bulan berjalan."
                    }
                  />
                </span>
              </th>
              {detail.kolom.map((h) => (
                <th
                  key={h.tanggal}
                  className={cn(
                    "min-w-[5.4rem] border-l border-border/60 bg-muted px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide",
                    // Akhir pekan ditandai: pola naik-turun penjualan F&B hampir
                    // selalu mengikuti hari, dan tanpa penanda ini setiap Sabtu
                    // terbaca sebagai lonjakan yang tak dijelaskan.
                    h.pekan ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
                  )}
                >
                  {String(h.tanggal).padStart(2, "0")}
                  <span className="block text-[9px] font-normal">{h.hari}</span>
                </th>
              ))}
              <th
                className="sticky right-0 z-40 border-l border-border bg-muted px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                style={{ width: L_KURANG }}
              >
                <span className="inline-flex items-center gap-1">
                  Kurang
                  <Info1 teks="Target sebulan dikurangi omzet yang sudah masuk, beserta berapa per hari yang harus dikejar di sisa hari bulan ini." />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {detail.baris.map((b, i) => (
              <Baris key={b.outletId} baris={b} nomor={i + 1} kolom={detail.kolom} mode={mode} />
            ))}
            {detail.baris.length === 0 && (
              <tr>
                <td colSpan={4 + detail.kolom.length} className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                  Belum ada outlet yang bisa ditampilkan di sini.
                </td>
              </tr>
            )}
          </tbody>
          {detail.total && (
            <tfoot className="sticky bottom-0 z-30">
              <Baris baris={detail.total} nomor={null} kolom={detail.kolom} mode={mode} tebal />
            </tfoot>
          )}
        </table>
      </div>

      <div className="space-y-1.5">
        {detail.tanpaCabang.length > 0 && (
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            {detail.tanpaCabang.length} outlet belum dipasangkan ke cabang ESB, jadi belum punya angka harian:{" "}
            {detail.tanpaCabang.join(", ")}.
          </p>
        )}
        {detail.tanpaTarget.length > 0 && (
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            {detail.tanpaTarget.length} outlet belum genap tiga bulan berjalan, jadi belum punya target dan tidak ikut
            baris gabungan: {detail.tanpaTarget.join(", ")}.
          </p>
        )}
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          Angkanya net sales dari ESB, ditarik sendiri oleh sistem hari demi hari. Tanggal bertanda “—” belum sampai
          penarikannya — itu bukan nol, dan bukan outlet yang tidak berjualan.
        </p>
      </div>
    </div>
  );
}

function Kartu({
  judul,
  nilai,
  kaki,
  nada,
}: {
  judul: string;
  nilai: string;
  kaki: string;
  nada?: "baik";
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{judul}</p>
      <p
        className={cn(
          "mt-0.5 truncate text-[17px] font-semibold tabular-nums",
          nada === "baik" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
        )}
      >
        {nilai}
      </p>
      <p className="truncate text-[11px] text-muted-foreground">{kaki}</p>
    </div>
  );
}
