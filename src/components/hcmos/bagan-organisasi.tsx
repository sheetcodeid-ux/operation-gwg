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
  MousePointerSquareDashed,
  Network,
  Plus,
  Sparkles,
  UnfoldVertical,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { rapikanBaganAction, simpanPenempatanAction, tempatkanOrangAction } from "@/lib/actions/bagan";
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
  magnet,
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
 * Satu bentuk bagan saja, dan itu disengaja: kolom per divisi, keturunan
 * menumpuk lurus ke bawah di dalam kolomnya. Sempat ada bentuk kedua
 * (indentasi), lalu dibuang — dua bentuk untuk satu data berarti dua tempat
 * bagi orang untuk menyusun, dan susunan yang dibuat di satu bentuk tidak
 * terbaca di bentuk lain.
 *
 * Bagan enam puluh kotak punya masalah yang tidak dimiliki bagan sepuluh
 * kotak: begitu semuanya tergambar, tidak ada satu pun yang menonjol. Karena
 * itu yang ada di sini bukan hiasan melainkan cara MEMPERSEMPIT — sorot
 * silsilah, jejak, lipat cabang, peta kecil, dan seleksi jamak.
 */

const WARNA: Record<number, { pekat: string; muda: string; lembut: string }> = {
  1: { pekat: "#7c3aed", muda: "#a78bfa", lembut: "#f5f3ff" },
  2: { pekat: "#2563eb", muda: "#60a5fa", lembut: "#eff6ff" },
  3: { pekat: "#0891b2", muda: "#22d3ee", lembut: "#ecfeff" },
  4: { pekat: "#059669", muda: "#34d399", lembut: "#ecfdf5" },
  5: { pekat: "#d97706", muda: "#fbbf24", lembut: "#fffbeb" },
  6: { pekat: "#e11d48", muda: "#fb7185", lembut: "#fff1f2" },
};
const NETRAL = { pekat: "#64748b", muda: "#94a3b8", lembut: "#f8fafc" };
const warna = (level: number | null) => (level && WARNA[level]) || NETRAL;

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 2;

export interface OrangBagan {
  id: string;
  nama: string;
  jabatan: string;
  departemen: string;
}

