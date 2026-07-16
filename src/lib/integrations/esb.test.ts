import { describe, expect, it } from "vitest";
import { extractReportData, parseCancelDetailReport, parseIdrNumber } from "./esb";

// A minimal Krajee grid the way ESB emits it (relevant cells only).
const GRID =
  "\n Showing 1-50 of 272 items.\n" +
  '<table><tbody>\n<tr data-key="0">' +
  '<td data-col-seq="1"><a href="http://x?a=1&amp;b=2">SBNDS1</a></td>' +
  '<td data-col-seq="2">Cattu A. Yani</td><td data-col-seq="3">KOPI SUSU</td>' +
  '<td data-col-seq="10">16-07-2026 12:03:11</td>' +
  '<td data-col-seq="11">Cancel</td><td data-col-seq="12">salah input</td>' +
  '<td data-col-seq="13">1,00</td><td data-col-seq="17">45.000,00</td>' +
  "</tr>\n</tbody></table>";

/** The three body shapes ESB has been observed to return for the SAME report. */
const VALID = JSON.stringify({ code: 200, data: GRID });
// Invalid JSON: literal newlines inside the data string (JSON.parse throws).
const MALFORMED = `{"code":200,"data":"${GRID.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\//g, "\\/")}"}`;
// Double-encoded: the whole (valid) body wrapped once more as a JSON string —
// what production returned on 16-07-2026 ("{\"code\":200,\"data\":\" \\n …").
const DOUBLE = JSON.stringify(VALID);
// Double-encoded around a MALFORMED inner body (worst case).
const DOUBLE_MALFORMED = JSON.stringify(MALFORMED);

describe("extractReportData", () => {
  it.each([
    ["valid JSON", VALID],
    ["malformed JSON (literal newlines)", MALFORMED],
    ["double-encoded", DOUBLE],
    ["double-encoded malformed", DOUBLE_MALFORMED],
  ])("extracts the grid from a %s body", (_name, body) => {
    const data = extractReportData(body);
    expect(data).toContain("Showing 1-50 of 272 items");
    const r = parseCancelDetailReport(data);
    expect(r.totalItems).toBe(272);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      salesNumber: "SBNDS1",
      branch: "Cattu A. Yani",
      menu: "KOPI SUSU",
      voidTime: "16-07-2026 12:03:11",
      type: "Cancel",
      notes: "salah input",
      qty: 1,
      total: 45000,
    });
  });

  it('returns "" for the still-generating response (single & double encoded)', () => {
    expect(extractReportData('{"code":404,"message":"try again later"}')).toBe("");
    expect(extractReportData(JSON.stringify('{"code":404,"message":"try again later"}'))).toBe("");
  });

  it('returns "" for garbage', () => {
    expect(extractReportData("")).toBe("");
    expect(extractReportData("<html>login</html>")).toBe("");
  });
});

describe("parseCancelDetailReport header-aware column mapping", () => {
  it("maps the Cancel/Void grid by its header labels", () => {
    const html =
      " Showing 1-2 of 2 items.\n<table><thead><tr>" +
      '<th data-col-seq="0">#</th><th data-col-seq="1">Sales Number</th><th data-col-seq="2">Branch</th>' +
      '<th data-col-seq="3">Menu</th><th data-col-seq="5">Menu Category</th><th data-col-seq="7">Order By</th>' +
      '<th data-col-seq="8">Order Time</th><th data-col-seq="9">Cancel / Void By</th><th data-col-seq="10">Cancel / Void Time</th>' +
      '<th data-col-seq="11">Cancel / Void</th><th data-col-seq="12">Cancel Notes</th><th data-col-seq="13">Qty</th>' +
      '<th data-col-seq="14">Subtotal</th><th data-col-seq="15">Service Charge</th><th data-col-seq="16">Tax</th>' +
      '<th data-col-seq="17">Total</th></tr></thead><tbody>' +
      '<tr data-key="0"><td data-col-seq="1">SB1</td><td data-col-seq="2">Outlet A</td><td data-col-seq="3">TEH</td>' +
      '<td data-col-seq="9">ANDI</td><td data-col-seq="10">16-07-2026 10:00:00</td><td data-col-seq="11">Void</td>' +
      '<td data-col-seq="12">batal</td><td data-col-seq="13">2,00</td><td data-col-seq="14">20.000,00</td>' +
      '<td data-col-seq="17">22.000,00</td></tr>' +
      "</tbody></table>";
    const r = parseCancelDetailReport(html);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      salesNumber: "SB1", branch: "Outlet A", menu: "TEH",
      voidBy: "ANDI", voidTime: "16-07-2026 10:00:00", type: "Void", notes: "batal",
      qty: 2, subtotal: 20000, total: 22000,
    });
  });

  it("maps the Delete grid (different layout, no Total column) by headers", () => {
    // The Delete export packs different columns into the same seq positions —
    // exactly what shifted qty into "Oleh" and price into "Waktu" before.
    const html =
      " Showing 1-1 of 1 items.\n<table><thead><tr>" +
      '<th data-col-seq="0">#</th><th data-col-seq="1">Sales Number</th><th data-col-seq="2">Branch</th>' +
      '<th data-col-seq="3">Menu</th><th data-col-seq="4">Order By</th><th data-col-seq="5">Deleted By</th>' +
      '<th data-col-seq="6">Deleted Time</th><th data-col-seq="7">Qty</th><th data-col-seq="8">Subtotal</th>' +
      "</tr></thead><tbody>" +
      '<tr data-key="0"><td data-col-seq="1">SB9</td><td data-col-seq="2">Nordu Bakes Samarinda</td>' +
      '<td data-col-seq="3">ROTI</td><td data-col-seq="4">NORDADAMSMRD</td><td data-col-seq="5">BUDI</td>' +
      '<td data-col-seq="6">14-07-2026 11:30:00</td><td data-col-seq="7">25,00</td><td data-col-seq="8">625.000,00</td></tr>' +
      "</tbody></table>";
    const r = parseCancelDetailReport(html);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      salesNumber: "SB9",
      branch: "Nordu Bakes Samarinda",
      menu: "ROTI",
      orderBy: "NORDADAMSMRD",
      voidBy: "BUDI", // who deleted
      voidTime: "14-07-2026 11:30:00",
      qty: 25,
      subtotal: 625000,
      total: 625000, // derived from Subtotal — no Total column in this grid
    });
    // Fields absent from this grid must be empty, never position-guessed.
    expect(r.rows[0].type).toBe("");
    expect(r.rows[0].notes).toBe("");
  });
});

