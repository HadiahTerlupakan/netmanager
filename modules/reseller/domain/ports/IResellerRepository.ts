import type {
  ResellerEntity,
  ResellerOutletEntity,
  ResellerPackagePriceEntity,
  ResellerStatusValue,
} from "../entities/ResellerEntity";

/** Data izin dan merek reseller (PM 5/2021 Ps 223(2)a). */
export interface ResellerLicenseData {
  readonly legalName?: string | null;
  readonly nib?: string | null;
  readonly kbliCode?: string | null;
  readonly standardCertificateNumber?: string | null;
  readonly brandName?: string | null;
  readonly licenseVerifiedAt?: Date | null;
  readonly licenseVerifiedById?: string | null;
}

/** Jejak perubahan status kemitraan. */
export interface ResellerStatusAuditData {
  readonly statusReason?: string | null;
  readonly statusChangedAt?: Date | null;
  readonly statusChangedById?: string | null;
}

export interface CreateResellerData
  extends ResellerLicenseData, ResellerStatusAuditData {
  readonly tenantId: string | null;
  readonly code: string;
  readonly name: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly address?: string | null;
  readonly notes?: string | null;
  readonly status?: ResellerStatusValue;
}

export interface UpdateResellerData
  extends ResellerLicenseData, ResellerStatusAuditData {
  readonly code?: string;
  readonly name?: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly address?: string | null;
  readonly status?: ResellerStatusValue;
  readonly notes?: string | null;
}

export interface CreateOutletData {
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly code: string;
  readonly name: string;
  readonly phone?: string | null;
  readonly address?: string | null;
  readonly status?: ResellerStatusValue;
}

export interface UpdateOutletData {
  readonly code?: string;
  readonly name?: string;
  readonly phone?: string | null;
  readonly address?: string | null;
  readonly status?: ResellerStatusValue;
}

export interface UpsertPackagePriceData {
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly hargaPaketId: string;
  readonly price: number;
  readonly startsAt?: Date;
  readonly endsAt?: Date | null;
}

export interface IResellerRepository {
  /**
   * Find reseller by code within tenant scope, INCLUDING soft-deleted rows.
   * Unique index `[tenantId, code]` also covers deleted rows, so a code held
   * by a deleted reseller still cannot be reused.
   */
  findByCode(
    tenantId: string | null,
    code: string,
  ): Promise<ResellerEntity | null>;
  /** Find reseller by id within tenant scope. */
  findById(tenantId: string | null, id: string): Promise<ResellerEntity | null>;
  /** List resellers within tenant scope. */
  findAll(params: {
    readonly tenantId: string | null;
    /** Kata kunci nama, kode, atau telepon. */
    readonly search?: string;
    readonly status?: ResellerStatusValue;
    readonly skip?: number;
    readonly take?: number;
  }): Promise<{
    readonly items: readonly ResellerEntity[];
    readonly total: number;
  }>;
  /** Create reseller. */
  create(data: CreateResellerData): Promise<ResellerEntity>;
  /** Update reseller. */
  update(
    tenantId: string | null,
    id: string,
    data: UpdateResellerData,
  ): Promise<ResellerEntity>;
  /** Soft delete reseller. */
  softDelete(tenantId: string | null, id: string): Promise<void>;
  /** Find outlet by id within tenant scope. */
  findOutletById(
    tenantId: string | null,
    id: string,
  ): Promise<ResellerOutletEntity | null>;
  /**
   * Find outlet by reseller code within tenant scope, INCLUDING soft-deleted
   * rows (unique index `[tenantId, resellerId, code]` covers them too).
   */
  findOutletByCode(
    tenantId: string | null,
    resellerId: string,
    code: string,
  ): Promise<ResellerOutletEntity | null>;
  /** List outlets for reseller. */
  findOutletsByResellerId(
    tenantId: string | null,
    resellerId: string,
  ): Promise<readonly ResellerOutletEntity[]>;
  /** Create outlet. */
  createOutlet(data: CreateOutletData): Promise<ResellerOutletEntity>;
  /** Update outlet. */
  updateOutlet(
    tenantId: string | null,
    id: string,
    data: UpdateOutletData,
  ): Promise<ResellerOutletEntity>;
  /** Soft delete outlet. */
  softDeleteOutlet(tenantId: string | null, id: string): Promise<void>;
  /**
   * Find active reseller package override.
   * @deprecated Harga khusus reseller tidak dipakai di model agen.
   */
  findActivePackagePrice(params: {
    readonly tenantId: string | null;
    readonly resellerId: string;
    readonly hargaPaketId: string;
    readonly at: Date;
  }): Promise<ResellerPackagePriceEntity | null>;
  /** Find base package price by package id. */
  findBasePackagePrice(
    tenantId: string | null,
    hargaPaketId: string,
  ): Promise<number | null>;
  /**
   * List package prices for reseller.
   * @deprecated Harga khusus reseller tidak dipakai di model agen.
   */
  findPackagePricesByResellerId(
    tenantId: string | null,
    resellerId: string,
  ): Promise<readonly ResellerPackagePriceEntity[]>;
  /**
   * Create reseller package override.
   * @deprecated Harga khusus reseller tidak dipakai di model agen.
   */
  upsertPackagePrice(
    data: UpsertPackagePriceData,
  ): Promise<ResellerPackagePriceEntity>;
}
