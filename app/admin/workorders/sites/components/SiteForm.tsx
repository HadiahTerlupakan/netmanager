"use client";

import Link from "next/link";
import MapPicker from "@/components/admin/sites/MapPicker";
import GudangSelector from "@/components/admin/sites/GudangSelector";
import { Button } from "@/components/ui/Button";

interface SiteFormData {
  code: string;
  name: string;
  description: string;
  address: string;
  latitude: string;
  longitude: string;
  attendanceRadius: string;
  isActive?: boolean;
  gudangIds: string[];
}

interface SiteFormProps {
  formData: SiteFormData;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  onMapChange: (lat: string, lng: string) => void;
  onGudangChange: (ids: string[]) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  submitLabel: string;
  /** Show isActive checkbox (only for edit mode). */
  showIsActive?: boolean;
  /** Current site ID for GudangSelector exclusion (edit mode). */
  currentSiteId?: string;
}

/** Shared form component for creating and editing sites. */
export default function SiteForm({
  formData,
  onChange,
  onMapChange,
  onGudangChange,
  onSubmit,
  loading,
  submitLabel,
  showIsActive = false,
  currentSiteId,
}: SiteFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Inputs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Informasi Site
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Kode Site <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={onChange}
                  required
                  placeholder="JKT-01"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent uppercase"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Kode unik untuk site ini (huruf kapital)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nama Site <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={onChange}
                  required
                  placeholder="Jakarta Pusat"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Deskripsi
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={onChange}
                  rows={2}
                  placeholder="Deskripsi singkat tentang site ini..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Alamat
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={onChange}
                  rows={2}
                  placeholder="Alamat lengkap site..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {showIsActive && (
                <div className="md:col-span-2">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={formData.isActive ?? true}
                      onChange={onChange}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Site Aktif
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Pengaturan Absensi
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Radius Absensi (Meter) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="attendanceRadius"
                  value={formData.attendanceRadius}
                  onChange={onChange}
                  required
                  min="10"
                  placeholder="100"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Jarak maksimal dari titik koordinat.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Latitude <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="latitude"
                    value={formData.latitude}
                    onChange={onChange}
                    required
                    placeholder="-6.200000"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Longitude <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="longitude"
                    value={formData.longitude}
                    onChange={onChange}
                    required
                    placeholder="106.816666"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Map & Gudang */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <GudangSelector
              selectedIds={formData.gudangIds}
              onChange={onGudangChange}
              {...(currentSiteId ? { currentSiteId } : {})}
            />
          </div>

          <div className="sticky top-6">
            <MapPicker
              latitude={formData.latitude}
              longitude={formData.longitude}
              onChange={onMapChange}
            />

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <Link
                href="/admin/workorders/sites"
                className="flex-1 px-4 py-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Batal
              </Link>
              <Button
                type="submit"
                disabled={loading}
                variant="default"
                className="flex-1"
              >
                {loading ? "Menyimpan..." : submitLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
