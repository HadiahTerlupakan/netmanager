"use client";

import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";

import { patchWithAuth } from "@/lib/api-client";

import {
  buildCloseUnpurchasedPayload,
  CLOSE_UNPURCHASED_REASON_MISSING,
  getCloseUnpurchasedSuccessMessage,
} from "./restockCloseUnpurchased";
import { readRestockReceiptRequestStatus } from "./restockReceiveForm";
import { showRestockError } from "./restockToasts";
import type { PurchaseRequest } from "./types";
import { describeRestockClientError, readRestockErrorMessage } from "./utils";

interface UseRestockCloseUnpurchasedInput {
  fetchData: () => Promise<void>;
}

const FALLBACK_ERROR_MESSAGE =
  "Sisa yang tidak jadi dibeli belum ditutup. Coba sekali lagi.";
/** Penolakan karena data basi: tutup modal dan muat ulang daftar. */
const STALE_STATUSES = [400, 404, 409];

/**
 * State dan aksi modal "Tutup sisa yang tidak jadi dibeli" lewat
 * PATCH /api/inventory/restock/requests/[id]/receive.
 */
export function useRestockCloseUnpurchased({
  fetchData,
}: UseRestockCloseUnpurchasedInput) {
  const [request, setRequest] = useState<PurchaseRequest | null>(null);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const open = useCallback((target: PurchaseRequest) => {
    setRequest(target);
    setReason("");
  }, []);

  const close = useCallback(() => {
    setRequest(null);
  }, []);

  const submit = useCallback(async () => {
    if (!request) return;
    if (reason.trim().length === 0) {
      showRestockError(CLOSE_UNPURCHASED_REASON_MISSING);
      return;
    }
    try {
      setIsSubmitting(true);
      const response = await patchWithAuth(
        `/api/inventory/restock/requests/${request.id}/receive`,
        buildCloseUnpurchasedPayload(reason),
      );
      if (!response.ok) {
        const message = await readRestockErrorMessage(
          response,
          FALLBACK_ERROR_MESSAGE,
        );
        if (STALE_STATUSES.includes(response.status)) {
          showRestockError(message);
          setRequest(null);
          await fetchData();
          return;
        }
        throw new Error(message);
      }
      const body: unknown = await response.json().catch((): null => null);
      toast.success(
        getCloseUnpurchasedSuccessMessage(
          readRestockReceiptRequestStatus(body),
        ),
      );
      setRequest(null);
      await fetchData();
    } catch (error: unknown) {
      showRestockError(describeRestockClientError(error));
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchData, reason, request]);

  return {
    request,
    reason,
    setReason,
    isSubmitting,
    open,
    close,
    submit,
  };
}

export type RestockCloseUnpurchasedState = ReturnType<
  typeof useRestockCloseUnpurchased
>;
