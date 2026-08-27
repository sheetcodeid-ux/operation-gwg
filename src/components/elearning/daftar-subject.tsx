"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookOpen, LibraryBig, Loader2, Pencil, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import { StatTile } from "@/components/ui/stat";
import { BilahModul, KerangkaModul, LegendaHitung, LencanaHak, useLayarPenuh } from "@/components/hcmos/kit-modul";
import { createCourseAction, pesertaSubjectAction, simpanPesertaSubjectAction, updateCourseAction } from "@/lib/actions/elearning";

/**
 * Daftar subject E-Learning — pintu masuk pengelolaan materi.
 *
 * MENGAPA DAFTAR, BUKAN LANGSUNG SATU COURSE. Sebelumnya halaman Kelola
 * membuka satu course aktif dan hanya itu; subject lain tidak punya jalan masuk
 * sama sekali. Selama kurikulumnya satu itu cukup — begitu bercabang (Fast
 * Start crew, orientasi manajemen, materi satu brand), yang tidak sedang aktif
 * jadi tidak terlihat dan tidak bisa disunting.
 *
 * Kolom PESERTA menampilkan "Semua" untuk subject yang belum punya daftar
 * peserta. Itu BUKAN "belum diisi": subject tanpa daftar memang berlaku untuk
 * semua orang, dan menuliskannya sebagai angka nol akan membuat orang mengira
 * tidak ada yang mengerjakannya.
 */

export interface BarisSubject {
  id: string;
  judul: string;
  keterangan: string;
  aktif: boolean;
  jumlahMateri: number;
  /** Jumlah peserta yang DITUGASKAN. 0 berarti subject terbuka untuk semua. */
  jumlahPeserta: number;
  /** Berapa peserta yang ada di sistem — penyebut untuk subject terbuka. */
  totalPeserta: number;
}

export interface PilihanPeserta {
  id: string;
  nama: string;
  departemen: string;
}

type Urutan = "terbaru" | "judul" | "materi" | "peserta";

const URUTAN: { value: Urutan; label: string }[] = [
  { value: "terbaru", label: "Terbaru" },
  { value: "judul", label: "Judul A–Z" },
  { value: "materi", label: "Materi terbanyak" },
  { value: "peserta", label: "Peserta terbanyak" },
];

