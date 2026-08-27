"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleAlert,
  ExternalLink,
  Maximize2,
  Minimize2,
  Plus,
  RotateCcw,
  Table2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PanduanModul } from "@/components/hcmos/panduan-modul";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  gantiNamaRaciAction,
  kembalikanRaciAction,
  kembalikanSelRaciAction,
  simpanSelRaciAction,
} from "@/lib/actions/raci";
import { RACI_LABEL } from "@/lib/hcmos/pillars";
import {
  KOSONG,
  RACI_ROLES,
  cocokBaris,
  gabungNama,
  hitungPeran,
  pecahNama,
  perOrang,
  periksaRaci,
  peranOrangDiBaris,
  semuaNama,
  type BarisRaci,
  type RaciRole,
} from "@/lib/hcmos/raci";
import { cn } from "@/lib/utils";

/**
 * Matriks RACI.
 *
 * Matriks 32 aktivitas kali empat peran punya masalah yang tidak dimiliki
 * matriks sepuluh baris: begitu semuanya tergambar, tidak ada satu pun yang
 * menonjol, dan pertanyaan yang paling sering dibawa orang ke sini justru tidak
 * terjawab olehnya. Karena itu isi berkas ini bukan hiasan melainkan tiga cara
 * MEMPERSEMPIT:
 *
 *  • Matriks     — bentuk aslinya, untuk membaca satu aktivitas.
 *  • Per Orang   — kebalikannya, untuk menjawab "saya pegang apa saja". Ini
 *                  pertanyaan yang paling sering diajukan dan yang paling
 *                  mahal dijawab lewat tabel: harus dibaca 32 baris satu per
 *                  satu, dan tetap mudah terlewat.
 *  • Pemeriksaan — RACI punya dua aturan yang bukan selera (tepat satu
 *                  Accountable, minimal satu Responsible). Menampilkan
 *                  pelanggarannya membuat matriks ini bisa DIPERIKSA, bukan
 *                  cuma dibaca.
 *
 * Isinya juga bisa disunting langsung di sini. Sebelumnya matriks tertulis
 * sebagai kode, jadi mengganti satu nama menuntut penempatan ulang aplikasi —
 * dan sepanjang belum ditempatkan ulang, yang dibaca orang menyebut nama yang
 * sudah tidak memegangnya.
 */

const TONE: Record<RaciRole, { pekat: string; muda: string; kelas: string; batas: string }> = {
  R: { pekat: "#059669", muda: "#34d399", kelas: "text-emerald-600 dark:text-emerald-400", batas: "border-emerald-500/30 bg-emerald-500/10" },
  A: { pekat: "#2563eb", muda: "#60a5fa", kelas: "text-blue-600 dark:text-blue-400", batas: "border-blue-500/30 bg-blue-500/10" },
  C: { pekat: "#d97706", muda: "#fbbf24", kelas: "text-amber-600 dark:text-amber-400", batas: "border-amber-500/30 bg-amber-500/10" },
  I: { pekat: "#64748b", muda: "#94a3b8", kelas: "text-slate-600 dark:text-slate-400", batas: "border-slate-500/30 bg-slate-500/10" },
};

/** Nama peran sesingkat mungkin — arti panjangnya ada di judul saat disentuh. */
const RINGKAS: Record<RaciRole, string> = {
  R: "Mengerjakan",
  A: "Bertanggung jawab",
  C: "Dimintai pendapat",
  I: "Diberi tahu",
};

type Tampilan = "matriks" | "orang" | "periksa";

export interface SelTerpilih {
  pilarSlug: string;
  subSlug: string;
  peran: RaciRole;
}

