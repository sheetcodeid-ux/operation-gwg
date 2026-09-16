"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getOutlet, getUser, getUsers } from "@/lib/data/store";
import { updateUser } from "@/lib/data/user-mutations";
import { saveOutlet } from "@/lib/data/persist";
import { bidangOrang, bolehPunyaWilayah } from "@/lib/ops/bidang";
import { persistMessage } from "@/lib/data/persist";

/**
 * MANAJEMEN OUTLET — pemilik dan coordinator areanya.
 *
 * Data outletnya sendiri sudah ada sejak lama (nama, kode, cabang ESB, tanggal
 * buka). Yang belum punya tempat justru dua hal yang paling sering ditanyakan
 * tentang sebuah outlet: siapa yang memilikinya, dan siapa yang memegangnya.
 *
 * KEDUANYA DISIMPAN DI TEMPAT YANG BERBEDA, dan itu disengaja:
 *
 *  – PEMILIK menempel pada outlet (`outlets.owner`), berupa teks. Pemilik belum
 *    tentu punya akun, dan sebagian memang tidak akan pernah punya.
 *
 *  – COORDINATOR AREA menempel pada ORANGNYA (`users.outlet_ids`), tempat ia
 *    sudah tersimpan sejak dulu. Menyalinnya ke kolom di tabel outlet membuat
 *    dua tempat yang harus selalu sepakat — dan yang pertama kali tidak sepakat
 *    adalah yang tidak pernah ketahuan. Jadi yang dilakukan halaman ini bukan
 *    menyimpan ulang, melainkan MEMINDAHKAN outlet itu dari daftar coordinator
 *    lama ke daftar coordinator baru.
 */

export interface HasilSimpanOutlet {
  ok: boolean;
  error?: string;
}

export interface SimpanOutletInput {
  id: string;
  /** Nama pemilik. Kosong berarti dikosongkan. */
  owner: string;
  /** Id coordinator area yang memegangnya. Kosong = tidak dipegang siapa pun. */
  coordinatorId: string;
  /** Id orang Finance yang memegang wilayah ini. Kosong = tidak dipegang. */
  financeId?: string;
  /** Id orang Marketing yang memegang wilayah ini. Kosong = tidak dipegang. */
  marketingId?: string;
}

/**
 * TIGA WILAYAH DI ATAS SATU OUTLET, dan ketiganya berdiri sendiri.
 *
 * Satu outlet dipegang seorang Coordinator Area, seorang Finance, dan seorang
 * Marketing sekaligus — tiga orang yang memantau outlet yang sama dari tiga
 * sudut. Yang tidak boleh dua-duanya justru dua orang dari BIDANG yang sama.
 */
const BIDANG_FINANCE = "Finance V.1";
const BIDANG_MARKETING = "Marketing V.1";

export async function simpanOutletAction(input: SimpanOutletInput): Promise<HasilSimpanOutlet> {
  const admin = await getSessionUser();
  if (!admin || !can(admin, "manage_users")) return { ok: false, error: "Tidak berwenang." };

  const outlet = getOutlet(input.id);
  if (!outlet) return { ok: false, error: "Outlet tidak ditemukan." };

  const coordinatorId = input.coordinatorId.trim();
  if (coordinatorId) {
    const c = getUser(coordinatorId);
    if (!c) return { ok: false, error: "Coordinator area tidak ditemukan." };
    if (c.role !== "area_coordinator") return { ok: false, error: `${c.name} bukan Coordinator Area.` };
    if (c.active === false) return { ok: false, error: `${c.name} sudah tidak aktif.` };
  }

  const financeId = (input.financeId ?? "").trim();
  const marketingId = (input.marketingId ?? "").trim();
  for (const [id, bidang] of [
    [financeId, BIDANG_FINANCE],
    [marketingId, BIDANG_MARKETING],
  ] as const) {
    if (!id) continue;
    const u = getUser(id);
    if (!u) return { ok: false, error: "Pemegang wilayah tidak ditemukan." };
    if (bidangOrang(u) !== bidang) return { ok: false, error: `${u.name} bukan orang ${bidang}.` };
    if (!bolehPunyaWilayah(u))
      return { ok: false, error: `${u.name} belum berjabatan pemegang wilayah (East/West).` };
    if (u.active === false) return { ok: false, error: `${u.name} sudah tidak aktif.` };
  }

  try {
    const owner = input.owner.trim();
    outlet.owner = owner || null;
    await saveOutlet(outlet);

    // SATU OUTLET HANYA PUNYA SATU COORDINATOR. Dicabut dulu dari siapa pun
    // yang memegangnya sekarang — kalau tidak, outlet yang dipindah akan
    // muncul di dua daftar dan penjualannya terhitung dua kali di halaman
    // Daily saat kedua coordinator dibuka.
    //
    // Aturan yang sama dipakai tiga kali, sekali per lingkup. Ditulis sebagai
    // satu fungsi, bukan tiga salinan: yang ketiga selalu yang tertinggal saat
    // yang pertama diperbaiki.
    const pindahkan = (milik: (u: ReturnType<typeof getUsers>[number]) => boolean, kepada: string) => {
      for (const u of getUsers()) {
        if (!milik(u)) continue;
        const punya = (u.outletIds ?? []).includes(outlet.id);
        const seharusnya = u.id === kepada;
        if (punya === seharusnya) continue;
        updateUser(u.id, {
          outletIds: seharusnya
            ? [...(u.outletIds ?? []), outlet.id]
            : (u.outletIds ?? []).filter((x) => x !== outlet.id),
        });
      }
    };

    // Coordinator Area yang KEBETULAN berdepartemen Finance tetap dihitung
    // sebagai coordinator saja — kalau tidak, satu orang akan dicabut dari
    // daftarnya sendiri oleh lingkup sebelahnya.
    pindahkan((u) => u.role === "area_coordinator" && !bidangOrang(u), coordinatorId);
    pindahkan((u) => u.role !== "area_coordinator" && bidangOrang(u) === BIDANG_FINANCE, financeId);
    pindahkan((u) => u.role !== "area_coordinator" && bidangOrang(u) === BIDANG_MARKETING, marketingId);
  } catch (e) {
    return { ok: false, error: persistMessage(e) };
  }

  revalidatePath("/admin/outlets");
  revalidatePath("/operational/daily");
  revalidatePath("/finance/daily");
  revalidatePath("/marketing/daily");
  return { ok: true };
}
