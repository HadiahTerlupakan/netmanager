"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useApi } from "@/lib/hooks/useApi";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";
import { useRealtime } from "@/lib/realtime/RealtimeContext";

import type { EmployeeLocation } from "./live-location.types";

/**
 * Polling tetap jalan walau realtime tersambung: check-in dan check-out tidak
 * punya event, dan langganan Firestore yang ditolak hanya tercatat di log
 * sementara `isConnected` tetap true.
 */
const POLL_WHILE_CONNECTED_MS = 60_000;
const POLL_WITHOUT_REALTIME_MS = 15_000;

/** Event lokasi yang datang beruntun digabung menjadi satu pengambilan ulang. */
const REFETCH_COALESCE_MS = 5_000;

type LocationUpdateEvent = { userId?: string };

/** Lokasi live karyawan: dari API, diperbarui oleh event realtime dan polling. */
export function useLiveLocations() {
  const { isConnected } = useRealtime();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // Super admin tanpa tenant tidak punya kanal untuk didengar.
  const [hasChannel, setHasChannel] = useState(false);
  const hasRealtime = isConnected && hasChannel;

  const query = useApi<{
    locations?: EmployeeLocation[];
    tenantId?: string | null;
  }>("/api/admin/location/live", {
    staleTime: 0,
    refreshInterval: hasRealtime
      ? POLL_WHILE_CONNECTED_MS
      : POLL_WITHOUT_REALTIME_MS,
    queryOptions: { refetchOnWindowFocus: true },
  });
  const { data, refetch } = query;
  const locations = Array.isArray(data?.locations) ? data.locations : [];
  const tenantId = data?.tenantId ?? null;

  useEffect(() => {
    if (!data) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastUpdated(new Date());
    setHasChannel(Boolean(data.tenantId));
  }, [data]);

  useRealtimeScope(
    tenantId ? { kind: "admin", id: `location:${tenantId}` } : null,
  );

  const scheduleRefetch = useCoalescedRefetch(refetch);
  const shownUserIds = useRef(new Set<string>());
  useEffect(() => {
    shownUserIds.current = new Set(
      (data?.locations ?? []).map((location) => location.userId),
    );
  }, [data]);

  // Event karyawan yang tidak tampil diabaikan: bagi admin yang dibatasi site
  // atau departemen, itu karyawan di luar cakupannya. Karyawan yang baru
  // check-in muncul lewat polling.
  const handleLocationUpdate = useCallback(
    (event: LocationUpdateEvent) => {
      if (event.userId && shownUserIds.current.has(event.userId)) {
        scheduleRefetch();
      }
    },
    [scheduleRefetch],
  );
  useRealtimeEvent<LocationUpdateEvent>(
    "admin.location.update",
    handleLocationUpdate,
  );

  return { ...query, locations, lastUpdated };
}

function useCoalescedRefetch(refetch: () => unknown) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      void refetch();
    }, REFETCH_COALESCE_MS);
  }, [refetch]);
}
