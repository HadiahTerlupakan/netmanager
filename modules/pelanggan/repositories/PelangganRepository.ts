import { Prisma } from "@prisma/client";
import type {
  Status,
  TipePelanggan,
  DiscountType,
  DurasiUnit,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { IPelangganRepository } from "../domain/ports/IPelangganRepository";
import { pelangganWithPackageInclude } from "./pelanggan-repository.constants";
import {
  findByIdentifierForAuth as findCustomerByIdentifierForAuth,
  findUpgradePackageOptions as findCustomerUpgradePackageOptions,
  getPasswordHash as getCustomerPasswordHash,
  updateProfile as updateCustomerProfile,
  updateSyncStatus as updateCustomerSyncStatus,
} from "./pelanggan-repository-account.helpers";
import {
  checkHargaPaketExists as checkHargaPaketExistsRecord,
  createPelanggan as createPelangganRecord,
  deletePelanggan as deletePelangganRecord,
  findAllPaginatedPelanggan as findAllPaginatedPelangganRecords,
  findAllPelanggan as findAllPelangganRecords,
  findCustomerBillingAccess as findCustomerBillingAccessRecord,
  findPelangganById as findPelangganByIdRecord,
  findPelangganByIdPelanggan as findPelangganByIdPelangganRecord,
  findPelangganByIdWithHargaPaket as findPelangganByIdWithHargaPaketRecord,
  findPelangganByIdWithPackage as findPelangganByIdWithPackageRecord,
  findPelangganByUsername as findPelangganByUsernameRecord,
  updatePelanggan as updatePelangganRecord,
} from "./pelanggan-repository.prisma.helpers";
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
    return findCustomerBillingAccessRecord(input);
  }

  /** Get all customers using optional filters. */
  async findAll(filter?: FilterOptions) {
    return findAllPelangganRecords(filter);
  }

  /** Get paginated customers using optional filters. */
  async findAllPaginated(
    filter?: FilterOptions,
    page: number = 1,
    limit: number = 10,
  ) {
    return findAllPaginatedPelangganRecords(filter, page, limit);
  }

  /** Get customer by internal id. */
  async findById(id: string) {
    return findPelangganByIdRecord(id);
  }

  /** Get customer by customer code. */
  async findByIdPelanggan(idPelanggan: string) {
    return findPelangganByIdPelangganRecord(idPelanggan);
  }

  /** Get customer by username. */
  async findByUsername(username: string) {
    return findPelangganByUsernameRecord(username);
  }

  /** Create customer and return package relation when available. */
  async create(data: CreatePelangganDTO) {
    return createPelangganRecord(data);
  }

  /** Update customer by id. */
  async update(id: string, data: Partial<CreatePelangganDTO>) {
    return updatePelangganRecord(id, data);
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
    return deletePelangganRecord(id);
  }

  /** Check package existence. */
  async checkHargaPaketExists(id: string): Promise<boolean> {
    return checkHargaPaketExistsRecord(id);
  }

  /** Get pelanggan with package details for customer portal. */
  async findByIdWithPackage(id: string) {
    return findPelangganByIdWithPackageRecord(id);
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
    return findPelangganByIdWithHargaPaketRecord(id);
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

  /** Batalkan perubahan paket yang dijadwalkan. */
  async cancelPendingPackage(id: string, tenantId?: string | null) {
    const existing = await prisma.pelanggan.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      select: { id: true, pendingPackageId: true },
    });

    if (!existing) {
      return { id, found: false, hasPendingPackage: false };
    }

    const hasPendingPackage = existing.pendingPackageId !== null;

    if (hasPendingPackage) {
      await prisma.pelanggan.update({
        where: { id },
        data: { pendingPackageId: null, pendingPackageApplyAt: null },
      });
    }

    return { id, found: true, hasPendingPackage };
  }
}
