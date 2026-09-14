"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Info, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { Popover } from "@/components/ui/popover";
import { WORK_BRANDS } from "@/lib/constants";
import type { DetailHarian, PilihanArea } from "@/lib/data/daily-outlet";
import { merekOutlet } from "@/lib/kpi/merek";
import { LOGO_MEREK } from "@/lib/ops/logo-merek";
import { BATAS_TERCAPAI, kartuMerek, type BarisHarian, type HariKolom, type KartuMerek } from "@/lib/ops/harian";
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

/**
 * Lebar kolom yang menempel — dipakai tajuk dan isinya, jadi satu angka saja.
 *
 * DIKUNCI, bukan disarankan. `width` pada sel tabel hanya usulan: kalau isinya
 * lebih lebar, kolomnya melar — sementara `left` sel berikutnya tetap dihitung
 * dari angka di bawah ini. Selisihnya jadi celah, dan di celah itu tanggal yang
 * sedang bergeser terlihat menyembul di antara kolom yang seharusnya diam.
 */
const L_NO = 40;
const L_NAMA = 156;
const L_BULAN = 158;
const L_KURANG = 156;

/** Lebar seluruh tepi kiri yang membeku. */
const L_KIRI = L_NO + L_NAMA + L_BULAN;

/** Lebar yang tidak bisa ditawar isinya. */
const kunci = (w: number, kiri?: number) => ({
  width: w,
  minWidth: w,
  maxWidth: w,
  ...(kiri === undefined ? {} : { left: kiri }),
});

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
      <td className="snap-start border-l border-border/60 px-2 py-1.5 text-center align-middle">
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
        "snap-start border-l border-border/60 px-2 py-1.5 text-right align-middle",
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

/* ───────────────────────────── kartu per merek ───────────────────────────── */

/**
 * Warna merek — DIPAKAI BERSAMA lencana merek di seluruh aplikasi.
 *
 * Diambil dari `merekOutlet`, bukan ditulis ulang di sini: dua daftar warna
 * untuk empat merek yang sama akan berbeda begitu salah satunya diubah, dan
 * satu merek tampil biru di satu halaman dan hijau di halaman sebelahnya.
 */
const NADA_MEREK: Record<string, string> = {
  danger: "bg-rose-500",
  cyan: "bg-cyan-500",
  amber: "bg-amber-500",
  success: "bg-emerald-500",
  brand: "bg-brand-500",
};

/**
 * Lambang merek — HURUF DEPANNYA, sampai berkas logonya ada.
 *
 * Ditulis begini dengan sengaja, bukan kotak kosong menunggu gambar: huruf
 * berwarna tetap membedakan keempat kartu dari kejauhan, dan begitu logonya
 * masuk, yang berubah hanya isi kotak ini.
 */
function LambangMerek({ merek, logo }: { merek: string; logo?: string }) {
  const nada = NADA_MEREK[merekOutlet(merek)?.tone ?? "brand"] ?? "bg-brand-500";
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt={merek} className="size-7 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white", nada)}>
      {merek.slice(0, 1)}
    </span>
  );
}

/**
 * Grafik sekelumit — bentuk pergerakan sebulan, bukan angkanya.
 *
 * Tanpa sumbu dan tanpa angka dengan sengaja: yang dijawabnya cuma satu
 * pertanyaan, "naik atau turun", dan menambahkan sumbu pada gambar selebar
 * tujuh puluh piksel hanya membuat keduanya tidak terbaca.
 */
function Sekelumit({ nilai, naik }: { nilai: (number | null)[]; naik: boolean }) {
  const ada = nilai.map((v, i) => ({ v, i })).filter((t): t is { v: number; i: number } => t.v !== null);
  if (ada.length < 2) return <span className="h-7 w-[72px]" />;
  const min = Math.min(...ada.map((t) => t.v));
  const max = Math.max(...ada.map((t) => t.v));
  const rentang = max - min || 1;
  const titik = ada
    .map((t, n) => `${(n / (ada.length - 1)) * 70},${26 - ((t.v - min) / rentang) * 22}`)
    .join(" ");
  return (
    <svg viewBox="0 0 70 28" className="h-7 w-[72px] shrink-0" aria-hidden>
      <polyline
        points={titik}
        fill="none"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={naik ? "stroke-emerald-500" : "stroke-rose-500"}
      />
    </svg>
  );
}

