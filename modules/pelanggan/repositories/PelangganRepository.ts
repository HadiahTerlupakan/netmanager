import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type {
  Status,
  TipePelanggan,
  DiscountType,
  DurasiUnit,
} from "@prisma/client";

import type { IPelangganRepository } from "../domain/ports/IPelangganRepository";
import {
  findByIdentifierForAuth as findCustomerByIdentifierForAuth,
  findUpgradePackageOptions as findCustomerUpgradePackageOptions,
  getPasswordHash as getCustomerPasswordHash,
  updateProfile as updateCustomerProfile,
  updateSyncStatus as updateCustomerSyncStatus,
} from "./pelanggan-repository-account.helpers";
import { PelangganMapper } from "../mappers/PelangganMapper";
import { pelangganWithPackageInclude } from "./pelanggan-repository.constants";
import {
  buildCreatePelangganArgs,
  buildPelangganWhereClause,
} from "./pelanggan-repository.helpers";
import {
  findAdminMutationContext as findAdminPppMutationContext,
  findAdminPppDetail as findAdminPppDetailRecord,
  findForAdminDelete as findAdminDeleteRecord,
  findForAdminMutation as findAdminMutationRecord,
  updateAdminPppById as updateAdminPppRecordById,
} from "./pelanggan-repository-admin-ppp.helpers";
import { findEligibleForBilling as findEligibleBillingCustomers } from "./pelanggan-repository-automation.helpers";
import {
  getInvoices as getBillingInvoices,
  getInvoicesByIds as getBillingInvoicesByIds,
  getPaymentHistory as getBillingPaymentHistory,
} from "./pelanggan-repository-billing.helpers";
import {
  clearPushTokens as clearCustomerPushTokens,
  findByIdWithPushToken as findCustomerByIdWithPushToken,
  findManyWithPushToken as findCustomersWithPushToken,
} from "./pelanggan-repository-push-token.helpers";

export interface CreatePelangganDTO {
  idPelanggan: string;
  nama: string;
  username: string;
  password: string;
  passwordHash: string;
  hargaPaketId: string;
  tipe: TipePelanggan;
  tanggalAktif: Date;
  jatuhTempo: Date;
  status: Status;
  autoIsolir?: boolean;
  alamat?: string | null;
  provinsi?: string | null;
  kabupatenKota?: string | null;
  kelurahanDesa?: string | null;
  kecamatan?: string | null;
  noTelp?: string | null;
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  jenisDokumen?: string | null;
  noDokumen?: string | null;
  fileKTP?: string | null;
  fileRumahSekitar?: string | null;
  fileBAST?: string | null;
  catatan?: string | null;
  usePPN?: boolean;
  useDiscount?: boolean;
  useProrate?: boolean;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  discountDuration?: number | null;
  discountDurationUnit?: DurasiUnit | null;
  biayaInstalasi?: number | null;
  biayaInstalasiIsRecurring?: boolean;
  biayaInstalasiDiskon?: number | null;
  biayaSewaPerangkat?: number | null;
  biayaSewaPerangkatIsRecurring?: boolean;
  biayaSewaPerangkatDiskon?: number | null;
  biayaLainnya?: number | null;
  biayaLainnyaIsRecurring?: boolean;
  biayaLainnyaDiskon?: number | null;
  keteranganBiayaLainnya?: string | null;
  odpId?: string | null;
  siteId?: string | null;
}

const _pelangganWithPackage = Prisma.validator<Prisma.PelangganDefaultArgs>()({
  include: pelangganWithPackageInclude,
});

export type PelangganWithPackage = Prisma.PelangganGetPayload<
  typeof _pelangganWithPackage
>;

export interface FilterOptions {
  status?: Status;
  siteId?: string | Prisma.StringNullableFilter;
  search?: string;
}

/**
 * Concrete pelanggan repository backed by Prisma.
 */
export class PelangganRepository implements IPelangganRepository {
  /** Find customer access metadata for legacy billing route. */
  async findCustomerBillingAccess(input: {
    pelangganId: string;
    tenantId?: string | null;
  }): Promise<{ id: string; siteId: string | null } | null> {
    return prisma.pelanggan.findFirst({
      where: {
        id: input.pelangganId,
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      },
      select: { id: true, siteId: true },
    });
  }

  /** Get all customers using optional filters. */
  async findAll(filter?: FilterOptions) {
    const where = buildPelangganWhereClause(filter);
    const pelanggan = await prisma.pelanggan.findMany({
      where,
      include: pelangganWithPackageInclude,
      orderBy: {
        createdAt: "desc",
      },
    });

    return pelanggan.map((item) => PelangganMapper.toDomainWithPackage(item));
  }

