import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  NOW,
  aggregateOutlets,
  coordinatorPerformance,
  getUsers,
  hospitalityScoreFor,
  hygieneScoreFor,
  listEvents,
  listTasks,
  outletRanking,
  outletRankingInRange,
  rataAudit,
  reportPeriodCompare,
  skorKomposit,
  urutkanPeringkat,
} from "./store";
import type { Outlet, UserProfile } from "../types";

const admin = getUsers().find((u) => u.role === "super_admin")! as UserProfile;

describe("seed coherence", () => {
  it("every event ends on or after it starts", () => {
    for (const e of listEvents(admin)) {
      expect(+new Date(e.endDate)).toBeGreaterThanOrEqual(+new Date(e.startDate));
    }
  });

  it("events that haven't started yet are 'upcoming'", () => {
    for (const e of listEvents(admin)) {
      if (+new Date(e.startDate) > NOW) expect(e.status).toBe("upcoming");
    }
  });

  it("every task is due on or after it starts", () => {
    for (const t of listTasks(admin)) {
      expect(+new Date(t.dueDate)).toBeGreaterThanOrEqual(+new Date(t.startDate));
    }
  });
});

/**
 * KONTRAK PERINGKAT — bukti audit yang hilang BUKAN skor nol.
 *
 * ┌─ KENAPA KONTRAKNYA DIUJI LEWAT `skorKomposit`, BUKAN `outletRanking` ────┐
 * │                                                                        │
 * │ Kedua generator data contoh (`seed.ts`) menulis hospitality DAN hygiene │
 * │ untuk SETIAP outlet, jadi `outletRanking()` di lingkungan uji tidak     │
 * │ pernah menghasilkan satu baris UNKNOWN pun. Menguji kontraknya hanya    │
 * │ dari situ berarti menguji cabang yang tidak pernah jalan.               │
 * │                                                                        │
 * │ Jadi keduanya dipakai: fungsi murninya untuk membuktikan aturan, dan    │
 * │ data contoh sungguhan untuk membuktikan jalur lengkapnya tidak bergeser.│
 * └────────────────────────────────────────────────────────────────────────┘
 */

const outletPalsu = (nama: string): Outlet => ({ id: nama, name: nama, code: nama, city: "", areaId: "a1", active: true });
const baris = (nama: string, composite: number | null) => ({ outlet: outletPalsu(nama), composite });

describe("peringkat — bukti lengkap tetap berperilaku seperti sebelumnya", () => {
  // D-01
  it("hospitality & hygiene lengkap → composite tetap angka", () => {
    expect(skorKomposit(80, 90, 0)).toBe(76.5);
    expect(skorKomposit(80, 90, 2)).toBe(72.5);
  });

  it("formula existing tidak berubah: 0,45 · 0,45 · penalti 2", () => {
    // 100×0,45 + 100×0,45 − 1×2 = 88
    expect(skorKomposit(100, 100, 1)).toBe(88);
    // penalti komplain tetap 2 per komplain
    expect(skorKomposit(100, 100, 0)! - skorKomposit(100, 100, 1)!).toBe(2);
  });

  // D-01 · jalur lengkap di atas data contoh
  it("seluruh outlet data contoh punya kedua auditnya → composite numerik", () => {
    const rows = outletRanking(admin);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.hospitality).not.toBeNull();
      expect(r.hygiene).not.toBeNull();
      expect(typeof r.composite).toBe("number");
    }
  });

  // D-05
  it("skor yang diketahui tetap urut menurun", () => {
    const rows = outletRanking(admin);
    const diketahui = rows.filter((r): r is typeof r & { composite: number } => r.composite !== null);
    for (let i = 1; i < diketahui.length; i += 1) {
      expect(diketahui[i - 1].composite).toBeGreaterThanOrEqual(diketahui[i].composite);
    }
  });

  // D-06 · tidak ada outlet yang hilang dari layar
  it("setiap outlet yang terlihat tetap muncul sebagai baris", () => {
    const rows = outletRanking(admin);
    const ids = new Set(rows.map((r) => r.outlet.id));
    expect(ids.size).toBe(rows.length);
  });
});

