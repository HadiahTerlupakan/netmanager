"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "react-hot-toast";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { clientLogger } from "@/lib/client-logger";
import type { Mitra, Site, Stats } from "../components/types";

type TypeFilter = "all" | "MITRA_TEKNISI" | "MITRA_SALES";

const PAGE_LIMIT = 20;

interface MitraListResponse {
  success?: boolean;
  error?: string;
  data?: {
    mitras?: Mitra[];
    totalPages?: number;
    total?: number;
    stats?: Stats | null;
  };
}

interface SitesResponse {
  sites?: Site[];
}

async function fetchMitraList(
  url: string,
  ctx: { signal: AbortSignal },
): Promise<MitraListResponse> {
  const res = await fetch(url, { signal: ctx.signal });
  return (await res.json()) as MitraListResponse;
}

async function fetchSites(ctx: { signal: AbortSignal }): Promise<Site[]> {
  const res = await fetch("/api/sites", { signal: ctx.signal });
  const data = (await res.json()) as SitesResponse;
  return data.sites ?? [];
}

export interface UseMitraListReturn {
  readonly mitras: Mitra[];
  readonly sites: Site[];
  readonly stats: Stats | null;
  readonly loading: boolean;
  readonly searchTerm: string;
  readonly setSearchTerm: (value: string) => void;
  readonly typeFilter: TypeFilter;
  readonly setTypeFilter: (value: TypeFilter) => void;
  readonly page: number;
  readonly setPage: React.Dispatch<React.SetStateAction<number>>;
  readonly totalPages: number;
  readonly total: number;
  readonly fetchMitras: () => Promise<void>;
  readonly handleRequestFaceVerification: (mitraId: string) => Promise<void>;
}

export function useMitraList(): UseMitraListReturn {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [page, setPage] = useState(1);

  const queryClient = useQueryClient();

  const mitraParams = useMemo(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (typeFilter !== "all") params.set("type", typeFilter);
    params.set("page", page.toString());
    params.set("limit", PAGE_LIMIT.toString());
    return params;
  }, [searchTerm, typeFilter, page]);

  const mitraQueryKey = useMemo(
    () => ["mitra-list", mitraParams.toString()] as const,
    [mitraParams],
  );

  const {
    data: mitraData,
    error: mitraError,
    isPending: mitraPending,
  } = useQuery<MitraListResponse, Error>({
    queryKey: mitraQueryKey,
    queryFn: (ctx) => fetchMitraList(`/api/admin/mitra?${mitraParams}`, ctx),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!mitraError) return;
    const isAbort =
      mitraError instanceof DOMException && mitraError.name === "AbortError";
    if (isAbort) return;
    clientLogger.error("Failed to fetch mitra list", mitraError);
    toast.error(
      mitraError.message || "Terjadi kesalahan saat memuat data mitra",
    );
  }, [mitraError]);

  const { data: sites } = useQuery<Site[], Error>({
    queryKey: ["mitra-sites"],
    queryFn: fetchSites,
    staleTime: 5 * 60 * 1000,
  });

  const mitras = mitraData?.data?.mitras ?? [];
  const totalPages = mitraData?.data?.totalPages ?? 1;
  const total = mitraData?.data?.total ?? 0;
  const stats = mitraData?.data?.stats ?? null;
  const loading = mitraPending;

  const fetchMitras = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["mitra-list"] });
  }, [queryClient]);

  const handleRequestFaceVerification = useCallback(
    async (mitraId: string) => {
      if (
        !confirm(
          "Apakah Anda yakin ingin mewajibkan mitra ini untuk melakukan Verifikasi Wajah (Liveness) pada login berikutnya?",
        )
      )
        return;
      const toastId = toast.loading("Memicu verifikasi wajah...");
      try {
        const res = await fetch(`/api/admin/mitra/${mitraId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requiresFaceVerification: true }),
        });
        const data = (await res.json()) as {
          success?: boolean;
          error?: string;
        };
        if (res.ok && data.success) {
          toast.success("Mitra diwajibkan verifikasi wajah", { id: toastId });
          await fetchMitras();
        } else {
          toast.error(data.error || "Gagal mengubah status", { id: toastId });
        }
      } catch {
        toast.error("Terjadi kesalahan jaringan", { id: toastId });
      }
    },
    [fetchMitras],
  );

  return {
    mitras,
    sites: sites ?? [],
    stats,
    loading,
    searchTerm,
    setSearchTerm,
    typeFilter,
    setTypeFilter,
    page,
    setPage,
    totalPages,
    total,
    fetchMitras,
    handleRequestFaceVerification,
  };
}
