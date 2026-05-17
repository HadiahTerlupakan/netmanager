"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FiCheckCircle, FiAlertTriangle, FiXCircle } from "react-icons/fi";
import { PhotoUpload } from "./PhotoUpload";
import type { PhotoUploadRef, UploadedPhoto } from "./PhotoUpload";
import { Button } from "@/components/ui/Button";
import { getWithAuth, postWithAuth } from "@/lib/api-client";
import {
  getStockStatusColor,
  getKondisiColor,
} from "@/lib/utils/inventory-helpers";
import { clientLogger } from "@/lib/client-logger";

interface Barang {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  stockPerGudang?: Array<{
    gudangId: string;
    stok: number;
  }>;
}

interface Gudang {
  id: string;
  kode: string;
  nama: string;
  lokasi?: string;
}

interface TransferFormProps {
  initialData?: unknown;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TransferForm({
  initialData: _initialData,
  onClose,
  onSuccess,
}: TransferFormProps) {
  const [formData, setFormData] = useState({
    barangId: "",
    dariGudangId: "",
    keGudangId: "",
    jumlah: "",
    kondisi: "BARU" as "BARU" | "BEKAS" | "RUSAK",
    keterangan: "",
  });
  const [barangs, setBarangs] = useState<Barang[]>([]);
  const [gudangs, setGudangs] = useState<Gudang[]>([]);
  const [stockSumber, setStockSumber] = useState(0);
  const [stockPerKondisi, setStockPerKondisi] = useState({
    BARU: 0,
    BEKAS: 0,
    RUSAK: 0,
  });
  const [stockGudangSumber, setStockGudangSumber] = useState<Gudang | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [_uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [transactionId, _setTransactionId] = useState<string | null>(null);
  const photoUploadRef = useRef<PhotoUploadRef>(null);
  const [tempId] = useState<string>(() => `temp-${Date.now()}`);
  const router = useRouter();

  useEffect(() => {
    async function fetchInitialData() {
      try {
        // Fetch barang
        const barangResponse = await getWithAuth(
          "/api/inventory/barang?limit=100",
        );
        const barangData = await barangResponse.json();
        const barangResult = barangData.data || barangData;
        setBarangs(barangResult.barangs || []);

        // Fetch gudang
        const gudangResponse = await getWithAuth("/api/inventory/gudang");
        const gudangData = await gudangResponse.json();
        const gudangResult = gudangData.data || gudangData;
        setGudangs(gudangResult.gudangs || []);
      } catch (error) {
        clientLogger.error("Error fetching initial data:", error);
        setError("Gagal memuat data awal");
      }
    }

    fetchInitialData();
  }, []);

  useEffect(() => {
    async function fetchStockByCondition() {
      if (formData.barangId && formData.dariGudangId) {
        try {
          // Fetch condition-specific stock from API
          const response = await getWithAuth(
            `/api/inventory/barang/stock/by-kondisi?barangId=${formData.barangId}&gudangId=${formData.dariGudangId}`,
          );
          if (response.ok) {
            const data = await response.json();
            const result = data.data || data;
            setStockPerKondisi(
              result.stockPerKondisi || { BARU: 0, BEKAS: 0, RUSAK: 0 },
            );
            setStockSumber(result.totalStock || 0);
            setStockGudangSumber(result.gudang || null);
          } else {
            // Fallback to current logic if API fails
            const selectedBarang = barangs.find(
              (b) => b.id === formData.barangId,
            );
            setStockGudangSumber(null);
            if (selectedBarang) {
              const stockInfo = selectedBarang.stockPerGudang?.find(
                (s: { gudangId: string; stok: number }) =>
                  s.gudangId === formData.dariGudangId,
              );
              setStockSumber(stockInfo?.stok || 0);
            }
          }
        } catch (error) {
          clientLogger.error("Error fetching stock by condition:", error);
          // Fallback to current logic
          const selectedBarang = barangs.find(
            (b) => b.id === formData.barangId,
          );
          setStockGudangSumber(null);
          if (selectedBarang) {
            const stockInfo = selectedBarang.stockPerGudang?.find(
              (s: { gudangId: string; stok: number }) =>
                s.gudangId === formData.dariGudangId,
            );
            setStockSumber(stockInfo?.stok || 0);
          }
        }
      } else {
        setStockPerKondisi({ BARU: 0, BEKAS: 0, RUSAK: 0 });
        setStockSumber(0);
        setStockGudangSumber(null);
      }
    }

    fetchStockByCondition();
  }, [formData.barangId, formData.dariGudangId, barangs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (
      !formData.barangId ||
      !formData.dariGudangId ||
      !formData.keGudangId ||
      !formData.jumlah
    ) {
      setError("Barang, gudang sumber, gudang tujuan, dan jumlah harus diisi");
      return;
    }

    if (formData.dariGudangId === formData.keGudangId) {
      setError("Gudang sumber dan tujuan tidak boleh sama");
      return;
    }

    const jumlah = parseInt(formData.jumlah);
    if (isNaN(jumlah) || jumlah <= 0) {
      setError("Jumlah harus berupa angka positif");
      return;
    }

    const availableStockForCondition = stockPerKondisi[formData.kondisi] || 0;
    if (jumlah > availableStockForCondition) {
      setError(
        `Jumlah ${formData.kondisi.toLowerCase()} tidak boleh melebihi stok tersedia (${availableStockForCondition})`,
      );
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Upload photos first if any exist
      let fotoBuktiUrls: string[] = [];
      let uploadedPhotosList: UploadedPhoto[] = [];

      if (photoUploadRef.current) {
        const currentPhotos = photoUploadRef.current.getPhotos();

        if (currentPhotos.length > 0) {
          setSuccess("Mengunggah foto...");

          // Upload photos
          fotoBuktiUrls = await photoUploadRef.current.uploadPhotos();

          // Get updated photos after upload
          uploadedPhotosList = photoUploadRef.current.getPhotos();

          // Check if any photos failed to upload
          const failedPhotos = uploadedPhotosList.filter(
            (photo) => photo.status === "error",
          );
          if (failedPhotos.length > 0) {
            throw new Error(
              `Beberapa foto gagal diunggah: ${failedPhotos.map((p) => p.error).join(", ")}`,
            );
          }
        }
      }

      const response = await postWithAuth("/api/inventory/transfer", {
        ...formData,
        jumlah,
        fotoBukti: fotoBuktiUrls,
        fotoMetadata:
          uploadedPhotosList.length > 0
            ? {
                uploadedAt: new Date().toISOString(),
                count: uploadedPhotosList.length,
                totalSize: uploadedPhotosList.reduce(
                  (sum, photo) => sum + (photo.file?.size || 0),
                  0,
                ),
              }
            : null,
      });

      const data = await response.json();

      if (!data.success) {
        // Cleanup uploaded photos if transfer failed
        if (fotoBuktiUrls.length > 0) {
          try {
            await Promise.allSettled(
              fotoBuktiUrls.map((url) =>
                fetch(url.replace("/uploads/", "/api/uploads/delete/"), {
                  method: "DELETE",
                }).catch((err) =>
                  clientLogger.error("Failed to cleanup photo:", err),
                ),
              ),
            );
          } catch (cleanupError) {
            clientLogger.error("Error during photo cleanup:", cleanupError);
          }
        }
        throw new Error(data.error || "Gagal melakukan transfer");
      }

      const result = data.data || data;
      setSuccess(`Transfer berhasil! Kode transfer: ${result.kodeTransfer}`);

      // Reset form
      setFormData({
        barangId: "",
        dariGudangId: "",
        keGudangId: "",
        jumlah: "",
        kondisi: "BARU",
        keterangan: "",
      });
      setStockSumber(0);
      setStockPerKondisi({ BARU: 0, BEKAS: 0, RUSAK: 0 });
      setUploadedPhotos([]);
      // Reset photo upload component
      if (photoUploadRef.current) {
        photoUploadRef.current.resetPhotos();
      }

      // Close form after 2 seconds
      setTimeout(() => {
        onClose();
        if (onSuccess) {
          onSuccess();
        }
        // Refresh the page to show updated data
        router.refresh();
      }, 2000);
    } catch (error) {
      clientLogger.error("Error submitting transfer:", error);
      setError(error instanceof Error ? error.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const selectedBarang = barangs.find((b) => b.id === formData.barangId);
  const selectedGudangSumber = gudangs.find(
    (g) => g.id === formData.dariGudangId,
  );
  const resolvedGudangSumber = selectedGudangSumber || stockGudangSumber;
  const selectedGudangTujuan = gudangs.find(
    (g) => g.id === formData.keGudangId,
  );

  // Filter gudang tujuan to exclude gudang sumber
  const availableGudangTujuan = gudangs.filter(
    (g) => g.id !== formData.dariGudangId,
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-800 dark:text-red-400">
          {error}
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
            htmlFor="dariGudangId"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Gudang Sumber *
          </label>
          <select
            id="dariGudangId"
            value={formData.dariGudangId}
            onChange={(e) =>
              setFormData({ ...formData, dariGudangId: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={loading}
          >
            <option value="">Pilih gudang sumber</option>
            {gudangs.map((gudang) => (
              <option key={gudang.id} value={gudang.id}>
                {gudang.kode} - {gudang.nama}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="keGudangId"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Gudang Tujuan *
          </label>
          <select
            id="keGudangId"
            value={formData.keGudangId}
            onChange={(e) =>
              setFormData({ ...formData, keGudangId: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={loading || !formData.dariGudangId}
          >
            <option value="">Pilih gudang tujuan</option>
            {availableGudangTujuan.map((gudang) => (
              <option key={gudang.id} value={gudang.id}>
                {gudang.kode} - {gudang.nama}
              </option>
            ))}
          </select>
        </div>
      </div>

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
            disabled={loading}
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
            htmlFor="kondisi"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Kondisi Barang *
          </label>
          <select
            id="kondisi"
            value={formData.kondisi}
            onChange={(e) =>
              setFormData({
                ...formData,
                kondisi: e.target.value as "BARU" | "BEKAS" | "RUSAK",
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={loading}
          >
            <option value="BARU" disabled={stockPerKondisi.BARU === 0}>
              Baru{" "}
              {stockPerKondisi.BARU > 0
                ? `(${stockPerKondisi.BARU})`
                : "(Tidak tersedia)"}
            </option>
            <option value="BEKAS" disabled={stockPerKondisi.BEKAS === 0}>
              Bekas{" "}
              {stockPerKondisi.BEKAS > 0
                ? `(${stockPerKondisi.BEKAS})`
                : "(Tidak tersedia)"}
            </option>
            <option value="RUSAK" disabled={stockPerKondisi.RUSAK === 0}>
              Rusak{" "}
              {stockPerKondisi.RUSAK > 0
                ? `(${stockPerKondisi.RUSAK})`
                : "(Tidak tersedia)"}
            </option>
          </select>
          <div className="mt-1">
            <span
              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getKondisiColor(formData.kondisi)}`}
            >
              {formData.kondisi === "BARU" && "Baru - Siap pakai"}
              {formData.kondisi === "BEKAS" && "Bekas - Pernah dipakai"}
              {formData.kondisi === "RUSAK" && "Rusak - Perlu perbaikan"}
            </span>
          </div>
        </div>
      </div>

      {/* Selected Barang & Gudang Info */}
      {(selectedBarang || resolvedGudangSumber || selectedGudangTujuan) && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {selectedBarang && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Barang terpilih:
                </p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {selectedBarang.kode} - {selectedBarang.nama}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Satuan: {selectedBarang.satuan}
                </p>
              </div>
            )}
            {resolvedGudangSumber && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Gudang sumber:
                </p>
                <p className="font-medium text-red-600 dark:text-red-400">
                  {resolvedGudangSumber.kode} - {resolvedGudangSumber.nama}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Lokasi: {resolvedGudangSumber.lokasi || "-"}
                </p>
              </div>
            )}
            {selectedGudangTujuan && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Gudang tujuan:
                </p>
                <p className="font-medium text-green-600 dark:text-green-400">
                  {selectedGudangTujuan.kode} - {selectedGudangTujuan.nama}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Lokasi: {selectedGudangTujuan.lokasi || "-"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stock Info */}
      {stockSumber >= 0 && selectedBarang && resolvedGudangSumber && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                Stok tersedia di {resolvedGudangSumber.nama}:
              </p>
              <p
                className={`text-2xl font-bold ${getStockStatusColor(stockSumber)}`}
              >
                {stockSumber} {selectedBarang.satuan}
              </p>
            </div>
            <div className="text-right">
              {stockSumber === 0 && (
                <p className="flex items-center justify-end gap-1 text-sm text-red-500">
                  <FiXCircle className="w-4 h-4" /> Stok habis!
                </p>
              )}
              {stockSumber > 0 && stockSumber < 5 && (
                <p className="flex items-center justify-end gap-1 text-sm text-yellow-500">
                  <FiAlertTriangle className="w-4 h-4" /> Stok menipis!
                </p>
              )}
              {stockSumber >= 5 && (
                <p className="flex items-center justify-end gap-1 text-sm text-green-500">
                  <FiCheckCircle className="w-4 h-4" /> Stok tersedia
                </p>
              )}
            </div>
          </div>

          {/* Stock per Kondisi */}
          <div className="border-t border-blue-200 dark:border-blue-700 pt-3">
            <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">
              Stok per Kondisi:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div
                className={`text-center p-2 rounded ${
                  formData.kondisi === "BARU"
                    ? "bg-green-100 ring-2 ring-green-500"
                    : "bg-white/50"
                }`}
              >
                <p className="text-xs text-green-700 font-medium">Baru</p>
                <p className="text-sm font-bold text-green-800">
                  {stockPerKondisi.BARU}
                </p>
              </div>
              <div
                className={`text-center p-2 rounded ${
                  formData.kondisi === "BEKAS"
                    ? "bg-yellow-100 ring-2 ring-yellow-500"
                    : "bg-white/50"
                }`}
              >
                <p className="text-xs text-yellow-700 font-medium">Bekas</p>
                <p className="text-sm font-bold text-yellow-800">
                  {stockPerKondisi.BEKAS}
                </p>
              </div>
              <div
                className={`text-center p-2 rounded ${
                  formData.kondisi === "RUSAK"
                    ? "bg-red-100 ring-2 ring-red-500"
                    : "bg-white/50"
                }`}
              >
                <p className="text-xs text-red-700 font-medium">Rusak</p>
                <p className="text-sm font-bold text-red-800">
                  {stockPerKondisi.RUSAK}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="jumlah"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Jumlah Transfer *
          </label>
          <div className="relative">
            <input
              type="number"
              id="jumlah"
              value={formData.jumlah}
              onChange={(e) =>
                setFormData({ ...formData, jumlah: e.target.value })
              }
              className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="0"
              min="1"
              max={stockPerKondisi[formData.kondisi] || 0}
              disabled={loading || stockSumber === 0}
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
              {selectedBarang?.satuan || "pcs"}
            </span>
          </div>
          {stockPerKondisi[formData.kondisi] > 0 && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Maks: {stockPerKondisi[formData.kondisi]}{" "}
              {selectedBarang?.satuan || "pcs"}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="tanggal"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Tanggal Transfer
          </label>
          <input
            type="date"
            id="tanggal"
            defaultValue={new Date().toISOString().split("T")[0]}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={loading}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="keterangan"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Keterangan Transfer
        </label>
        <textarea
          id="keterangan"
          value={formData.keterangan}
          onChange={(e) =>
            setFormData({ ...formData, keterangan: e.target.value })
          }
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="Contoh: Transfer untuk cabang bulan Desember"
          disabled={loading}
        />
      </div>

      {/* Foto Bukti */}
      <div>
        <PhotoUpload
          ref={photoUploadRef}
          transactionId={transactionId || tempId}
          transactionType="inventory-transfer"
          onPhotosChange={setUploadedPhotos}
          maxPhotos={3}
          maxSizeMB={5}
          disabled={loading}
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          variant="outline"
          type="button"
          onClick={onClose}
          disabled={loading}
        >
          Batal
        </Button>
        <Button
          type="submit"
          disabled={
            loading ||
            stockSumber === 0 ||
            !formData.keGudangId ||
            (stockPerKondisi[formData.kondisi] || 0) === 0
          }
        >
          {loading ? "Mentransfer..." : "Transfer Barang"}
        </Button>
      </div>
    </form>
  );
}