describe("peringkat — bukti audit yang hilang", () => {
  // D-02
  it("hospitality hilang → composite UNKNOWN", () => {
    expect(skorKomposit(null, 90, 0)).toBeNull();
  });

  // D-03
  it("hygiene hilang → composite UNKNOWN", () => {
    expect(skorKomposit(80, null, 0)).toBeNull();
  });

  it("dua-duanya hilang → composite UNKNOWN", () => {
    expect(skorKomposit(null, null, 0)).toBeNull();
  });

  // D-04
  it("bukti hilang TIDAK menjadi nol", () => {
    for (const h of [skorKomposit(null, 90, 0), skorKomposit(80, null, 0), skorKomposit(null, null, 0)]) {
      expect(h).toBeNull();
      expect(h).not.toBe(0);
      expect(h).not.toBe(-0);
    }
  });

  it("nol yang SUNGGUHAN tetap nol — bukan diubah jadi UNKNOWN", () => {
    // Outlet yang benar-benar dinilai 0 pada keduanya tetap punya composite 0.
    expect(skorKomposit(0, 0, 0)).toBe(0);
  });

  it("komplain nol tidak membuat composite UNKNOWN — akumulator yang sah", () => {
    expect(skorKomposit(80, 90, 0)).not.toBeNull();
  });
});

describe("peringkat — UNKNOWN terlihat tapi tidak dibandingkan sebagai angka", () => {
  // D-06 · D-07
  it("UNKNOWN tetap ada di daftar, diletakkan sesudah yang berskor", () => {
    const rows = [baris("B", null), baris("A", 50), baris("D", null), baris("C", 90)];
    const urut = [...rows].sort(urutkanPeringkat);
    expect(urut.map((r) => r.outlet.name)).toEqual(["C", "A", "B", "D"]);
    expect(urut).toHaveLength(4); // tidak satu pun dibuang
  });

  it("UNKNOWN tidak menjadi skor terendah — ia tidak punya skor sama sekali", () => {
    const urut = [baris("kosong", null), baris("minus", -999)].sort(urutkanPeringkat);
    // Yang berskor −999 tetap DI ATAS yang tidak berskor: UNKNOWN bukan
    // "lebih buruk dari angka terkecil", ia bukan angka.
    expect(urut[0].outlet.name).toBe("minus");
    expect(urut[1].composite).toBeNull();
  });

  it("dua UNKNOWN diurut nama, bukan diberi nilai pengganti", () => {
    const urut = [baris("Zulu", null), baris("Alfa", null)].sort(urutkanPeringkat);
    expect(urut.map((r) => r.outlet.name)).toEqual(["Alfa", "Zulu"]);
  });

  // D-07 · source guard
  it("tidak ada coercion skor ke angka di jalur peringkat", () => {
    const src = readFileSync(new URL("./store.ts", import.meta.url), "utf8");
    const kode = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    const peringkat = kode.slice(kode.indexOf("export function outletRanking"));
    for (const pola of [/overallScore\s*\?\?\s*0/, /hygieneScore\s*\?\?\s*0/, /-Infinity/, /Number\.MIN_SAFE_INTEGER/]) {
      expect(peringkat, String(pola)).not.toMatch(pola);
    }
  });
});

describe("peringkat — kedua fungsi bersemantik sama", () => {
  // D-08
  it("outletRanking dan outletRankingInRange memakai satu mesin yang sama", () => {
    const src = readFileSync(new URL("./store.ts", import.meta.url), "utf8");
    const kode = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    // Dua pemanggil skorKomposit + dua pemanggil urutkanPeringkat = dua fungsi
    // peringkat yang tidak bisa menyimpang diam-diam.
    expect(kode.match(/skorKomposit\(/g) ?? []).toHaveLength(3); // 1 definisi + 2 pemakaian
    expect(kode.match(/urutkanPeringkat\)/g) ?? []).toHaveLength(2);
  });

  it("null-ness tiap outlet sama pada kedua fungsi", () => {
    const dasar = outletRanking(admin);
    const ids = dasar.map((r) => r.outlet.id);
    // Jendela sangat lebar supaya seluruh audit ikut — yang dibandingkan
    // KETIADAANNYA, bukan angkanya (yang satu rata-rata jendela, yang lain
    // audit terakhir).
    const rentang = outletRankingInRange(ids, Date.now(), 3_650);
    const petaRentang = new Map(rentang.map((r) => [r.outlet.id, r]));
    expect(rentang).toHaveLength(dasar.length);
    for (const r of dasar) {
      const lain = petaRentang.get(r.outlet.id)!;
      expect(lain.hospitality === null).toBe(r.hospitality === null);
      expect(lain.hygiene === null).toBe(r.hygiene === null);
      expect(lain.composite === null).toBe(r.composite === null);
    }
  });
});

