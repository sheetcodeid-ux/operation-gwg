"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, LogIn, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { DataTable } from "@/components/ui/data-table";
import { DatePicker } from "@/components/ui/date-picker";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { StatTile } from "@/components/ui/stat";
import { AlurLangkah } from "./alur";
import { TAHAP_ONBOARDING_MANAJEMEN, TAHAP_ONBOARDING_OUTLET } from "@/lib/hcmos/alur-sop";
import { useConfirm } from "@/components/ui/confirm";
import { SCOPE_LABEL, type HcScope } from "@/lib/hcmos/pillars";
import {
  TAHAP_AKTIF,
  TAHAP_KANDIDAT,
  TAHAP_META,
  butirOnboarding,
  progresOnboarding,
  type TahapKandidat,
} from "@/lib/hcmos/rekrutmen";
import {
  hapusKandidatAction,
  hapusOnboardingAction,
  simpanKandidatAction,
  simpanOnboardingAction,
} from "@/lib/actions/hcmos-rekrutmen";
import type { KandidatRow, OnboardingRow } from "@/lib/data/hcmos-rekrutmen";
import { formatDate } from "@/lib/utils";

export interface PilihanOutlet {
  id: string;
  name: string;
}

/**
 * Rekrutmen — kandidat, jadwal wawancara, dan onboarding dalam satu halaman.
 *
 * Ketiganya adalah satu perjalanan orang yang sama: melamar → diwawancara →
 * diterima → menjalani orientasi. Memecahnya jadi tiga halaman terpisah
 * memaksa penggunanya membuka tiga tempat untuk satu pertanyaan sederhana:
 * "kandidat ini sekarang di mana?".
 */
