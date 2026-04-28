"use client";
import { clientLogger } from "@/lib/client-logger";

import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePWA() {
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(display-mode: standalone)").matches;
    }
    return false;
  });
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Register service worker only outside development to avoid stale local artifacts.
    const isLoginPage = window.location.pathname.includes("/login");
    const canRegisterServiceWorker =
      process.env.NODE_ENV !== "development" &&
      "serviceWorker" in navigator &&
      !isLoginPage;

    if (canRegisterServiceWorker) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
          setIsReady(true);
        })
        .catch((error) => {
          clientLogger.error(
            "[PWA] Service Worker registration failed:",
            error,
          );
        });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsReady(true);
    }

    // Listen for install prompt - this must be attached IMMEDIATELY
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Attach listener immediately
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const installPWA = useCallback(async () => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        setDeferredPrompt(null);
        return true;
      }
    } catch (error) {
      clientLogger.error("[PWA] Error during install:", error);
    }

    return false;
  }, [deferredPrompt]);

  return {
    isInstalled,
    canInstall: !!deferredPrompt,
    isReady,
    installPWA,
  };
}
