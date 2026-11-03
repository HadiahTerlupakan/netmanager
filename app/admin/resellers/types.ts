import { requiresStatusReason } from "@/modules/reseller/client";

export type ResellerStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "TERMINATED";

/** Status outlet: tanpa SUSPENDED/TERMINATED (khusus kemitraan reseller). */
export type OutletStatus = "ACTIVE" | "INACTIVE";

export type PksStatus = "NONE" | "PENDING" | "ACTIVE" | "EXPIRING" | "EXPIRED";

export type ResellerCompliance = {
  readonly isCompliant: boolean;
  readonly issueLabels: readonly string[];
  readonly pks: {
    readonly status: PksStatus;
    readonly documentId: string | null;
    readonly startDate: string | null;
    readonly endDate: string | null;
    readonly daysLeft: number | null;
  };
};

export type Reseller = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly status: ResellerStatus;
  readonly notes: string | null;
  readonly legalName: string | null;
  readonly nib: string | null;
  readonly kbliCode: string | null;
  readonly standardCertificateNumber: string | null;
  readonly brandName: string | null;
  readonly licenseVerifiedAt: string | null;
  readonly statusReason: string | null;
  readonly statusChangedAt: string | null;
  /** Ada di respons daftar dan detail; tidak ada di respons simpan. */
  readonly compliance?: ResellerCompliance;
};

export const RESELLER_STATUS_LABELS: Record<ResellerStatus, string> = {
  ACTIVE: "Aktif",
  INACTIVE: "Nonaktif",
  SUSPENDED: "Ditangguhkan",
  TERMINATED: "Diakhiri",
};

export const PKS_STATUS_LABELS: Record<PksStatus, string> = {
  NONE: "Belum ada PKS",
  PENDING: "PKS belum berlaku",
  ACTIVE: "PKS aktif",
  EXPIRING: "PKS segera berakhir",
  EXPIRED: "PKS kedaluwarsa",
};

/**
 * True bila perubahan ke `status` wajib beralasan; aturan yang sama dengan
 * server (menuju SUSPENDED/TERMINATED, atau keluar dari TERMINATED).
 */
export function isReasonRequired(
  status: ResellerStatus,
  savedStatus: ResellerStatus | null = null,
): boolean {
  return requiresStatusReason(
    status,
    savedStatus !== null && savedStatus !== status ? savedStatus : null,
  );
}

export type ResellerOutlet = {
  readonly id: string;
  readonly resellerId: string;
  readonly code: string;
  readonly name: string;
  readonly phone: string | null;
  readonly address: string | null;
  readonly status: OutletStatus;
};

export type ResellerCommission = {
  readonly id: string;
  readonly invoiceId: string;
  readonly pelangganId: string;
  readonly commissionAmount: number;
  readonly status: "ACCRUED" | "SETTLED" | "PAID";
  readonly period: string;
  readonly accruedAt: string;
};

export type ResellerForm = {
  readonly code: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly address: string;
  readonly notes: string;
  readonly status: ResellerStatus;
  readonly statusReason: string;
  readonly legalName: string;
  readonly nib: string;
  readonly kbliCode: string;
  readonly standardCertificateNumber: string;
  readonly brandName: string;
  readonly licenseVerified: boolean;
};

export type OutletForm = {
  readonly code: string;
  readonly name: string;
  readonly phone: string;
  readonly address: string;
  readonly status: OutletStatus;
};

export const emptyResellerForm: ResellerForm = {
  code: "",
  name: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
  status: "ACTIVE",
  statusReason: "",
  legalName: "",
  nib: "",
  kbliCode: "",
  standardCertificateNumber: "",
  brandName: "",
  licenseVerified: false,
};

/** Isi form edit dari data reseller tersimpan. */
export function toResellerForm(reseller: Reseller): ResellerForm {
  return {
    code: reseller.code,
    name: reseller.name,
    email: reseller.email ?? "",
    phone: reseller.phone ?? "",
    address: reseller.address ?? "",
    notes: reseller.notes ?? "",
    status: reseller.status,
    statusReason: reseller.statusReason ?? "",
    legalName: reseller.legalName ?? "",
    nib: reseller.nib ?? "",
    kbliCode: reseller.kbliCode ?? "",
    standardCertificateNumber: reseller.standardCertificateNumber ?? "",
    brandName: reseller.brandName ?? "",
    licenseVerified: Boolean(reseller.licenseVerifiedAt),
  };
}

export const emptyOutletForm: OutletForm = {
  code: "",
  name: "",
  phone: "",
  address: "",
  status: "ACTIVE",
};
