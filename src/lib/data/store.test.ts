import { describe, expect, it } from "vitest";
import {
  areaRanking,
  getDashboardKpis,
  getUsers,
  outletRanking,
} from "./store";
import type { UserProfile } from "../types";

const admin = getUsers().find((u) => u.role === "super_admin")! as UserProfile;

describe("dashboard KPIs (global scope)", () => {
  const kpis = getDashboardKpis(admin);

  it("counts all outlets and areas", () => {
    expect(kpis.totalOutlets).toBe(50);
    expect(kpis.totalAreas).toBe(5);
  });

  it("keeps derived scores within 0-100", () => {
    expect(kpis.hospitalityScore).toBeGreaterThanOrEqual(0);
    expect(kpis.hospitalityScore).toBeLessThanOrEqual(100);
    expect(kpis.hygieneScore).toBeGreaterThanOrEqual(0);
    expect(kpis.hygieneScore).toBeLessThanOrEqual(100);
  });

  it("expresses rates as 0-100 percentages", () => {
    expect(kpis.taskCompletionRate).toBeGreaterThanOrEqual(0);
    expect(kpis.taskCompletionRate).toBeLessThanOrEqual(100);
    expect(kpis.eventProgress).toBeGreaterThanOrEqual(0);
    expect(kpis.eventProgress).toBeLessThanOrEqual(100);
  });
});

describe("rankings", () => {
  it("ranks all 50 outlets in descending composite order", () => {
    const rows = outletRanking(admin);
    expect(rows).toHaveLength(50);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].composite).toBeGreaterThanOrEqual(rows[i].composite);
    }
  });

  it("ranks all 5 areas in descending composite order", () => {
    const rows = areaRanking(admin);
    expect(rows).toHaveLength(5);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].composite).toBeGreaterThanOrEqual(rows[i].composite);
    }
  });
});
