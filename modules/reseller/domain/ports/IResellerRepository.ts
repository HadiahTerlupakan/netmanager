import type {
  ResellerEntity,
  ResellerOutletEntity,
  ResellerPackagePriceEntity,
  ResellerStatusValue,
} from "../entities/ResellerEntity";

export interface CreateResellerData {
  readonly tenantId: string | null;
  readonly code: string;
  readonly name: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly address?: string | null;
  readonly notes?: string | null;
}

export interface UpdateResellerData {
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
  /** Find reseller by code within tenant scope. */
  findByCode(
    tenantId: string | null,
    code: string,
  ): Promise<ResellerEntity | null>;
  /** Find reseller by id within tenant scope. */
  findById(tenantId: string | null, id: string): Promise<ResellerEntity | null>;
  /** List resellers within tenant scope. */
  findAll(params: {
    readonly tenantId: string | null;
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
  /** Find outlet by reseller code within tenant scope. */
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
  /** Find active reseller package override. */
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
  /** Create reseller package override. */
  upsertPackagePrice(
    data: UpsertPackagePriceData,
  ): Promise<ResellerPackagePriceEntity>;
}
