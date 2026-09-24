import { beforeEach, describe, expect, it, vi } from "vitest";
import { can } from "@/lib/rbac";
import type { Role, UserProfile } from "@/lib/types";

/**
 * OTORISASI WORK Z-02 — DIPUTUSKAN DI SERVER, DAN DIUJI DI SINI.
 *
 * ┌─ KENAPA UJI INI BUKAN PELENGKAP ─────────────────────────────────────────┐
 * │                                                                          │
 * │ Basis data menjaga INVARIANT, bukan otorisasi: `gwg_*` berjalan sebagai  │
 * │ service role dan menerima `p_oleh` apa adanya (AD-20 · C · J.1). Artinya │
 * │ satu-satunya yang berdiri antara "siapa pun" dan "Work atas nama orang   │
 * │ lain" adalah berkas yang diuji di sini.                                  │
 * │                                                                          │
 * │ Tombol yang disembunyikan di layar bukan otorisasi — siapa pun bisa      │
 * │ memanggil server action-nya langsung.                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

const st = vi.hoisted(() => ({
  user: null as UserProfile | null,
  work: { ownerId: "u_owner", status: "open", pelaksanaAktif: false },
  bacaGagal: null as "tidak_ditemukan" | "gagal" | null,
  panggilan: [] as { fungsi: string; arg: unknown[] }[],
  gagalTulis: null as string | null,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionUser: async () => st.user }));
vi.mock("@/lib/data/work-baca", () => ({
  ambilWorkUntukAksi: async (id: number) =>
    st.bacaGagal
      ? { ok: false, alasan: st.bacaGagal }
      : { ok: true, work: { id, ownerId: st.work.ownerId, status: st.work.status, pelaksanaAktif: st.work.pelaksanaAktif } },
}));

vi.mock("@/lib/data/work-tulis", () => {
  const catat = (fungsi: string) => async (...arg: unknown[]) => {
    st.panggilan.push({ fungsi, arg });
    return st.gagalTulis ? { ok: false, alasan: st.gagalTulis } : { ok: true, hasil: { id: 1, berubah: true } };
  };
  return {
    buatWork: catat("buatWork"),
    kaitkanSignalWork: catat("kaitkanSignalWork"),
    lepasSignalWork: catat("lepasSignalWork"),
    kelolaPelaksanaWork: catat("kelolaPelaksanaWork"),
    ubahWork: catat("ubahWork"),
    ubahStatusWork: catat("ubahStatusWork"),
  };
});

import {
  buatWorkAction,
  kaitkanSignalWorkAction,
  kelolaPelaksanaWorkAction,
  lepasSignalWorkAction,
  ubahStatusWorkAction,
  ubahWorkAction,
} from "./work-signal";

const orang = (role: Role, id = `usr_${role}`): UserProfile => ({
  id,
  name: role,
  email: `${role}@gwg.test`,
  role,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
});

const MASUKAN = {
  judul: "Perbaiki biaya tenaga kerja",
  deskripsi: "",
  ownerId: "u_owner",
  departemen: "Operational",
  tenggatKategori: "normal",
  signalIds: [1, 2],
  executorIds: ["u_exec1"],
};

beforeEach(() => {
  st.user = null;
  st.work = { ownerId: "u_owner", status: "open", pelaksanaAktif: false };
  st.bacaGagal = null;
  st.panggilan = [];
  st.gagalTulis = null;
});

/* ───────────────────── 1. sesi wajib ada ───────────────────── */

describe("tanpa sesi, tidak ada satu pun tindakan yang jalan", () => {
  it("keenamnya ditolak dan tidak menyentuh basis data", async () => {
    const hasil = [
      await buatWorkAction(MASUKAN),
      await kaitkanSignalWorkAction(1, 2),
      await lepasSignalWorkAction(1, 2, "salah"),
      await kelolaPelaksanaWorkAction(1, "u_exec2", "tambah"),
      await ubahWorkAction(1, { ownerId: "u_owner2", alasan: "cuti" }),
      await ubahStatusWorkAction(1, "in_progress"),
    ];
    for (const h of hasil) expect(h).toEqual({ ok: false, pesan: "Anda tidak memiliki akses untuk tindakan ini." });
    expect(st.panggilan).toHaveLength(0);
  });
});

/* ───────────────────── 2. membuat Work ───────────────────── */

