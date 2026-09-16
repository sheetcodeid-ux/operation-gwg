"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Loader2, Pencil, RotateCcw, Search, Store, UserCheck, UserX, X } from "lucide-react";
import { toast } from "sonner";
import { simpanOutletAction } from "@/lib/actions/outlet-manajemen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field, Input } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat";

/**
 * MANAJEMEN OUTLET — bentuknya sengaja sama dengan User Management.
 *
 * Kepala halaman, empat kotak angka, bilah saringan, lalu tabel dengan tombol
 * aksi di ujung kanan: susunan yang sama persis. Admin yang sudah terbiasa
 * mengelola pengguna tidak perlu belajar apa pun untuk mengelola outlet, dan
 * dua halaman administrasi yang bentuknya berbeda membuat yang kedua selalu
 * terasa seperti bagian yang belum selesai.
 *
 * YANG DIATUR DI SINI CUMA PENUGASANNYA: pemilik, coordinator area, dan PIC
 * Finance/Marketing yang memegang wilayahnya. Nama,
 * kode, cabang ESB, dan tanggal buka datang dari sinkronisasi ESB, dan
 * membiarkannya diubah tangan di sini berarti perubahan itu tertimpa diam-diam
 * pada sinkronisasi berikutnya.
 */

export interface BarisOutlet {
  id: string;
  nama: string;
  kode: string;
  brand: string;
  kota: string;
  aktif: boolean;
  owner: string | null;
  /** Coordinator area yang memegangnya sekarang. */
  coordinatorId: string | null;
  coordinatorNama: string | null;
  /** Orang Finance yang memegang wilayah ini. */
  financeId: string | null;
  financeNama: string | null;
  /** Orang Marketing yang memegang wilayah ini. */
  marketingId: string | null;
  marketingNama: string | null;
  /** Sudah dipasangkan ke cabang ESB — penentu apakah angkanya bisa ditarik. */
  punyaCabang: boolean;
}

export interface PilihanCoordinator {
  value: string;
  label: string;
  outlet: number;
}

