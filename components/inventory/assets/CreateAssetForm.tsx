"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FiSave, FiArrowLeft } from "react-icons/fi";
import { Button } from "@/components/ui/Button";
import { clientLogger } from "@/lib/client-logger";

// Default useful life in months based on category
const USEFUL_LIFE_MAP: Record<string, number> = {
  ELEKTRONIK: 48, // 4 Years
  KENDARAAN: 96, // 8 Years
  FURNITURE: 96, // 8 Years
  BANGUNAN: 240, // 20 Years
  LAINNYA: 48,
};

interface Barang {
  id: string;
  kode: string;
  nama: string;
  kategoriAset?: string;
}

export function CreateAssetForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [barangs, setBarangs] = useState<Barang[]>([]);

  const [formData, setFormData] = useState({
    barangId: "",
    kodeAsset: "",
    purchaseDate: new Date().toISOString().split("T")[0],
    purchasePrice: "",
    usefulLife: "", // months
    residualValue: "0",
    status: "ACTIVE",
    location: "",
    assignedTo: "",
  });

  useEffect(() => {
    fetch("/api/inventory/barang?limit=1000") // Higher limit for selection
      .then((res) => res.json())
      .then((data) => {
        const result = data.data || data;
        setBarangs(result.barangs || []);
      })
      .catch((err) => clientLogger.error("Failed to fetch barang assets", err));
  }, []);

  const handleBarangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const barangId = e.target.value;
    const selectedBarang = barangs.find((b) => b.id === barangId);

    if (selectedBarang) {
      // Auto-fill logic
      const usefulLife = selectedBarang.kategoriAset
        ? USEFUL_LIFE_MAP[selectedBarang.kategoriAset] || 48
        : 48;

      // Auto-generate code if empty: AST-{BarangCode}-{Random4Digits}
      // Or better: Let backend handle sequence, but here we can suggest unique string
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const suggestedCode = `AST-${selectedBarang.kode}-${randomSuffix}`;

      setFormData((prev) => ({
        ...prev,
        barangId,
        usefulLife: String(usefulLife),
        kodeAsset: prev.kodeAsset || suggestedCode,
        // If there's a reference price in future, add here
      }));
    } else {
      setFormData((prev) => ({ ...prev, barangId }));
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = {
        ...formData,
        purchasePrice: Number(formData.purchasePrice),
        usefulLife: Number(formData.usefulLife),
        residualValue: Number(formData.residualValue),
      };

      const res = await fetch("/api/inventory/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat aset baru");

      router.push("/admin/inventory");
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menyimpan aset",
      );
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Informasi Aset
          </h2>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md border border-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Barang Selection */}
          <div className="md:col-span-2">
            <label
              htmlFor="barangId"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Nama Barang
            </label>
            <select
              id="barangId"
              name="barangId"
              value={formData.barangId}
              onChange={handleBarangChange}
              required
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">Pilih Barang...</option>
              {barangs.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.kode} - {b.nama}{" "}
                  {b.kategoriAset ? `(${b.kategoriAset})` : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Memilih barang akan mengisi otomatis Umur Ekonomis sesuai Kategori
              Aset.
            </p>
          </div>

          {/* Basic Info */}
          <div>
            <label
              htmlFor="kodeAsset"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Kode Aset
            </label>
            <input
              id="kodeAsset"
              type="text"
              name="kodeAsset"
              value={formData.kodeAsset}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              placeholder="Contoh: AST-001"
            />
          </div>

          {/* Financials */}
          <div>
            <label
              htmlFor="purchaseDate"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Tanggal Beli
            </label>
            <input
              id="purchaseDate"
              type="date"
              name="purchaseDate"
              value={formData.purchaseDate}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label
              htmlFor="purchasePrice"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Harga Beli (IDR)
            </label>
            <input
              id="purchasePrice"
              type="number"
              name="purchasePrice"
              value={formData.purchasePrice}
              onChange={handleChange}
              required
              min="0"
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              placeholder="0"
            />
          </div>
          <div>
            <label
              htmlFor="usefulLife"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Umur Ekonomis (Bulan)
            </label>
            <div className="flex gap-2">
              <input
                id="usefulLife"
                type="number"
                name="usefulLife"
                value={formData.usefulLife}
                onChange={handleChange}
                required
                min="1"
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                placeholder="Contoh: 48"
              />
              {formData.usefulLife && (
                <span className="flex items-center text-sm text-gray-500 whitespace-nowrap">
                  Estimation: {(Number(formData.usefulLife) / 12).toFixed(1)}{" "}
                  Tahun
                </span>
              )}
            </div>
          </div>
          <div>
            <label
              htmlFor="residualValue"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Nilai Residu (IDR)
            </label>
            <input
              id="residualValue"
              type="number"
              name="residualValue"
              value={formData.residualValue}
              onChange={handleChange}
              min="0"
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Location & Status */}
          <div>
            <label
              htmlFor="location"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Lokasi
            </label>
            <input
              id="location"
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              placeholder="Gudang Utama / Ruang Server"
            />
          </div>
          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="ACTIVE">ACTIVE (Di Gudang)</option>
              <option value="INSTALLED">INSTALLED (Terpasang/Customer)</option>
              <option value="REPAIR">REPAIR (Sedang Diperbaiki)</option>
              <option value="SOLD">SOLD (Terjual)</option>
              <option value="LOST">LOST</option>
              <option value="DISPOSED">DISPOSED</option>
            </select>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <Button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center"
            disabled={loading}
          >
            <FiArrowLeft className="mr-2" /> Batal
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              "Menyimpan..."
            ) : (
              <>
                <FiSave className="mr-2" /> Simpan Aset
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
