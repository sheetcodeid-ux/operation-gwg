"use client";

import * as React from "react";
import {
  Expand,
  LayoutGrid,
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
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { rapikanBaganAction, simpanPenempatanAction } from "@/lib/actions/bagan";
import {
  LEBAR_KARTU,
  LEVEL_MAX,
  NAMA_LEVEL,
  TINGGI_KARTU,
  bolehJadiAtasan,
  cocok,
  garisBagan,
  perLevel,
  tataPohon,
  ukuranKanvas,
  type SimpulBagan,
} from "@/lib/hcmos/bagan";
import { cn } from "@/lib/utils";

/**
 * Bagan struktur organisasi — dua tampilan atas data yang sama.
 *
 *  • PER LEVEL menjawab "siapa saja yang setara". Tidak butuh garis pelaporan,
 *    jadi berguna sejak hari pertama, sebelum satu garis pun disusun.
 *  • BAGAN menjawab "siapa melapor ke siapa". Ini yang disusun tangan, dan
 *    karena itu bisa digeser, di-zoom, dan dilayarpenuhkan.
 *
 * Keduanya membaca dari daftar departemen di User Management. Tidak ada daftar
 * kedua yang harus disamakan — struktur yang disalin ke dua tempat selalu
 * berakhir berbeda tanpa ada yang menyadarinya.
 */

/** Warna per level. Dipilih yang tetap terbaca di terang maupun gelap, dan
 *  berurutan dari pekat ke muda supaya kedalamannya terasa tanpa perlu dibaca. */
const WARNA_LEVEL: Record<number, { dari: string; ke: string; teks: string }> = {
  1: { dari: "#1e3a8a", ke: "#3b82f6", teks: "#ffffff" },
  2: { dari: "#0f766e", ke: "#14b8a6", teks: "#ffffff" },
  3: { dari: "#7c2d12", ke: "#f97316", teks: "#ffffff" },
  4: { dari: "#4c1d95", ke: "#8b5cf6", teks: "#ffffff" },
  5: { dari: "#155e75", ke: "#06b6d4", teks: "#ffffff" },
  6: { dari: "#3f6212", ke: "#84cc16", teks: "#ffffff" },
};
const WARNA_TANPA = { dari: "#475569", ke: "#94a3b8", teks: "#ffffff" };
const warna = (level: number | null) => (level && WARNA_LEVEL[level]) || WARNA_TANPA;

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2;

export function BaganOrganisasi({
  simpul,
  bolehUbah,
}: {
  simpul: SimpulBagan[];
  bolehUbah: boolean;
}) {
  const [tampilan, setTampilan] = React.useState("level");
  const [cari, setCari] = React.useState("");
  const [levelAktif, setLevelAktif] = React.useState<number | null>(null);
  const [dipilih, setDipilih] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState(0.8);
  const [layarPenuh, setLayarPenuh] = React.useState(false);
  const [lokal, setLokal] = React.useState(simpul);
  const bingkai = React.useRef<HTMLDivElement>(null);
  const kanvas = React.useRef<HTMLDivElement>(null);

  // Menyelaraskan salinan lokal dengan props TANPA efek. Salinan lokal ada
  // supaya kartu yang digeser bergerak seketika, tanpa menunggu server; tapi
  // begitu server mengirim keadaan baru, salinan itu harus menyerah. Ditulis
  // sebagai penyesuaian saat render — bukan useEffect — karena useEffect
  // menjadwalkan render KEDUA, dan di antara keduanya layar sempat menampilkan
  // data lama yang sudah tidak berlaku.
  const [asal, setAsal] = React.useState(simpul);
  if (asal !== simpul) {
    setAsal(simpul);
    setLokal(simpul);
  }

  const tersaring = React.useMemo(
    () => lokal.filter((s) => cocok(s, cari) && (levelAktif === null || s.level === levelAktif)),
    [lokal, cari, levelAktif],
  );

  // Bagan selalu menggambar SELURUH simpul; pencarian hanya menyorot. Menyaring
  // pohon berarti memutus cabang di tengah, dan bagan dengan cabang terputus
  // menampilkan hubungan yang tidak ada.
  const tertata = React.useMemo(() => tataPohon(lokal), [lokal]);
  const garis = React.useMemo(() => garisBagan(tertata), [tertata]);
  const ukuran = React.useMemo(() => ukuranKanvas(tertata), [tertata]);
  const disorot = React.useMemo(
    () => new Set(tersaring.map((s) => s.id)),
    [tersaring],
  );

  const jumlahPerLevel = React.useMemo(() => {
    const m = new Map<number | null, number>();
    for (const s of lokal) m.set(s.level, (m.get(s.level) ?? 0) + 1);
    return m;
  }, [lokal]);

  const simpan = React.useCallback(
    async (input: Parameters<typeof simpanPenempatanAction>[0]) => {
      const res = await simpanPenempatanAction(input);
      if (res.error) {
        toast.error(res.error);
        setLokal(simpul); // kembalikan ke keadaan tersimpan
        return false;
      }
      return true;
    },
    [simpul],
  );

  /* ── geser kartu ── */
  const geser = React.useRef<{ id: string; mulaiX: number; mulaiY: number; asalX: number; asalY: number } | null>(null);

  const mulaiGeser = (e: React.PointerEvent, id: string, x: number, y: number) => {
    if (!bolehUbah || tampilan !== "bagan") return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    geser.current = { id, mulaiX: e.clientX, mulaiY: e.clientY, asalX: x, asalY: y };
  };

  const saatGeser = (e: React.PointerEvent) => {
    const g = geser.current;
    if (!g) return;
    // Dibagi zoom: satu piksel di layar bukan satu piksel di kanvas saat
    // diperbesar, dan tanpa pembagian ini kartunya melesat menjauh dari kursor.
    const x = g.asalX + (e.clientX - g.mulaiX) / zoom;
    const y = g.asalY + (e.clientY - g.mulaiY) / zoom;
    setLokal((prev) => prev.map((s) => (s.id === g.id ? { ...s, posX: x, posY: y } : s)));
  };

  const selesaiGeser = () => {
    const g = geser.current;
    geser.current = null;
    if (!g) return;
    const s = lokal.find((x) => x.id === g.id);
    if (!s) return;
    if (s.posX === g.asalX && s.posY === g.asalY) return; // cuma diklik
    void simpan({ id: g.id, posX: s.posX, posY: s.posY });
  };

  /* ── zoom & layar penuh ── */
  const muat = React.useCallback(() => {
    const el = bingkai.current;
    if (!el) return;
    const skala = Math.min(
      (el.clientWidth - 32) / ukuran.lebar,
      (el.clientHeight - 32) / ukuran.tinggi,
      ZOOM_MAX,
    );
    setZoom(Math.max(ZOOM_MIN, Number.isFinite(skala) && skala > 0 ? skala : 0.8));
  }, [ukuran]);

  React.useEffect(() => {
    const ganti = () => setLayarPenuh(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", ganti);
    return () => document.removeEventListener("fullscreenchange", ganti);
  }, []);

  const toggleLayarPenuh = () => {
    const el = bingkai.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  const terpilih = lokal.find((s) => s.id === dipilih) ?? null;

  return (
    <div className="space-y-3">
      {/* ── kendali ── */}
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedTabs
          className="max-w-xs"
          size="sm"
          value={tampilan}
          onChange={setTampilan}
          items={[
            { value: "level", label: "Per Level", icon: LayoutGrid },
            { value: "bagan", label: "Bagan", icon: Network },
          ]}
        />
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari departemen atau jabatan…"
            className="pl-9"
          />
        </div>
        {tampilan === "bagan" && (
          <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Perkecil"
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - 0.1) * 10) / 10))}
            >
              <Minus className="size-4" />
            </Button>
            <span className="min-w-[3.25rem] text-center text-xs font-medium tabular-nums text-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Perbesar"
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + 0.1) * 10) / 10))}
            >
              <Plus className="size-4" />
            </Button>
            <span className="mx-0.5 h-5 w-px bg-border" />
            <Button variant="ghost" size="icon" aria-label="Muat ke layar" onClick={muat}>
              <Expand className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Layar penuh" onClick={toggleLayarPenuh}>
              {layarPenuh ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
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
      </div>

      <LegendaLevel
        jumlah={jumlahPerLevel}
        aktif={levelAktif}
        onPilih={(l) => setLevelAktif((k) => (k === l ? null : l))}
      />

      {tampilan === "level" ? (
        <TampilanLevel
          simpul={tersaring}
          semua={lokal}
          dipilih={dipilih}
          onPilih={setDipilih}
          bolehUbah={bolehUbah}
        />
      ) : (
        <div
          ref={bingkai}
          className={cn(
            "relative overflow-auto rounded-2xl border border-border bg-muted/20 bg-[radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [background-size:20px_20px]",
            layarPenuh ? "h-screen" : "h-[32rem]",
          )}
          onPointerMove={saatGeser}
          onPointerUp={selesaiGeser}
          onPointerLeave={selesaiGeser}
        >
          <div
            ref={kanvas}
            className="relative origin-top-left"
            style={{ width: ukuran.lebar, height: ukuran.tinggi, transform: `scale(${zoom})` }}
          >
            <svg
              className="pointer-events-none absolute inset-0 overflow-visible"
              width={ukuran.lebar}
              height={ukuran.tinggi}
            >
              {garis.map((g) => (
                <path
                  key={`${g.dari}-${g.ke}`}
                  d={`M ${g.x1} ${g.y1} C ${g.x1} ${(g.y1 + g.y2) / 2}, ${g.x2} ${(g.y1 + g.y2) / 2}, ${g.x2} ${g.y2}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="text-border"
                />
              ))}
            </svg>
            {tertata.map((s) => (
              <div
                key={s.id}
                className="absolute"
                style={{ left: s.x, top: s.y, width: LEBAR_KARTU, height: TINGGI_KARTU }}
                onPointerDown={(e) => mulaiGeser(e, s.id, s.x, s.y)}
              >
                <KartuSimpul
                  simpul={s}
                  dipilih={dipilih === s.id}
                  redup={cari.trim() !== "" && !disorot.has(s.id)}
                  bisaDigeser={bolehUbah}
                  onKlik={() => setDipilih((k) => (k === s.id ? null : s.id))}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {terpilih && bolehUbah && (
        <PanelPenempatan
          simpul={terpilih}
          semua={lokal}
          onTutup={() => setDipilih(null)}
          onSimpan={async (patch) => {
            setLokal((prev) => prev.map((s) => (s.id === terpilih.id ? { ...s, ...patch } : s)));
            const ok = await simpan({ id: terpilih.id, ...patch });
            if (ok) toast.success("Penempatan tersimpan.");
          }}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────── legenda ─────────────────────────────── */

/**
 * Legenda level yang sekaligus SARINGAN.
 *
 * Legenda biasa hanya memberi tahu arti warna — sesuatu yang sudah jelas
 * setelah dilihat sekali, lalu memakan tempat selamanya. Yang ini juga
 * menyebut jumlah posisi tiap level dan bisa diklik untuk menyaring, jadi ia
 * tetap berguna setelah pemakainya hafal warnanya.
 */
function LegendaLevel({
  jumlah,
  aktif,
  onPilih,
}: {
  jumlah: Map<number | null, number>;
  aktif: number | null;
  onPilih: (level: number | null) => void;
}) {
  const level = Array.from({ length: LEVEL_MAX }, (_, i) => i + 1);
  const tanpa = jumlah.get(null) ?? 0;

  return (
    <div className="flex flex-wrap gap-2">
      {level.map((l) => {
        const w = warna(l);
        const on = aktif === l;
        const n = jumlah.get(l) ?? 0;
        return (
          <button
            key={l}
            type="button"
            onClick={() => onPilih(l)}
            aria-pressed={on}
            className={cn(
              "group flex items-center gap-2.5 rounded-xl border px-2.5 py-1.5 text-left transition",
              on
                ? "border-transparent shadow-sm ring-2 ring-offset-1 ring-offset-background"
                : "border-border bg-card hover:bg-muted/60",
            )}
            style={on ? ({ "--tw-ring-color": w.ke } as React.CSSProperties) : undefined}
          >
            <span
              className="grid size-7 shrink-0 place-items-center rounded-lg text-[13px] font-bold tabular-nums shadow-sm"
              style={{ backgroundImage: `linear-gradient(135deg, ${w.dari}, ${w.ke})`, color: w.teks }}
            >
              {l}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-medium leading-tight text-foreground">
                {NAMA_LEVEL[l]}
              </span>
              <span className="block text-[10px] leading-tight text-muted-foreground">{n} posisi</span>
            </span>
          </button>
        );
      })}
      {tanpa > 0 && (
        <span className="flex items-center gap-2 rounded-xl border border-dashed border-border px-2.5 py-1.5 text-[11px] text-muted-foreground">
          {tanpa} belum diberi level
        </span>
      )}
    </div>
  );
}

/* ──────────────────────────────── kartu ──────────────────────────────── */

function KartuSimpul({
  simpul,
  dipilih,
  redup,
  bisaDigeser,
  onKlik,
}: {
  simpul: SimpulBagan;
  dipilih: boolean;
  redup?: boolean;
  bisaDigeser?: boolean;
  onKlik: () => void;
}) {
  const w = warna(simpul.level);
  return (
    <button
      type="button"
      onClick={onKlik}
      className={cn(
        "group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition",
        "hover:-translate-y-0.5 hover:shadow-md",
        dipilih ? "border-transparent ring-2 ring-offset-2 ring-offset-background" : "border-border",
        redup && "opacity-30",
        bisaDigeser && "cursor-grab active:cursor-grabbing",
      )}
      style={dipilih ? ({ "--tw-ring-color": w.ke } as React.CSSProperties) : undefined}
    >
      {/* Pita warna level di tepi kiri — penanda kedalaman yang terbaca bahkan
          ketika kartunya diperkecil sampai tulisannya tidak terbaca lagi. */}
      <span
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundImage: `linear-gradient(180deg, ${w.dari}, ${w.ke})` }}
      />
      <span className="flex flex-1 flex-col gap-1 py-2.5 pl-4 pr-3">
        <span className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
            {simpul.nama}
          </span>
          <span
            className="grid size-5 shrink-0 place-items-center rounded-md text-[10px] font-bold tabular-nums"
            style={{ backgroundImage: `linear-gradient(135deg, ${w.dari}, ${w.ke})`, color: w.teks }}
          >
            {simpul.level ?? "–"}
          </span>
        </span>
        <span className="mt-auto flex items-center gap-2.5 text-[10.5px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="size-3" />
            {simpul.jumlahOrang} orang
          </span>
          {simpul.jabatan.length > 0 && <span>· {simpul.jabatan.length} jabatan</span>}
        </span>
      </span>
    </button>
  );
}

/* ───────────────────────────── tampilan level ───────────────────────────── */

function TampilanLevel({
  simpul,
  semua,
  dipilih,
  onPilih,
  bolehUbah,
}: {
  simpul: SimpulBagan[];
  semua: SimpulBagan[];
  dipilih: string | null;
  onPilih: (id: string | null) => void;
  bolehUbah: boolean;
}) {
  const baris = perLevel(simpul);
  if (baris.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-muted/20 py-16 text-center text-sm text-muted-foreground">
        Tidak ada posisi yang cocok dengan pencarian itu.
      </div>
    );
  }
  const indukNama = new Map(semua.map((s) => [s.id, s.nama]));

  return (
    <div className="space-y-4">
      {baris.map((b) => {
        const w = warna(b.level);
        return (
          <section key={String(b.level)}>
            <div className="mb-2 flex items-center gap-2.5">
              <span
                className="grid size-8 shrink-0 place-items-center rounded-xl text-sm font-bold tabular-nums shadow-sm"
                style={{ backgroundImage: `linear-gradient(135deg, ${w.dari}, ${w.ke})`, color: w.teks }}
              >
                {b.level ?? "–"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{b.nama}</p>
                <p className="text-[11px] text-muted-foreground">{b.simpul.length} posisi</p>
              </div>
              <span
                className="ml-1 h-px flex-1"
                style={{ backgroundImage: `linear-gradient(90deg, ${w.ke}, transparent)` }}
              />
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {b.simpul.map((s) => (
                <div key={s.id} className="h-[88px]">
                  <KartuSimpul
                    simpul={s}
                    dipilih={dipilih === s.id}
                    bisaDigeser={false}
                    onKlik={() => bolehUbah && onPilih(dipilih === s.id ? null : s.id)}
                  />
                  {s.parentId && (
                    <p className="mt-1 truncate pl-1 text-[10.5px] text-muted-foreground">
                      melapor ke {indukNama.get(s.parentId) ?? "—"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
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
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold shadow-sm"
            style={{ backgroundImage: `linear-gradient(135deg, ${w.dari}, ${w.ke})`, color: w.teks }}
          >
            {simpul.level ?? "–"}
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

      <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
        Di tampilan Bagan, kartunya juga bisa langsung digeser. Tombol putar-balik di kanan atas
        mengembalikan semua posisi ke tata letak otomatis.
      </p>
    </div>
  );
}
