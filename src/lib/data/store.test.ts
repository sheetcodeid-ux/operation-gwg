import { describe, expect, it } from "vitest";
import { NOW, getUsers, listEvents, listTasks, outletRanking } from "./store";
import type { UserProfile } from "../types";

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

describe("rankings", () => {
  it("ranks all 50 outlets in descending composite order", () => {
    const rows = outletRanking(admin);
    expect(rows).toHaveLength(50);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].composite).toBeGreaterThanOrEqual(rows[i].composite);
    }
  });
});
