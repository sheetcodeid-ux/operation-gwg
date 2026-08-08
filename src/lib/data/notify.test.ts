import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { REVIEWER_DEPARTMENT, REVIEWER_HREF } from "../hc-request";

/**
 * Notifikasi aktivitas per departemen.
 *
 * Kegagalan di sini bersifat SENYAP: notifikasi tetap tersimpan rapi di basis
 * data, hanya saja tidak pernah sampai ke siapa pun. Tidak ada galat, tidak ada
 * log — orangnya sekadar tidak pernah tahu ada pekerjaan masuk.
 *
 * Dua penyebabnya yang paling mungkin dijaga di sini: nama departemen yang
 * meleset dari `users.department`, dan notifikasi tanpa tautan tujuan.
 */

const NOTIFY = readFileSync(join(process.cwd(), "src/lib/data/notify.ts"), "utf8");
const HC = readFileSync(join(process.cwd(), "src/lib/actions/hc-requests.ts"), "utf8");
const COMPLAINTS = readFileSync(join(process.cwd(), "src/lib/actions/complaints.ts"), "utf8");
const STORE = readFileSync(join(process.cwd(), "src/lib/data/store.ts"), "utf8");
const UI = readFileSync(join(process.cwd(), "src/components/layout/notifications.tsx"), "utf8");
const CHAT = readFileSync(join(process.cwd(), "src/lib/data/chat.ts"), "utf8");
const MENU = readFileSync(join(process.cwd(), "src/lib/data/assessment-menu.ts"), "utf8");
const LAYOUT = readFileSync(join(process.cwd(), "src/app/(app)/layout.tsx"), "utf8");
const SCHEDULE_ACTION = readFileSync(join(process.cwd(), "src/lib/actions/assessment-schedule.ts"), "utf8");

/** Nama departemen yang benar-benar ada di `users.department` (data produksi). */
const DEPARTEMEN_NYATA = [
  "Operational",
  "Creative",
  "Human Capital",
  "Marketing Communication",
  "Finance Accounting Tax",
  "Product Development & Quality",
  "Supply Chain",
  "Business Development",
  "Auditor",
  "Executive Assistant",
  "Production",
];

describe("penerima notifikasi", () => {
  it("nama departemen peninjau cocok dengan users.department", () => {
    // Meleset satu huruf = notifikasinya tersimpan tapi tidak pernah sampai.
    for (const [kind, dept] of Object.entries(REVIEWER_DEPARTMENT)) {
      expect(DEPARTEMEN_NYATA, `${kind} menunjuk departemen "${dept}" yang tidak ada`).toContain(dept);
    }
  });

  it("departemen komplain juga cocok", () => {
    const m = /const OPERATION_DEPARTMENT = "([^"]+)"/.exec(COMPLAINTS);
    expect(m, "OPERATION_DEPARTMENT tidak ditemukan").not.toBeNull();
    expect(DEPARTEMEN_NYATA).toContain(m![1]);
  });

  it("tanpa penerima, notifikasi tidak dibuat sama sekali", () => {
    // Baris tanpa penerima hanya menumpuk di tabel tanpa pernah terlihat.
    expect(NOTIFY).toContain("if (!input.targetUser && !input.department) return;");
  });

  it("kegagalan kirim TIDAK menggagalkan aksi yang memicunya", () => {
    // Pengajuan yang sudah tersimpan tidak boleh dianggap gagal hanya karena
    // notifikasinya tidak terkirim.
    const fn = NOTIFY.slice(NOTIFY.indexOf("export async function notify("));
    expect(fn).toMatch(/try\s*\{/);
    expect(fn).toMatch(/\}\s*catch\s*\{/);
  });
});

describe("pembacaan notifikasi", () => {
  const fn = STORE.slice(
    STORE.indexOf("export async function listNotifications"),
    STORE.indexOf("function byDateDesc"),
  );

  it("membaca jalur perorangan MAUPUN departemen", () => {
    // Melewatkan salah satunya menghilangkan seluruh kelas aktivitas.
    expect(fn).toContain("target_user.eq.");
    expect(fn).toContain("department.eq.");
  });

  it("yang sudah disingkirkan tidak ikut", () => {
    expect(fn).toContain('.eq("dismissed", false)');
  });

  it("departemen kosong tidak dijadikan penyaring", () => {
    // `department.eq.` dengan nilai kosong akan mencocokkan hal yang tidak
    // diinginkan; cabangnya hanya dipasang bila orangnya punya departemen.
    expect(fn).toContain("if (dept) cabang.push(");
  });

  it("notifikasi departemen hanya untuk anggota departemen itu", () => {
    expect(fn).toContain("n.department === dept");
  });
});

