import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PENULIS WORK Z-02 — YANG DIUJI DI SINI PENYALURANNYA, BUKAN ATURANNYA.
 *
 * Aturannya milik `0114`/`0115`/`0116` dan sudah diuji di sana terhadap
 * PostgreSQL sungguhan. Yang bisa salah DI SINI dua hal, dan keduanya tidak
 * akan terlihat dari layar: fungsi yang dipanggil ternyata bukan fungsi yang
 * dimaksud, dan galat basis data yang lolos apa adanya ke pengguna.
 */

const st = vi.hoisted(() => ({
  panggilan: [] as { nama: string; arg: Record<string, unknown> }[],
  jawab: null as unknown,
  galat: null as string | null,
}));

vi.mock("./db", () => ({
  dbEnabled: true,
  db: () => ({
    rpc: async (nama: string, arg: Record<string, unknown>) => {
      st.panggilan.push({ nama, arg });
      if (st.galat) return { data: null, error: { message: st.galat } };
      return { data: st.jawab, error: null };
    },
  }),
}));

import {
  buatWork,
  kaitkanSignalWork,
  kelolaPelaksanaWork,
  klasifikasiGalatWork,
  lepasSignalWork,
  ubahStatusWork,
  ubahWork,
} from "./work-tulis";

beforeEach(() => {
  st.panggilan = [];
  st.galat = null;
  st.jawab = { berubah: true };
});

/* ───────────── setiap penulis memanggil fungsi yang benar ───────────── */

describe("penyaluran RPC", () => {
  it("buat Work → gwg_buat_work, dengan seluruh muatan kontrak", async () => {
    await buatWork({
      judul: "Perbaiki biaya tenaga kerja",
      deskripsi: "catatan",
      owner: "u_owner",
      departemen: "Operational",
      kategori: "normal",
      signalIds: [1, 2],
      executorIds: ["u_exec1"],
      oleh: "u_mgr",
    });
    expect(st.panggilan).toHaveLength(1);
    expect(st.panggilan[0].nama).toBe("gwg_buat_work");
    expect(st.panggilan[0].arg).toEqual({
      p_judul: "Perbaiki biaya tenaga kerja",
      p_deskripsi: "catatan",
      p_owner: "u_owner",
      p_departemen: "Operational",
      p_kategori: "normal",
      p_signal_ids: [1, 2],
      p_executor_ids: ["u_exec1"],
      p_oleh: "u_mgr",
    });
  });

  it("kaitkan → gwg_kaitkan_signal_work", async () => {
    await kaitkanSignalWork(7, 3, "u_mgr");
    expect(st.panggilan[0]).toEqual({ nama: "gwg_kaitkan_signal_work", arg: { p_work_id: 7, p_signal_id: 3, p_oleh: "u_mgr" } });
  });

  it("lepas kaitan → gwg_lepas_signal_work, alasan ikut terkirim", async () => {
    await lepasSignalWork(7, 3, "salah kait", "u_mgr");
    expect(st.panggilan[0]).toEqual({
      nama: "gwg_lepas_signal_work",
      arg: { p_work_id: 7, p_signal_id: 3, p_alasan: "salah kait", p_oleh: "u_mgr" },
    });
  });

  it("pelaksana → gwg_kelola_executor_work, dua arah saja", async () => {
    await kelolaPelaksanaWork(7, "u_exec2", "tambah", "u_mgr");
    await kelolaPelaksanaWork(7, "u_exec2", "lepas", "u_mgr");
    expect(st.panggilan.map((p) => p.nama)).toEqual(["gwg_kelola_executor_work", "gwg_kelola_executor_work"]);
    expect(st.panggilan.map((p) => p.arg.p_aksi)).toEqual(["tambah", "lepas"]);
  });

  it("ubah Work → gwg_ubah_work, null berarti tidak diubah", async () => {
    await ubahWork({ workId: 7, owner: "u_owner2", departemen: null, tenggat: null, alasan: "cuti panjang", oleh: "u_mgr" });
    expect(st.panggilan[0]).toEqual({
      nama: "gwg_ubah_work",
      arg: { p_work_id: 7, p_owner: "u_owner2", p_departemen: null, p_tenggat: null, p_alasan: "cuti panjang", p_oleh: "u_mgr" },
    });
  });

  it("ubah status → gwg_ubah_status_work", async () => {
    await ubahStatusWork(7, "cancelled", "anggaran ditarik", "u_mgr");
    expect(st.panggilan[0]).toEqual({
      nama: "gwg_ubah_status_work",
      arg: { p_work_id: 7, p_status: "cancelled", p_alasan: "anggaran ditarik", p_oleh: "u_mgr" },
    });
  });

  it("keenamnya, dan tidak ada yang ketujuh", async () => {
    await buatWork({ judul: "a", deskripsi: "", owner: "o", departemen: "d", kategori: "low", signalIds: [1], executorIds: ["e"], oleh: "m" });
    await kaitkanSignalWork(1, 1, "m");
    await lepasSignalWork(1, 1, "x", "m");
    await kelolaPelaksanaWork(1, "e", "tambah", "m");
    await ubahWork({ workId: 1, owner: null, departemen: "d", tenggat: null, alasan: "x", oleh: "m" });
    await ubahStatusWork(1, "in_progress", null, "m");
    expect(new Set(st.panggilan.map((p) => p.nama))).toEqual(
      new Set([
        "gwg_buat_work",
        "gwg_kaitkan_signal_work",
        "gwg_lepas_signal_work",
        "gwg_kelola_executor_work",
        "gwg_ubah_work",
        "gwg_ubah_status_work",
      ]),
    );
  });
});

