import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu, type MenuKey } from "@/lib/nav";
import { daftarArea } from "@/lib/data/daily-outlet";
import { performaOutlet } from "@/lib/data/performa-outlet";
import { outletMilikPic } from "@/lib/data/kpi";
import { jendela, NAMA_SKALA, TAHUN_TAMPIL, type Skala } from "@/lib/ops/periode";
import { PageHeader } from "@/components/ui/page-header";
import { TabelHarian } from "@/components/operation/tabel-harian";

/**
 * SATU HALAMAN UNTUK EMPAT SKALA — Weekly, Monthly, Quarterly, Yearly.
 *
 * Keempatnya berbeda hanya pada satu kata: skalanya. Menuliskannya empat kali
 * berarti empat halaman yang harus diubah bersamaan setiap kali ada perbaikan,
 * dan yang terlewat satu akan berbeda diam-diam — persis jenis perbedaan yang
 * paling lama tidak ketahuan, karena keempatnya jarang dibuka berdampingan.
 *
 * CAKUPANNYA DIBATASI DI SERVER, sama seperti Daily: Coordinator Area hanya
 * melihat outletnya sendiri, dan `?area=` dari peramban diabaikan untuknya.
 * Baris yang cuma disaring di layar tetap terkirim ke peramban.
 */

const WIB = () => new Date(Date.now() + 7 * 3_600_000);

/** Acuan bawaan: bulan berjalan untuk mingguan, tahun berjalan untuk sisanya. */
function acuanBawaan(skala: Skala): string {
  const k = WIB();
  return skala === "mingguan" ? k.toISOString().slice(0, 7) : String(k.getUTCFullYear());
}

/** Acuan dari alamat, kalau bentuknya benar. "?bulan=besok" diabaikan. */
function acuanDari(skala: Skala, nilai: string | undefined): string {
  const pola = skala === "mingguan" ? /^\d{4}-\d{2}$/ : /^\d{4}$/;
  return nilai && pola.test(nilai) ? nilai : acuanBawaan(skala);
}

export interface PropsPerforma {
  skala: Exclude<Skala, "harian">;
  menu: MenuKey;
  href: string;
  ikon: React.ComponentType<{ className?: string }>;
  /** Kalimat di bawah judul, tanpa keterangan area. */
  keterangan: string;
}

export async function HalamanPerforma({
  props,
  searchParams,
}: {
  props: PropsPerforma;
  searchParams: Promise<{ bulan?: string; tahun?: string; area?: string }>;
}) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, props.menu)) redirect("/dashboard");

  const sp = await searchParams;
  const param = props.skala === "mingguan" ? "bulan" : "tahun";
  const acuan = acuanDari(props.skala, param === "bulan" ? sp.bulan : sp.tahun);

  const area = daftarArea();
  const terkunci = user.role === "area_coordinator";
  const dipilih = terkunci ? user.id : area.some((a) => a.value === sp.area) ? sp.area! : "";

  const detail = await performaOutlet(props.skala, acuan, dipilih ? [...outletMilikPic(dipilih)] : undefined);
  const j = jendela(props.skala, acuan);
  const nama = area.find((a) => a.value === dipilih)?.label;
  const s = NAMA_SKALA[props.skala];

  return (
    <div className="w-full">
      <PageHeader
        icon={props.ikon}
        title={s.menu}
        description={
          terkunci
            ? `${props.keterangan} outlet yang Anda pegang — dari ESB`
            : nama
              ? `${props.keterangan} outlet area ${nama} — dari ESB`
              : `${props.keterangan} per outlet — dari ESB`
        }
      />
      <TabelHarian
        detail={detail}
        area={area}
        areaTerpilih={dipilih}
        bisaPilihArea={!terkunci}
        nav={{
          judul: j.judul,
          judulPendek: j.judulPendek,
          sebelum: j.sebelum,
          sesudah: j.sesudah,
          param,
          href: props.href,
        }}
        labelAgregat={s.agregat}
        satuan={s.satuan}
        // Setahun ke atas angkanya belasan miliar — tidak muat penuh di kolom
        // yang dilebarkan untuk total sebulan.
        ringkas={props.skala !== "mingguan"}
        labelBanding={
          props.skala === "tahunan"
            ? `vs ${TAHUN_TAMPIL} tahun sebelumnya`
            : `vs ${s.satuan} sama periode lalu`
        }
      />
    </div>
  );
}
