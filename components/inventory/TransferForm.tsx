"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { FiAlertTriangle, FiCheckCircle, FiXCircle } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { postWithAuth } from "@/lib/api-client";
import { clientLogger } from "@/lib/client-logger";
import { useInvalidateInventoryRelated } from "@/lib/hooks/useInvalidate";
import { getStockStatusColor } from "@/lib/utils/inventory-helpers";
import { STOCK_THRESHOLD } from "@/modules/inventory/client";

import {
  BarangSelector,
  FormAlert,
  FotoBuktiSection,
  GudangSelector,
  TextAreaField,
  useBarangOptions,
  useFotoBuktiUpload,
  useGudangOptions,
  useStockByCondition,
  type BarangOption,
  type Kondisi,
  type StockByCondition,
  type UploadedPhotoState,
} from "./form-shared";

interface TransferFormProps {
  initialData?: unknown;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FormState {
  barangId: string;
  dariGudangId: string;
  keGudangId: string;
  jumlah: string;
  kondisi: Kondisi;
  keterangan: string;
}

const INITIAL_FORM_STATE: FormState = {
  barangId: "",
  dariGudangId: "",
  keGudangId: "",
  jumlah: "",
  kondisi: "BARU",
  keterangan: "",
};

export function TransferForm({
  initialData: _initialData,
  onClose,
  onSuccess,
}: TransferFormProps) {
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM_STATE);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  const invalidateInventoryRelated = useInvalidateInventoryRelated();

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
  const selectedGudangSumber = gudangs.find(
    (g) => g.id === formData.dariGudangId,
  );
  const selectedGudangTujuan = gudangs.find(
    (g) => g.id === formData.keGudangId,
  );
  const availableGudangTujuan = gudangs.filter(
    (g) => g.id !== formData.dariGudangId,
  );

  const stockByCondition = useStockByCondition({
    barangId: formData.barangId,
    gudangId: formData.dariGudangId,
    endpoint: "transfer",
    fallbackBarang: selectedBarang,
  });

  const stokKondisi = stockByCondition[formData.kondisi];

  const submitTransferMutation = useMutation<
    void,
    Error,
    { jumlah: number; urls: string[]; photos: UploadedPhotoState[] }
  >({
    mutationFn: async ({ jumlah, urls, photos }) => {
      const response = await postWithAuth("/api/inventory/transfer", {
        ...formData,
        jumlah,
        fotoBukti: urls,
        fotoMetadata: buildFotoMetadata(photos),
      });
      const data = await response.json();
      if (!data.success) {
        await cleanupPhotosOnError(urls);
        throw new Error(data.error || "Gagal melakukan transfer");
      }
      const result = data.data || data;
      setSuccess(`Transfer berhasil! Kode transfer: ${result.kodeTransfer}`);
      setFormData(INITIAL_FORM_STATE);
      resetFotoState();
      setTimeout(() => {
        onClose();
        onSuccess?.();
        router.refresh();
      }, 2000);
    },
    onError: (err) => {
      clientLogger.error("Error submitting transfer:", err);
      setError(err.message || "Terjadi kesalahan");
    },
    onSettled: () => {
      invalidateInventoryRelated();
    },
  });

