"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "react-hot-toast";

import { patchWithAuth } from "@/lib/api-client";
import type {
  PhotoUploadRef,
  UploadedPhoto,
} from "@/components/inventory/PhotoUpload";

import {
  buildRestockReceivePayload,
  getRestockReceiveProblems,
  getRestockReceiveSuccessMessage,
  getRestockReceiveSummary,
} from "./restockReceiveForm";
import { showRestockError, uploadPhotosWithToast } from "./restockToasts";
import type {
  Barang,
  PurchaseRequest,
  RestockOverReceiptMap,
  RestockSubstitutionMap,
} from "./types";
import {
  buildInitialReceivedItems,
  describeRestockClientError,
  readRestockErrorMessage,
} from "./utils";

interface UseRestockEntryInput {
  fetchData: () => Promise<void>;
  /** Semua barang, untuk nama barang pengganti di ringkasan dan toast. */
  barangs: Barang[];
}

const FALLBACK_ERROR_MESSAGE = "Barang belum tersimpan. Coba sekali lagi.";
/**
 * Penolakan karena data basi (pengajuan sudah diproses, dihapus, atau sedang
 * diproses admin lain): isian memakai sisa lama, jadi modal ditutup dan
 * daftar dimuat ulang.
 */
const STALE_ENTRY_STATUSES = [400, 404, 409];

/**
 * State dan aksi modal "Lapor Barang Sampai" lewat
 * PATCH /api/inventory/restock/requests/[id]/receive. Satu kali simpan
 * selalu menyelesaikan pengajuan.
 */
export function useRestockEntry({ fetchData, barangs }: UseRestockEntryInput) {
  const [request, setRequest] = useState<PurchaseRequest | null>(null);
  const [receivedItems, setReceivedItems] = useState<Record<string, number>>(
    {},
  );
  const [substitutions, setSubstitutions] = useState<RestockSubstitutionMap>(
    {},
  );
  const [overReceipts, setOverReceipts] = useState<RestockOverReceiptMap>({});
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const photoUploadRef = useRef<PhotoUploadRef>(null);

  const open = useCallback((target: PurchaseRequest) => {
    setRequest(target);
    setReceivedItems(buildInitialReceivedItems(target));
    setSubstitutions({});
    setOverReceipts({});
    setPhotos([]);
  }, []);

  const close = useCallback(() => {
    setRequest(null);
  }, []);

  const submit = useCallback(async () => {
    if (!request || isSubmitting) return;
    const formInput = { request, receivedItems, substitutions, barangs };
    const problems = getRestockReceiveProblems({
      ...formInput,
      overReceipts,
      photoCount: photos.length,
    });
    if (problems.length > 0) {
      showRestockError(`Belum bisa disimpan:\n${problems.join("\n")}`);
      return;
    }
    const summary = getRestockReceiveSummary(formInput);

    try {
      setIsSubmitting(true);
      const fotoBukti = summary.hasEntry
        ? await uploadPhotosWithToast(photoUploadRef)
        : [];
      const response = await patchWithAuth(
        `/api/inventory/restock/requests/${request.id}/receive`,
        buildRestockReceivePayload({ ...formInput, overReceipts, fotoBukti }),
      );
      if (!response.ok) {
        const message = await readRestockErrorMessage(
          response,
          FALLBACK_ERROR_MESSAGE,
        );
        if (STALE_ENTRY_STATUSES.includes(response.status)) {
          showRestockError(message);
          setRequest(null);
          await fetchData();
          return;
        }
        throw new Error(message);
      }
      toast.success(getRestockReceiveSuccessMessage(summary));
      setRequest(null);
      await fetchData();
    } catch (error: unknown) {
      showRestockError(describeRestockClientError(error));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    barangs,
    fetchData,
    isSubmitting,
    overReceipts,
    photos.length,
    receivedItems,
    request,
    substitutions,
  ]);

  return {
    request,
    receivedItems,
    setReceivedItems,
    substitutions,
    setSubstitutions,
    overReceipts,
    setOverReceipts,
    photos,
    setPhotos,
    isSubmitting,
    photoUploadRef,
    open,
    close,
    submit,
  };
}

export type RestockEntryState = ReturnType<typeof useRestockEntry>;
