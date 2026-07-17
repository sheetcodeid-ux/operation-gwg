import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import type { OverheadKind } from "@/lib/hpp/calc";

/**
 * A saved, reusable set of overhead line-items. Applying a template only
 * pre-fills the HPP form — every value stays editable afterwards (data is not
 * locked). Each item keeps its Fixed vs Variable/Operational `kind`.
 */
export interface OverheadTemplateItem {
  name: string;
  monthly: number;
  kind: OverheadKind;
}

export interface OverheadTemplate {
  id: string;
  name: string;
  brand: string | null;
  items: OverheadTemplateItem[];
  createdBy: string | null;
  updatedAt?: string;
}

export interface OverheadTemplateInput {
  name: string;
  brand?: string | null;
  items: OverheadTemplateItem[];
  createdBy?: string | null;
}

const mem = new Map<string, OverheadTemplate>();

const sanitizeItems = (items: OverheadTemplateItem[]): OverheadTemplateItem[] =>
  (items ?? [])
    .filter((it) => it && typeof it.name === "string" && it.name.trim())
    .map((it) => ({
      name: it.name.trim().slice(0, 80),
      monthly: Math.max(0, Math.round(Number(it.monthly) || 0)),
      kind: it.kind === "variable" ? "variable" : "fixed",
    }));

interface Row {
  id: string;
  name: string;
  brand: string | null;
  items: OverheadTemplateItem[] | null;
  created_by: string | null;
  updated_at?: string;
}

const fromRow = (r: Row): OverheadTemplate => ({
  id: r.id,
  name: r.name,
  brand: r.brand,
  items: sanitizeItems(r.items ?? []),
  createdBy: r.created_by,
  updatedAt: r.updated_at,
});

/** All overhead templates (newest first). Never throws. */
export async function listOverheadTemplates(): Promise<OverheadTemplate[]> {
  if (!dbEnabled) return [...mem.values()].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  try {
    const { data } = await db()
      .from("overhead_template")
      .select("id,name,brand,items,created_by,updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    return ((data ?? []) as Row[]).map(fromRow);
  } catch {
    return [];
  }
}

/** Create a new template. Returns the saved record. */
export async function saveOverheadTemplate(input: OverheadTemplateInput): Promise<OverheadTemplate> {
  const name = input.name.trim();
  if (!name) throw new Error("Nama template wajib diisi.");
  const items = sanitizeItems(input.items);
  if (items.length === 0) throw new Error("Template minimal berisi satu biaya overhead.");
  const rec: OverheadTemplate = {
    id: randomUUID(),
    name: name.slice(0, 80),
    brand: input.brand?.trim() || null,
    items,
    createdBy: input.createdBy ?? null,
    updatedAt: new Date().toISOString(),
  };
  if (!dbEnabled) {
    mem.set(rec.id, rec);
    return rec;
  }
  await db().from("overhead_template").insert({
    id: rec.id,
    name: rec.name,
    brand: rec.brand,
    items: rec.items,
    created_by: rec.createdBy,
    updated_at: rec.updatedAt,
  });
  return rec;
}

/** Remove a template. */
export async function deleteOverheadTemplate(id: string): Promise<void> {
  if (!dbEnabled) {
    mem.delete(id);
    return;
  }
  await db().from("overhead_template").delete().eq("id", id);
}
