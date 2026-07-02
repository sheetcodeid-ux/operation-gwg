import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes fields and joins with CRLF", () => {
    const csv = toCsv(["Name", "Score"], [["Andi", 91.5]]);
    expect(csv).toBe('"Name","Score"\r\n"Andi","91.5"');
  });

  it("escapes embedded quotes and keeps commas safe", () => {
    const csv = toCsv(["Complaint"], [['Kata "kasar", pelayanan lambat']]);
    expect(csv).toBe('"Complaint"\r\n"Kata ""kasar"", pelayanan lambat"');
  });

  it("renders null/undefined as empty strings", () => {
    const csv = toCsv(["A", "B"], [[null, undefined]]);
    expect(csv).toBe('"A","B"\r\n"",""');
  });
});
