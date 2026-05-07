"use client";

import { clientLogger } from "@/lib/client-logger";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import MapPicker from "@/components/admin/sites/MapPicker";
import GudangSelector from "@/components/admin/sites/GudangSelector";
import { Button } from "@/components/ui/Button";

interface Site {
  id: string;
  code: string;
  name: string;
  description: string | null;
  address: string | null;
  location: {
    latitude: number | null;
    longitude: number | null;
    attendanceRadius: number;
  };
  isActive: boolean;
  gudangs: { id: string; name: string }[];
}

export function ClientComponent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    address: "",
    latitude: "",
    longitude: "",
    attendanceRadius: "100",
    isActive: true,
    gudangIds: [] as string[],
  });

  // Fetch existing site data
  useEffect(() => {
    const fetchSite = async () => {
      try {
        const response = await fetch(`/api/admin/sites/${id}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Gagal memuat data site");
        }

        const site: Site = data.data;
        setFormData({
          code: site.code,
          name: site.name,
          description: site.description || "",
          address: site.address || "",
          latitude: site.location.latitude?.toString() || "",
          longitude: site.location.longitude?.toString() || "",
          attendanceRadius: site.location.attendanceRadius?.toString() || "100",
          isActive: site.isActive,
          gudangIds: site.gudangs ? site.gudangs.map((g) => g.id) : [],
        });
      } catch (error: unknown) {
        clientLogger.error("Error fetching site:", error);
        setError(
          error instanceof Error ? error.message : "Gagal memuat data site",
        );
      } finally {
        setFetching(false);
      }
    };

    fetchSite();
  }, [id]);

  const handleMapChange = (lat: string, lng: string) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/sites/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          latitude: formData.latitude || null,
          longitude: formData.longitude || null,
          attendanceRadius: parseInt(formData.attendanceRadius) || 100,
          gudangIds: formData.gudangIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal mengupdate site");
      }

      router.push("/admin/workorders/sites");
    } catch (error: unknown) {
      clientLogger.error("Error updating site:", error);
      setError(
        error instanceof Error ? error.message : "Gagal mengupdate site",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : name === "code"
            ? value.toUpperCase()
            : value,
    }));
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Memuat data site...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/workorders/sites"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <HiOutlineArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Edit Site
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formData.code} - {formData.name}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
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
                    onChange={handleChange}
                    required
                    placeholder="JKT-01"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent uppercase"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nama Site <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
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
                    onChange={handleChange}
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
                    onChange={handleChange}
                    rows={2}
                    placeholder="Alamat lengkap site..."
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={formData.isActive}
                      onChange={handleChange}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Site Aktif
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Pengaturan Absensi
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Radius Absensi (Meter){" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="attendanceRadius"
                    value={formData.attendanceRadius}
                    onChange={handleChange}
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
                      onChange={handleChange}
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
                      onChange={handleChange}
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
                onChange={(ids) =>
                  setFormData((prev) => ({ ...prev, gudangIds: ids }))
                }
                currentSiteId={id}
              />
            </div>

            <div className="sticky top-6">
              <MapPicker
                latitude={formData.latitude}
                longitude={formData.longitude}
                onChange={handleMapChange}
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
                  {loading ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
