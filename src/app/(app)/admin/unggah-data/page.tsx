import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu, type MenuKey } from "@/lib/nav";
import { listExpenses, listOpOutlets, listPurchases } from "@/lib/data/ops-finance";
import { listPnl } from "@/lib/data/ops-pnl";
import { listIngredients } from "@/lib/data/hpp-ingredients";
import { GOLONGAN_LABEL } from "@/lib/hpp/golongan";
import { EXPENSE_COLS, EXPENSE_LABELS, PNL_COLS, PNL_LABELS } from "@/lib/ops/categories";
import type { JenisUnggah } from "@/lib/ops/template-unggah";
import { PageHeader } from "@/components/ui/page-header";
import { UnggahData, type BarisAwal } from "@/components/admin/unggah-data";

export const metadata: Metadata = { title: "Unggah Data" };
export const dynamic = "force-dynamic";

const bulanIni = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7);

/**
 * Satu pintu unggah data.
 *
 * Angka yang sama selama ini diketik di dua tempat yang tidak saling tahu —
 * laba bersih dan harga pokok di Operation DAN di KPI Coordinator Area,
 * pembelian warehouse di Operation DAN di KPI PDQ. Akibatnya terlihat di basis
 * data: empat dari lima tabel itu kosong, karena orang memilih mengisi satu
 * saja dan sisanya ditinggal.
 *
 * TEMPLATENYA DIUNDUH SUDAH TERISI. Kode dan nama outlet ikut di dalamnya,
 * beserta angka yang sudah tersimpan bulan itu — jadi yang mengisi menimpa,
 * bukan mengetik ulang dari nol, dan kode yang salah ketik tidak mungkin lagi
 * jadi baris yang terlewat diam-diam.
 */
export default async function UnggahDataPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "unggah_data" as MenuKey)) redirect("/dashboard");

  const sp = await searchParams;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : bulanIni();

  const [pnl, pembelian, beban, bahan] = await Promise.all([
    listPnl(month),
    listPurchases(month),
    listExpenses(month),
    listIngredients(),
  ]);

  const outlet = listOpOutlets();
  const pnlPerKode = new Map(pnl.map((r) => [r.outletCode, r]));
  const beliPerKode = new Map(pembelian.map((r) => [r.outletCode, r]));
  const bebanPerKode = new Map(beban.map((r) => [r.outletCode, r]));

  // Seluruh outlet aktif ikut, bukan hanya yang sudah ada isinya: outlet yang
  // belum pernah diisi justru yang paling perlu muncul di template.
  const awal: Record<JenisUnggah, BarisAwal[]> = {
    laba_rugi: outlet.map((o) => {
      const r = pnlPerKode.get(o.code);
      return {
        kunci: o.code,
        teks: { Outlet: o.name },
        angka: Object.fromEntries(PNL_COLS.map((c) => [PNL_LABELS[c], r ? r[c] : null])),
      };
    }),
    pembelian: outlet.map((o) => {
      const r = beliPerKode.get(o.code);
      return {
        kunci: o.code,
        teks: { Outlet: o.name },
        angka: { Warehouse: r ? r.warehouse : null, "Non Warehouse": r ? r.nonWarehouse : null },
      };
    }),
    beban: outlet.map((o) => {
      const r = bebanPerKode.get(o.code);
      return {
        kunci: o.code,
        teks: { Outlet: o.name },
        angka: Object.fromEntries(EXPENSE_COLS.map((c) => [EXPENSE_LABELS[c], r ? r[c] : null])),
      };
    }),
    bahan_baku: bahan.map((i) => ({
      kunci: i.name,
      teks: {
        ID: i.id,
        Satuan: i.buyUnit,
        "Satuan Pakai": i.contentUnit || i.buyUnit,
        Golongan: GOLONGAN_LABEL[i.golongan],
        Wilayah: i.region ?? "",
      },
      angka: { "Harga Beli": Math.round(i.buyPrice), Qty: i.buyQty, Isi: i.contentQty || 1 },
    })),
  };

  return (
    <div className="w-full">
      <PageHeader title="Unggah Data" />
      <UnggahData month={month} awal={awal} />
    </div>
  );
}
