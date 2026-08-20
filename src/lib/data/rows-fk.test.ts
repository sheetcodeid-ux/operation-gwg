import { describe, expect, it } from "vitest";

import {
  areaToRow,
  complaintToRow,
  eventToRow,
  hospitalityToRow,
  hygieneToRow,
  notificationToRow,
  outletToRow,
  taskToRow,
} from "./rows";

/**
 * Kolom yang menunjuk ke tabel lain tidak boleh berisi string kosong.
 *
 * Formulir yang membiarkan pilihan cabang kosong menyimpan `''`, bukan `null`.
 * Postgres memperlakukan `''` sebagai nilai sungguhan, mencarinya di tabel
 * tujuan, tidak menemukannya, lalu menolak seluruh penyimpanan. Satu tiket IT
 * Help Desk pernah macet total karena ini.
 */

const KOSONG = "" as unknown as string;

describe("kunci asing tidak menerima string kosong", () => {
  it("tasks: outlet, area, dan pic", () => {
    const row = taskToRow({
      id: "t1",
      title: "Perbaiki akses",
      outletId: KOSONG,
      areaId: KOSONG,
      picId: KOSONG,
    } as never);
    expect(row.outlet_id).toBeNull();
    expect(row.area_id).toBeNull();
    expect(row.pic_id).toBeNull();
  });

  it("outlets: area, supervisor, dan pic", () => {
    const row = outletToRow({ id: "o1", areaId: KOSONG, supervisorId: KOSONG, picId: KOSONG } as never);
    expect(row.area_id).toBeNull();
    expect(row.supervisor_id).toBeNull();
    expect(row.pic_id).toBeNull();
  });

  it("areas: koordinator", () => {
    expect(areaToRow({ id: "a1", coordinatorId: KOSONG } as never).coordinator_id).toBeNull();
  });

  it("hospitality, events, hygiene, complaints, notifications", () => {
    const h = hospitalityToRow({ id: "h1", outletId: KOSONG, areaId: KOSONG, assessorId: KOSONG } as never);
    expect([h.outlet_id, h.area_id, h.assessor_id]).toEqual([null, null, null]);

    const e = eventToRow({ id: "e1", outletId: KOSONG, areaId: KOSONG, picId: KOSONG } as never);
    expect([e.outlet_id, e.area_id, e.pic_id]).toEqual([null, null, null]);

    const y = hygieneToRow({ id: "y1", outletId: KOSONG, areaId: KOSONG } as never);
    expect([y.outlet_id, y.area_id]).toEqual([null, null]);

    const c = complaintToRow({ id: "c1", outletId: KOSONG, areaId: KOSONG } as never);
    expect([c.outlet_id, c.area_id]).toEqual([null, null]);

    const n = notificationToRow({ id: "n1", outletId: KOSONG, areaId: KOSONG } as never);
    expect([n.outlet_id, n.area_id]).toEqual([null, null]);
  });

  it("id yang sah tetap lewat apa adanya", () => {
    const row = taskToRow({ id: "t2", outletId: "out_9", areaId: "area_3", picId: "usr_7" } as never);
    expect([row.outlet_id, row.area_id, row.pic_id]).toEqual(["out_9", "area_3", "usr_7"]);
  });
});
