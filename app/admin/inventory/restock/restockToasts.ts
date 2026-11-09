import type { RefObject } from "react";
import { toast } from "react-hot-toast";

import type { PhotoUploadRef } from "@/components/inventory/PhotoUpload";

import { uploadProofPhotos } from "./utils";

/** Pesan error bisa beberapa baris; beri waktu cukup untuk dibaca. */
const RESTOCK_ERROR_TOAST_MS = 10_000;
const RESTOCK_WARNING_TOAST_MS = 12_000;

/** Tampilkan error restock yang boleh berisi beberapa baris. */
export function showRestockError(message: string) {
  toast.error(message, {
    duration: RESTOCK_ERROR_TOAST_MS,
    style: { whiteSpace: "pre-line" },
  });
}

/** Tampilkan peringatan untuk aksi yang tersimpan tapi ada langkah lanjutan gagal. */
export function showRestockWarning(message: string) {
  toast(message, { icon: "⚠️", duration: RESTOCK_WARNING_TOAST_MS });
}

/** Unggah foto bukti/nota dengan toast "sedang mengunggah". */
export async function uploadPhotosWithToast(
  photoUploadRef: RefObject<PhotoUploadRef | null>,
): Promise<string[]> {
  const loadingToastId = toast.loading("Sedang mengunggah foto...");
  try {
    return await uploadProofPhotos(photoUploadRef);
  } finally {
    toast.dismiss(loadingToastId);
  }
}
