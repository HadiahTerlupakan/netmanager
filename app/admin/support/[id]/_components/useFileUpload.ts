"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { clientLogger } from "@/lib/client-logger";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

interface UseFileUploadResult {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  uploading: boolean;
  attachments: string[];
  onPickFile: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  removeAttachment: (indexToRemove: number) => void;
  setAttachments: React.Dispatch<React.SetStateAction<string[]>>;
}

interface UploadResponse {
  url?: string;
  data?: { url?: string };
}

/**
 * Hook untuk pilih file gambar, validasi ukuran/type, dan upload ke
 * `/api/uploads`. Mengelola list URL hasil upload sebagai `attachments`.
 */
export function useFileUpload(): UseFileUploadResult {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);

  const onPickFile = () => {
    fileInputRef.current?.click();
  };

  const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      showToast("error", "Ukuran file maksimal 5MB");
      resetInput();
      return;
    }

    if (!file.type.startsWith("image/")) {
      showToast("error", "Hanya file gambar yang diperbolehkan");
      resetInput();
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        showToast("error", "Gagal mengupload gambar");
        return;
      }

      const json = (await res.json()) as UploadResponse;
      const url = json.url ?? json.data?.url;
      if (!url) {
        showToast("error", "Respons upload tidak valid");
        return;
      }
      setAttachments((prev) => [...prev, url]);
    } catch (error) {
      clientLogger.error("Upload error:", error);
      showToast("error", "Terjadi kesalahan saat upload");
    } finally {
      setUploading(false);
      resetInput();
    }
  };

  const removeAttachment = (indexToRemove: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const resetInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return {
    fileInputRef,
    uploading,
    attachments,
    onPickFile,
    onFileSelect,
    removeAttachment,
    setAttachments,
  };
}
