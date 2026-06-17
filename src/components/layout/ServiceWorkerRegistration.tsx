"use client";

import { useEffect } from "react";

// ============================================================
// Bug #16: Service Worker Registration
// Registers sw.js for PWA offline support and asset caching.
// ============================================================

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.debug("SW registered:", registration.scope);
        })
        .catch((err) => {
          console.debug("SW registration failed:", err);
        });
    }
  }, []);

  return null;
}