/**
 * KONTRAK SKOR AUDIT DI JALUR REPORT / DETAIL (Gate X).
 *
 * Gate T membereskan jalur peringkat; jalur ini — `/reports`, `/outlets/[id]`,
 * agregat area & koordinator — masih memakai `avg([]) → 0`. Akibatnya satu
 * outlet yang belum diaudit bisa terbaca "Belum ada data" di satu layar dan
 * "0.0" di layar sebelahnya, dan yang membaca 0.0 tidak punya cara tahu bahwa
 * angka itu bukan hasil penilaian.
 *
 * Seperti Gate T: data contoh memberi SETIAP outlet kedua auditnya, jadi jalur
 * UNKNOWN tidak pernah terjadi lewat data itu. Kontraknya diuji pada fungsinya
 * langsung, lalu data contoh dipakai untuk membuktikan jalur lengkapnya tidak
 * bergeser.
 */
describe("rataAudit — kosong berarti belum dinilai", () => {
  it("X-04 · daftar kosong → null, bukan 0", () => {
    expect(rataAudit([])).toBeNull();
  });

  it("X-05 · [0] → 0 — dinilai, dan nilainya nol", () => {
    expect(rataAudit([0])).toBe(0);
    // Yang membedakannya dari X-04 adalah tipe, bukan cuma nilainya.
    expect(rataAudit([0])).not.toBeNull();
  });

  it("X-06 · yang hilang tidak ikut menarik rata-rata turun", () => {
    expect(rataAudit([80, null, 90])).toBe(85);
    expect(rataAudit([80, undefined, 90])).toBe(85);
    // Kalau null diperlakukan sebagai 0, hasilnya akan 56,7.
    expect(rataAudit([80, null, 90])).not.toBe(56.7);
  });

  it("X-07 · seluruhnya hilang → null", () => {
    expect(rataAudit([null, null])).toBeNull();
    expect(rataAudit([undefined, null, undefined])).toBeNull();
  });

  it("nol di antara angka lain tetap ikut dihitung", () => {
    expect(rataAudit([0, 100])).toBe(50);
  });

  it("dibulatkan satu angka di belakang koma, seperti produsen sebelumnya", () => {
    expect(rataAudit([80, 85, 81])).toBe(82);
    expect(rataAudit([1, 2])).toBe(1.5);
  });

  it("nilai tak masuk akal tidak diam-diam menjadi angka", () => {
    expect(rataAudit([Number.NaN])).toBeNull();
    expect(rataAudit([Number.POSITIVE_INFINITY])).toBeNull();
  });
});

describe("produsen skor outlet", () => {
  it("X-01 · tanpa audit hospitality → null", () => {
    // Outlet yang tidak punya satu pun baris audit: persis keadaan outlet baru
    // sebelum kunjungan pertama.
    expect(hospitalityScoreFor("outlet-yang-belum-pernah-diaudit")).toBeNull();
  });

  it("X-02 · tanpa audit hygiene → null", () => {
    expect(hygieneScoreFor("outlet-yang-belum-pernah-diaudit")).toBeNull();
  });

  it("X-03 · outlet yang punya audit tetap berangka", () => {
    // Data contoh mengaudit seluruh outlet, jadi jalur ini yang jalan di sini —
    // dan nilainya tidak boleh berubah gara-gara Gate X.
    for (const r of outletRanking(admin)) {
      expect(typeof hospitalityScoreFor(r.outlet.id), r.outlet.name).toBe("number");
      expect(typeof hygieneScoreFor(r.outlet.id), r.outlet.name).toBe("number");
    }
  });

  it("nol yang sungguh dinilai tidak berubah menjadi null", () => {
    // Pembedanya `=== undefined`/`Number.isFinite`, bukan truthiness. Kalau
    // suatu hari produsen memakai `||`, baris ini yang gagal.
    expect(rataAudit([0, 0])).toBe(0);
  });
});

