"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  FiCheckCircle,
  FiAlertTriangle,
  FiXCircle,
  FiMinusCircle,
  FiInfo,
} from "react-icons/fi";
import { PhotoUpload } from "./PhotoUpload";
import type { PhotoUploadRef } from "./PhotoUpload";
import { Button } from "@/components/ui/Button";
import {
  getStockStatusColor,
  getKondisiColor,
} from "@/lib/utils/inventory-helpers";
import { clientLogger } from "@/lib/client-logger";

interface KeluarFormProps {
  initialData?: {
    id?: string;
    barangId: string;
    gudangId: string;
    jumlah: number;
    kondisi: "BARU" | "BEKAS" | "RUSAK";
    isHilang?: boolean;
    tujuanPenggunaan?: string;
    keterangan?: string;
    tanggal?: string;
  };
  onClose: () => void;
}

export function KeluarForm({ initialData, onClose }: KeluarFormProps) {
  const [formData, setFormData] = useState({
    barangId: "",
    gudangId: "",
    jumlah: "",
    kondisi: "BARU" as "BARU" | "BEKAS" | "RUSAK",
    isHilang: false, // Checkbox for lost items
    tujuanPenggunaan: "",
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
    { id: string; kode: string; nama: string; lokasi?: string }[]
  >([]);
  const [stockByCondition, setStockByCondition] = useState({
    BARU: 0,
    BEKAS: 0,
    RUSAK: 0,
    totalStok: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploadedPhotos, setUploadedPhotos] = useState<
    { status: string; error?: string }[]
  >([]);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const photoUploadRef = useRef<PhotoUploadRef>(null);

  /** Get available stock for the currently selected kondisi */
  const getStockForKondisi = useCallback(
    (kondisi: string = formData.kondisi): number =>
      stockByCondition[kondisi as keyof typeof stockByCondition] ??
      stockByCondition.BARU,
    [formData.kondisi, stockByCondition],
  );

  useEffect(() => {
    async function fetchInitialData() {
      try {
        // Fetch barang
        const barangResponse = await fetch("/api/inventory/barang?limit=100");
        const barangData = await barangResponse.json();
        const barangResult = barangData.data || barangData;
        setBarangs(barangResult.barangs || []);

        // Fetch gudang
        const gudangResponse = await fetch("/api/inventory/gudang");
        const gudangData = await gudangResponse.json();
        const gudangResult = gudangData.data || gudangData;
        setGudangs(gudangResult.gudangs || []);

        // If in edit mode, populate form with initial data
        if (initialData) {
          setFormData({
            barangId: initialData.barangId || "",
            gudangId: initialData.gudangId || "",
            jumlah: initialData.jumlah?.toString() || "",
            kondisi: initialData.kondisi || "BARU",
            isHilang: initialData.isHilang || false,
            tujuanPenggunaan: initialData.tujuanPenggunaan || "",
            keterangan: initialData.keterangan || "",
            tanggal: initialData.tanggal
              ? new Date(initialData.tanggal).toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0],
          });
          setTransactionId(initialData.id || null);
        }
      } catch (error) {
        clientLogger.error("Error fetching initial data:", error);
        setError("Gagal memuat data awal");
      }
    }

    fetchInitialData();
  }, [initialData]);

  useEffect(() => {
    async function fetchCurrentStock() {
      if (formData.barangId && formData.gudangId) {
        try {
          // Check current stock by condition for this barang-gudang combination
          const response = await fetch(
            `/api/inventory/keluar?checkStock=true&barangId=${formData.barangId}&gudangId=${formData.gudangId}`,
          );
          if (response.ok) {
            const data = await response.json();
            const result = data.data || data;
            if (result.stokByKondisi) {
              setStockByCondition({
                BARU: result.stokByKondisi.BARU,
                BEKAS: result.stokByKondisi.BEKAS,
                RUSAK: result.stokByKondisi.RUSAK,
                totalStok: result.stokByKondisi.total,
              });
            }
          } else {
            // Fallback to old method if API fails
            const selectedBarang = barangs.find(
              (b) => b.id === formData.barangId,
            );
            if (selectedBarang) {
              const stockInfo = selectedBarang.stockPerGudang?.find(
                (s: { gudangId: string; stok: number }) =>
                  s.gudangId === formData.gudangId,
              );
              setStockByCondition({
                BARU: 0,
                BEKAS: 0,
                RUSAK: 0,
                totalStok: stockInfo?.stok || 0,
              });
            }
          }
        } catch (error) {
          clientLogger.error("Error fetching current stock:", error);
          // Fallback to old method
          const selectedBarang = barangs.find(
            (b) => b.id === formData.barangId,
          );
          if (selectedBarang) {
            const stockInfo = selectedBarang.stockPerGudang?.find(
              (s: { gudangId: string; stok: number }) =>
                s.gudangId === formData.gudangId,
            );
            setStockByCondition({
              BARU: 0,
              BEKAS: 0,
              RUSAK: 0,
              totalStok: stockInfo?.stok || 0,
            });
          }
        }
      } else {
        setStockByCondition({
          BARU: 0,
          BEKAS: 0,
          RUSAK: 0,
          totalStok: 0,
        });
      }
    }

    fetchCurrentStock();
  }, [formData.barangId, formData.gudangId, barangs]);

  // Reset form when condition changes to ensure proper behavior
  useEffect(() => {
    if (
      formData.barangId &&
      formData.gudangId &&
      stockByCondition.totalStok > 0
    ) {
      const kondisiStok = getStockForKondisi();

      // Reset jumlah to 1 if switching to a condition with stock but no valid current value
      if (
        kondisiStok > 0 &&
        (parseInt(formData.jumlah || "0") > kondisiStok ||
          parseInt(formData.jumlah || "0") === 0)
      ) {
        setFormData((prev) => ({ ...prev, jumlah: "1" }));
      } else if (kondisiStok === 0) {
        // Clear jumlah if switching to condition with no stock
        setFormData((prev) => ({ ...prev, jumlah: "" }));
      }
    }
  }, [
    formData.kondisi,
    stockByCondition,
    formData.barangId,
    formData.gudangId,
    formData.jumlah,
    getStockForKondisi,
  ]);

  // Effect to handle photo upload completion
  useEffect(() => {
    // Check if all photos have been uploaded successfully
    if (transactionId && uploadedPhotos.length > 0) {
      const allUploaded = uploadedPhotos.every(
        (photo) => photo.status === "success",
      );
      const hasError = uploadedPhotos.some((photo) => photo.status === "error");

      if (allUploaded) {
        setSuccess("Barang keluar berhasil dicatat! Foto berhasil diunggah.");

        // Reset form after a short delay
        setTimeout(() => {
          setFormData({
            barangId: "",
            gudangId: "",
            jumlah: "",
            kondisi: "BARU",
            isHilang: false,
            tujuanPenggunaan: "",
            keterangan: "",
            tanggal: new Date().toISOString().split("T")[0],
          });
          setStockByCondition((prev) => ({ ...prev, totalStok: 0 }));
          setUploadedPhotos([]);
          setTransactionId(null);
          onClose();
        }, 2000);
      } else if (hasError) {
        setSuccess(
          "Barang keluar berhasil dicatat, namun beberapa foto gagal diunggah.",
        );
      }
    }
  }, [uploadedPhotos, transactionId, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.barangId || !formData.gudangId || !formData.jumlah) {
      setError("Barang, gudang, dan jumlah harus diisi");
      return;
    }

    const jumlah = parseInt(formData.jumlah);
    if (isNaN(jumlah) || jumlah <= 0) {
      setError("Jumlah harus berupa angka positif");
      return;
    }

    // Check stock availability for selected condition
    const stokTersedia = getStockForKondisi();

    if (jumlah > stokTersedia) {
      setError(
        `Jumlah tidak boleh melebihi stok tersedia untuk kondisi ${formData.kondisi} (${stokTersedia})`,
      );
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
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

          // Upload photos automatically
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

      // Create the inventory transaction with photo URLs
      const requestBody = {
        barangId: formData.barangId,
        gudangId: formData.gudangId,
        jumlah: parseInt(formData.jumlah),
        kondisi: formData.kondisi,
        isHilang: formData.isHilang || false,
        tujuanPenggunaan: formData.tujuanPenggunaan || null,
        keterangan: formData.keterangan || null,
        tanggal: formData.tanggal || new Date().toISOString(),
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
      };

      clientLogger.info("DEBUG - KeluarForm submitting with:", {
        fotoBuktiCount: fotoBuktiUrls.length,
        fotoBuktiUrls,
        requestBody,
      });

      const response = await fetch("/api/inventory/keluar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Gagal menyimpan barang keluar");
      }

      const result = await response.json();
      clientLogger.info("DEBUG - API response:", result);

      setSuccess("Barang keluar berhasil disimpan!");

      // Clear form and close
      setTimeout(() => {
        onClose();
        // Reset photo upload component
        if (photoUploadRef.current) {
          photoUploadRef.current.resetPhotos();
        }
      }, 1500);
    } catch (error: unknown) {
      clientLogger.error("Error in handleSubmit:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan barang keluar",
      );
      setSuccess("");
    } finally {
      setLoading(false);
    }
  };

  const selectedBarang = barangs.find((b) => b.id === formData.barangId);
  const selectedGudang = gudangs.find((g) => g.id === formData.gudangId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Form Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {initialData ? "Edit Barang Keluar" : "Catat Barang Keluar"}
        </h2>
        {initialData && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tambahkan foto untuk dokumentasi transaksi yang sudah ada
          </p>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-800">
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
            disabled={loading}
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
            {stockByCondition.totalStok >= 0 && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Stok tersedia per kondisi:
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                      <FiCheckCircle className="w-3 h-3 text-green-500" /> Baru:
                    </span>
                    <span className="text-sm font-medium text-green-600">
                      {stockByCondition.BARU}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                      <FiAlertTriangle className="w-3 h-3 text-yellow-500" />{" "}
                      Bekas:
                    </span>
                    <span className="text-sm font-medium text-yellow-600">
                      {stockByCondition.BEKAS}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                      <FiXCircle className="w-3 h-3 text-red-500" /> Rusak:
                    </span>
                    <span className="text-sm font-medium text-red-600">
                      {stockByCondition.RUSAK}
                    </span>
                  </div>
                  <div className="pt-1 mt-1 border-t border-gray-200 dark:border-gray-600">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Total:
                      </span>
                      <span
                        className={`text-lg font-bold ${getStockStatusColor(stockByCondition.totalStok)}`}
                      >
                        {stockByCondition.totalStok}{" "}
                        {selectedBarang?.satuan || "pcs"}
                      </span>
                    </div>
                  </div>
                </div>
                {stockByCondition.totalStok === 0 && (
                  <p className="text-xs text-red-500 mt-2">Stok habis!</p>
                )}
                {stockByCondition.totalStok > 0 &&
                  stockByCondition.totalStok < 5 && (
                    <p className="text-xs text-yellow-500 mt-2">
                      Stok menipis!
                    </p>
                  )}
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
              value={formData.jumlah}
              onChange={(e) => {
                const value = e.target.value;
                const kondisiStok = getStockForKondisi();

                // If value exceeds available stock, adjust to maximum
                if (parseInt(value) > kondisiStok) {
                  setFormData({ ...formData, jumlah: kondisiStok.toString() });
                } else {
                  setFormData({ ...formData, jumlah: value });
                }
              }}
              className={`w-full px-3 py-2 pr-16 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white ${
                parseInt(formData.jumlah) > getStockForKondisi()
                  ? "border-red-500 border-2"
                  : "border-gray-300"
              }`}
              placeholder="0"
              min="1"
              max={getStockForKondisi()}
              disabled={
                loading ||
                stockByCondition.totalStok === 0 ||
                getStockForKondisi() === 0
              }
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
              {selectedBarang?.satuan || "pcs"}
            </span>
          </div>
          {stockByCondition.totalStok > 0 && (
            <div className="mt-1 space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Maks: {getStockForKondisi()} {selectedBarang?.satuan || "pcs"}{" "}
                (kondisi: {formData.kondisi})
              </p>
              {parseInt(formData.jumlah) > getStockForKondisi() && (
                <p className="flex items-center gap-1 text-xs text-red-600 font-medium">
                  <FiAlertTriangle className="w-3 h-3" /> Jumlah disesuaikan ke
                  maksimal stock tersedia
                </p>
              )}
              {getStockForKondisi() === 0 && (
                <p className="flex items-center gap-1 text-xs text-red-600 font-medium">
                  <FiXCircle className="w-3 h-3" /> Stock kondisi{" "}
                  {formData.kondisi} = 0, input dinonaktifkan
                </p>
              )}
            </div>
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
          {/* Checkbox for lost items */}
          <div className="mt-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isHilang}
                onChange={(e) =>
                  setFormData({ ...formData, isHilang: e.target.checked })
                }
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                disabled={loading}
              />
              <span className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                <FiMinusCircle className="w-4 h-4 text-purple-600" /> Barang
                Hilang (tidak ada fisiknya)
              </span>
            </label>
            {formData.isHilang && (
              <p className="mt-1 ml-6 flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                <FiAlertTriangle className="w-3 h-3" /> Barang ini ditandai
                sebagai hilang/tidak ditemukan
              </p>
            )}
          </div>
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
          value={formData.tanggal}
          onChange={(e) =>
            setFormData({ ...formData, tanggal: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          disabled={loading || !!initialData}
        />
        {initialData && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Tanggal tidak dapat diubah pada mode edit
          </p>
        )}
      </div>

      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>
            <FiInfo className="inline w-4 h-4 mr-1" /> Informasi:
          </strong>{" "}
          Pelaksana barang keluar akan dicatat secara otomatis menggunakan akun
          Anda yang sedang aktif.
        </p>
      </div>

      <div>
        <label
          htmlFor="tujuanPenggunaan"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Tujuan Penggunaan
        </label>
        <input
          type="text"
          id="tujuanPenggunaan"
          value={formData.tujuanPenggunaan}
          onChange={(e) =>
            setFormData({ ...formData, tujuanPenggunaan: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="Contoh: Instalasi pelanggan, maintenance, dll"
          disabled={loading}
        />
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
          value={formData.keterangan}
          onChange={(e) =>
            setFormData({ ...formData, keterangan: e.target.value })
          }
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="Catatan tambahan (opsional)"
          disabled={loading}
        />
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
              : "Upload foto barang saat keluar untuk dokumentasi (maksimal 5 foto)"}
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
            transactionId={transactionId || "temp-" + Date.now()}
            transactionType="inventory-keluar"
            onPhotosChange={setUploadedPhotos}
            maxPhotos={5}
            maxSizeMB={5}
            disabled={loading}
            className="border border-gray-200 dark:border-gray-600 rounded-lg"
          />
        </div>
      )}
      {initialData && !transactionId && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
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
        <Button
          variant="warning"
          type="submit"
          disabled={
            loading || (!initialData && stockByCondition.totalStok === 0)
          }
        >
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
