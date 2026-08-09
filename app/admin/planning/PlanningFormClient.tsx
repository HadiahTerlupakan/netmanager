"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { HiOutlineArrowLeft, HiOutlineMapPin } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import MapPicker from "@/components/common/MapPicker";

type PlanningFormMode = "create" | "edit";

interface PlanningFormClientProps {
  mode: PlanningFormMode;
  planningId?: string;
  initialData?: {
    title: string;
    description: string;
    area: string;
    estimatedUnits: string;
    estimatedBudget: string;
    startDate: string;
    targetCompletionDate: string;
    coordinates: { latitude: number; longitude: number } | null;
  };
}

interface FormState {
  title: string;
  description: string;
  area: string;
  estimatedUnits: string;
  estimatedBudget: string;
  startDate: string;
  targetCompletionDate: string;
  lat: string;
  lon: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  area: "",
  estimatedUnits: "",
  estimatedBudget: "",
  startDate: "",
  targetCompletionDate: "",
  lat: "",
  lon: "",
};

const inputClass =
  "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const labelClass =
  "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

export default function PlanningFormClient({
  mode,
  planningId,
  initialData,
}: PlanningFormClientProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(
    initialData
      ? {
          ...initialData,
          lat: initialData.coordinates?.latitude?.toString() ?? "",
          lon: initialData.coordinates?.longitude?.toString() ?? "",
        }
      : EMPTY_FORM,
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});

  const update = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.title.trim()) next.title = "Judul wajib diisi";
    if (!form.area.trim()) next.area = "Area wajib diisi";
    if (!form.estimatedUnits || Number(form.estimatedUnits) <= 0)
      next.estimatedUnits = "Jumlah unit harus > 0";
    if (
      form.estimatedBudget &&
      (isNaN(Number(form.estimatedBudget)) || Number(form.estimatedBudget) < 0)
    )
      next.estimatedBudget = "Budget harus angka positif";
    if (form.lat && isNaN(Number(form.lat))) next.lat = "Latitude tidak valid";
    if (form.lon && isNaN(Number(form.lon))) next.lon = "Longitude tidak valid";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Lengkapi data yang belum valid");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        type: "OSP",
        title: form.title.trim(),
        description: form.description.trim() || null,
        area: form.area.trim(),
        estimatedUnits: Number(form.estimatedUnits),
      };

      if (form.estimatedBudget)
        payload.estimatedBudget = Number(form.estimatedBudget);

      const hasCoords = form.lat && form.lon;
      if (hasCoords) {
        payload.coordinates = {
          latitude: Number(form.lat),
          longitude: Number(form.lon),
        };
      }

      if (form.startDate)
        payload.startDate = new Date(form.startDate).toISOString();
      if (form.targetCompletionDate)
        payload.targetCompletionDate = new Date(
          form.targetCompletionDate,
        ).toISOString();

      const url =
        mode === "edit" && planningId
          ? `/api/planning/${planningId}`
          : "/api/planning";
      const method = mode === "edit" ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(
          mode === "edit"
            ? "Planning berhasil diperbarui"
            : "Planning berhasil dibuat",
        );
        router.push(`/admin/planning/${data.data.id}`);
      } else {
        toast.error(data.message || data.error || "Gagal menyimpan planning");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/planning/daftar">
          <Button variant="ghost" size="icon">
            <HiOutlineArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {mode === "edit" ? "Edit Planning" : "Buat Planning OSP Baru"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Isi data perencanaan ekspansi jaringan
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Informasi Dasar
          </h2>

          <div>
            <label className={labelClass}>Judul Planning *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Contoh: Ekspansi FO Cipinang 2026"
              className={inputClass}
            />
            {errors.title && (
              <p className="text-xs text-red-600 mt-1">{errors.title}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Area / Lokasi *</label>
              <input
                type="text"
                value={form.area}
                onChange={(e) => update("area", e.target.value)}
                placeholder="Contoh: Cipinang, Jakarta Timur"
                className={inputClass}
              />
              {errors.area && (
                <p className="text-xs text-red-600 mt-1">{errors.area}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Estimasi Unit (Rumah) *</label>
              <input
                type="number"
                value={form.estimatedUnits}
                onChange={(e) => update("estimatedUnits", e.target.value)}
                placeholder="100"
                className={inputClass}
              />
              {errors.estimatedUnits && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.estimatedUnits}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>Deskripsi</label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Detail rencana ekspansi..."
              rows={3}
              className={inputClass}
            />
          </div>
        </div>

        {/* Budget & Timeline */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Budget & Timeline
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Estimasi Budget (Rp)</label>
              <input
                type="number"
                value={form.estimatedBudget}
                onChange={(e) => update("estimatedBudget", e.target.value)}
                placeholder="500000000"
                className={inputClass}
              />
              {errors.estimatedBudget && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.estimatedBudget}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {Number(form.estimatedBudget) >= 500_000_000
                  ? "≥ 500jt → approval 2 level"
                  : form.estimatedBudget
                    ? "< 500jt → approval 1 level"
                    : "Kosong = approval 1 level"}
              </p>
            </div>
            <div>
              <label className={labelClass}>Tanggal Mulai</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => update("startDate", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Target Selesai</label>
              <input
                type="date"
                value={form.targetCompletionDate}
                onChange={(e) => update("targetCompletionDate", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Map picker */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <HiOutlineMapPin className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Koordinat GPS
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Klik peta untuk menentukan titik lokasi ekspansi.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
            <div>
              <label className={labelClass}>Latitude</label>
              <input
                type="text"
                value={form.lat}
                onChange={(e) => update("lat", e.target.value)}
                placeholder="-6.2"
                className={inputClass}
              />
              {errors.lat && (
                <p className="text-xs text-red-600 mt-1">{errors.lat}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Longitude</label>
              <input
                type="text"
                value={form.lon}
                onChange={(e) => update("lon", e.target.value)}
                placeholder="106.8"
                className={inputClass}
              />
              {errors.lon && (
                <p className="text-xs text-red-600 mt-1">{errors.lon}</p>
              )}
            </div>
          </div>
          <MapPicker
            lat={form.lat ? Number(form.lat) : null}
            lon={form.lon ? Number(form.lon) : null}
            height={320}
            onChange={(lat, lon) => {
              update("lat", lat.toString());
              update("lon", lon.toString());
            }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/admin/planning/daftar">
            <Button type="button" variant="outline">
              Batal
            </Button>
          </Link>
          <Button type="submit" loading={saving}>
            {saving
              ? "Menyimpan..."
              : mode === "edit"
                ? "Simpan Perubahan"
                : "Buat Planning"}
          </Button>
        </div>
      </form>
    </div>
  );
}
