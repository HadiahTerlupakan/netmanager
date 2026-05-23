"use client";

import { useState } from "react";
import {
  FiAlertTriangle,
  FiInfo,
  FiMinusCircle,
  FiXCircle,
} from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { clientLogger } from "@/lib/client-logger";

import {
  BarangSelector,
  FormAlert,
  FotoBuktiSection,
  GudangSelector,
  KondisiSelector,
  SelectionSummary,
  StockByConditionPanel,
  TextAreaField,
  TextField,
  useBarangOptions,
  useFotoBuktiUpload,
  useGudangOptions,
  useStockByCondition,
  type BarangOption,
  type Kondisi,
  type StockByCondition,
  type UploadedPhotoState,
} from "./form-shared";

interface KeluarInitialData {
  id?: string;
  barangId: string;
  gudangId: string;
  jumlah: number;
  kondisi: Kondisi;
  isHilang?: boolean;
  tujuanPenggunaan?: string;
  keterangan?: string;
  tanggal?: string;
}

interface KeluarFormProps {
  initialData?: KeluarInitialData;
  onClose: () => void;
}

interface FormState {
  barangId: string;
  gudangId: string;
  jumlah: string;
  kondisi: Kondisi;
  isHilang: boolean;
  tujuanPenggunaan: string;
  keterangan: string;
  tanggal: string;
}

const buildInitialFormState = (initial?: KeluarInitialData): FormState => ({
  barangId: initial?.barangId || "",
  gudangId: initial?.gudangId || "",
  jumlah: initial?.jumlah?.toString() || "",
  kondisi: initial?.kondisi || "BARU",
  isHilang: initial?.isHilang || false,
  tujuanPenggunaan: initial?.tujuanPenggunaan || "",
  keterangan: initial?.keterangan || "",
  tanggal: initial?.tanggal
    ? new Date(initial.tanggal).toISOString().split("T")[0]!
    : new Date().toISOString().split("T")[0]!,
});

