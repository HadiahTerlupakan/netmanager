"use client";

import { useState, useCallback } from "react";

import { Button } from "@/components/ui/Button";
import { clientLogger } from "@/lib/client-logger";

import {
  BarangSelector,
  FormAlert,
  FotoBuktiSection,
  GudangSelector,
  JumlahField,
  KondisiSelector,
  SelectionSummary,
  TextAreaField,
  TextField,
  useBarangOptions,
  useFotoBuktiUpload,
  useGudangOptions,
  type BarangOption,
  type Kondisi,
  type UploadedPhotoState,
} from "./form-shared";

interface MasukInitialData {
  id?: string;
  barangId: string;
  gudangId: string;
  jumlah: number;
  hargaBeliSatuan?: number;
  kondisi: Kondisi;
  keterangan?: string;
  tanggal?: string;
  barang?: BarangOption;
}

interface MasukFormProps {
  initialData?: MasukInitialData;
  onClose: () => void;
}

interface FormState {
  barangId: string;
  gudangId: string;
  jumlah: string;
  hargaBeliSatuan: string;
  kondisi: Kondisi;
  keterangan: string;
  tanggal: string;
}

const buildInitialFormState = (initial?: MasukInitialData): FormState => ({
  barangId: initial?.barangId || "",
  gudangId: initial?.gudangId || "",
  jumlah: initial?.jumlah?.toString() || "",
  hargaBeliSatuan: initial?.hargaBeliSatuan?.toString() || "",
  kondisi: initial?.kondisi || "BARU",
  keterangan: initial?.keterangan || "",
  tanggal: initial?.tanggal
    ? new Date(initial.tanggal).toISOString().split("T")[0]!
    : new Date().toISOString().split("T")[0]!,
});

export function MasukForm({ initialData, onClose }: MasukFormProps) {
  const isEditMode = !!initialData;

  const [formData, setFormData] = useState<FormState>(() =>
    buildInitialFormState(initialData),
  );
  const [persistedBarang, setPersistedBarang] = useState<BarangOption | null>(
    initialData?.barang ?? null,
  );
  const [transactionId, setTransactionId] = useState<string | null>(
    initialData?.id ?? null,
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const { gudangs } = useGudangOptions();
  const { isSearching, fetchBarangs, findBarang, buildOptions } =
    useBarangOptions({ persistedBarang });
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
  const currentStock = computeCurrentStock(selectedBarang, formData.gudangId);

  const resetForm = useCallback(() => {
    setFormData(buildInitialFormState());
    setTransactionId(null);
    setPersistedBarang(null);
    resetFotoState();
    onClose();
  }, [onClose, resetFotoState]);

  const handlePhotosChange = (photos: UploadedPhotoState[]) => {
    setUploadedPhotos(photos);
    if (!isEditMode || !transactionId || photos.length === 0) return;
    if (photos.every((p) => p.status === "success")) {
      setSuccess("Foto berhasil diunggah.");
      setTimeout(() => resetForm(), 2000);
    } else if (photos.some((p) => p.status === "error")) {
      setSuccess("Beberapa foto gagal diunggah.");
    }
  };

  const updateField = (field: keyof FormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleBarangChange = (id: string) => {
    updateField("barangId", id);
    const item = findBarang(id);
    if (item) setPersistedBarang(item);
  };

  const validateCreatePayload = () => {
    if (!formData.barangId || !formData.gudangId || !formData.jumlah) {
      return "Barang, gudang, dan jumlah harus diisi";
    }
    const jumlah = parseInt(formData.jumlah);
    if (isNaN(jumlah) || jumlah <= 0) {
      return "Jumlah harus berupa angka positif";
    }
    return null;
  };

  const handleSubmit = async (event: React.SubmitEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (isEditMode) {
      // Mode edit di MasukForm hanya untuk tambah foto pada transaksi existing.
      // PhotoUpload sudah meng-handle upload otomatis via onPhotosChange.
      setSuccess("Mengunggah foto...");
      return;
    }

    const validationError = validateCreatePayload();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      setSuccess("Mengunggah foto...");
      const { urls, photos } = await uploadPendingPhotos();
      setSuccess("");

      const response = await fetch("/api/inventory/masuk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barangId: String(formData.barangId),
          gudangId: String(formData.gudangId),
          jumlah: Number(parseInt(formData.jumlah)),
          hargaBeliSatuan: Number(formData.hargaBeliSatuan || 0),
          kondisi: String(formData.kondisi),
          keterangan: String(formData.keterangan || ""),
          tanggal: String(formData.tanggal),
          fotoBukti: urls,
          fotoMetadata: buildFotoMetadata(photos),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal mencatat barang masuk");
      }

      const result = data.data || data;
      if (result.masukId) setTransactionId(result.masukId);
      setSuccess("Barang masuk berhasil dicatat!");
      setTimeout(() => resetForm(), 1500);
    } catch (err) {
      clientLogger.error("Error submitting barang masuk:", err);
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const lockedNote = isEditMode ? "Tidak dapat diubah pada mode edit" : "";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormHeader isEditMode={isEditMode} />

      {error && <FormAlert tone="error">{error}</FormAlert>}
      {success && <FormAlert tone="success">{success}</FormAlert>}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <BarangSelector
          value={formData.barangId}
          onChange={handleBarangChange}
          options={buildOptions()}
          onSearch={fetchBarangs}
          loading={isSearching}
          disabled={loading || isEditMode}
          lockedNote={lockedNote}
        />
        <GudangSelector
          value={formData.gudangId}
          onChange={(value) => updateField("gudangId", value)}
          gudangs={gudangs}
          disabled={loading || isEditMode}
          lockedNote={lockedNote}
        />
      </div>

      <SelectionSummary
        selectedBarang={selectedBarang}
        selectedGudang={selectedGudang}
        currentStock={currentStock}
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <JumlahField
          value={formData.jumlah}
          onChange={(value) => updateField("jumlah", value)}
          satuan={selectedBarang?.satuan}
          disabled={loading || isEditMode}
          lockedNote={lockedNote}
        />
        <KondisiSelector
          value={formData.kondisi}
          onChange={(value) => updateField("kondisi", value)}
          disabled={loading || isEditMode}
          lockedNote={lockedNote}
        />
      </div>

      <TextField
        id="tanggal"
        label="Tanggal"
        type="date"
        value={formData.tanggal}
        onChange={(value) => updateField("tanggal", value)}
        disabled={loading || isEditMode}
        lockedNote={lockedNote}
      />

      <TextAreaField
        id="keterangan"
        label="Keterangan"
        value={formData.keterangan}
        onChange={(value) => updateField("keterangan", value)}
        placeholder="Contoh: Dari supplier PT Telkom Indonesia"
        disabled={loading || isEditMode}
        lockedNote={lockedNote}
      />

      <FotoBuktiSection
        ref={photoUploadRef}
        transactionId={transactionId}
        fallbackId={tempId}
        transactionType="inventory-masuk"
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
        <Button variant="success" type="submit" disabled={loading}>
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

function computeCurrentStock(
  barang: BarangOption | undefined,
  gudangId: string,
): number {
  if (!barang || !gudangId) return 0;
  const stock = barang.stockPerGudang?.find((s) => s.gudangId === gudangId);
  return stock?.stok ?? 0;
}

function FormHeader({ isEditMode }: { isEditMode: boolean }) {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        {isEditMode ? "Edit Barang Masuk" : "Catat Barang Masuk"}
      </h2>
      {isEditMode && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Tambahkan foto untuk dokumentasi transaksi yang sudah ada
        </p>
      )}
    </div>
  );
}
