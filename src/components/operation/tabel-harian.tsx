"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Rocket,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { WORK_BRANDS } from "@/lib/constants";
import type { DetailHarian, PilihanArea } from "@/lib/data/daily-outlet";
import { merekOutlet } from "@/lib/kpi/merek";
import { LOGO_MEREK, WARNA_MEREK } from "@/lib/ops/logo-merek";
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
 * TIGA PULUH SATU KOLOM tidak muat di layar mana pun, jadi yang dijaga bukan
 * "semuanya terlihat sekaligus" melainkan "yang menggeser tidak pernah
 * kehilangan pegangannya": kiri menempel (nomor, outlet, capaian bulan ini),
 * kanan menempel (kekurangan), atas menempel (tanggal). Yang bergeser hanya
 * tanggalnya, di antara tepi-tepi yang diam.
 *
 * ANGKANYA TIDAK DITEBALKAN. Tabel yang seluruh isinya tebal tidak menonjolkan
 * apa pun — yang menonjol justru tidak ada. Yang membedakan di sini warna dan
 * bentuk: panah tren, bar capaian, dan satu baris jumlah di bawah.
 */

/* ──────────────────────────────── bulan ──────────────────────────────── */

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const labelBulan = (periode: string) => {
  const [th, bl] = periode.split("-").map(Number);
  return `${BULAN[bl - 1]} ${th}`;
};

const labelBulanPendek = (periode: string) => {
  const [th, bl] = periode.split("-").map(Number);
  return `${BULAN[bl - 1].slice(0, 3)} ${String(th).slice(2)}`;
};

const geserBulan = (periode: string, arah: number) => {
  const [th, bl] = periode.split("-").map(Number);
  const t = new Date(Date.UTC(th, bl - 1 + arah, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
};

/* ─────────────────────────────── ukuran ─────────────────────────────── */

/**
 * Lebar kolom yang menempel — DIKUNCI, bukan disarankan.
 *
 * `width` pada sel tabel hanya usulan: kalau isinya lebih lebar, kolomnya
 * melar, sementara `left` sel berikutnya tetap dihitung dari angka di sini.
 * Selisihnya jadi celah, dan di celah itu tanggal yang sedang bergeser
 * terlihat menyembul di antara kolom yang seharusnya diam.
 */
const LEBAR = {
  lega: { no: 38, nama: 200, bulan: 166, kurang: 158 },
  // Di layar sempit tepi beku memakan hampir seluruh lebar, dan yang tersisa
  // untuk tanggal tinggal dua kolom. Kolom Kurang ditarik masuk ke sel Bulan
  // Ini — angkanya tetap terbaca, tempatnya saja yang berpindah.
  sempit: { no: 28, nama: 148, bulan: 128, kurang: 0 },
} as const;

type Lebar = (typeof LEBAR)[keyof typeof LEBAR];

const kunci = (w: number, kiri?: number) => ({
  width: w,
  minWidth: w,
  maxWidth: w,
  ...(kiri === undefined ? {} : { left: kiri }),
});

/**
 * Apakah layarnya sempit.
 *
 * `useSyncExternalStore`, bukan efek yang memanggil setState: efek semacam itu
 * berjalan sesudah render, jadi tabelnya sempat digambar dengan lebar yang
 * salah lebih dulu — dan pada tabel selebar ini kesalahan itu terlihat sebagai
 * kolom yang melompat begitu halaman selesai dimuat.
 */
function useSempit(): boolean {
  return React.useSyncExternalStore(
    (ubah) => {
      const m = window.matchMedia("(max-width: 900px)");
      m.addEventListener("change", ubah);
      return () => m.removeEventListener("change", ubah);
    },
    () => window.matchMedia("(max-width: 900px)").matches,
    () => false,
  );
}

/**
 * SISI MANA YANG SEDANG MENYEMBUNYIKAN ISI.
 *
 * Bayangan di tepi kolom yang diam bukan hiasan — ia memberi tahu bahwa DI
 * BALIK tepi itu masih ada tanggal yang belum terlihat. Kalau bayangannya
 * selalu ada, ia berbohong: di posisi paling kiri tidak ada apa pun yang
 * tersembunyi di sebelah kiri, tapi garis gelapnya tetap menyatakan ada.
 *
 * Jadi yang dilaporkan di sini keadaan yang sebenarnya: kiri menyala hanya
 * kalau sudah digeser, kanan padam begitu ujung kanannya tercapai.
 *
 * Bayangannya sendiri GRADASI, bukan `box-shadow`, dan arahnya berbalik di
 * mode gelap. Bayangan hitam di atas latar yang memang sudah hampir hitam
 * tidak terlihat sama sekali — yang membedakan tepi di layar gelap justru
 * cahaya tipis, bukan gelap tambahan.
 */
function useTepiGeser(
  bergantung: unknown,
): [React.RefObject<HTMLDivElement | null>, { kiri: boolean; kanan: boolean }] {
  const ref = React.useRef<HTMLDivElement>(null);
  const [tepi, setTepi] = React.useState({ kiri: false, kanan: false });

  const periksa = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const kiri = el.scrollLeft > 1;
    const kanan = el.scrollWidth - el.clientWidth - el.scrollLeft > 1;
    setTepi((t) => (t.kiri === kiri && t.kanan === kanan ? t : { kiri, kanan }));
  }, []);

  React.useEffect(() => {
    periksa();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(periksa);
    ro.observe(el);
    el.addEventListener("scroll", periksa, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", periksa);
    };
  }, [periksa, bergantung]);

  return [ref, tepi];
}

