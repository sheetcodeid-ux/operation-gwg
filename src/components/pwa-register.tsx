"use client";

import { useEffect } from "react";

/** Registers the service worker so the app is installable as a PWA, and reloads
 *  once when a NEW worker takes control so an updated build never leaves a stale
 *  (white-screen) shell running on supervisors' installed apps. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // Only auto-reload on an UPDATE (a controller already exists), never on the
    // first-ever install — and only once, to avoid reload loops.
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing || !hadController) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        // Proactively check for a newer worker on each load.
        reg.update?.().catch(() => {});
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          sw?.addEventListener("statechange", () => {
            // A new worker finished installing while one already controls the
            // page → activate it immediately.
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              sw.postMessage?.("skip-waiting");
            }
          });
        });
      } catch {
        /* ignore */
      }
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);
  return null;
}
