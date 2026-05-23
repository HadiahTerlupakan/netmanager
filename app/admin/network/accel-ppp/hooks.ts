"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AccelPppServerListItem {
  id: string;
  name: string;
  ipAddress: string;
  description: string | null;
  cliHost: string;
  cliPort: number;
  authPort: number;
  pingStatus: string;
  userOnline: number;
  lastStatusCheck: string | null;
  siteId: string | null;
  tenantId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccelPppSessionItem {
  ifname: string;
  username: string;
  callingSid: string;
  ip: string;
  rateLimit: string | null;
  type: string;
  state: string;
  uptime: string;
}

const BASE = "/api/admin/accel-ppp-servers";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error ?? `HTTP ${res.status}`);
  }
  return json.data as T;
}

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/** Hook generik yang men-trigger fetch dari effect lewat counter, sehingga
 *  setState di body effect dapat dihindari (mengikuti aturan project). */
function useResource<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
): FetchState<T> & { refresh: () => void } {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const [tick, setTick] = useState(0);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((data) => {
        if (cancelled || !aliveRef.current) return;
        setState({ data, loading: false, error: null });
      })
      .catch((err: Error) => {
        if (cancelled || !aliveRef.current) return;
        setState({ data: null, loading: false, error: err.message });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  const refresh = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  return { ...state, refresh };
}

export function useAccelPppServers() {
  const { data, loading, error, refresh } = useResource(
    () => getJson<{ items: AccelPppServerListItem[] }>(BASE),
    [],
  );
  return {
    items: data?.items ?? [],
    loading,
    error,
    refresh,
  };
}

export function useAccelPppServer(id: string | null) {
  const { data, loading, error, refresh } = useResource(
    () =>
      id
        ? getJson<AccelPppServerListItem>(`${BASE}/${id}`)
        : Promise.resolve<AccelPppServerListItem | null>(null).then(() => {
            throw new Error("ID tidak diberikan");
          }),
    [id ?? ""],
  );
  return { data, loading, error, refresh };
}

export function useAccelPppSessions(id: string | null, intervalMs = 10000) {
  const { data, loading, error, refresh } = useResource(
    () =>
      id
        ? getJson<{ items: AccelPppSessionItem[] }>(`${BASE}/${id}/sessions`)
        : Promise.resolve({ items: [] }),
    [id ?? ""],
  );

  useEffect(() => {
    if (!id) return;
    const handle = setInterval(refresh, intervalMs);
    return () => clearInterval(handle);
  }, [id, intervalMs, refresh]);

  return {
    items: data?.items ?? [],
    loading,
    error,
    refresh,
  };
}

/** Wrapper kecil supaya kode UI yang panggil mutation tetap pendek. */
async function postJson<T>(
  url: string,
  body?: unknown,
  method: "POST" | "PATCH" | "DELETE" = "POST",
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error ?? `HTTP ${res.status}`);
  }
  return json.data as T;
}

export const accelPppMutations = {
  create: (payload: Record<string, unknown>) =>
    postJson<{ id: string }>(BASE, payload, "POST"),
  update: (id: string, payload: Record<string, unknown>) =>
    postJson<AccelPppServerListItem>(`${BASE}/${id}`, payload, "PATCH"),
  remove: (id: string, force = false) =>
    postJson<{ deleted: boolean }>(
      `${BASE}/${id}${force ? "?force=true" : ""}`,
      undefined,
      "DELETE",
    ),
  testConnection: (id: string) =>
    postJson<{ ok: boolean; raw: string }>(
      `${BASE}/${id}/test-connection`,
      undefined,
      "POST",
    ),
  kick: (id: string, username: string) =>
    postJson<{ terminated: boolean; notFound: boolean; message: string }>(
      `${BASE}/${id}/sessions/${encodeURIComponent(username)}/kick`,
      undefined,
      "POST",
    ),
};
