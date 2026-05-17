"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PhotoUpload } from "./PhotoUpload";
import type { PhotoUploadRef } from "./PhotoUpload";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import {
  getStockStatusColor,
  getKondisiColor,
} from "@/lib/utils/inventory-helpers";
import { clientLogger } from "@/lib/client-logger";

interface MasukFormProps {
  initialData?: {
    id?: string;
    barangId: string;
    gudangId: string;
    jumlah: number;
    hargaBeliSatuan?: number;
    kondisi: "BARU" | "BEKAS" | "RUSAK";
    keterangan?: string;
    tanggal?: string;
    barang?: {
      id: string;
      kode: string;
      nama: string;
      satuan: string;
      stockPerGudang?: Array<{ gudangId: string; stok: number }>;
    };
  };
  onClose: () => void;
}

export function MasukForm({ initialData, onClose }: MasukFormProps) {
  const [formData, setFormData] = useState({
    barangId: "",
    gudangId: "",
    jumlah: "",
    hargaBeliSatuan: "", // Added field
    kondisi: "BARU" as "BARU" | "BEKAS" | "RUSAK",
    keterangan: "",
    tanggal: new Date().toISOString().split("T")[0],
  });
  const [barangs, setBarangs] = useState<
    {
      id: string;
      kode: string;
      nama: string;
      satuan: string;
      stockPerGudang?: Array<{ gudangId: string; stok: number }>;
    }[]
  >([]);
  const [gudangs, setGudangs] = useState<
    {
      id: string;
      kode: string;
      nama: string;
      lokasi?: string;
    }[]
  >([]);
  const [currentStock, setCurrentStock] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploadedPhotos, setUploadedPhotos] = useState<
    { status: string; error?: string }[]
  >([]);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  // Persist the full details of the selected barang so it doesn't disappear if search results update
  const [persistedBarang, setPersistedBarang] = useState<{
    id: string;
    kode: string;
    nama: string;
    satuan: string;
    stockPerGudang?: Array<{ gudangId: string; stok: number }>;
  } | null>(null);

  const photoUploadRef = useRef<PhotoUploadRef>(null);
  const [tempId] = useState<string>(() => `temp-${Date.now()}`);

  const fetchBarangs = async (query = "") => {
    setIsSearching(true);
    try {
      const params = new URLSearchParams();
      params.append("limit", "50");
      if (query) params.append("search", query);

      const response = await fetch(
        `/api/inventory/barang?${params.toString()}`,
      );
      const data = await response.json();
      // Standardized apiSuccess: { success: true, data: { barangs, pagination } }
      const result = data.data || data;
      setBarangs(result.barangs || []);
    } catch (err) {
      clientLogger.error("Error fetching barangs:", err);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    async function fetchInitialData() {
      try {
        // Fetch initial barang list
        await fetchBarangs();

        // Fetch gudang
        const gudangResponse = await fetch("/api/inventory/gudang");
        const gudangData = await gudangResponse.json();
        // Standardized apiSuccess: { success: true, data: { gudangs } }
        const gudangResult = gudangData.data || gudangData;
        setGudangs(gudangResult.gudangs || []);

        // If in edit mode, populate form with initial data
        if (initialData) {
          setFormData({
            barangId: initialData.barangId || "",
            gudangId: initialData.gudangId || "",
            jumlah: initialData.jumlah?.toString() || "",
            hargaBeliSatuan: initialData.hargaBeliSatuan?.toString() || "",
            kondisi: initialData.kondisi || "BARU",
            keterangan: initialData.keterangan || "",
            tanggal: initialData.tanggal
              ? new Date(initialData.tanggal).toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0],
          });
          setTransactionId(initialData.id || null);

          // If we have an initial barangId, we might need to fetch its details explicitly if not in the list
          // But usually initialData should contain the barang object too?
          // If initialData.barang exists, set it as persisted
          if (initialData.barang) {
            setPersistedBarang(initialData.barang);
          }
        }
      } catch (error) {
        clientLogger.error("Error fetching initial data:", error);
        setError("Gagal memuat data awal");
      }
    }

    fetchInitialData();
  }, [initialData]);

  // Logic to determine the currently active barang details
  // 1. Try to find in the current list
  // 2. If not found, use the persisted one if IDs match
  const selectedBarang =
    barangs.find((b) => b.id === formData.barangId) ||
    (persistedBarang?.id === formData.barangId ? persistedBarang : undefined);

  useEffect(() => {
    async function fetchCurrentStock() {
      if (formData.barangId && formData.gudangId) {
        try {
          // Use selectedBarang (which could be persisted)
          if (selectedBarang) {
            const stockInfo = selectedBarang.stockPerGudang?.find(
              (s: { gudangId: string; stok: number }) =>
                s.gudangId === formData.gudangId,
            );
            setCurrentStock(stockInfo?.stok || 0);
          }
        } catch (error) {
          clientLogger.error("Error fetching current stock:", error);
        }
      } else {
        setCurrentStock(0);
      }
    }

    fetchCurrentStock();
  }, [formData.barangId, formData.gudangId, selectedBarang]);

  const resetForm = useCallback(() => {
    setFormData({
      barangId: "",
      gudangId: "",
      jumlah: "",
      hargaBeliSatuan: "",
      kondisi: "BARU",
      keterangan: "",
      tanggal: new Date().toISOString().split("T")[0],
    });
    setCurrentStock(0);
    setUploadedPhotos([]);
    setTransactionId(null);
    setPersistedBarang(null);
    onClose();
  }, [onClose]);

  // Handle photo upload completion via uploadedPhotos comparator (selama render)
  const [prevPhotosKey, setPrevPhotosKey] = useState<string | null>(null);
  const photosKey = transactionId
    ? `${transactionId}|${uploadedPhotos.length}|${uploadedPhotos.map((p) => p.status).join(",")}`
    : null;
  if (photosKey && prevPhotosKey !== photosKey) {
    setPrevPhotosKey(photosKey);
    if (transactionId && uploadedPhotos.length > 0) {
      const allUploaded = uploadedPhotos.every(
        (photo) => photo.status === "success",
      );
      const hasError = uploadedPhotos.some((photo) => photo.status === "error");

      if (allUploaded) {
        setSuccess("Barang masuk berhasil dicatat! Foto berhasil diunggah.");

        // Reset form after a short delay
        setTimeout(() => {
          resetForm();
        }, 2000);
      } else if (hasError) {
        setSuccess(
          "Barang masuk berhasil dicatat, namun beberapa foto gagal diunggah.",
        );
      }
    }
  }

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleBarangChange = (value: string) => {
    setFormData((prev) => ({ ...prev, barangId: value }));
    setError("");

    // Update persisted barang when selection changes
    const item = barangs.find((b) => b.id === value);
    if (item) {
      setPersistedBarang(item);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    // Validation - only validate in create mode
    if (!initialData) {
      if (!formData.barangId || !formData.gudangId || !formData.jumlah) {
        setError("Barang, gudang, dan jumlah harus diisi");
        return;
      }

      const jumlah = parseInt(formData.jumlah);
      if (isNaN(jumlah) || jumlah <= 0) {
        setError("Jumlah harus berupa angka positif");
        return;
      }
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (initialData) {
        // Edit mode - we already have a transaction ID
        if (uploadedPhotos.length > 0) {
          setSuccess("Mengunggah foto...");
          // The PhotoUpload component will handle the upload automatically
        } else {
          setSuccess("Tidak ada foto baru untuk diunggah");
          setTimeout(() => {
            onClose();
          }, 1000);
        }
      } else {
        // Create mode
        const jumlah = parseInt(formData.jumlah);

        // Upload photos first if any exist
        let fotoBuktiUrls: string[] = [];
        let uploadedPhotosList: {
          status: string;
          file?: File;
          error?: string;
        }[] = [];

        if (photoUploadRef.current) {
          const currentPhotos = photoUploadRef.current.getPhotos();

          if (currentPhotos.length > 0) {
            setSuccess("Mengunggah foto...");
            fotoBuktiUrls = await photoUploadRef.current.uploadPhotos();
            uploadedPhotosList = photoUploadRef.current.getPhotos();

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

        const response = await fetch("/api/inventory/masuk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            barangId: String(formData.barangId),
            gudangId: String(formData.gudangId),
            jumlah: Number(jumlah),
            hargaBeliSatuan: Number(formData.hargaBeliSatuan || 0),
            kondisi: String(formData.kondisi),
            keterangan: String(formData.keterangan || ""),
            tanggal: String(formData.tanggal),
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
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Gagal mencatat barang masuk");
        }

        const result = data.data || data;
        if (result.masukId) {
          setTransactionId(result.masukId);
          setSuccess("Barang masuk berhasil dicatat!");

          setTimeout(() => {
            resetForm();
            if (photoUploadRef.current) {
              photoUploadRef.current.resetPhotos();
            }
          }, 1500);
        } else {
          setSuccess("Barang masuk berhasil dicatat!");
          setTimeout(() => {
            resetForm();
          }, 1000);
        }
      }
    } catch (error) {
      clientLogger.error("Error submitting barang masuk:", error);
      setError(error instanceof Error ? error.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const selectedGudang = gudangs.find((g) => g.id === formData.gudangId);

  // Combine barangs with persistedBarang for the Options list to ensure selected item is always visible
  const barangOptions = barangs.map((b) => ({
    value: b.id,
    label: `${b.kode} - ${b.nama}`,
  }));

  // Ensure the persisted/selected item is in the options list if it's not already
  if (persistedBarang && !barangs.find((b) => b.id === persistedBarang.id)) {
    barangOptions.unshift({
      value: persistedBarang.id,
      label: `${persistedBarang.kode} - ${persistedBarang.nama}`,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Form Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {initialData ? "Edit Barang Masuk" : "Catat Barang Masuk"}
        </h2>
        {initialData && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tambahkan foto untuk dokumentasi transaksi yang sudah ada
          </p>
        )}
      </div>

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
        <div className="flex flex-col">
          <label
            htmlFor="barangId"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Barang *
          </label>
          <Combobox
            value={formData.barangId}
            onChange={handleBarangChange}
            options={barangOptions}
            placeholder="Cari & pilih barang..."
            disabled={loading || !!initialData}
            onSearch={fetchBarangs}
            loading={isSearching}
            className="w-full"
          />
          {initialData && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Barang tidak dapat diubah pada mode edit
            </p>
          )}
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
            name="gudangId"
            value={formData.gudangId}
            onChange={handleInputChange}
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
          {initialData && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Gudang tidak dapat diubah pada mode edit
            </p>
          )}
        </div>
      </div>

      {/* Selected Barang & Gudang Info */}
      {(selectedBarang || selectedGudang) && (
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
            {selectedGudang && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Gudang terpilih:
                </p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {selectedGudang.kode} - {selectedGudang.nama}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Lokasi: {selectedGudang.lokasi || "-"}
                </p>
              </div>
            )}
            {currentStock >= 0 && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Stok saat ini:
                </p>
                <p className={`text-lg ${getStockStatusColor(currentStock)}`}>
                  {currentStock} {selectedBarang?.satuan || "pcs"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {currentStock === 0 && "Stok kosong"}
                  {currentStock > 0 && currentStock < 5 && "Stok menipis"}
                  {currentStock >= 5 && "Stok aman"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="jumlah"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Jumlah *
          </label>
          <div className="relative">
            <input
              type="number"
              id="jumlah"
              name="jumlah"
              value={formData.jumlah}
              onChange={handleInputChange}
              className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="0"
              min="1"
              disabled={loading || !!initialData}
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
              {selectedBarang?.satuan || "pcs"}
            </span>
          </div>
          {initialData && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Jumlah tidak dapat diubah pada mode edit
            </p>
          )}
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
            name="kondisi"
            value={formData.kondisi}
            onChange={(e) => {
              const { value } = e.target;
              setFormData((prev) => ({
                ...prev,
                kondisi: value as "BARU" | "BEKAS" | "RUSAK",
              }));
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={loading || !!initialData}
          >
            <option value="BARU">Baru</option>
            <option value="BEKAS">Bekas</option>
            <option value="RUSAK">Rusak</option>
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
          {initialData && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Kondisi tidak dapat diubah pada mode edit
            </p>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="tanggal"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Tanggal
        </label>
        <input
          type="date"
          id="tanggal"
          name="tanggal"
          value={formData.tanggal}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          disabled={loading || !!initialData}
        />
        {initialData && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Tanggal tidak dapat diubah pada mode edit
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="keterangan"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Keterangan
        </label>
        <textarea
          id="keterangan"
          name="keterangan"
          value={formData.keterangan}
          onChange={handleInputChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="Contoh: Dari supplier PT Telkom Indonesia"
          disabled={loading || !!initialData}
        />
        {initialData && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Keterangan tidak dapat diubah pada mode edit
          </p>
        )}
      </div>

      {/* Photo Upload Section */}
      {(!initialData || transactionId) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Foto Barang (Opsional)
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {initialData
              ? "Tambah foto barang untuk dokumentasi (maksimal 5 foto)"
              : "Upload foto barang saat masuk untuk dokumentasi (maksimal 5 foto)"}
          </p>
          {initialData && (
            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Mode Edit:</strong> Anda dapat menambahkan foto baru
                untuk transaksi ini.
              </p>
            </div>
          )}
          <PhotoUpload
            ref={photoUploadRef}
            transactionId={transactionId || tempId}
            transactionType="inventory-masuk"
            onPhotosChange={setUploadedPhotos}
            maxPhotos={5}
            maxSizeMB={5}
            disabled={loading}
            className="border border-gray-200 dark:border-gray-600 rounded-lg"
          />
        </div>
      )}
      {initialData && !transactionId && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <p className="text-sm text-yellow-800">
            <strong>Perhatian:</strong> Data transaksi sedang dimuat. Foto dapat
            ditambahkan setelah data tersedia.
          </p>
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
        <Button variant="success" type="submit" disabled={loading}>
          {loading
            ? "Menyimpan..."
            : initialData
              ? "Update & Upload Foto"
              : "Simpan"}
        </Button>
      </div>
    </form>
  );
}