describe("membuat Work menuntut create_signal_work", () => {
  it.each(["super_admin", "head_operation", "area_coordinator"] as Role[])("%s boleh", async (r) => {
    st.user = orang(r);
    const hasil = await buatWorkAction(MASUKAN);
    expect(hasil.ok).toBe(true);
    expect(st.panggilan[0].fungsi).toBe("buatWork");
  });

  it("peran lain ditolak, termasuk pemegang create_work_task", async () => {
    for (const r of ["member", "supervisor", "data_operation", "admin_operation", "legal"] as Role[]) {
      st.user = orang(r);
      st.panggilan = [];
      expect(await buatWorkAction(MASUKAN)).toEqual({ ok: false, pesan: "Anda tidak memiliki akses untuk tindakan ini." });
      expect(st.panggilan).toHaveLength(0);
    }
  });

  it("muatan kosong ditolak sebelum menyentuh basis data", async () => {
    st.user = orang("super_admin");
    const buruk = [
      { ...MASUKAN, judul: "   " },
      { ...MASUKAN, departemen: "" },
      { ...MASUKAN, ownerId: " " },
      { ...MASUKAN, tenggatKategori: "besok" },
      { ...MASUKAN, signalIds: [] },
      { ...MASUKAN, executorIds: [] },
    ];
    for (const m of buruk) {
      st.panggilan = [];
      expect((await buatWorkAction(m)).ok).toBe(false);
      expect(st.panggilan).toHaveLength(0);
    }
  });
});

/* ───────────────────── 3. aktor tidak bisa dipalsukan ───────────────────── */

describe("aktor selalu berasal dari sesi", () => {
  it("`oleh` pada pembuatan adalah id sesi, bukan owner yang dikirim pemanggil", async () => {
    st.user = orang("super_admin", "usr_asli");
    await buatWorkAction({ ...MASUKAN, ownerId: "u_korban" });
    const arg = st.panggilan[0].arg[0] as { oleh: string; owner: string };
    expect(arg.oleh).toBe("usr_asli");
    expect(arg.owner).toBe("u_korban");
  });

  it("kelima action lain meneruskan id sesi sebagai aktor terakhir", async () => {
    st.user = orang("super_admin", "usr_asli");
    st.work.ownerId = "usr_asli";
    await kaitkanSignalWorkAction(1, 2);
    await lepasSignalWorkAction(1, 2, "salah kait");
    await kelolaPelaksanaWorkAction(1, "u_exec2", "tambah");
    await ubahWorkAction(1, { ownerId: "u_owner2", alasan: "cuti panjang" });
    await ubahStatusWorkAction(1, "completed");
    for (const p of st.panggilan) {
      const terakhir = p.arg[p.arg.length - 1];
      const aktor = typeof terakhir === "object" && terakhir !== null ? (terakhir as { oleh: string }).oleh : terakhir;
      expect(aktor).toBe("usr_asli");
    }
  });

  it("tidak ada satu pun action yang menerima id aktor sebagai parameter", () => {
    // Kalau suatu hari ada yang menambahkannya, uji ini yang menolak lebih dulu.
    for (const fn of [kaitkanSignalWorkAction, lepasSignalWorkAction, kelolaPelaksanaWorkAction, ubahStatusWorkAction]) {
      expect(fn.length).toBeLessThanOrEqual(3);
    }
  });
});

/* ───────────────────── 4. kaitan Signal ───────────────────── */

describe("mengaitkan Signal — Owner saat itu atau manage_signals", () => {
  it("Owner boleh walau tanpa manage_signals", async () => {
    st.user = orang("area_coordinator", "u_owner");
    expect((await kaitkanSignalWorkAction(1, 2)).ok).toBe(true);
  });

  it("pemegang manage_signals boleh walau bukan Owner", async () => {
    st.user = orang("head_operation");
    expect((await kaitkanSignalWorkAction(1, 2)).ok).toBe(true);
  });

  it("bukan keduanya → ditolak", async () => {
    st.user = orang("area_coordinator");
    expect(await kaitkanSignalWorkAction(1, 2)).toEqual({ ok: false, pesan: "Anda tidak memiliki akses untuk tindakan ini." });
    expect(st.panggilan).toHaveLength(0);
  });
});

