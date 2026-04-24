"use client";

import { useSyncExternalStore } from "react";
import { HiBell, HiBellSlash, HiXMark } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { useFCM } from "@/hooks/useFCM";

interface PushNotificationManagerProps {
  className?: string;
}

const PUSH_NOTIFICATION_DISMISSED_KEY = "push-notification-dismissed";
const PUSH_NOTIFICATION_DISMISSED_EVENT = "push-notification-dismissed-change";

function getPushNotificationDismissedSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  return localStorage.getItem(PUSH_NOTIFICATION_DISMISSED_KEY) === "true";
}

function subscribeToPushNotificationDismissed(
  callback: () => void,
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("storage", callback);
  window.addEventListener(PUSH_NOTIFICATION_DISMISSED_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(PUSH_NOTIFICATION_DISMISSED_EVENT, callback);
  };
}

function subscribeToHydration(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  callback();
  return () => undefined;
}

export function PushNotificationManager({
  className,
}: PushNotificationManagerProps) {
  const {
    permission,
    isSupported,
    isLoading,
    isRegistered,
    enableNotifications,
  } = useFCM();
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const isDismissed = useSyncExternalStore(
    subscribeToPushNotificationDismissed,
    getPushNotificationDismissedSnapshot,
    () => false,
  );

  const showBanner =
    isSupported && !isRegistered && permission === "default" && !isDismissed;

  const dismissBanner = () => {
    try {
      localStorage.setItem(PUSH_NOTIFICATION_DISMISSED_KEY, "true");
      window.dispatchEvent(new Event(PUSH_NOTIFICATION_DISMISSED_EVENT));
    } catch {
      return;
    }
  };

  if (!isHydrated || !isSupported) {
    return null;
  }

  if (isRegistered) {
    return (
      <div
        className={`flex items-center gap-2 text-sm text-green-600 dark:text-green-400 ${className}`}
      >
        <HiBell className="w-4 h-4" />
        <span>Notifikasi aktif</span>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div
        className={`flex items-center gap-2 text-sm text-gray-500 ${className}`}
      >
        <HiBellSlash className="w-4 h-4" />
        <span>Notifikasi diblokir</span>
      </div>
    );
  }

  if (!showBanner) {
    return null;
  }

  return (
    <div
      className={`bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <HiBell className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 dark:text-white">
            Aktifkan Notifikasi
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Dapatkan pemberitahuan langsung saat ada Work Order baru atau update
            penting.
          </p>
          <div className="flex items-center gap-3 mt-3">
            <Button
              onClick={() => void enableNotifications()}
              disabled={isLoading}
            >
              {isLoading ? "Mengaktifkan..." : "Aktifkan Notifikasi"}
            </Button>
            <Button onClick={dismissBanner}>Nanti saja</Button>
          </div>
        </div>
        <Button onClick={dismissBanner}>
          <HiXMark className="w-5 h-5 text-gray-500" />
        </Button>
      </div>
    </div>
  );
}
