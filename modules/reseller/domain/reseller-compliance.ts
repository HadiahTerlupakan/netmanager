import type {
  ResellerEntity,
  ResellerStatusValue,
} from "./entities/ResellerEntity";

/**
 * Aturan kemitraan dan kepatuhan reseller — fungsi murni, tanpa I/O.
 *
 * Dasar: PM Kominfo 5/2021 Ps 223(2)a (reseller wajib memenuhi standar usaha
 * jual kembali: NIB + Sertifikat Standar KBLI) dan Ps 223(2)b (PKS tertulis
 * ISP–reseller). Model agen: ISP menagih atas mereknya sendiri, reseller
 * menerima komisi.
 */

/**
 * Izin untuk mengubah pengaturan "wajibkan kepatuhan reseller". Keduanya wajib
 * (DAN): pengaturan tenant sekaligus wilayah reseller.
 */
export const RESELLER_COMPLIANCE_SETTING_PERMISSIONS = [
  "umum:update",
  "reseller:update",
] as const;

/** PKS dianggap "segera berakhir" mulai 30 hari sebelum tanggal berakhir. */
export const PKS_EXPIRING_WINDOW_DAYS = 30;

/** Status yang wajib disertai alasan saat dipasang. */
const STATUSES_REQUIRING_REASON: ReadonlySet<ResellerStatusValue> = new Set([
  "SUSPENDED",
  "TERMINATED",
]);

/**
 * PENDING: PKS sudah ada tetapi tanggal mulainya belum tiba (belum berlaku).
 */
export type PksStatus = "NONE" | "PENDING" | "ACTIVE" | "EXPIRING" | "EXPIRED";

/** Satu kontrak PKS reseller dari modul legal. */
export interface PksContractSnapshot {
  readonly documentId: string;
  readonly startDate: Date | null;
  readonly endDate: Date | null;
  /** Sisa hari sampai berakhir; null bila tanpa tanggal akhir. */
  readonly daysLeft: number | null;
  readonly hasStarted: boolean;
}

export interface ResellerPksSummary {
  readonly status: PksStatus;
  readonly documentId: string | null;
  readonly startDate: Date | null;
  readonly endDate: Date | null;
  readonly daysLeft: number | null;
}

export type ComplianceIssue =
  | "NIB_MISSING"
  | "KBLI_MISSING"
  | "CERTIFICATE_MISSING"
  | "LICENSE_NOT_VERIFIED"
  | "PKS_MISSING"
  | "PKS_NOT_STARTED"
  | "PKS_EXPIRED";

export interface ResellerComplianceResult {
  readonly isCompliant: boolean;
  readonly issues: readonly ComplianceIssue[];
  readonly pks: ResellerPksSummary;
}

/** Label Indonesia tiap masalah kepatuhan, untuk pesan galat dan UI. */
export const COMPLIANCE_ISSUE_LABELS: Record<ComplianceIssue, string> = {
  NIB_MISSING: "NIB belum diisi",
  KBLI_MISSING: "kode KBLI belum diisi",
  CERTIFICATE_MISSING: "nomor Sertifikat Standar belum diisi",
  LICENSE_NOT_VERIFIED: "data izin belum diverifikasi",
  PKS_MISSING: "belum ada PKS aktif di modul Legal",
  PKS_NOT_STARTED: "PKS sudah ada tetapi belum mulai berlaku",
  PKS_EXPIRED: "PKS sudah kedaluwarsa",
};

export type ResellerLicenseFields = Pick<
  ResellerEntity,
  "nib" | "kbliCode" | "standardCertificateNumber" | "licenseVerifiedAt"
>;

/**
 * True bila perubahan ke `status` wajib beralasan: menuju SUSPENDED/TERMINATED,
 * atau keluar dari TERMINATED (mengaktifkan ulang kemitraan yang diputus harus
 * tercatat alasannya karena alasan pemutusan lama tertimpa).
 */
export function requiresStatusReason(
  status: ResellerStatusValue,
  currentStatus: ResellerStatusValue | null = null,
): boolean {
  if (STATUSES_REQUIRING_REASON.has(status)) return true;
  return currentStatus === "TERMINATED" && status !== "TERMINATED";
}

/**
 * True bila reseller berhak komisi atas pembayaran pada `paidAt`. Reseller
 * ACTIVE selalu berhak. Reseller non-ACTIVE tetap berhak atas pembayaran yang
 * terjadi sebelum statusnya berubah (job INVOICE_PAID yang terlambat atau
 * di-retry); tanpa jejak waktu perubahan, dianggap tidak berhak.
 */
export function isEligibleForCommissionAt(
  status: ResellerStatusValue,
  statusChangedAt: Date | null,
  paidAt: Date,
): boolean {
  if (isPartnershipActive(status)) return true;
  return statusChangedAt !== null && paidAt < statusChangedAt;
}

