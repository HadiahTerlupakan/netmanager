"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HiArrowLeft } from "react-icons/hi2";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";

const PPH_OPTIONS = [
  { value: "", label: "(Tidak ada)" },
  { value: "jasa", label: "Jasa (PPh 23 — 2%)" },
  { value: "sewa", label: "Sewa (PPh 23 — 2%)" },
  { value: "sewa_tanah", label: "Sewa Tanah/Bangunan (PPh 4(2) — 10%)" },
] as const;

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Aktif" },
  { value: "INACTIVE", label: "Non-aktif" },
  { value: "BLACKLISTED", label: "Blacklist" },
] as const;

type StatusValue = (typeof STATUS_OPTIONS)[number]["value"];

interface SupplierFormData {
  code: string;
  name: string;
  address: string;
  contact: string;
  email: string;
  phone: string;
  npwp: string;
  defaultPphCategory: string;
  status: StatusValue;
  blacklistReason: string;
  siupNumber: string;
  siupDocumentUrl: string;
  npwpDocumentUrl: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  contractDocumentUrl: string;
  contractExpiresAt: string; // ISO date YYYY-MM-DD
}

const EMPTY_FORM: SupplierFormData = {
  code: "",
  name: "",
  address: "",
  contact: "",
  email: "",
  phone: "",
  npwp: "",
  defaultPphCategory: "",
  status: "ACTIVE",
  blacklistReason: "",
  siupNumber: "",
  siupDocumentUrl: "",
  npwpDocumentUrl: "",
  bankName: "",
  bankAccountNumber: "",
  bankAccountHolder: "",
  contractDocumentUrl: "",
  contractExpiresAt: "",
};

interface SupplierFormProps {
  /** Pass id to switch into edit mode. Omit untuk create mode. */
  supplierId?: string;
}

/**
 * Form CRUD supplier. Mode create kalau `supplierId` tidak diberi, mode edit
 * kalau diberi (form akan auto-load data). NPWP & defaultPphCategory dipakai
 * oleh modul tax saat record PPN Masukan / PPh dari PO/Expense.
 *
 * Status BLACKLISTED wajib disertai `blacklistReason` — divalidasi server-side
 * dan UI-side. Saat status non-aktif/blacklist, supplier tidak bisa dipilih
 * untuk PO baru.
 */
