"use client";

import * as React from "react";
import {
  ChevronDown,
  Expand,
  Layers,
  Maximize2,
  Minimize2,
  Minus,
  Network,
  Plus,
  RotateCcw,
  Search,
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
  tataKolom,
  ukuranKanvas,
  type SimpulBagan,
  type SimpulTertata,
} from "@/lib/hcmos/bagan";
import { cn } from "@/lib/utils";

/**
 * Bagan struktur organisasi.
 *
 * Dua tampilan atas data yang sama, dan bedanya bukan selera:
 *
 *  • PER LEVEL menjawab "siapa saja yang setara" — barisan mendatar per level,
 *    dengan label level menempel di kiri supaya tetap terbaca saat digulir.
 *  • BAGAN KOLOM menjawab "siapa melapor ke siapa". Tiap kepala divisi memulai
 *    kolomnya sendiri dan keturunannya menumpuk lurus ke bawah — lihat catatan
 *    di `tataKolom` soal kenapa bukan pohon simetris.
 *
 * Seluruhnya membaca daftar departemen dari User Management. Tidak ada daftar
 * kedua yang harus disamakan.
 */

const WARNA: Record<number, { pekat: string; muda: string; lembut: string }> = {
  1: { pekat: "#7c3aed", muda: "#a78bfa", lembut: "#ede9fe" },
  2: { pekat: "#2563eb", muda: "#60a5fa", lembut: "#dbeafe" },
  3: { pekat: "#0891b2", muda: "#22d3ee", lembut: "#cffafe" },
  4: { pekat: "#059669", muda: "#34d399", lembut: "#d1fae5" },
  5: { pekat: "#d97706", muda: "#fbbf24", lembut: "#fef3c7" },
  6: { pekat: "#e11d48", muda: "#fb7185", lembut: "#ffe4e6" },
};
const NETRAL = { pekat: "#64748b", muda: "#94a3b8", lembut: "#f1f5f9" };
const warna = (level: number | null) => (level && WARNA[level]) || NETRAL;

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 2;

