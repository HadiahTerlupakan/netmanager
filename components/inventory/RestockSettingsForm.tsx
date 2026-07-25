"use client";

import { useEffect, useState } from "react";
import { FiActivity } from "react-icons/fi";
import { Button } from "@/components/ui/Button";
import { clientLogger } from "@/lib/client-logger";
import { useApi } from "@/lib/hooks/useApi";

interface Barang {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  stockPerGudang: Array<{
    gudangId: string;
    stok: number;
  }>;
}

interface Gudang {
  id: string;
  kode: string;
  nama: string;
}

interface RestockSettings {
  barangId: string;
  gudangId: string;
  minStok: number;
  maxStok: number;
  safetyStok: number;
  leadTimeDays: number;
  avgDailyUsage?: number;
}

interface RestockSettingsFormProps {
  initialData?: RestockSettings;
  onClose: () => void;
  onSuccess: () => void;
}

export function RestockSettingsForm({
  initialData,
  onClose,
  onSuccess,
}: RestockSettingsFormProps) {
  const [formData, setFormData] = useState({
    barangId: initialData?.barangId ?? "",
    gudangId: initialData?.gudangId ?? "",
    minStok: initialData?.minStok?.toString() ?? "",
    maxStok: initialData?.maxStok?.toString() ?? "",
    safetyStok: initialData?.safetyStok?.toString() ?? "",
    leadTimeDays: initialData?.leadTimeDays?.toString() ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { data: barangData, error: barangError } = useApi<{
    barangs?: Barang[];
  }>("/api/inventory/barang?limit=100");
  const { data: gudangData, error: gudangError } = useApi<{
    gudangs?: Gudang[];
  }>("/api/inventory/gudang");
  const barangs = barangData?.barangs ?? [];
  const gudangs = gudangData?.gudangs ?? [];

  const fetchInitialError =
    barangError || gudangError ? "Gagal memuat data awal" : null;
  const displayError = error || fetchInitialError || "";

  useEffect(() => {
    if (barangError || gudangError) {
      clientLogger.error("Error fetching initial data:", {
        barangError,
        gudangError,
      });
    }
  }, [barangError, gudangError]);

  const usageUrl =
    formData.barangId && formData.gudangId
      ? `/api/inventory/analytics/usage?barangId=${formData.barangId}&gudangId=${formData.gudangId}&days=30`
      : null;
  const { data: usageData } = useApi<{ avgDailyUsage?: number }>(usageUrl);
  const avgDailyUsage =
    usageData?.avgDailyUsage ?? initialData?.avgDailyUsage ?? 0;

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();

    // Validation
    if (
      !formData.barangId ||
      !formData.gudangId ||
      !formData.minStok ||
      !formData.maxStok
    ) {
      setError("Barang, gudang, minimal stok, dan maksimal stok harus diisi");
      return;
    }

    const minStok = parseInt(formData.minStok);
    const maxStok = parseInt(formData.maxStok);
    const safetyStok = parseInt(formData.safetyStok) || 0;
    const leadTimeDays = parseInt(formData.leadTimeDays) || 7;

    if (minStok <= 0 || maxStok <= 0) {
      setError("Stok harus bernilai positif");
      return;
    }

    if (minStok >= maxStok) {
      setError("Minimal stok harus lebih kecil dari maksimal stok");
      return;
    }

    if (safetyStok < 0) {
      setError("Safety stok tidak boleh negatif");
      return;
    }

    if (leadTimeDays < 1) {
      setError("Lead time minimal 1 hari");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/inventory/restock/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          barangId: formData.barangId,
          gudangId: formData.gudangId,
          minStok,
          maxStok,
          safetyStok,
          leadTimeDays,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal menyimpan pengaturan restock");
      }

      setSuccess("Pengaturan restock berhasil disimpan!");

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (error) {
      clientLogger.error("Error saving restock settings:", error);
      setError(error instanceof Error ? error.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const selectedBarang = barangs.find((b) => b.id === formData.barangId);
  const selectedGudang = gudangs.find((g) => g.id === formData.gudangId);
  const currentStock =
    selectedBarang?.stockPerGudang?.find(
      (s) => s.gudangId === formData.gudangId,
    )?.stok ?? 0;

  // Calculate recommendations
  const minStok = parseInt(formData.minStok) || 0;
  const maxStok = parseInt(formData.maxStok) || 0;
  const safetyStok = parseInt(formData.safetyStok) || 0;
  const leadTimeDays = parseInt(formData.leadTimeDays) || 7;

  const reorderPoint = minStok + safetyStok + avgDailyUsage * leadTimeDays;
  const daysUntilStockout =
    avgDailyUsage > 0 ? Math.floor(currentStock / avgDailyUsage) : 999;
  const recommendedOrder = Math.max(0, maxStok - currentStock);

  const getRecommendationColor = () => {
    if (currentStock === 0) return "text-red-600 font-bold";
    if (currentStock <= minStok) return "text-orange-600 font-semibold";
    if (currentStock <= reorderPoint) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {displayError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-800 dark:text-red-400">
          {displayError}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-green-800 dark:text-green-400">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="barangId"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Barang *
          </label>
          <select
            id="barangId"
            value={formData.barangId}
            onChange={(e) =>
              setFormData({ ...formData, barangId: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={loading || !!initialData}
          >
            <option value="">Pilih barang</option>
            {barangs.map((barang) => (
              <option key={barang.id} value={barang.id}>
                {barang.kode} - {barang.nama}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="gudangId"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Gudang *
          </label>
          <select
            id="gudangId"
            value={formData.gudangId}
            onChange={(e) =>
              setFormData({ ...formData, gudangId: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={loading || !!initialData}
          >
            <option value="">Pilih gudang</option>
            {gudangs.map((gudang) => (
              <option key={gudang.id} value={gudang.id}>
                {gudang.kode} - {gudang.nama}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Current Status */}
      {selectedBarang && selectedGudang && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Status Saat Ini
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Barang & Gudang
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {selectedBarang.kode} di {selectedGudang.kode}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Stok Saat Ini
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {currentStock} {selectedBarang.satuan}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Pemakaian Rata-rata
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {avgDailyUsage.toFixed(1)} {selectedBarang.satuan}/hari
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Restock Parameters */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Parameter Restock
        </h3>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label
              htmlFor="minStok"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Stok Minimum (Reorder Point)
            </label>
            <input
              type="number"
              id="minStok"
              value={formData.minStok}
              onChange={(e) =>
                setFormData({ ...formData, minStok: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="10"
              min="1"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Stok minimum sebelum perlu order
            </p>
          </div>

          <div>
            <label
              htmlFor="maxStok"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Stok Maksimum
            </label>
            <input
              type="number"
              id="maxStok"
              value={formData.maxStok}
              onChange={(e) =>
                setFormData({ ...formData, maxStok: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="100"
              min="1"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Stok maksimal yang ingin dipertahankan
            </p>
          </div>

          <div>
            <label
              htmlFor="safetyStok"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Safety Stock (Buffer)
            </label>
            <input
              type="number"
              id="safetyStok"
              value={formData.safetyStok}
              onChange={(e) =>
                setFormData({ ...formData, safetyStok: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="5"
              min="0"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Buffer stok untuk antisipasi delay
            </p>
          </div>

          <div>
            <label
              htmlFor="leadTimeDays"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Lead Time (hari)
            </label>
            <input
              type="number"
              id="leadTimeDays"
              value={formData.leadTimeDays}
              onChange={(e) =>
                setFormData({ ...formData, leadTimeDays: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="7"
              min="1"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Estimasi waktu supplier mengirim barang
            </p>
          </div>
        </div>
      </div>

      {/* Prediction Preview */}
      {minStok > 0 && maxStok > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
            <FiActivity className="w-4 h-4" /> Prediksi Berdasarkan Parameter
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Reorder Point:
              </span>
              <span className="font-medium text-blue-900 dark:text-blue-300">
                {reorderPoint.toFixed(1)} {selectedBarang?.satuan}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Stok Habis Dalam:
              </span>
              <span className={`font-medium ${getRecommendationColor()}`}>
                {daysUntilStockout === 999
                  ? "N/A"
                  : `${daysUntilStockout} hari`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Rekomendasi Order:
              </span>
              <span className="font-medium text-blue-900 dark:text-blue-300">
                {recommendedOrder} {selectedBarang?.satuan}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Status Saat Ini:
              </span>
              <span className={`font-medium ${getRecommendationColor()}`}>
                {currentStock === 0
                  ? "STOK HABIS - Segera order!"
                  : currentStock <= minStok
                    ? "STOK RENDAH - Perlu order"
                    : currentStock <= reorderPoint
                      ? "STOK WASPADA - Pertimbangkan order"
                      : "STOK AMAN"}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          variant="outline"
          type="button"
          onClick={onClose}
          disabled={loading}
        >
          Batal
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Menyimpan..." : "Simpan Pengaturan"}
        </Button>
      </div>
    </form>
  );
}