export function OutletManager({
  outlets,
  coordinators,
  financePic,
  marketingPic,
}: {
  outlets: BarisOutlet[];
  coordinators: PilihanCoordinator[];
  /** Orang Finance yang boleh dipegangi wilayah. */
  financePic: PilihanCoordinator[];
  /** Orang Marketing yang boleh dipegangi wilayah. */
  marketingPic: PilihanCoordinator[];
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [brand, setBrand] = React.useState("");
  const [ca, setCa] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [sunting, setSunting] = React.useState<BarisOutlet | null>(null);

  const brands = React.useMemo(
    () => [...new Set(outlets.map((o) => o.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id")),
    [outlets],
  );

  const saring = React.useMemo(() => {
    const kata = q.trim().toLowerCase();
    return outlets.filter((o) => {
      if (
        kata &&
        ![o.nama, o.kode, o.owner ?? "", o.coordinatorNama ?? "", o.financeNama ?? "", o.marketingNama ?? ""].some((t) =>
          t.toLowerCase().includes(kata),
        )
      )
        return false;
      if (brand && o.brand !== brand) return false;
      // "belum" menyaring yang BELUM punya coordinator — pertanyaan yang paling
      // sering dibawa orang ke halaman ini.
      if (ca === "belum" ? o.coordinatorId : ca && o.coordinatorId !== ca) return false;
      if (status === "aktif" && !o.aktif) return false;
      if (status === "nonaktif" && o.aktif) return false;
      if (status === "tanpa-owner" && o.owner) return false;
      return true;
    });
  }, [outlets, q, brand, ca, status]);

  const aktif = outlets.filter((o) => o.aktif).length;
  const berowner = outlets.filter((o) => o.owner).length;
  const berca = outlets.filter((o) => o.coordinatorId).length;

  const reset = () => {
    setQ("");
    setBrand("");
    setCa("");
    setStatus("");
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Manajemen Outlet</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Tetapkan pemilik, coordinator area, dan PIC Finance/Marketing tiap outlet
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Store} label="Total Outlet" value={outlets.length} sub="Seluruh outlet terdaftar" />
        <StatTile icon={Check} label="Aktif" value={aktif} sub="Sedang beroperasi" />
        <StatTile icon={Building2} label="Ber-owner" value={berowner} sub={`${outlets.length - berowner} belum diisi`} />
        <StatTile icon={UserCheck} label="Ada Coordinator" value={berca} sub={`${outlets.length - berca} belum dipegang`} />
      </div>

      <div className="glass mt-4 rounded-2xl border border-border p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Cari">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nama outlet, kode, owner…"
                className="pl-9"
              />
            </div>
          </Field>
          <Field label="Merek">
            <Combobox
              matchTriggerWidth
              value={brand}
              onChange={setBrand}
              options={[{ value: "", label: "Semua Merek" }, ...brands.map((b) => ({ value: b, label: b }))]}
              placeholder="Semua Merek"
            />
          </Field>
          <Field label="Coordinator Area">
            <Combobox
              matchTriggerWidth
              value={ca}
              onChange={setCa}
              options={[
                { value: "", label: "Semua Coordinator" },
                { value: "belum", label: "Belum dipegang" },
                ...coordinators.map((c) => ({ value: c.value, label: `${c.label} (${c.outlet})` })),
              ]}
              placeholder="Semua Coordinator"
            />
          </Field>
          <Field label="Status">
            <Combobox
              matchTriggerWidth
              searchable={false}
              value={status}
              onChange={setStatus}
              options={[
                { value: "", label: "Semua Status" },
                { value: "aktif", label: "Aktif" },
                { value: "nonaktif", label: "Nonaktif" },
                { value: "tanpa-owner", label: "Belum ada owner" },
              ]}
              placeholder="Semua Status"
            />
          </Field>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Menampilkan <span className="font-medium text-foreground">{saring.length}</span> dari {outlets.length} outlet
          </p>
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="size-3.5" /> Reset Filter
          </Button>
        </div>
      </div>

      <div className="glass mt-4 overflow-hidden rounded-2xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[68rem] text-sm">
            <thead>
              <tr className="whitespace-nowrap border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Outlet</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Coordinator Area</th>
                <th className="px-4 py-3">PIC Finance</th>
                <th className="px-4 py-3">PIC Marketing</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {saring.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-border/60 transition-colors last:border-0 hover:bg-foreground/[0.06]"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{o.nama}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {o.kode}
                      {o.kota ? ` · ${o.kota}` : ""}
                      {/* Outlet tanpa cabang ESB tidak punya angka penjualan di
                          mana pun. Disebut di sini, bukan didiamkan: dari luar
                          ia terlihat seperti outlet yang sepi. */}
                      {!o.punyaCabang && <span className="ms-1 text-amber-600 dark:text-amber-400">· belum ada cabang ESB</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {o.owner ? (
                      <span className="text-foreground">{o.owner}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {o.coordinatorNama ? (
                      <span className="text-foreground">{o.coordinatorNama}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <UserX className="size-3.5" /> Belum dipegang
                      </span>
                    )}
                  </td>
                  {/* BELUM DIPEGANG DI SINI BUKAN MASALAH, jadi tidak diberi
                      warna peringatan seperti Coordinator Area. Yang tidak
                      dipegangi wilayah memang melihat seluruh outlet — itu
                      keadaan wajar, bukan penugasan yang terlewat. */}
                  <td className="px-4 py-3">
                    {o.financeNama ? (
                      <span className="text-foreground">{o.financeNama}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {o.marketingNama ? (
                      <span className="text-foreground">{o.marketingNama}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge tone={o.aktif ? "success" : "danger"} dot>
                      {o.aktif ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => setSunting(o)}>
                      <Pencil className="size-3.5" /> Ubah
                    </Button>
                  </td>
                </tr>
              ))}
              {saring.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Tidak ada outlet yang cocok dengan saringan ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {sunting && (
        <DialogOutlet
          outlet={sunting}
          coordinators={coordinators}
          financePic={financePic}
          marketingPic={marketingPic}
          onTutup={() => setSunting(null)}
          onSimpan={() => {
            setSunting(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

/** Dialog ubah — dua kolom saja, sisanya ditampilkan tapi tidak bisa diubah. */
function DialogOutlet({
  outlet,
  coordinators,
  financePic,
  marketingPic,
  onTutup,
  onSimpan,
}: {
  outlet: BarisOutlet;
  coordinators: PilihanCoordinator[];
  financePic: PilihanCoordinator[];
  marketingPic: PilihanCoordinator[];
  onTutup: () => void;
  onSimpan: () => void;
}) {
  const [owner, setOwner] = React.useState(outlet.owner ?? "");
  const [ca, setCa] = React.useState(outlet.coordinatorId ?? "");
  const [fin, setFin] = React.useState(outlet.financeId ?? "");
  const [mkt, setMkt] = React.useState(outlet.marketingId ?? "");
  const [simpan, setSimpan] = React.useState(false);

  React.useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onTutup();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onTutup]);

  const kirim = async () => {
    setSimpan(true);
    try {
      const r = await simpanOutletAction({ id: outlet.id, owner, coordinatorId: ca, financeId: fin, marketingId: mkt });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`${outlet.nama} diperbarui.`);
      onSimpan();
    } finally {
      setSimpan(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onTutup}>
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-foreground">{outlet.nama}</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {outlet.kode}
              {outlet.kota ? ` · ${outlet.kota}` : ""}
            </p>
          </div>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onTutup}
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-3">
          <Field label="Owner">
            <Input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Nama pemilik outlet…"
              list="daftar-owner"
            />
          </Field>
          <Field label="Coordinator Area">
            <Combobox
              matchTriggerWidth
              value={ca}
              onChange={setCa}
              options={[
                { value: "", label: "Belum dipegang" },
                ...coordinators.map((c) => ({ value: c.value, label: `${c.label} (${c.outlet} outlet)` })),
              ]}
              placeholder="Belum dipegang"
            />
          </Field>
          <Field label="PIC Finance">
            <Combobox
              matchTriggerWidth
              value={fin}
              onChange={setFin}
              options={[
                { value: "", label: "Belum dipegang" },
                ...financePic.map((c) => ({ value: c.value, label: `${c.label} (${c.outlet} outlet)` })),
              ]}
              placeholder="Belum dipegang"
            />
          </Field>
          <Field label="PIC Marketing">
            <Combobox
              matchTriggerWidth
              value={mkt}
              onChange={setMkt}
              options={[
                { value: "", label: "Belum dipegang" },
                ...marketingPic.map((c) => ({ value: c.value, label: `${c.label} (${c.outlet} outlet)` })),
              ]}
              placeholder="Belum dipegang"
            />
          </Field>
          {/* KETIGANYA BERDIRI SENDIRI. Satu outlet memang dipegang tiga orang
              sekaligus — coordinator, finance, marketing — yang memantaunya
              dari tiga sudut. Disebut di sini supaya tidak ada yang mengira
              mengisi yang satu mencabut yang lain. */}
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Coordinator Area, PIC Finance, dan PIC Marketing berdiri sendiri — satu outlet bisa dipegang ketiganya
            sekaligus. Yang tidak dipegangi wilayah sama sekali akan melihat SELURUH outlet di halaman Performance
            bidangnya.
          </p>
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Nama, kode, dan cabang ESB datang dari sinkronisasi ESB, jadi tidak diubah dari sini — perubahan tangan
            akan tertimpa pada sinkronisasi berikutnya.
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onTutup} disabled={simpan}>
            Batal
          </Button>
          <Button onClick={kirim} disabled={simpan}>
            {simpan ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Simpan
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Saran nama owner yang sudah pernah dipakai — supaya satu pemilik tidak
 *  tertulis tiga ejaan berbeda. */
export function DaftarOwner({ owners }: { owners: string[] }) {
  return (
    <datalist id="daftar-owner">
      {owners.map((o) => (
        <option key={o} value={o} />
      ))}
    </datalist>
  );
}
