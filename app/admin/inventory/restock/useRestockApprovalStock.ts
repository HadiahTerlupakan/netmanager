"use client";

import { useCallback, useEffect, useState } from "react";

import { getWithAuth } from "@/lib/api-client";

import type {
  ApprovalStockItem,
  ApprovalStockResponse,
} from "./restockApprovalStock";
import { readRestockErrorMessage } from "./utils";

const LOAD_FAILED_MESSAGE =
  "Stok gudang belum bisa dimuat. Periksa koneksi internet, lalu coba lagi.";

/** Keadaan stok gudang di modal persetujuan. */
export type RestockApprovalStockState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string; retry: () => void }
  | {
      status: "ready";
      gudangName: string | null;
      fetchedAt: string;
      byBarangId: ReadonlyMap<string, ApprovalStockItem>;
      retry: () => void;
    };

type LoadedStock = Exclude<
  RestockApprovalStockState,
  { status: "idle" } | { status: "loading" }
>;

/**
 * Ambil stok terkini gudang tujuan setiap kali modal persetujuan dibuka
 * (atau "Coba lagi"). Hasil disimpan bersama kuncinya;
 * hasil untuk kunci lama dianggap belum ada, jadi layar menampilkan
 * "Memuat…" tanpa setState di dalam effect.
 */
export function useRestockApprovalStock(
  requestId: string | null,
): RestockApprovalStockState {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    value: LoadedStock;
  } | null>(null);
  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  // Tiap kali modal dibuka (juga untuk pengajuan yang sama) stok dibaca ulang:
  // angka saat terakhir dibuka bisa sudah berubah.
  const [openedId, setOpenedId] = useState(requestId);
  if (openedId !== requestId) {
    setOpenedId(requestId);
    if (requestId) setAttempt((count) => count + 1);
  }
  const key = requestId ? `${requestId}:${attempt}` : null;

  useEffect(() => {
    if (!requestId || !key) return;
    let isCurrent = true;
    const settle = (value: LoadedStock) => {
      if (isCurrent) setResult({ key, value });
    };

    const load = async () => {
      try {
        const response = await getWithAuth(
          `/api/inventory/restock/requests/${encodeURIComponent(requestId)}/stok`,
        );
        if (!response.ok) {
          const message = await readRestockErrorMessage(
            response,
            LOAD_FAILED_MESSAGE,
          );
          settle({ status: "error", message, retry });
          return;
        }
        const body = (await response.json()) as { data: ApprovalStockResponse };
        settle({
          status: "ready",
          gudangName: body.data.gudangName,
          fetchedAt: body.data.fetchedAt,
          byBarangId: new Map(
            body.data.items.map((item) => [item.barangId, item]),
          ),
          retry,
        });
      } catch {
        settle({ status: "error", message: LOAD_FAILED_MESSAGE, retry });
      }
    };
    void load();

    return () => {
      isCurrent = false;
    };
  }, [requestId, key, retry]);

  if (!key) return { status: "idle" };
  if (result?.key !== key) return { status: "loading" };
  return result.value;
}
