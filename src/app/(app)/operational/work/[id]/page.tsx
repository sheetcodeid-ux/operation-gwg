import Link from "next/link";
import { ArrowLeft, ListChecks, Siren } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { detailWork } from "@/lib/data/work-daftar";
import { pilihanWork } from "@/lib/data/work-pilihan";
import { canReachMenu, MENU_COMMAND_CENTER, MENU_WORK } from "@/lib/nav";
import { can } from "@/lib/rbac";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { DetailWorkUI } from "@/components/operation/detail-work";

export const metadata: Metadata = { title: "Detail Work" };
export const maxDuration = 60;

/**
 * SATU WORK, DAN SELURUH YANG MELEKAT PADANYA.
 *
 * ┌─ YANG TIDAK BOLEH DIBACA DIKEMBALIKAN, BUKAN DIBERI 404 ─────────────────┐
 * │                                                                          │
 * │ "Tidak ditemukan" dan "tidak boleh dilihat" adalah dua jawaban berbeda,  │
 * │ dan membedakannya di layar memberi tahu penanya bahwa Work bernomor itu  │
 * │ MEMANG ADA. Keduanya karena itu berakhir sama: kembali ke dashboard.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Work terminal TETAP terbaca penuh. Yang berhenti mutasinya, bukan
 * pembacaannya (AD-20 · G).
 *
 * ┌─ JALAN KELUAR TIDAK BOLEH BERGANTUNG PADA LEBAR LAYAR ───────────────────┐
 * │                                                                          │
 * │ Remah roti global disembunyikan di bawah `lg` (`topbar.tsx`), jadi di    │
 * │ tablet dan ponsel halaman ini dahulu tidak punya satu pun jalan keluar   │
 * │ selain tombol Back peramban. `PageHeader` pun tidak menolong: tanpa      │
 * │ `actions` ia hanya mengeluarkan judul tak terlihat. Karena itu kepala    │
 * │ halaman digambar di sini apa adanya — pola yang sama dengan              │
 * │ `admin/users/[id]`: panah kembali, judul yang benar-benar terbaca, lalu  │
 * │ jalan pintas ke tempat Signal-nya berasal.                               │
 * │                                                                          │
 * │ Jalan pintas itu BUKAN gerbang. Yang menahan orang tetap halaman         │
 * │ Command Center sendiri (`canReachMenu` di server, lalu `persempit()`).   │
 * │ Yang di sini hanya menyembunyikan tautan yang sudah pasti berakhir di    │
 * │ `/dashboard` — supaya tidak ada yang menekannya dan merasa diusir.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export default async function DetailWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSessionUser();
  const { id } = await params;
  const nomor = Number(id);

  const detail = Number.isInteger(nomor) && nomor > 0 ? await detailWork(nomor) : null;
  if (!detail) redirect("/dashboard");

  const pelaksanaAktif = detail.pelaksana.some((p) => p.userId === user.id && p.aktif);
  if (!canReachMenu(user, MENU_WORK) && !pelaksanaAktif) redirect("/dashboard");

  // Daftar orang, departemen, dan Signal untuk pemilih di layar — sumber yang
  // SAMA dengan form Work baru, bukan daftar kedua yang bisa berbeda diam-diam.
  //
  // Hanya ditarik untuk orang yang memang bisa membuka salah satu dialognya.
  // Yang cuma menonton tidak perlu menerima daftar orang dan Signal yang tidak
  // dapat ia pakai — ini penghematan bacaan, BUKAN otorisasi: yang memutuskan
  // tetap `work-signal.ts` di server.
  const kelola = can(user, "manage_signals");
  const pilihan = kelola || user.id === detail.ownerId ? await pilihanWork(user) : undefined;

  // Dihitung di SERVER, dan hanya dipakai untuk menampilkan atau menyembunyikan
  // satu tautan. Pelaksana yang masuk lewat pintu samping tetap membaca Work
  // ini sepenuhnya — ia hanya tidak ditawari tempat yang memang tidak boleh
  // ia buka, dan itu BUKAN alasan untuk mengusirnya dari halaman ini.
  const bolehCommandCenter = canReachMenu(user, MENU_COMMAND_CENTER);

  return (
    <div className="w-full">
      {/* Judul tingkat satu tetap milik `PageHeader`, supaya susunan heading
          halaman ini sama dengan 47 halaman lain. Yang terbaca mata digambar
          lagi di bawah dan DISEMBUNYIKAN dari pembaca layar — kalau tidak,
          judul yang sama terdengar dua kali berturut-turut. */}
      <PageHeader icon={ListChecks} title={detail.judul} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Satu tautan, berlabel, dan TIDAK bersyarat apa pun. `/operational/work`
            memang tidak menolak siapa pun di pintu masuk — yang membatasi isinya
            `seluruhnya`, bukan redirect — jadi pelaksana yang masuk lewat pintu
            samping pun tetap punya jalan pulang (OD-STEP8C-02 = A). */}
        <Link
          href="/operational/work"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
        >
          <ArrowLeft className="size-4" /> Work Signal
        </Link>
        <div className="min-w-0 flex-1">
          <p aria-hidden="true" className="truncate text-xl font-semibold text-foreground">
            {detail.judul}
          </p>
          <p className="text-sm text-muted-foreground">Work #{detail.id}</p>
        </div>
        {bolehCommandCenter && (
          <Link
            href="/operational/command-center"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Siren className="size-4" /> Command Center
          </Link>
        )}
      </div>
      <DetailWorkUI
        detail={detail}
        aktor={user.id}
        kelola={kelola}
        pelaksanaAktif={pelaksanaAktif}
        pilihan={pilihan}
      />
    </div>
  );
}
