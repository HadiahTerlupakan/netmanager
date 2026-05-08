"use client";

import { useState, useEffect } from "react";
import { HiClock } from "react-icons/hi2";
import { toZonedTime, format } from "date-fns-tz";
import { clientLogger } from "@/lib/client-logger";

export function ServerClock() {
  const [time, setTime] = useState<Date | null>(null);
  const [timezone, setTimezone] = useState<string>("Asia/Jakarta");
  const [mounted, setHydrated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHydrated(true), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // 1. Fetch server time to calculate offset (only once on mount)
    const syncTime = async () => {
      try {
        const start = Date.now();
        const res = await fetch("/api/health/time");
        const json = await res.json();
        const end = Date.now();

        // Compensate for network latency (half of round-trip time)
        const latency = (end - start) / 2;

        if (json.success) {
          const serverTime = new Date(json.data.serverTime).getTime();
          const localTime = end;

          // Offset = Server Time - Local Time
          const calculatedOffset = serverTime + latency - localTime;
          setTimezone(json.data.timezone);

          // 2. Update time every second locally using the calculated offset
          const interval = setInterval(() => {
            const now = Date.now();
            setTime(new Date(now + calculatedOffset));
          }, 1000);

          return interval;
        }
      } catch (error) {
        clientLogger.error("[ServerClock] Failed to sync time:", error);
      }
      return null;
    };

    let intervalId: NodeJS.Timeout | null = null;

    syncTime().then((interval) => {
      if (interval) {
        intervalId = interval;
      }
    });

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []); // Empty dependency - only run once on mount

  if (!mounted || !time) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse">
        <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded-full" />
        <div className="w-16 h-4 bg-gray-300 dark:bg-gray-600 rounded" />
      </div>
    );
  }

  // Convert to zoned time for display
  const zonedTime = toZonedTime(time, timezone);

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg shadow-sm">
      <HiClock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 dark:text-indigo-400" />
      <div className="flex flex-col">
        <span className="text-[11px] sm:text-sm font-bold font-mono text-indigo-900 dark:text-indigo-100 leading-none">
          {format(zonedTime, "HH:mm:ss", { timeZone: timezone })}
        </span>
        <span className="text-[8px] sm:text-[10px] text-indigo-500 dark:text-indigo-400 font-medium leading-none mt-0.5">
          {timezone.split("/").pop()?.replace("_", " ")}
        </span>
      </div>
    </div>
  );
}
