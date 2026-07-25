"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface DepartmentFormData {
  name: string;
  description: string;
  jobDescription: string;
  isReminderTarget: boolean;
  showInMobileWO: boolean;
}

interface DepartmentFormProps {
  formData: DepartmentFormData;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  onSubmit: (e: React.SubmitEvent<HTMLFormElement>) => void;
  loading: boolean;
  submitLabel: string;
}

/** Shared form component for creating and editing departments. */
export default function DepartmentForm({
  formData,
  onChange,
  onSubmit,
  loading,
  submitLabel,
}: DepartmentFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Informasi Department
        </h2>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nama Department <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={onChange}
              required
              placeholder="IT, Human Resources, Engineering, dll."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Nama unik untuk department ini
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Deskripsi
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={onChange}
              rows={3}
              placeholder="Deskripsi singkat tentang department ini..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Job Description
            </label>
            <textarea
              name="jobDescription"
              value={formData.jobDescription}
              onChange={onChange}
              rows={4}
              placeholder="Deskripsi pekerjaan dan tanggung jawab department..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Reminder Target Checkbox */}
          <div className="flex items-center gap-3 p-4 bg-sky-50 dark:bg-sky-900/20 rounded-lg border border-sky-200 dark:border-sky-800">
            <input
              type="checkbox"
              name="isReminderTarget"
              id="isReminderTarget"
              checked={formData.isReminderTarget}
              onChange={onChange}
              className="w-5 h-5 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
            />
            <div>
              <label
                htmlFor="isReminderTarget"
                className="block text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
              >
                Tampilkan di Reminder WO
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Jika dicentang, department ini akan muncul di dropdown reminder
                Work Order
              </p>
            </div>
          </div>

          {/* Mobile WO Request Checkbox */}
          <div className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
            <input
              type="checkbox"
              name="showInMobileWO"
              id="showInMobileWO"
              checked={formData.showInMobileWO}
              onChange={onChange}
              className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
            />
            <div>
              <label
                htmlFor="showInMobileWO"
                className="block text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
              >
                Tampilkan di Mobile WO Request
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Jika dicentang, department ini akan muncul di dropdown WO
                Internal di mobile app
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Link
          href="/admin/workorders/departments"
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Batal
        </Link>
        <Button type="submit" disabled={loading} variant="default">
          {loading ? "Menyimpan..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
