"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Flame, TrendingDown, TrendingUp } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
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

/** Nama bulan pendek — untuk layar yang tidak muat nama panjangnya. */
const labelBulanPendek = (periode: string) => {
  const [th, bl] = periode.split("-").map(Number);
  return `${BULAN[bl - 1].slice(0, 3)} ${String(th).slice(2)}`;
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
const LEBAR = {
  lega: { no: 40, nama: 156, bulan: 158, kurang: 156 },
  // Di layar sempit tepi beku memakan hampir seluruh lebar, dan yang tersisa
  // untuk tanggal tinggal dua kolom. Kolom Kurang ditarik masuk ke sel Bulan
  // Ini — angkanya tetap terbaca, tempatnya saja yang berpindah.
  sempit: { no: 30, nama: 124, bulan: 126, kurang: 0 },
} as const;

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

/** Lebar yang tidak bisa ditawar isinya. */
const kunci = (w: number, kiri?: number) => ({
  width: w,
  minWidth: w,
  maxWidth: w,
  ...(kiri === undefined ? {} : { left: kiri }),
});

/* ───────────────────────────── potongan kecil ───────────────────────────── */

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

/**
 * DERET HARI TERCAPAI — api, dan angkanya.
 *
 * Yang dijawabnya bukan "berapa hari tercapai bulan ini" (itu sudah ada di
 * kolom Kurang), melainkan "apakah outlet ini SEDANG jalan". Sepuluh hari
 * tercapai yang tersebar sepanjang bulan dan lima hari berturut-turut sampai
 * kemarin adalah dua keadaan yang berbeda jauh, dan cuma yang kedua yang
 * berarti besok kemungkinan besar tercapai juga.
 *
 * Apinya membesar mengikuti deretnya: tiga hari sudah pola, tujuh hari sudah
 * kebiasaan. Yang deretnya putus tidak diberi apa-apa — tanda "0 hari" hanya
 * ramai tanpa memberi tahu apa pun.
 */
function Api({ deret }: { deret: number }) {
  if (deret <= 0) return null;
  const nada = deret >= 7 ? "text-rose-500" : deret >= 3 ? "text-amber-500" : "text-amber-400";
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-0.5 font-semibold tabular-nums", nada)}
      title={`${deret} hari berturut-turut mencapai target harian`}
    >
      <Flame className={cn("size-3", deret >= 7 && "fill-rose-500/20")} />
      {deret}×
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
        // Angkanya saja sudah berwarna, TAPI warna bukan satu-satunya
        // penanda: yang buta warna membaca tabel yang sama, dan panahnya
        // menyebut arah tanpa bergantung pada merah-hijau.
        <span className={cn("flex items-center justify-end gap-0.5 text-[10.5px] font-semibold tabular-nums", nadaCapaian(capaian))}>
          {capaian === null ? (
            "—"
          ) : (
            <>
              {capaian >= BATAS_TERCAPAI ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              {formatNumber(capaian, { maximumFractionDigits: 0 })}%
            </>
          )}
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

/**
 * Bar capaian — dengan PENANDA SERATUS PERSEN yang tetap di tempatnya.
 *
 * Bar yang penuh di ujung kanan berarti "seratus persen" hanya kalau
 * seratus persen memang ujungnya. Begitu ada merek yang melampaui target,
 * bar yang dipotong di 100% membuat yang 101% dan yang 180% terlihat sama
 * persis. Di sini skalanya sampai 120%, garis putus-putus menandai target,
 * dan yang melewatinya benar-benar terlihat melewatinya.
 */
function BarCapaian({ capaian, target }: { capaian: number | null; target: number | null }) {
  const SKALA = 120;
  const c = capaian ?? 0;
  const lampaui = c >= BATAS_TERCAPAI;
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Capaian target</span>
        <span
          className={cn(
            "text-[13px] font-bold tabular-nums",
            capaian === null
              ? "text-muted-foreground"
              : lampaui
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-foreground",
          )}
        >
          {capaian === null ? "belum bertarget" : `${formatNumber(capaian, { maximumFractionDigits: 0 })}%`}
        </span>
      </div>
      <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            lampaui
              ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
              : c >= 80
                ? "bg-gradient-to-r from-amber-400 to-amber-500"
                : "bg-gradient-to-r from-brand-400 to-brand-600",
          )}
          style={{ width: `${Math.min(100, (Math.max(0, c) / SKALA) * 100)}%` }}
        />
        {/* Penanda target — tetap di 100% berapa pun capaiannya. */}
        <span
          className="absolute inset-y-0 w-px bg-foreground/25"
          style={{ left: `${(BATAS_TERCAPAI / SKALA) * 100}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
        Target {target == null ? "—" : formatIDR(target)}
      </p>
    </div>
  );
}

function KartuBrand({ kartu, logo }: { kartu: KartuMerek; logo?: string }) {
  const naik = (kartu.mom ?? 0) >= 0;
  return (
    <div className="w-[19rem] shrink-0 snap-start rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <LambangMerek merek={kartu.merek} logo={logo} />
        <span className="truncate text-[15px] font-semibold text-foreground">{kartu.merek}</span>
        <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {kartu.outlet} outlet
        </span>
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
      <BarCapaian capaian={kartu.capaian} target={kartu.targetBulan} />
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
  L,
}: {
  baris: BarisHarian;
  nomor: number | null;
  kolom: HariKolom[];
  mode: Mode;
  tebal?: boolean;
  /** Lebar kolom beku yang sedang berlaku — lega atau sempit. */
  L: (typeof LEBAR)[keyof typeof LEBAR];
  /**
   * Lapisan sel yang menempel.
   *
   * Baris gabungan menempel di BAWAH layar, jadi sel-sel tepinya harus berada
   * di atas sel tepi baris biasa — kalau sama, keduanya saling menembus persis
   * di titik silangnya, dan yang terbaca di pojok adalah dua angka bertumpuk.
   */
  lapis?: string;
}) {
  // LATARNYA PEKAT, bukan warna tipis di atas latar lain. Sel yang menempel
  // dengan latar tembus pandang membuat tanggal yang bergeser di belakangnya
  // terbaca menumpuk dengan angkanya — persis kerusakan yang baru diperbaiki.
  // Baris gabungan dibedakan lewat huruf tebal, lambang Σ, dan garis atasnya.
  const dasar = tebal ? "bg-muted" : "bg-card";
  const lunas = baris.kurang !== null && baris.kurang <= 0;
  return (
    <tr className={cn("baris-harian border-t border-border", tebal && "bg-muted font-semibold")}>
      <td className={cn("sel-tempel sticky px-2 py-1.5 text-center text-[11px] tabular-nums text-muted-foreground", lapis, dasar)} style={kunci(L.no, 0)}>
        {nomor ?? <span className="text-[12px] font-bold text-brand-600">Σ</span>}
      </td>
      <td className={cn("sel-tempel sticky px-2 py-1.5", lapis, dasar)} style={kunci(L.nama, L.no)}>
        <NamaBerjalan nama={baris.nama} />
        <span className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <span className="min-w-0 truncate">{baris.area}</span>
          <Api deret={baris.deret} />
        </span>
      </td>
      <td
        className={cn("sel-tempel tepi-kiri sticky border-r border-border px-2 py-1.5 text-right", lapis, dasar)}
        style={kunci(L.bulan, L.no + L.nama)}
      >
        {/* Di layar sempit angkanya dipendekkan, bukan dipotong titik-titik:
            "Rp 1.295.774…" menyembunyikan justru digit yang menentukan
            besarnya, sementara "Rp 1,3 M" tetap memberi tahu ukurannya. */}
        <span
          className="block truncate text-[12.5px] font-semibold tabular-nums text-foreground"
          title={baris.bulanIni === null ? undefined : formatIDR(baris.bulanIni)}
        >
          {baris.bulanIni === null ? "—" : L.kurang === 0 ? formatIDRShort(baris.bulanIni) : formatIDR(baris.bulanIni)}
        </span>
        {mode !== "target" ? (
          <Ubah nilai={baris.mom} besar />
        ) : (
          // TEKS, bukan ikon. Lambang sasaran ◎ harus dihafal artinya lebih
          // dulu; "Target Rp 2,9 M" tidak perlu dihafal siapa pun.
          //
          // Di layar sempit kolom Kurang tidak ikut tampil, jadi angkanya
          // pindah ke sini — yang hilang cuma tempatnya, bukan angkanya.
          <span className="block truncate text-[10.5px] tabular-nums text-muted-foreground">
            {baris.targetBulan == null ? (
              "Belum bertarget"
            ) : L.kurang === 0 && baris.kurang !== null ? (
              <>
                <span className="font-medium uppercase tracking-wide">{lunas ? "Lebih" : "Kurang"}</span>{" "}
                <span className={cn("font-semibold", lunas ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/70")}>
                  {formatIDRShort(lunas ? (baris.bulanIni ?? 0) - baris.targetBulan : baris.kurang)}
                </span>
              </>
            ) : (
              <>
                <span className="font-medium uppercase tracking-wide">Target</span>{" "}
                <span className="font-semibold text-foreground/70">{formatIDRShort(baris.targetBulan)}</span>
              </>
            )}
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
            <span className="flex items-center justify-end gap-1 text-[12.5px] font-bold text-emerald-600 dark:text-emerald-400">
              <ChevronUp className="size-3.5" />
              Target tercapai
            </span>
            <span className="block truncate text-[10.5px] tabular-nums text-muted-foreground">
              lebih {formatIDRShort((baris.bulanIni ?? 0) - (baris.targetBulan ?? 0))}
            </span>
          </>
        ) : (
          <>
            <span className="block truncate text-[12.5px] font-bold tabular-nums text-foreground">
              {formatIDR(baris.kurang)}
            </span>
            <span className="block truncate text-[10.5px] tabular-nums text-muted-foreground">
              {baris.perHariSisa === null
                ? `${baris.sisaHari} hari tersisa`
                : `${formatIDRShort(baris.perHariSisa)}/hari × ${baris.sisaHari} hari`}
            </span>
          </>
        )}
      </td>
      )}
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
  const sempit = useSempit();
  const L = sempit ? LEBAR.sempit : LEBAR.lega;

  const pindah = (p: { bulan?: string; area?: string }) => {
    const q = new URLSearchParams();
    q.set("bulan", p.bulan ?? detail.periode);
    const a = p.area ?? areaTerpilih ?? "";
    if (a) q.set("area", a);
    router.push(`/operational/daily?${q.toString()}`);
  };

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
        @keyframes jalan{0%,12%{transform:translateX(0)}88%,100%{transform:translateX(calc(-100% + ${L.nama - 20}px))}}
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

      {/* Bilah saringan yang MENYESUAIKAN LEBAR, bukan menumpuk ke bawah.
          Pada layar sempit pemilih bulan menyusut, nama bulan dipendekkan,
          dan pengalih tampilan tinggal ikonnya — tiga baris tombol di atas
          tabel memakan tinggi yang justru dibutuhkan barisnya. */}
      <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto sm:gap-2">
        <div className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card p-0.5">
          <button
            type="button"
            aria-label="Bulan sebelumnya"
            onClick={() => pindah({ bulan: geserBulan(detail.periode, -1) })}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="px-1.5 text-center text-[13px] font-medium text-foreground sm:min-w-[8.5rem] sm:px-2">
            <span className="hidden sm:inline">{labelBulan(detail.periode)}</span>
            <span className="sm:hidden">{labelBulanPendek(detail.periode)}</span>
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
          <div className="w-36 shrink-0 sm:w-56">
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

        <div className="inline-flex shrink-0 rounded-lg border border-border bg-card p-0.5">
          {(["target", "banding"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              title={m === "target" ? "Capaian target harian" : "Perbandingan dengan hari sebelumnya"}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] font-medium",
                mode === m ? "bg-brand-500 text-white" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "target" ? <Flame className="size-3.5" /> : <TrendingUp className="size-3.5" />}
              <span className="hidden md:inline">{m === "target" ? "Capaian target" : "Banding hari lalu"}</span>
            </button>
          ))}
        </div>

      </div>

      {/* GESERNYA BERHENTI PAS DI BATAS KOLOM. Tanpa ini, kolom paling kiri di
          daerah yang bergeser selalu berhenti separuh — yang terbaca di
          sebelah tepi beku cuma potongan huruf, dan itu terlihat persis
          seperti dua kolom yang saling tembus. */}
      <div
        className="min-h-0 flex-1 snap-x snap-mandatory overflow-auto rounded-2xl border border-border bg-card"
        style={{ scrollPaddingLeft: L.no + L.nama + L.bulan, scrollPaddingRight: L.kurang }}
      >
        <table className="w-max min-w-full border-collapse text-left">
          <thead className="sticky top-0 z-30">
            <tr className="bg-muted">
              <th className="sticky z-40 bg-muted px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" style={kunci(L.no, 0)}>
                #
              </th>
              <th className="sticky z-40 bg-muted px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" style={kunci(L.nama, L.no)}>
                Nama Outlet
              </th>
              <th
                className="tepi-kiri sticky z-40 border-r border-border bg-muted px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                style={kunci(L.bulan, L.no + L.nama)}
              >
                Bulan Ini
                <span className="block text-[9px] font-normal normal-case tracking-normal">
                  {mode === "target" ? "dengan targetnya" : "vs tanggal sama bulan lalu"}
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
              {L.kurang > 0 && (
              <th
                className="tepi-kanan sticky right-0 z-40 border-l border-border bg-muted px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                style={kunci(L.kurang)}
              >
                Kurang
                <span className="block text-[9px] font-normal normal-case tracking-normal">untuk capai target</span>
              </th>
              )}
            </tr>
          </thead>
          <tbody>
            {detail.baris.map((b, i) => (
              <Baris key={b.outletId} baris={b} nomor={i + 1} kolom={detail.kolom} mode={mode} L={L} />
            ))}
            {detail.baris.length === 0 && (
              <tr>
                <td colSpan={(L.kurang > 0 ? 4 : 3) + detail.kolom.length} className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                  Belum ada outlet yang bisa ditampilkan di sini.
                </td>
              </tr>
            )}
          </tbody>
          {detail.total && (
            <tfoot className="sticky bottom-0 z-30 shadow-[0_-2px_6px_-2px_rgb(0_0_0/.12)]">
              <Baris baris={detail.total} nomor={null} kolom={detail.kolom} mode={mode} tebal lapis="z-30" L={L} />
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
