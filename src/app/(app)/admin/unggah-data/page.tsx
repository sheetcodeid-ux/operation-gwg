import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu, type MenuKey } from "@/lib/nav";
import { listExpenses, listOpOutlets, listPurchases } from "@/lib/data/ops-finance";
import { listPnl } from "@/lib/data/ops-pnl";
import { BEBAN_BARU, BEBAN_BARU_LABELS, EXPENSE_COLS, EXPENSE_LABELS, PNL_LABELS, RINCI_UTILITAS, RINCI_UTILITAS_LABELS } from "@/lib/ops/categories";
import { riwayatBatch } from "@/lib/data/ops-batch";
import { PageHeader } from "@/components/ui/page-header";
import { UnggahData, type BarisAwal } from "@/components/admin/unggah-data";

export const metadata: Metadata = { title: "Unggah Data" };
export const dynamic = "force-dynamic";

const bulanIni = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7);

/**
 * Satu pintu unggah data.
 *
 * Angka yang sama selama ini diketik di beberapa tempat yang tidak saling tahu —
 * laba bersih dan harga pokok di Operation DAN di KPI Coordinator Area,
 * pembelian warehouse di Operation DAN di KPI PDQ. Akibatnya terlihat di basis
 * data: empat dari lima tabel itu kosong, karena orang memilih mengisi satu
 * saja dan sisanya ditinggal.
 *
 * SATU BARIS PER OUTLET, seluruh kolomnya berjajar. Templatenya diunduh sudah
 * terisi: kode dan nama outlet ikut di dalamnya beserta angka yang sudah
 * tersimpan bulan itu — jadi yang mengisi menimpa, bukan mengetik ulang dari
 * nol, dan kode yang salah ketik tidak mungkin lagi jadi baris yang terlewat
 * diam-diam.
 */
export default async function UnggahDataPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "unggah_data" as MenuKey)) redirect("/dashboard");

  const sp = await searchParams;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : bulanIni();

  const [pnl, pembelian, beban, riwayat] = await Promise.all([
    listPnl(month),
    listPurchases(month),
    listExpenses(month),
    riwayatBatch(month),
  ]);

  const pnlPerKode = new Map(pnl.map((r) => [r.outletCode, r]));
  const beliPerKode = new Map(pembelian.map((r) => [r.outletCode, r]));
  const bebanPerKode = new Map(beban.map((r) => [r.outletCode, r]));

  // Seluruh outlet aktif ikut, bukan hanya yang sudah ada isinya: outlet yang
  // belum pernah diisi justru yang paling perlu muncul di template.
  const awal: BarisAwal[] = listOpOutlets().map((o) => {
    const p = pnlPerKode.get(o.code);
    const b = beliPerKode.get(o.code);
    const e = bebanPerKode.get(o.code);
    return {
      kunci: o.code,
      teks: { Outlet: o.name },
      angka: {
        Warehouse: b ? b.warehouse : null,
        "Non Warehouse": b ? b.nonWarehouse : null,
        [PNL_LABELS.hpp]: p ? p.hpp : null,
        ...Object.fromEntries(EXPENSE_COLS.map((c) => [EXPENSE_LABELS[c], e ? e[c] : null])),
        // Enam kolom baru: null tetap null. Baris yang belum pernah dirinci
        // turun ke template sebagai sel kosong, bukan nol — supaya yang
        // mengisinya melihat mana yang memang belum pernah ada.
        ...Object.fromEntries(RINCI_UTILITAS.map((c) => [RINCI_UTILITAS_LABELS[c], e?.[c] ?? null])),
        ...Object.fromEntries(BEBAN_BARU.map((c) => [BEBAN_BARU_LABELS[c], e?.[c] ?? null])),
        [PNL_LABELS.laba_bersih]: p ? p.laba_bersih : null,
      },
    };
  });

  return (
    <div className="w-full">
      <PageHeader title="Unggah Data" />
      <UnggahData month={month} awal={awal} riwayat={riwayat} />
    </div>
  );
}