describe("melepas Signal — hanya manage_signals, dan alasan wajib", () => {
  it("Owner tanpa manage_signals TIDAK boleh melepas", async () => {
    st.user = orang("area_coordinator", "u_owner");
    expect((await lepasSignalWorkAction(1, 2, "salah kait")).ok).toBe(false);
    expect(st.panggilan).toHaveLength(0);
  });

  it("alasan kosong ditolak sebelum menyentuh basis data", async () => {
    st.user = orang("super_admin");
    expect(await lepasSignalWorkAction(1, 2, "   ")).toEqual({ ok: false, pesan: "Alasan wajib diisi." });
    expect(st.panggilan).toHaveLength(0);
  });
});

/* ───────────────────── 5. pelaksana ───────────────────── */

describe("mengelola pelaksana — Owner atau manage_signals", () => {
  it("Owner boleh menambah", async () => {
    st.user = orang("area_coordinator", "u_owner");
    expect((await kelolaPelaksanaWorkAction(1, "u_exec2", "tambah")).ok).toBe(true);
  });

  it("orang lain ditolak", async () => {
    st.user = orang("area_coordinator", "u_lain");
    expect((await kelolaPelaksanaWorkAction(1, "u_exec2", "lepas")).ok).toBe(false);
    expect(st.panggilan).toHaveLength(0);
  });

  it("tidak ada arah ketiga selain tambah dan lepas", async () => {
    st.user = orang("super_admin");
    expect((await kelolaPelaksanaWorkAction(1, "u_exec2", "aktifkan" as "tambah")).ok).toBe(false);
    expect(st.panggilan).toHaveLength(0);
  });
});

/* ───────────────────── 6. ubah owner / departemen / tenggat ───────────────────── */

describe("mengubah Work — hanya manage_signals", () => {
  it("Owner sendiri TIDAK boleh memindahkan kepemilikannya", async () => {
    st.user = orang("area_coordinator", "u_owner");
    expect((await ubahWorkAction(1, { ownerId: "u_owner2", alasan: "mau ganti" })).ok).toBe(false);
    expect(st.panggilan).toHaveLength(0);
  });

  it("alasan wajib, dan perubahan kosong ditolak", async () => {
    st.user = orang("super_admin");
    expect(await ubahWorkAction(1, { ownerId: "u_owner2", alasan: "  " })).toEqual({ ok: false, pesan: "Alasan wajib diisi." });
    expect(await ubahWorkAction(1, { alasan: "ada alasan" })).toEqual({ ok: false, pesan: "Tidak ada yang diubah." });
    expect(st.panggilan).toHaveLength(0);
  });

  it("tenggat yang bukan waktu ditolak", async () => {
    st.user = orang("super_admin");
    expect(await ubahWorkAction(1, { tenggat: "besok pagi", alasan: "geser" })).toEqual({ ok: false, pesan: "Tenggat tidak sah." });
  });
});

/* ───────────────────── 7. status ───────────────────── */

describe("mengubah status — tiga gerbang yang berbeda", () => {
  it("penyelesaian hanya oleh Owner, walau pemanggilnya super_admin", async () => {
    st.user = orang("super_admin", "u_bukan_owner");
    expect(await ubahStatusWorkAction(1, "completed")).toEqual({ ok: false, pesan: "Anda tidak memiliki akses untuk tindakan ini." });
    expect(st.panggilan).toHaveLength(0);

    st.user = orang("area_coordinator", "u_owner");
    expect((await ubahStatusWorkAction(1, "completed")).ok).toBe(true);
  });

  it("pembatalan hanya oleh manage_signals, dan wajib beralasan", async () => {
    st.user = orang("area_coordinator", "u_owner");
    expect((await ubahStatusWorkAction(1, "cancelled", "anggaran ditarik")).ok).toBe(false);

    st.user = orang("super_admin");
    expect(await ubahStatusWorkAction(1, "cancelled", "   ")).toEqual({ ok: false, pesan: "Alasan wajib diisi." });
    expect((await ubahStatusWorkAction(1, "cancelled", "anggaran ditarik")).ok).toBe(true);
  });

  it("status di luar empat nilai kontrak ditolak sebelum menyentuh apa pun", async () => {
    st.user = orang("super_admin");
    expect(await ubahStatusWorkAction(1, "blocked")).toEqual({ ok: false, pesan: "Status tidak dikenal." });
    expect(await ubahStatusWorkAction(1, "diagnosing")).toEqual({ ok: false, pesan: "Status tidak dikenal." });
    expect(st.panggilan).toHaveLength(0);
  });
});