/* ───────────────────────────── potongan kecil ───────────────────────────── */

/**
 * PANAH TREN — penanda arah yang tidak bergantung pada warna saja.
 *
 * Panah menyerong, bukan segitiga. Segitiga cuma menyatakan "lebih besar" atau
 * "lebih kecil"; panah menyerong menyatakan GERAKAN — dan yang dibaca orang di
 * tabel ini memang gerakan, bukan perbandingan dua angka yang berdiri sendiri.
 * Bentuknya juga tetap terbaca oleh yang tidak membedakan merah dan hijau.
 */
function Arah({ naik, nada = true, kelas }: { naik: boolean; nada?: boolean; kelas?: string }) {
  const Ikon = naik ? TrendingUp : TrendingDown;
  return (
    <Ikon
      aria-hidden
      className={cn(
        "size-3 shrink-0",
        !nada ? "" : naik ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
        kelas,
      )}
    />
  );
}

/** Persentase berpanah — bentuk yang sama di kartu maupun di tabel. */
function Persen({ nilai, kelas }: { nilai: number | null; kelas?: string }) {
  if (nilai === null) return <span className="text-[11px] text-muted-foreground">—</span>;
  const naik = nilai >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 tabular-nums",
        naik ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
        kelas,
      )}
    >
      <Arah naik={naik} nada={false} />
      {formatNumber(Math.abs(nilai), { maximumFractionDigits: nilai % 1 === 0 ? 0 : 2 })}%
    </span>
  );
}

/**
 * DERET HARI TERCAPAI — roket, dan kelipatannya.
 *
 * Yang dijawabnya bukan "berapa hari tercapai bulan ini" — itu sudah terbaca
 * dari kolom Kurang — melainkan "apakah outlet ini SEDANG jalan". Sepuluh hari
 * tercapai yang tersebar sepanjang bulan dan lima hari berturut-turut sampai
 * kemarin adalah dua keadaan yang berbeda jauh, dan cuma yang kedua yang
 * berarti besok kemungkinan besar tercapai juga.
 *
 * Yang deretnya putus tidak diberi apa-apa: tanda "0" hanya ramai tanpa
 * memberi tahu apa pun.
 */
function Roket({ deret, besar = false }: { deret: number; besar?: boolean }) {
  if (deret <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-md bg-orange-500/10 px-1 py-px font-semibold tabular-nums text-orange-600 dark:text-orange-400",
        besar ? "text-[12px]" : "text-[10.5px]",
      )}
      title={`${deret} hari berturut-turut mencapai target harian`}
    >
      <Rocket className={besar ? "size-3.5" : "size-3"} />
      {deret}
    </span>
  );
}

/** Lambang merek — logonya kalau ada, huruf depan berwarna merek kalau belum. */
function Lambang({ merek, ukuran = 22 }: { merek: string | null; ukuran?: number }) {
  const m = merek ? merekOutlet(merek) : null;
  const logo = merek ? LOGO_MEREK[merek] : undefined;
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={merek ?? ""}
        style={{ width: ukuran, height: ukuran }}
        // Tanpa latar putih dan tanpa cincin: berkasnya sudah piringan penuh,
        // dan latar di baliknya hanya menyisakan tepi putih di layar gelap.
        className="shrink-0 rounded-full object-contain"
      />
    );
  }
  return (
    <span
      style={{ width: ukuran, height: ukuran, fontSize: ukuran * 0.5 }}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-bold text-white",
        m ? WARNA_MEREK[m.tone] : "bg-slate-300 dark:bg-slate-600",
      )}
    >
      {(merek ?? "?").slice(0, 1)}
    </span>
  );
}

/**
 * Bar capaian — WARNANYA yang bercerita, bukan garis penandanya.
 *
 * Dulu ada garis tipis di posisi 100%. Garis itu dihapus: angka persennya
 * selalu berdiri tepat di sebelah bar, jadi garisnya menjawab pertanyaan yang
 * sudah dijawab — sementara di satu tabel berisi puluhan bar, puluhan garis
 * tipis itu terbaca sebagai kisi yang tidak disengaja.
 *
 * Yang membedakan tercapai dan belum sekarang warnanya: hijau mulai 100%,
 * kuning mulai 80%, merah di bawahnya.
 */
