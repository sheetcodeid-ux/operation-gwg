import { Siren } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu, MENU_COMMAND_CENTER } from "@/lib/nav";
import { papanCommandCenter } from "@/lib/data/command-center";
import { workAktifPerSignal } from "@/lib/data/work-daftar";
import { getOutlets } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { persempit } from "@/lib/ops/scope-v1";
import { bulanSah } from "@/lib/ops/waktu";
import { PageHeader } from "@/components/ui/page-header";
import { PapanCommandCenterUI } from "@/components/operation/papan-command-center";

export const metadata: Metadata = { title: "Command Center" };
export const maxDuration = 60;

/**
 * COMMAND CENTER — layar V.1 pertama yang menjawab "apa yang perlu ditangani".
 *
 * ┌─ DUA GERBANG, DAN KEDUANYA DI SERVER ────────────────────────────────────┐
 * │                                                                          │
 * │   canReachMenu()   siapa boleh membuka halaman ini SAMA SEKALI — dan     │
 * │                    sekaligus siapa boleh melihat Signal KORPORAT         │
 * │                    (Z-01 · O10 = B)                                      │
 * │                                                                          │
 * │   persempit()      outlet mana yang boleh dibaca orang ini               │
 * │                                                                          │
 * │ Keduanya TIDAK BISA saling menggantikan. Signal korporat ber-`outlet_id  │
 * │ = NULL`, jadi ia tidak pernah melewati penyaring berbasis outlet — dan   │
 * │ menjadikan `scopeOutlets()` gerbangnya akan membuat korporat lolos ke    │
 * │ siapa pun yang kebetulan tidak dibatasi penugasan (aturan nomor 5 di     │
 * │ `scope-v1.ts`). Yang menahan mereka pintu menu, dan pintu itu dijalankan │
 * │ lebih dulu di sini.                                                      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Halaman ini TIDAK menjalankan detektor, tidak menghitung ulang KPI, dan
 * tidak menyentuh snapshot Signal. Ia hanya membaca — dua tindakan manusia
 * yang tersedia lewat server action punya gerbangnya sendiri.
 */
export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>;
}) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, MENU_COMMAND_CENTER)) redirect("/dashboard");

  const sp = await searchParams;
  // Tanpa `?bulan=`, seluruh periode yang masih terbuka ditampilkan sekaligus
  // (Z-01 Q2): daftar kerja yang memaksa memilih bulan lebih dulu menyembunyikan
  // tunggakan bulan lalu dari orang yang membukanya hari ini.
  const periode = bulanSah(sp.bulan ?? "") ? sp.bulan! : null;

  const cakupan = persempit(user, getOutlets());
  const papan = await papanCommandCenter({
    periode,
    outletIds: cakupan.ids,
    // Gerbangnya sudah lewat di atas. Yang disampaikan ke pembaca HASIL
    // gerbang itu, bukan keputusan baru.
    sertakanKorporat: true,
  });

  // ── GAP-04 · Signal mana yang sudah dikerjakan ──
  //
  // Satu pembacaan balik untuk seluruh Signal yang tergambar. Layar ini TIDAK
  // berubah menjadi halaman kelola Work: yang diturunkan cuma cacah Work yang
  // masih berjalan, dan yang digambar cuma satu lencana per baris.
  //
  // Ia keterangan, bukan gerbang. D3 mengunci N:N, jadi tombol "Buat Work"
  // tetap hidup walau lencananya menyala (OD-STEP8E-01 · OD-STEP8E-04).
  const idSignal = [...papan.kelompok.flatMap((k) => k.outlet.flatMap((o) => o.signal)), ...papan.korporat].map(
    (s) => s.id,
  );
  const workAktif = await workAktifPerSignal(idSignal);

  return (
    <div className="w-full">
      <PageHeader
        icon={Siren}
        title="Command Center"
        description="Signal terbuka yang masih perlu ditangani — indikasi untuk diselidiki, bukan vonis"
      />
      <PapanCommandCenterUI
        papan={papan}
        bolehAbaikan={can(user, "manage_signals")}
        // Pintu Z-02: yang boleh membuat Work dari Signal. Layar ini TIDAK
        // merender formnya dan tidak mengambil satu pun data pilihan — tombolnya
        // hanya berpindah ke `/operational/work?buat=1&signal=<id>`
        // (OD-STEP7-04 = B). Command Center tetap tipis.
        bolehBuatWork={can(user, "create_signal_work")}
        workAktif={workAktif}
      />
    </div>
  );
}