export function MatriksRaci({
  baris,
  bolehUbah,
  orangSistem,
}: {
  baris: BarisRaci[];
  bolehUbah: boolean;
  /** Nama karyawan aktif — usulan saat menambah pemegang peran. */
  orangSistem: string[];
}) {
  const [lokal, setLokal] = React.useState(baris);
  const [tampilan, setTampilan] = React.useState<Tampilan>("matriks");
  const [cari, setCari] = React.useState("");
  const [pilar, setPilar] = React.useState("all");
  const [sorotOrang, setSorotOrang] = React.useState("all");
  const [sorotPeran, setSorotPeran] = React.useState<RaciRole | null>(null);
  const [sel, setSel] = React.useState<SelTerpilih | null>(null);
  const [layarPenuh, setLayarPenuh] = React.useState(false);
  const bingkai = React.useRef<HTMLDivElement>(null);

  // Data dari server menang atas salinan layar — tapi hanya saat memang datang
  // yang baru. Membandingkan referensinya, bukan isinya: isi yang sama persis
  // pun akan menghapus suntingan yang barusan diketik kalau dibandingkan dalam.
  const [asal, setAsal] = React.useState(baris);
  if (asal !== baris) {
    setAsal(baris);
    setLokal(baris);
  }

  React.useEffect(() => {
    const ganti = () => setLayarPenuh(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", ganti);
    return () => document.removeEventListener("fullscreenchange", ganti);
  }, []);

  React.useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSel(null);
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, []);

  const pilarOptions = React.useMemo(() => {
    const urut: { value: string; label: string }[] = [{ value: "all", label: "Semua pilar" }];
    for (const b of lokal) if (!urut.some((o) => o.value === b.pilarSlug)) urut.push({ value: b.pilarSlug, label: b.pilarLabel });
    return urut;
  }, [lokal]);

  const daftarNama = React.useMemo(() => semuaNama(lokal), [lokal]);
  const orangOptions = React.useMemo(
    () => [{ value: "all", label: "Semua orang" }, ...daftarNama.map((n) => ({ value: n, label: n }))],
    [daftarNama],
  );

  /**
   * Saringan diterapkan berurutan, dan urutannya menentukan angka di layar:
   * pilar lebih dulu, lalu orang, baru pencarian. Dibalik, penghitung "n/total"
   * akan melaporkan jumlah yang tidak sesuai dengan apa yang tampak.
   */
  const tersaring = React.useMemo(() => {
    let hasil = lokal;
    if (pilar !== "all") hasil = hasil.filter((b) => b.pilarSlug === pilar);
    if (sorotOrang !== "all") hasil = hasil.filter((b) => peranOrangDiBaris(b, sorotOrang).length > 0);
    if (sorotPeran) hasil = hasil.filter((b) => pecahNama(b.raci[sorotPeran]).length > 0);
    return hasil.filter((b) => cocokBaris(b, cari));
  }, [lokal, pilar, sorotOrang, sorotPeran, cari]);

  const rekap = React.useMemo(() => hitungPeran(lokal), [lokal]);
  const temuan = React.useMemo(() => periksaRaci(lokal), [lokal]);
  const salah = temuan.filter((t) => t.berat === "salah").length;
  const disunting = React.useMemo(() => lokal.reduce((n, b) => n + b.disunting.length, 0), [lokal]);
  const menyaring = cari.trim() !== "" || pilar !== "all" || sorotOrang !== "all" || sorotPeran !== null;

  const barisSel = sel ? lokal.find((b) => b.pilarSlug === sel.pilarSlug && b.subSlug === sel.subSlug) ?? null : null;

  /** Menyimpan satu sel, lalu memperbarui salinan layar tanpa memuat ulang. */
  const simpan = React.useCallback(
    async (target: SelTerpilih, nama: string[]) => {
      const res = await simpanSelRaciAction({ ...target, nama });
      if (res.error) {
        toast.error(res.error);
        return false;
      }
      setLokal((prev) =>
        prev.map((b) =>
          b.pilarSlug === target.pilarSlug && b.subSlug === target.subSlug
            ? {
                ...b,
                raci: { ...b.raci, [target.peran]: gabungNama(nama) },
                disunting: [...new Set([...b.disunting, target.peran])],
              }
            : b,
        ),
      );
      return true;
    },
    [],
  );

  return (
    <div ref={bingkai} className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card">
      {/* ── batang alat ── */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-gradient-to-b from-muted/50 to-transparent px-3 py-2.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 text-white shadow-md shadow-teal-500/20">
          <Table2 className="size-5" />
        </span>
        <div className="mr-auto min-w-0">
          <p className="truncate text-[15px] font-semibold leading-tight tracking-tight text-foreground">Matriks RACI</p>
          <p className="truncate text-[11px] leading-tight text-muted-foreground">
            {lokal.length} aktivitas · {pilarOptions.length - 1} pilar · {daftarNama.length} orang terlibat
            {disunting > 0 && ` · ${disunting} sel disunting`}
          </p>
        </div>

        <div className="relative order-last w-full sm:order-none sm:w-56">
          <Input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari aktivitas atau nama…"
            className="h-9 pr-16"
          />
          {menyaring && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
              {tersaring.length}/{lokal.length}
            </span>
          )}
        </div>

        <Combobox
          value={pilar}
          onChange={setPilar}
          options={pilarOptions}
          className="w-full sm:w-44"
          searchPlaceholder="Cari pilar…"
        />
        <Combobox
          value={sorotOrang}
          onChange={setSorotOrang}
          options={orangOptions}
          className="w-full sm:w-44"
          searchPlaceholder="Cari nama…"
        />

        <div className="flex items-center gap-0.5 rounded-xl bg-muted p-0.5">
          <TombolTampilan aktif={tampilan === "matriks"} onClick={() => setTampilan("matriks")} ikon={Table2}>
            Matriks
          </TombolTampilan>
          <TombolTampilan aktif={tampilan === "orang"} onClick={() => setTampilan("orang")} ikon={Users}>
            Per orang
          </TombolTampilan>
          <TombolTampilan
            aktif={tampilan === "periksa"}
            onClick={() => setTampilan("periksa")}
            ikon={salah > 0 ? CircleAlert : Check}
            lencana={salah > 0 ? salah : undefined}
          >
            Pemeriksaan
          </TombolTampilan>
        </div>

        {menyaring && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 px-2"
            onClick={() => {
              setCari("");
              setPilar("all");
              setSorotOrang("all");
              setSorotPeran(null);
            }}
          >
            <X className="size-4" /> Bersihkan
          </Button>
        )}

        <PanduanModul panduan="raci" />

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
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto">
          {tampilan === "matriks" && (
            <TabelMatriks
              baris={tersaring}
              sorotOrang={sorotOrang === "all" ? null : sorotOrang}
              sorotPeran={sorotPeran}
              sel={sel}
              bolehUbah={bolehUbah}
              onPilihSel={setSel}
              onPilihOrang={(n) => setSorotOrang((s) => (s === n ? "all" : n))}
            />
          )}
          {tampilan === "orang" && (
            <DaftarPerOrang
              baris={tersaring}
              onPilihOrang={(n) => {
                setSorotOrang(n);
                setTampilan("matriks");
              }}
            />
          )}
          {tampilan === "periksa" && (
            <DaftarTemuan
              temuan={temuan}
              onBuka={(t) => {
                setPilar(t.pilarSlug);
                setCari(t.subLabel);
                setTampilan("matriks");
              }}
            />
          )}
        </div>

        {barisSel && sel && (
          <PanelSel
            baris={barisSel}
            peran={sel.peran}
            bolehUbah={bolehUbah}
            orangSistem={orangSistem}
            daftarNama={daftarNama}
            onTutup={() => setSel(null)}
            onSimpan={(nama) => simpan(sel, nama)}
            onKembalikan={async () => {
              const res = await kembalikanSelRaciAction(sel);
              if (res.error) {
                toast.error(res.error);
                return;
              }
              toast.success("Sel dikembalikan ke matriks Juknis.");
              setSel(null);
              // Nilai bawaannya ada di server, bukan di layar — sengaja tidak
              // ditebak di sini. Menebaknya berarti dua tempat memutuskan apa
              // isi bawaan satu sel, dan cepat atau lambat keduanya berbeda.
              window.location.reload();
            }}
          />
        )}
      </div>

      <LegendaPeran
        rekap={rekap}
        sorot={sorotPeran}
        onSorot={(p) => setSorotPeran((s) => (s === p ? null : p))}
        bolehUbah={bolehUbah}
        disunting={disunting}
        daftarNama={daftarNama}
        orangSistem={orangSistem}
      />
    </div>
  );
}

