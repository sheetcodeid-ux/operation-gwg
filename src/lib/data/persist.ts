import "server-only";

import { db, dbEnabled } from "./db";
import { markLocalWrite } from "./hydrate";
import {
  areaToRow,
  outletToRow,
  complaintToRow,
  eventToRow,
  hospitalityToRow,
  hygieneToRow,
  notificationToRow,
  taskToRow,
  userToRow,
} from "./rows";
import type {
  AppNotification,
  Complaint,
  HospitalityAssessment,
  HygieneAudit,
  OpsEvent,
  UserProfile,
  WorkTask,
} from "../types";

/**
 * Write-through persistence: every in-memory mutation is mirrored to Supabase.
 * Each `save*` now returns an awaitable result so callers can confirm the write
 * landed (create paths await it and surface failures); non-critical mirrors may
 * still ignore the promise for fire-and-forget behaviour.
 */

export interface PersistResult {
  error: string | null;
}

const OK: PersistResult = { error: null };

/** Thrown by mutations when a create could not be persisted, so the server
 *  action can convert it into a user-facing error instead of a silent success. */
export class PersistError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "PersistError";
  }
}

/** User-facing message for a failed write, safe to return from a server action. */
export function persistMessage(e: unknown): string {
  return e instanceof PersistError
    ? "Gagal menyimpan ke database. Perubahan tidak tersimpan — silakan coba lagi."
    : "Terjadi kesalahan tak terduga.";
}

async function write(table: string, p: PromiseLike<{ error: { message: string } | null }>): Promise<PersistResult> {
  // Defer the next DB re-read so this write has time to land before we reload.
  markLocalWrite();
  const { error } = await p;
  if (error) {
    console.error(`[persist] ${table}: ${error.message}`);
    return { error: error.message };
  }
  return OK;
}

export const saveTask = (t: WorkTask): Promise<PersistResult> =>
  dbEnabled ? write("tasks", db().from("tasks").upsert(taskToRow(t))) : Promise.resolve(OK);
export const deleteTaskRow = (id: string): Promise<PersistResult> =>
  dbEnabled ? write("tasks", db().from("tasks").delete().eq("id", id)) : Promise.resolve(OK);

export const saveEvent = (e: OpsEvent): Promise<PersistResult> =>
  dbEnabled ? write("events", db().from("events").upsert(eventToRow(e))) : Promise.resolve(OK);
export const deleteEventRow = (id: string): Promise<PersistResult> =>
  dbEnabled ? write("events", db().from("events").delete().eq("id", id)) : Promise.resolve(OK);

export const saveHospitality = (h: HospitalityAssessment): Promise<PersistResult> =>
  dbEnabled ? write("hospitality", db().from("hospitality").upsert(hospitalityToRow(h))) : Promise.resolve(OK);
export const deleteHospitalityRow = (id: string): Promise<PersistResult> =>
  dbEnabled ? write("hospitality", db().from("hospitality").delete().eq("id", id)) : Promise.resolve(OK);

export const saveHygiene = (h: HygieneAudit): Promise<PersistResult> =>
  dbEnabled ? write("hygiene", db().from("hygiene").upsert(hygieneToRow(h))) : Promise.resolve(OK);
export const deleteHygieneRow = (id: string): Promise<PersistResult> =>
  dbEnabled ? write("hygiene", db().from("hygiene").delete().eq("id", id)) : Promise.resolve(OK);

export const saveComplaint = (c: Complaint): Promise<PersistResult> =>
  dbEnabled ? write("complaints", db().from("complaints").upsert(complaintToRow(c))) : Promise.resolve(OK);

export const saveUser = (u: UserProfile): Promise<PersistResult> =>
  dbEnabled ? write("users", db().from("users").upsert(userToRow(u))) : Promise.resolve(OK);
export const deleteUserRow = (id: string): Promise<PersistResult> =>
  dbEnabled ? write("users", db().from("users").delete().eq("id", id)) : Promise.resolve(OK);

export const saveNotification = (n: AppNotification): Promise<PersistResult> =>
  dbEnabled ? write("notifications", db().from("notifications").upsert(notificationToRow(n))) : Promise.resolve(OK);

/** Mirror a user's email+password into Supabase Auth (GoTrue) via the
 *  secret-guarded RPC — lets User Management create/reset logins without the
 *  service-role key. */
export const syncAuthUser = (email: string, password: string): Promise<PersistResult> =>
  dbEnabled
    ? write(
        "auth-rpc",
        db().rpc("gwg_upsert_auth_user", {
          p_email: email.toLowerCase(),
          p_password: password,
          p_secret: process.env.GWG_ADMIN_RPC_SECRET ?? "",
        }),
      )
    : Promise.resolve(OK);

export const saveCredential = (cred: { userId: string; username: string; passwordHash: string }): Promise<PersistResult> =>
  dbEnabled
    ? write(
        "credentials",
        db().from("credentials").upsert({ user_id: cred.userId, username: cred.username, password_hash: cred.passwordHash }),
      )
    : Promise.resolve(OK);

export const saveArea = (a: import("../types").Area): Promise<PersistResult> =>
  dbEnabled ? write("areas", db().from("areas").upsert(areaToRow(a))) : Promise.resolve(OK);
export const saveOutlet = (o: import("../types").Outlet): Promise<PersistResult> =>
  dbEnabled ? write("outlets", db().from("outlets").upsert(outletToRow(o))) : Promise.resolve(OK);
