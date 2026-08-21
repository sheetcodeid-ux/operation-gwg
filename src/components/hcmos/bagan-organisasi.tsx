"use client";

import * as React from "react";
import {
  ChevronRight,
  Expand,
  FoldVertical,
  Layers,
  Maximize2,
  Minimize2,
  Minus,
  Network,
  Plus,
  RotateCcw,
  Search,
  UnfoldVertical,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rapikanBaganAction, simpanPenempatanAction } from "@/lib/actions/bagan";
import {
  LEBAR_KOLOM,
  LEVEL_MAX,
  NAMA_LEVEL,
  TINGGI_KOLOM,
  bolehJadiAtasan,
  cocok,
  garisKolom,
  inisialDari,
  jumlahKeturunan,
  perLevel,
  rantaiKeAtas,
  silsilah,
  simpulBercabang,
  tataKolom,
  ukuranKanvas,
  type SimpulBagan,
} from "@/lib/hcmos/bagan";
import { cn } from "@/lib/utils";

/**
 * Bagan struktur organisasi.
 *
 * Bagan enam puluh kotak punya satu masalah yang tidak dimiliki bagan sepuluh
 * kotak: begitu semuanya tergambar, tidak ada satu pun yang menonjol. Karena
 * itu yang ditambahkan di sini bukan hiasan melainkan cara MEMPERSEMPIT —
 *
 *  • SOROT SILSILAH. Menunjuk satu kotak akan menyalakan jalurnya ke puncak
 *    beserta seluruh bawahannya, dan meredupkan sisanya. Pertanyaan yang
 *    sebenarnya dibawa orang ke bagan bukan "kotak ini apa" melainkan "kotak
 *    ini bagian dari jalur yang mana".
 *  • JEJAK. Rantai atasan ditulis sebagai remah di batang alat, jadi jalurnya
 *    tetap terbaca meski kotak induknya sedang di luar layar.
 *  • LIPAT. Cabang yang tidak sedang dilihat bisa ditutup, dan tombolnya
 *    menyebut berapa yang disembunyikan — bukan cuma tanda panah.
 *  • PETA KECIL. Pada 61 kotak, penggeser layar tidak memberi tahu di mana
 *    posisi kita; peta kecil memberi tahu.
 */

const WARNA: Record<number, { pekat: string; muda: string; lembut: string }> = {
  1: { pekat: "#7c3aed", muda: "#a78bfa", lembut: "#f3f0ff" },
  2: { pekat: "#2563eb", muda: "#60a5fa", lembut: "#eff5ff" },
  3: { pekat: "#0891b2", muda: "#22d3ee", lembut: "#ecfeff" },
  4: { pekat: "#059669", muda: "#34d399", lembut: "#ecfdf5" },
  5: { pekat: "#d97706", muda: "#fbbf24", lembut: "#fffbeb" },
  6: { pekat: "#e11d48", muda: "#fb7185", lembut: "#fff1f2" },
};
const NETRAL = { pekat: "#64748b", muda: "#94a3b8", lembut: "#f8fafc" };
const warna = (level: number | null) => (level && WARNA[level]) || NETRAL;

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 2;

