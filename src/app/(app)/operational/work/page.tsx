import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { daftarWork, saringStatus, workAktifPerSignal } from "@/lib/data/work-daftar";
import { pilihanWork } from "@/lib/data/work-pilihan";
import { canReachMenu, MENU_WORK } from "@/lib/nav";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { FormWorkBaru } from "@/components/operation/form-work-baru";
import { PapanWorkUI } from "@/components/operation/papan-work";

export const metadata: Metadata = { title: "Work Signal" };
export const maxDuration = 60;

/**
 * WORK Z-02 — daftar pekerjaan yang lahir dari Signal.
 *
 * ┌─ SATU GERBANG, DAN SATU JALAN SAMPING ───────────────────────────────────┐
 * │                                                                          │
 * │   canReachMenu(MENU_WORK)   melihat SELURUH Work perusahaan              │
 * │   pelaksana aktif           melihat Work yang dipegangnya, walau tidak   │
 * │                             boleh membuka menunya                        │
 * │                                                                          │
 * │ Itu bunyi O-06 apa adanya, dikunci ulang sebagai OD-01 = A. `persempit()`│
 * │ TIDAK dipakai untuk Work: `works` tidak punya `outlet_id`, dan satu Work │
 * │ bisa menangani Signal dari beberapa outlet sekaligus.                    │
 * │                                                                          │
 * │ Karena itu halaman ini TIDAK menolak siapa pun di pintu masuk — yang     │
 * │ tidak punya akses menu tetap boleh masuk dan melihat PEKERJAANNYA        │
 * │ SENDIRI. Yang membatasi `seluruhnya`, bukan redirect.                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ DUA PINTU PEMBUATAN, SATU HALAMAN ──────────────────────────────────────┐
 * │                                                                          │
 * │   ?buat=1              tombol pada daftar ini                            │
 * │   ?buat=1&signal=10    tombol pada baris Signal di Command Center        │
 * │                                                                          │
 * │ Keduanya merender FORM YANG SAMA (OD-STEP7-01 = C, OD-STEP7-04 = B).     │
 * │ Tidak ada rute baru, tidak ada form kedua, tidak ada penulis kedua.      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export default async function WorkPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    overdue?: string;
    owner?: string;
    departemen?: string;
    pelaksana?: string;
    buat?: string;
    signal?: string;
  }>;
}) {
  const user = await requireSessionUser();
  const seluruhnya = canReachMenu(user, MENU_WORK);
  const bolehBuat = seluruhnya && can(user, "create_signal_work");

  const sp = await searchParams;

  if (sp.buat === "1") {
    // Gerbang yang sama dengan `buatWorkAction`. Yang di sini BUKAN
    // penggantinya: action memeriksa ulang di server, dan itu yang berkuasa.
    if (!bolehBuat) redirect("/dashboard");

    const pilihan = await pilihanWork(user);
    const awal = (sp.signal ?? "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0);

    // ── GAP-04 · Signal yang sudah dikerjakan orang lain ──
    //
    // Ditarik untuk SELURUH Signal yang boleh dipilih, bukan hanya yang
    // dipreseleksi: orang bebas mengubah pilihannya di dalam form, dan
    // keterangannya harus ikut tanpa perjalanan bolak-balik ke server.
    //
    // Ini TIDAK menolak apa pun. D3 mengunci N:N, jadi Work kedua tetap sah —
    // yang berubah hanya: orang memutuskannya sambil melihat.
    const workAktif = await workAktifPerSignal(pilihan.signal.map((s) => s.id));

    return (
      <div className="w-full">
        <PageHeader
          icon={ListChecks}
          title="Work Signal baru"
          description="Pekerjaan selalu berasal dari Signal — pilih Signalnya, lalu tentukan siapa menanggung dan siapa mengerjakan"
        />
        <FormWorkBaru pilihan={pilihan} initialSignalIds={awal} workAktif={workAktif} />
      </div>
    );
  }

  const status = saringStatus((sp.status ?? "").split(",").filter(Boolean));

  // Satu pembacaan untuk daftar, satu untuk pilihan saringan — berjalan
  // bersamaan, bukan satu kueri per kontrol.
  const [papan, pilihan] = await Promise.all([
    daftarWork({
      seluruhnya,
      userId: user.id,
      saring: {
        status,
        overdue: sp.overdue === "1",
        ownerId: sp.owner || null,
        departemen: sp.departemen || null,
        executorId: sp.pelaksana || null,
      },
    }),
    pilihanWork(user),
  ]);

  // Tanpa akses menu DAN tanpa satu pun penugasan aktif, tidak ada apa pun yang
  // boleh dibaca orang ini — dan halaman kosong tanpa penjelasan lebih buruk
  // daripada dikembalikan ke tempat yang memang bisa ia buka.
  if (!seluruhnya && papan.total === 0 && !sp.status && !sp.overdue) redirect("/dashboard");

  return (
    <div className="w-full">
      <PageHeader
        icon={ListChecks}
        title="Work Signal"
        description="Pekerjaan yang lahir dari Signal — siapa menanggung, siapa mengerjakan, dan kapan tenggatnya"
      />
      <PapanWorkUI papan={papan} bolehBuat={bolehBuat} pilihan={pilihan} />
    </div>
  );
}
