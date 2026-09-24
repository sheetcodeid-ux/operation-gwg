import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * KONTRAK LAPISAN APLIKASI Z-02 — dijaga dengan membaca kodenya sebagai teks.
 *
 * Yang dijaga di sini BUKAN perilaku melainkan PEMBAGIAN TUGAS, dan hampir
 * seluruhnya tidak bisa ditangkap uji perilaku: penulis yang menyentuh tabel
 * langsung tetap berjalan mulus dan hanya salah menurut kontraknya; salinan
 * kedua mesin status tetap memberi jawaban yang sama hari ini dan baru
 * menyimpang berbulan-bulan kemudian.
 */

const akar = process.cwd();
const baca = (p: string) => readFileSync(join(akar, p), "utf8");
const tanpaKomentar = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const tulis = tanpaKomentar(baca("src/lib/data/work-tulis.ts"));
const bacaWork = tanpaKomentar(baca("src/lib/data/work-baca.ts"));
const aksi = tanpaKomentar(baca("src/lib/actions/work-signal.ts"));

const ENAM = [
  "gwg_buat_work",
  "gwg_kaitkan_signal_work",
  "gwg_lepas_signal_work",
  "gwg_kelola_executor_work",
  "gwg_ubah_work",
  "gwg_ubah_status_work",
];

/* ───────────── seluruh tulisan lewat RPC, tidak ada jalan pintas ───────────── */

