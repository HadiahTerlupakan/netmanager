"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { fetchWithHandling } from "@/lib/utils/fetch-wrapper";
import { clientLogger } from "@/lib/client-logger";

type AnnouncementTarget = "ALL" | "CUSTOMER" | "EMPLOYEE" | "ADMIN";

interface AnnouncementFormProps {
  initialData?: {
    id?: string;
    title: string;
    content: string;
    target: AnnouncementTarget | string;
    isActive: boolean;
    isPinned: boolean;
    startDate: string | null;
    endDate: string | null;
  };
  isEdit?: boolean;
}

interface FormState {
  title: string;
  content: string;
  target: AnnouncementTarget;
  isActive: boolean;
  isPinned: boolean;
  startDate: string;
  endDate: string;
}

function normalizeAnnouncementTarget(
  target?: AnnouncementTarget | string,
): AnnouncementTarget {
  if (target === "CUSTOMER" || target === "EMPLOYEE" || target === "ADMIN")
    return target;
  return "ALL";
}

function toLocalISOString(dateString: string | null) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const offsetMs = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - offsetMs);
  return localDate.toISOString().slice(0, 16);
}

function buildSubmitPayload(formData: FormState) {
  return {
    ...formData,
    startDate: formData.startDate
      ? new Date(formData.startDate).toISOString()
      : null,
    endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
  };
}

export default function AnnouncementForm({
  initialData,
  isEdit = false,
}: AnnouncementFormProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [formData, setFormData] = useState<FormState>({
    title: initialData?.title || "",
    content: initialData?.content || "",
    target: normalizeAnnouncementTarget(initialData?.target),
    isActive: initialData?.isActive ?? true,
    isPinned: initialData?.isPinned ?? false,
    startDate: toLocalISOString(initialData?.startDate || null),
    endDate: toLocalISOString(initialData?.endDate || null),
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (
      formData.startDate &&
      formData.endDate &&
      new Date(formData.endDate) <= new Date(formData.startDate)
    ) {
      showToast("error", "Tanggal berakhir harus setelah tanggal mulai");
      return;
    }

    setSaving(true);

    try {
      const url = isEdit
        ? `/api/announcements/${initialData?.id}`
        : "/api/announcements";

      const res = await fetchWithHandling(url, {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify(buildSubmitPayload(formData)),
      });

      if (!res.success) {
        throw new Error(res.error || "Gagal menyimpan pengumuman");
      }

      showToast(
        "success",
        isEdit
          ? "Pengumuman berhasil diperbarui"
          : "Pengumuman berhasil dibuat",
      );
      router.push("/admin/announcement");
      router.refresh();
    } catch (error) {
      clientLogger.error("Failed to save announcement", error);
      const message =
        error instanceof Error ? error.message : "Gagal menyimpan pengumuman";
      showToast("error", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 max-w-2xl mx-auto"
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Judul
          </label>
          <input
            type="text"
            name="title"
            required
            value={formData.title}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Konten
          </label>
          <textarea
            name="content"
            required
            rows={4}
            value={formData.content}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Audiens Target
          </label>
          <select
            name="target"
            value={formData.target}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 dark:bg-gray-700 dark:text-white"
          >
            <option value="ALL">Semua Pengguna</option>
            <option value="CUSTOMER">Pelanggan Saja</option>
            <option value="EMPLOYEE">Karyawan Saja</option>
            <option value="ADMIN">Admin Saja</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Tanggal Mulai
            </label>
            <input
              type="datetime-local"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Tanggal Berakhir
            </label>
            <input
              type="datetime-local"
              name="endDate"
              min={formData.startDate || undefined}
              value={formData.endDate}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              name="isActive"
              id="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label
              htmlFor="isActive"
              className="ml-2 block text-sm text-gray-900 dark:text-gray-300"
            >
              Aktif
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="isPinned"
              id="isPinned"
              checked={formData.isPinned}
              onChange={handleChange}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label
              htmlFor="isPinned"
              className="ml-2 block text-sm text-gray-900 dark:text-gray-300"
            >
              Disematkan
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Link
            href="/admin/announcement"
            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Batal
          </Link>
          <Button type="submit" disabled={saving} loading={saving}>
            Simpan Pengumuman
          </Button>
        </div>
      </div>
    </form>
  );
}
