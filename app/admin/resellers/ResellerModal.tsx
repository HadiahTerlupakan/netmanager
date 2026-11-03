"use client";

import { Button } from "@/components/ui/Button";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import {
  applyLicenseFieldChange,
  applyStatusChange,
  isStatusReasonRequiredFor,
  shouldShowStatusReason,
  type LicenseField,
} from "./reseller-form-rules";
import type { ResellerForm, ResellerStatus } from "./types";
import { RESELLER_STATUS_LABELS } from "./types";

type ResellerModalProps = {
  readonly isOpen: boolean;
  readonly isEditing: boolean;
  readonly saving: boolean;
  readonly form: ResellerForm;
  /** Isi form dari reseller tersimpan saat edit; null saat menambah. */
  readonly savedForm: ResellerForm | null;
  readonly onClose: () => void;
  readonly onSave: () => void;
  readonly onChange: (form: ResellerForm) => void;
};

const INPUT_CLASS =
  "rounded-xl border px-4 py-2 dark:border-gray-600 dark:bg-gray-700";
const STATUS_OPTIONS = Object.keys(RESELLER_STATUS_LABELS) as ResellerStatus[];
const SECTION_TITLE_CLASS =
  "sm:col-span-2 mt-2 text-sm font-semibold text-gray-700 dark:text-gray-200";
const HINT_CLASS = "sm:col-span-2 text-xs text-gray-500 dark:text-gray-400";

export function ResellerModal({
  isOpen,
  isEditing,
  saving,
  form,
  savedForm,
  onClose,
  onSave,
  onChange,
}: ResellerModalProps) {
  const changeLicenseField = (field: LicenseField, value: string) =>
    onChange(applyLicenseFieldChange(form, field, value, savedForm));
  const changeStatus = (status: ResellerStatus) =>
    onChange(applyStatusChange(form, status, savedForm));
  const isStatusReasonRequired = isStatusReasonRequiredFor(form, savedForm);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Reseller" : "Tambah Reseller"}
      size="lg"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <input
          className={INPUT_CLASS}
          placeholder="Kode"
          value={form.code}
          onChange={(event) => onChange({ ...form, code: event.target.value })}
        />
        <input
          className={INPUT_CLASS}
          placeholder="Nama"
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
        />
        <input
          className={INPUT_CLASS}
          placeholder="Email"
          value={form.email}
          onChange={(event) => onChange({ ...form, email: event.target.value })}
        />
        <input
          className={INPUT_CLASS}
          placeholder="Telepon"
          value={form.phone}
          onChange={(event) => onChange({ ...form, phone: event.target.value })}
        />
        <select
          className={INPUT_CLASS}
          aria-label="Status kemitraan"
          value={form.status}
          onChange={(event) =>
            changeStatus(event.target.value as ResellerStatus)
          }
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {RESELLER_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <input
          className={INPUT_CLASS}
          placeholder="Catatan"
          value={form.notes}
          onChange={(event) => onChange({ ...form, notes: event.target.value })}
        />
        {form.status !== "ACTIVE" && (
          <p className={HINT_CLASS}>
            Reseller yang tidak berstatus Aktif tidak bisa menerima pelanggan
            baru, dan pembayaran pelanggannya sejak status ini berlaku tidak
            menghasilkan komisi.
          </p>
        )}
        {shouldShowStatusReason(form, savedForm) && (
          <textarea
            className={`${INPUT_CLASS} sm:col-span-2`}
            aria-label="Alasan perubahan status"
            placeholder={
              isStatusReasonRequired
                ? "Alasan perubahan status (wajib)"
                : "Alasan perubahan status"
            }
            value={form.statusReason}
            onChange={(event) =>
              onChange({ ...form, statusReason: event.target.value })
            }
          />
        )}
        <textarea
          className={`${INPUT_CLASS} sm:col-span-2`}
          placeholder="Alamat"
          value={form.address}
          onChange={(event) =>
            onChange({ ...form, address: event.target.value })
          }
        />

        <h3 className={SECTION_TITLE_CLASS}>Perizinan reseller</h3>
        <p className={HINT_CLASS}>
          Reseller wajib punya NIB dan Sertifikat Standar KBLI jual kembali jasa
          telekomunikasi (PM Kominfo 5/2021 Ps 223(2)a). KBLI 2020: 61994; kode
          KBLI 2025 bisa berbeda, cek kode yang aktif di OSS.
        </p>
        <input
          className={INPUT_CLASS}
          placeholder="Nama badan usaha (sesuai NIB)"
          value={form.legalName}
          onChange={(event) =>
            onChange({ ...form, legalName: event.target.value })
          }
        />
        <input
          className={INPUT_CLASS}
          placeholder="NIB (13 digit)"
          inputMode="numeric"
          maxLength={13}
          value={form.nib}
          onChange={(event) => changeLicenseField("nib", event.target.value)}
        />
        <input
          className={INPUT_CLASS}
          placeholder="Kode KBLI (5 digit)"
          inputMode="numeric"
          maxLength={5}
          value={form.kbliCode}
          onChange={(event) =>
            changeLicenseField("kbliCode", event.target.value)
          }
        />
        <input
          className={INPUT_CLASS}
          placeholder="Nomor Sertifikat Standar"
          value={form.standardCertificateNumber}
          onChange={(event) =>
            changeLicenseField("standardCertificateNumber", event.target.value)
          }
        />
        <input
          className={INPUT_CLASS}
          placeholder="Merek tambahan (co-branding, opsional)"
          value={form.brandName}
          onChange={(event) =>
            onChange({ ...form, brandName: event.target.value })
          }
        />
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <input
            type="checkbox"
            checked={form.licenseVerified}
            onChange={(event) =>
              onChange({ ...form, licenseVerified: event.target.checked })
            }
          />
          Data izin sudah diverifikasi di OSS
        </label>
      </div>
      <ModalFooter className="-mx-5 -mb-5 mt-6 sm:-mx-6 sm:-mb-6">
        <Button variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button onClick={onSave} disabled={saving}>
          Simpan
        </Button>
      </ModalFooter>
    </Modal>
  );
}