export function BaganOrganisasi({
  simpul,
  semuaOrang,
  bolehUbah,
}: {
  simpul: SimpulBagan[];
  semuaOrang: OrangBagan[];
  bolehUbah: boolean;
}) {
  const [tampilan, setTampilan] = React.useState<"level" | "bagan">("bagan");
  const [cari, setCari] = React.useState("");
  const [pilihan, setPilihan] = React.useState<Set<string>>(new Set());
  const [terlipat, setTerlipat] = React.useState<Set<string>>(new Set());
  const [zoom, setZoom] = React.useState(0.55);
  const [layarPenuh, setLayarPenuh] = React.useState(false);
  const [lokal, setLokal] = React.useState(simpul);
  const [daftarOrang, setDaftarOrang] = React.useState<{ simpul: SimpulBagan; jenis: "orang" | "bawahan" } | null>(null);
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
  const utama = pilihan.size === 1 ? [...pilihan][0] : null;

  const disorot = React.useMemo(() => {
    if (utama) return silsilah(lokal, utama);
    if (pilihan.size > 1) return pilihan;
    if (mencari) return cocokIds;
    return null;
  }, [utama, pilihan, mencari, cocokIds, lokal]);

  const jejak = React.useMemo(() => (utama ? rantaiKeAtas(lokal, utama).reverse() : []), [utama, lokal]);

  /**
   * Bawa kanvas ke sebuah kartu.
   *
   * Pencarian yang hanya menyorot tidak menyelesaikan apa pun pada bagan
   * selebar ini: kartunya menyala di tempat yang tidak terlihat, dan orangnya
   * tetap harus menggeser mencari-cari. Menemukan berarti MEMBAWA ke sana.
   */
  const bawaKe = React.useCallback(
    (id: string, zoomPakai?: number) => {
      const el = gulir.current;
      const t = tertata.find((x) => x.id === id);
      if (!el || !t) return;
      const z = zoomPakai ?? zoom;
      el.scrollTo({
        left: (t.x + 32 + LEBAR_KOLOM / 2) * z - el.clientWidth / 2,
        top: (t.y + 32 + TINGGI_KOLOM / 2) * z - el.clientHeight / 2,
        behavior: "smooth",
      });
    },
    [tertata, zoom],
  );

  // Begitu pencarian menyisakan SATU kecocokan, kanvasnya langsung ke sana.
  // Menunggu sampai satu itulah kuncinya: melompat pada setiap ketikan membuat
  // kanvasnya berlompatan liar sementara orangnya masih mengetik.
  const cocokTunggal = cocokIds.size === 1 ? [...cocokIds][0] : null;

  /**
   * Ketemu → dekatkan; lepas → kembali seperti semula.
   *
   * Zoom sebelum memfokus disimpan supaya bisa dipulihkan persis. Tanpa itu,
   * pencarian meninggalkan bagannya dalam keadaan berbeda dari sebelum dicari,
   * dan orang harus menata pandangannya lagi setiap selesai mencari satu role.
   *
   * Ref, bukan state: keduanya tidak memengaruhi apa yang digambar, dan
   * menaruhnya di state memaksa render tambahan tiap kali pencarian menyempit.
   */
  const ZOOM_FOKUS = 1;
  const terakhirDibawa = React.useRef<string | null>(null);
  const zoomSebelumFokus = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (tampilan !== "bagan") return;
    if (!cocokTunggal) {
      terakhirDibawa.current = null;
      if (zoomSebelumFokus.current !== null) {
        setZoom(zoomSebelumFokus.current);
        zoomSebelumFokus.current = null;
      }
      return;
    }
    if (cocokTunggal === terakhirDibawa.current) return;
    if (zoomSebelumFokus.current === null) zoomSebelumFokus.current = zoom;
    terakhirDibawa.current = cocokTunggal;
    setZoom(ZOOM_FOKUS);
    // Digulir SETELAH zoomnya terpasang — posisi tengah dihitung dari zoom,
    // jadi menggulir lebih dulu berarti mendarat di tempat yang salah.
    requestAnimationFrame(() => bawaKe(cocokTunggal, ZOOM_FOKUS));
    // `zoom` sengaja tidak jadi kebergantungan: ia hanya dibaca sebagai nilai
    // awal, dan menyertakannya akan memicu ulang efek ini oleh perubahan yang
    // dibuat efek ini sendiri.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tampilan, cocokTunggal, bawaKe]);
  const bercabang = React.useMemo(() => simpulBercabang(lokal), [lokal]);
  const semuaTerlipat = terlipat.size >= bercabang.length && bercabang.length > 0;
  const terpilih = utama ? (lokal.find((s) => s.id === utama) ?? null) : null;

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

  /* ── geser (satu kartu maupun beberapa sekaligus) ── */
  const geser = React.useRef<{
    dx: number;
    dy: number;
    asal: Map<string, { x: number; y: number }>;
    utama: string;
  } | null>(null);
  const sapu = React.useRef<{ x: number; y: number; kiri: number; atas: number } | null>(null);
  const [pandu, setPandu] = React.useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  const saatGerak = (e: React.PointerEvent) => {
    const g = geser.current;
    if (g) {
      const u = g.asal.get(g.utama)!;
      const kasarX = u.x + (e.clientX - g.dx) / zoom;
      const kasarY = u.y + (e.clientY - g.dy) / zoom;
      // Magnet dihitung dari kartu UTAMA saja, lalu selisihnya diteruskan ke
      // kartu lain yang ikut terpilih. Kalau tiap kartu bermagnet sendiri-
      // sendiri, kelompoknya berantakan justru saat digeser bersama.
      const h = magnet(
        kasarX,
        kasarY,
        tertata.filter((t) => !g.asal.has(t.id)).map((t) => ({ x: t.x, y: t.y })),
      );
      setPandu({ x: h.panduX, y: h.panduY });
      const geserX = h.x - u.x;
      const geserY = h.y - u.y;
      setLokal((prev) =>
        prev.map((s) => {
          const a = g.asal.get(s.id);
          return a ? { ...s, posX: a.x + geserX, posY: a.y + geserY } : s;
        }),
      );
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
    setPandu({ x: null, y: null });
    if (!g) return;
    const berubah = lokal.filter((s) => {
      const a = g.asal.get(s.id);
      return a && (s.posX !== a.x || s.posY !== a.y);
    });
    for (const s of berubah) void simpan({ id: s.id, posX: s.posX, posY: s.posY });
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

  React.useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPilihan(new Set());
        setDaftarOrang(null);
      }
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, []);

  const pilih = (id: string, tambah: boolean) =>
    setPilihan((prev) => {
      if (!tambah) return prev.size === 1 && prev.has(id) ? new Set() : new Set([id]);
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div
      ref={bingkai}
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card"
    >
      {/* ── batang alat ── */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-gradient-to-b from-muted/50 to-transparent px-3 py-2.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-500/20">
          <Network className="size-5" />
        </span>
        <div className="mr-auto min-w-0">
          <p className="truncate text-[15px] font-semibold leading-tight tracking-tight text-foreground">
            Struktur Organisasi
          </p>
          {jejak.length > 0 ? (
            <p className="flex min-w-0 items-center gap-1 truncate text-[11px] leading-tight text-muted-foreground">
              {jejak.map((j) => (
                <React.Fragment key={j.id}>
                  <button
                    type="button"
                    onClick={() => {
                      pilih(j.id, false);
                      bawaKe(j.id);
                    }}
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
              {pilihan.size > 1 ? `${pilihan.size} kartu terpilih` : `${lokal.length} role · ${hubungan} hubungan pelaporan`}
            </p>
          )}
        </div>

        <div className="relative order-last w-full sm:order-none sm:w-52">
          <Input
            value={cari}
            onChange={(e) => {
              setCari(e.target.value);
              setPilihan(new Set());
            }}
            placeholder="Cari role…"
            className="h-9 pr-14"
          />
          {mencari && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
              {cocokIds.size}/{lokal.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 rounded-xl bg-muted p-0.5">
          <TombolTampilan aktif={tampilan === "level"} onClick={() => setTampilan("level")} ikon={Layers}>
            Per level
          </TombolTampilan>
          <TombolTampilan aktif={tampilan === "bagan"} onClick={() => setTampilan("bagan")} ikon={Network}>
            Bagan
          </TombolTampilan>
        </div>

        {tampilan === "bagan" && (
          <div className="flex items-center gap-0.5 rounded-xl border border-border bg-background p-0.5 shadow-sm">
            {bolehUbah && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 px-2"
                onClick={async () => {
                  const res = await rapikanBaganAction();
                  if (res.error) toast.error(res.error);
                  else {
                    setLokal((prev) => prev.map((s) => ({ ...s, posX: null, posY: null })));
                    setTerlipat(new Set());
                    toast.success("Bagan dirapikan mengikuti level dan urutannya.");
                  }
                }}
              >
                <Sparkles className="size-4" /> Rapikan
              </Button>
            )}
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
        <div className="min-h-0 flex-1 overflow-auto bg-muted/20 p-4">
          <TampilanLevel
            simpul={mencari ? lokal.filter((s) => cocokIds.has(s.id)) : lokal}
            semua={lokal}
            namaInduk={namaInduk}
            pilihan={pilihan}
            disorot={utama ? disorot : null}
            onPilih={pilih}
            onLihatOrang={(s, jenis) => setDaftarOrang({ simpul: s, jenis })}
          />
        </div>
      ) : (
        <div className="relative min-h-0 flex-1">
          <div
            ref={gulir}
            className="absolute inset-0 overflow-auto bg-muted/20 bg-[radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [background-size:24px_24px]"
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).dataset.kanvas === "1") {
                if (!e.shiftKey) setPilihan(new Set());
                sapu.current = { x: e.clientX, y: e.clientY, kiri: e.currentTarget.scrollLeft, atas: e.currentTarget.scrollTop };
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
              className="relative origin-top-left transition-transform duration-300 ease-out"
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
                    // Siku tajam, bukan lengkung: bagan organisasi dibaca
                    // sebagai jalur, dan sudut membulat membuat dua jalur yang
                    // berdekatan tampak menyatu di tikungannya.
                    //
                    // "tulang" turun lurus di satu sumbu lalu mencabang mendatar
                    // ke kartunya; "tier" turun ke garis tengah antar-baris,
                    // melintang, lalu turun lagi.
                    const d =
                      g.bentuk === "tulang"
                        ? `M ${g.x1} ${g.y1} V ${g.y2} H ${g.x2}`
                        : `M ${g.x1} ${g.y1} V ${(g.y1 + g.y2) / 2} H ${g.x2} V ${g.y2}`;
                    const nyala = !disorot || (disorot.has(g.dari) && disorot.has(g.ke));
                    return (
                      <path
                        key={`${g.dari}-${g.ke}`}
                        d={d}
                        fill="none"
                        strokeWidth={nyala && disorot ? 2.5 : 1.25}
                        strokeLinecap="round"
                        stroke={nyala && disorot ? warna(lokal.find((s) => s.id === g.ke)?.level ?? null).pekat : "currentColor"}
                        className={cn("text-border transition-opacity", !nyala && "opacity-15")}
                      />
                    );
                  })}
                </g>
              </svg>

              {tertata.map((s) => (
                <div
                  key={s.id}
                  className="absolute"
                  style={{ left: s.x + 32, top: s.y + 32, width: LEBAR_KOLOM, height: TINGGI_KOLOM }}
                  onPointerDown={(e) => {
                    if (!bolehUbah) return;
                    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                    // Menggeser kartu yang termasuk seleksi akan menggeser
                    // SELURUH seleksi; menggeser kartu di luar seleksi memulai
                    // geseran tunggal, seperti yang orang harapkan.
                    const ikut = pilihan.has(s.id) ? [...pilihan] : [s.id];
                    geser.current = {
                      dx: e.clientX,
                      dy: e.clientY,
                      utama: s.id,
                      asal: new Map(
                        tertata.filter((t) => ikut.includes(t.id)).map((t) => [t.id, { x: t.x, y: t.y }]),
                      ),
                    };
                  }}
                >
                  <KartuRole
                    simpul={s}
                    namaInduk={namaInduk}
                    padat
                    dipilih={pilihan.has(s.id)}
                    redup={!!disorot && !disorot.has(s.id)}
                    bawahan={jumlahKeturunan(lokal, s.id)}
                    anakLangsung={lokal.filter((x) => x.parentId === s.id).length}
                    terlipat={terlipat.has(s.id)}
                    onLipat={() =>
                      setTerlipat((prev) => {
                        const n = new Set(prev);
                        if (n.has(s.id)) n.delete(s.id);
                        else n.add(s.id);
                        return n;
                      })
                    }
                    onKlik={(e) => pilih(s.id, e.shiftKey || e.metaKey || e.ctrlKey)}
                    onLihatOrang={(jenis) => setDaftarOrang({ simpul: s, jenis })}
                  />
                </div>
              ))}

              {/* Garis bantu magnet — hanya selama menempel. Garis bantu yang
                  menetap berubah jadi kisi permanen yang menambah kebisingan. */}
              {pandu.x !== null && (
                <span className="pointer-events-none absolute top-0 w-px bg-sky-500" style={{ left: pandu.x + 32, height: ukuran.tinggi + 64 }} />
              )}
              {pandu.y !== null && (
                <span className="pointer-events-none absolute left-0 h-px bg-sky-500" style={{ top: pandu.y + 32, width: ukuran.lebar + 64 }} />
              )}
            </div>
          </div>

          <PetaKecil tertata={tertata} ukuran={ukuran} disorot={disorot} gulir={gulir} zoom={zoom} />
        </div>
      )}

      <LegendaLevel simpul={lokal} bolehUbah={bolehUbah} banyakDipilih={pilihan.size} />

      {terpilih && bolehUbah && (
        <PanelPenempatan
          simpul={terpilih}
          semua={lokal}
          semuaOrang={semuaOrang}
          onTutup={() => setPilihan(new Set())}
          onSimpan={async (patch) => {
            setLokal((prev) => prev.map((s) => (s.id === terpilih.id ? { ...s, ...patch } : s)));
            if (await simpan({ id: terpilih.id, ...patch })) toast.success("Penempatan tersimpan.");
          }}
        />
      )}

      {daftarOrang && <DaftarOrang isi={daftarOrang} semua={lokal} onTutup={() => setDaftarOrang(null)} />}
    </div>
  );
}

/* ─────────────────────────────── legenda ─────────────────────────────── */

/**
 * Legenda level yang juga menyebut ISINYA.
 *
 * Legenda biasa hanya menerangkan arti warna — sesuatu yang jelas setelah
 * dilihat sekali, lalu memakan tempat selamanya. Yang ini menyebut jumlah role
 * dan jumlah orang tiap level, jadi ia tetap terpakai setelah warnanya hafal:
 * baris ini sekaligus jawaban atas "organisasi ini gemuk di lapis mana".
 */
function LegendaLevel({
  simpul,
  bolehUbah,
  banyakDipilih,
}: {
  simpul: SimpulBagan[];
  bolehUbah: boolean;
  banyakDipilih: number;
}) {
  const rekap = React.useMemo(() => {
    const m = new Map<number, { role: number; orang: number }>();
    for (const s of simpul) {
      if (!s.level) continue;
      const p = m.get(s.level) ?? { role: 0, orang: 0 };
      m.set(s.level, { role: p.role + 1, orang: p.orang + s.jumlahOrang });
    }
    return m;
  }, [simpul]);
  const puncak = Math.max(1, ...[...rekap.values()].map((v) => v.role));

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-gradient-to-t from-muted/40 to-transparent px-3 py-2">
      <span
        className={cn(
          "shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold",
          bolehUbah ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground",
        )}
      >
        {bolehUbah ? "Bisa disusun" : "Mode hanya lihat"}
      </span>

      {/* Satu baris yang digulir menyamping bila tidak muat — melipat ke
          baris kedua memakan tinggi kanvas, dan kanvas itulah isi halamannya. */}
      <div className="scroll-fade-x flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {Array.from({ length: LEVEL_MAX }, (_, i) => i + 1).map((l) => {
          const w = warna(l);
          const r = rekap.get(l) ?? { role: 0, orang: 0 };
          return (
            <span
              key={l}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-1.5 py-1"
              title={`Level ${l} — ${NAMA_LEVEL[l]}: ${r.role} role, ${r.orang} orang`}
            >
              <span
                className="grid size-5 shrink-0 place-items-center rounded-md text-[9px] font-bold text-white"
                style={{ backgroundImage: `linear-gradient(135deg, ${w.pekat}, ${w.muda})` }}
              >
                {l}
              </span>
              <span className="hidden text-[10px] font-medium leading-none text-foreground md:block">{NAMA_LEVEL[l]}</span>
              {/* Batang tipis sepanjang porsi role level ini — sebaran lapisan
                  terbaca sekilas tanpa perlu membandingkan angka satu per satu. */}
              <span className="hidden h-1 w-8 overflow-hidden rounded-full bg-muted lg:block">
                <span className="block h-full rounded-full" style={{ width: `${(r.role / puncak) * 100}%`, background: w.pekat }} />
              </span>
              <span className="text-[10px] font-semibold tabular-nums leading-none text-muted-foreground">{r.role}</span>
            </span>
          );
        })}
      </div>

      <span className="hidden shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground xl:flex">
        <MousePointerSquareDashed className="size-3.5" />
        {banyakDipilih > 1
          ? `${banyakDipilih} kartu terpilih — seret salah satunya untuk memindahkan semua`
          : "Shift+klik untuk memilih beberapa · Ctrl+scroll zoom"}
      </span>
    </div>
  );
}

