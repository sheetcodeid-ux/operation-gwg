import { CalendarRange } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu, type MenuKey } from "@/lib/nav";
import { daftarArea } from "@/lib/data/daily-outlet";
import { performaMingguan } from "@/lib/data/mingguan-performa";
import { outletMilikPic } from "@/lib/data/kpi";
import { getOutlets } from "@/lib/data/store";
import { persempit } from "@/lib/ops/scope-v1";
import { bulanIniWib, bulanSah } from "@/lib/ops/waktu";
import { PageHeader } from "@/components/ui/page-header";
import { TabelMingguan } from "@/components/operation/tabel-mingguan";

export const metadata: Metadata = { title: "Weekly" };
export const maxDuration = 60;

const MENU = "op_weekly" as MenuKey;

/**
 * WEEKLY PERFORMANCE — grain OUTLET × MINGGU, tanpa target mingguan.
 *
 * Halaman ini MENGGANTIKAN Weekly lama yang berjalan di atas
 * `performaOutlet("mingguan")`. Yang lama menurunkan target mingguan dari
 * target bulanan (`barisHarian`: target ÷ jumlah kolom) dan menampilkan capaian
 * per minggu di atasnya — dan Gate M mengunci bahwa target mingguan tidak ada
 * di GWG. Bukan diperbaiki melainkan diganti: memperbaikinya berarti menyentuh
 * mesin yang juga melayani Monthly, Quarterly, dan Yearly, yang targetnya
 * memang bulanan dan memang sah dijumlahkan.
 *
 * CAKUPANNYA DIBATASI DI SERVER lewat `persempit()` (`src/lib/ops/scope-v1.ts`),
 * sama seperti Daily. Coordinator Area hanya melihat outlet yang ditugaskan
 * kepadanya, dan `?area=` dari peramban diabaikan untuknya. Batasnya harus di
 * sini, bukan di komponen: baris yang cuma disaring di layar tetap terkirim ke
 * peramban, dan siapa pun bisa membacanya dari sana. RLS tidak menolongnya —
 * seluruh tabel V.1 punya RLS aktif tanpa satu policy pun, dan data layer
 * memakai service role yang mem-bypass-nya.
 */
export default async function WeeklyPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; area?: string }>;
}) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, MENU)) redirect("/dashboard");

  const sp = await searchParams;
  const periode = bulanSah(sp.bulan ?? "") ? sp.bulan! : bulanIniWib();

  const area = daftarArea();
  const terkunci = user.role === "area_coordinator";
  // Coordinator Area SELALU areanya sendiri — `?area=` dari peramban diabaikan.
  const dipilih = terkunci ? user.id : area.some((a) => a.value === sp.area) ? sp.area! : "";

  // Permintaan dari layar disaring terhadap cakupan yang SAH, bukan dipercaya.
  // Yang di luar cakupan dibuang tanpa pesan: galat yang menyebut outlet orang
  // lain sudah membocorkan keberadaannya.
  const diminta = dipilih ? [...outletMilikPic(dipilih)] : undefined;
  const cakupan = persempit(user, getOutlets(), diminta);

  const detail = await performaMingguan(periode, cakupan.ids);
  const nama = area.find((a) => a.value === dipilih)?.label;

  return (
    <div className="w-full">
      <PageHeader
        icon={CalendarRange}
        title="Weekly"
        description={
          terkunci
            ? "Performa mingguan outlet yang Anda pegang — tren, bukan pencapaian target"
            : nama
              ? `Performa mingguan outlet area ${nama} — tren, bukan pencapaian target`
              : "Performa mingguan per outlet — tren, bukan pencapaian target"
        }
      />
      <TabelMingguan
        detail={detail}
        area={area}
        areaTerpilih={dipilih}
        bisaPilihArea={!terkunci}
        href="/operational/weekly"
      />
    </div>
  );
}
