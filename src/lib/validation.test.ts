import { describe, expect, it } from "vitest";
import {
  parseInput,
  createUserSchema,
  taskInputSchema,
  complaintInputSchema,
} from "./validation";

describe("parseInput / createUserSchema", () => {
  it("rejects an invalid email", () => {
    const res = parseInput(createUserSchema, {
      name: "A",
      email: "not-an-email",
      role: "data_operation",
      password: "secret1",
      outletIds: [],
    });
    expect("error" in res).toBe(true);
  });

  it("rejects a short password", () => {
    const res = parseInput(createUserSchema, {
      name: "A",
      email: "a@b.co",
      role: "data_operation",
      password: "123",
      outletIds: [],
    });
    expect("error" in res).toBe(true);
  });

  it("rejects an unknown role (enum guard)", () => {
    const res = parseInput(createUserSchema, {
      name: "A",
      email: "a@b.co",
      role: "root",
      password: "secret1",
      outletIds: [],
    });
    expect("error" in res).toBe(true);
  });

  it("accepts and trims a valid payload", () => {
    const res = parseInput(createUserSchema, {
      name: "  Ana  ",
      email: "ANA@GWG.CO",
      role: "area_coordinator",
      password: "secret1",
      outletIds: ["out_1"],
    });
    expect("data" in res && res.data.name).toBe("Ana");
  });
});

describe("taskInputSchema", () => {
  it("rejects out-of-range progress", () => {
    const res = parseInput(taskInputSchema, {
      title: "T",
      priority: "high",
      status: "open",
      division: "data_operation",
      outletId: null,
      progress: 250,
    });
    expect("error" in res).toBe(true);
  });

  it("accepts a null outletId (HQ task)", () => {
    const res = parseInput(taskInputSchema, {
      title: "T",
      priority: "high",
      status: "open",
      division: "data_operation",
      outletId: null,
      progress: 40,
    });
    expect("data" in res).toBe(true);
  });
});

describe("complaintInputSchema", () => {
  it("requires content", () => {
    const res = parseInput(complaintInputSchema, {
      source: "walk_in",
      content: "   ",
      outletId: "out_1",
      category: "service",
      priority: "medium",
    });
    expect("error" in res).toBe(true);
  });
});