/* ─────────────────────────────── peta kecil ─────────────────────────────── */

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
  const LEBAR = 176;
  const skala = LEBAR / Math.max(ukuran.lebar, 1);
  const tinggi = Math.min(ukuran.tinggi * skala, 128);

  return (
    <div
      className="pointer-events-auto absolute bottom-3 right-3 hidden overflow-hidden rounded-xl border border-border bg-card/85 shadow-lg backdrop-blur-sm sm:block"
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
            opacity: !disorot || disorot.has(s.id) ? 0.85 : 0.12,
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
  onLihatOrang,
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
  onKlik: (e: React.MouseEvent) => void;
  onLihatOrang: (jenis: "orang" | "bawahan") => void;
}) {
  const w = warna(simpul.level);
  const induk = simpul.parentId ? namaInduk.get(simpul.parentId) : null;
  const pil = padat ? "px-1 py-px text-[7.5px]" : "px-2 py-0.5 text-[10px]";

  return (
    <div className="relative h-full w-full">
      <div
        role="button"
        tabIndex={0}
        onClick={onKlik}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onKlik(e as unknown as React.MouseEvent)}
        className={cn(
          "group relative flex h-full w-full cursor-pointer overflow-hidden rounded-xl border bg-card text-left transition-all duration-150",
          dipilih
            ? "border-transparent shadow-xl ring-2 ring-offset-2 ring-offset-background"
            : "border-border shadow-sm hover:-translate-y-0.5 hover:shadow-lg",
          redup && "opacity-20 saturate-0",
        )}
        style={
          dipilih
            ? ({ "--tw-ring-color": w.pekat, backgroundImage: `linear-gradient(180deg, ${w.lembut}, transparent 65%)` } as React.CSSProperties)
            : undefined
        }
      >
        {/* Penanda level.
            Pita lurus setinggi kartu terbaca sebagai garis pemisah — mata
            menganggapnya bagian dari kisi, bukan bagian dari kartunya. Diganti
            TONGKAT membulat yang mengambang di dalam kartu, ditemani semburat
            warna tipis yang memudar ke kanan: keduanya jelas milik kartu itu,
            dan tetap terbaca saat bagannya diperkecil sampai tulisannya hilang. */}
        <span
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: `linear-gradient(90deg, ${w.lembut}, transparent 42%)` }}
        />
        <span
          className={cn("absolute left-[5px] w-[3px] rounded-full", padat ? "inset-y-1.5" : "inset-y-3")}
          style={{ backgroundImage: `linear-gradient(180deg, ${w.pekat}, ${w.muda})`, boxShadow: `0 0 8px ${w.muda}55` }}
        />

        <div className={cn("flex min-w-0 flex-1 flex-col", padat ? "relative gap-0.5 py-1.5 pl-3.5 pr-2" : "relative gap-1.5 py-3 pl-4.5 pr-3")}>
          <div className="flex min-w-0 items-start gap-2">
            <span
              className={cn("grid shrink-0 place-items-center rounded-lg font-bold text-white shadow-sm", padat ? "size-6 text-[9px]" : "size-10 text-xs")}
              style={{ backgroundImage: `linear-gradient(135deg, ${w.pekat}, ${w.muda})` }}
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
            <span className={cn("rounded-md font-bold", pil)} style={{ background: w.lembut, color: w.pekat }}>
              Level {simpul.level ?? "–"}
            </span>
            {/* Angka orang dan bawahan bisa DIKLIK — pertanyaan yang menyusul
                angka itu selalu "siapa saja", dan sebelumnya jawabannya ada di
                layar lain. */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onLihatOrang("orang");
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={cn("flex items-center gap-0.5 rounded-md bg-muted font-medium text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground", pil)}
            >
              <Users className={padat ? "size-2" : "size-3"} /> {simpul.jumlahOrang}
            </button>
            {bawahan > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLihatOrang("bawahan");
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className={cn("rounded-md bg-muted font-medium text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground", pil)}
              >
                {bawahan} bawahan
              </button>
            )}
          </div>
        </div>
      </div>

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
            "absolute left-1/2 z-10 flex -translate-x-1/2 translate-y-[-45%] items-center gap-0.5 rounded-full border bg-card px-1.5 py-px text-[8px] font-bold shadow-sm transition hover:scale-110",
            terlipat ? "border-current" : "border-border text-muted-foreground",
          )}
          style={{ top: "100%", color: terlipat ? w.pekat : undefined }}
        >
          {terlipat ? `+${bawahan}` : <ChevronRight className="size-2.5 rotate-90" />}
        </button>
      )}
    </div>
  );
}

