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
 * Fire-and-forget by design — the in-memory store is the source of truth for
 * the current request; failures are logged, not surfaced (demo-grade tradeoff).
 */

function fire(table: string, p: PromiseLike<{ error: { message: string } | null }>) {
  // Defer the next DB re-read so this write has time to land before we reload.
  markLocalWrite();
  void Promise.resolve(p).then(({ error }) => {
    if (error) console.error(`[persist] ${table}: ${error.message}`);
  });
}

export const saveTask = (t: WorkTask) => dbEnabled && fire("tasks", db().from("tasks").upsert(taskToRow(t)));
export const deleteTaskRow = (id: string) => dbEnabled && fire("tasks", db().from("tasks").delete().eq("id", id));

export const saveEvent = (e: OpsEvent) => dbEnabled && fire("events", db().from("events").upsert(eventToRow(e)));
export const deleteEventRow = (id: string) => dbEnabled && fire("events", db().from("events").delete().eq("id", id));

export const saveHospitality = (h: HospitalityAssessment) =>
  dbEnabled && fire("hospitality", db().from("hospitality").upsert(hospitalityToRow(h)));

export const saveHygiene = (h: HygieneAudit) => dbEnabled && fire("hygiene", db().from("hygiene").upsert(hygieneToRow(h)));

export const saveComplaint = (c: Complaint) =>
  dbEnabled && fire("complaints", db().from("complaints").upsert(complaintToRow(c)));

export const saveUser = (u: UserProfile) => dbEnabled && fire("users", db().from("users").upsert(userToRow(u)));

export const saveNotification = (n: AppNotification) =>
  dbEnabled && fire("notifications", db().from("notifications").upsert(notificationToRow(n)));

/** Mirror a user's email+password into Supabase Auth (GoTrue) via the
 *  secret-guarded RPC — lets User Management create/reset logins without the
 *  service-role key. */
export const syncAuthUser = (email: string, password: string) =>
  dbEnabled &&
  fire(
    "auth-rpc",
    db().rpc("gwg_upsert_auth_user", {
      p_email: email.toLowerCase(),
      p_password: password,
      p_secret: process.env.GWG_ADMIN_RPC_SECRET ?? "",
    }),
  );

export const saveCredential = (cred: { userId: string; username: string; passwordHash: string }) =>
  dbEnabled &&
  fire(
    "credentials",
    db().from("credentials").upsert({ user_id: cred.userId, username: cred.username, password_hash: cred.passwordHash }),
  );

export const saveArea = (a: import("../types").Area) => dbEnabled && fire("areas", db().from("areas").upsert(areaToRow(a)));
export const saveOutlet = (o: import("../types").Outlet) => dbEnabled && fire("outlets", db().from("outlets").upsert(outletToRow(o)));
