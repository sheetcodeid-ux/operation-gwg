"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import type { BarisWork, DaftarWork } from "@/lib/data/work-daftar";
import type { PilihanWork } from "@/lib/data/work-pilihan";

/**
 * WORK — DAFTAR KERJA, BUKAN DASBOR.
 *
 * ┌─ TIDAK ADA SEVERITY DI LAYAR INI, DAN ITU KEPUTUSAN ─────────────────────┐
 * │                                                                          │
 * │ Severity milik SIGNAL. Work tidak punya severity, tidak diurutkan        │
 * │ dengannya, dan tidak diberi warna yang menyiratkan ia punya (OD-03 = A). │
 * │ Menaruh "Critical" di baris Work membuat orang membaca Work sebagai      │
 * │ vonis, padahal yang punya derajat keparahan indikasinya — bukan          │
 * │ pekerjaannya.                                                            │
 * │                                                                          │
 * │ Severity tetap terbaca di DETAIL, pada daftar Signal-nya, sebagai        │
 * │ atribut Signal.                                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ URUTANNYA SUDAH BENAR SEBELUM SAMPAI DI SINI ───────────────────────────┐
 * │                                                                          │
 * │ Pembaca mengurutkan `tenggat` menaik lalu `id` — dan pada daftar yang    │
 * │ isinya hanya Work berjalan, itu sudah menempatkan yang terlambat di      │
 * │ atas dengan sendirinya (OD-02). Komponen ini TIDAK mengurutkan ulang:    │
 * │ urutan yang ditulis dua kali adalah urutan yang cepat atau lambat        │
 * │ berbeda di salah satu salinannya.                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

const LABEL_STATUS: Record<string, string> = {
  open: "Terbuka",
  in_progress: "Dikerjakan",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

const LABEL_KATEGORI: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
};

const PILIHAN_STATUS = [
  { value: "", label: "Masih berjalan" },
  { value: "open", label: "Terbuka" },
  { value: "in_progress", label: "Dikerjakan" },
  { value: "completed", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
  { value: "open,in_progress,completed,cancelled", label: "Semua status" },
];

function waktuWib(iso: string): string {
  // Kalender bisnisnya WIB — sama dengan seluruh Operational V.1.
  return new Date(iso).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Keadaan({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        status === "open" && "bg-slate-100 text-slate-700",
        status === "in_progress" && "bg-blue-100 text-blue-700",
        status === "completed" && "bg-emerald-100 text-emerald-700",
        status === "cancelled" && "bg-zinc-200 text-zinc-600",
      )}
    >
      {LABEL_STATUS[status] ?? status}
    </span>
  );
}

function Baris({ w }: { w: BarisWork }) {
  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/40">
      <td className="px-3 py-2">
        <Link href={`/operational/work/${w.id}`} className="font-medium underline-offset-2 hover:underline">
          {w.judul}
        </Link>
        <div className="text-xs text-muted-foreground">
          #{w.id} · {w.jumlahSignalAktif} signal aktif · {w.jumlahPelaksanaAktif} pelaksana aktif
        </div>
      </td>
      <td className="px-3 py-2">
        <Keadaan status={w.status} />
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {waktuWib(w.tenggat)}
        <div className="text-xs text-muted-foreground">{LABEL_KATEGORI[w.tenggatKategori] ?? w.tenggatKategori}</div>
      </td>
      <td className="px-3 py-2">
        {w.overdue ? (
          <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            Lewat tenggat
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2">{w.ownerNama}</td>
      <td className="px-3 py-2">{w.primaryDepartment}</td>
    </tr>
  );
}

export function PapanWorkUI({
  papan,
  bolehBuat = false,
  pilihan,
}: {
  papan: DaftarWork;
  /** Hasil gerbang di halaman — bukan keputusan baru, dan bukan keamanan. */
  bolehBuat?: boolean;
  pilihan?: PilihanWork;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const statusKini = sp.get("status") ?? "";
  const overdueKini = sp.get("overdue") === "1";
  const ownerKini = sp.get("owner") ?? "";
  const departemenKini = sp.get("departemen") ?? "";
  const pelaksanaKini = sp.get("pelaksana") ?? "";

  // Pilihan saringan dibuka dari daftar yang sama dengan form — satu sumber,
  // bukan dua daftar orang yang bisa berbeda diam-diam.
  const opsiOwner = React.useMemo(
    () => [{ value: "", label: "Semua owner" }, ...(pilihan?.owner ?? [])],
    [pilihan],
  );
  const opsiDepartemen = React.useMemo(
    () => [{ value: "", label: "Semua departemen" }, ...(pilihan?.departemen ?? [])],
    [pilihan],
  );
  const opsiPelaksana = React.useMemo(
    () => [{ value: "", label: "Semua pelaksana" }, ...(pilihan?.pelaksana ?? [])],
    [pilihan],
  );

  function pergi(ubah: Record<string, string | null>) {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(ubah)) {
      if (v === null || v === "") q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString();
    router.push(s ? `/operational/work?${s}` : "/operational/work");
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Combobox
          options={PILIHAN_STATUS}
          value={statusKini}
          onChange={(v) => pergi({ status: v })}
          className="w-56"
        />
        <button
          type="button"
          onClick={() => pergi({ overdue: overdueKini ? null : "1" })}
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm",
            overdueKini ? "border-red-300 bg-red-50 text-red-700" : "bg-background",
          )}
        >
          Hanya yang lewat tenggat
        </button>
        {opsiOwner.length > 1 && (
          <Combobox options={opsiOwner} value={ownerKini} onChange={(v) => pergi({ owner: v })} searchable className="w-56" />
        )}
        {opsiDepartemen.length > 1 && (
          <Combobox
            options={opsiDepartemen}
            value={departemenKini}
            onChange={(v) => pergi({ departemen: v })}
            searchable
            className="w-56"
          />
        )}
        {opsiPelaksana.length > 1 && (
          <Combobox
            options={opsiPelaksana}
            value={pelaksanaKini}
            onChange={(v) => pergi({ pelaksana: v })}
            searchable
            className="w-56"
          />
        )}
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {papan.total} Work · {papan.overdue} lewat tenggat
          </span>
          {bolehBuat && (
            <Button size="sm" onClick={() => router.push("/operational/work?buat=1")}>
              Buat Work
            </Button>
          )}
        </div>
      </div>

      {papan.baris.length === 0 ? (
        <div className="rounded-lg border p-6 text-sm text-muted-foreground">
          {/*
            Kalimatnya sengaja TIDAK berbunyi "tidak ada Work". Orang yang
            membaca ini mungkin cuma tidak berhak melihatnya — dan pernyataan
            global yang salah lebih buruk daripada tidak menyatakan apa pun.
          */}
          Belum ada Work {papan.seluruhnya ? "yang cocok dengan saringan ini" : "yang ditugaskan kepada Anda"}. Ini bukan
          pernyataan bahwa tidak ada pekerjaan berjalan di perusahaan — yang ditampilkan hanya yang boleh Anda lihat.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[840px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Judul</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Tenggat</th>
                <th className="px-3 py-2 font-medium">Keterlambatan</th>
                <th className="px-3 py-2 font-medium">Owner</th>
                <th className="px-3 py-2 font-medium">Departemen</th>
              </tr>
            </thead>
            <tbody>
              {papan.baris.map((w) => (
                <Baris key={w.id} w={w} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