export function RekrutmenBoard({
  kandidat,
  onboarding,
  outlets,
  bolehUbah,
  tabAwal = "kandidat",
}: {
  kandidat: KandidatRow[];
  onboarding: OnboardingRow[];
  outlets: PilihanOutlet[];
  bolehUbah: boolean;
  tabAwal?: string;
}) {
  const [tab, setTab] = React.useState(tabAwal);

  const aktif = kandidat.filter((k) => TAHAP_AKTIF.includes(k.tahap));
  const wawancara = kandidat.filter((k) => k.jadwalInterview);
  const diterima = kandidat.filter((k) => k.tahap === "diterima");

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Users} label="Kandidat Berjalan" value={aktif.length} sub="belum diputuskan" />
        <StatTile icon={CalendarDays} label="Terjadwal Wawancara" value={wawancara.length} sub="punya jadwal" />
        <StatTile icon={Check} label="Diterima" value={diterima.length} sub="lolos seleksi" />
        <StatTile icon={LogIn} label="Sedang Onboarding" value={onboarding.length} sub="karyawan baru" />
      </div>

      <SegmentedTabs
        className="max-w-xl"
        value={tab}
        onChange={setTab}
        items={[
          { value: "kandidat", label: "Kandidat", icon: Users },
          { value: "interview", label: "Jadwal Interview", icon: CalendarDays },
          { value: "onboarding", label: "Onboarding", icon: LogIn },
        ]}
      />

      {tab === "kandidat" && <TabKandidat rows={kandidat} outlets={outlets} bolehUbah={bolehUbah} />}
      {tab === "interview" && <TabInterview rows={wawancara} outlets={outlets} bolehUbah={bolehUbah} />}
      {tab === "onboarding" && (
        <>
          {/* Tahapannya ditaruh di atas daftarnya: yang ditanyakan orang saat
              membuka Onboarding hampir selalu "karyawan baru ini harus melewati
              apa saja", bukan "siapa saja yang sedang onboarding". */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
            <AlurLangkah
              judul="Tahapan Onboarding Manajemen"
              ringkas="Materi wajibnya berjalan lewat Self-Learning jalur Manajemen"
              langkah={TAHAP_ONBOARDING_MANAJEMEN}
            />
            <AlurLangkah
              judul="Tahapan Onboarding Outlet"
              ringkas="Fast Start & Fast Track berjalan di Self-Learning jalur Outlet"
              langkah={TAHAP_ONBOARDING_OUTLET}
            />
          </div>
          <TabOnboarding rows={onboarding} outlets={outlets} bolehUbah={bolehUbah} />
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────── kandidat ─────────────────────────────── */

const kandidatKosong = () => ({
  id: undefined as string | undefined,
  nama: "",
  posisi: "",
  scope: "manajemen" as HcScope,
  outletId: "",
  sumber: "",
  telepon: "",
  email: "",
  tahap: "baru" as TahapKandidat,
  jadwalInterview: "",
  pewawancara: "",
  catatan: "",
});
type FormKandidat = ReturnType<typeof kandidatKosong>;

const keFormKandidat = (k: KandidatRow): FormKandidat => ({
  id: k.id,
  nama: k.nama,
  posisi: k.posisi ?? "",
  scope: k.scope,
  outletId: k.outletId ?? "",
  sumber: k.sumber ?? "",
  telepon: k.telepon ?? "",
  email: k.email ?? "",
  tahap: k.tahap,
  jadwalInterview: k.jadwalInterview ?? "",
  pewawancara: k.pewawancara ?? "",
  catatan: k.catatan ?? "",
});

function TabKandidat({
  rows,
  outlets,
  bolehUbah,
}: {
  rows: KandidatRow[];
  outlets: PilihanOutlet[];
  bolehUbah: boolean;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [tahap, setTahap] = React.useState("all");
  const [form, setForm] = React.useState<FormKandidat | null>(null);

  const tersaring = React.useMemo(
    () => (tahap === "all" ? rows : rows.filter((r) => r.tahap === tahap)),
    [rows, tahap],
  );

  const hapus = React.useCallback(
    async (k: KandidatRow) => {
      const ya = await confirm({
        title: `Hapus kandidat ${k.nama}?`,
        description: "Riwayat lamaran dan catatan wawancaranya ikut terhapus.",
        confirmLabel: "Hapus",
        tone: "danger",
      });
      if (!ya) return;
      const res = await hapusKandidatAction(k.id);
      if (res.error) return toast.error(res.error);
      toast.success("Kandidat dihapus");
      router.refresh();
    },
    [confirm, router],
  );

  const columns = React.useMemo<ColumnDef<KandidatRow>[]>(
    () => [
      {
        accessorKey: "nama",
        header: "Kandidat",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.original.nama}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {row.original.posisi || "posisi belum diisi"}
              {row.original.telepon ? ` · ${row.original.telepon}` : ""}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "scope",
        header: "Scope",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-foreground">{SCOPE_LABEL[row.original.scope]}</p>
            {row.original.outletName && (
              <p className="truncate text-[11px] text-muted-foreground">{row.original.outletName}</p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "sumber",
        header: "Sumber",
        cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string | null>() ?? "—"}</span>,
      },
      {
        accessorKey: "tahap",
        header: "Tahap",
        cell: ({ row }) => {
          const m = TAHAP_META[row.original.tahap];
          return (
            <Badge tone={m.tone} dot>
              {m.label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "jadwalInterview",
        header: "Wawancara",
        cell: ({ getValue }) => {
          const v = getValue<string | null>();
          return <span className="text-muted-foreground">{v ? formatDate(v) : "—"}</span>;
        },
      },
      {
        id: "aksi",
        header: "",
        cell: ({ row }) =>
          bolehUbah ? (
            <div className="flex gap-1.5">
              <Button size="sm" variant="subtle" onClick={() => setForm(keFormKandidat(row.original))}>
                <Pencil className="size-3.5" /> Ubah
              </Button>
              <Button size="sm" variant="ghost" onClick={() => hapus(row.original)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ) : null,
      },
    ],
    [bolehUbah, hapus],
  );

  return (
    <>
      <DataTable
        tableId="hcmos-kandidat"
        columns={columns}
        data={tersaring}
        searchPlaceholder="Cari nama, posisi…"
        toolbar={
          <div className="contents">
            <Combobox
              portal
              searchable={false}
              value={tahap}
              onChange={setTahap}
              className="w-44 shrink-0"
              options={[
                { value: "all", label: "Semua Tahap" },
                ...TAHAP_KANDIDAT.map((t) => ({ value: t, label: TAHAP_META[t].label })),
              ]}
            />
            {bolehUbah && (
              <Button size="sm" className="shrink-0" onClick={() => setForm(kandidatKosong())}>
                <Plus className="size-3.5" /> Kandidat
              </Button>
            )}
          </div>
        }
      />
      {form && (
        <DialogKandidat key={form.id ?? "baru"} awal={form} outlets={outlets} onClose={() => setForm(null)} />
      )}
      {dialog}
    </>
  );
}

function DialogKandidat({
  awal,
  outlets,
  onClose,
}: {
  awal: FormKandidat;
  outlets: PilihanOutlet[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [f, setF] = React.useState(awal);
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof FormKandidat>(k: K, v: FormKandidat[K]) => setF((p) => ({ ...p, [k]: v }));

  async function simpan() {
    if (!f.nama.trim()) return toast.error("Nama kandidat wajib diisi.");
    setBusy(true);
    const res = await simpanKandidatAction(f);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success(f.id ? "Kandidat diperbarui" : "Kandidat ditambahkan");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        title={f.id ? "Ubah Kandidat" : "Kandidat Baru"}
        description="Data pelamar beserta tahap seleksinya."
        align="center"
        className="max-w-2xl"
      >
        <div className="max-h-[75vh] space-y-3 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nama Lengkap">
              <Input value={f.nama} onChange={(e) => set("nama", e.target.value)} />
            </Field>
            <Field label="Posisi Dilamar">
              <Input value={f.posisi} onChange={(e) => set("posisi", e.target.value)} placeholder="mis. Barista" />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Scope">
              <Combobox
                portal
                searchable={false}
                matchTriggerWidth
                value={f.scope}
                onChange={(v) => set("scope", v as HcScope)}
                options={[
                  { value: "manajemen", label: SCOPE_LABEL.manajemen },
                  { value: "outlet", label: SCOPE_LABEL.outlet },
                ]}
              />
            </Field>
            {/* Outlet hanya ditanyakan bila memang melamar ke outlet — dropdown
                yang tidak relevan hanya menambah keraguan pengisi. */}
            {f.scope === "outlet" && (
              <Field label="Outlet">
                <Combobox
                  portal
                  matchTriggerWidth
                  value={f.outletId}
                  onChange={(v) => set("outletId", v)}
                  placeholder="Pilih outlet…"
                  options={[{ value: "", label: "— belum ditentukan —" }, ...outlets.map((o) => ({ value: o.id, label: o.name }))]}
                />
              </Field>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Sumber">
              <Input value={f.sumber} onChange={(e) => set("sumber", e.target.value)} placeholder="mis. Instagram" />
            </Field>
            <Field label="Telepon">
              <Input value={f.telepon} onChange={(e) => set("telepon", e.target.value)} />
            </Field>
            <Field label="Email">
              <Input value={f.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Tahap">
              <Combobox
                portal
                searchable={false}
                matchTriggerWidth
                value={f.tahap}
                onChange={(v) => set("tahap", v as TahapKandidat)}
                options={TAHAP_KANDIDAT.map((t) => ({ value: t, label: TAHAP_META[t].label }))}
              />
            </Field>
            <Field label="Jadwal Wawancara">
              <DateTimePicker value={f.jadwalInterview} onChange={(v) => set("jadwalInterview", v)} />
            </Field>
            <Field label="Pewawancara">
              <Input value={f.pewawancara} onChange={(e) => set("pewawancara", e.target.value)} />
            </Field>
          </div>

          <Field label="Catatan">
            <Textarea rows={3} value={f.catatan} onChange={(e) => set("catatan", e.target.value)} />
          </Field>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Batal
            </Button>
            <Button onClick={simpan} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Simpan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────── jadwal interview ────────────────────────────── */

function TabInterview({
  rows,
  outlets,
  bolehUbah,
}: {
  rows: KandidatRow[];
  outlets: PilihanOutlet[];
  bolehUbah: boolean;
}) {
  const [form, setForm] = React.useState<FormKandidat | null>(null);

  // Dikelompokkan per tanggal, terdekat dulu — itulah pertanyaan yang dijawab
  // halaman ini: "hari ini siapa saja yang diwawancara?".
  const perTanggal = React.useMemo(() => {
    const map = new Map<string, KandidatRow[]>();
    for (const r of [...rows].sort((a, b) => (a.jadwalInterview ?? "").localeCompare(b.jadwalInterview ?? ""))) {
      const kunci = (r.jadwalInterview ?? "").slice(0, 10);
      map.set(kunci, [...(map.get(kunci) ?? []), r]);
    }
    return [...map.entries()];
  }, [rows]);

  if (perTanggal.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Belum ada kandidat yang punya jadwal wawancara. Isi jadwalnya lewat tab Kandidat.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {perTanggal.map(([tanggal, isi]) => (
        <Card key={tanggal}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between gap-2">
              <span>{formatDate(tanggal)}</span>
              <Badge tone="neutral">{isi.length} kandidat</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isi.map((k) => (
              <div key={k.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{k.nama}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {new Date(k.jadwalInterview!).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {k.posisi || "posisi belum diisi"}
                    {k.pewawancara ? ` · oleh ${k.pewawancara}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={TAHAP_META[k.tahap].tone}>{TAHAP_META[k.tahap].label}</Badge>
                  {bolehUbah && (
                    <Button size="sm" variant="subtle" onClick={() => setForm(keFormKandidat(k))}>
                      <Pencil className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      {form && (
        <DialogKandidat key={form.id ?? "baru"} awal={form} outlets={outlets} onClose={() => setForm(null)} />
      )}
    </div>
  );
}

/* ────────────────────────────── onboarding ────────────────────────────── */

const onboardingKosong = () => ({
  id: undefined as string | undefined,
  nama: "",
  posisi: "",
  scope: "manajemen" as HcScope,
  outletId: "",
  tglMulai: "",
  mentor: "",
  ceklis: {} as Record<string, boolean>,
  catatan: "",
});
type FormOnboarding = ReturnType<typeof onboardingKosong>;

function TabOnboarding({
  rows,
  outlets,
  bolehUbah,
}: {
  rows: OnboardingRow[];
  outlets: PilihanOutlet[];
  bolehUbah: boolean;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [form, setForm] = React.useState<FormOnboarding | null>(null);

  async function hapus(o: OnboardingRow) {
    const ya = await confirm({
      title: `Hapus onboarding ${o.nama}?`,
      description: "Ceklis orientasinya ikut terhapus.",
      confirmLabel: "Hapus",
      tone: "danger",
    });
    if (!ya) return;
    const res = await hapusOnboardingAction(o.id);
    if (res.error) return toast.error(res.error);
    toast.success("Data onboarding dihapus");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {bolehUbah && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setForm(onboardingKosong())}>
            <Plus className="size-3.5" /> Karyawan Baru
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Belum ada karyawan baru yang sedang menjalani onboarding.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((o) => {
            const butir = butirOnboarding(o.scope);
            const persen = progresOnboarding(o.scope, o.ceklis);
            return (
              <Card key={o.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate">{o.nama}</span>
                    <Badge tone={persen === 100 ? "success" : persen >= 50 ? "warning" : "neutral"}>{persen}%</Badge>
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground">
                    {o.posisi || "posisi belum diisi"} · {SCOPE_LABEL[o.scope]}
                    {o.outletName ? ` · ${o.outletName}` : ""}
                    {o.tglMulai ? ` · mulai ${formatDate(o.tglMulai)}` : ""}
                  </p>
                </CardHeader>
                <CardContent>
                  <Progress value={persen} tone={persen === 100 ? "success" : "brand"} />
                  <ul className="mt-3 space-y-1.5">
                    {butir.map((b) => (
                      <li key={b.key} className="flex items-start gap-2 text-[12px]">
                        <span
                          className={
                            o.ceklis[b.key]
                              ? "mt-0.5 grid size-4 shrink-0 place-items-center rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                              : "mt-0.5 grid size-4 shrink-0 place-items-center rounded border border-border"
                          }
                        >
                          {o.ceklis[b.key] && <Check className="size-3" />}
                        </span>
                        <span className={o.ceklis[b.key] ? "text-muted-foreground line-through" : "text-foreground"}>
                          {b.label}
                        </span>
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{b.oleh}</span>
                      </li>
                    ))}
                  </ul>
                  {o.mentor && <p className="mt-3 text-[11px] text-muted-foreground">Mentor: {o.mentor}</p>}
                  {bolehUbah && (
                    <div className="mt-3 flex justify-end gap-1.5 border-t border-border/60 pt-3">
                      <Button size="sm" variant="subtle" onClick={() => setForm(keFormOnboarding(o))}>
                        <Pencil className="size-3.5" /> Ubah
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => hapus(o)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {form && (
        <DialogOnboarding key={form.id ?? "baru"} awal={form} outlets={outlets} onClose={() => setForm(null)} />
      )}
      {dialog}
    </div>
  );
}

const keFormOnboarding = (o: OnboardingRow): FormOnboarding => ({
  id: o.id,
  nama: o.nama,
  posisi: o.posisi ?? "",
  scope: o.scope,
  outletId: o.outletId ?? "",
  tglMulai: o.tglMulai ?? "",
  mentor: o.mentor ?? "",
  ceklis: { ...o.ceklis },
  catatan: o.catatan ?? "",
});

function DialogOnboarding({
  awal,
  outlets,
  onClose,
}: {
  awal: FormOnboarding;
  outlets: PilihanOutlet[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [f, setF] = React.useState(awal);
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof FormOnboarding>(k: K, v: FormOnboarding[K]) => setF((p) => ({ ...p, [k]: v }));
  const butir = butirOnboarding(f.scope);

  async function simpan() {
    if (!f.nama.trim()) return toast.error("Nama karyawan wajib diisi.");
    setBusy(true);
    const res = await simpanOnboardingAction(f);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success(f.id ? "Onboarding diperbarui" : "Onboarding dimulai");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        title={f.id ? "Ubah Onboarding" : "Mulai Onboarding"}
        description="Ceklisnya menyesuaikan scope — kantor pusat dan outlet memang berbeda."
        align="center"
        className="max-w-2xl"
      >
        <div className="max-h-[75vh] space-y-3 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nama Karyawan">
              <Input value={f.nama} onChange={(e) => set("nama", e.target.value)} />
            </Field>
            <Field label="Posisi">
              <Input value={f.posisi} onChange={(e) => set("posisi", e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Scope">
              <Combobox
                portal
                searchable={false}
                matchTriggerWidth
                value={f.scope}
                onChange={(v) => set("scope", v as HcScope)}
                options={[
                  { value: "manajemen", label: SCOPE_LABEL.manajemen },
                  { value: "outlet", label: SCOPE_LABEL.outlet },
                ]}
              />
            </Field>
            <Field label="Tanggal Mulai">
              <DatePicker value={f.tglMulai} onChange={(v) => set("tglMulai", v)} />
            </Field>
            <Field label="Mentor">
              <Input value={f.mentor} onChange={(e) => set("mentor", e.target.value)} />
            </Field>
          </div>

          {f.scope === "outlet" && (
            <Field label="Outlet">
              <Combobox
                portal
                matchTriggerWidth
                value={f.outletId}
                onChange={(v) => set("outletId", v)}
                placeholder="Pilih outlet…"
                options={[{ value: "", label: "— belum ditentukan —" }, ...outlets.map((o) => ({ value: o.id, label: o.name }))]}
              />
            </Field>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ceklis Orientasi</p>
            <div className="space-y-1.5">
              {butir.map((b) => (
                <label
                  key={b.key}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border p-2.5 text-sm hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={!!f.ceklis[b.key]}
                    onChange={(e) => set("ceklis", { ...f.ceklis, [b.key]: e.target.checked })}
                  />
                  <span className="min-w-0 flex-1 truncate text-foreground">{b.label}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{b.oleh}</span>
                </label>
              ))}
            </div>
          </div>

          <Field label="Catatan">
            <Textarea rows={2} value={f.catatan} onChange={(e) => set("catatan", e.target.value)} />
          </Field>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Batal
            </Button>
            <Button onClick={simpan} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Simpan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
