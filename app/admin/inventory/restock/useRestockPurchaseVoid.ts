"use client";

import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";

import { postWithAuth } from "@/lib/api-client";

import { buildPurchaseVoidUrl } from "./restockPurchase";
import { describeRestockClientError, readRestockErrorMessage } from "./utils";

/** Sama dengan batas server (`PURCHASE_VOID_REASON_LIMITS`). */
export const PURCHASE_VOID_REASON_MIN = 5;
export const PURCHASE_VOID_REASON_MAX = 500;

const VOID_FAILED_MESSAGE =
  "Catatan belanja belum bisa dibatalkan. Coba sekali lagi.";
const VOIDED_FALLBACK_MESSAGE = "Catatan belanja dibatalkan.";
const REASON_TOO_SHORT_MESSAGE = `Tulis alasan pembatalan, minimal ${PURCHASE_VOID_REASON_MIN} huruf.`;
/** Catatan sudah berubah di server: muat ulang data supaya tampilan sesuai. */
const STALE_STATUSES = [404, 409];

interface UseRestockPurchaseVoidInput {
  requestId: string;
  recordId: string;
  /** Dipanggil setelah berhasil atau bila data di server sudah berubah. */
  onVoided: () => Promise<void> | void;
}

/**
 * Alur "Batalkan catatan belanja": buka konfirmasi, isi alasan (wajib),
 * kirim, lalu muat ulang data pengajuan.
 */
export function useRestockPurchaseVoid({
  requestId,
  recordId,
  onVoided,
}: UseRestockPurchaseVoidInput) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const open = useCallback(() => {
    setIsOpen(true);
    setErrorMessage(null);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setReason("");
    setErrorMessage(null);
  }, []);

  const submit = useCallback(async () => {
    const trimmed = reason.trim();
    if (trimmed.length < PURCHASE_VOID_REASON_MIN) {
      setErrorMessage(REASON_TOO_SHORT_MESSAGE);
      return;
    }
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const response = await postWithAuth(
        buildPurchaseVoidUrl(requestId, recordId),
        { reason: trimmed },
      );
      if (!response.ok) {
        setErrorMessage(
          await readRestockErrorMessage(response, VOID_FAILED_MESSAGE),
        );
        if (STALE_STATUSES.includes(response.status)) await onVoided();
        return;
      }
      const body = (await response.json().catch((): null => null)) as {
        message?: string;
      } | null;
      toast.success(body?.message || VOIDED_FALLBACK_MESSAGE);
      close();
      await onVoided();
    } catch (error: unknown) {
      setErrorMessage(describeRestockClientError(error));
    } finally {
      setIsBusy(false);
    }
  }, [close, onVoided, reason, recordId, requestId]);

  return {
    isOpen,
    reason,
    setReason,
    isBusy,
    errorMessage,
    open,
    close,
    submit,
  };
}

export type RestockPurchaseVoidState = ReturnType<
  typeof useRestockPurchaseVoid
>;