describe("agregat mengabaikan yang hilang, bukan menghitungnya nol", () => {
  it("X-04b · cakupan tanpa outlet mana pun → null, bukan 0", () => {
    const agg = aggregateOutlets([]);
    expect(agg.hospitality).toBeNull();
    expect(agg.hygiene).toBeNull();
    // Yang memang terhitung tetap angka: nol task adalah nol task.
    expect(agg.tasksTotal).toBe(0);
    expect(agg.complaintsTotal).toBe(0);
  });

  it("cakupan berisi data contoh tetap berangka", () => {
    const ids = outletRanking(admin).map((r) => r.outlet.id);
    const agg = aggregateOutlets(ids);
    expect(typeof agg.hospitality).toBe("number");
    expect(typeof agg.hygiene).toBe("number");
  });

  it("koordinator tanpa audit tidak dilaporkan bernilai nol", () => {
    for (const c of coordinatorPerformance(outletRanking(admin).map((r) => r.outlet.id))) {
      // Di data contoh seluruhnya terukur; yang dijaga: tipenya membolehkan
      // null sehingga pembacanya wajib memeriksa.
      expect(c.hospitality === null || typeof c.hospitality === "number").toBe(true);
      expect(c.complaints).toBeTypeOf("number");
    }
  });

  it("perbandingan periode: delta tidak lahir dari sisi yang tidak terukur", () => {
    const kosong = reportPeriodCompare([]);
    expect(kosong.hospitality.cur).toBeNull();
    expect(kosong.hospitality.prev).toBeNull();
    expect(kosong.hospitality.delta).toBeNull();
    // Jumlah komplain & task tetap angka — nol di sana benar-benar nol.
    expect(kosong.complaintsReceived.cur).toBe(0);
    expect(kosong.tasksCompleted.cur).toBe(0);
  });

  it("cadangan skor periode dipicu ketiadaan bukti, bukan angka nol", () => {
    const src = readFileSync(new URL("./store.ts", import.meta.url), "utf8");
    const kode = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    // `avgWin(...) || hospitalityScoreFor(...)` menganggap skor 0 yang sah
    // sebagai "tidak ada" lalu menggantinya dengan angka periode lain.
    expect(kode).not.toMatch(/avgWin\([^)]*\)\s*\|\|/);
    expect(kode).toMatch(/avgWin\(h, curStart, end\) \?\? hospitalityScoreFor/);
    expect(kode).toMatch(/avgWin\(g, curStart, end\) \?\? hygieneScoreFor/);
    // Produsen skor tidak boleh kembali memakai `avg` yang mengosongkan ke 0.
    expect(kode).toMatch(/function hospitalityScoreFor[\s\S]{0,200}rataAudit\(/);
    expect(kode).toMatch(/function hygieneScoreFor[\s\S]{0,200}rataAudit\(/);
  });
});

describe("composite (regresi Gate T, X-10 & X-11)", () => {
  it("X-10 · satu komponen hilang → composite null", () => {
    expect(skorKomposit(null, 80, 0)).toBeNull();
    expect(skorKomposit(80, null, 0)).toBeNull();
    expect(skorKomposit(null, null, 0)).toBeNull();
  });

  it("X-11 · nol yang dinilai tetap menghasilkan 0, rumus tidak berubah", () => {
    expect(skorKomposit(0, 0, 0)).toBe(0);
    expect(skorKomposit(80, 90, 0)).toBe(76.5); // 80×0,45 + 90×0,45
    expect(skorKomposit(80, 90, 2)).toBe(72.5); // − 2 komplain × 2
  });
});
