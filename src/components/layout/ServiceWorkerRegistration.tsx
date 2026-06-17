"use client";

import { useEffect } from "react";

// ============================================================
// Bug #16: Service Worker Registration
// Registers sw.js for PWA offline support and asset caching.
// In development mode, we unregister the service worker to prevent
// cache poisoning and hydration mismatch errors on localhost.
// ============================================================

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().then((success) => {
              if (success) {
                console.debug("Successfully unregistered service worker in development mode.");
              }
            });
          }
        });
      }
      // Clear all Cache Storage keys in development mode
      if (typeof window !== "undefined" && "caches" in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            caches.delete(key).then((success) => {
              if (success) {
                console.debug(`Deleted Cache Storage key: ${key}`);
              }
            });
          });
        });
      }
      return;
    }

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
