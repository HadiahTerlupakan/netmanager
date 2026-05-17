"use client";

import { useEffect, useState } from "react";
import { HiClock } from "react-icons/hi2";
import { toZonedTime, format } from "date-fns-tz";
import { useApi } from "@/lib/hooks/useApi";

interface ServerTimeResponse {
  serverTime: string;
  timezone: string;
}

export function ServerClock() {
  const [time, setTime] = useState<Date | null>(null);
  const [mounted, setHydrated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHydrated(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const { data: serverData } = useApi<ServerTimeResponse>("/api/health/time");
  const timezone = serverData?.timezone ?? "Asia/Jakarta";

  useEffect(() => {
    if (!serverData) return;

    const serverTimeMs = new Date(serverData.serverTime).getTime();
    const offset = serverTimeMs - Date.now();

    const tick = () => setTime(new Date(Date.now() + offset));
    const initial = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [serverData]);

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
