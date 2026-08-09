"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  HiOutlinePlus,
  HiOutlineDocumentDuplicate,
  HiOutlineTrash,
  HiOutlineXMark,
} from "react-icons/hi2";
import { useApi, useRevalidate } from "@/lib/hooks/useApi";
import { usePermission } from "@/hooks/use-permission";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/LoadingSkeleton";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { formatDateShort } from "@/modules/planning/client";
import type { PlanningTemplateListItemDTO } from "@/modules/planning/client";

type TemplateListResponse = {
  data: PlanningTemplateListItemDTO[];
  meta?: { total: number };
};

const inputClass =
  "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const labelClass =
  "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

interface NewItemRow {
  name: string;
  quantity: string;
  unit: string;
  estimatedPrice: string;
}

const EMPTY_ITEM: NewItemRow = {
  name: "",
  quantity: "",
  unit: "meter",
  estimatedPrice: "",
};

export default function PlanningTemplatesClient() {
  const router = useRouter();
  const revalidate = useRevalidate();
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("planning:create");
  const canDelete = hasPermission("planning:delete");

  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [applyId, setApplyId] = useState<string | null>(null);

  // Create form state
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "OSP",
    isActive: true,
  });
  const [items, setItems] = useState<NewItemRow[]>([EMPTY_ITEM]);

  // Apply form state
  const [applyForm, setApplyForm] = useState({
    title: "",
    area: "",
    estimatedUnits: "",
  });

  const { data: response, isLoading } = useApi<TemplateListResponse>(
    "/api/planning/templates?page=1&limit=50",
    {
      onError: () => toast.error("Gagal memuat template"),
    },
  );

  const templates = response?.data ?? [];

  const addItem = () => setItems([...items, EMPTY_ITEM]);
  const removeItem = (index: number) =>
    setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: keyof NewItemRow, value: string) =>
    setItems(
      items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    );

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("Nama template wajib diisi");
      return;
    }
    const validItems = items.filter((i) => i.name.trim() && i.quantity);
    if (validItems.length === 0) {
      toast.error("Minimal 1 item wajib diisi");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        type: form.type,
        isActive: form.isActive,
        items: validItems.map(
          (
            i,
          ): {
            name: string;
            description: string | null;
            quantity: number;
            unit: string;
            estimatedPrice: number | null;
          } => ({
            name: i.name.trim(),
            description: null,
            quantity: Number(i.quantity),
            unit: i.unit,
            estimatedPrice: i.estimatedPrice ? Number(i.estimatedPrice) : null,
          }),
        ),
      };

      const res = await fetch("/api/planning/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Template dibuat");
        setShowCreate(false);
        setForm({ name: "", description: "", type: "OSP", isActive: true });
        setItems([EMPTY_ITEM]);
        revalidate("/api/planning/templates?page=1&limit=50");
      } else {
        const data = await res.json();
        toast.error(data.message || data.error || "Gagal membuat template");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/planning/templates/${deleteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Template dihapus");
        setDeleteId(null);
        revalidate("/api/planning/templates?page=1&limit=50");
      } else {
        toast.error("Gagal menghapus template");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async () => {
    if (!applyId) return;
    if (
      !applyForm.title.trim() ||
      !applyForm.area.trim() ||
      !applyForm.estimatedUnits
    ) {
      toast.error("Judul, area, dan estimasi unit wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/planning/templates/${applyId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: applyForm.title.trim(),
          area: applyForm.area.trim(),
          estimatedUnits: Number(applyForm.estimatedUnits),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Planning dibuat dari template");
        setApplyId(null);
        setApplyForm({ title: "", area: "", estimatedUnits: "" });
        router.push(`/admin/planning/${data.data.id}`);
      } else {
        toast.error(data.message || data.error || "Gagal apply template");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Template Planning
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Template material untuk membuat planning lebih cepat
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)}>
            <HiOutlinePlus className="w-4 h-4" />
            Buat Template
          </Button>
        )}
      </div>

      {/* Template grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={<HiOutlineDocumentDuplicate className="w-12 h-12" />}
          title="Belum ada template"
          description="Buat template material untuk mempercepat pembuatan planning OSP."
          action={
            canCreate && (
              <Button onClick={() => setShowCreate(true)}>
                <HiOutlinePlus className="w-4 h-4" />
                Buat Template
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex flex-col"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {tpl.name}
                  </h3>
                  {tpl.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {tpl.description}
                    </p>
                  )}
                </div>
                <Badge variant={tpl.isActive ? "success" : "default"}>
                  {tpl.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
              </div>

              <div className="text-xs text-gray-400 mt-2">
                Dibuat {formatDateShort(tpl.createdAt)}
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                {canCreate && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setApplyId(tpl.id);
                      setApplyForm({ title: "", area: "", estimatedUnits: "" });
                    }}
                  >
                    <HiOutlineDocumentDuplicate className="w-4 h-4" />
                    Apply
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteId(tpl.id)}
                  >
                    <HiOutlineTrash className="w-4 h-4 text-red-500" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Buat Template Baru
              </h2>
              <button
                onClick={() => setShowCreate(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <HiOutlineXMark className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className={labelClass}>Nama Template *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Contoh: OSP Standar 100 Unit"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Deskripsi</label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={2}
                  className={inputClass}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Items Material *
                  </label>
                  <Button size="sm" variant="outline" onClick={addItem}>
                    <HiOutlinePlus className="w-4 h-4" />
                    Tambah Item
                  </Button>
                </div>
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-12 gap-2 items-start"
                    >
                      <input
                        placeholder="Nama"
                        value={item.name}
                        onChange={(e) =>
                          updateItem(index, "name", e.target.value)
                        }
                        className={`${inputClass} col-span-5`}
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(index, "quantity", e.target.value)
                        }
                        className={`${inputClass} col-span-2`}
                      />
                      <select
                        value={item.unit}
                        onChange={(e) =>
                          updateItem(index, "unit", e.target.value)
                        }
                        className={`${inputClass} col-span-2`}
                      >
                        <option value="meter">meter</option>
                        <option value="pcs">pcs</option>
                        <option value="unit">unit</option>
                        <option value="roll">roll</option>
                        <option value="box">box</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Harga"
                        value={item.estimatedPrice}
                        onChange={(e) =>
                          updateItem(index, "estimatedPrice", e.target.value)
                        }
                        className={`${inputClass} col-span-2`}
                      />
                      <button
                        onClick={() => removeItem(index)}
                        className="col-span-1 flex items-center justify-center h-9 text-red-500 hover:text-red-700"
                      >
                        <HiOutlineXMark className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                  className="rounded border-gray-300"
                />
                <label
                  htmlFor="isActive"
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  Template aktif
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white dark:bg-gray-800 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Batal
              </Button>
              <Button loading={saving} onClick={handleCreate}>
                Simpan Template
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Apply template dialog */}
      {applyId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Buat Planning dari Template
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Material items akan disalin dari template. Lengkapi data berikut.
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Judul Planning *</label>
                <input
                  value={applyForm.title}
                  onChange={(e) =>
                    setApplyForm({ ...applyForm, title: e.target.value })
                  }
                  placeholder="Contoh: Ekspansi FO Cipinang"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Area *</label>
                <input
                  value={applyForm.area}
                  onChange={(e) =>
                    setApplyForm({ ...applyForm, area: e.target.value })
                  }
                  placeholder="Cipinang, Jakarta Timur"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Estimasi Unit *</label>
                <input
                  type="number"
                  value={applyForm.estimatedUnits}
                  onChange={(e) =>
                    setApplyForm({
                      ...applyForm,
                      estimatedUnits: e.target.value,
                    })
                  }
                  placeholder="100"
                  className={inputClass}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" onClick={() => setApplyId(null)}>
                Batal
              </Button>
              <Button loading={saving} onClick={handleApply}>
                Buat Planning
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        title="Hapus Template"
        description="Yakin ingin menghapus template ini?"
        confirmText="Hapus"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
