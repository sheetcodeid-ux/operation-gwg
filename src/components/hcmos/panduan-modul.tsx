"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  CircleAlert,
  CircleDot,
  Eye,
  PencilLine,
  Share2,
  Clock3,
} from "lucide-react";
import {
  panduanUntuk,
  sambunganKeluar,
  sambunganMasuk,
  tujuanSambungan,
  type Panduan,
  type Sambungan,
} from "@/lib/hcmos/panduan";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { cn } from "@/lib/utils";

/**
 * Panduan satu halaman Human Capital, dibuka dari kepala halamannya.
 *
 * BENTUKNYA PANEL, BUKAN TEKS DI HALAMAN. Panduan yang ditempel permanen di
 * atas isinya akan dilewati begitu orang hafal — lalu memakan tinggi layar
 * selamanya bagi semua orang, termasuk yang tidak lagi membutuhkannya. Panel
 * ini hanya muncul ketika diminta, dan menampung penjelasan sepanjang yang
 * memang diperlukan tanpa mengurangi ruang kerja sedikit pun.
 *
 * Isinya dibaca dari `@/lib/hcmos/panduan` — halaman tidak menulis panduannya
 * sendiri. Yang di halaman cuma satu baris: id panduannya.
 */

const TAB = [
  { value: "cara", label: "Cara Pakai", icon: BookOpen },
  { value: "alur", label: "Alur Data", icon: Share2 },
];

export function PanduanModul({ panduan, className }: { panduan: string; className?: string }) {
  const [tab, setTab] = React.useState("cara");
  const p = panduanUntuk(panduan);

  // Id yang salah ketik tidak boleh menjatuhkan halamannya. Tesnya sudah
  // menjaga supaya ini tidak terjadi; ini jaring terakhir kalau lolos juga.
  if (!p) return null;

  return (
    <Sheet>
      <SheetTrigger>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground",
            className,
          )}
        >
          <BookOpen className="size-4" />
          <span className="hidden sm:inline">Panduan</span>
        </button>
      </SheetTrigger>

      <SheetContent className="max-w-xl sm:max-w-2xl" title={p.judul} description={p.untuk}>
        <div className="border-b border-border px-5 py-3">
          <SegmentedTabs items={TAB} value={tab} onChange={setTab} size="sm" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {tab === "cara" ? <TabCara p={p} /> : <TabAlur p={p} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─────────────────────────────── Cara Pakai ─────────────────────────────── */

function TabCara({ p }: { p: Panduan }) {
  const mengisi = p.jenis === "isi";
  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-2">
        <Keterangan icon={mengisi ? PencilLine : Eye} label={mengisi ? "Diisi oleh" : "Dibaca oleh"} isi={p.siapa} />
        <Keterangan icon={Clock3} label="Kapan" isi={p.kapan} />
      </div>

      <Bagian judul={mengisi ? "Langkah pengisian" : "Cara membacanya"}>
        <ol className="space-y-2.5">
          {p.langkah.map((l, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold text-foreground/70 ring-1 ring-border">
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed text-foreground/90">{l}</span>
            </li>
          ))}
        </ol>
      </Bagian>

      {p.isian.length > 0 && (
        <Bagian judul="Kolom demi kolom">
          <ul className="divide-y divide-border rounded-xl border border-border">
            {p.isian.map((i) => (
              <li key={i.nama} className="px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{i.nama}</span>
                  {i.wajib ? (
                    <Badge tone="danger">Wajib</Badge>
                  ) : (
                    <Badge tone="neutral">Opsional</Badge>
                  )}
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{i.cara}</p>
              </li>
            ))}
          </ul>
        </Bagian>
      )}

      {p.salah.length > 0 && (
        <Bagian judul="Yang sering keliru">
          <ul className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
            {p.salah.map((s, i) => (
              <li key={i} className="flex gap-2.5">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="text-[13px] leading-relaxed text-foreground/90">{s}</span>
              </li>
            ))}
          </ul>
        </Bagian>
      )}
    </div>
  );
}

function Keterangan({
  icon: Icon,
  label,
  isi,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isi: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-foreground/90">{isi}</p>
    </div>
  );
}

function Bagian({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{judul}</h3>
      {children}
    </section>
  );
}

/* ──────────────────────────────── Alur Data ─────────────────────────────── */

/**
 * Peta "masuk dari mana, keluar ke mana".
 *
 * Digambar sebagai tiga lajur — sumber, halaman ini, tujuan — karena itulah
 * pertanyaan yang sebenarnya dibawa orang ke sini: kalau angka di layar ini
 * salah, saya harus memperbaikinya di mana; dan kalau saya salah mengisi di
 * sini, siapa yang ikut salah. Kartunya bisa diklik: peta yang tidak bisa
 * ditelusuri cuma jadi gambar.
 */
function TabAlur({ p }: { p: Panduan }) {
  const masuk = sambunganMasuk(p);
  const keluar = sambunganKeluar(p);

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Halaman ini bukan berdiri sendiri. Yang di atas memberi datanya, yang di bawah memakainya — kalau salah
        satu tidak diisi, seluruh rantai ikut salah tanpa ada pesan galat.
      </p>

      <Lajur judul="Data masuk dari" kosong="Tidak menerima data dari modul lain — semuanya diisi langsung di sini.">
        {masuk.map((s) => (
          <KartuSambungan key={`${s.arah}-${s.ke}`} s={s} arah="masuk" />
        ))}
      </Lajur>

      <div className="relative rounded-xl border-2 border-foreground/15 bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <CircleDot className="size-4 shrink-0 text-foreground/60" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{p.judul}</p>
            <p className="text-[11px] text-muted-foreground">
              {p.jenis === "isi" ? "Halaman ini diisi" : "Halaman ini hanya dibaca"}
            </p>
          </div>
        </div>
      </div>

      <Lajur judul="Datanya dipakai oleh" kosong="Tidak ada modul lain yang membaca halaman ini.">
        {keluar.map((s) => (
          <KartuSambungan key={`${s.arah}-${s.ke}`} s={s} arah="keluar" />
        ))}
      </Lajur>
    </div>
  );
}

function Lajur({
  judul,
  kosong,
  children,
}: {
  judul: string;
  kosong: string;
  children: React.ReactNode[];
}) {
  const ada = React.Children.count(children) > 0;
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <ArrowDown className="size-3.5" /> {judul}
      </h3>
      {ada ? (
        <div className="space-y-2">{children}</div>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-3.5 py-3 text-[13px] text-muted-foreground">
          {kosong}
        </p>
      )}
    </section>
  );
}

function KartuSambungan({ s, arah }: { s: Sambungan; arah: "masuk" | "keluar" }) {
  const tujuan = tujuanSambungan(s);
  if (!tujuan) return null;
  return (
    <Link
      href={tujuan.href}
      className="group flex items-start gap-3 rounded-xl border border-border bg-background px-3.5 py-2.5 transition-colors hover:border-foreground/25 hover:bg-muted/40"
    >
      <span
        className={cn(
          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg ring-1 ring-border",
          arah === "masuk" ? "bg-sky-500/10 text-sky-600 dark:text-sky-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        )}
      >
        <ArrowRight className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{tujuan.judul}</span>
        <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted-foreground">{s.isi}</span>
      </span>
      <span className="mt-1 shrink-0 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
        Buka
      </span>
    </Link>
  );
}
