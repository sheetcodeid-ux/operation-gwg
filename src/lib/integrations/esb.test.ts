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

describe("parseIdrNumber", () => {
  it("parses Indonesian formatted numbers", () => {
    expect(parseIdrNumber("31.818,18")).toBeCloseTo(31818.18);
    expect(parseIdrNumber("30.000,00")).toBe(30000);
    expect(parseIdrNumber("1,00")).toBe(1);
  });
});
