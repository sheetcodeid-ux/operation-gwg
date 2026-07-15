import "server-only";

import { db, dbEnabled } from "./db";

/** Assessment window (jadwal). Both bounds optional: null ⇒ unbounded that side. */
export interface AssessmentSchedule {
  startAt: string | null;
  endAt: string | null;
}

let mem: AssessmentSchedule = { startAt: null, endAt: null };

export async function getAssessmentSchedule(): Promise<AssessmentSchedule> {
  if (!dbEnabled) return mem;
  try {
    const { data } = await db().from("assessment_schedule").select("start_at,end_at").eq("id", 1).maybeSingle();
    return { startAt: data?.start_at ?? null, endAt: data?.end_at ?? null };
  } catch {
    return { startAt: null, endAt: null };
  }
}

export async function setAssessmentSchedule(input: AssessmentSchedule): Promise<void> {
  if (!dbEnabled) {
    mem = { startAt: input.startAt, endAt: input.endAt };
    return;
  }
  await db()
    .from("assessment_schedule")
    .upsert({ id: 1, start_at: input.startAt, end_at: input.endAt, updated_at: new Date().toISOString() });
}