export function BaganOrganisasi({ simpul, bolehUbah }: { simpul: SimpulBagan[]; bolehUbah: boolean }) {
  const [tampilan, setTampilan] = React.useState<"level" | "kolom">("kolom");
  const [cari, setCari] = React.useState("");
  const [dipilih, setDipilih] = React.useState<string | null>(null);
  const [terlipat, setTerlipat] = React.useState<Set<string>>(new Set());
  const [zoom, setZoom] = React.useState(0.55);
  const [layarPenuh, setLayarPenuh] = React.useState(false);
  const [lokal, setLokal] = React.useState(simpul);
  const bingkai = React.useRef<HTMLDivElement>(null);
  const gulir = React.useRef<HTMLDivElement>(null);

  const [asal, setAsal] = React.useState(simpul);
  if (asal !== simpul) {
    setAsal(simpul);
    setLokal(simpul);
  }

  const tertata = React.useMemo(() => tataKolom(lokal, terlipat), [lokal, terlipat]);
  const garis = React.useMemo(() => garisKolom(tertata), [tertata]);
  const ukuran = React.useMemo(() => ukuranKanvas(tertata), [tertata]);
  const namaInduk = React.useMemo(() => new Map(lokal.map((s) => [s.id, s.nama])), [lokal]);
  const hubungan = React.useMemo(
    () => lokal.filter((s) => s.parentId && lokal.some((x) => x.id === s.parentId)).length,
    [lokal],
  );
  const cocokIds = React.useMemo(
    () => new Set(lokal.filter((s) => cocok(s, cari)).map((s) => s.id)),
    [lokal, cari],
  );
  const mencari = cari.trim() !== "";

  // Sorotan: kalau ada yang dipilih, jalurnya yang menyala; kalau tidak, hasil
  // pencarian. Keduanya tidak pernah aktif bersamaan — dua sorotan di layar
  // yang sama saling meniadakan artinya.
  const disorot = React.useMemo(() => {
    if (dipilih) return silsilah(lokal, dipilih);
    if (mencari) return cocokIds;
    return null;
  }, [dipilih, mencari, cocokIds, lokal]);

  const jejak = React.useMemo(
    () => (dipilih ? rantaiKeAtas(lokal, dipilih).reverse() : []),
    [dipilih, lokal],
  );
  const bercabang = React.useMemo(() => simpulBercabang(lokal), [lokal]);
  const semuaTerlipat = terlipat.size >= bercabang.length && bercabang.length > 0;

  const simpan = React.useCallback(
    async (input: Parameters<typeof simpanPenempatanAction>[0]) => {
      const res = await simpanPenempatanAction(input);
      if (res.error) {
        toast.error(res.error);
        setLokal(simpul);
        return false;
      }
      return true;
    },
    [simpul],
  );

  /* ── geser kartu & sapu kanvas ── */
  const geser = React.useRef<{ id: string; dx: number; dy: number; asalX: number; asalY: number } | null>(null);
  const sapu = React.useRef<{ x: number; y: number; kiri: number; atas: number } | null>(null);

  const saatGerak = (e: React.PointerEvent) => {
    const g = geser.current;
    if (g) {
      const x = g.asalX + (e.clientX - g.dx) / zoom;
      const y = g.asalY + (e.clientY - g.dy) / zoom;
      setLokal((prev) => prev.map((s) => (s.id === g.id ? { ...s, posX: x, posY: y } : s)));
      return;
    }
    const p = sapu.current;
    if (p && gulir.current) {
      gulir.current.scrollLeft = p.kiri - (e.clientX - p.x);
      gulir.current.scrollTop = p.atas - (e.clientY - p.y);
    }
  };

  const selesaiGerak = () => {
    const g = geser.current;
    geser.current = null;
    sapu.current = null;
    if (!g) return;
    const s = lokal.find((x) => x.id === g.id);
    if (!s || (s.posX === g.asalX && s.posY === g.asalY)) return;
    void simpan({ id: g.id, posX: s.posX, posY: s.posY });
  };

  const muat = React.useCallback(() => {
    const el = gulir.current;
    if (!el) return;
    const skala = Math.min((el.clientWidth - 64) / ukuran.lebar, (el.clientHeight - 64) / ukuran.tinggi, ZOOM_MAX);
    setZoom(Math.max(ZOOM_MIN, Number.isFinite(skala) && skala > 0 ? skala : 0.55));
  }, [ukuran]);

  React.useEffect(() => {
    const ganti = () => setLayarPenuh(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", ganti);
    return () => document.removeEventListener("fullscreenchange", ganti);
  }, []);

  // Esc melepas pilihan — jalan keluar yang sama di setiap layar.
  React.useEffect(() => {
    const tekan = (e: KeyboardEvent) => e.key === "Escape" && setDipilih(null);
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, []);

  const terpilih = lokal.find((s) => s.id === dipilih) ?? null;

  return (
    <div
      ref={bingkai}
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        layarPenuh && "h-screen rounded-none",
      )}
    >
      {/* ── batang alat ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-gradient-to-b from-muted/40 to-transparent px-3 py-2.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
          <Network className="size-5" />
        </span>
        <div className="mr-auto min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">Struktur Organisasi</p>
          {/* Jejak menggantikan hitungan saat ada yang dipilih: yang dibutuhkan
              saat itu bukan "berapa totalnya" melainkan "saya sedang di mana". */}
          {jejak.length > 0 ? (
            <p className="flex min-w-0 items-center gap-1 truncate text-[11px] leading-tight text-muted-foreground">
              {jejak.map((j) => (
                <React.Fragment key={j.id}>
                  <button
                    type="button"
                    onClick={() => setDipilih(j.id)}
                    className="truncate hover:text-foreground hover:underline"
                  >
                    {j.nama}
                  </button>
                  <ChevronRight className="size-3 shrink-0 opacity-50" />
                </React.Fragment>
              ))}
              <span className="truncate font-medium text-foreground">{terpilih?.nama}</span>
            </p>
          ) : (
            <p className="text-[11px] leading-tight text-muted-foreground">
              {lokal.length} role · {hubungan} hubungan pelaporan
            </p>
          )}
        </div>

        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={cari}
            onChange={(e) => {
              setCari(e.target.value);
              setDipilih(null);
            }}
            placeholder="Cari role…"
            className="h-9 pl-9 pr-14"
          />
          {mencari && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
              {cocokIds.size}/{lokal.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 rounded-xl bg-muted p-0.5">
          <TombolTampilan aktif={tampilan === "level"} onClick={() => setTampilan("level")} ikon={Layers}>
            Per level
          </TombolTampilan>
          <TombolTampilan aktif={tampilan === "kolom"} onClick={() => setTampilan("kolom")} ikon={Network}>
            Bagan kolom
          </TombolTampilan>
        </div>

        {tampilan === "kolom" && (
          <div className="flex items-center gap-0.5 rounded-xl border border-border bg-background p-0.5">
            <Button
              variant="ghost"
              size="icon"
              aria-label={semuaTerlipat ? "Buka semua cabang" : "Lipat semua cabang"}
              onClick={() => setTerlipat(semuaTerlipat ? new Set() : new Set(bercabang))}
            >
              {semuaTerlipat ? <UnfoldVertical className="size-4" /> : <FoldVertical className="size-4" />}
            </Button>
            <span className="mx-0.5 h-5 w-px bg-border" />
            <Button variant="ghost" size="icon" aria-label="Perkecil" onClick={() => setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - 0.06) * 100) / 100))}>
              <Minus className="size-4" />
            </Button>
            <span className="min-w-[3rem] text-center text-xs font-semibold tabular-nums text-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Button variant="ghost" size="icon" aria-label="Perbesar" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + 0.06) * 100) / 100))}>
              <Plus className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={muat} className="gap-1.5 px-2">
              <Expand className="size-4" /> Fit
            </Button>
            {bolehUbah && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Rapikan posisi"
                onClick={async () => {
                  const res = await rapikanBaganAction();
                  if (res.error) toast.error(res.error);
                  else {
                    setLokal((prev) => prev.map((s) => ({ ...s, posX: null, posY: null })));
                    toast.success("Posisi dikembalikan ke tata letak otomatis.");
                  }
                }}
              >
                <RotateCcw className="size-4" />
              </Button>
            )}
          </div>
        )}

        <Button
          variant="outline"
          size="icon"
          aria-label={layarPenuh ? "Keluar layar penuh" : "Layar penuh"}
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void bingkai.current?.requestFullscreen?.();
          }}
        >
          {layarPenuh ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>
      </div>

      {/* ── isi ── */}
      {tampilan === "level" ? (
        <div className={cn("overflow-auto bg-muted/20 p-4", layarPenuh ? "flex-1" : "max-h-[34rem]")}>
          <TampilanLevel
            simpul={mencari ? lokal.filter((s) => cocokIds.has(s.id)) : lokal}
            semua={lokal}
            namaInduk={namaInduk}
            dipilih={dipilih}
            disorot={dipilih ? disorot : null}
            onPilih={(id) => setDipilih((k) => (k === id ? null : id))}
          />
        </div>
      ) : (
        <div className="relative">
          <div
            ref={gulir}
            className={cn(
              "relative overflow-auto bg-muted/20 bg-[radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [background-size:24px_24px]",
              layarPenuh ? "h-[calc(100vh-7.5rem)]" : "h-[34rem]",
            )}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).dataset.kanvas === "1") {
                setDipilih(null);
                sapu.current = {
                  x: e.clientX,
                  y: e.clientY,
                  kiri: e.currentTarget.scrollLeft,
                  atas: e.currentTarget.scrollTop,
                };
              }
            }}
            onPointerMove={saatGerak}
            onPointerUp={selesaiGerak}
            onPointerLeave={selesaiGerak}
            onWheel={(e) => {
              if (!e.ctrlKey && !e.metaKey) return;
              e.preventDefault();
              setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z - e.deltaY * 0.002)));
            }}
          >
            <div
              data-kanvas="1"
              className="relative origin-top-left transition-transform duration-150"
              style={{ width: ukuran.lebar + 64, height: ukuran.tinggi + 64, transform: `scale(${zoom})` }}
            >
              <svg
                data-kanvas="1"
                className="pointer-events-none absolute inset-0 overflow-visible"
                width={ukuran.lebar + 64}
                height={ukuran.tinggi + 64}
              >
                <g transform="translate(32,32)">
                  {garis.map((g) => {
                    const menumpuk = Math.abs(g.x1 - g.x2) < 1;
                    const r = 10;
                    const tengah = (g.y1 + g.y2) / 2;
                    const arah = g.x2 > g.x1 ? 1 : -1;
                    const d = menumpuk
                      ? `M ${g.x1} ${g.y1} V ${g.y2}`
                      : `M ${g.x1} ${g.y1} V ${tengah - r} Q ${g.x1} ${tengah} ${g.x1 + r * arah} ${tengah} H ${g.x2 - r * arah} Q ${g.x2} ${tengah} ${g.x2} ${tengah + r} V ${g.y2}`;
                    const nyala = !disorot || (disorot.has(g.dari) && disorot.has(g.ke));
                    return (
                      <path
                        key={`${g.dari}-${g.ke}`}
                        d={d}
                        fill="none"
                        strokeWidth={nyala && disorot ? 2 : 1.25}
                        stroke={nyala && disorot ? warna(lokal.find((s) => s.id === g.ke)?.level ?? null).muda : "currentColor"}
                        className={cn("text-border transition-opacity", !nyala && "opacity-20")}
                      />
                    );
                  })}
                </g>
              </svg>
              {tertata.map((s) => {
                const anakLangsung = lokal.filter((x) => x.parentId === s.id).length;
                return (
                  <div
                    key={s.id}
                    className="absolute"
                    style={{ left: s.x + 32, top: s.y + 32, width: LEBAR_KOLOM, height: TINGGI_KOLOM }}
                    onPointerDown={(e) => {
                      if (!bolehUbah) return;
                      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                      geser.current = { id: s.id, dx: e.clientX, dy: e.clientY, asalX: s.x, asalY: s.y };
                    }}
                  >
                    <KartuRole
                      simpul={s}
                      namaInduk={namaInduk}
                      padat
                      dipilih={dipilih === s.id}
                      redup={!!disorot && !disorot.has(s.id)}
                      bawahan={jumlahKeturunan(lokal, s.id)}
                      anakLangsung={anakLangsung}
                      terlipat={terlipat.has(s.id)}
                      onLipat={() =>
                        setTerlipat((prev) => {
                          const n = new Set(prev);
                          if (n.has(s.id)) n.delete(s.id);
                          else n.add(s.id);
                          return n;
                        })
                      }
                      onKlik={() => setDipilih((k) => (k === s.id ? null : s.id))}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <PetaKecil tertata={tertata} ukuran={ukuran} disorot={disorot} gulir={gulir} zoom={zoom} />
        </div>
      )}

      {/* ── kaki ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 font-medium",
            bolehUbah ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted",
          )}
        >
          {bolehUbah ? "Bisa disusun" : "Mode hanya lihat"}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium text-foreground">Legenda:</span>
          {Array.from({ length: LEVEL_MAX }, (_, i) => i + 1).map((l) => (
            <span key={l} className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full ring-2"
                style={{ background: warna(l).pekat, "--tw-ring-color": warna(l).lembut } as React.CSSProperties}
              />
              Level {l}
            </span>
          ))}
        </span>
        {tampilan === "kolom" && (
          <span className="ml-auto hidden lg:block">
            Klik kartu untuk menyorot jalurnya · Ctrl+scroll zoom · seret area kosong untuk menggeser
          </span>
        )}
      </div>

      {terpilih && bolehUbah && (
        <PanelPenempatan
          simpul={terpilih}
          semua={lokal}
          onTutup={() => setDipilih(null)}
          onSimpan={async (patch) => {
            setLokal((prev) => prev.map((s) => (s.id === terpilih.id ? { ...s, ...patch } : s)));
            if (await simpan({ id: terpilih.id, ...patch })) toast.success("Penempatan tersimpan.");
          }}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────── peta kecil ─────────────────────────────── */

/**
 * Peta kecil di pojok kanvas.
 *
 * Pada 61 kotak, batang penggulir tidak memberi tahu apa pun soal DI MANA kita
 * berada — ia hanya menyatakan sejauh apa sudah digulir. Peta kecil menjawabnya
 * langsung, dan sekaligus jadi cara melompat: klik di mana pun, kanvasnya
 * pindah ke sana.
 */
function PetaKecil({
  tertata,
  ukuran,
  disorot,
  gulir,
  zoom,
}: {
  tertata: { id: string; x: number; y: number; level: number | null }[];
  ukuran: { lebar: number; tinggi: number };
  disorot: Set<string> | null;
  gulir: React.RefObject<HTMLDivElement | null>;
  zoom: number;
}) {
  const LEBAR = 168;
  const skala = LEBAR / Math.max(ukuran.lebar, 1);
  const tinggi = Math.min(ukuran.tinggi * skala, 120);

  return (
    <div
      className="pointer-events-auto absolute bottom-3 right-3 hidden overflow-hidden rounded-xl border border-border bg-card/90 shadow-md backdrop-blur sm:block"
      style={{ width: LEBAR, height: tinggi }}
      onClick={(e) => {
        const el = gulir.current;
        if (!el) return;
        const kotak = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - kotak.left) / skala) * zoom;
        const y = ((e.clientY - kotak.top) / skala) * zoom;
        el.scrollTo({ left: x - el.clientWidth / 2, top: y - el.clientHeight / 2, behavior: "smooth" });
      }}
    >
      {tertata.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-[1px] transition-opacity"
          style={{
            left: s.x * skala,
            top: s.y * skala,
            width: Math.max(LEBAR_KOLOM * skala, 2),
            height: Math.max(TINGGI_KOLOM * skala, 1.5),
            background: warna(s.level).pekat,
            opacity: !disorot || disorot.has(s.id) ? 0.85 : 0.15,
          }}
        />
      ))}
    </div>
  );
}