describe("aktivitas yang dikirim", () => {
  it("pengajuan baru masuk ke departemen peninjaunya", () => {
    expect(HC).toContain('kind: "request_new"');
    expect(HC).toContain("department: REVIEWER_DEPARTMENT[input.kind]");
  });

  it("setiap tahap pengajuan punya notifikasinya", () => {
    for (const kind of ["request_new", "request_approved", "request_assigned", "request_revision", "request_done", "request_rejected"]) {
      expect(HC, `${kind} belum pernah dikirim`).toContain(`kind: "${kind}"`);
    }
  });

  it("revisi jatuh ke PIC bila ada, ke tim bila belum ditugaskan", () => {
    // Kalau hanya ke PIC, revisi pada pengajuan yang belum ditugaskan akan
    // menggantung tanpa penerima.
    const i = HC.indexOf('kind: "request_revision"');
    const blok = HC.slice(i, i + 400);
    expect(blok).toContain("targetUser: req.assigneeId ?? undefined");
    expect(blok).toContain("department: req.assigneeId ? undefined : REVIEWER_DEPARTMENT.design");
  });

  it("komplain baru dan penerusannya ikut dikirim", () => {
    expect(COMPLAINTS).toContain('kind: "complaint_new"');
    expect(COMPLAINTS).toContain('kind: "complaint_forwarded"');
  });

  it("setiap notifikasi membawa tautan tujuan", () => {
    // Tanpa href, notifikasinya hanya bisa dibaca — orangnya masih harus
    // mencari sendiri hal yang dimaksud.
    for (const src of [HC, COMPLAINTS]) {
      const panggilan = [...src.matchAll(/await notify\(\{[\s\S]*?\n\s*\}\);/g)].map((m) => m[0]);
      expect(panggilan.length).toBeGreaterThan(0);
      for (const p of panggilan) expect(p, `notify() tanpa href:\n${p}`).toContain("href:");
    }
  });

  it("halaman tujuan peninjau menunjuk rute yang ada", () => {
    expect(REVIEWER_HREF.design).toBe("/creative/design");
    expect(REVIEWER_HREF.rekrutmen).toBe("/hc/permintaan");
    expect(REVIEWER_HREF.pelatihan).toBe("/hc/pelatihan");
  });
});

describe("tampilan pusat notifikasi", () => {
  it("tidak ada tombol centang — menandai dibaca terjadi saat dibuka", () => {
    expect(UI).toContain("markNotificationReadAction(n.id)");
    expect(UI).not.toMatch(/CheckCircle|Check\b/);
  });

  it("punya tombol singkirkan per baris", () => {
    expect(UI).toContain("dismissNotificationAction");
    expect(UI).toContain("Singkirkan notifikasi");
  });

  it("tombol singkirkan tidak ikut membuka barisnya", () => {
    // Tombolnya bersarang di dalam baris yang bisa diklik; tanpa ini, menutup
    // satu notifikasi malah membawa orangnya berpindah halaman.
    expect(UI).toContain("e.stopPropagation()");
  });

  it("mengikuti href lebih dulu, outlet hanya cadangan", () => {
    const i = UI.indexOf("if (n.href)");
    const j = UI.indexOf("else if (n.outletId)");
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
  });
});

describe("notifikasi pesan masuk", () => {
  const blok = CHAT.slice(CHAT.indexOf("async function beritahuPesanMasuk"));

  it("hanya perorangan — tidak pernah ke departemen", () => {
    // Isi percakapan milik pesertanya saja. Mengirimkannya ke satu departemen
    // berarti membocorkan cuplikan pesan ke orang di luar percakapan itu.
    expect(blok).toContain("targetUsers: penerima");
    expect(blok).not.toContain("department:");
  });

  it("pengirimnya sendiri tidak ikut dikabari", () => {
    expect(blok).toContain("uid !== input.senderId");
  });

  it("membawa tautan ke percakapannya, bukan sekadar /pesan", () => {
    // Tanpa id percakapan, orangnya mendarat di daftar dan harus mencari
    // sendiri siapa yang mengirim pesan.
    expect(blok).toContain("href: `/pesan?t=${input.threadId}`");
  });

  it("digabung per percakapan, bukan satu baris per pesan", () => {
    // Sepuluh pesan berturut-turut bukan sepuluh kabar; tanpa penggabungan,
    // satu obrolan singkat mendorong seluruh notifikasi lain keluar daftar.
    expect(blok).toContain("notifyCollapsed(");
    expect(NOTIFY).toContain("export async function notifyCollapsed(");
  });

  it("penggabungan tidak menyentuh yang sudah dibaca atau ditutup", () => {
    const fn = NOTIFY.slice(NOTIFY.indexOf("export async function notifyCollapsed("));
    expect(fn).toContain('.eq("read", false)');
    expect(fn).toContain('.eq("dismissed", false)');
  });

  it("percakapan yang dibuka membersihkan notifikasinya", () => {
    // Kalau tidak, lonceng terus bilang "ada pesan baru" untuk percakapan yang
    // barusan dibaca dan angkanya jadi bohong.
    expect(CHAT).toContain("bersihkanNotifPesan(meId, `/pesan?t=${threadId}`)");
    expect(CHAT).toContain("bersihkanNotifPesan(meId)");
  });
});

describe("menu assessment", () => {
  it("bukan menu tetap — disaring di layout, bukan hanya di halamannya", () => {
    // `ROLE_MENUS.member = ["assessment"]` membuat SETIAP akun member
    // memegangnya, dan karena menu itu tinggal di divisi Human Capital, orang
    // Creative melihat divisi HC ikut terbuka di sidebar-nya.
    expect(LAYOUT).toContain("assessmentMenuOpen(user)");
    expect(LAYOUT).toContain('k !== "assessment" || assessmentOpen');
  });

  it("terbuka hanya bila periodenya jalan DAN orangnya ikut", () => {
    // Periode terbuka bukan alasan membuka menu untuk orang yang tidak dinilai
    // dan tidak menilai siapa pun.
    expect(MENU).toContain("canAccessAssessment(akses, schedule)");
    expect(MENU).toContain("roster.some(");
    expect(MENU).toContain("assignments.some(");
  });

  it("penilai inti tetap masuk setelah periodenya tutup", () => {
    // Merekalah yang menjalankan wawancara dan keputusan akhir.
    expect(MENU).toContain("if (isPrivilegedEvaluator(akses)) return true;");
  });

  it("mengubah jadwal langsung terasa di sidebar", () => {
    expect(SCHEDULE_ACTION).toContain("invalidateAssessmentSchedule()");
    expect(SCHEDULE_ACTION).toContain('revalidatePath("/", "layout")');
  });
});
