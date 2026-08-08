"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { setAssessmentSchedule, type AssessmentSchedule } from "@/lib/data/assessment-schedule";
import { invalidateAssessmentSchedule } from "@/lib/data/assessment-menu";

/** Only Super Admin (Director/HR admin) may set the assessment window. */
export async function saveAssessmentScheduleAction(input: AssessmentSchedule) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "super_admin") return { error: "Not authorized" };
  // Basic sanity: end must be after start when both are set.
  if (input.startAt && input.endAt && Date.parse(input.endAt) <= Date.parse(input.startAt)) {
    return { error: "Waktu selesai harus setelah waktu mulai." };
  }
  try {
    await setAssessmentSchedule({ startAt: input.startAt || null, endAt: input.endAt || null });
    // Jadwal menentukan apakah menu Assessment muncul di sidebar — cache-nya
    // harus dibuang, kalau tidak perubahan baru terasa sampai satu menit.
    invalidateAssessmentSchedule();
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan jadwal." };
  }
}
