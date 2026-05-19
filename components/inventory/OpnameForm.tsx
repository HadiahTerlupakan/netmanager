"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { StockOpnameFormData } from "@/lib/types/inventory";
import { useApi } from "@/lib/hooks/useApi";
import { fetchWithHandling } from "@/lib/utils/fetch-wrapper";
import { clientLogger } from "@/lib/client-logger";

interface OpnameFormProps {
  initialData?: StockOpnameFormData;
  onClose: () => void;
  onSuccess: () => void;
}

interface Barang {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
}

interface Gudang {
  id: string;
  kode: string;
  nama: string;
}

interface FormState {
  barangId: string;
  gudangId: string;
  stokFisik: string;
  keterangan: string;
  kondisiBaik: string;
  kondisiRusak: string;
  kondisiExpire: string;
  lokasiPenyimpanan: string;
  nomorRak: string;
  nomorBox: string;
  suhuPenyimpanan: string;
  kelembaban: string;
  tanggalExpire: string;
  nomorBatch: string;
  catatanDetail: string;
}

const SUCCESS_REDIRECT_DELAY_MS = 1000;
const AUTO_DISTRIBUTE_BAIK_RATIO = 0.95;
const AUTO_DISTRIBUTE_RUSAK_RATIO = 0.03;

export function OpnameForm({
  initialData,
  onClose,
  onSuccess,
}: OpnameFormProps) {
  const [formData, setFormData] = useState<FormState>(() =>
    buildInitialFormState(initialData),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { data: barangData } = useApi<{ barangs?: Barang[] } | Barang[]>(
    "/api/inventory/barang?limit=100",
  );
  const { data: gudangData } = useApi<{ gudangs?: Gudang[] } | Gudang[]>(
    "/api/inventory/gudang?view=all",
  );

  const barangs = useMemo(() => normalizeBarangs(barangData), [barangData]);
  const gudangs = useMemo(() => normalizeGudangs(gudangData), [gudangData]);

  const stockUrl =
    formData.barangId && formData.gudangId
      ? `/api/inventory/barang/stock?barangId=${encodeURIComponent(formData.barangId)}&gudangId=${encodeURIComponent(formData.gudangId)}`
      : null;

  const { data: stockData } = useApi<{ stok?: number } | null>(stockUrl);
  const currentStock = stockData?.stok ?? 0;

  const updateField = (field: keyof FormState, value: string) => {
    setFormData((prev) => syncDerivedFormFields(prev, field, value));
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    const validationError = validateForm(formData);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await submitOpname(formData, initialData?.id);

      setSuccess(
        initialData?.id
          ? "Stock opname berhasil diperbarui"
          : "Stock opname berhasil dicatat",
      );

      setTimeout(() => {
        onSuccess();
        onClose();
      }, SUCCESS_REDIRECT_DELAY_MS);
    } catch (err) {
      clientLogger.error("Error saving stock opname", err);
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const selectedBarang = barangs.find((b) => b.id === formData.barangId);
  const selectedGudang = gudangs.find((g) => g.id === formData.gudangId);
  const selisih = (parseInt(formData.stokFisik) || 0) - currentStock;
  const isEditMode = !!initialData?.id;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Banner type="error" message={error} />
      <Banner type="success" message={success} />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <SelectField
          id="barangId"
          label="Barang *"
          value={formData.barangId}
          onChange={(v) => updateField("barangId", v)}
          options={barangs.map((b) => ({
            value: b.id,
            label: `${b.kode} - ${b.nama}`,
          }))}
          placeholder="Pilih Barang"
          required
          disabled={isEditMode}
        />
        <SelectField
          id="gudangId"
          label="Gudang *"
          value={formData.gudangId}
          onChange={(v) => updateField("gudangId", v)}
          options={gudangs.map((g) => ({
            value: g.id,
            label: `${g.kode} - ${g.nama}`,
          }))}
          placeholder="Pilih Gudang"
          required
          disabled={isEditMode}
        />
      </div>

      {selectedBarang && selectedGudang && (
        <StockInfo
          satuan={selectedBarang.satuan}
          currentStock={currentStock}
          stokFisik={formData.stokFisik}
          selisih={selisih}
        />
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <NumberField
          id="stokFisik"
          label="Stok Fisik *"
          value={formData.stokFisik}
          onChange={(v) => updateField("stokFisik", v)}
          required
          placeholder="0"
        />
        <TextField
          id="keterangan"
          label="Keterangan"
          value={formData.keterangan}
          onChange={(v) => updateField("keterangan", v)}
          placeholder="Keterangan stock opname"
        />
      </div>

      <ConditionBreakdown formData={formData} onChange={updateField} />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <TextField
          id="lokasiPenyimpanan"
          label="Lokasi Penyimpanan"
          value={formData.lokasiPenyimpanan}
          onChange={(v) => updateField("lokasiPenyimpanan", v)}
          placeholder="Rak A-01"
        />
        <TextField
          id="nomorRak"
          label="Nomor Rak"
          value={formData.nomorRak}
          onChange={(v) => updateField("nomorRak", v)}
          placeholder="A-01"
        />
        <TextField
          id="nomorBox"
          label="Nomor Box"
          value={formData.nomorBox}
          onChange={(v) => updateField("nomorBox", v)}
          placeholder="BOX-001"
        />
        <TextField
          id="nomorBatch"
          label="Nomor Batch"
          value={formData.nomorBatch}
          onChange={(v) => updateField("nomorBatch", v)}
          placeholder="BATCH-001"
        />
        <DateField
          id="tanggalExpire"
          label="Tanggal Expire"
          value={formData.tanggalExpire}
          onChange={(v) => updateField("tanggalExpire", v)}
        />
        <NumberField
          id="suhuPenyimpanan"
          label="Suhu Penyimpanan (°C)"
          value={formData.suhuPenyimpanan}
          onChange={(v) => updateField("suhuPenyimpanan", v)}
          placeholder="25"
          step="0.1"
        />
        <NumberField
          id="kelembaban"
          label="Kelembaban (%)"
          value={formData.kelembaban}
          onChange={(v) => updateField("kelembaban", v)}
          placeholder="50"
          step="0.1"
          min="0"
          max="100"
        />
      </div>

      <TextareaField
        id="catatanDetail"
        label="Catatan Detail"
        value={formData.catatanDetail}
        onChange={(v) => updateField("catatanDetail", v)}
        placeholder="Catatan tambahan mengenai kondisi barang..."
      />

      <div className="flex justify-end space-x-3">
        <Button
          variant="outline"
          type="button"
          onClick={onClose}
          disabled={loading}
        >
          Batal
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Menyimpan..." : isEditMode ? "Perbarui" : "Simpan"}
        </Button>
      </div>
    </form>
  );
}

function buildInitialFormState(
  initialData: StockOpnameFormData | undefined,
): FormState {
  return {
    barangId: initialData?.barangId || "",
    gudangId: initialData?.gudangId || "",
    stokFisik: initialData?.stokFisik?.toString() || "",
    keterangan: initialData?.keterangan || "",
    kondisiBaik: initialData?.kondisiBaik?.toString() || "0",
    kondisiRusak: initialData?.kondisiRusak?.toString() || "0",
    kondisiExpire: initialData?.kondisiExpire?.toString() || "0",
    lokasiPenyimpanan: initialData?.lokasiPenyimpanan || "",
    nomorRak: initialData?.nomorRak || "",
    nomorBox: initialData?.nomorBox || "",
    suhuPenyimpanan: initialData?.suhuPenyimpanan?.toString() || "",
    kelembaban: initialData?.kelembaban?.toString() || "",
    tanggalExpire: initialData?.tanggalExpire
      ? new Date(initialData.tanggalExpire).toISOString().split("T")[0]
      : "",
    nomorBatch: initialData?.nomorBatch || "",
    catatanDetail: initialData?.catatanDetail || "",
  };
}

function syncDerivedFormFields(
  prev: FormState,
  field: keyof FormState,
  value: string,
): FormState {
  const next = { ...prev, [field]: value };

  if (
    field === "kondisiBaik" ||
    field === "kondisiRusak" ||
    field === "kondisiExpire"
  ) {
    const total = sumConditions(next);
    if (total > 0) next.stokFisik = total.toString();
    return next;
  }

  if (field === "stokFisik") {
    const fisik = parseInt(value) || 0;
    const totalKondisi = sumConditions(next);
    if (fisik > 0 && totalKondisi === 0) {
      return { ...next, ...autoDistributeConditions(fisik) };
    }
  }

  return next;
}

function sumConditions(form: FormState) {
  return (
    (parseInt(form.kondisiBaik) || 0) +
    (parseInt(form.kondisiRusak) || 0) +
    (parseInt(form.kondisiExpire) || 0)
  );
}

function autoDistributeConditions(stokFisik: number) {
  const baik = Math.round(stokFisik * AUTO_DISTRIBUTE_BAIK_RATIO);
  const rusak = Math.round(stokFisik * AUTO_DISTRIBUTE_RUSAK_RATIO);
  const expire = stokFisik - baik - rusak;
  return {
    kondisiBaik: baik.toString(),
    kondisiRusak: rusak.toString(),
    kondisiExpire: expire.toString(),
  };
}

function validateForm(form: FormState): string | null {
  if (!form.barangId || !form.gudangId || !form.stokFisik) {
    return "Barang, gudang, dan stok fisik harus diisi";
  }

  const stokFisik = parseInt(form.stokFisik);
  if (isNaN(stokFisik) || stokFisik < 0) {
    return "Stok fisik harus berupa angka non-negatif";
  }

  const totalKondisi = sumConditions(form);
  if (totalKondisi > stokFisik) {
    return "Total kondisi (baik + rusak + expire) tidak boleh melebihi stok fisik";
  }

  return null;
}

async function submitOpname(form: FormState, opnameId?: string) {
  const payload = {
    barangId: form.barangId,
    gudangId: form.gudangId,
    stokFisik: parseInt(form.stokFisik),
    keterangan: form.keterangan || undefined,
    kondisiBaik: parseInt(form.kondisiBaik) || 0,
    kondisiRusak: parseInt(form.kondisiRusak) || 0,
    kondisiExpire: parseInt(form.kondisiExpire) || 0,
    lokasiPenyimpanan: form.lokasiPenyimpanan || undefined,
    nomorRak: form.nomorRak || undefined,
    nomorBox: form.nomorBox || undefined,
    suhuPenyimpanan: form.suhuPenyimpanan || undefined,
    kelembaban: form.kelembaban || undefined,
    tanggalExpire: form.tanggalExpire || undefined,
    nomorBatch: form.nomorBatch || undefined,
    catatanDetail: form.catatanDetail || undefined,
  };

  const url = opnameId
    ? `/api/inventory/opname/${opnameId}`
    : "/api/inventory/opname";

  const res = await fetchWithHandling<unknown>(url, {
    method: opnameId ? "PUT" : "POST",
    body: JSON.stringify(payload),
  });

  if (!res.success) {
    throw new Error(res.error || "Gagal menyimpan stock opname");
  }
}

function normalizeBarangs(
  data: { barangs?: Barang[] } | Barang[] | undefined,
): Barang[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.barangs ?? [];
}

function normalizeGudangs(
  data: { gudangs?: Gudang[] } | Gudang[] | undefined,
): Gudang[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.gudangs ?? [];
}

function Banner({
  type,
  message,
}: {
  type: "error" | "success";
  message: string;
}) {
  if (!message) return null;
  const classes =
    type === "error"
      ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
      : "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400";
  return <div className={`px-4 py-3 rounded ${classes}`}>{message}</div>;
}

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  disabled,
}: SelectFieldProps) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        required={required}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface InputFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

function TextField(props: InputFieldProps) {
  return (
    <div>
      <Label htmlFor={props.id}>{props.label}</Label>
      <input
        type="text"
        id={props.id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        placeholder={props.placeholder}
        required={props.required}
      />
    </div>
  );
}

interface NumberFieldProps extends InputFieldProps {
  step?: string;
  min?: string;
  max?: string;
}

function NumberField(props: NumberFieldProps) {
  return (
    <div>
      <Label htmlFor={props.id}>{props.label}</Label>
      <input
        type="number"
        id={props.id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        placeholder={props.placeholder}
        required={props.required}
        step={props.step}
        min={props.min ?? "0"}
        max={props.max}
      />
    </div>
  );
}

function DateField(props: InputFieldProps) {
  return (
    <div>
      <Label htmlFor={props.id}>{props.label}</Label>
      <input
        type="date"
        id={props.id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      />
    </div>
  );
}

function TextareaField(props: InputFieldProps) {
  return (
    <div>
      <Label htmlFor={props.id}>{props.label}</Label>
      <textarea
        id={props.id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        rows={3}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        placeholder={props.placeholder}
      />
    </div>
  );
}

function Label({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
    >
      {children}
    </label>
  );
}

function StockInfo({
  satuan,
  currentStock,
  stokFisik,
  selisih,
}: {
  satuan: string;
  currentStock: number;
  stokFisik: string;
  selisih: number;
}) {
  const selisihColor =
    selisih === 0
      ? "text-green-600"
      : selisih > 0
        ? "text-blue-600"
        : "text-red-600";

  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
        Informasi Stok
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-gray-600 dark:text-gray-400">Stok Sistem:</span>
          <span className="ml-2 font-medium text-blue-600">
            {currentStock} {satuan}
          </span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Stok Fisik:</span>
          <span className={`ml-2 font-medium ${selisihColor}`}>
            {stokFisik || 0} {satuan}
          </span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Selisih:</span>
          <span className={`ml-2 font-medium ${selisihColor}`}>
            {selisih > 0 ? "+" : ""}
            {selisih} {satuan}
          </span>
        </div>
      </div>
    </div>
  );
}

interface ConditionBreakdownProps {
  formData: FormState;
  onChange: (field: keyof FormState, value: string) => void;
}

function ConditionBreakdown({ formData, onChange }: ConditionBreakdownProps) {
  const total = sumConditions(formData);
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
        Breakdown Kondisi Fisik
      </h4>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ConditionInput
          id="kondisiBaik"
          label="Baik"
          accent="green"
          value={formData.kondisiBaik}
          onChange={(v) => onChange("kondisiBaik", v)}
        />
        <ConditionInput
          id="kondisiRusak"
          label="Rusak"
          accent="red"
          value={formData.kondisiRusak}
          onChange={(v) => onChange("kondisiRusak", v)}
        />
        <ConditionInput
          id="kondisiExpire"
          label="Bekas/Expire"
          accent="orange"
          value={formData.kondisiExpire}
          onChange={(v) => onChange("kondisiExpire", v)}
        />
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Total kondisi: {total} item
      </p>
    </div>
  );
}

const CONDITION_ACCENT_CLASS: Record<"green" | "red" | "orange", string> = {
  green: "border-green-300 focus:ring-green-500 focus:border-green-500",
  red: "border-red-300 focus:ring-red-500 focus:border-red-500",
  orange: "border-orange-300 focus:ring-orange-500 focus:border-orange-500",
};

function ConditionInput({
  id,
  label,
  accent,
  value,
  onChange,
}: {
  id: string;
  label: string;
  accent: "green" | "red" | "orange";
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        {label}
      </label>
      <input
        type="number"
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white ${CONDITION_ACCENT_CLASS[accent]}`}
        placeholder="0"
        min="0"
      />
    </div>
  );
}