/* ─────────────────────────────── batang alat ─────────────────────────────── */

function TombolTampilan({
  aktif,
  onClick,
  ikon: Ikon,
  lencana,
  children,
}: {
  aktif: boolean;
  onClick: () => void;
  ikon: React.ElementType;
  lencana?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
        aktif ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Ikon className="size-4" />
      <span className="hidden sm:inline">{children}</span>
      {lencana !== undefined && (
        <span className="grid size-4 shrink-0 place-items-center rounded-full bg-red-500 text-[9px] font-bold text-white">
          {lencana}
        </span>
      )}
    </button>
  );
}

/* ──────────────────────────────── matriks ──────────────────────────────── */

function ChipNama({
  nama,
  peran,
  sorot,
  onClick,
}: {
  nama: string;
  peran: RaciRole;
  sorot: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={`Lihat semua yang dipegang ${nama}`}
      className={cn(
        "max-w-full truncate rounded-md border px-1.5 py-0.5 text-[11px] leading-tight transition-colors",
        sorot
          ? "border-foreground/40 bg-foreground text-background font-semibold"
          : cn(TONE[peran].batas, TONE[peran].kelas, "hover:border-foreground/30"),
      )}
    >
      {nama}
    </button>
  );
}

function TabelMatriks({
  baris,
  sorotOrang,
  sorotPeran,
  sel,
  bolehUbah,
  onPilihSel,
  onPilihOrang,
}: {
  baris: BarisRaci[];
  sorotOrang: string | null;
  sorotPeran: RaciRole | null;
  sel: SelTerpilih | null;
  bolehUbah: boolean;
  onPilihSel: (s: SelTerpilih) => void;
  onPilihOrang: (n: string) => void;
}) {
  if (baris.length === 0) {
    return (
      <p className="p-10 text-center text-sm text-muted-foreground">
        Tidak ada aktivitas yang cocok dengan saringan yang sedang aktif.
      </p>
    );
  }

  return (
    <table className="w-full min-w-[56rem] border-separate border-spacing-0 text-sm">
      <thead>
        {/* Kepala tabel menempel di atas: matriks ini lebih panjang dari satu
            layar, dan tanpa kepala yang menempel, kolom R/A/C/I tidak lagi
            terbaca begitu digulir — persis saat mulai dibutuhkan. */}
        <tr>
          <th className="sticky left-0 top-0 z-30 w-[22rem] border-b border-r border-border bg-muted px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">
            Aktivitas
          </th>
          {RACI_ROLES.map((p) => (
            <th
              key={p}
              className="sticky top-0 z-20 border-b border-border bg-muted px-3 py-2.5 text-left text-xs font-medium text-muted-foreground"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="grid size-5 shrink-0 place-items-center rounded-md text-[10px] font-bold text-white"
                  style={{ backgroundImage: `linear-gradient(135deg, ${TONE[p].pekat}, ${TONE[p].muda})` }}
                >
                  {p}
                </span>
                <span className="hidden lg:inline">{RINGKAS[p]}</span>
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {baris.map((b, i) => {
          const awalPilar = i === 0 || baris[i - 1].pilarSlug !== b.pilarSlug;
          return (
            <React.Fragment key={`${b.pilarSlug}-${b.subSlug}`}>
              {awalPilar && (
                <tr>
                  {/* Nama pilar sebagai baris tersendiri, bukan kolom yang
                      diulang tiap baris. Kolom yang diulang memakan lebar
                      permanen untuk keterangan yang hanya berubah sembilan
                      kali sepanjang matriks. */}
                  <th
                    colSpan={RACI_ROLES.length + 1}
                    className="sticky left-0 z-10 border-b border-t border-border bg-muted/60 px-3 py-1.5 text-left"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                      {b.pilarLabel}
                    </span>
                    <span className="ml-2 text-[11px] font-normal text-muted-foreground">PIC {b.pilarPic}</span>
                  </th>
                </tr>
              )}
              <tr className="group">
                <td className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-2 align-top group-hover:bg-muted/40">
                  <span className="flex items-start gap-1.5">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-foreground">{b.subLabel}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{b.fungsi}</span>
                    </span>
                    {b.href && (
                      <Link
                        href={b.href}
                        className="mt-0.5 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                        aria-label={`Buka ${b.subLabel}`}
                      >
                        <ExternalLink className="size-3.5" />
                      </Link>
                    )}
                  </span>
                </td>
                {RACI_ROLES.map((p) => {
                  const nama = pecahNama(b.raci[p]);
                  const terpilih = sel?.pilarSlug === b.pilarSlug && sel?.subSlug === b.subSlug && sel?.peran === p;
                  const redup = sorotPeran !== null && sorotPeran !== p;
                  return (
                    <td
                      key={p}
                      onClick={bolehUbah ? () => onPilihSel({ pilarSlug: b.pilarSlug, subSlug: b.subSlug, peran: p }) : undefined}
                      className={cn(
                        "border-b border-border px-3 py-2 align-top group-hover:bg-muted/40",
                        bolehUbah && "cursor-pointer",
                        terpilih && "bg-brand-500/10 ring-1 ring-inset ring-brand-500/40",
                        redup && "opacity-35",
                      )}
                    >
                      <span className="flex flex-wrap items-center gap-1">
                        {nama.length === 0 ? (
                          <span className="text-[11px] text-muted-foreground/50">{KOSONG}</span>
                        ) : (
                          nama.map((n) => (
                            <ChipNama key={n} nama={n} peran={p} sorot={sorotOrang === n} onClick={() => onPilihOrang(n)} />
                          ))
                        )}
                        {b.disunting.includes(p) && (
                          <span
                            title="Berbeda dari matriks Juknis"
                            className="size-1.5 shrink-0 rounded-full bg-brand-500"
                          />
                        )}
                      </span>
                    </td>
                  );
                })}
              </tr>
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

/* ─────────────────────────────── per orang ─────────────────────────────── */

/**
 * Matriks dibalik: satu kartu per orang, berisi seluruh yang ia pegang.
 *
 * Urutannya menurut beban, bukan abjad — yang menanggung sepuluh aktivitas
 * lebih perlu terlihat lebih dulu daripada yang namanya kebetulan berawalan A.
 */
function DaftarPerOrang({ baris, onPilihOrang }: { baris: BarisRaci[]; onPilihOrang: (n: string) => void }) {
  const orang = React.useMemo(() => perOrang(baris), [baris]);

  if (orang.length === 0) {
    return <p className="p-10 text-center text-sm text-muted-foreground">Tidak ada orang pada saringan yang aktif.</p>;
  }

  return (
    <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
      {orang.map((o) => (
        <div key={o.nama} className="rounded-2xl border border-border bg-card p-3">
          <div className="mb-2 flex items-start gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 text-[12px] font-bold text-white">
              {o.nama
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase() ?? "")
                .join("")}
            </span>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onPilihOrang(o.nama)}
                className="block truncate text-left text-[13px] font-semibold text-foreground hover:underline"
              >
                {o.nama}
              </button>
              <p className="text-[11px] text-muted-foreground">{o.total} penugasan</p>
            </div>
          </div>

          <div className="mb-2 flex flex-wrap gap-1">
            {RACI_ROLES.filter((p) => o.jumlah[p] > 0).map((p) => (
              <span
                key={p}
                className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]", TONE[p].batas, TONE[p].kelas)}
                title={RACI_LABEL[p]}
              >
                <b>{p}</b> {o.jumlah[p]}
              </span>
            ))}
          </div>

          <ul className="space-y-1">
            {o.tugas
              .slice()
              .sort((a, b) => RACI_ROLES.indexOf(a.peran) - RACI_ROLES.indexOf(b.peran))
              .map((t, i) => (
                <li key={`${t.baris.subSlug}-${t.peran}-${i}`} className="flex items-start gap-1.5">
                  <span
                    className={cn(
                      "mt-0.5 grid size-4 shrink-0 place-items-center rounded text-[9px] font-bold",
                      TONE[t.peran].batas,
                      TONE[t.peran].kelas,
                    )}
                  >
                    {t.peran}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] text-foreground">{t.baris.subLabel}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{t.baris.pilarLabel}</span>
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────── pemeriksaan ────────────────────────────── */

function DaftarTemuan({
  temuan,
  onBuka,
}: {
  temuan: ReturnType<typeof periksaRaci>;
  onBuka: (t: ReturnType<typeof periksaRaci>[number]) => void;
}) {
  if (temuan.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 p-12 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Check className="size-6" />
        </span>
        <p className="text-sm font-medium text-foreground">Matriksnya lolos seluruh aturan RACI.</p>
        <p className="max-w-md text-xs text-muted-foreground">
          Setiap aktivitas punya tepat satu penanggung jawab akhir (A) dan sedikitnya satu pelaksana (R).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3">
      <p className="text-xs text-muted-foreground">
        {temuan.filter((t) => t.berat === "salah").length} perlu diperbaiki ·{" "}
        {temuan.filter((t) => t.berat === "perhatian").length} perlu diperhatikan
      </p>
      {temuan.map((t, i) => (
        <button
          key={`${t.subSlug}-${i}`}
          type="button"
          onClick={() => onBuka(t)}
          className={cn(
            "flex w-full items-start gap-2.5 rounded-xl border p-3 text-left transition-colors hover:border-foreground/25",
            t.berat === "salah" ? "border-red-500/30 bg-red-500/[0.06]" : "border-amber-500/30 bg-amber-500/[0.06]",
          )}
        >
          <span
            className={cn(
              "mt-0.5 shrink-0",
              t.berat === "salah" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400",
            )}
          >
            {t.berat === "salah" ? <CircleAlert className="size-4" /> : <AlertTriangle className="size-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium text-foreground">{t.subLabel}</span>
            <span className="block text-[11px] text-muted-foreground">{t.pilarLabel}</span>
            <span className="mt-1 block text-[12px] text-foreground/85">{t.pesan}</span>
          </span>
          <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────── panel penyuntingan ─────────────────────────── */

/**
 * Menyunting satu sel.
 *
 * Panel, bukan sembulan di atas selnya: satu sel bisa memuat beberapa nama,
 * dan menambah nama menuntut daftar pilihan yang lebih tinggi daripada barisnya
 * sendiri. Sembulan setinggi itu akan menutupi justru bagian matriks yang
 * sedang jadi rujukan orang saat mengisinya.
 */
function PanelSel({
  baris,
  peran,
  bolehUbah,
  orangSistem,
  daftarNama,
  onTutup,
  onSimpan,
  onKembalikan,
}: {
  baris: BarisRaci;
  peran: RaciRole;
  bolehUbah: boolean;
  orangSistem: string[];
  daftarNama: string[];
  onTutup: () => void;
  onSimpan: (nama: string[]) => Promise<boolean>;
  onKembalikan: () => void | Promise<void>;
}) {
  const awal = React.useMemo(() => pecahNama(baris.raci[peran]), [baris, peran]);
  const [nama, setNama] = React.useState<string[]>(awal);
  const [tambah, setTambah] = React.useState("");
  const [ketik, setKetik] = React.useState("");
  const [sibuk, setSibuk] = React.useState(false);

  // Berpindah sel mengganti isi panel. Tanpa ini, panel tetap memperlihatkan
  // nama sel sebelumnya dan menyimpannya ke sel yang salah.
  const [kunci, setKunci] = React.useState(`${baris.subSlug}::${peran}`);
  const kunciBaru = `${baris.subSlug}::${peran}`;
  if (kunci !== kunciBaru) {
    setKunci(kunciBaru);
    setNama(awal);
    setTambah("");
    setKetik("");
  }

  const usulan = React.useMemo(() => {
    const gabung = [...new Set([...daftarNama, ...orangSistem])].filter((n) => !nama.includes(n));
    return [{ value: "", label: "Pilih nama…" }, ...gabung.sort((a, b) => a.localeCompare(b, "id")).map((n) => ({ value: n, label: n }))];
  }, [daftarNama, orangSistem, nama]);

  const berubah = gabungNama(nama) !== gabungNama(awal);

  return (
    <aside className="flex w-full max-w-full shrink-0 flex-col border-l border-border bg-card sm:w-80">
      <div className="flex items-start gap-2 border-b border-border px-3 py-2.5">
        <span
          className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white"
          style={{ backgroundImage: `linear-gradient(135deg, ${TONE[peran].pekat}, ${TONE[peran].muda})` }}
        >
          {peran}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">{baris.subLabel}</p>
          <p className="truncate text-[11px] text-muted-foreground">{RACI_LABEL[peran]}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Tutup" onClick={onTutup}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Pemegang peran</p>
          {nama.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-2.5 py-2 text-[11px] text-muted-foreground">
              Belum ada — sel ini akan tercatat sebagai {KOSONG}.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {nama.map((n) => (
                <span
                  key={n}
                  className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]", TONE[peran].batas, TONE[peran].kelas)}
                >
                  {n}
                  {bolehUbah && (
                    <button
                      type="button"
                      aria-label={`Hapus ${n}`}
                      onClick={() => setNama((p) => p.filter((x) => x !== n))}
                      className="opacity-60 hover:opacity-100"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {bolehUbah && (
          <>
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Tambah dari yang sudah ada</p>
              <Combobox
                value={tambah}
                onChange={(v) => {
                  if (v) setNama((p) => [...new Set([...p, v])]);
                  setTambah("");
                }}
                options={usulan}
                matchTriggerWidth
                searchPlaceholder="Cari nama…"
                placeholder="Pilih nama…"
              />
            </div>

            <div>
              {/* Sebagian pemegang peran memang bukan akun — "Seluruh Karyawan",
                  "Karyawan Bersangkutan", "Outlet Manager". Memaksa semuanya
                  dipilih dari daftar karyawan akan membuang justru bagian yang
                  paling sering dibaca di matriks ini. */}
              <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Atau tulis sendiri</p>
              <div className="flex gap-1.5">
                <Input
                  value={ketik}
                  onChange={(e) => setKetik(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && ketik.trim()) {
                      e.preventDefault();
                      setNama((p) => [...new Set([...p, ketik.trim()])]);
                      setKetik("");
                    }
                  }}
                  placeholder="mis. Outlet Manager"
                  className="h-9"
                />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Tambah"
                  disabled={!ketik.trim()}
                  onClick={() => {
                    setNama((p) => [...new Set([...p, ketik.trim()])]);
                    setKetik("");
                  }}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {baris.disunting.includes(peran) && (
          <p className="rounded-lg border border-brand-500/30 bg-brand-500/[0.07] px-2.5 py-2 text-[11px] text-muted-foreground">
            Sel ini berbeda dari matriks Juknis.
          </p>
        )}
      </div>

      {bolehUbah && (
        <div className="flex shrink-0 items-center gap-1.5 border-t border-border p-3">
          {baris.disunting.includes(peran) && (
            <Button variant="ghost" size="sm" className="gap-1.5 px-2" onClick={() => void onKembalikan()} disabled={sibuk}>
              <RotateCcw className="size-4" /> Bawaan
            </Button>
          )}
          <Button
            className="ml-auto"
            size="sm"
            disabled={sibuk || !berubah}
            onClick={async () => {
              setSibuk(true);
              const ok = await onSimpan(nama);
              setSibuk(false);
              if (ok) {
                toast.success("Tersimpan.");
                onTutup();
              }
            }}
          >
            <Check className="size-4" /> Simpan
          </Button>
        </div>
      )}
    </aside>
  );
}

/* ─────────────────────────────── legenda ─────────────────────────────── */

/**
 * Legenda yang juga menyebut ISINYA dan bisa dipakai menyaring.
 *
 * Legenda biasa hanya menerangkan arti huruf — jelas setelah dilihat sekali,
 * lalu memakan tempat selamanya. Yang ini menyebut berapa penugasan per peran
 * beserta porsinya, dan menekannya menyaring matriks ke peran itu saja. Jadi ia
 * tetap terpakai setelah R/A/C/I hafal.
 */
function LegendaPeran({
  rekap,
  sorot,
  onSorot,
  bolehUbah,
  disunting,
  daftarNama,
  orangSistem,
}: {
  rekap: Record<RaciRole, number>;
  sorot: RaciRole | null;
  onSorot: (p: RaciRole) => void;
  bolehUbah: boolean;
  disunting: number;
  daftarNama: string[];
  orangSistem: string[];
}) {
  const puncak = Math.max(1, ...RACI_ROLES.map((p) => rekap[p]));

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-gradient-to-t from-muted/40 to-transparent px-3 py-2">
      <span
        className={cn(
          "shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold",
          bolehUbah ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground",
        )}
      >
        {bolehUbah ? "Bisa disunting" : "Mode hanya lihat"}
      </span>

      <div className="scroll-fade-x flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {RACI_ROLES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onSorot(p)}
            title={`${RACI_LABEL[p]} — ${rekap[p]} penugasan. Klik untuk menyaring.`}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg border px-1.5 py-1 transition-colors",
              sorot === p ? "border-foreground/40 bg-muted" : "border-border bg-card hover:border-foreground/25",
            )}
          >
            <span
              className="grid size-5 shrink-0 place-items-center rounded-md text-[9px] font-bold text-white"
              style={{ backgroundImage: `linear-gradient(135deg, ${TONE[p].pekat}, ${TONE[p].muda})` }}
            >
              {p}
            </span>
            <span className="hidden text-[10px] font-medium leading-none text-foreground md:block">{RINGKAS[p]}</span>
            <span className="hidden h-1 w-8 overflow-hidden rounded-full bg-muted lg:block">
              <span
                className="block h-full rounded-full"
                style={{ width: `${(rekap[p] / puncak) * 100}%`, background: TONE[p].pekat }}
              />
            </span>
            <span className="text-[10px] font-semibold tabular-nums leading-none text-muted-foreground">{rekap[p]}</span>
          </button>
        ))}
      </div>

      {bolehUbah && (
        <GantiNama daftarNama={daftarNama} orangSistem={orangSistem} disunting={disunting} />
      )}
    </div>
  );
}

/**
 * Mengganti satu nama di SELURUH matriks sekaligus.
 *
 * Ada karena inilah perubahan yang paling sering terjadi dan paling melelahkan
 * dikerjakan sel per sel: seseorang berpindah atau keluar, dan namanya muncul
 * di belasan aktivitas yang tersebar di beberapa pilar. Sel per sel hampir
 * selalu menyisakan satu yang terlewat — dan sel itu tetap menyebut nama yang
 * sudah tidak memegangnya.
 */
function GantiNama({
  daftarNama,
  orangSistem,
  disunting,
}: {
  daftarNama: string[];
  orangSistem: string[];
  disunting: number;
}) {
  const [buka, setBuka] = React.useState(false);
  const [lama, setLama] = React.useState("");
  const [baru, setBaru] = React.useState("");
  const [sibuk, setSibuk] = React.useState(false);

  if (!buka) {
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        {disunting > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 px-2 text-[11px]"
            onClick={async () => {
              const res = await kembalikanRaciAction({});
              if (res.error) return toast.error(res.error);
              toast.success(`${res.dikembalikan ?? 0} sel dikembalikan ke matriks Juknis.`);
              window.location.reload();
            }}
          >
            <RotateCcw className="size-3.5" /> Kembalikan semua
          </Button>
        )}
        <Button variant="outline" size="sm" className="gap-1.5 px-2 text-[11px]" onClick={() => setBuka(true)}>
          <UserRound className="size-3.5" /> Ganti nama
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full shrink-0 flex-wrap items-center gap-1.5 sm:w-auto">
      <Combobox
        value={lama}
        onChange={setLama}
        options={[{ value: "", label: "Nama lama…" }, ...daftarNama.map((n) => ({ value: n, label: n }))]}
        className="w-full sm:w-40"
        searchPlaceholder="Cari nama…"
      />
      <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
      <Combobox
        value={baru}
        onChange={setBaru}
        options={[
          { value: "", label: "(hapus namanya)" },
          ...[...new Set([...daftarNama, ...orangSistem])]
            .sort((a, b) => a.localeCompare(b, "id"))
            .map((n) => ({ value: n, label: n })),
        ]}
        className="w-full sm:w-40"
        searchPlaceholder="Cari nama…"
      />
      <Button
        size="sm"
        disabled={sibuk || !lama}
        onClick={async () => {
          setSibuk(true);
          const res = await gantiNamaRaciAction({ lama, baru });
          setSibuk(false);
          if (res.error) return toast.error(res.error);
          toast.success(
            res.terganti
              ? `${lama} diganti di ${res.terganti} sel.`
              : `${lama} tidak ditemukan di sel mana pun.`,
          );
          if (res.terganti) window.location.reload();
          else setBuka(false);
        }}
      >
        <Check className="size-4" /> Ganti
      </Button>
      <Button variant="ghost" size="icon" aria-label="Batal" onClick={() => setBuka(false)}>
        <X className="size-4" />
      </Button>
    </div>
  );
}
