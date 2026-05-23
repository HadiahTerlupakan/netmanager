"use client";

import { useRef, useState } from "react";

import type { PhotoUploadRef } from "../PhotoUpload";

export interface UploadedPhotoState {
  status: string;
  file?: File;
  error?: string;
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
   * Upload foto yang sudah dipilih user. Throw kalau ada foto error.
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
    const failed = photos.filter((p) => p.status === "error");
    if (failed.length > 0) {
      throw new Error(
        `Beberapa foto gagal diunggah: ${failed
          .map((p) => p.error)
          .filter(Boolean)
          .join(", ")}`,
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