export function SupplierForm({ supplierId }: SupplierFormProps) {
  const router = useRouter();
  const isEdit = Boolean(supplierId);

  const [formData, setFormData] = useState<SupplierFormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(isEdit);

  useEffect(() => {
    if (!supplierId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/procurement/suppliers/${supplierId}`,
        );
        if (!res.ok) {
          throw new Error((await res.json()).error || "Gagal memuat supplier");
        }
        const json = await res.json();
        if (cancelled) return;
        setFormData({
          code: json.data.code ?? "",
          name: json.data.name ?? "",
          address: json.data.address ?? "",
          contact: json.data.contact ?? "",
          email: json.data.email ?? "",
          phone: json.data.phone ?? "",
          npwp: json.data.npwp ?? "",
          defaultPphCategory: json.data.defaultPphCategory ?? "",
          status: (json.data.status as StatusValue) ?? "ACTIVE",
          blacklistReason: json.data.blacklistReason ?? "",
          siupNumber: json.data.siupNumber ?? "",
          siupDocumentUrl: json.data.siupDocumentUrl ?? "",
          npwpDocumentUrl: json.data.npwpDocumentUrl ?? "",
          bankName: json.data.bankName ?? "",
          bankAccountNumber: json.data.bankAccountNumber ?? "",
          bankAccountHolder: json.data.bankAccountHolder ?? "",
          contractDocumentUrl: json.data.contractDocumentUrl ?? "",
          contractExpiresAt: json.data.contractExpiresAt
            ? json.data.contractExpiresAt.slice(0, 10)
            : "",
        });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Gagal memuat supplier",
        );
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  const updateField = <K extends keyof SupplierFormData>(
    key: K,
    value: SupplierFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      formData.status === "BLACKLISTED" &&
      formData.blacklistReason.trim() === ""
    ) {
      toast.error("Alasan blacklist wajib diisi saat status BLACKLISTED");
      return;
    }

    setLoading(true);
    try {
      const url = isEdit
        ? `/api/admin/procurement/suppliers/${supplierId}`
        : "/api/admin/procurement/suppliers";
      const method = isEdit ? "PATCH" : "POST";

      const payload = {
        ...(isEdit ? {} : { code: formData.code }),
        name: formData.name,
        address: formData.address || null,
        contact: formData.contact || null,
        email: formData.email || null,
        phone: formData.phone || null,
        npwp: formData.npwp || null,
        defaultPphCategory: formData.defaultPphCategory || null,
        status: formData.status,
        blacklistReason: formData.blacklistReason || null,
        siupNumber: formData.siupNumber || null,
        siupDocumentUrl: formData.siupDocumentUrl || null,
        npwpDocumentUrl: formData.npwpDocumentUrl || null,
        bankName: formData.bankName || null,
        bankAccountNumber: formData.bankAccountNumber || null,
        bankAccountHolder: formData.bankAccountHolder || null,
        contractDocumentUrl: formData.contractDocumentUrl || null,
        contractExpiresAt: formData.contractExpiresAt
          ? new Date(
              `${formData.contractExpiresAt}T00:00:00.000Z`,
            ).toISOString()
          : null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menyimpan supplier");
      }

      toast.success(
        isEdit ? "Supplier berhasil diperbarui" : "Supplier berhasil dibuat",
      );
      router.push("/admin/procurement/suppliers");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  if (loadingDetail) {
    return <div className="p-8 text-center text-gray-500">Memuat data...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin/procurement/suppliers"
          className="text-gray-600 hover:text-gray-900"
        >
          <HiArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-semibold">
          {isEdit ? "Edit Supplier" : "Tambah Supplier"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Section title="Identitas">
          <Field label="Kode Supplier" required>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => updateField("code", e.target.value)}
              disabled={isEdit}
              required
              maxLength={50}
              className="form-input"
            />
          </Field>
          <Field label="Nama Supplier" required>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateField("name", e.target.value)}
              required
              maxLength={200}
              className="form-input"
            />
          </Field>
        </Section>

        <Section title="Status">
          <Field
            label="Status Supplier"
            help="Hanya supplier ACTIVE yang dapat dipilih untuk PO baru"
          >
            <select
              value={formData.status}
              onChange={(e) =>
                updateField("status", e.target.value as StatusValue)
              }
              className="form-input"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
          {formData.status === "BLACKLISTED" && (
            <Field label="Alasan Blacklist" required>
              <textarea
                value={formData.blacklistReason}
                onChange={(e) => updateField("blacklistReason", e.target.value)}
                rows={3}
                maxLength={500}
                required
                placeholder="Mis. barang sering tidak sesuai spesifikasi, terlambat kirim 3x berturut-turut, dll"
                className="form-input"
              />
            </Field>
          )}
        </Section>

        <Section title="Kontak">
          <Field label="Alamat">
            <textarea
              value={formData.address}
              onChange={(e) => updateField("address", e.target.value)}
              rows={3}
              maxLength={500}
              className="form-input"
            />
          </Field>
          <Field label="Contact Person">
            <input
              type="text"
              value={formData.contact}
              onChange={(e) => updateField("contact", e.target.value)}
              maxLength={100}
              className="form-input"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              className="form-input"
            />
          </Field>
          <Field label="Telepon">
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              maxLength={50}
              className="form-input"
            />
          </Field>
        </Section>

        <Section title="Pajak & Compliance">
          <Field
            label="NPWP"
            help="15 digit (NPWP lama) atau 16 digit (NIK Coretax 2025)"
          >
            <input
              type="text"
              value={formData.npwp}
              onChange={(e) =>
                updateField(
                  "npwp",
                  e.target.value.replace(/[^0-9]/g, "").slice(0, 16),
                )
              }
              placeholder="0000000000000000"
              className="form-input font-mono"
            />
          </Field>
          <Field
            label="Kategori PPh Default"
            help="Dipakai modul pajak saat record PPh dari PO ke supplier ini"
          >
            <select
              value={formData.defaultPphCategory}
              onChange={(e) =>
                updateField("defaultPphCategory", e.target.value)
              }
              className="form-input"
            >
              {PPH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="No. SIUP">
            <input
              type="text"
              value={formData.siupNumber}
              onChange={(e) => updateField("siupNumber", e.target.value)}
              maxLength={200}
              className="form-input"
            />
          </Field>
          <Field
            label="URL Dokumen SIUP"
            help="Link cloud storage / arsip internal"
          >
            <input
              type="url"
              value={formData.siupDocumentUrl}
              onChange={(e) => updateField("siupDocumentUrl", e.target.value)}
              maxLength={500}
              placeholder="https://..."
              className="form-input"
            />
          </Field>
          <Field label="URL Dokumen NPWP">
            <input
              type="url"
              value={formData.npwpDocumentUrl}
              onChange={(e) => updateField("npwpDocumentUrl", e.target.value)}
              maxLength={500}
              placeholder="https://..."
              className="form-input"
            />
          </Field>
        </Section>

        <Section title="Rekening Pembayaran">
          <Field label="Nama Bank">
            <input
              type="text"
              value={formData.bankName}
              onChange={(e) => updateField("bankName", e.target.value)}
              maxLength={200}
              className="form-input"
            />
          </Field>
          <Field label="Nomor Rekening">
            <input
              type="text"
              value={formData.bankAccountNumber}
              onChange={(e) => updateField("bankAccountNumber", e.target.value)}
              maxLength={50}
              className="form-input font-mono"
            />
          </Field>
          <Field label="Atas Nama">
            <input
              type="text"
              value={formData.bankAccountHolder}
              onChange={(e) => updateField("bankAccountHolder", e.target.value)}
              maxLength={200}
              className="form-input"
            />
          </Field>
        </Section>

        <Section title="Kontrak">
          <Field label="URL Dokumen Kontrak">
            <input
              type="url"
              value={formData.contractDocumentUrl}
              onChange={(e) =>
                updateField("contractDocumentUrl", e.target.value)
              }
              maxLength={500}
              placeholder="https://..."
              className="form-input"
            />
          </Field>
          <Field label="Tanggal Berakhir Kontrak">
            <input
              type="date"
              value={formData.contractExpiresAt}
              onChange={(e) => updateField("contractExpiresAt", e.target.value)}
              className="form-input"
            />
          </Field>
        </Section>

        <div className="flex gap-3 justify-end pt-4 border-t">
          <Link
            href="/admin/procurement/suppliers"
            className="px-4 py-2 text-gray-700 border rounded-md hover:bg-gray-50"
          >
            Batal
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan"}
          </Button>
        </div>
      </form>

      <style jsx>{`
        :global(.form-input) {
          display: block;
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
        }
        :global(.form-input:focus) {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 1px #2563eb;
        }
        :global(.form-input:disabled) {
          background: #f3f4f6;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="border rounded-lg p-4">
      <legend className="px-2 text-sm font-medium text-gray-700">
        {title}
      </legend>
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  required,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {help && <p className="mt-1 text-xs text-gray-500">{help}</p>}
    </div>
  );
}