describe("penulis Work hanya berbicara lewat enam RPC", () => {
  it("keenamnya dipanggil, dan tidak ada yang ketujuh", () => {
    const dipanggil = [...tulis.matchAll(/"(gwg_\w+)"/g)].map((m) => m[1]);
    expect(new Set(dipanggil)).toEqual(new Set(ENAM));
    expect(dipanggil).toHaveLength(6);
  });

  it("tidak ada mutasi tabel langsung dari lapisan penulis", () => {
    for (const pola of [".insert(", ".update(", ".upsert(", ".delete("]) {
      expect(tulis).not.toContain(pola);
    }
    expect(tulis).not.toMatch(/\.from\(/);
  });

  it("pembaca hanya membaca — tidak satu pun jalan tulis", () => {
    for (const pola of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc("]) {
      expect(bacaWork).not.toContain(pola);
    }
  });

  it("action tidak pernah menyentuh basis data sendiri", () => {
    expect(aksi).not.toContain(".rpc(");
    expect(aksi).not.toMatch(/\bdb\(\)/);
    expect(aksi).not.toContain('from("works")');
  });

  it("Work Z-02 bukan `tasks`", () => {
    for (const src of [tulis, bacaWork, aksi]) {
      expect(src).not.toMatch(/["'`]tasks["'`]/);
    }
  });
});

/* ───────────── aktor tidak pernah datang dari pemanggil ───────────── */

describe("aktor berasal dari sesi, dan hanya dari sesi", () => {
  it("setiap action mengambil `oleh` dari user sesi", () => {
    const dari = [...aksi.matchAll(/oleh:\s*([A-Za-z.]+)/g)].map((m) => m[1]);
    expect(dari.length).toBeGreaterThanOrEqual(2);
    for (const d of dari) expect(["user.id", "k.user.id"]).toContain(d);
  });

  it("id aktor tidak pernah menjadi argumen terakhir yang bebas diisi pemanggil", () => {
    // Tanda tangan penulis diakhiri `oleh`, dan satu-satunya pengisinya sesi.
    for (const panggil of [...aksi.matchAll(/(kaitkanSignalWork|lepasSignalWork|kelolaPelaksanaWork|ubahStatusWork)\(([^)]*)\)/g)]) {
      expect(panggil[2]).toContain("k.user.id");
    }
  });

  it("sesi diperiksa sebelum apa pun — lewat getSessionUser", () => {
    expect(aksi).toContain("await getSessionUser()");
    expect(aksi).toContain('if (!user) return { ok: false, pesan: DITOLAK }');
  });
});

/* ───────────── tidak ada salinan kedua aturan basis data ───────────── */

describe("invariant tidak ditulis ulang di TypeScript", () => {
  it("mesin status tidak disalin sebagai peta transisi", () => {
    for (const src of [tulis, aksi]) {
      expect(src).not.toMatch(/open['"]?\s*(->|→|:|=>)\s*['"]?in_progress/);
      expect(src).not.toMatch(/in_progress['"]?\s*(->|→|:|=>)\s*['"]?completed/);
    }
  });

  it("tenggat tidak dihitung ulang di aplikasi", () => {
    for (const src of [tulis, aksi]) {
      expect(src).not.toContain("Z02-SLA-v1");
      expect(src).not.toMatch(/86[_ ]?400[_ ]?000|OFFSET_WIB_MS|Asia\/Jakarta/);
    }
  });

  it("tidak ada mekanisme menghidupkan kembali yang sudah dilepas", () => {
    for (const src of [tulis, aksi]) {
      expect(src).not.toMatch(/dilepas_pada:\s*null|reaktivasi|aktifkan_kembali/i);
    }
  });

  it("hanya dua arah pengelolaan pelaksana", () => {
    expect(tulis).toContain('"tambah" | "lepas"');
    expect(aksi).toContain('aksi !== "tambah" && aksi !== "lepas"');
  });
});

/* ───────────── galat basis data tidak pernah sampai ke layar ───────────── */

describe("pesan galat dipetakan, bukan diteruskan", () => {
  it("action tidak pernah meneruskan pesan basis data apa adanya", () => {
    expect(aksi).not.toMatch(/pesan:\s*\w+\.message/);
    expect(aksi).not.toMatch(/error\.message/);
  });

  it("setiap kelas kegagalan punya kalimatnya sendiri", () => {
    for (const kelas of [
      "db_mati",
      "tidak_ditemukan",
      "terminal",
      "sudah_dilepas",
      "terakhir",
      "alasan_wajib",
      "transisi_tidak_sah",
      "bukan_owner",
      "benturan_peran",
      "masukan_tidak_sah",
    ]) {
      expect(aksi).toContain(`case "${kelas}":`);
    }
  });
});

/* ───────────── otorisasi diputuskan di satu tempat ───────────── */

describe("gerbang otorisasi terbaca dari satu berkas", () => {
  it("membuat Work menuntut izin Z-02, bukan izin Work Tracker lama", () => {
    expect(aksi).toContain('can(user, "create_signal_work")');
    expect(aksi).not.toContain("create_work_task");
  });

  it("melepas Signal dan membatalkan Work menuntut manage_signals", () => {
    expect(aksi.match(/can\((k\.)?user, "manage_signals"\)/g) ?? []).not.toHaveLength(0);
    const lepas = aksi.slice(aksi.indexOf("export async function lepasSignalWorkAction"));
    expect(lepas.slice(0, 400)).toContain('can(k.user, "manage_signals")');
  });

  it("penyelesaian hanya atas nama Owner", () => {
    expect(aksi).toContain('status === "completed" && !owner');
  });

  it("pembatalan hanya oleh manage_signals", () => {
    expect(aksi).toContain('status === "cancelled" && !kelola');
  });

  it("memulai pekerjaan: Owner, pelaksana aktif, atau manage_signals — dan tidak ada yang keempat", () => {
    expect(aksi).toContain("!owner && !kelola && !k.pelaksanaAktif");
    // Pelaksana yang sudah dilepas tidak boleh ikut: penyaringnya di pembaca.
    expect(bacaWork).toContain('.is("dilepas_pada", null)');
  });

  it("gerbang status tidak pernah memakai outlet maupun persempit()", () => {
    expect(aksi).not.toContain("persempit");
    expect(aksi).not.toMatch(/outlet/i);
  });

  it("layar Command Center tetap menjadi pintu pembuatan Work", () => {
    expect(aksi).toContain("canReachMenu(user, MENU_COMMAND_CENTER)");
  });
});