function BarCapaian({
  capaian,
  tinggi = "h-1.5",
}: {
  capaian: number | null;
  tinggi?: string;
}) {
  const SKALA = 120;
  const c = capaian ?? 0;
  return (
    <div className={cn("relative w-full overflow-hidden rounded-full bg-muted", tinggi)}>
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          c >= BATAS_TERCAPAI
            ? "bg-emerald-500"
            : c >= 80
              ? "bg-amber-500"
              : "bg-rose-400",
        )}
        style={{ width: `${Math.min(100, (Math.max(0, c) / SKALA) * 100)}%` }}
      />
    </div>
  );
}

/* ───────────────────────────── kartu per merek ───────────────────────────── */

/** Grafik sekelumit — bentuk pergerakan sebulan, bukan angkanya. */
function Sekelumit({ nilai, naik }: { nilai: (number | null)[]; naik: boolean }) {
  const ada = nilai.map((v, i) => ({ v, i })).filter((t): t is { v: number; i: number } => t.v !== null);
  if (ada.length < 2) return <span className="h-6 w-14" />;
  const min = Math.min(...ada.map((t) => t.v));
  const max = Math.max(...ada.map((t) => t.v));
  const rentang = max - min || 1;
  const titik = ada.map((t, n) => `${(n / (ada.length - 1)) * 56},${22 - ((t.v - min) / rentang) * 18}`).join(" ");
  return (
    <svg viewBox="0 0 56 24" className="h-6 w-14 shrink-0" aria-hidden>
      <polyline
        points={titik}
        fill="none"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={naik ? "stroke-emerald-500" : "stroke-rose-500"}
      />
    </svg>
  );
}

function KartuBrand({ kartu, aktif, onPilih }: { kartu: KartuMerek; aktif: boolean; onPilih: () => void }) {
  const naik = (kartu.mom ?? 0) >= 0;
  return (
    <button
      type="button"
      onClick={onPilih}
      aria-pressed={aktif}
      className={cn(
        // MELEBAR MENGISI BARIS, bukan lebar tetap. Empat kartu selebar 15rem
        // di layar 1440 menyisakan ruang kosong di ujung kanan yang terbaca
        // seperti ada kartu kelima yang gagal dimuat. `flex-[1_0_…]` membuatnya
        // tumbuh sampai barisnya habis, tapi tidak pernah menyusut — jadi di
        // layar sempit kartunya tetap seukuran itu dan barisnya bergeser.
        "min-w-[14.5rem] flex-[1_0_14.5rem] snap-start rounded-xl border bg-card px-3 py-2.5 text-left transition-colors",
        aktif ? "border-brand-500 ring-1 ring-brand-500/30" : "border-border hover:border-foreground/20",
      )}
    >
      <div className="flex items-center gap-2">
        <Lambang merek={kartu.merek} ukuran={26} />
        <span className="truncate text-[13px] font-semibold text-foreground">{kartu.merek}</span>
        <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] tabular-nums text-muted-foreground">
          {kartu.outlet} outlet
        </span>
      </div>

      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] tabular-nums text-foreground">
            {kartu.bulanIni === null ? "—" : formatIDR(kartu.bulanIni)}
          </p>
          <Persen nilai={kartu.mom} kelas="text-[11.5px]" />
        </div>
        <Sekelumit nilai={kartu.hari} naik={naik} />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <BarCapaian capaian={kartu.capaian} />
        <span
          className={cn(
            "shrink-0 text-[11px] tabular-nums",
            (kartu.capaian ?? 0) >= BATAS_TERCAPAI ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
          )}
        >
          {kartu.capaian === null ? "—" : `${formatNumber(kartu.capaian, { maximumFractionDigits: 0 })}%`}
        </span>
      </div>
    </button>
  );
}

