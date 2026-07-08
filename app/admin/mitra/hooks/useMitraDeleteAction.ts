"use client";

import { useState, useCallback } from "react";
import { toast } from "react-hot-toast";

export interface UseMitraDeleteActionReturn {
  readonly deleteId: string | null;
  readonly setDeleteId: React.Dispatch<React.SetStateAction<string | null>>;
  readonly deleting: boolean;
  readonly handleDelete: () => Promise<void>;
}

export function useMitraDeleteAction(
  onMutated: () => Promise<void>,
): UseMitraDeleteActionReturn {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/mitra/${deleteId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Mitra berhasil dinonaktifkan");
        setDeleteId(null);
        await onMutated();
      } else {
        toast.error(data.error || "Gagal menonaktifkan mitra");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setDeleting(false);
    }
  }, [deleteId, onMutated]);

  return {
    deleteId,
    setDeleteId,
    deleting,
    handleDelete,
  };
}