export function KeluarForm({ initialData, onClose }: KeluarFormProps) {
  const isEditMode = !!initialData;

  const [formData, setFormData] = useState<FormState>(() =>
    buildInitialFormState(initialData),
  );
  const [transactionId, setTransactionId] = useState<string | null>(
    initialData?.id ?? null,
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const { gudangs } = useGudangOptions();
  const { isSearching, fetchBarangs, findBarang, buildOptions } =
    useBarangOptions();
  const {
    photoUploadRef,
    tempId,
    setUploadedPhotos,
    uploadPendingPhotos,
    buildFotoMetadata,
    resetFotoState,
  } = useFotoBuktiUpload();

  const selectedBarang = findBarang(formData.barangId);
  const selectedGudang = gudangs.find((g) => g.id === formData.gudangId);
  const stockByCondition = useStockByCondition({
    barangId: formData.barangId,
    gudangId: formData.gudangId,
    endpoint: "keluar",
    fallbackBarang: selectedBarang,
  });

  const stokTersediaKondisi = getStockForKondisi(
    stockByCondition,
    formData.kondisi,
  );

  const handlePhotosChange = (photos: UploadedPhotoState[]) => {
    setUploadedPhotos(photos);
    if (!transactionId || photos.length === 0) return;
    if (photos.every((p) => p.status === "success")) {
      setSuccess("Barang keluar berhasil dicatat. Foto berhasil diunggah.");
      setTimeout(() => resetForm(), 2000);
    } else if (photos.some((p) => p.status === "error")) {
      setSuccess(
        "Barang keluar berhasil dicatat, namun beberapa foto gagal diunggah.",
      );
    }
  };

  const resetForm = () => {
    setFormData(buildInitialFormState());
    setTransactionId(null);
    resetFotoState();
    onClose();
  };

  const updateField = <K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // Saat kondisi berubah, clamp jumlah ke stok kondisi baru.
      if (field === "kondisi") {
        const newStok = getStockForKondisi(stockByCondition, value as Kondisi);
        const current = parseInt(prev.jumlah || "0");
        if (newStok === 0) {
          next.jumlah = "";
        } else if (current > newStok || current === 0) {
          next.jumlah = "1";
        }
      }
      return next;
    });
    setError("");
  };

  const handleJumlahChange = (value: string) => {
    if (parseInt(value) > stokTersediaKondisi) {
      updateField("jumlah", stokTersediaKondisi.toString());
    } else {
      updateField("jumlah", value);
    }
  };

  const validatePayload = () => {
    if (!formData.barangId || !formData.gudangId || !formData.jumlah) {
      return "Barang, gudang, dan jumlah harus diisi";
    }
    const jumlah = parseInt(formData.jumlah);
    if (isNaN(jumlah) || jumlah <= 0) {
      return "Jumlah harus berupa angka positif";
    }
    if (jumlah > stokTersediaKondisi) {
      return `Jumlah tidak boleh melebihi stok tersedia untuk kondisi ${formData.kondisi} (${stokTersediaKondisi})`;
    }
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validatePayload();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      setSuccess("Mengunggah foto...");
      const { urls, photos } = await uploadPendingPhotos();
      setSuccess("");

      const response = await fetch("/api/inventory/keluar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barangId: formData.barangId,
          gudangId: formData.gudangId,
          jumlah: parseInt(formData.jumlah),
          kondisi: formData.kondisi,
          isHilang: formData.isHilang,
          tujuanPenggunaan: formData.tujuanPenggunaan || null,
          keterangan: formData.keterangan || null,
          tanggal: formData.tanggal || new Date().toISOString(),
          fotoBukti: urls,
          fotoMetadata: buildFotoMetadata(photos),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Gagal menyimpan barang keluar");
      }

      const data = await response.json();
      const result = data.data || data;
      if (result.keluarId) setTransactionId(result.keluarId);

      setSuccess("Barang keluar berhasil disimpan!");
      setTimeout(() => resetForm(), 1500);
    } catch (err) {
      clientLogger.error("Error submitting barang keluar:", err);
      setError(
        err instanceof Error ? err.message : "Gagal menyimpan barang keluar",
      );
      setSuccess("");
    } finally {
      setLoading(false);
    }
  };

  const submitDisabled =
    loading || (!isEditMode && stockByCondition.totalStok === 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormHeader isEditMode={isEditMode} />

      {error && <FormAlert tone="error">{error}</FormAlert>}
      {success && <FormAlert tone="success">{success}</FormAlert>}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <BarangSelector
          value={formData.barangId}
          onChange={(value) => updateField("barangId", value)}
          options={buildOptions()}
          onSearch={fetchBarangs}
          loading={isSearching}
          disabled={loading}
        />
        <GudangSelector
          value={formData.gudangId}
          onChange={(value) => updateField("gudangId", value)}
          gudangs={gudangs}
          disabled={loading}
        />
      </div>

      <SelectionSummary
        selectedBarang={selectedBarang}
        selectedGudang={selectedGudang}
        renderStockSlot={() => (
          <StockByConditionPanel
            stock={stockByCondition}
            satuan={selectedBarang?.satuan}
          />
        )}
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <JumlahFieldKeluar
          value={formData.jumlah}
          onChange={handleJumlahChange}
          satuan={selectedBarang?.satuan}
          stockByCondition={stockByCondition}
          stokKondisi={stokTersediaKondisi}
          kondisi={formData.kondisi}
          loading={loading}
        />
        <KondisiWithIsHilang
          kondisi={formData.kondisi}
          isHilang={formData.isHilang}
          onKondisiChange={(value) => updateField("kondisi", value)}
          onIsHilangChange={(value) => updateField("isHilang", value)}
          loading={loading}
        />
      </div>

      <TextField
        id="tanggal"
        label="Tanggal"
        type="date"
        value={formData.tanggal}
        onChange={(value) => updateField("tanggal", value)}
        disabled={loading || isEditMode}
        lockedNote={
          isEditMode ? "Tanggal tidak dapat diubah pada mode edit" : ""
        }
      />

      <FormAlert tone="info">
        <strong>
          <FiInfo className="inline w-4 h-4 mr-1" /> Informasi:
        </strong>{" "}
        Pelaksana barang keluar akan dicatat secara otomatis menggunakan akun
        Anda yang sedang aktif.
      </FormAlert>

      <TextField
        id="tujuanPenggunaan"
        label="Tujuan Penggunaan"
        value={formData.tujuanPenggunaan}
        onChange={(value) => updateField("tujuanPenggunaan", value)}
        placeholder="Contoh: Instalasi pelanggan, maintenance, dll"
        disabled={loading}
      />

      <TextAreaField
        id="keterangan"
        label="Keterangan"
        value={formData.keterangan}
        onChange={(value) => updateField("keterangan", value)}
        placeholder="Catatan tambahan (opsional)"
        disabled={loading}
      />

      <FotoBuktiSection
        ref={photoUploadRef}
        transactionId={transactionId}
        fallbackId={tempId}
        transactionType="inventory-keluar"
        onPhotosChange={handlePhotosChange}
        isEditMode={isEditMode}
        hideWhileNoTransaction
        loading={loading}
      />

      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          variant="outline"
          type="button"
          onClick={onClose}
          disabled={loading}
        >
          Batal
        </Button>
        <Button variant="warning" type="submit" disabled={submitDisabled}>
          {loading
            ? "Menyimpan..."
            : isEditMode
              ? "Update & Upload Foto"
              : "Simpan"}
        </Button>
      </div>
    </form>
  );
}