export function DaftarSubject({
  rows,
  peserta,
  courseAktifId,
  onBuka,
}: {
  rows: BarisSubject[];
  peserta: PilihanPeserta[];
  courseAktifId: string | null;
  /** Membuka satu subject untuk disunting materinya. */
  onBuka: (id: string) => void;
}) {
  const router = useRouter();
  const { bingkai, layarPenuh, alih } = useLayarPenuh();
  const [cari, setCari] = React.useState("");
  const [status, setStatus] = React.useState<"all" | "aktif" | "nonaktif">("all");
  const [materi, setMateri] = React.useState<"all" | "ada" | "kosong">("all");
  const [departemen, setDepartemen] = React.useState("all");
  const [urutan, setUrutan] = React.useState<Urutan>("terbaru");
  const [form, setForm] = React.useState<null | { id?: string; judul: string; keterangan: string; aktif: boolean; userIds: string[] }>(null);

  const departemenOptions = React.useMemo(() => {
    const set = [...new Set(peserta.map((p) => p.departemen).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
    return [{ value: "all", label: "Semua departemen" }, ...set.map((d) => ({ value: d, label: d }))];
  }, [peserta]);

  /**
   * Saringan departemen menyaring SUBJECT lewat pesertanya, bukan menyaring
   * pesertanya. Yang ditanyakan HC adalah "subject apa saja yang menyangkut
   * Operational" — jawabannya daftar subject, bukan daftar orang.
   *
   * Subject terbuka selalu lolos saringan ini: ia memang menyangkut semua
   * departemen.
   */
  const [pesertaPerSubject, setPesertaPerSubject] = React.useState<Record<string, string[]>>({});
  const depDariUser = React.useMemo(() => new Map(peserta.map((p) => [p.id, p.departemen])), [peserta]);

  const q = cari.trim().toLowerCase();
  const tampil = React.useMemo(() => {
    let hasil = rows.filter((r) => {
      if (status === "aktif" && !r.aktif) return false;
      if (status === "nonaktif" && r.aktif) return false;
      if (materi === "ada" && r.jumlahMateri === 0) return false;
      if (materi === "kosong" && r.jumlahMateri > 0) return false;
      if (departemen !== "all") {
        const ids = pesertaPerSubject[r.id];
        // Belum dimuat, atau memang terbuka → dianggap menyangkut semua.
        if (ids && ids.length > 0 && !ids.some((id) => depDariUser.get(id) === departemen)) return false;
      }
      return !q || `${r.judul} ${r.keterangan}`.toLowerCase().includes(q);
    });
    hasil = [...hasil].sort((a, b) => {
      if (urutan === "judul") return a.judul.localeCompare(b.judul, "id");
      if (urutan === "materi") return b.jumlahMateri - a.jumlahMateri;
      if (urutan === "peserta") return b.jumlahPeserta - a.jumlahPeserta;
      return 0; // "terbaru" — urutan datang dari server
    });
    return hasil;
  }, [rows, status, materi, departemen, q, urutan, pesertaPerSubject, depDariUser]);

  const menyaring = q !== "" || status !== "all" || materi !== "all" || departemen !== "all";

  const totalMateri = tampil.reduce((a, r) => a + r.jumlahMateri, 0);
  const pesertaUnik = React.useMemo(() => {
    // Subject terbuka menyumbang SELURUH peserta; yang bertugas menyumbang
    // namanya sendiri. Dijumlah begitu saja, satu orang yang ikut tiga subject
    // akan terhitung tiga kali.
    const set = new Set<string>();
    let adaTerbuka = false;
    for (const r of tampil) {
      if (r.jumlahPeserta === 0) adaTerbuka = true;
      else for (const id of pesertaPerSubject[r.id] ?? []) set.add(id);
    }
    return adaTerbuka ? peserta.length : set.size;
  }, [tampil, pesertaPerSubject, peserta.length]);

  async function bukaPeserta(r: BarisSubject) {
    const res = await pesertaSubjectAction(r.id);
    if ("error" in res) return toast.error(res.error);
    setPesertaPerSubject((p) => ({ ...p, [r.id]: res.userIds }));
    setForm({ id: r.id, judul: r.judul, keterangan: r.keterangan, aktif: r.aktif, userIds: res.userIds });
  }

  const rekap = [
    {
      key: "aktif",
      kode: "A",
      label: "Aktif",
      jumlah: rows.filter((r) => r.aktif).length,
      warna: ["#059669", "#34d399"] as [string, string],
    },
    {
      key: "nonaktif",
      kode: "N",
      label: "Nonaktif",
      jumlah: rows.filter((r) => !r.aktif).length,
      warna: ["#64748b", "#94a3b8"] as [string, string],
    },
    {
      key: "kosong",
      kode: "0",
      label: "Tanpa materi",
      jumlah: rows.filter((r) => r.jumlahMateri === 0).length,
      warna: ["#d97706", "#fbbf24"] as [string, string],
    },
  ];

  return (
    <KerangkaModul ref={bingkai}>
      <BilahModul
        ikon={LibraryBig}
        gradien="from-teal-500 via-cyan-500 to-sky-600 shadow-cyan-500/20"
        judul="Kelola E-Learning"
        ringkas={
          <>
            {rows.length} subject · {rows.reduce((a, r) => a + r.jumlahMateri, 0)} materi ·{" "}
            {peserta.length} peserta terdaftar di sistem
          </>
        }
        cari={cari}
        onCari={setCari}
        cariPlaceholder="Cari judul atau keterangan subject…"
        hitung={{ tampil: tampil.length, total: rows.length }}
        menyaring={menyaring}
        onBersihkan={() => {
          setCari("");
          setStatus("all");
          setMateri("all");
          setDepartemen("all");
        }}
        saringan={
          <>
            <Combobox
              portal
              searchable={false}
              value={status}
              onChange={(v) => setStatus(v as typeof status)}
              className="w-full shrink-0 sm:w-36"
              options={[
                { value: "all", label: "Semua status" },
                { value: "aktif", label: "Aktif" },
                { value: "nonaktif", label: "Nonaktif" },
              ]}
            />
            <Combobox
              portal
              searchable={false}
              value={materi}
              onChange={(v) => setMateri(v as typeof materi)}
              className="w-full shrink-0 sm:w-36"
              options={[
                { value: "all", label: "Semua materi" },
                { value: "ada", label: "Sudah ada materi" },
                { value: "kosong", label: "Belum ada materi" },
              ]}
            />
            <Combobox
              portal
              value={departemen}
              onChange={setDepartemen}
              className="w-full shrink-0 sm:w-44"
              options={departemenOptions}
              searchPlaceholder="Cari departemen…"
            />
            <Combobox
              portal
              searchable={false}
              value={urutan}
              onChange={(v) => setUrutan(v as Urutan)}
              className="w-full shrink-0 sm:w-40"
              options={URUTAN}
            />
          </>
        }
        aksi={
          <Button size="sm" onClick={() => setForm({ judul: "", keterangan: "", aktif: true, userIds: [] })}>
            <Plus className="size-3.5" /> Subject
          </Button>
        }
        layarPenuh={layarPenuh}
        onLayarPenuh={alih}
      />

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          <StatTile icon={LibraryBig} label="Total Subject" value={tampil.length} sub="mengikuti saringan" />
          <StatTile icon={BookOpen} label="Total Materi" value={totalMateri} sub="pada subject yang tampil" />
          <StatTile icon={Users} label="Peserta Unik" value={pesertaUnik} sub="orang berbeda, bukan jumlah baris" />
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <Th className="w-10">#</Th>
                <Th>Subject</Th>
                <Th className="w-28">Status</Th>
                <Th className="w-24">Materi</Th>
                <Th className="w-40">Peserta</Th>
                <Th className="w-40 text-right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {tampil.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    {rows.length === 0 ? "Belum ada subject. Klik + Subject untuk membuat yang pertama." : "Tidak ada subject pada saringan ini."}
                  </td>
                </tr>
              ) : (
                tampil.map((r, i) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <Td className="tabular-nums text-muted-foreground">{i + 1}</Td>
                    <Td>
                      <p className="font-medium text-foreground">{r.judul}</p>
                      {r.keterangan && <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{r.keterangan}</p>}
                      {r.id === courseAktifId && (
                        <Badge tone="brand" className="mt-1">
                          Sedang berjalan
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={r.aktif ? "success" : "neutral"} dot>
                        {r.aktif ? "Active" : "Nonaktif"}
                      </Badge>
                    </Td>
                    <Td className="tabular-nums">
                      {r.jumlahMateri === 0 ? <span className="text-muted-foreground">belum ada</span> : r.jumlahMateri}
                    </Td>
                    <Td>
                      {r.jumlahPeserta === 0 ? (
                        <span title="Subject tanpa daftar peserta berlaku untuk semua orang.">
                          <Badge tone="neutral">Semua ({r.totalPeserta})</Badge>
                        </span>
                      ) : (
                        <span className="tabular-nums">{r.jumlahPeserta} orang</span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button size="sm" variant="subtle" onClick={() => void bukaPeserta(r)}>
                          <Users className="size-3.5" /> Peserta
                        </Button>
                        <Button size="sm" variant="subtle" onClick={() => onBuka(r.id)}>
                          <Pencil className="size-3.5" /> Materi
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LegendaHitung butir={rekap} kiri={<LencanaHak bolehUbah catatan="Pengelola E-Learning" />} />

      {form && (
        <DialogSubject
          key={form.id ?? "baru"}
          awal={form}
          peserta={peserta}
          onClose={() => setForm(null)}
          onSelesai={() => {
            setForm(null);
            router.refresh();
          }}
        />
      )}
    </KerangkaModul>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-top ${className}`}>{children}</td>;
}

/* ───────────────────────────── tambah / ubah subject ───────────────────────────── */

function DialogSubject({
  awal,
  peserta,
  onClose,
  onSelesai,
}: {
  awal: { id?: string; judul: string; keterangan: string; aktif: boolean; userIds: string[] };
  peserta: PilihanPeserta[];
  onClose: () => void;
  onSelesai: () => void;
}) {
  const [judul, setJudul] = React.useState(awal.judul);
  const [keterangan, setKeterangan] = React.useState(awal.keterangan);
  const [aktif, setAktif] = React.useState(awal.aktif);
  const [userIds, setUserIds] = React.useState<string[]>(awal.userIds);
  const [busy, setBusy] = React.useState(false);

  const opsi = React.useMemo(
    () =>
      peserta.map((p) => ({
        value: p.id,
        label: p.departemen ? `${p.nama} · ${p.departemen}` : p.nama,
      })),
    [peserta],
  );

  async function simpan() {
    if (!judul.trim()) return toast.error("Judul wajib diisi.");
    setBusy(true);
    try {
      let id = awal.id;
      if (!id) {
        const res = await createCourseAction({
          title: judul.trim(),
          description: keterangan.trim(),
          category: "Umum",
          passScore: 70,
          thumbnailPath: null,
        });
        if ("error" in res && res.error) return toast.error(res.error);
        id = (res as { id?: string }).id;
        if (!id) return toast.error("Subject tersimpan tapi id-nya tidak kembali. Muat ulang halaman.");
        if (!aktif) await updateCourseAction(id, { active: false });
      } else {
        const res = await updateCourseAction(id, { title: judul.trim(), description: keterangan.trim(), active: aktif });
        if (res && "error" in res && res.error) return toast.error(res.error);
      }

      const pes = await simpanPesertaSubjectAction({ courseId: id, userIds });
      if ("error" in pes) return toast.error(pes.error);

      toast.success(
        pes.terbuka
          ? "Tersimpan. Tanpa daftar peserta, subject ini terbuka untuk semua."
          : `Tersimpan. ${pes.jumlah} peserta ditetapkan.`,
      );
      onSelesai();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={awal.id ? "Ubah Subject" : "Tambah Subject"} align="center">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
          <Field label="Judul">
            <Input value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="Contoh: Onboarding Karyawan Baru" />
          </Field>
          <Field label="Status">
            <Combobox
              portal
              searchable={false}
              value={aktif ? "aktif" : "nonaktif"}
              onChange={(v) => setAktif(v === "aktif")}
              options={[
                { value: "aktif", label: "Active" },
                { value: "nonaktif", label: "Nonaktif" },
              ]}
            />
          </Field>
        </div>

        <Field label="Keterangan">
          <Textarea
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            placeholder="Keterangan subject (opsional)"
            rows={3}
          />
        </Field>

        <Field label="Peserta">
          <MultiCombobox
            options={opsi}
            value={userIds}
            onChange={setUserIds}
            placeholder="Ketik untuk mencari nama…"
            searchPlaceholder="Cari nama atau departemen…"
            allLabel="Semua peserta"
          />
          {/* Aturan kosongnya ditulis di layar, bukan cuma di kode: yang menghapus
              nama terakhir perlu tahu ia justru baru membuka subjectnya. */}
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {userIds.length === 0
              ? "Dibiarkan kosong, subject ini TERBUKA untuk semua peserta — bukan tertutup. Untuk menutupnya, ubah statusnya jadi Nonaktif."
              : `${userIds.length} orang ditetapkan. Hanya mereka yang bisa membuka subject ini.`}
          </p>
        </Field>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button onClick={() => void simpan()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null} Simpan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