/* ───────────── galat basis data tidak pernah lolos apa adanya ───────────── */

describe("terjemahan galat", () => {
  const contoh: [string, string][] = [
    ["work 9 tidak ditemukan", "tidak_ditemukan"],
    ["work 1 sudah completed — owner, departemen, dan tenggatnya tidak boleh diubah lagi", "terminal"],
    ["work 1 sudah cancelled dan tidak dapat dibuka kembali", "terminal"],
    ["kaitan signal 2 dengan work 1 pernah dilepas dan tidak dapat dikaitkan ulang", "sudah_dilepas"],
    ["pelepasan pelaksana u_a pada work 1 sudah tercatat dan tidak boleh diubah maupun ditarik kembali", "sudah_dilepas"],
    ["kaitan signal terakhir work 1 tidak boleh dilepas — work selalu berasal dari signal", "terakhir"],
    ["pelaksana terakhir work 1 tidak boleh dilepas", "terakhir"],
    ["transisi status work 1 dari open ke completed tidak sah", "transisi_tidak_sah"],
    ["penyelesaian work 1 hanya tercatat atas nama ownernya (u_o), bukan u_m", "bukan_owner"],
    ["owner work 1 tidak boleh sekaligus menjadi pelaksananya", "benturan_peran"],
    ["owner baru u_e masih menjadi pelaksana aktif work 1", "benturan_peran"],
    ["pembatalan work 1 wajib beralasan", "alasan_wajib"],
    ["perubahan status work 1 wajib disertai riwayat status pada transaksi yang sama", "alasan_wajib"],
    ["kategori tenggat besok tidak dikenal kebijakan Z02-SLA-v1", "masukan_tidak_sah"],
    ["judul work wajib diisi", "masukan_tidak_sah"],
    ["kalimat yang belum pernah ada di migrasi mana pun", "gagal"],
  ];

  it.each(contoh)("%s → %s", (pesan, kelas) => {
    expect(klasifikasiGalatWork(pesan)).toBe(kelas);
  });

  it("galat RPC menjadi kelas, bukan kalimat basis data", async () => {
    st.galat = "pelaksana terakhir work 1 tidak boleh dilepas — pekerjaan tanpa pelaksana tidak akan pernah dikerjakan";
    const hasil = await kelolaPelaksanaWork(1, "u_exec1", "lepas", "u_mgr");
    expect(hasil).toEqual({ ok: false, alasan: "terakhir" });
    expect(JSON.stringify(hasil)).not.toContain("pekerjaan tanpa pelaksana");
  });
});