/* ───────────────────────────── daftar orang ───────────────────────────── */

/** Siapa saja yang ada di balik angka — muncul saat angkanya diklik. */
function DaftarOrang({
  isi,
  semua,
  onTutup,
}: {
  isi: { simpul: SimpulBagan; jenis: "orang" | "bawahan" };
  semua: SimpulBagan[];
  onTutup: () => void;
}) {
  const { simpul, jenis } = isi;
  const w = warna(simpul.level);
  const orang = simpul.orang ?? [];
  const bawahan = React.useMemo(() => {
    const anak = new Map<string, SimpulBagan[]>();
    for (const s of semua) {
      if (!s.parentId) continue;
      anak.set(s.parentId, [...(anak.get(s.parentId) ?? []), s]);
    }
    const hasil: { simpul: SimpulBagan; kedalaman: number }[] = [];
    const dilihat = new Set<string>();
    const turun = (id: string, d: number) => {
      for (const a of anak.get(id) ?? []) {
        if (dilihat.has(a.id)) continue;
        dilihat.add(a.id);
        hasil.push({ simpul: a, kedalaman: d });
        turun(a.id, d + 1);
      }
    };
    turun(simpul.id, 0);
    return hasil;
  }, [semua, simpul.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onTutup}>
      <div
        className="flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-border p-4">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-xl text-xs font-bold text-white shadow-sm"
            style={{ backgroundImage: `linear-gradient(135deg, ${w.pekat}, ${w.muda})` }}
          >
            {inisialDari(simpul.nama)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{simpul.nama}</p>
            <p className="text-[11px] text-muted-foreground">
              {jenis === "orang" ? `${orang.length} orang di role ini` : `${bawahan.length} role di bawahnya`}
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Tutup" onClick={onTutup}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-2">
          {jenis === "orang" ? (
            orang.length === 0 ? (
              <p className="px-2 py-8 text-center text-[13px] text-muted-foreground">
                Belum ada karyawan aktif dengan departemen ini di User Management.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {orang.map((o, i) => (
                  <li key={`${o.nama}-${i}`} className="flex items-center gap-3 px-2 py-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                      {inisialDari(o.nama)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-foreground">{o.nama}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{o.jabatan}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <ul className="divide-y divide-border">
              {bawahan.map(({ simpul: b, kedalaman }) => {
                const bw = warna(b.level);
                return (
                  <li key={b.id} className="flex items-center gap-2.5 px-2 py-2" style={{ paddingLeft: 8 + kedalaman * 14 }}>
                    <span
                      className="grid size-6 shrink-0 place-items-center rounded-md text-[8px] font-bold text-white"
                      style={{ backgroundImage: `linear-gradient(135deg, ${bw.pekat}, ${bw.muda})` }}
                    >
                      {inisialDari(b.nama)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-foreground">{b.nama}</span>
                      <span className="block truncate text-[10.5px] text-muted-foreground">
                        Level {b.level ?? "–"} · {b.jumlahOrang} orang
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── tampilan level ───────────────────────────── */

function TampilanLevel({
  simpul,
  semua,
  namaInduk,
  pilihan,
  disorot,
  onPilih,
  onLihatOrang,
}: {
  simpul: SimpulBagan[];
  semua: SimpulBagan[];
  namaInduk: Map<string, string>;
  pilihan: Set<string>;
  disorot: Set<string> | null;
  onPilih: (id: string, tambah: boolean) => void;
  onLihatOrang: (s: SimpulBagan, jenis: "orang" | "bawahan") => void;
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
        const orang = b.simpul.reduce((a, s) => a + s.jumlahOrang, 0);
        return (
          <div key={String(b.level)} className="flex gap-4">
            <div className="sticky top-0 w-20 shrink-0 self-start pt-1">
              <span
                className="inline-block rounded-lg px-2 py-1 text-xs font-bold text-white shadow-sm"
                style={{ backgroundImage: `linear-gradient(135deg, ${w.pekat}, ${w.muda})` }}
              >
                Level {b.level ?? "–"}
              </span>
              <p className="mt-1 text-[11px] font-semibold text-foreground">{b.simpul.length} role</p>
              <p className="text-[10px] leading-tight text-muted-foreground">{orang} orang</p>
              <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                {b.level ? NAMA_LEVEL[b.level] : "belum ditempatkan"}
              </p>
            </div>
            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {b.simpul.map((s) => (
                <div key={s.id} className="min-h-[9.5rem]">
                  <KartuRole
                    simpul={s}
                    namaInduk={namaInduk}
                    dipilih={pilihan.has(s.id)}
                    redup={!!disorot && !disorot.has(s.id)}
                    bawahan={semua.filter((x) => x.parentId === s.id).length}
                    onKlik={(e) => onPilih(s.id, e.shiftKey || e.metaKey || e.ctrlKey)}
                    onLihatOrang={(jenis) => onLihatOrang(s, jenis)}
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
  semuaOrang,
  onTutup,
  onSimpan,
}: {
  simpul: SimpulBagan;
  semua: SimpulBagan[];
  semuaOrang: OrangBagan[];
  onTutup: () => void;
  onSimpan: (patch: { level?: number | null; parentId?: string | null }) => void;
}) {
  const w = warna(simpul.level);
  // Hanya tawarkan atasan yang TIDAK membuat lingkaran. Menawarkan pilihan yang
  // pasti ditolak lalu memarahi pemakainya adalah cara paling membingungkan
  // untuk menegakkan aturan.
  const calon = semua
    .filter((s) => bolehJadiAtasan(semua, simpul.id, s.id))
    .sort((a, b) => (a.level ?? 9) - (b.level ?? 9) || a.nama.localeCompare(b.nama, "id"));

  return (
    <div className="shrink-0 border-t border-border bg-muted/40 p-3">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-xl text-xs font-bold text-white shadow-sm"
            style={{ backgroundImage: `linear-gradient(135deg, ${w.pekat}, ${w.muda})` }}
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

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Level</span>
          <Combobox
            value={simpul.level ? String(simpul.level) : ""}
            onChange={(v) => onSimpan({ level: v ? Number(v) : null })}
            placeholder="Belum diberi level"
            matchTriggerWidth
            options={[
              { value: "", label: "Belum diberi level" },
              ...Array.from({ length: LEVEL_MAX }, (_, i) => i + 1).map((l) => ({
                value: String(l),
                label: `Level ${l} — ${NAMA_LEVEL[l]}`,
              })),
            ]}
          />
        </div>
        <div className="sm:col-span-1">
          <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Melapor ke</span>
          <Combobox
            value={simpul.parentId ?? ""}
            onChange={(v) => onSimpan({ parentId: v || null })}
            placeholder="Tidak ada (puncak bagan)"
            searchable
            searchPlaceholder="Cari role…"
            matchTriggerWidth
            options={[
              { value: "", label: "— Tidak ada (puncak bagan)" },
              ...calon.map((s) => ({ value: s.id, label: `${s.level ? `L${s.level} · ` : ""}${s.nama}` })),
            ]}
          />
        </div>
        <div className="sm:col-span-1">
          <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Tambah anggota</span>
          <Combobox
            value=""
            onChange={async (uid) => {
              if (!uid) return;
              const res = await tempatkanOrangAction({ userId: uid, departemen: simpul.nama });
              if (res.error) toast.error(res.error);
              else toast.success(`${semuaOrang.find((o) => o.id === uid)?.nama ?? "Karyawan"} ditempatkan di ${simpul.nama}.`);
            }}
            placeholder="Pilih karyawan…"
            searchable
            searchPlaceholder="Cari nama karyawan…"
            matchTriggerWidth
            options={semuaOrang
              .filter((o) => o.departemen !== simpul.nama)
              .map((o) => ({
                value: o.id,
                // Departemen sekarangnya ikut ditulis: memindahkan orang dari
                // satu role ke role lain tidak boleh terjadi tanpa yang
                // memindahkan tahu ia sedang mengambilnya dari mana.
                label: `${o.nama}${o.departemen ? ` — kini di ${o.departemen}` : " — belum ada role"}`,
              }))}
          />
        </div>
      </div>

      {(simpul.orang?.length ?? 0) > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Anggota:</span>
          {(simpul.orang ?? []).map((o, i) => (
            <span key={`${o.nama}-${i}`} className="flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[11px] ring-1 ring-border">
              <span className="grid size-4 place-items-center rounded-full bg-muted text-[7px] font-bold text-muted-foreground">
                {inisialDari(o.nama)}
              </span>
              {o.nama}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