export function BaganOrganisasi({ simpul, bolehUbah }: { simpul: SimpulBagan[]; bolehUbah: boolean }) {
  const [tampilan, setTampilan] = React.useState<"level" | "kolom">("level");
  const [cari, setCari] = React.useState("");
  const [dipilih, setDipilih] = React.useState<string | null>(null);
  const [terlipat, setTerlipat] = React.useState<Set<string>>(new Set());
  const [zoom, setZoom] = React.useState(0.6);
  const [layarPenuh, setLayarPenuh] = React.useState(false);
  const [lokal, setLokal] = React.useState(simpul);
  const bingkai = React.useRef<HTMLDivElement>(null);

  // Menyelaraskan salinan lokal dengan props tanpa efek — lihat catatan panjang
  // di bawah kenapa salinan lokal ini ada sama sekali.
  const [asal, setAsal] = React.useState(simpul);
  if (asal !== simpul) {
    setAsal(simpul);
    setLokal(simpul);
  }

  const tertata = React.useMemo(() => tataKolom(lokal, terlipat), [lokal, terlipat]);
  const garis = React.useMemo(() => garisKolom(tertata), [tertata]);
  const ukuran = React.useMemo(() => ukuranKanvas(tertata), [tertata]);
  const cocokIds = React.useMemo(
    () => new Set(lokal.filter((s) => cocok(s, cari)).map((s) => s.id)),
    [lokal, cari],
  );
  const hubungan = React.useMemo(
    () => lokal.filter((s) => s.parentId && lokal.some((x) => x.id === s.parentId)).length,
    [lokal],
  );
  const namaInduk = React.useMemo(() => new Map(lokal.map((s) => [s.id, s.nama])), [lokal]);

  /* ── simpan ── */
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

  /* ── geser kartu & geser kanvas ── */
  const geser = React.useRef<{ id: string; dx: number; dy: number; asalX: number; asalY: number } | null>(null);
  const sapu = React.useRef<{ x: number; y: number; kiri: number; atas: number } | null>(null);

  const saatGerak = (e: React.PointerEvent) => {
    const g = geser.current;
    if (g) {
      // Dibagi zoom: satu piksel layar bukan satu piksel kanvas saat diperbesar.
      const x = g.asalX + (e.clientX - g.dx) / zoom;
      const y = g.asalY + (e.clientY - g.dy) / zoom;
      setLokal((prev) => prev.map((s) => (s.id === g.id ? { ...s, posX: x, posY: y } : s)));
      return;
    }
    const p = sapu.current;
    if (p && bingkai.current) {
      bingkai.current.scrollLeft = p.kiri - (e.clientX - p.x);
      bingkai.current.scrollTop = p.atas - (e.clientY - p.y);
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

  /* ── zoom ── */
  const muat = React.useCallback(() => {
    const el = bingkai.current;
    if (!el) return;
    const skala = Math.min((el.clientWidth - 48) / ukuran.lebar, (el.clientHeight - 48) / ukuran.tinggi, ZOOM_MAX);
    setZoom(Math.max(ZOOM_MIN, Number.isFinite(skala) && skala > 0 ? skala : 0.6));
  }, [ukuran]);

  React.useEffect(() => {
    const ganti = () => setLayarPenuh(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", ganti);
    return () => document.removeEventListener("fullscreenchange", ganti);
  }, []);

  const terpilih = lokal.find((s) => s.id === dipilih) ?? null;

  return (
    <div
      ref={bingkai}
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-border bg-card",
        layarPenuh && "h-screen",
      )}
    >
      {/* ── batang alat ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted ring-1 ring-border">
          <Network className="size-4.5 text-foreground/70" />
        </span>
        <div className="mr-auto min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">Struktur Organisasi</p>
          <p className="text-[11px] leading-tight text-muted-foreground">
            {lokal.length} role · {hubungan} hubungan pelaporan
          </p>
        </div>

        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari role…"
            className="h-9 pl-9"
          />
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
          <div className="flex items-center gap-0.5 rounded-xl border border-border p-0.5">
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
            simpul={lokal}
            cocokIds={cocokIds}
            mencari={cari.trim() !== ""}
            namaInduk={namaInduk}
            dipilih={dipilih}
            onPilih={(id) => bolehUbah && setDipilih((k) => (k === id ? null : id))}
          />
        </div>
      ) : (
        <div
          className={cn(
            "relative overflow-auto bg-muted/20 bg-[radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [background-size:22px_22px]",
            layarPenuh ? "flex-1" : "h-[34rem]",
          )}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.kanvas === "1") {
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
            className="relative origin-top-left p-6"
            style={{ width: ukuran.lebar + 48, height: ukuran.tinggi + 48, transform: `scale(${zoom})` }}
          >
            <svg className="pointer-events-none absolute inset-0 overflow-visible" width={ukuran.lebar + 48} height={ukuran.tinggi + 48}>
              <g transform="translate(24,24)">
                {garis.map((g) => {
                  const menumpuk = Math.abs(g.x1 - g.x2) < 1;
                  const d = menumpuk
                    ? `M ${g.x1} ${g.y1} V ${g.y2}`
                    : `M ${g.x1} ${g.y1} V ${(g.y1 + g.y2) / 2} H ${g.x2} V ${g.y2}`;
                  return (
                    <path
                      key={`${g.dari}-${g.ke}`}
                      d={d}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.25}
                      className="text-border"
                    />
                  );
                })}
              </g>
            </svg>
            {tertata.map((s) => (
              <div
                key={s.id}
                className="absolute"
                style={{ left: s.x + 24, top: s.y + 24, width: LEBAR_KOLOM, height: TINGGI_KOLOM }}
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
                  redup={cari.trim() !== "" && !cocokIds.has(s.id)}
                  bawahan={jumlahKeturunan(lokal, s.id)}
                  terlipat={terlipat.has(s.id)}
                  onLipat={() =>
                    setTerlipat((prev) => {
                      const n = new Set(prev);
                      if (n.has(s.id)) n.delete(s.id);
                      else n.add(s.id);
                      return n;
                    })
                  }
                  onKlik={() => bolehUbah && setDipilih((k) => (k === s.id ? null : s.id))}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── kaki: legenda + petunjuk ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        <span>{bolehUbah ? "Bisa disusun" : "Mode hanya lihat"}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium text-foreground">Legenda:</span>
          {Array.from({ length: LEVEL_MAX }, (_, i) => i + 1).map((l) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: warna(l).pekat }} />
              Level {l}
            </span>
          ))}
        </span>
        {tampilan === "kolom" && (
          <span className="ml-auto hidden sm:block">
            Ctrl+scroll untuk zoom, seret area kosong untuk menggeser kanvas.
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
  terlipat,
  onLipat,
  onKlik,
}: {
  simpul: SimpulBagan | SimpulTertata;
  namaInduk: Map<string, string>;
  padat?: boolean;
  dipilih?: boolean;
  redup?: boolean;
  bawahan: number;
  terlipat?: boolean;
  onLipat?: () => void;
  onKlik: () => void;
}) {
  const w = warna(simpul.level);
  const induk = simpul.parentId ? namaInduk.get(simpul.parentId) : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onKlik}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onKlik()}
      className={cn(
        "group relative flex h-full w-full cursor-pointer overflow-hidden rounded-xl border bg-card text-left shadow-sm transition",
        "hover:-translate-y-0.5 hover:shadow-md",
        dipilih ? "border-transparent ring-2 ring-offset-2 ring-offset-background" : "border-border",
        redup && "opacity-25",
      )}
      style={dipilih ? ({ "--tw-ring-color": w.pekat } as React.CSSProperties) : undefined}
    >
      {/* Pita level di tepi kiri — penanda yang tetap terbaca ketika bagannya
          diperkecil sampai tulisannya hilang. */}
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: w.pekat }} />

      <div className={cn("flex min-w-0 flex-1 flex-col", padat ? "gap-0.5 py-1.5 pl-3 pr-2" : "gap-1 py-2.5 pl-4 pr-3")}>
        <div className="flex min-w-0 items-start gap-2">
          <span
            className={cn(
              "grid shrink-0 place-items-center rounded-lg font-bold",
              padat ? "size-6 text-[9px]" : "size-9 text-[11px]",
            )}
            style={{ background: w.lembut, color: w.pekat }}
          >
            {inisialDari(simpul.nama)}
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate font-semibold text-foreground", padat ? "text-[10px] leading-tight" : "text-sm")}>
              {simpul.nama}
            </span>
            <span className={cn("block truncate text-muted-foreground", padat ? "text-[8px] leading-tight" : "text-[11px]")}>
              {induk ? `Melapor ke ${induk}` : "Pimpinan tertinggi"}
            </span>
          </span>
        </div>

        {!padat && simpul.deskripsi && (
          <p className="line-clamp-2 text-[12px] leading-snug text-muted-foreground">{simpul.deskripsi}</p>
        )}

        <div className={cn("mt-auto flex items-center gap-1", padat ? "pt-0.5" : "border-t border-border pt-2")}>
          <span
            className={cn("rounded-md font-semibold", padat ? "px-1 py-px text-[7.5px]" : "px-1.5 py-0.5 text-[10px]")}
            style={{ background: w.lembut, color: w.pekat }}
          >
            Level {simpul.level ?? "–"}
          </span>
          <span
            className={cn(
              "flex items-center gap-0.5 rounded-md bg-muted text-muted-foreground",
              padat ? "px-1 py-px text-[7.5px]" : "px-1.5 py-0.5 text-[10px]",
            )}
          >
            <Users className={padat ? "size-2" : "size-3"} /> {simpul.jumlahOrang}
          </span>
          {bawahan > 0 && (
            <span
              className={cn(
                "rounded-md bg-muted text-muted-foreground",
                padat ? "px-1 py-px text-[7.5px]" : "px-1.5 py-0.5 text-[10px]",
              )}
            >
              {bawahan} bawahan
            </span>
          )}
          {bawahan > 0 && onLipat && (
            <button
              type="button"
              aria-label={terlipat ? "Buka cabang" : "Lipat cabang"}
              onClick={(e) => {
                e.stopPropagation();
                onLipat();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="ml-auto grid size-4 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronDown className={cn("size-3 transition", terlipat && "-rotate-90")} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── tampilan level ───────────────────────────── */

function TampilanLevel({
  simpul,
  cocokIds,
  mencari,
  namaInduk,
  dipilih,
  onPilih,
}: {
  simpul: SimpulBagan[];
  cocokIds: Set<string>;
  mencari: boolean;
  namaInduk: Map<string, string>;
  dipilih: string | null;
  onPilih: (id: string) => void;
}) {
  const baris = perLevel(mencari ? simpul.filter((s) => cocokIds.has(s.id)) : simpul);
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
            {/* Label level menempel di kiri — tetap terbaca saat barisnya
                digulir ke samping, dan tidak ikut memakan tinggi baris. */}
            <div className="w-20 shrink-0 pt-1">
              <span
                className="inline-block rounded-lg px-2 py-1 text-xs font-bold"
                style={{ background: w.lembut, color: w.pekat }}
              >
                Level {b.level ?? "–"}
              </span>
              <p className="mt-1 text-[11px] text-muted-foreground">{b.simpul.length} role</p>
            </div>
            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {b.simpul.map((s) => (
                <div key={s.id} className="min-h-[9rem]">
                  <KartuRole
                    simpul={s}
                    namaInduk={namaInduk}
                    dipilih={dipilih === s.id}
                    bawahan={simpul.filter((x) => x.parentId === s.id).length}
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
            className="grid size-9 shrink-0 place-items-center rounded-xl text-[11px] font-bold"
            style={{ background: w.lembut, color: w.pekat }}
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
