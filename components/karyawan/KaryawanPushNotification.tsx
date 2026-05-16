"use client";

import { useState } from "react";
import { MdNotifications, MdNotificationsOff, MdClose } from "react-icons/md";
import { Button } from "@/components/ui/Button";
import { useFCM } from "@/hooks/useFCM";

export function KaryawanPushNotification() {
  const {
    permission,
    isSupported,
    isLoading,
    isRegistered,
    enableNotifications,
  } = useFCM();
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return localStorage.getItem("karyawan-push-dismissed") === "true";
  });
  const showBanner =
    isSupported && !isRegistered && permission === "default" && !isDismissed;

  const dismissBanner = () => {
    setIsDismissed(true);
    localStorage.setItem("karyawan-push-dismissed", "true");
  };

  if (!isSupported) {
    return null;
  }

  if (isRegistered) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
        <MdNotifications className="text-lg" />
        <span className="text-sm font-medium">Notifikasi aktif</span>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500">
        <MdNotificationsOff className="text-lg" />
        <span className="text-sm">Notifikasi diblokir</span>
      </div>
    );
  }

  if (!showBanner) {
    return (
      <Button onClick={() => void enableNotifications()} disabled={isLoading}>
        <MdNotifications className="text-lg" />
        <span className="text-sm font-medium">
          {isLoading ? "Mengaktifkan..." : "Aktifkan Notifikasi"}
        </span>
      </Button>
    );
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
          <MdNotifications className="text-xl text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Aktifkan Notifikasi
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Dapatkan notifikasi saat ada Work Order baru!
          </p>
          <div className="flex items-center gap-3 mt-3">
            <Button
              onClick={() => void enableNotifications()}
              disabled={isLoading}
            >
              {isLoading ? "Mengaktifkan..." : "Aktifkan"}
            </Button>
            <Button onClick={dismissBanner}>Nanti</Button>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={dismissBanner}>
          <MdClose className="text-xl text-gray-400" />
        </Button>
      </div>
    </div>
  );
}
