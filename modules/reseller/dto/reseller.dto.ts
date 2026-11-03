import type { ResellerStatusValue } from "../domain/entities/ResellerEntity";
import type { ComplianceIssue, PksStatus } from "../domain/reseller-compliance";

export interface ResellerDTO {
  readonly id: string;
  readonly tenantId: string | null;
  readonly code: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly status: ResellerStatusValue;
  readonly notes: string | null;
  readonly legalName: string | null;
  readonly nib: string | null;
  readonly kbliCode: string | null;
  readonly standardCertificateNumber: string | null;
  readonly brandName: string | null;
  readonly licenseVerifiedAt: string | null;
  readonly licenseVerifiedById: string | null;
  readonly statusReason: string | null;
  readonly statusChangedAt: string | null;
  readonly statusChangedById: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ResellerPksDTO {
  readonly status: PksStatus;
  readonly documentId: string | null;
  /** Tanggal mulai PKS; berguna untuk status PENDING (belum berlaku). */
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly daysLeft: number | null;
}

export interface ResellerComplianceDTO {
  readonly isCompliant: boolean;
  readonly issues: readonly ComplianceIssue[];
  /** Label Indonesia untuk tiap `issues`, urutannya sama. */
  readonly issueLabels: readonly string[];
  readonly pks: ResellerPksDTO;
}

/** Reseller beserta ringkasan kepatuhan (izin + PKS) untuk halaman admin. */
export interface ResellerWithComplianceDTO extends ResellerDTO {
  readonly compliance: ResellerComplianceDTO;
}

/** Pengaturan tata kelola reseller tenant; semua default mati. */
export interface ResellerComplianceSettingDTO {
  readonly isComplianceRequired: boolean;
  /** Pembayar settlement wajib berbeda dari penyetujunya. */
  readonly isSettlementSeparateApproverRequired: boolean;
}

export interface ResellerOutletDTO {
  readonly id: string;
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly code: string;
  readonly name: string;
  readonly phone: string | null;
  readonly address: string | null;
  readonly status: ResellerStatusValue;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** @deprecated Harga khusus reseller tidak dipakai di model agen. */
export interface ResellerPackagePriceDTO {
  readonly id: string;
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly hargaPaketId: string;
  readonly price: number;
  readonly status: ResellerStatusValue;
  readonly startsAt: string;
  readonly endsAt: string | null;
}

export interface ResolvedPackagePriceDTO {
  readonly price: number;
  readonly source: "BASE_PACKAGE" | "RESELLER_OVERRIDE";
  readonly priceId: string | null;
}

/** Satu baris riwayat status kemitraan untuk admin. */
export interface ResellerStatusHistoryDTO {
  readonly id: string;
  readonly fromStatus: ResellerStatusValue | null;
  readonly toStatus: ResellerStatusValue;
  readonly reason: string | null;
  readonly changedById: string | null;
  readonly changedAt: string;
}