  const updateField = <K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const validatePayload = () => {
    if (
      !formData.barangId ||
      !formData.dariGudangId ||
      !formData.keGudangId ||
      !formData.jumlah
    ) {
      return "Barang, gudang sumber, gudang tujuan, dan jumlah harus diisi";
    }
    if (formData.dariGudangId === formData.keGudangId) {
      return "Gudang sumber dan tujuan tidak boleh sama";
    }
    const jumlah = parseInt(formData.jumlah);
    if (isNaN(jumlah) || jumlah <= 0) {
      return "Jumlah harus berupa angka positif";
    }
    if (jumlah > stokKondisi) {
      return `Jumlah ${formData.kondisi.toLowerCase()} tidak boleh melebihi stok tersedia (${stokKondisi})`;
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

    try {
      setSuccess("Mengunggah foto...");
      const { urls, photos } = await uploadPendingPhotos();
      setSuccess("");
      submitTransferMutation.mutate({
        jumlah: parseInt(formData.jumlah),
        urls,
        photos,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunggah foto");
    }
  };

  const loading = submitTransferMutation.isPending;
  const submitDisabled =
    loading ||
    stockByCondition.totalStok === 0 ||
    !formData.keGudangId ||
    stokKondisi === 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <FormAlert tone="error">{error}</FormAlert>}
      {success && <FormAlert tone="success">{success}</FormAlert>}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <GudangSelector
          id="dariGudangId"
          name="dariGudangId"
          label="Gudang Sumber *"
          placeholder="Pilih gudang sumber"
          value={formData.dariGudangId}
          onChange={(value) => updateField("dariGudangId", value)}
          gudangs={gudangs}
          disabled={loading}
        />
        <GudangSelector
          id="keGudangId"
          name="keGudangId"
          label="Gudang Tujuan *"
          placeholder="Pilih gudang tujuan"
          value={formData.keGudangId}
          onChange={(value) => updateField("keGudangId", value)}
          gudangs={availableGudangTujuan}
          disabled={loading || !formData.dariGudangId}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <BarangSelector
          value={formData.barangId}
          onChange={(value) => updateField("barangId", value)}
          options={buildOptions()}
          onSearch={fetchBarangs}
          loading={isSearching}
          disabled={loading}
        />
        <KondisiWithStockHint
          kondisi={formData.kondisi}
          stockByCondition={stockByCondition}
          onChange={(value) => updateField("kondisi", value)}
          disabled={loading}
        />
      </div>

      <TransferLocationSummary
        selectedBarang={selectedBarang}
        gudangSumber={selectedGudangSumber}
        gudangTujuan={selectedGudangTujuan}
      />

      {selectedBarang && selectedGudangSumber && (
        <StockSourcePanel
          stock={stockByCondition}
          satuan={selectedBarang.satuan}
          gudangNama={selectedGudangSumber.nama}
          activeKondisi={formData.kondisi}
        />
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <JumlahFieldTransfer
          value={formData.jumlah}
          onChange={(value) => updateField("jumlah", value)}
          satuan={selectedBarang?.satuan}
          stokKondisi={stokKondisi}
          loading={loading}
          totalStok={stockByCondition.totalStok}
        />
        <TanggalField loading={loading} />
      </div>

      <TextAreaField
        id="keterangan"
        label="Keterangan Transfer"
        value={formData.keterangan}
        onChange={(value) => updateField("keterangan", value)}
        placeholder="Contoh: Transfer untuk cabang bulan Desember"
        disabled={loading}
      />

      <FotoBuktiSection
        ref={photoUploadRef}
        transactionId={null}
        fallbackId={tempId}
        transactionType="inventory-transfer"
        onPhotosChange={setUploadedPhotos}
        loading={loading}
        maxPhotos={3}
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
        <Button type="submit" disabled={submitDisabled}>
          {loading ? "Mentransfer..." : "Transfer Barang"}
        </Button>
      </div>
    </form>
  );
}

async function cleanupPhotosOnError(urls: string[]) {
  if (urls.length === 0) return;
  try {
    await Promise.allSettled(
      urls.map((url) =>
        fetch(url.replace("/uploads/", "/api/uploads/delete/"), {
          method: "DELETE",
        }).catch((err) => clientLogger.error("Failed to cleanup photo:", err)),
      ),
    );
  } catch (cleanupError) {
    clientLogger.error("Error during photo cleanup:", cleanupError);
  }
}

interface KondisiWithStockHintProps {
  kondisi: Kondisi;
  stockByCondition: StockByCondition;
  onChange: (value: Kondisi) => void;
  disabled?: boolean;
}

function KondisiWithStockHint({
  kondisi,
  stockByCondition,
  onChange,
  disabled,
}: KondisiWithStockHintProps) {
  return (
    <div>
      <label
        htmlFor="kondisi"
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        Kondisi Barang *
      </label>
      <select
        id="kondisi"
        value={kondisi}
        onChange={(event) => onChange(event.target.value as Kondisi)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        disabled={disabled}
      >
        {(["BARU", "BEKAS", "RUSAK"] as const).map((opt) => (
          <option key={opt} value={opt} disabled={stockByCondition[opt] === 0}>
            {opt === "BARU" ? "Baru" : opt === "BEKAS" ? "Bekas" : "Rusak"}{" "}
            {stockByCondition[opt] > 0
              ? `(${stockByCondition[opt]})`
              : "(Tidak tersedia)"}
          </option>
        ))}
      </select>
    </div>
  );
}

interface TransferLocationSummaryProps {
  selectedBarang: BarangOption | undefined;
  gudangSumber: { kode: string; nama: string; lokasi?: string } | undefined;
  gudangTujuan: { kode: string; nama: string; lokasi?: string } | undefined;
}

function TransferLocationSummary({
  selectedBarang,
  gudangSumber,
  gudangTujuan,
}: TransferLocationSummaryProps) {
  if (!selectedBarang && !gudangSumber && !gudangTujuan) return null;
  return (
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
        {gudangSumber && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gudang sumber:
            </p>
            <p className="font-medium text-red-600 dark:text-red-400">
              {gudangSumber.kode} - {gudangSumber.nama}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Lokasi: {gudangSumber.lokasi || "-"}
            </p>
          </div>
        )}
        {gudangTujuan && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gudang tujuan:
            </p>
            <p className="font-medium text-green-600 dark:text-green-400">
              {gudangTujuan.kode} - {gudangTujuan.nama}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Lokasi: {gudangTujuan.lokasi || "-"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface StockSourcePanelProps {
  stock: StockByCondition;
  satuan: string;
  gudangNama: string;
  activeKondisi: Kondisi;
}

function StockSourcePanel({
  stock,
  satuan,
  gudangNama,
  activeKondisi,
}: StockSourcePanelProps) {
  const total = stock.totalStok;
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
            Stok tersedia di {gudangNama}:
          </p>
          <p className={`text-2xl font-bold ${getStockStatusColor(total)}`}>
            {total} {satuan}
          </p>
        </div>
        <StockBadge total={total} />
      </div>

      <div className="border-t border-blue-200 dark:border-blue-700 pt-3">
        <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">
          Stok per Kondisi:
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(["BARU", "BEKAS", "RUSAK"] as const).map((k) => (
            <KondisiCard
              key={k}
              label={k === "BARU" ? "Baru" : k === "BEKAS" ? "Bekas" : "Rusak"}
              value={stock[k]}
              kind={k}
              active={activeKondisi === k}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StockBadge({ total }: { total: number }) {
  if (total <= STOCK_THRESHOLD.OUT) {
    return (
      <p className="flex items-center justify-end gap-1 text-sm text-red-500">
        <FiXCircle className="w-4 h-4" /> Stok habis!
      </p>
    );
  }
  if (total < STOCK_THRESHOLD.LOW) {
    return (
      <p className="flex items-center justify-end gap-1 text-sm text-yellow-500">
        <FiAlertTriangle className="w-4 h-4" /> Stok menipis!
      </p>
    );
  }
  return (
    <p className="flex items-center justify-end gap-1 text-sm text-green-500">
      <FiCheckCircle className="w-4 h-4" /> Stok tersedia
    </p>
  );
}

const KONDISI_CARD_CLASS = {
  BARU: {
    active: "bg-green-100 ring-2 ring-green-500",
    label: "text-green-700",
    value: "text-green-800",
  },
  BEKAS: {
    active: "bg-yellow-100 ring-2 ring-yellow-500",
    label: "text-yellow-700",
    value: "text-yellow-800",
  },
  RUSAK: {
    active: "bg-red-100 ring-2 ring-red-500",
    label: "text-red-700",
    value: "text-red-800",
  },
} as const;

function KondisiCard({
  label,
  value,
  kind,
  active,
}: {
  label: string;
  value: number;
  kind: Kondisi;
  active: boolean;
}) {
  const colors = KONDISI_CARD_CLASS[kind];
  return (
    <div
      className={`text-center p-2 rounded ${active ? colors.active : "bg-white/50"}`}
    >
      <p className={`text-xs font-medium ${colors.label}`}>{label}</p>
      <p className={`text-sm font-bold ${colors.value}`}>{value}</p>
    </div>
  );
}

interface JumlahFieldTransferProps {
  value: string;
  onChange: (value: string) => void;
  satuan?: string;
  stokKondisi: number;
  totalStok: number;
  loading: boolean;
}

function JumlahFieldTransfer({
  value,
  onChange,
  satuan,
  stokKondisi,
  totalStok,
  loading,
}: JumlahFieldTransferProps) {
  return (
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
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="0"
          min="1"
          max={stokKondisi || 0}
          disabled={loading || totalStok === 0}
        />
        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
          {satuan || "pcs"}
        </span>
      </div>
      {stokKondisi > 0 && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Maks: {stokKondisi} {satuan || "pcs"}
        </p>
      )}
    </div>
  );
}

function TanggalField({ loading }: { loading: boolean }) {
  return (
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
  );
}
