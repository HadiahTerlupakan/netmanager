"use client";

import { useRef, useState } from "react";

import type { PhotoUploadRef } from "../PhotoUpload";
import { InventoryRequestError } from "./sendInventoryRequest";

export interface UploadedPhotoState {
  status: string;
  file?: File;
  error?: string;
}

/**
 * Jelaskan foto yang gagal diunggah beserta alasannya, satu per baris; null
 * bila semua foto berhasil.
 */
export function describeFailedPhotoUploads(
  photos: readonly UploadedPhotoState[],
): string | null {
  const failed = photos.filter((photo) => photo.status === "error");
  if (failed.length === 0) return null;

  const reasons = failed
    .map((photo) => photo.error)
    .filter((reason): reason is string => Boolean(reason));
  return [
    `${failed.length} foto gagal diunggah.`,
    ...reasons,
    "Hapus foto yang gagal (bertanda merah), lalu pilih ulang fotonya.",
  ].join("\n");
}

/**
 * Hook untuk wrap state foto bukti di form inventory.
 *
 * Encapsulasi:
 * - photoUploadRef untuk panggil getPhotos/uploadPhotos/resetPhotos
 * - tempId untuk transactionId saat create (sebelum punya ID asli)
 * - uploadedPhotos state untuk track status upload
 *
 * Dipakai oleh MasukForm, KeluarForm, TransferForm.
 */
export function useFotoBuktiUpload() {
  const photoUploadRef = useRef<PhotoUploadRef>(null);
  const [tempId] = useState<string>(() => `temp-${Date.now()}`);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhotoState[]>(
    [],
  );

  /**
   * Upload foto yang sudah dipilih user. Throw {@link InventoryRequestError}
   * berpesan jelas kalau ada foto yang gagal.
   * Mengembalikan list URL hasil upload + metadata untuk dikirim ke API.
   */
  const uploadPendingPhotos = async (): Promise<{
    urls: string[];
    photos: UploadedPhotoState[];
  }> => {
    if (!photoUploadRef.current) {
      return { urls: [], photos: [] };
    }
    const currentPhotos = photoUploadRef.current.getPhotos();
    if (currentPhotos.length === 0) {
      return { urls: [], photos: [] };
    }
    const urls = await photoUploadRef.current.uploadPhotos();
    const photos = photoUploadRef.current.getPhotos();
    const failedPhotos = describeFailedPhotoUploads(photos);
    if (failedPhotos) {
      throw new InventoryRequestError(
        `Data belum disimpan karena ada foto yang gagal.\n${failedPhotos}`,
        0,
      );
    }
    return { urls, photos };
  };

  const buildFotoMetadata = (photos: UploadedPhotoState[]) =>
    photos.length > 0
      ? {
          uploadedAt: new Date().toISOString(),
          count: photos.length,
          totalSize: photos.reduce(
            (sum, photo) => sum + (photo.file?.size || 0),
            0,
          ),
        }
      : null;

  const resetFotoState = () => {
    setUploadedPhotos([]);
    photoUploadRef.current?.resetPhotos();
  };

  return {
    photoUploadRef,
    tempId,
    uploadedPhotos,
    setUploadedPhotos,
    uploadPendingPhotos,
    buildFotoMetadata,
    resetFotoState,
  };
}