/** Deret kartu yang bisa digeser — panahnya muncul hanya kalau ada yang tersembunyi. */
function DeretMerek({
  kartu,
  dipilih,
  onPilih,
}: {
  kartu: KartuMerek[];
  dipilih: string | null;
  onPilih: (m: string | null) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [arah, setArah] = React.useState({ kiri: false, kanan: false });

  const periksa = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setArah({ kiri: el.scrollLeft > 4, kanan: el.scrollWidth - el.clientWidth - el.scrollLeft > 4 });
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
  const geser = (n: number) => ref.current?.scrollBy({ left: n * 280, behavior: "smooth" });

  return (
    <div className="relative">
      <div ref={ref} onScroll={periksa} className="scroll-fade-x flex snap-x gap-2 overflow-x-auto pb-0.5">
        {kartu.map((k) => (
          <KartuBrand
            key={k.merek}
            kartu={k}
            aktif={dipilih === k.merek}
            onPilih={() => onPilih(dipilih === k.merek ? null : k.merek)}
          />
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
              "absolute top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-md hover:text-foreground",
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

/**
 * SATU TINGGI UNTUK SELURUH BILAH SARINGAN.
 *
 * Tiap kendali di sini dulunya menghitung tingginya sendiri dari padding dan
 * ukuran hurufnya, jadi tidak ada dua yang sama persis — satu bilah berisi
 * tujuh kendali dengan tujuh tinggi berbeda, dan garis bawahnya bergerigi.
 * Angkanya 36 piksel, diambil dari tinggi Combobox yang memang sudah `h-9`,
 * supaya yang menyesuaikan yang lain, bukan yang satu itu.
 */
const TINGGI = "h-9";

/** Wadah kendali tunggal — sebaris dengan Combobox di sebelahnya. */
const KOTAK = `inline-flex ${TINGGI} shrink-0 items-center rounded-lg border border-border bg-card p-0.5`;

/** Lintasan pilihan tersegmen — cekung, isinya yang menonjol. */
const LINTASAN = `inline-flex ${TINGGI} shrink-0 items-center gap-0.5 rounded-lg bg-muted p-0.5`;

/**
 * YANG TERPILIH TIDAK PUNYA WARNA — ia TERANGKAT.
 *
 * Sebelumnya hijau: warna merek aplikasi ini. Persoalannya tabel di bawahnya
 * memakai hijau untuk arti yang lain — naik, dan tercapai. Jadi satu layar
 * memuat dua hijau yang artinya berbeda, dan yang membaca sekilas tidak punya
 * cara tahu yang mana yang mana.
 *
 * Penggantinya permukaan, bukan warna: lintasannya cekung, yang terpilih naik
 * ke atasnya dengan bayangan tipis. Cara ini tidak meminjam satu pun warna
 * yang sudah punya arti di tabel, dan tetap terbaca di kedua tema — di terang
 * putih di atas kelabu, di gelap gelap di atas terang. Nada mana pun yang
 * dipakai temanya, yang terpilih tetap satu-satunya yang bertepi.
 */
const TERPILIH = "bg-card font-medium text-foreground shadow-sm ring-1 ring-border";
const TIDAK_TERPILIH = "text-muted-foreground hover:text-foreground";

/**
 * AVATAR MEREK DI BILAH SARINGAN — menyaring per merek tanpa membuka apa pun.
 *
 * Kartunya bisa disembunyikan, dan begitu disembunyikan satu-satunya jalan
 * menyaring per merek ikut hilang bersamanya. Deretan logo bulat ini yang
 * menggantikannya: selalu ada, selebar satu baris tombol, dan menyimpan
 * pilihan yang sama dengan kartunya — mengklik logo yang sedang aktif
 * melepasnya lagi.
 *
 * Yang tidak aktif diredupkan, bukan dihitamkan: logo merek yang diubah
 * warnanya berhenti terbaca sebagai logo merek itu.
 */
function AvatarMerek({
  kartu,
  dipilih,
  onPilih,
}: {
  kartu: KartuMerek[];
  dipilih: string | null;
  onPilih: (m: string | null) => void;
}) {
  if (kartu.length === 0) return null;
  return (
    <div className={LINTASAN}>
      {/* "Semua" ikut masuk ke dalam lintasan, bukan berdiri sebagai tombol
          lepas di sebelahnya: tanpa merek terpilih itu memang salah satu
          keadaan pilihan ini, bukan ketiadaan pilihan. */}
      <button
        type="button"
        aria-pressed={dipilih === null}
        onClick={() => onPilih(null)}
        className={cn(
          "h-8 whitespace-nowrap rounded-md px-2.5 text-[12px] transition-colors",
          dipilih === null ? TERPILIH : TIDAK_TERPILIH,
        )}
      >
        {/* "Semua merek", bukan "Semua": saringan status di sebelahnya juga
            berawalan "Semua", dan dua pil sebunyi bersebelahan tidak memberi
            tahu yang mana menyaring apa. */}
        Semua merek
      </button>
      {kartu.map((k) => {
        const aktif = dipilih === k.merek;
        return (
          <button
            key={k.merek}
            type="button"
            aria-pressed={aktif}
            title={`${k.merek} · ${k.outlet} outlet`}
            aria-label={`Saring merek ${k.merek}`}
            onClick={() => onPilih(aktif ? null : k.merek)}
            className={cn(
              "grid size-8 place-items-center rounded-md transition",
              // TERANGKAT, BUKAN DIWARNAI. Logonya sendiri sudah berwarna;
              // memberi warna lagi di belakangnya membuat dua warna bertabrakan
              // di ruang selebar 32 piksel. Yang membedakan di sini permukaan:
              // yang terpilih naik ke atas lintasan yang cekung.
              //
              // Yang tidak terpilih diredupkan, bukan diabukan — `grayscale`
              // membuat keempatnya jadi piringan kelabu yang serupa, persis
              // yang dipakai orang untuk membedakannya.
              aktif ? "bg-card shadow-sm ring-1 ring-border" : "opacity-70 hover:opacity-100",
            )}
          >
            <Lambang merek={k.merek} ukuran={22} />
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────── saringan ─────────────────────────────── */

type Status = "semua" | "tercapai" | "tertinggal" | "tanpa";
type Urut = "omzet" | "capaian" | "deret" | "kurang" | "nama";
type Arah2 = "naik" | "turun";
type Mode = "banding" | "target";

const STATUS: { nilai: Status; label: string }[] = [
  { nilai: "semua", label: "Semua" },
  { nilai: "tercapai", label: "Tercapai" },
  { nilai: "tertinggal", label: "Tertinggal" },
  { nilai: "tanpa", label: "Belum bertarget" },
];

/** Pil tersegmen — satu pilihan dari beberapa, tanpa membuka apa pun. */
function Segmen<T extends string>({
  pilihan,
  nilai,
  onNilai,
}: {
  pilihan: { nilai: T; label: string }[];
  nilai: T;
  onNilai: (v: T) => void;
}) {
  return (
    <div className={LINTASAN}>
      {pilihan.map((p) => (
        <button
          key={p.nilai}
          type="button"
          aria-pressed={nilai === p.nilai}
          onClick={() => onNilai(p.nilai)}
          className={cn(
            "h-8 whitespace-nowrap rounded-md px-2.5 text-[12px] transition-colors",
            nilai === p.nilai ? TERPILIH : TIDAK_TERPILIH,
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/* ──────────────────────────────── tabel ──────────────────────────────── */

/** Tajuk yang bisa diklik untuk mengurutkan. */
function Kepala({
  label,
  bawah,
  urut,
  aktif,
  arah,
  onUrut,
  className,
  style,
}: {
  label: string;
  bawah?: string;
  urut?: Urut;
  aktif?: boolean;
  arah?: Arah2;
  onUrut?: (u: Urut) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const isi = (
    <>
      {label}
      {urut && (
        <span className={cn("ml-1 inline-block align-middle", aktif ? "text-brand-600" : "text-muted-foreground/50")}>
          {!aktif ? (
            <ArrowUpDown className="size-3" />
          ) : arah === "naik" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )}
        </span>
      )}
      {bawah && <span className="block text-[9px] font-normal normal-case tracking-normal">{bawah}</span>}
    </>
  );
  return (
    <th className={className} style={style}>
      {urut && onUrut ? (
        <button type="button" onClick={() => onUrut(urut)} className="w-full text-inherit hover:text-foreground">
          {isi}
        </button>
      ) : (
        isi
      )}
    </th>
  );
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
      <td className="snap-start border-l border-border/50 px-2 py-1.5 text-center align-middle">
        {/* Belum ditarik dari ESB — BUKAN nol. Nol berarti outletnya tidak
            berjualan sehari penuh, dan itu tuduhan yang berbeda jauh. */}
        <span className="text-[11px] text-muted-foreground/50">—</span>
      </td>
    );
  }
  const p = mode === "target" ? capaian : ubah;
  return (
    <td className="snap-start border-l border-border/50 px-2 py-1.5 text-right align-middle">
      <span className="block whitespace-nowrap text-[11.5px] tabular-nums text-foreground">{formatIDRShort(nilai)}</span>
      {mode === "target" ? (
        p === null ? (
          <span className="text-[10.5px] text-muted-foreground">—</span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[10.5px] tabular-nums",
              p >= BATAS_TERCAPAI ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
            )}
          >
            <Arah naik={p >= BATAS_TERCAPAI} nada={false} />
            {formatNumber(p, { maximumFractionDigits: 0 })}%
          </span>
        )
      ) : (
        <Persen nilai={p} kelas="text-[10.5px]" />
      )}
    </td>
  );
}

function Baris({
  baris,
  nomor,
  kolom,
  mode,
  L,
  tebal = false,
  lapis = "z-20",
}: {
  baris: BarisHarian;
  nomor: number | null;
  kolom: HariKolom[];
  mode: Mode;
  L: Lebar;
  tebal?: boolean;
  lapis?: string;
}) {
  // LATARNYA PEKAT, bukan warna tipis di atas latar lain. Sel yang menempel
  // dengan latar tembus pandang membuat tanggal yang bergeser di belakangnya
  // terbaca menumpuk dengan angkanya.
  const dasar = tebal ? "bg-muted" : "bg-card";
  const lunas = baris.kurang !== null && baris.kurang <= 0;
  const merek = tebal ? null : merekOutlet(baris.nama)?.label ?? null;

  return (
    <tr className={cn("baris-harian border-t border-border/70", tebal && "bg-muted")}>
      <td
        className={cn("sel-tempel sticky px-1 py-1.5 text-center text-[11px] tabular-nums text-muted-foreground", lapis, dasar)}
        style={kunci(L.no, 0)}
      >
        {nomor ?? <span className="text-[12px] font-semibold text-brand-600">Σ</span>}
      </td>

      <td className={cn("sel-tempel sticky px-2 py-1.5", lapis, dasar)} style={kunci(L.nama, L.no)}>
        <span className="flex items-center gap-2">
          {!tebal && <Lambang merek={merek} ukuran={22} />}
          <span className="min-w-0 flex-1">
            <span className={cn("block overflow-hidden", baris.nama.length > 18 && "nama-panjang")} title={baris.nama}>
              <span className={cn("block whitespace-nowrap text-[12.5px] text-foreground", tebal && "font-semibold")}>
                {baris.nama}
              </span>
            </span>
            <span className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
              <span className="min-w-0 truncate">{baris.area}</span>
              <Roket deret={baris.deret} />
            </span>
          </span>
        </span>
      </td>

      <td
        className={cn("sel-tempel tepi-kiri sticky border-r border-border px-2 py-1.5 text-right", lapis, dasar)}
        style={kunci(L.bulan, L.no + L.nama)}
      >
        <span
          className="block truncate text-[12.5px] tabular-nums text-foreground"
          title={baris.bulanIni === null ? undefined : formatIDR(baris.bulanIni)}
        >
          {baris.bulanIni === null ? "—" : L.kurang === 0 ? formatIDRShort(baris.bulanIni) : formatIDR(baris.bulanIni)}
        </span>
        {mode === "banding" ? (
          <Persen nilai={baris.mom} kelas="text-[10.5px]" />
        ) : baris.targetBulan == null ? (
          <span className="block text-[10.5px] text-muted-foreground">Belum bertarget</span>
        ) : (
          // TARGETNYA BAR, bukan angka yang harus dibandingkan sendiri di
          // kepala. Yang dicari orang bukan "targetnya berapa" melainkan
          // "sudah sejauh mana" — dan itu satu tatapan, bukan satu hitungan.
          <span className="mt-1 flex items-center gap-1.5">
            <BarCapaian capaian={baris.capaianBulan} tinggi="h-1" />
            <span
              className={cn(
                "shrink-0 text-[10px] tabular-nums",
                (baris.capaianBulan ?? 0) >= BATAS_TERCAPAI
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground",
              )}
            >
              {baris.capaianBulan === null ? "—" : `${formatNumber(baris.capaianBulan, { maximumFractionDigits: 0 })}%`}
            </span>
          </span>
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
      {L.kurang > 0 && (
        <td
          className={cn("sel-tempel tepi-kanan sticky right-0 border-l border-border px-3 py-1.5 text-right", lapis, dasar)}
          style={kunci(L.kurang)}
        >
          {baris.kurang === null ? (
            <span className="text-[11px] text-muted-foreground">Belum bertarget</span>
          ) : lunas ? (
            <>
              <span className="flex items-center justify-end gap-1 text-[12px] text-emerald-600 dark:text-emerald-400">
                <Arah naik nada={false} /> Tercapai
              </span>
              <span className="block truncate text-[10.5px] tabular-nums text-muted-foreground">
                lebih {formatIDRShort((baris.bulanIni ?? 0) - (baris.targetBulan ?? 0))}
              </span>
            </>
          ) : (
            <>
              <span className="block truncate text-[12.5px] tabular-nums text-foreground">{formatIDR(baris.kurang)}</span>
              <span className="block truncate text-[10.5px] tabular-nums text-muted-foreground">
                {baris.perHariSisa === null
                  ? `${baris.sisaHari} hari tersisa`
                  : `${formatIDRShort(baris.perHariSisa)}/hari × ${baris.sisaHari}`}
              </span>
            </>
          )}
        </td>
      )}
    </tr>
  );
}

/* ──────────────────────────────── halaman ──────────────────────────────── */

export function TabelHarian({
  detail,
  area,
  areaTerpilih,
  bisaPilihArea,
}: {
  detail: DetailHarian;
  area?: PilihanArea[];
  areaTerpilih?: string;
  bisaPilihArea?: boolean;
}) {
  const router = useRouter();
  const sempit = useSempit();
  const L = sempit ? LEBAR.sempit : LEBAR.lega;

  const [mode, setMode] = React.useState<Mode>("target");
  const [status, setStatus] = React.useState<Status>("semua");
  const [merek, setMerek] = React.useState<string | null>(null);
  const [urut, setUrut] = React.useState<Urut>("omzet");
  const [arah, setArah] = React.useState<Arah2>("turun");
  const [kartuTampil, setKartuTampil] = React.useState(true);
  const [wadah, tepi] = useTepiGeser(detail.kolom.length + (sempit ? 1000 : 0));

  const pindah = (p: { bulan?: string; area?: string }) => {
    const q = new URLSearchParams();
    q.set("bulan", p.bulan ?? detail.periode);
    const a = p.area ?? areaTerpilih ?? "";
    if (a) q.set("area", a);
    router.push(`/operational/daily?${q.toString()}`);
  };

  const kartu = React.useMemo(
    () => kartuMerek(detail.baris, (n) => merekOutlet(n)?.label ?? null, WORK_BRANDS),
    [detail.baris],
  );

  /** Urutkan; klik tajuk yang sama membalik arahnya. */
  const gantiUrut = (u: Urut) => {
    if (u === urut) setArah((a) => (a === "turun" ? "naik" : "turun"));
    else {
      setUrut(u);
      setArah(u === "nama" ? "naik" : "turun");
    }
  };

  const baris = React.useMemo(() => {
    const cocok = detail.baris.filter((b) => {
      if (merek && (merekOutlet(b.nama)?.label ?? null) !== merek) return false;
      if (status === "tercapai") return b.kurang !== null && b.kurang <= 0;
      if (status === "tertinggal") return b.kurang !== null && b.kurang > 0;
      if (status === "tanpa") return b.kurang === null;
      return true;
    });
    const nilai = (b: BarisHarian): number | string =>
      urut === "nama"
        ? b.nama.toLowerCase()
        : urut === "capaian"
          ? (b.capaianBulan ?? -1)
          : urut === "deret"
            ? b.deret
            : urut === "kurang"
              ? (b.kurang ?? -1)
              : (b.bulanIni ?? -1);
    const arahnya = arah === "naik" ? 1 : -1;
    return [...cocok].sort((a, b) => {
      const x = nilai(a);
      const y = nilai(b);
      if (typeof x === "string" || typeof y === "string") return String(x).localeCompare(String(y), "id") * arahnya;
      return (x - y) * arahnya;
    });
  }, [detail.baris, merek, status, urut, arah]);

  const jumlahSaringan = (status === "semua" ? 0 : 1) + (merek ? 1 : 0);

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col gap-2.5">
      <style>{`
        @keyframes jalan{0%,12%{transform:translateX(0)}88%,100%{transform:translateX(calc(-100% + ${L.nama - 46}px))}}
        .nama-panjang{-webkit-mask-image:linear-gradient(to right,#000 82%,transparent);mask-image:linear-gradient(to right,#000 82%,transparent)}
        .baris-harian:hover .sel-tempel{background-color:var(--muted)}
        .baris-harian:hover .nama-panjang{-webkit-mask-image:none;mask-image:none}
        .baris-harian:hover .nama-panjang>span{animation:jalan 7s linear infinite}
        .tepi-kiri::after,.tepi-kanan::before{content:"";position:absolute;top:0;bottom:0;width:16px;pointer-events:none;opacity:0;transition:opacity .18s ease}
        .tepi-kiri::after{left:100%;background:linear-gradient(to right,rgb(0 0 0/.20),transparent)}
        .tepi-kanan::before{right:100%;background:linear-gradient(to left,rgb(0 0 0/.20),transparent)}
        .dark .tepi-kiri::after{background:linear-gradient(to right,rgb(255 255 255/.075),transparent)}
        .dark .tepi-kanan::before{background:linear-gradient(to left,rgb(255 255 255/.075),transparent)}
        .geser-kiri .tepi-kiri::after,.geser-kanan .tepi-kanan::before{opacity:1}
      `}</style>

      {kartuTampil && (
        <DeretMerek kartu={kartu} dipilih={merek} onPilih={setMerek} />
      )}

      {/* Bilah saringan yang MENYESUAIKAN LEBAR, bukan menumpuk ke bawah. Tiga
          baris tombol di atas tabel memakan tinggi yang justru dibutuhkan
          barisnya.
          Saringannya sendiri yang bergeser, sementara Saringan dan Kartu
          dipisah ke wadahnya sendiri di kanan. Sebelumnya keduanya ikut di
          dalam satu baris yang bergeser dengan `ml-auto`, jadi begitu
          saringannya melebihi layar keduanya terdorong keluar — tombol
          membatalkan saringan yang hilang justru ketika saringannya paling
          banyak dipakai. */}
      <div className="flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5">
        <div className={cn(KOTAK, "gap-0.5")}>
          <button
            type="button"
            aria-label="Bulan sebelumnya"
            onClick={() => pindah({ bulan: geserBulan(detail.periode, -1) })}
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="px-1 text-center text-[12.5px] font-medium text-foreground sm:min-w-[7.5rem]">
            <span className="hidden sm:inline">{labelBulan(detail.periode)}</span>
            <span className="sm:hidden">{labelBulanPendek(detail.periode)}</span>
          </span>
          <button
            type="button"
            aria-label="Bulan berikutnya"
            onClick={() => pindah({ bulan: geserBulan(detail.periode, 1) })}
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <Segmen pilihan={STATUS} nilai={status} onNilai={setStatus} />

        <AvatarMerek kartu={kartu} dipilih={merek} onPilih={setMerek} />

        <Segmen
          pilihan={[
            { nilai: "target" as Mode, label: "Capaian target" },
            { nilai: "banding" as Mode, label: "Banding hari lalu" },
          ]}
          nilai={mode}
          onNilai={setMode}
        />

        {bisaPilihArea && area && area.length > 0 && (
          <div className="w-36 shrink-0 sm:w-52">
            <Combobox
              value={areaTerpilih ?? ""}
              onChange={(v) => pindah({ area: v })}
              // Isinya nama orang — Deo, Wika, Roby — bukan nama wilayah, jadi
              // "Semua area" menjanjikan daftar yang berbeda dari yang muncul.
              options={[
                { value: "", label: "Semua coordinator" },
                ...area.map((a) => ({ value: a.value, label: `${a.label} · ${a.outlet} outlet` })),
              ]}
              searchPlaceholder="Cari coordinator…"
              matchTriggerWidth
            />
          </div>
        )}

        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {jumlahSaringan > 0 && (
            <button
              type="button"
              onClick={() => {
                setStatus("semua");
                setMerek(null);
              }}
              className={cn(
                TINGGI,
                "inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[12px] font-medium text-foreground hover:bg-muted",
              )}
            >
              <SlidersHorizontal className="size-3.5" />
              <span className="hidden sm:inline">Saringan</span>
              <span className="grid size-4 place-items-center rounded-full bg-primary text-[9.5px] font-bold text-primary-foreground">
                {jumlahSaringan}
              </span>
              <X className="size-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setKartuTampil((v) => !v)}
            aria-pressed={kartuTampil}
            title={kartuTampil ? "Sembunyikan kartu merek" : "Tampilkan kartu merek"}
            className={cn(
              TINGGI,
              "inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[12px] font-medium hover:bg-muted",
              kartuTampil ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <LayoutGrid className="size-3.5" />
            <span className="hidden md:inline">Kartu</span>
          </button>
        </div>
      </div>

      {/* GESERNYA BERHENTI PAS DI BATAS KOLOM. Tanpa ini, kolom paling kiri di
          daerah yang bergeser selalu berhenti separuh — yang terbaca di sebelah
          tepi beku cuma potongan huruf. */}
      <div
        ref={wadah}
        className={cn(
          "min-h-0 flex-1 snap-x snap-mandatory overflow-auto rounded-xl border border-border bg-card",
          tepi.kiri && "geser-kiri",
          tepi.kanan && "geser-kanan",
        )}
        style={{ scrollPaddingLeft: L.no + L.nama + L.bulan, scrollPaddingRight: L.kurang }}
      >
        <table className="w-max min-w-full border-collapse text-left">
          <thead className="sticky top-0 z-30">
            <tr className="bg-muted">
              <Kepala
                label="#"
                className="sticky z-40 bg-muted px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                style={kunci(L.no, 0)}
              />
              <Kepala
                label="Outlet"
                urut="nama"
                aktif={urut === "nama"}
                arah={arah}
                onUrut={gantiUrut}
                className="sticky z-40 bg-muted px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                style={kunci(L.nama, L.no)}
              />
              <Kepala
                label="Bulan Ini"
                bawah={mode === "target" ? "capaian terhadap target" : "vs tanggal sama bulan lalu"}
                urut={mode === "target" ? "capaian" : "omzet"}
                aktif={urut === (mode === "target" ? "capaian" : "omzet")}
                arah={arah}
                onUrut={gantiUrut}
                className="tepi-kiri sticky z-40 border-r border-border bg-muted px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                style={kunci(L.bulan, L.no + L.nama)}
              />
              {detail.kolom.map((h) => (
                <th
                  key={h.tanggal}
                  className={cn(
                    "min-w-[5.4rem] snap-start border-l border-border/50 bg-muted px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide",
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
              {L.kurang > 0 && (
                <Kepala
                  label="Kurang"
                  bawah="untuk capai target"
                  urut="kurang"
                  aktif={urut === "kurang"}
                  arah={arah}
                  onUrut={gantiUrut}
                  className="tepi-kanan sticky right-0 z-40 border-l border-border bg-muted px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  style={kunci(L.kurang)}
                />
              )}
            </tr>
          </thead>
          <tbody>
            {baris.map((b, i) => (
              <Baris key={b.outletId} baris={b} nomor={i + 1} kolom={detail.kolom} mode={mode} L={L} />
            ))}
            {baris.length === 0 && (
              <tr>
                <td
                  colSpan={(L.kurang > 0 ? 4 : 3) + detail.kolom.length}
                  className="px-4 py-10 text-center text-[13px] text-muted-foreground"
                >
                  Tidak ada outlet yang cocok dengan saringan ini.
                </td>
              </tr>
            )}
          </tbody>
          {detail.total && (
            <tfoot className="sticky bottom-0 z-30 shadow-[0_-2px_6px_-2px_rgb(0_0_0/.12)]">
              <Baris baris={detail.total} nomor={null} kolom={detail.kolom} mode={mode} L={L} tebal lapis="z-30" />
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
