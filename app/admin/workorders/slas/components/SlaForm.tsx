"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";

const WORK_ORDER_TYPES = [
  { value: "INSTALLATION", label: "Installation" },
  { value: "TROUBLESHOOT", label: "Troubleshoot" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "UPGRADE", label: "Upgrade" },
  { value: "RELOCATION", label: "Relocation" },
  { value: "DISCONNECTION", label: "Disconnection" },
  { value: "OTHER", label: "Other" },
] as const;

const PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
  { value: "CRITICAL", label: "Critical" },
] as const;

export interface SlaFormData {
  name: string;
  description: string;
  workOrderType: string;
  priority: string;
  departmentId: string;
  responseTime: number;
  resolutionTime: number;
  businessHoursOnly: boolean;
  isActive: boolean;
}

interface DepartmentOption {
  id: string;
  name: string;
}

interface SlaFormProps {
  formData: SlaFormData;
  onChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  submitLabel: string;
}

/** Shared form untuk membuat dan mengedit aturan SLA. */
export default function SlaForm({
  formData,
  onChange,
  onSubmit,
  loading,
  submitLabel,
}: SlaFormProps) {
  const { data: departments } = useApi<DepartmentOption[]>(
    "/api/admin/departments",
  );
  const departmentList = departments ?? [];

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Informasi SLA
        </h2>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nama SLA <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={onChange}
              required
              maxLength={100}
              placeholder="Contoh: Gangguan Internet Pelanggan"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Nama unik untuk aturan SLA ini.
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
              placeholder="Penjelasan singkat tentang kapan SLA ini berlaku..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipe Work Order
              </label>
              <select
                name="workOrderType"
                value={formData.workOrderType}
                onChange={onChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Semua Tipe</option>
                {WORK_ORDER_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Kosongkan jika SLA berlaku untuk semua tipe.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Prioritas
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={onChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Semua Prioritas</option>
                {PRIORITIES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Kosongkan jika SLA berlaku untuk semua prioritas.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Department
            </label>
            <select
              name="departmentId"
              value={formData.departmentId}
              onChange={onChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Semua Department</option>
              {departmentList.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Kosongkan jika SLA berlaku untuk semua department.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Response Time (menit) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="responseTime"
                value={formData.responseTime}
                onChange={onChange}
                required
                min={0}
                step={1}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                Target waktu first-response sejak WO dibuat.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Resolution Time (menit) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="resolutionTime"
                value={formData.resolutionTime}
                onChange={onChange}
                required
                min={0}
                step={1}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                Target waktu WO selesai (closed/verified).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-sky-50 dark:bg-sky-900/20 rounded-lg border border-sky-200 dark:border-sky-800">
            <input
              type="checkbox"
              name="businessHoursOnly"
              id="businessHoursOnly"
              checked={formData.businessHoursOnly}
              onChange={onChange}
              className="w-5 h-5 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
            />
            <div>
              <label
                htmlFor="businessHoursOnly"
                className="block text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
              >
                Hanya Jam Kerja
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Jika dicentang, perhitungan SLA hanya menghitung jam kerja (di
                luar jam kerja, akhir pekan, dan hari libur tidak dihitung).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <input
              type="checkbox"
              name="isActive"
              id="isActive"
              checked={formData.isActive}
              onChange={onChange}
              className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
            />
            <div>
              <label
                htmlFor="isActive"
                className="block text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
              >
                Aktif
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Hanya SLA aktif yang akan diterapkan ke work order baru.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Link
          href="/admin/workorders/slas"
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
