import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

/**
 * Penampung galat sisi PERAMBAN.
 *
 * `onRequestError` (instrumentation.ts) hanya menangkap galat yang terjadi di
 * server. Galat yang terjadi di peramban — gagal memuat potongan kode,
 * penyimpanan lokal yang diblokir, ekstensi yang mengubah halaman, terjemahan
 * otomatis — tidak pernah sampai ke sana. Akibatnya layar "Terjadi kesalahan
 * sistem" di laptop seseorang tidak meninggalkan jejak apa pun untuk ditelusuri,
 * dan satu-satunya cara mendiagnosis adalah menebak.
 *
 * Rute ini menyimpannya ke tabel yang sama dengan galat server, ditandai
 * `kind = "client"`, lengkap dengan alamat halaman dan identitas peramban.
 *
 * Yang TIDAK dikerjakan di sini sama pentingnya:
 *  • Tidak pernah membalas galat. Halaman yang sudah rusak tidak boleh
 *    diperburuk oleh pencatatnya.
 *  • Isi laporan dipangkas dan hanya kolom yang dikenal yang disimpan —
 *    kiriman dari peramban tidak boleh menentukan bentuk barisnya.
 */

const potong = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.GWG_SUPABASE_KEY;
    if (!url || !key) return NextResponse.json({ ok: false });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    // Siapa yang mengalaminya — inilah yang membedakan "satu orang" dari
    // "semua orang", dan itu menentukan arah penelusurannya.
    const user = await getSessionUser().catch(() => null);

    await fetch(`${url}/rest/v1/app_errors`, {
      method: "POST",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify([
        {
          digest: potong(body.digest, 120),
          path: potong(body.path, 500),
          method: "CLIENT",
          kind: potong(body.kind, 80) ?? "client",
          message: potong(body.message, 2000) ?? "(tanpa pesan)",
          // Identitas peramban ikut disimpan di ekor tumpukan: perbedaan
          // perangkat justru yang paling sering menjelaskan mengapa satu orang
          // kena dan yang lain tidak.
          stack: `${potong(body.stack, 6000) ?? ""}\n\nUA: ${potong(req.headers.get("user-agent"), 400) ?? "—"}`,
          user_id: user?.id ?? null,
          user_name: user?.name ?? null,
        },
      ]),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Sengaja ditelan — lihat catatan di atas.
  }
  return NextResponse.json({ ok: true });
}
