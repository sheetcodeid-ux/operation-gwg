"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { bolehAturKpi } from "@/lib/kpi/akses";
import { simpanSetelanManajemen } from "@/lib/data/kpi-manajemen";
import { SETELAN_BAWAAN, type SetelanManajemen } from "@/lib/kpi/manajemen";

/**
 * Menyimpan bobot dan target KPI Manajemen.
 *
 * IZINNYA DIPERIKSA DI SINI, bukan hanya di tombolnya. Tombol yang tidak
 * tampil bukan berarti aksinya tidak bisa dipanggil — dan yang diubah aksi ini
 * adalah angka yang menilai seluruh perusahaan.
 */
export async function simpanSetelanManajemenAction(input: SetelanManajemen): Promise<{ error?: string }> {
  const user = await getSessionUser();
  if (!bolehAturKpi(user)) return { error: "Hanya master admin yang boleh mengubah bobot dan target." };

  // Bobot yang tidak berjumlah 100 membuat skor tertinggi ikut bergeser tanpa
  // ada yang menyadarinya — perusahaan tampak gagal padahal pembaginya yang
  // salah. Dijaga di sini supaya tidak bisa tersimpan sama sekali.
  const { a, b, c, d } = input.bobot;
  const total = a + b + c + d;
  if (Math.abs(total - 100) > 0.001) return { error: `Jumlah bobot harus 100, sekarang ${total}.` };

  const wajar = (n: number, min: number, maks: number) => Number.isFinite(n) && n >= min && n <= maks;
  if (![a, b, c, d].every((n) => wajar(n, 0, 100))) return { error: "Bobot harus antara 0 dan 100." };
  if (!wajar(input.pertumbuhan, -100, 500)) return { error: "Pertumbuhan tidak masuk akal." };
  if (!wajar(input.targetMargin, 1, 100)) return { error: "Target margin harus antara 1 dan 100." };
  if (!wajar(input.ambangEbitda, 1, 100)) return { error: "Ambang EBITDA harus antara 1 dan 100." };
  if (!wajar(input.umurSameStore, 0, 60)) return { error: "Umur same store harus antara 0 dan 60 bulan." };

  const res = await simpanSetelanManajemen({
    setelan: {
      bobot: { a, b, c, d },
      pertumbuhan: input.pertumbuhan,
      targetMargin: input.targetMargin,
      ambangEbitda: input.ambangEbitda,
      umurSameStore: input.umurSameStore,
    },
    olehId: user!.id,
    olehNama: user!.name,
  });
  if (!res.error) revalidatePath("/kpi/manajemen");
  return res;
}

/** Nilai bawaan — dipakai tombol "kembalikan ke bawaan" di dialognya. */
export async function setelanBawaanManajemenAction(): Promise<SetelanManajemen> {
  return SETELAN_BAWAAN;
}