function TombolTampilan({
  aktif,
  onClick,
  ikon: Ikon,
  children,
}: {
  aktif: boolean;
  onClick: () => void;
  ikon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktif}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
        aktif ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Ikon className="size-3.5" /> {children}
    </button>
  );
}

/* ──────────────────────────────── kartu ──────────────────────────────── */

function KartuRole({
  simpul,
  namaInduk,
  padat,
  dipilih,
  redup,
  bawahan,
  anakLangsung,
  terlipat,
  onLipat,
  onKlik,
}: {
  simpul: SimpulBagan;
  namaInduk: Map<string, string>;
  padat?: boolean;
  dipilih?: boolean;
  redup?: boolean;
  bawahan: number;
  anakLangsung?: number;
  terlipat?: boolean;
  onLipat?: () => void;
  onKlik: () => void;
}) {
  const w = warna(simpul.level);
  const induk = simpul.parentId ? namaInduk.get(simpul.parentId) : null;

  return (
    <div className="relative h-full w-full">
      <div
        role="button"
        tabIndex={0}
        onClick={onKlik}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onKlik()}
        className={cn(
          "group relative flex h-full w-full cursor-pointer overflow-hidden rounded-xl border bg-card text-left transition-all duration-150",
          dipilih
            ? "border-transparent shadow-lg ring-2 ring-offset-2 ring-offset-background"
            : "border-border shadow-sm hover:-translate-y-0.5 hover:shadow-md",
          redup && "opacity-20 saturate-0",
        )}
        style={
          dipilih
            ? ({ "--tw-ring-color": w.pekat, background: `linear-gradient(180deg, ${w.lembut}, transparent 60%)` } as React.CSSProperties)
            : undefined
        }
      >
        {/* Pita gradien di tepi kiri — penanda level yang tetap terbaca ketika
            bagannya diperkecil sampai tulisannya hilang. */}
        <span
          className="absolute inset-y-0 left-0 w-1"
          style={{ background: `linear-gradient(180deg, ${w.pekat}, ${w.muda})` }}
        />

        <div className={cn("flex min-w-0 flex-1 flex-col", padat ? "gap-0.5 py-1.5 pl-3 pr-2" : "gap-1.5 py-3 pl-4 pr-3")}>
          <div className="flex min-w-0 items-start gap-2">
            <span
              className={cn(
                "grid shrink-0 place-items-center rounded-lg font-bold shadow-sm",
                padat ? "size-6 text-[9px]" : "size-10 text-xs",
              )}
              style={{ background: `linear-gradient(135deg, ${w.pekat}, ${w.muda})`, color: "#fff" }}
            >
              {inisialDari(simpul.nama)}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate font-semibold text-foreground", padat ? "text-[10px] leading-tight" : "text-sm leading-tight")}>
                {simpul.nama}
              </span>
              <span className={cn("block truncate text-muted-foreground", padat ? "text-[8px] leading-tight" : "text-[11px] leading-tight")}>
                {induk ? `Melapor ke ${induk}` : "Pimpinan tertinggi"}
              </span>
            </span>
          </div>

          {!padat && simpul.deskripsi && (
            <p className="line-clamp-2 text-[12px] leading-snug text-muted-foreground">{simpul.deskripsi}</p>
          )}

          <div className={cn("mt-auto flex items-center gap-1", padat ? "pt-0.5" : "border-t border-border/70 pt-2")}>
            <span
              className={cn("rounded-md font-bold", padat ? "px-1 py-px text-[7.5px]" : "px-2 py-0.5 text-[10px]")}
              style={{ background: w.lembut, color: w.pekat }}
            >
              Level {simpul.level ?? "–"}
            </span>
            <span
              className={cn(
                "flex items-center gap-0.5 rounded-md bg-muted font-medium text-muted-foreground",
                padat ? "px-1 py-px text-[7.5px]" : "px-2 py-0.5 text-[10px]",
              )}
            >
              <Users className={padat ? "size-2" : "size-3"} /> {simpul.jumlahOrang}
            </span>
            {bawahan > 0 && (
              <span
                className={cn(
                  "rounded-md bg-muted font-medium text-muted-foreground",
                  padat ? "px-1 py-px text-[7.5px]" : "px-2 py-0.5 text-[10px]",
                )}
              >
                {bawahan} bawahan
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tombol lipat menggantung di TEPI BAWAH kartu, tepat di pangkal garis
          keturunannya — di situlah matanya sudah tertuju saat bertanya "apa
          isinya". Saat tertutup ia menyebut berapa yang disembunyikan; tanda
          panah saja tidak memberi tahu apakah isinya satu atau tiga belas. */}
      {(anakLangsung ?? 0) > 0 && onLipat && (
        <button
          type="button"
          aria-label={terlipat ? `Buka ${bawahan} bawahan` : "Lipat cabang"}
          onClick={(e) => {
            e.stopPropagation();
            onLipat();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "absolute left-1/2 z-10 flex -translate-x-1/2 translate-y-[-45%] items-center gap-0.5 rounded-full border border-border bg-card px-1.5 py-px text-[8px] font-bold shadow-sm transition hover:scale-110",
            terlipat ? "text-foreground" : "text-muted-foreground",
          )}
          style={{ top: "100%", borderColor: terlipat ? w.pekat : undefined, color: terlipat ? w.pekat : undefined }}
        >
          {terlipat ? `+${bawahan}` : <ChevronRight className="size-2.5 rotate-90" />}
        </button>
      )}
    </div>
  );
}