  /** Get paginated customers using optional filters. */
  async findAllPaginated(
    filter?: FilterOptions,
    page: number = 1,
    limit: number = 10,
  ) {
    const where = buildPelangganWhereClause(filter);
    const [data, total] = await Promise.all([
      prisma.pelanggan.findMany({
        where,
        include: pelangganWithPackageInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.pelanggan.count({ where }),
    ]);

    return {
      data: data.map((item) => PelangganMapper.toDomainWithPackage(item)),
      total,
    };
  }

  /** Get customer by internal id. */
  async findById(id: string) {
    const pelanggan = await prisma.pelanggan.findUnique({ where: { id } });
    return pelanggan ? PelangganMapper.toDomain(pelanggan) : null;
  }

  /** Get customer by customer code. */
  async findByIdPelanggan(idPelanggan: string) {
    const pelanggan = await prisma.pelanggan.findFirst({
      where: { idPelanggan },
    });
    return pelanggan ? PelangganMapper.toDomain(pelanggan) : null;
  }

  /** Get customer by username. */
  async findByUsername(username: string) {
    const pelanggan = await prisma.pelanggan.findFirst({ where: { username } });
    return pelanggan ? PelangganMapper.toDomain(pelanggan) : null;
  }

  /** Create customer and return package relation when available. */
  async create(data: CreatePelangganDTO) {
    const pelanggan = await prisma.pelanggan.create(
      buildCreatePelangganArgs(data),
    );
    return PelangganMapper.toDomainWithPackage(pelanggan);
  }

  /** Update customer by id. */
  async update(id: string, data: Partial<CreatePelangganDTO>) {
    const pelanggan = await prisma.pelanggan.update({
      where: { id },
      data,
    });

    return PelangganMapper.toDomain(pelanggan);
  }

  /** Get customer data needed for admin PPP mutation flow. */
  async findForAdminMutation(id: string, tenantId?: string | null) {
    return findAdminMutationRecord(id, tenantId);
  }

  /** Update customer PPP fields from admin mutation flow. */
  async updateAdminPppById(
    id: string,
    data: Prisma.PelangganUncheckedUpdateInput,
  ) {
    return updateAdminPppRecordById(id, data);
  }

  /** Get customer data needed for admin delete flow. */
  async findForAdminDelete(id: string, tenantId?: string | null) {
    return findAdminDeleteRecord(id, tenantId);
  }

  /** Get customer detail with package and ODP for admin query flow. */
  async findAdminPppDetail(id: string, tenantId?: string | null) {
    return findAdminPppDetailRecord(id, tenantId);
  }

  /** Get minimal customer context for admin PPP mutation. */
  async findAdminMutationContext(id: string, tenantId?: string | null) {
    return findAdminPppMutationContext(id, tenantId);
  }

  /** Delete customer by id. */
  async delete(id: string) {
    const pelanggan = await prisma.pelanggan.delete({ where: { id } });
    return PelangganMapper.toDomain(pelanggan);
  }

  /** Check package existence. */
  async checkHargaPaketExists(id: string): Promise<boolean> {
    const hargaPaket = await prisma.hargaPaket.findUnique({ where: { id } });
    return hargaPaket !== null;
  }

  /** Get pelanggan with package details for customer portal. */
  async findByIdWithPackage(id: string) {
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id },
      include: {
        site: true,
        hargaPaket: {
          include: {
            bandwidth: true,
          },
        },
      },
    });

    return pelanggan ? PelangganMapper.toDomainWithPackage(pelanggan) : null;
  }

  /** Update customer profile preferences. */
  async updateProfile(
    id: string,
    data: {
      noTelp?: string;
      passwordHash?: string;
      is2FAEnabled?: boolean;
      isBillNotifEnabled?: boolean;
      isPromoEnabled?: boolean;
    },
  ) {
    return updateCustomerProfile(id, data);
  }

  /** Get password hash for verification. */
  async getPasswordHash(id: string): Promise<string | null> {
    return getCustomerPasswordHash(id);
  }

  /** Get payment history with pagination. */
  async getPaymentHistory(
    pelangganId: string,
    options: { page: number; limit: number },
  ) {
    return getBillingPaymentHistory(pelangganId, options);
  }

  /** Get invoices with pagination. */
  async getInvoices(
    pelangganId: string,
    options: { page: number; limit: number; status?: string[] },
  ) {
    return getBillingInvoices(pelangganId, options);
  }

  /** Get invoices by IDs for payment validation. */
  async getInvoicesByIds(
    ids: string[],
    pelangganId: string,
    validStatuses: string[],
  ) {
    return getBillingInvoicesByIds(ids, pelangganId, validStatuses);
  }

  /** Update sync status after RADIUS operation. */
  async updateSyncStatus(id: string, status: string, error?: string | null) {
    return updateCustomerSyncStatus(id, status, error);
  }

  /** Get auth payload by identifier. */
  async findByIdentifierForAuth(identifier: string) {
    return findCustomerByIdentifierForAuth(identifier);
  }

  /** Get customer with package relation. */
  async findByIdWithHargaPaket(id: string) {
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id },
      include: { hargaPaket: true },
    });

    return pelanggan ? PelangganMapper.toDomainWithPackage(pelanggan) : null;
  }

  /** Get upgrade package options above current package price. */
  async findUpgradePackageOptions(currentPrice: number, limit: number = 5) {
    return findCustomerUpgradePackageOptions(currentPrice, limit);
  }

  /** Get customers eligible for automatic billing. */
  async findEligibleForBilling(
    targetDay: number,
    batchSize: number,
    offset: number,
  ) {
    return findEligibleBillingCustomers({ targetDay, batchSize, offset });
  }

  /** Get customer push token by id. */
  async findByIdWithPushToken(pelangganId: string) {
    return findCustomerByIdWithPushToken(pelangganId);
  }

  /** Get customers by push token list. */
  async findManyWithPushToken(tokens: string[]) {
    return findCustomersWithPushToken(tokens);
  }

  /** Clear customer push tokens. */
  async clearPushTokens(tokens: string[]) {
    return clearCustomerPushTokens(tokens);
  }
}