/**
 * Hanya reseller ACTIVE yang boleh menerima pelanggan baru dan mengakru
 * komisi. INACTIVE, SUSPENDED, dan TERMINATED sama-sama dihentikan.
 */
export function isPartnershipActive(
  status: ResellerStatusValue,
): status is "ACTIVE" {
  return status === "ACTIVE";
}

/** True bila NIB, KBLI, dan nomor Sertifikat Standar sudah terisi. */
export function hasLicenseData(
  license: Pick<
    ResellerLicenseFields,
    "nib" | "kbliCode" | "standardCertificateNumber"
  >,
): boolean {
  return Boolean(
    license.nib && license.kbliCode && license.standardCertificateNumber,
  );
}

function isContractInForce(contract: PksContractSnapshot): boolean {
  return (
    contract.hasStarted &&
    (contract.daysLeft === null || contract.daysLeft >= 0)
  );
}

/** Kontrak berlaku yang paling lama masa berlakunya (tanpa akhir = terlama). */
function pickLongestInForce(
  contracts: readonly PksContractSnapshot[],
): PksContractSnapshot | null {
  const inForce = contracts.filter(isContractInForce);
  if (inForce.length === 0) return null;

  return inForce.reduce((best, contract) => {
    if (best.daysLeft === null) return best;
    if (contract.daysLeft === null) return contract;
    return contract.daysLeft > best.daysLeft ? contract : best;
  });
}

/** Kontrak kedaluwarsa yang paling baru berakhir. */
function pickLatestExpired(
  contracts: readonly PksContractSnapshot[],
): PksContractSnapshot | null {
  const expired = contracts.filter(
    (contract) => contract.daysLeft !== null && contract.daysLeft < 0,
  );
  if (expired.length === 0) return null;

  return expired.reduce((latest, contract) =>
    (contract.daysLeft ?? 0) > (latest.daysLeft ?? 0) ? contract : latest,
  );
}

function toSummary(
  status: PksStatus,
  contract: PksContractSnapshot | null,
): ResellerPksSummary {
  return {
    status,
    documentId: contract?.documentId ?? null,
    startDate: contract?.startDate ?? null,
    endDate: contract?.endDate ?? null,
    daysLeft: contract?.daysLeft ?? null,
  };
}

/** Kontrak yang belum mulai dengan tanggal mulai paling dekat. */
function pickEarliestPending(
  contracts: readonly PksContractSnapshot[],
): PksContractSnapshot | null {
  const pending = contracts.filter(
    (contract) =>
      !contract.hasStarted &&
      (contract.daysLeft === null || contract.daysLeft >= 0),
  );
  if (pending.length === 0) return null;

  return pending.reduce((earliest, contract) =>
    (contract.startDate?.getTime() ?? 0) < (earliest.startDate?.getTime() ?? 0)
      ? contract
      : earliest,
  );
}

/**
 * Status PKS reseller dari kontrak-kontraknya: ACTIVE, EXPIRING (≤30 hari
 * lagi), PENDING (ada PKS tetapi belum mulai), EXPIRED (hanya ada yang sudah
 * lewat), atau NONE. Kontrak yang belum mulai tidak dihitung berlaku.
 */
export function summarizePks(
  contracts: readonly PksContractSnapshot[],
): ResellerPksSummary {
  const inForce = pickLongestInForce(contracts);
  if (inForce) {
    const isExpiring =
      inForce.daysLeft !== null && inForce.daysLeft <= PKS_EXPIRING_WINDOW_DAYS;
    return toSummary(isExpiring ? "EXPIRING" : "ACTIVE", inForce);
  }

  const pending = pickEarliestPending(contracts);
  if (pending) return toSummary("PENDING", pending);

  const expired = pickLatestExpired(contracts);
  return expired ? toSummary("EXPIRED", expired) : toSummary("NONE", null);
}

/**
 * Reseller "patuh" bila data izin lengkap dan terverifikasi serta ada PKS
 * yang berlaku (ACTIVE atau EXPIRING).
 */
export function evaluateCompliance(
  license: ResellerLicenseFields,
  pks: ResellerPksSummary,
): ResellerComplianceResult {
  const issues: ComplianceIssue[] = [];
  if (!license.nib) issues.push("NIB_MISSING");
  if (!license.kbliCode) issues.push("KBLI_MISSING");
  if (!license.standardCertificateNumber) issues.push("CERTIFICATE_MISSING");
  if (!license.licenseVerifiedAt) issues.push("LICENSE_NOT_VERIFIED");
  if (pks.status === "NONE") issues.push("PKS_MISSING");
  if (pks.status === "PENDING") issues.push("PKS_NOT_STARTED");
  if (pks.status === "EXPIRED") issues.push("PKS_EXPIRED");

  return { isCompliant: issues.length === 0, issues, pks };
}
