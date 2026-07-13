"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { Modal } from "@/components/ui/Modal";
import { getWithAuth, postWithAuth, putWithAuth } from "@/lib/api-client";
import type { Jasa } from "../restock/types";

const SATUAN_OPTIONS = [
  "job",
  "titik",
  "unit",
  "jam",
  "hari",
  "bulan",
] as const;
const KATEGORI_PPH_OPTIONS = [
  { value: "", label: "— Tidak ada —" },
  { value: "jasa", label: "Jasa" },
  { value: "sewa", label: "Sewa" },
  { value: "sewa_tanah", label: "Sewa Tanah" },
] as const;

interface Supplier {
  id: string;
  name: string;
  code: string;
}

interface JasaFormData {
  kode: string;
  nama: string;
  satuan: string;
  supplierId: string;
  hargaEstimasi: string;
  kategoriPph: string;
  deskripsi: string;
  status: "ACTIVE" | "INACTIVE";
}

const EMPTY_FORM: JasaFormData = {
  kode: "",
  nama: "",
  satuan: "job",
  supplierId: "",
  hargaEstimasi: "0",
  kategoriPph: "",
  deskripsi: "",
  status: "ACTIVE",
};

function buildAutoKode(): string {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `JSA-${ymd}-${seq}`;
}

function jasaToForm(jasa: Jasa): JasaFormData {
  return {
    kode: jasa.kode,
    nama: jasa.nama,
    satuan: jasa.satuan,
    supplierId: jasa.supplierId ?? "",
    hargaEstimasi: String(jasa.hargaEstimasi),
    kategoriPph: jasa.kategoriPph ?? "",
    deskripsi: jasa.deskripsi ?? "",
    status: jasa.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
  };
}

interface JasaFormModalProps {
  isOpen: boolean;
  editingJasa: Jasa | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function JasaFormModal({
  isOpen,
  editingJasa,
  onClose,
  onSuccess,
}: JasaFormModalProps) {
  const [form, setForm] = useState<JasaFormData>(() =>
    editingJasa
      ? jasaToForm(editingJasa)
      : { ...EMPTY_FORM, kode: buildAutoKode() },
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    void getWithAuth("/api/admin/procurement/suppliers?limit=200")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data?.items) setSuppliers(json.data.items);
        else if (Array.isArray(json?.data)) setSuppliers(json.data);
      })
      .catch(() => {});
  }, [isOpen]);

  const set = (field: keyof JasaFormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!form.nama.trim()) {
      toast.error("Nama jasa wajib diisi");
      return;
    }
    if (!form.kode.trim()) {
      toast.error("Kode jasa wajib diisi");
      return;
    }

    const payload = {
      kode: form.kode.trim(),
      nama: form.nama.trim(),
      satuan: form.satuan,
      supplierId: form.supplierId || null,
      hargaEstimasi: parseFloat(form.hargaEstimasi) || 0,
      kategoriPph: form.kategoriPph || null,
      deskripsi: form.deskripsi.trim() || null,
      status: form.status,
    };

    setSubmitting(true);
    try {
      const res = editingJasa
        ? await putWithAuth(`/api/inventory/jasa/${editingJasa.id}`, payload)
        : await postWithAuth("/api/inventory/jasa", payload);

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Gagal menyimpan jasa");
      }

      toast.success(
        editingJasa ? "Jasa berhasil diperbarui" : "Jasa berhasil ditambahkan",
      );
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan jasa");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 shadow-sm transition-all focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-violet-500 dark:focus:ring-violet-950/40";
  const labelClass =
    "block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingJasa ? "Edit Jasa" : "Tambah Jasa Baru"}
      size="2xl"
    >
      <div className="space-y-5 p-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>
              Kode Jasa{" "}
              <span className="text-red-500 normal-case tracking-normal">
                *
              </span>
            </label>
            <input
              type="text"
              value={form.kode}
              onChange={(e) => set("kode", e.target.value)}
              placeholder="JSA-YYYYMMDD-NNN"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Nama Jasa{" "}
              <span className="text-red-500 normal-case tracking-normal">
                *
              </span>
            </label>
            <input
              type="text"
              value={form.nama}
              onChange={(e) => set("nama", e.target.value)}
              placeholder="Contoh: Instalasi Kabel Fiber"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Satuan</label>
            <select
              value={form.satuan}
              onChange={(e) => set("satuan", e.target.value)}
              className={inputClass}
            >
              {SATUAN_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Harga Estimasi (Rp)</label>
            <input
              type="number"
              min="0"
              value={form.hargaEstimasi}
              onChange={(e) => set("hargaEstimasi", e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Supplier (Opsional)</label>
            {suppliers.length > 0 ? (
              <select
                value={form.supplierId}
                onChange={(e) => set("supplierId", e.target.value)}
                className={inputClass}
              >
                <option value="">— Pilih Supplier —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={form.supplierId}
                onChange={(e) => set("supplierId", e.target.value)}
                placeholder="ID Supplier (opsional)"
                className={inputClass}
              />
            )}
          </div>

          <div>
            <label className={labelClass}>Kategori PPh</label>
            <select
              value={form.kategoriPph}
              onChange={(e) => set("kategoriPph", e.target.value)}
              className={inputClass}
            >
              {KATEGORI_PPH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Deskripsi</label>
          <textarea
            value={form.deskripsi}
            onChange={(e) => set("deskripsi", e.target.value)}
            placeholder="Keterangan tambahan tentang jasa ini..."
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <label className={labelClass}>Status</label>
          <div className="flex gap-3">
            {(["ACTIVE", "INACTIVE"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set("status", s)}
                className={`flex-1 rounded-2xl py-3 text-xs font-black uppercase tracking-widest transition-all ${
                  form.status === s
                    ? s === "ACTIVE"
                      ? "bg-green-600 text-white shadow-lg shadow-green-200 dark:shadow-none"
                      : "bg-red-500 text-white shadow-lg shadow-red-200 dark:shadow-none"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                }`}
              >
                {s === "ACTIVE" ? "Aktif" : "Nonaktif"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl bg-gray-50 px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-500 transition-all hover:bg-gray-100 active:scale-95 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-[2] rounded-2xl bg-violet-600 px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-2xl shadow-violet-200 transition-all hover:bg-violet-700 active:scale-95 disabled:opacity-30 dark:shadow-none"
          >
            {submitting
              ? "Menyimpan..."
              : editingJasa
                ? "Simpan Perubahan"
                : "Tambah Jasa"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