/* ───────────────────── 7b. START WORK — gerbang yang dikunci Owner ───────────────────── */

/**
 * `open → in_progress` — Owner ATAU pelaksana aktif ATAU `manage_signals`.
 *
 * ┌─ KENAPA PELAKSANA IKUT, DAN YANG SUDAH DILEPAS TIDAK ────────────────────┐
 * │                                                                          │
 * │ O-05 mengeja `in_progress` sebagai "Executor sudah mulai mengerjakan" —  │
 * │ orang yang mengerjakanlah yang tahu kapan itu terjadi. Tetapi yang sudah │
 * │ dilepas bukan lagi pelaksana: `work-baca.ts` hanya menghitung baris      │
 * │ ber-`dilepas_pada IS NULL`, jadi ia jatuh ke gerbang yang sama dengan    │
 * │ orang lewat.                                                             │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
describe("memulai pekerjaan (open → in_progress)", () => {
  it("S1 · Owner boleh, walau perannya tidak memegang manage_signals", async () => {
    st.user = orang("area_coordinator", "u_owner");
    expect((await ubahStatusWorkAction(1, "in_progress")).ok).toBe(true);
    expect(st.panggilan[0].fungsi).toBe("ubahStatusWork");
  });

  it("S2 · pelaksana aktif boleh, walau perannya paling rendah", async () => {
    st.user = orang("member", "u_exec1");
    st.work.pelaksanaAktif = true;
    expect((await ubahStatusWorkAction(1, "in_progress")).ok).toBe(true);
  });

  it("S3 · pemegang manage_signals boleh, walau bukan keduanya", async () => {
    st.user = orang("head_operation", "u_kelola");
    expect((await ubahStatusWorkAction(1, "in_progress")).ok).toBe(true);
  });

  it("S4 · bukan Owner, bukan pelaksana, tanpa manage_signals → ditolak", async () => {
    st.user = orang("member", "u_orang_lewat");
    expect(await ubahStatusWorkAction(1, "in_progress")).toEqual({
      ok: false,
      pesan: "Anda tidak memiliki akses untuk tindakan ini.",
    });
    expect(st.panggilan).toHaveLength(0);
  });

  it("S5 · pelaksana yang SUDAH DILEPAS ditolak", async () => {
    // `work-baca.ts` menyaring `dilepas_pada IS NULL`, jadi yang sudah dilepas
    // tidak pernah muncul sebagai pelaksana aktif.
    st.user = orang("member", "u_exec_dilepas");
    st.work.pelaksanaAktif = false;
    expect((await ubahStatusWorkAction(1, "in_progress")).ok).toBe(false);
    expect(st.panggilan).toHaveLength(0);
  });

  it("S6 · hanya memegang create_signal_work tidak cukup untuk memulai", async () => {
    st.user = orang("area_coordinator", "u_pembuat");
    expect(can(st.user, "create_signal_work")).toBe(true);
    expect(can(st.user, "manage_signals")).toBe(false);
    expect((await ubahStatusWorkAction(1, "in_progress")).ok).toBe(false);
    expect(st.panggilan).toHaveLength(0);
  });
});

/* ───────────────────── 7c. regresi mesin status ───────────────────── */

/**
 * Mesin statusnya milik basis data (I-22), dan sudah dibuktikan di sana
 * terhadap PostgreSQL sungguhan. Yang diuji di sini penyalurannya: gerbang
 * aplikasi tidak menelan penolakan basis data, dan tidak pula memalsukan
 * keberhasilan.
 */
