"use client";

import { useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import type { Mitra, MitraFormState } from "../components/types";
import {
  buildAddPayload,
  buildEditPayload,
} from "../components/mitraFormPayload";

export interface UseMitraFormActionsReturn {
  readonly saving: boolean;
  readonly showAddModal: boolean;
  readonly setShowAddModal: React.Dispatch<React.SetStateAction<boolean>>;
  readonly showEditModal: boolean;
  readonly setShowEditModal: React.Dispatch<React.SetStateAction<boolean>>;
  readonly selectedMitra: Mitra | null;
  readonly openAddModal: () => void;
  readonly openEditModal: (mitra: Mitra) => void;
  readonly handleAdd: (values: MitraFormState) => Promise<void>;
  readonly handleEdit: (values: MitraFormState) => Promise<void>;
  readonly handleFileUpload: (
    e: React.ChangeEvent<HTMLInputElement>,
    field: string,
    onUploaded: (url: string) => void,
  ) => Promise<void>;
}

export function useMitraFormActions(
  onMutated: () => Promise<void>,
): UseMitraFormActionsReturn {
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMitra, setSelectedMitra] = useState<Mitra | null>(null);

  const openAddModal = useCallback(() => {
    setShowAddModal(true);
  }, []);

  const openEditModal = useCallback((mitra: Mitra) => {
    setSelectedMitra(mitra);
    setShowEditModal(true);
  }, []);

  const handleAdd = useCallback(
    async (values: MitraFormState) => {
      if (!values.name || !values.email || !values.password) {
        toast.error("Nama, email, dan password harus diisi");
        return;
      }
      setSaving(true);
      try {
        const res = await fetch("/api/admin/mitra", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildAddPayload(values)),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          toast.success("Mitra berhasil ditambahkan");
          setShowAddModal(false);
          await onMutated();
        } else {
          toast.error(data.error || "Gagal menambahkan mitra");
        }
      } catch {
        toast.error("Terjadi kesalahan");
      } finally {
        setSaving(false);
      }
    },
    [onMutated],
  );

  const handleEdit = useCallback(
    async (values: MitraFormState) => {
      if (!selectedMitra) return;
      setSaving(true);
      try {
        const res = await fetch(`/api/admin/mitra/${selectedMitra.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildEditPayload(values)),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          toast.success("Mitra berhasil diperbarui");
          setShowEditModal(false);
          await onMutated();
        } else {
          toast.error(data.error || "Gagal memperbarui mitra");
        }
      } catch {
        toast.error("Terjadi kesalahan");
      } finally {
        setSaving(false);
      }
    },
    [selectedMitra, onMutated],
  );

  const handleFileUpload = useCallback(
    async (
      e: React.ChangeEvent<HTMLInputElement>,
      field: string,
      onUploaded: (url: string) => void,
    ) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Ukuran file maksimal 5MB");
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "mitra-document");
      const toastId = toast.loading(`Mengunggah gambar...`);
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (res.ok && data.success) {
          onUploaded(data.url as string);
          toast.success("Gambar berhasil diunggah", { id: toastId });
        } else {
          toast.error(data.error || "Gagal mengunggah", { id: toastId });
        }
      } catch {
        toast.error("Terjadi kesalahan jaringan", { id: toastId });
      }
    },
    [],
  );

  return {
    saving,
    showAddModal,
    setShowAddModal,
    showEditModal,
    setShowEditModal,
    selectedMitra,
    openAddModal,
    openEditModal,
    handleAdd,
    handleEdit,
    handleFileUpload,
  };
}