function KartuBrand({ kartu, logo }: { kartu: KartuMerek; logo?: string }) {
  const naik = (kartu.mom ?? 0) >= 0;
  return (
    <div className="w-[19rem] shrink-0 snap-start rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <LambangMerek merek={kartu.merek} logo={logo} />
        <span className="truncate text-[15px] font-semibold text-foreground">{kartu.merek}</span>
        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{kartu.outlet} outlet</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold tabular-nums text-foreground">
            {kartu.bulanIni === null ? "—" : formatIDR(kartu.bulanIni)}
          </p>
          <p
            className={cn(
              "mt-0.5 flex items-center gap-1 text-[12.5px] font-semibold tabular-nums",
              kartu.mom === null
                ? "text-muted-foreground"
                : naik
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400",
            )}
          >
            {kartu.mom === null ? (
              "—"
            ) : (
              <>
                {naik ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                {formatNumber(Math.abs(kartu.mom), { maximumFractionDigits: 2 })}%
              </>
            )}
            <span className="font-normal text-muted-foreground">vs bulan lalu</span>
          </p>
        </div>
        <Sekelumit nilai={kartu.hari} naik={naik} />
      </div>
      {/* Capaian terhadap targetnya sendiri — angka yang membedakan merek yang
          tumbuh dari merek yang sekadar besar. */}
      <div className="mt-2.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Capaian target</span>
          <span className="tabular-nums">
            {kartu.capaian === null ? "belum bertarget" : `${formatNumber(kartu.capaian, { maximumFractionDigits: 0 })}%`}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full",
              (kartu.capaian ?? 0) >= BATAS_TERCAPAI ? "bg-emerald-500" : "bg-brand-500",
            )}
            style={{ width: `${Math.min(100, Math.max(0, kartu.capaian ?? 0))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** Deret kartu yang bisa digeser — empat merek belum tentu muat di satu layar. */
function DeretMerek({ kartu, logo }: { kartu: KartuMerek[]; logo?: Record<string, string> }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [arah, setArah] = React.useState<{ kiri: boolean; kanan: boolean }>({ kiri: false, kanan: false });

  // Panahnya muncul hanya kalau memang ADA yang tersembunyi — panah yang tidak
  // menggeser apa-apa mengajari orang untuk mengabaikannya, termasuk saat ia
  // benar-benar berarti.
  const periksa = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const sisa = el.scrollWidth - el.clientWidth - el.scrollLeft;
    setArah({ kiri: el.scrollLeft > 4, kanan: sisa > 4 });
  }, []);

  React.useEffect(() => {
    periksa();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(periksa);
    ro.observe(el);
    return () => ro.disconnect();
  }, [periksa, kartu.length]);

  if (kartu.length === 0) return null;
  const geser = (n: number) => ref.current?.scrollBy({ left: n * 320, behavior: "smooth" });

  return (
    <div className="relative">
      <div ref={ref} onScroll={periksa} className="scroll-fade-x flex snap-x gap-2.5 overflow-x-auto pb-1">
        {kartu.map((k) => (
          <KartuBrand key={k.merek} kartu={k} logo={logo?.[k.merek]} />
        ))}
      </div>
      {(["kiri", "kanan"] as const).map((sisi) =>
        arah[sisi] ? (
          <button
            key={sisi}
            type="button"
            aria-label={sisi === "kiri" ? "Kartu sebelumnya" : "Kartu berikutnya"}
            onClick={() => geser(sisi === "kiri" ? -1 : 1)}
            className={cn(
              "absolute top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-md hover:text-foreground",
              sisi === "kiri" ? "left-1" : "right-1",
            )}
          >
            {sisi === "kiri" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : null,
      )}
    </div>
  );
}

type Mode = "banding" | "target";

function Baris({
  baris,
  nomor,
  kolom,
  mode,
  tebal = false,
  lapis = "z-20",
}: {
  baris: BarisHarian;
  nomor: number | null;
  kolom: HariKolom[];
  mode: Mode;
  tebal?: boolean;
  /**
   * Lapisan sel yang menempel.
   *
   * Baris gabungan menempel di BAWAH layar, jadi sel-sel tepinya harus berada
   * di atas sel tepi baris biasa — kalau sama, keduanya saling menembus persis
   * di titik silangnya, dan yang terbaca di pojok adalah dua angka bertumpuk.
   */
  lapis?: string;
}) {
  const dasar = tebal ? "bg-muted" : "bg-card";
  const lunas = baris.kurang !== null && baris.kurang <= 0;
  return (
    <tr className={cn("baris-harian border-t border-border", tebal && "bg-muted font-semibold")}>
      <td className={cn("sel-tempel sticky px-2 py-1.5 text-center text-[11px] tabular-nums text-muted-foreground", lapis, dasar)} style={kunci(L_NO, 0)}>
        {nomor ?? ""}
      </td>
      <td className={cn("sel-tempel sticky px-2 py-1.5", lapis, dasar)} style={kunci(L_NAMA, L_NO)}>
        <NamaBerjalan nama={baris.nama} />
        <span className="block truncate text-[10.5px] text-muted-foreground">{baris.area}</span>
      </td>
      <td
        className={cn("sel-tempel tepi-kiri sticky border-r border-border px-2 py-1.5 text-right", lapis, dasar)}
        style={kunci(L_BULAN, L_NO + L_NAMA)}
      >
        <span className="block truncate text-[12.5px] font-semibold tabular-nums text-foreground">
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
        className={cn("sel-tempel tepi-kanan sticky right-0 border-l border-border px-3 py-1.5 text-right", lapis, dasar)}
        style={kunci(L_KURANG)}
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
            <span className="block truncate text-[12.5px] font-semibold tabular-nums text-foreground">
              {formatIDR(baris.kurang)}
            </span>
            <span className="block truncate text-[10.5px] tabular-nums text-muted-foreground">
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
  const merek = React.useMemo(
    () => kartuMerek(detail.baris, (n) => merekOutlet(n)?.label ?? null, WORK_BRANDS),
    [detail.baris],
  );

  /**
   * SATU LAYAR PENUH, sejak dibuka.
   *
   * Tabel setinggi 70% layar menyisakan ruang kosong di bawahnya dan tetap
   * memaksa menggulir halaman DI LUAR tabel untuk melihat baris terakhir — dua
   * gulungan untuk satu tabel. Tingginya sekarang mengisi sisa layar apa pun
   * yang ada di atasnya, dan yang bergulir hanya isi tabelnya.
   */
  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col gap-3">
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
        .tepi-kiri{box-shadow:6px 0 8px -6px rgb(0 0 0/.14)}
        .tepi-kanan{box-shadow:-6px 0 8px -6px rgb(0 0 0/.14)}
        .baris-harian:hover .nama-panjang{-webkit-mask-image:none;mask-image:none}
        .baris-harian:hover .nama-panjang>span{animation:jalan 7s linear infinite}
      `}</style>

      {/* Kartu per merek — pertanyaan satu tingkat di atas tabelnya: merek mana
          yang sedang jalan, sebelum satu baris outlet pun dibaca. */}
      <DeretMerek kartu={merek} logo={LOGO_MEREK} />

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

        <div className="ml-auto flex items-center gap-2">
          {ringkas && (
            <span className="hidden items-center gap-3 rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] lg:inline-flex">
              <span className="text-muted-foreground">
                Kurang{" "}
                <b className={cn("tabular-nums", ringkas.kurang !== null && ringkas.kurang <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
                  {ringkas.kurang === null ? "—" : formatIDR(ringkas.kurang)}
                </b>
              </span>
              <span className="h-3.5 w-px bg-border" />
              <span className="text-muted-foreground">
                Hari di jalur <b className="tabular-nums text-foreground">{ringkas.hariTercapai}/{ringkas.hariTerisi}</b>
              </span>
            </span>
          )}
          <Catatan detail={detail} />
        </div>
      </div>

      {/* GESERNYA BERHENTI PAS DI BATAS KOLOM. Tanpa ini, kolom paling kiri di
          daerah yang bergeser selalu berhenti separuh — yang terbaca di
          sebelah tepi beku cuma potongan huruf, dan itu terlihat persis
          seperti dua kolom yang saling tembus. */}
      <div
        className="min-h-0 flex-1 snap-x snap-mandatory overflow-auto rounded-2xl border border-border bg-card"
        style={{ scrollPaddingLeft: L_KIRI, scrollPaddingRight: L_KURANG }}
      >
        <table className="w-max min-w-full border-collapse text-left">
          <thead className="sticky top-0 z-30">
            <tr className="bg-muted">
              <th className="sticky z-40 bg-muted px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" style={kunci(L_NO, 0)}>
                #
              </th>
              <th className="sticky z-40 bg-muted px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" style={kunci(L_NAMA, L_NO)}>
                Nama Outlet
              </th>
              <th
                className="tepi-kiri sticky z-40 border-r border-border bg-muted px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                style={kunci(L_BULAN, L_NO + L_NAMA)}
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
                    "min-w-[5.4rem] snap-start border-l border-border/60 bg-muted px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide",
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
                className="tepi-kanan sticky right-0 z-40 border-l border-border bg-muted px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                style={kunci(L_KURANG)}
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
            <tfoot className="sticky bottom-0 z-30 shadow-[0_-1px_0_0_var(--border)]">
              <Baris baris={detail.total} nomor={null} kolom={detail.kolom} mode={mode} tebal lapis="z-30" />
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/**
 * Catatan tentang datanya — DI BALIK SATU TOMBOL, bukan dicetak di bawah tabel.
 *
 * Tiga paragraf permanen di bawah tabel dibaca sekali lalu menghalangi
 * selamanya: ia mendorong tabelnya naik, memakan tinggi layar yang justru
 * dibutuhkan barisnya, dan tidak berubah dari hari ke hari. Di sini isinya
 * sama persis, hanya muncul saat diminta.
 */
function Catatan({ detail }: { detail: DetailHarian }) {
  const jumlah = (detail.tanpaCabang.length > 0 ? 1 : 0) + (detail.tanpaTarget.length > 0 ? 1 : 0);
  return (
    <Popover
      align="end"
      contentClassName="w-80 p-3"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
        >
          <Info className="size-3.5" />
          Tentang angka ini
          {jumlah > 0 && (
            <span className="grid size-4 place-items-center rounded-full bg-amber-500 text-[9.5px] font-bold text-white">
              {jumlah}
            </span>
          )}
        </button>
      )}
    >
      <div className="space-y-2 text-[11.5px] leading-relaxed text-muted-foreground">
        <p>
          Angkanya <b className="text-foreground">net sales dari ESB</b>, ditarik sendiri oleh sistem hari demi hari.
          Tanggal bertanda “—” belum sampai penarikannya — itu bukan nol, dan bukan outlet yang tidak berjualan.
        </p>
        <p>
          Targetnya rata-rata tiga bulan penuh sebelumnya ditambah pertumbuhan — angka yang sama dengan target KPI
          Coordinator Area. Target sehari = target sebulan dibagi jumlah hari.
        </p>
        {detail.tanpaCabang.length > 0 && (
          <p>
            <b className="text-foreground">{detail.tanpaCabang.length} outlet</b> belum dipasangkan ke cabang ESB, jadi
            belum punya angka harian: {detail.tanpaCabang.join(", ")}.
          </p>
        )}
        {detail.tanpaTarget.length > 0 && (
          <p>
            <b className="text-foreground">{detail.tanpaTarget.length} outlet</b> belum genap tiga bulan berjalan, jadi
            belum punya target dan tidak ikut baris gabungan: {detail.tanpaTarget.join(", ")}.
          </p>
        )}
      </div>
    </Popover>
  );
}