describe("parseCancelDetailReport rowspan grouping", () => {
  it("inherits bill-level columns on continuation rows instead of dropping them", () => {
    // Krajee groups bill columns with rowspan: the 2nd+ item of a bill has NO
    // sales-number/branch/by/time cells. Those rows must inherit, not vanish.
    const html =
      " Showing 1-3 of 3 items.\n<table><thead><tr>" +
      '<th data-col-seq="1">Sales Number</th><th data-col-seq="2">Branch</th><th data-col-seq="3">Menu</th>' +
      '<th data-col-seq="5">Deleted By</th><th data-col-seq="6">Deleted Time</th>' +
      '<th data-col-seq="7">Qty</th><th data-col-seq="8">Subtotal</th>' +
      "</tr></thead><tbody>" +
      '<tr data-key="0"><td data-col-seq="1" rowspan="2">SB1</td><td data-col-seq="2" rowspan="2">Outlet A</td>' +
      '<td data-col-seq="3">KOPI</td><td data-col-seq="5" rowspan="2">BUDI</td><td data-col-seq="6" rowspan="2">01-07-2026 10:00:00</td>' +
      '<td data-col-seq="7">1,00</td><td data-col-seq="8">15.000,00</td></tr>' +
      '<tr data-key="1"><td data-col-seq="3">ROTI</td><td data-col-seq="7">2,00</td><td data-col-seq="8">50.000,00</td></tr>' +
      '<tr data-key="2"><td data-col-seq="1">SB2</td><td data-col-seq="2">Outlet B</td><td data-col-seq="3">TEH</td>' +
      '<td data-col-seq="5">ANI</td><td data-col-seq="6">01-07-2026 11:00:00</td><td data-col-seq="7">1,00</td><td data-col-seq="8">10.000,00</td></tr>' +
      "</tbody></table>";
    const r = parseCancelDetailReport(html);
    expect(r.rows).toHaveLength(3); // continuation row is kept
    expect(r.rows[1]).toMatchObject({
      salesNumber: "SB1", // inherited
      branch: "Outlet A", // inherited
      voidBy: "BUDI", // inherited
      voidTime: "01-07-2026 10:00:00", // inherited
      menu: "ROTI", // own value
      qty: 2,
      total: 50000, // own money — never inherited
    });
    expect(r.rows[2]).toMatchObject({ salesNumber: "SB2", branch: "Outlet B", voidBy: "ANI", menu: "TEH", total: 10000 });
    // Grand total counts every item exactly once.
    expect(r.rows.reduce((a, x) => a + x.total, 0)).toBe(75000);
  });
});

describe("page size detection", () => {
  it("reads rows-per-page from the Showing banner (varies per grid)", () => {
    expect(parseCancelDetailReport(" Showing 1-20 of 716 items.\n<table></table>").pageSize).toBe(20);
    expect(parseCancelDetailReport(" Showing 1-50 of 275 items.\n<table></table>").pageSize).toBe(50);
    expect(parseCancelDetailReport(" Showing 1-1.020 of 2.000 items.\n<table></table>").pageSize).toBe(1020);
  });
});

describe("parseIdrNumber", () => {
  it("parses Indonesian formatted numbers", () => {
    expect(parseIdrNumber("31.818,18")).toBeCloseTo(31818.18);
    expect(parseIdrNumber("30.000,00")).toBe(30000);
    expect(parseIdrNumber("1,00")).toBe(1);
  });
});
