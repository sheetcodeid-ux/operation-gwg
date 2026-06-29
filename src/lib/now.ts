/**
 * Single source of truth for the demo's "current" time.
 *
 * The whole app — dashboard period ranges, the Work Tracker calendar's initial
 * month, and the default Start/Due dates in the task form — is anchored here so
 * that a newly-created task lands in the same period the views display (instead
 * of drifting into a different month based on the real wall clock).
 *
 * Safe to import from both server and client (no data / server-only deps).
 */
export const DEMO_NOW_ISO = "2026-06-23T23:59:59Z";
export const DEMO_NOW = +new Date(DEMO_NOW_ISO);
