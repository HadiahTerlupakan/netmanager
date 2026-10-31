"use client";

import { useEffect, useRef, useState } from "react";

const TICK_MS = 1000;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const EXPIRED_LABEL = "Kedaluwarsa";

function formatRemaining(remainingMs: number) {
  if (remainingMs <= 0) return EXPIRED_LABEL;
  const totalSeconds = Math.floor(remainingMs / MS_PER_SECOND);
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor(
    (totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE,
  );
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return [hours, minutes, seconds]
    .map((part) => part.toString().padStart(2, "0"))
    .join(":");
}

/**
 * Sisa waktu checkout ("HH:MM:SS", lalu "Kedaluwarsa"). `onExpire` dipanggil
 * sekali per `expiresAt`, lewat ref: callback inline yang berganti di setiap
 * render dulu menjalankan ulang efek ini dan memuat ulang tagihan puluhan kali
 * per detik setelah waktunya habis.
 */
export function useExpiryCountdown(expiresAt: string, onExpire: () => void) {
  const expiresAtMs = new Date(expiresAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (Date.now() >= expiresAtMs) {
      onExpireRef.current();
      return;
    }
    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= expiresAtMs) {
        clearInterval(interval);
        onExpireRef.current();
      }
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [expiresAtMs]);

  return formatRemaining(expiresAtMs - now);
}
