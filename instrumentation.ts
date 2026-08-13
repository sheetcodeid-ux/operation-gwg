/**
 * Pencatat galat sisi server.
 *
 * Di build produksi, Next MENYUNTING pesan galat sebelum sampai ke pengguna —
 * yang terlihat hanya "An error occurred in the Server Components render"
 * beserta sebuah `digest`. Isinya memang tidak boleh bocor ke peramban, tapi
 * akibatnya satu-satunya cara mengetahui apa yang sebenarnya salah adalah
 * membaca log platform. Saat log itu tidak bisa diambil, kegagalan produksi
 * jadi mustahil didiagnosis: yang tersisa hanya tebakan.
 *
 * `onRequestError` dipanggil Next dengan galat ASLINYA — pesan, tumpukan, dan
 * digest yang sama dengan yang dilihat pengguna. Disimpan ke tabel sendiri
 * supaya bisa dibaca langsung dari basis data, tanpa bergantung pada ekspor log
 * pihak mana pun.
 *
 * Kegagalan mencatat TIDAK PERNAH menggagalkan permintaannya. Halaman yang
 * sudah telanjur error tidak boleh diperburuk oleh pencatatnya.
 */
export async function onRequestError(
  err: unknown,
  request: { path?: string; method?: string; headers?: Record<string, string | undefined> },
  context: { routerKind?: string; routePath?: string; routeType?: string },
) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Nama variabelnya mengikuti yang sudah dipakai lapisan data — sebagian
    // lingkungan memakai nama lama, dan pencatat yang diam-diam mati karena
    // salah nama variabel adalah kebalikan dari gunanya.
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.GWG_SUPABASE_KEY;
    if (!url || !key) return;

    const e = err as { message?: string; stack?: string; digest?: string };
    const body = [
      {
        digest: e?.digest ?? null,
        // `routePath` adalah pola rutenya ("/pengajuan/design"), `path` adalah
        // URL yang benar-benar diminta. Keduanya disimpan: yang pertama untuk
        // mengelompokkan, yang kedua untuk menelusuri kejadian tunggal.
        path: context?.routePath || request?.path || null,
        method: request?.method ?? null,
        kind: [context?.routerKind, context?.routeType].filter(Boolean).join(" ") || null,
        message: (e?.message ?? String(err)).slice(0, 2000),
        stack: (e?.stack ?? "").slice(0, 8000) || null,
      },
    ];

    await fetch(`${url}/rest/v1/app_errors`, {
      method: "POST",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify(body),
      // Pencatatan tidak boleh menahan respons lebih lama daripada seharusnya.
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Sengaja ditelan — lihat catatan di atas.
  }
}
