import { describe, expect, it } from "vitest";
import { scoreColor, scoreTone } from "./tone";

describe("scoreTone", () => {
  it("bands scores correctly", () => {
    expect(scoreTone(90)).toBe("success");
    expect(scoreTone(75)).toBe("cyan");
    expect(scoreTone(60)).toBe("warning");
    expect(scoreTone(30)).toBe("danger");
  });
});

describe("scoreColor", () => {
  it("maps to traffic-light hexes at the band edges", () => {
    expect(scoreColor(85)).toBe("#22c55e");
    expect(scoreColor(84.9)).toBe("#f59e0b");
    expect(scoreColor(70)).toBe("#f59e0b");
    expect(scoreColor(69.9)).toBe("#ef4444");
  });
});
