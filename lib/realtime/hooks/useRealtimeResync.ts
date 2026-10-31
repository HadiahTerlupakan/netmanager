"use client";

import { useEffect, useRef } from "react";

import { useRealtime } from "@/lib/realtime/RealtimeContext";

/**
 * Memanggil `onResync` sekali setiap kali realtime tersinkron ulang setelah
 * koneksi kembali. Event yang tiba selagi listener dipasang ulang ikut di
 * sinkronisasi pertamanya dan tidak pernah datang sebagai event, jadi hook
 * yang menampilkan hitungan memuatnya ulang dari server. Tidak dipanggil saat
 * mount: hook memuat datanya sendiri saat itu.
 */
export function useRealtimeResync(onResync: () => void) {
  const { connectionEpoch } = useRealtime();
  const onResyncRef = useRef(onResync);
  const handledEpochRef = useRef(connectionEpoch);

  useEffect(() => {
    onResyncRef.current = onResync;
  }, [onResync]);

  useEffect(() => {
    if (connectionEpoch === handledEpochRef.current) return;
    handledEpochRef.current = connectionEpoch;
    onResyncRef.current();
  }, [connectionEpoch]);
}