describe("regresi transisi status", () => {
  it("S7 · open → completed ditolak — gerbangnya lolos, triggernya yang menolak", async () => {
    st.user = orang("area_coordinator", "u_owner");
    st.gagalTulis = "transisi_tidak_sah";
    expect(await ubahStatusWorkAction(1, "completed")).toEqual({
      ok: false,
      pesan: "Perpindahan status itu tidak diizinkan.",
    });
    expect(st.panggilan[0].fungsi).toBe("ubahStatusWork");
  });

  it("S8 · in_progress → completed oleh Owner diterima", async () => {
    st.user = orang("area_coordinator", "u_owner");
    st.work.status = "in_progress";
    expect((await ubahStatusWorkAction(1, "completed")).ok).toBe(true);
  });

  it("S9 · in_progress → completed oleh bukan Owner ditolak sebelum menyentuh basis data", async () => {
    st.user = orang("super_admin", "u_bukan_owner");
    st.work.status = "in_progress";
    expect(await ubahStatusWorkAction(1, "completed")).toEqual({
      ok: false,
      pesan: "Anda tidak memiliki akses untuk tindakan ini.",
    });
    expect(st.panggilan).toHaveLength(0);
  });

  it("S10 · open → cancelled oleh manage_signals dengan alasan diterima", async () => {
    st.user = orang("head_operation");
    expect((await ubahStatusWorkAction(1, "cancelled", "anggaran ditarik")).ok).toBe(true);
    expect(st.panggilan[0].arg).toEqual([1, "cancelled", "anggaran ditarik", "usr_head_operation"]);
  });

  it("S11 · open → cancelled tanpa alasan ditolak", async () => {
    st.user = orang("head_operation");
    expect(await ubahStatusWorkAction(1, "cancelled")).toEqual({ ok: false, pesan: "Alasan wajib diisi." });
    expect(await ubahStatusWorkAction(1, "cancelled", "\n  \t ")).toEqual({ ok: false, pesan: "Alasan wajib diisi." });
    expect(st.panggilan).toHaveLength(0);
  });

  it("S12 · completed → in_progress ditolak basis data, dan penolakannya diteruskan", async () => {
    st.user = orang("super_admin");
    st.work.status = "completed";
    st.gagalTulis = "terminal";
    expect(await ubahStatusWorkAction(1, "in_progress")).toEqual({
      ok: false,
      pesan: "Work sudah selesai atau dibatalkan dan tidak dapat diubah lagi.",
    });
  });

  it("S13 · cancelled → in_progress ditolak basis data, dan penolakannya diteruskan", async () => {
    st.user = orang("super_admin");
    st.work.status = "cancelled";
    st.gagalTulis = "terminal";
    expect(await ubahStatusWorkAction(1, "in_progress")).toEqual({
      ok: false,
      pesan: "Work sudah selesai atau dibatalkan dan tidak dapat diubah lagi.",
    });
  });

  it("status yang sudah sama bukan galat — jawabannya milik basis data (AD-20 · E)", async () => {
    st.user = orang("super_admin");
    st.gagalTulis = null;
    const hasil = await ubahStatusWorkAction(1, "open");
    expect(hasil.ok).toBe(true);
    expect(st.panggilan[0].arg[1]).toBe("open");
  });
});

/* ───────────────────── 8. galat basis data tetap berkuasa ───────────────────── */

describe("invariant basis data tidak pernah dilewati lapisan ini", () => {
  const kelas: [string, string][] = [
    ["benturan_peran", "Pemilik Work tidak boleh sekaligus menjadi pelaksananya."],
    ["terakhir", "Tidak dapat melepas yang terakhir — Work harus tetap punya Signal dan pelaksana."],
    ["terminal", "Work sudah selesai atau dibatalkan dan tidak dapat diubah lagi."],
    ["alasan_wajib", "Perubahan ini membutuhkan alasan."],
    ["sudah_dilepas", "Yang sudah dilepas tidak dapat diaktifkan kembali."],
    ["bukan_owner", "Penyelesaian Work hanya dapat dicatat atas nama pemiliknya."],
    ["transisi_tidak_sah", "Perpindahan status itu tidak diizinkan."],
  ];

  it.each(kelas)("%s diteruskan sebagai kalimat terkendali", async (alasan, pesan) => {
    st.user = orang("super_admin");
    st.gagalTulis = alasan;
    expect(await kelolaPelaksanaWorkAction(1, "u_exec2", "lepas")).toEqual({ ok: false, pesan });
  });

  it("kelas yang tidak dikenal tidak membocorkan apa pun", async () => {
    st.user = orang("super_admin");
    st.gagalTulis = "gagal";
    expect(await kelolaPelaksanaWorkAction(1, "u_exec2", "lepas")).toEqual({ ok: false, pesan: "Gagal menyimpan. Coba lagi." });
  });

  it("Work yang tidak ada berhenti sebelum penulisan", async () => {
    st.user = orang("super_admin");
    st.bacaGagal = "tidak_ditemukan";
    expect(await kaitkanSignalWorkAction(9, 2)).toEqual({ ok: false, pesan: "Work tidak dikenal." });
    expect(st.panggilan).toHaveLength(0);
  });
});
