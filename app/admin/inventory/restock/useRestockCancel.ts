"use client";

import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";

import { patchWithAuth } from "@/lib/api-client";

import {
  buildRestockCancelPayload,
  getRestockCancelProblem,
  RESTOCK_REQUEST_CANCELLED_MESSAGE,
} from "./restockCancel";
import { showRestockError } from "./restockToasts";
import type { PurchaseRequest } from "./types";
import { describeRestockClientError, readRestockErrorMessage } from "./utils";

interface UseRestockCancelInput {
  fetchData: () => Promise<void>;
}

const FALLBACK_ERROR_MESSAGE = "Pengajuan belum dibatalkan. Coba sekali lagi.";
/**
 * Pengajuan sudah berubah di server (dihapus, sudah ada barang masuk, atau
 * sedang diproses admin lain): muat ulang daftar lalu tutup modal. Penolakan
 * lain membiarkan modal terbuka dengan pesannya, supaya alasan yang sudah
 * diketik tidak hilang.
 */
const STALE_CANCEL_STATUSES = [404, 409];

/**
 * State dan aksi modal "Batalkan Pengajuan" lewat
 * PATCH /api/inventory/restock/requests/[id] dengan alasan wajib.
 *
 * Setelah server menjawab, daftar dimuat ulang dulu baru modal ditutup:
 * saat modal tertutup tabel sudah berisi tombol yang baru, sehingga fokus
 * bisa dikembalikan ke sana.
 */
export function useRestockCancel({ fetchData }: UseRestockCancelInput) {
  const [request, setRequest] = useState<PurchaseRequest | null>(null);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Penolakan terakhir yang membiarkan modal terbuka; tampil di dalam modal. */
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const open = useCallback((target: PurchaseRequest) => {
    setRequest(target);
    setReason("");
    setErrorMessage(null);
  }, []);

  const close = useCallback(() => {
    setRequest(null);
  }, []);

  /** Muat ulang daftar, beri tahu hasilnya, lalu tutup modal. */
  const finish = useCallback(
    async (notify: () => void) => {
      await fetchData();
      notify();
      setRequest(null);
    },
    [fetchData],
  );

  const submit = useCallback(async () => {
    if (!request || isSubmitting) return;
    const problem = getRestockCancelProblem(reason);
    if (problem) {
      showRestockError(problem);
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const response = await patchWithAuth(
        `/api/inventory/restock/requests/${request.id}`,
        buildRestockCancelPayload(reason),
      );
      if (response.ok) {
        await finish(() => toast.success(RESTOCK_REQUEST_CANCELLED_MESSAGE));
        return;
      }
      const message = await readRestockErrorMessage(
        response,
        FALLBACK_ERROR_MESSAGE,
      );
      if (STALE_CANCEL_STATUSES.includes(response.status)) {
        await finish(() => showRestockError(message));
        return;
      }
      setErrorMessage(message);
    } catch (error: unknown) {
      setErrorMessage(describeRestockClientError(error));
    } finally {
      setIsSubmitting(false);
    }
  }, [finish, isSubmitting, reason, request]);

  return {
    request,
    reason,
    setReason,
    isSubmitting,
    errorMessage,
    open,
    close,
    submit,
  };
}

export type RestockCancelState = ReturnType<typeof useRestockCancel>;
