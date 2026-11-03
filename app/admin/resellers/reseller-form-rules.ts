import type { ResellerForm, ResellerStatus } from "./types";
import { isReasonRequired } from "./types";

/** Kolom izin yang, bila berubah, membatalkan verifikasi. */
export type LicenseField = "nib" | "kbliCode" | "standardCertificateNumber";

const LICENSE_FIELDS: readonly LicenseField[] = [
  "nib",
  "kbliCode",
  "standardCertificateNumber",
];

function isLicenseSameAsSaved(
  form: ResellerForm,
  savedForm: ResellerForm,
): boolean {
  return LICENSE_FIELDS.every(
    (field) => form[field].trim() === savedForm[field].trim(),
  );
}

/**
 * Ubah satu kolom izin. Data izin yang berbeda dari yang tersimpan harus
 * diverifikasi ulang, jadi centangnya dilepas; bila nilainya kembali sama
 * dengan yang tersimpan, status verifikasi tersimpan dipulihkan.
 */
export function applyLicenseFieldChange(
  form: ResellerForm,
  field: LicenseField,
  value: string,
  savedForm: ResellerForm | null,
): ResellerForm {
  const next = { ...form, [field]: value };
  const isUnchanged =
    savedForm !== null && isLicenseSameAsSaved(next, savedForm);
  return {
    ...next,
    licenseVerified: isUnchanged ? savedForm.licenseVerified : false,
  };
}

/**
 * Ganti status kemitraan. Alasan lama tidak berlaku untuk status baru; bila
 * kembali ke status tersimpan, alasan tersimpan dipulihkan.
 */
export function applyStatusChange(
  form: ResellerForm,
  status: ResellerStatus,
  savedForm: ResellerForm | null,
): ResellerForm {
  const isBackToSaved = savedForm !== null && status === savedForm.status;
  return {
    ...form,
    status,
    statusReason: isBackToSaved ? savedForm.statusReason : "",
  };
}

/** True bila alasan wajib diisi untuk status pada form. */
export function isStatusReasonRequiredFor(
  form: ResellerForm,
  savedForm: ResellerForm | null,
): boolean {
  return isReasonRequired(form.status, savedForm?.status ?? null);
}

/**
 * Kolom alasan tampil bila wajib, bila status diubah dari yang tersimpan,
 * atau bila reseller tersimpan sudah punya alasan — tidak hilang saat isinya
 * dihapus.
 */
export function shouldShowStatusReason(
  form: ResellerForm,
  savedForm: ResellerForm | null,
): boolean {
  if (isStatusReasonRequiredFor(form, savedForm)) return true;
  if (!savedForm) return false;
  return form.status !== savedForm.status || Boolean(savedForm.statusReason);
}