function getStockForKondisi(stock: StockByCondition, kondisi: Kondisi): number {
  return stock[kondisi] ?? 0;
}

function FormHeader({ isEditMode }: { isEditMode: boolean }) {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        {isEditMode ? "Edit Barang Keluar" : "Catat Barang Keluar"}
      </h2>
      {isEditMode && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Tambahkan foto untuk dokumentasi transaksi yang sudah ada
        </p>
      )}
    </div>
  );
}

interface JumlahFieldKeluarProps {
  value: string;
  onChange: (value: string) => void;
  satuan?: string;
  stockByCondition: StockByCondition;
  stokKondisi: number;
  kondisi: Kondisi;
  loading: boolean;
}

function JumlahFieldKeluar({
  value,
  onChange,
  satuan,
  stockByCondition,
  stokKondisi,
  kondisi,
  loading,
}: JumlahFieldKeluarProps) {
  const overLimit = parseInt(value || "0") > stokKondisi;
  return (
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
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full px-3 py-2 pr-16 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white ${
            overLimit ? "border-red-500 border-2" : "border-gray-300"
          }`}
          placeholder="0"
          min="1"
          max={stokKondisi}
          disabled={
            loading || stockByCondition.totalStok === 0 || stokKondisi === 0
          }
        />
        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
          {satuan || "pcs"}
        </span>
      </div>
      {stockByCondition.totalStok > 0 && (
        <div className="mt-1 space-y-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Maks: {stokKondisi} {satuan || "pcs"} (kondisi: {kondisi})
          </p>
          {overLimit && (
            <p className="flex items-center gap-1 text-xs text-red-600 font-medium">
              <FiAlertTriangle className="w-3 h-3" /> Jumlah disesuaikan ke
              maksimal stock tersedia
            </p>
          )}
          {stokKondisi === 0 && (
            <p className="flex items-center gap-1 text-xs text-red-600 font-medium">
              <FiXCircle className="w-3 h-3" /> Stock kondisi {kondisi} = 0,
              input dinonaktifkan
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface KondisiWithIsHilangProps {
  kondisi: Kondisi;
  isHilang: boolean;
  onKondisiChange: (value: Kondisi) => void;
  onIsHilangChange: (value: boolean) => void;
  loading: boolean;
}

function KondisiWithIsHilang({
  kondisi,
  isHilang,
  onKondisiChange,
  onIsHilangChange,
  loading,
}: KondisiWithIsHilangProps) {
  return (
    <div>
      <KondisiSelector
        value={kondisi}
        onChange={onKondisiChange}
        disabled={loading}
      />
      <div className="mt-3">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isHilang}
            onChange={(event) => onIsHilangChange(event.target.checked)}
            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            disabled={loading}
          />
          <span className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            <FiMinusCircle className="w-4 h-4 text-purple-600" /> Barang Hilang
            (tidak ada fisiknya)
          </span>
        </label>
        {isHilang && (
          <p className="mt-1 ml-6 flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
            <FiAlertTriangle className="w-3 h-3" /> Barang ini ditandai sebagai
            hilang/tidak ditemukan
          </p>
        )}
      </div>
    </div>
  );
}

// Avoid unused: BarangOption pakai untuk type alias dari module shared.
export type { BarangOption };
