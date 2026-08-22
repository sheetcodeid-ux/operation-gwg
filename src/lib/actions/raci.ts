"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { persistMessage } from "@/lib/data/persist";
import { getSuntinganRaci, kembalikanRaci, simpanSelRaci } from "@/lib/data/raci";
import { bolehUbahHc } from "@/lib/hcmos/akses";
import { RACI_ROLES, gabungNama, pecahNama, susunMatriks, type RaciRole } from "@/lib/hcmos/raci";

/**
 * Menyunting matriks RACI.
 *
 * Boleh diubah Human Capital dan super admin — sama seperti modul HC-MOS lain.
 * Matriks ini menentukan siapa yang menanggung apa, jadi hak mengubahnya
 * mengikuti hak atas isinya, bukan hak teknis siapa pun yang bisa membuka
 * halamannya.
 */
async function penyunting() {
  const user = await getSessionUser();
  return bolehUbahHc(user) ? user : null;
}

const peranValid = (v: string): v is RaciRole => (RACI_ROLES as readonly string[]).includes(v);

/** Berapa nama yang masuk akal pada satu sel — pagar terhadap tempelan raksasa. */
const MAX_NAMA = 12;
const MAX_PANJANG_NAMA = 60;

export async function simpanSelRaciAction(input: {
  pilarSlug: string;
  subSlug: string;
  peran: string;
  /** Daftar nama pemegang. Kosong berarti sel ini memang tidak ada pemegangnya. */
  nama: string[];
}): Promise<{ ok?: true; error?: string }> {
  const user = await penyunting();
  if (!user) return { error: "Hanya Human Capital yang boleh menyunting matriks RACI." };
  if (!peranValid(input.peran)) return { error: "Peran RACI tidak dikenal." };

  // Selnya harus benar-benar ada di kerangka Juknis. Tanpa pemeriksaan ini,
  // salah ketik slug akan menyimpan baris yang tidak pernah muncul di layar
  // mana pun — tersimpan rapi, tidak pernah terbaca, dan tidak ada yang tahu.
  const ada = susunMatriks().some((b) => b.pilarSlug === input.pilarSlug && b.subSlug === input.subSlug);
  if (!ada) return { error: "Aktivitas itu tidak ada di kerangka HC-MOS." };

  const nama = (input.nama ?? [])
    .map((n) => String(n).trim().slice(0, MAX_PANJANG_NAMA))
    .filter(Boolean)
    .slice(0, MAX_NAMA);

  try {
    const res = await simpanSelRaci(
      { pilarSlug: input.pilarSlug, subSlug: input.subSlug, peran: input.peran },
      gabungNama(nama),
      user.id,
    );
    if (res.error) return { error: res.error };
    revalidateRaci();
    return { ok: true };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}

/** Mengembalikan satu sel ke susunan Juknis. */
export async function kembalikanSelRaciAction(input: {
  pilarSlug: string;
  subSlug: string;
  peran: string;
}): Promise<{ ok?: true; error?: string }> {
  const user = await penyunting();
  if (!user) return { error: "Hanya Human Capital yang boleh menyunting matriks RACI." };
  if (!peranValid(input.peran)) return { error: "Peran RACI tidak dikenal." };
  try {
    const res = await simpanSelRaci(
      { pilarSlug: input.pilarSlug, subSlug: input.subSlug, peran: input.peran },
      null,
      user.id,
    );
    if (res.error) return { error: res.error };
    revalidateRaci();
    return { ok: true };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}

/**
 * Mengembalikan seluruh matriks — atau satu pilar — ke susunan Juknis.
 *
 * Jumlah sel yang akan hilang dilaporkan balik, bukan sekadar "berhasil":
 * ini tindakan yang menghapus pekerjaan orang, dan yang menekannya berhak tahu
 * seberapa banyak yang barusan terhapus.
 */
export async function kembalikanRaciAction(input: {
  pilarSlug?: string;
}): Promise<{ ok?: true; dikembalikan?: number; error?: string }> {
  const user = await penyunting();
  if (!user) return { error: "Hanya Human Capital yang boleh menyunting matriks RACI." };
  try {
    const sebelum = await getSuntinganRaci();
    const kena = input.pilarSlug ? sebelum.filter((s) => s.pilarSlug === input.pilarSlug) : sebelum;
    if (kena.length === 0) return { ok: true, dikembalikan: 0 };

    const res = await kembalikanRaci(input.pilarSlug);
    if (res.error) return { error: res.error };
    revalidateRaci();
    return { ok: true, dikembalikan: kena.length };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}

/**
 * Mengganti satu nama di SELURUH matriks.
 *
 * Ada karena inilah perubahan yang paling sering terjadi dan paling melelahkan
 * dikerjakan sel per sel: seseorang keluar atau berpindah, dan namanya muncul
 * di belasan aktivitas yang tersebar di beberapa pilar. Mengganti satu per satu
 * hampir selalu menyisakan satu sel yang terlewat, dan sel itu tetap menyebut
 * nama yang sudah tidak memegangnya.
 *
 * Nama kosong berarti nama lamanya DIHAPUS dari semua sel, bukan diganti
 * dengan teks kosong.
 */
export async function gantiNamaRaciAction(input: {
  lama: string;
  baru: string;
}): Promise<{ ok?: true; terganti?: number; error?: string }> {
  const user = await penyunting();
  if (!user) return { error: "Hanya Human Capital yang boleh menyunting matriks RACI." };

  const lama = input.lama.trim();
  const baru = input.baru.trim().slice(0, MAX_PANJANG_NAMA);
  if (!lama) return { error: "Pilih dulu nama yang mau diganti." };
  if (lama === baru) return { ok: true, terganti: 0 };

  try {
    const matriks = susunMatriks(await getSuntinganRaci());
    let terganti = 0;

    for (const b of matriks) {
      for (const peran of RACI_ROLES) {
        const nama = pecahNama(b.raci[peran]);
        if (!nama.includes(lama)) continue;
        const ganti = baru
          ? nama.map((n) => (n === lama ? baru : n))
          : nama.filter((n) => n !== lama);
        const res = await simpanSelRaci(
          { pilarSlug: b.pilarSlug, subSlug: b.subSlug, peran },
          gabungNama(ganti),
          user.id,
        );
        if (res.error) return { error: res.error };
        terganti += 1;
      }
    }

    revalidateRaci();
    return { ok: true, terganti };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}

function revalidateRaci() {
  revalidatePath("/hc-mos/raci");
  revalidatePath("/hc-mos");
}
