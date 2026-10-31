"use client";

import { useState, useSyncExternalStore } from "react";
import { MdVolumeUp } from "react-icons/md";

import {
  isCustomerNotificationSoundEnabled,
  playCustomerNotificationSound,
  setCustomerNotificationSoundEnabled,
} from "@/lib/notification-sound";

/**
 * Bunyi notifikasi portal disimpan per browser, bukan di akun: yang diatur
 * adalah perangkat yang sedang dipakai, sama seperti volume.
 */
export function NotificationSoundToggle() {
  // Server selalu merender "aktif"; nilai tersimpan baru dibaca di klien
  // supaya hidrasi tidak berbeda.
  const stored = useSyncExternalStore(
    () => () => {},
    isCustomerNotificationSoundEnabled,
    () => true,
  );
  const [chosen, setChosen] = useState<boolean | null>(null);
  const enabled = chosen ?? stored;

  const toggle = () => {
    const next = !enabled;
    setChosen(next);
    setCustomerNotificationSoundEnabled(next);
    if (next) playCustomerNotificationSound();
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={toggle}
      className="flex w-full items-center gap-3 p-4 justify-between text-left border-b border-gray-100 dark:border-gray-700 cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className="text-[#0d9488] flex items-center justify-center rounded-lg bg-[#0d9488]/10 shrink-0 size-9">
          <MdVolumeUp className="text-[20px]" />
        </div>
        <p className="text-[#111418] dark:text-white text-sm font-medium leading-normal">
          Bunyi Notifikasi
        </p>
      </div>
      <div className="shrink-0 relative inline-flex items-center">
        <div
          className={`w-11 h-6 rounded-full transition-colors ${enabled ? "bg-[#0d9488]" : "bg-gray-200 dark:bg-gray-600"}`}
        >
          <div
            className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 shadow-sm transition-transform ${enabled ? "translate-x-full border-white" : "translate-x-0"}`}
          ></div>
        </div>
      </div>
    </button>
  );
}