/* ───────────────────────────── tampilan level ───────────────────────────── */

function TampilanLevel({
  simpul,
  semua,
  namaInduk,
  dipilih,
  disorot,
  onPilih,
}: {
  simpul: SimpulBagan[];
  semua: SimpulBagan[];
  namaInduk: Map<string, string>;
  dipilih: string | null;
  disorot: Set<string> | null;
  onPilih: (id: string) => void;
}) {
  const baris = perLevel(simpul);
  if (baris.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
        Tidak ada role yang cocok dengan pencarian itu.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {baris.map((b) => {
        const w = warna(b.level);
        return (
          <div key={String(b.level)} className="flex gap-4">
            {/* Label level menempel di kiri dan LENGKET saat digulir — pada
                daftar sepanjang tiga puluh kartu, level yang sedang dilihat
                hilang dari layar jauh sebelum barisnya habis. */}
            <div className="sticky top-0 w-20 shrink-0 self-start pt-1">
              <span
                className="inline-block rounded-lg px-2 py-1 text-xs font-bold shadow-sm"
                style={{ background: `linear-gradient(135deg, ${w.pekat}, ${w.muda})`, color: "#fff" }}
              >
                Level {b.level ?? "–"}
              </span>
              <p className="mt-1 text-[11px] font-medium text-foreground">{b.simpul.length} role</p>
              <p className="text-[10px] leading-tight text-muted-foreground">
                {b.level ? NAMA_LEVEL[b.level] : "belum ditempatkan"}
              </p>
            </div>
            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {b.simpul.map((s) => (
                <div key={s.id} className="min-h-[9.5rem]">
                  <KartuRole
                    simpul={s}
                    namaInduk={namaInduk}
                    dipilih={dipilih === s.id}
                    redup={!!disorot && !disorot.has(s.id)}
                    bawahan={semua.filter((x) => x.parentId === s.id).length}
                    onKlik={() => onPilih(s.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────── panel penempatan ──────────────────────────── */

function PanelPenempatan({
  simpul,
  semua,
  onTutup,
  onSimpan,
}: {
  simpul: SimpulBagan;
  semua: SimpulBagan[];
  onTutup: () => void;
  onSimpan: (patch: { level?: number | null; parentId?: string | null }) => void;
}) {
  const w = warna(simpul.level);
  // Hanya tawarkan atasan yang TIDAK membuat lingkaran. Menawarkan pilihan yang
  // pasti ditolak lalu memarahi pemakainya adalah cara paling membingungkan
  // untuk menegakkan aturan.
  const calon = semua.filter((s) => bolehJadiAtasan(semua, simpul.id, s.id));

  return (
    <div className="border-t border-border bg-muted/30 p-3">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-xl text-xs font-bold text-white shadow-sm"
            style={{ background: `linear-gradient(135deg, ${w.pekat}, ${w.muda})` }}
          >
            {inisialDari(simpul.nama)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{simpul.nama}</p>
            <p className="text-[11px] text-muted-foreground">
              {simpul.jumlahOrang} orang · {simpul.jabatan.length} jabatan
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" aria-label="Tutup" onClick={onTutup}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Level</span>
          <select
            value={simpul.level ?? ""}
            onChange={(e) => onSimpan({ level: e.target.value ? Number(e.target.value) : null })}
            className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
          >
            <option value="">Belum diberi level</option>
            {Array.from({ length: LEVEL_MAX }, (_, i) => i + 1).map((l) => (
              <option key={l} value={l}>
                Level {l} — {NAMA_LEVEL[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Melapor ke</span>
          <select
            value={simpul.parentId ?? ""}
            onChange={(e) => onSimpan({ parentId: e.target.value || null })}
            className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
          >
            <option value="">— Tidak ada (puncak bagan)</option>
            {calon
              .slice()
              .sort((a, b) => (a.level ?? 9) - (b.level ?? 9) || a.nama.localeCompare(b.nama, "id"))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.level ? `L${s.level} · ` : ""}
                  {s.nama}
                </option>
              ))}
          </select>
        </label>
      </div>
    </div>
  );
}
