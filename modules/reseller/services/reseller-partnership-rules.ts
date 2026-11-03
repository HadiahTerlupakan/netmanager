import type {
  ResellerEntity,
  ResellerStatusValue,
} from "../domain/entities/ResellerEntity";
import type {
  ResellerLicenseData,
  ResellerStatusAuditData,
} from "../domain/ports/IResellerRepository";
import {
  hasLicenseData,
  requiresStatusReason,
} from "../domain/reseller-compliance";
import { ResellerValidationError } from "../errors/reseller-errors";
import { STATUS_REASON_REQUIRED_MESSAGE } from "../validators/reseller";
import { trimOptionalText } from "./reseller-text";

/**
 * Aturan tulis data izin dan status kemitraan reseller, dipakai saat membuat
 * maupun mengubah reseller.
 */

const LICENSE_INCOMPLETE_MESSAGE =
  "Lengkapi NIB, kode KBLI, dan nomor Sertifikat Standar sebelum menandai izin terverifikasi";

/** Masukan izin dari klien, sebelum dinormalisasi. */
export interface LicenseInput {
  readonly legalName?: string | null;
  readonly nib?: string | null;
  readonly kbliCode?: string | null;
  readonly standardCertificateNumber?: string | null;
  readonly brandName?: string | null;
  readonly licenseVerified?: boolean;
}

/** Masukan status dari klien. */
export interface StatusInput {
  readonly status?: ResellerStatusValue;
  readonly statusReason?: string | null;
}

/** Siapa dan kapan perubahan dilakukan. */
export interface ChangeActor {
  readonly actorId: string | null;
  readonly now: Date;
}

type LicenseSnapshot = Pick<
  ResellerEntity,
  | "nib"
  | "kbliCode"
  | "standardCertificateNumber"
  | "licenseVerifiedAt"
  | "licenseVerifiedById"
>;

const EMPTY_LICENSE: LicenseSnapshot = {
  nib: null,
  kbliCode: null,
  standardCertificateNumber: null,
  licenseVerifiedAt: null,
  licenseVerifiedById: null,
};

/** Nilai berikutnya: `undefined` = tidak dikirim, pakai nilai lama. */
function nextValue(
  input: string | null | undefined,
  current: string | null,
): string | null {
  const trimmed = trimOptionalText(input);
  return trimmed === undefined ? current : trimmed;
}

function isLicenseChanged(
  current: LicenseSnapshot,
  next: Pick<LicenseSnapshot, "nib" | "kbliCode" | "standardCertificateNumber">,
): boolean {
  return (
    current.nib !== next.nib ||
    current.kbliCode !== next.kbliCode ||
    current.standardCertificateNumber !== next.standardCertificateNumber
  );
}

/**
 * Normalisasi data izin dan tentukan jejak verifikasinya.
 *
 * - `licenseVerified: true` butuh NIB, KBLI, dan sertifikat terisi; waktu
 *   verifikasi lama dipertahankan bila datanya tidak berubah.
 * - `licenseVerified: false` mencabut verifikasi.
 * - Tidak dikirim: verifikasi gugur bila NIB/KBLI/sertifikat berubah, karena
 *   yang diverifikasi adalah data lama.
 *
 * @throws ResellerValidationError izin ditandai terverifikasi tetapi belum lengkap.
 */
export function resolveLicenseData(
  input: LicenseInput,
  existing: LicenseSnapshot | null,
  actor: ChangeActor,
): ResellerLicenseData {
  const current = existing ?? EMPTY_LICENSE;
  const next = {
    nib: nextValue(input.nib, current.nib),
    kbliCode: nextValue(input.kbliCode, current.kbliCode),
    standardCertificateNumber: nextValue(
      input.standardCertificateNumber,
      current.standardCertificateNumber,
    ),
  };
  const isChanged = isLicenseChanged(current, next);
  const verification = resolveVerification(
    input.licenseVerified,
    current,
    next,
    isChanged,
    actor,
  );

  return {
    legalName: trimOptionalText(input.legalName),
    brandName: trimOptionalText(input.brandName),
    ...(existing && !isChanged ? {} : next),
    ...verification,
  };
}

function resolveVerification(
  licenseVerified: boolean | undefined,
  current: LicenseSnapshot,
  next: Pick<LicenseSnapshot, "nib" | "kbliCode" | "standardCertificateNumber">,
  isChanged: boolean,
  actor: ChangeActor,
): Pick<ResellerLicenseData, "licenseVerifiedAt" | "licenseVerifiedById"> {
  const cleared: Pick<
    ResellerLicenseData,
    "licenseVerifiedAt" | "licenseVerifiedById"
  > = { licenseVerifiedAt: null, licenseVerifiedById: null };
  if (licenseVerified === false) return cleared;
  if (licenseVerified === undefined) return isChanged ? cleared : {};

  if (!hasLicenseData(next)) {
    throw new ResellerValidationError(LICENSE_INCOMPLETE_MESSAGE);
  }
  if (current.licenseVerifiedAt && !isChanged) return {};
  return { licenseVerifiedAt: actor.now, licenseVerifiedById: actor.actorId };
}

/**
 * Status kemitraan berikutnya beserta jejaknya. Perubahan status mencatat
 * waktu, pelaku, dan alasan; menuju SUSPENDED/TERMINATED atau keluar dari
 * TERMINATED wajib beralasan. Tanpa perubahan status, alasan hanya diperbarui
 * bila dikirim.
 *
 * @throws ResellerValidationError alasan kosong untuk transisi yang mewajibkannya.
 */
export function resolveStatusData(
  input: StatusInput,
  currentStatus: ResellerStatusValue | null,
  actor: ChangeActor,
): ResellerStatusAuditData & { readonly status?: ResellerStatusValue } {
  const reason = trimOptionalText(input.statusReason);
  const nextStatus = input.status ?? currentStatus ?? "ACTIVE";
  const isChanged = nextStatus !== currentStatus;

  const isReasonRequired = isChanged
    ? requiresStatusReason(nextStatus, currentStatus)
    : requiresStatusReason(nextStatus);
  if (isReasonRequired && (isChanged || reason !== undefined) && !reason) {
    throw new ResellerValidationError(STATUS_REASON_REQUIRED_MESSAGE);
  }
  if (!isChanged) {
    return reason === undefined ? {} : { statusReason: reason };
  }
  return {
    status: nextStatus,
    statusReason: reason ?? null,
    statusChangedAt: actor.now,
    statusChangedById: actor.actorId,
  };
}
