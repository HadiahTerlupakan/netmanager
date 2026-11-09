"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import { toast } from "react-hot-toast";

import type { PhotoUploadRef } from "@/components/inventory/PhotoUpload";
import { postWithAuth } from "@/lib/api-client";

import {
  buildPurchaseFormLines,
  findPurchaseFormProblems,
  selectAllPurchaseLines,
  toPurchaseRecordPayload,
  todayIsoDate,
  type PurchaseForm,
  type PurchaseFormLine,
} from "./restockPurchaseForm";
import { showRestockError, uploadPhotosWithToast } from "./restockToasts";
import type { PurchaseRequest, RestockPurchaseRecordResponse } from "./types";
import { describeRestockClientError, readRestockErrorMessage } from "./utils";

/** Pesanan sudah berubah di server: tutup isian dan muat ulang daftar. */
const STALE_PURCHASE_STATUSES = [404, 409];
const SAVE_FAILED_MESSAGE = "Belanja belum tersimpan. Coba sekali lagi.";
const SAVED_FALLBACK_MESSAGE = "Tersimpan. Belanjanya sudah dicatat.";

interface UseRestockPurchaseRecordInput {
  fetchData: () => Promise<void>;
}

interface PurchaseDraft {
  request: PurchaseRequest;
  form: PurchaseForm;
  /** Masalah isian baru ditampilkan setelah tombol simpan ditekan. */
  hasTriedSubmit: boolean;
}

async function readSuccessMessage(response: Response): Promise<string> {
  const body = (await response
    .json()
    .catch((): null => null)) as Partial<RestockPurchaseRecordResponse> | null;
  return typeof body?.message === "string" && body.message
    ? body.message
    : SAVED_FALLBACK_MESSAGE;
}

/**
 * Alamat foto nota yang akan dikirim. Bila semua foto sudah terunggah pada
 * percobaan simpan sebelumnya (mis. ditolak karena isian salah), alamatnya
 * dipakai ulang supaya file yang sama tidak diunggah dan menumpuk lagi.
 */
async function resolveNotaPhotoUrls(
  photoUploadRef: RefObject<PhotoUploadRef | null>,
): Promise<string[]> {
  const photos = photoUploadRef.current?.getPhotos() ?? [];
  if (photos.length === 0) return [];
  const uploadedUrls = photos.flatMap((photo) =>
    photo.status === "success" && photo.url ? [photo.url] : [],
  );
  if (uploadedUrls.length === photos.length) return uploadedUrls;
  return uploadPhotosWithToast(photoUploadRef);
}

/**
 * Langkah "Catat Belanja": satu kali belanja di satu toko. Menyimpan isian
 * modal, mengunggah foto nota, lalu POST ke /purchases. Dipisah dari
 * useRestockPage supaya urutan state halaman tidak bergeser.
 */
export function useRestockPurchaseRecord({
  fetchData,
}: UseRestockPurchaseRecordInput) {
  const [draft, setDraft] = useState<PurchaseDraft | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const photoUploadRef = useRef<PhotoUploadRef>(null);

  const updateForm = useCallback(
    (change: (form: PurchaseForm) => PurchaseForm) => {
      setDraft((current) =>
        current ? { ...current, form: change(current.form) } : current,
      );
    },
    [],
  );

  const updateLine = useCallback(
    (
      purchaseOrderItemId: string,
      change: (line: PurchaseFormLine) => PurchaseFormLine,
    ) => {
      updateForm((form) => ({
        ...form,
        lines: form.lines.map((line) =>
          line.purchaseOrderItemId === purchaseOrderItemId
            ? change(line)
            : line,
        ),
      }));
    },
    [updateForm],
  );

  const open = useCallback((target: PurchaseRequest) => {
    setDraft({
      request: target,
      form: {
        storeName: "",
        purchasedAt: todayIsoDate(),
        notes: "",
        buyerName: "",
        lines: buildPurchaseFormLines(target),
      },
      hasTriedSubmit: false,
    });
  }, []);

  const close = useCallback(() => setDraft(null), []);

  const setStoreName = useCallback(
    (storeName: string) => updateForm((form) => ({ ...form, storeName })),
    [updateForm],
  );
  const setPurchasedAt = useCallback(
    (purchasedAt: string) => updateForm((form) => ({ ...form, purchasedAt })),
    [updateForm],
  );
  const setNotes = useCallback(
    (notes: string) => updateForm((form) => ({ ...form, notes })),
    [updateForm],
  );
  const setBuyerName = useCallback(
    (buyerName: string) => updateForm((form) => ({ ...form, buyerName })),
    [updateForm],
  );
  const toggleLine = useCallback(
    (purchaseOrderItemId: string, isChecked: boolean) =>
      updateLine(purchaseOrderItemId, (line) => ({ ...line, isChecked })),
    [updateLine],
  );
  const setLineQuantity = useCallback(
    (purchaseOrderItemId: string, quantity: number) =>
      updateLine(purchaseOrderItemId, (line) => ({ ...line, quantity })),
    [updateLine],
  );
  const setLinePrice = useCallback(
    (purchaseOrderItemId: string, unitPrice: string) =>
      updateLine(purchaseOrderItemId, (line) => ({ ...line, unitPrice })),
    [updateLine],
  );
  const selectAll = useCallback(
    () =>
      updateForm((form) => ({
        ...form,
        lines: selectAllPurchaseLines(form.lines),
      })),
    [updateForm],
  );

  const submit = useCallback(async () => {
    if (!draft || isSubmitting) return;
    if (findPurchaseFormProblems(draft.form).length > 0) {
      setDraft({ ...draft, hasTriedSubmit: true });
      return;
    }
    try {
      setIsSubmitting(true);
      const fotoNota = await resolveNotaPhotoUrls(photoUploadRef);
      const response = await postWithAuth(
        `/api/inventory/restock/requests/${draft.request.id}/purchases`,
        toPurchaseRecordPayload(draft.form, fotoNota),
      );
      if (!response.ok) {
        showRestockError(
          await readRestockErrorMessage(response, SAVE_FAILED_MESSAGE),
        );
        if (STALE_PURCHASE_STATUSES.includes(response.status)) {
          setDraft(null);
          await fetchData();
        }
        return;
      }
      toast.success(await readSuccessMessage(response));
      setDraft(null);
      await fetchData();
    } catch (error: unknown) {
      showRestockError(describeRestockClientError(error));
    } finally {
      setIsSubmitting(false);
    }
  }, [draft, fetchData, isSubmitting]);

  return {
    request: draft?.request ?? null,
    form: draft?.form ?? null,
    isSubmitting,
    problems:
      draft?.hasTriedSubmit === true
        ? findPurchaseFormProblems(draft.form)
        : [],
    open,
    close,
    setStoreName,
    setPurchasedAt,
    setNotes,
    setBuyerName,
    toggleLine,
    setLineQuantity,
    setLinePrice,
    selectAll,
    submit,
    photoUploadRef,
  };
}

export type RestockPurchaseRecordState = ReturnType<
  typeof useRestockPurchaseRecord
>;
