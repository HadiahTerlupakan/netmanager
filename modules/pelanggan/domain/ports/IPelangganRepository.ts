/**
 * Abstraction for pelanggan repository operations.
 */

import type {
  PelangganAdminDeleteEntity,
  PelangganAdminMutationContextEntity,
  PelangganAdminMutationEntity,
  PelangganAuthEntity,
  EligibleBillingCustomerEntity,
  PelangganDiscountType,
  PelangganDurationUnit,
  PelangganEntity,
  PelangganProfilePreferenceEntity,
  PelangganPushTokenEntity,
  PelangganWithPackageEntity,
} from "../entities/PelangganEntity";

export interface CreatePelangganDTO {
  idPelanggan: string;
  nama: string;
  username: string;
  password: string;
  passwordHash: string;
  hargaPaketId: string;
  resellerId?: string | null;
  resellerOutletId?: string | null;
  tipe: string;
  tanggalAktif: Date;
  jatuhTempo: Date;
  status: string;
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
  discountType?: PelangganDiscountType | null;
  discountValue?: number | null;
  discountDuration?: number | null;
  discountDurationUnit?: PelangganDurationUnit | null;
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

export type FilterOptions = {
  status?: unknown;
  siteId?: string | Record<string, unknown>;
  search?: string;
};

export type PelangganWithPackage = PelangganWithPackageEntity;

type PelangganAdminPppUpdateInput = Record<string, unknown>;

type PaymentHistoryRecord = {
  id: string;
  amount: number | bigint | { toNumber(): number };
  paymentDate: Date;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
  verifiedAt: Date | null;
  invoice: { invoiceNumber: string; status: string } | null;
};

type UpgradePackageOption = {
  id: string;
  name: string;
  harga: number;
  bandwidth: {
    name: string;
    maxLimitDownload: string | null;
    maxLimitUpload: string | null;
  } | null;
};
export interface IPelangganRepository {
  /** Get all customers using optional filters. */
  findAll(filter?: FilterOptions): Promise<PelangganWithPackageEntity[]>;

  /** Get paginated customers using optional filters. */
  findAllPaginated(
    filter?: FilterOptions,
    page?: number,
    limit?: number,
  ): Promise<{ data: PelangganWithPackageEntity[]; total: number }>;

  /** Get customer by internal id. */
  findById(id: string): Promise<PelangganEntity | null>;

  /** Get customer by customer code. */
  findByIdPelanggan(idPelanggan: string): Promise<PelangganEntity | null>;

  /** Get customer by username. */
  findByUsername(username: string): Promise<PelangganEntity | null>;

  /** Create customer and return package relation when available. */
  create(data: CreatePelangganDTO): Promise<PelangganWithPackageEntity>;

  /** Update customer by id. */
  update(
    id: string,
    data: Partial<CreatePelangganDTO>,
  ): Promise<PelangganEntity>;

  /** Get admin mutation payload. */
  findForAdminMutation(
    id: string,
    tenantId?: string | null,
  ): Promise<PelangganAdminMutationEntity | null>;

  /** Update PPP fields for admin mutation flow. */
  updateAdminPppById(
    id: string,
    data: PelangganAdminPppUpdateInput,
  ): Promise<PelangganEntity>;

  /** Get admin delete payload. */
  findForAdminDelete(
    id: string,
    tenantId?: string | null,
  ): Promise<PelangganAdminDeleteEntity | null>;

  /** Get admin PPP detail with package and ODP. */
  findAdminPppDetail(
    id: string,
    tenantId?: string | null,
  ): Promise<PelangganWithPackageEntity | null>;

  /** Get minimal admin mutation context. */
  findAdminMutationContext(
    id: string,
    tenantId?: string | null,
  ): Promise<PelangganAdminMutationContextEntity | null>;

  /** Delete customer by id. */
  delete(id: string): Promise<PelangganEntity>;

  /** Check package existence. */
  checkHargaPaketExists(id: string): Promise<boolean>;

  /** Get customer profile with package for portal. */
  findByIdWithPackage(id: string): Promise<PelangganWithPackageEntity | null>;

  /** Update customer profile preferences. */
  updateProfile(
    id: string,
    data: {
      noTelp?: string;
      passwordHash?: string;
      is2FAEnabled?: boolean;
      isBillNotifEnabled?: boolean;
      isPromoEnabled?: boolean;
    },
  ): Promise<PelangganProfilePreferenceEntity>;

  /** Get password hash for verification. */
  getPasswordHash(id: string): Promise<string | null>;

  /** Get payment history for portal. */
  getPaymentHistory(
    pelangganId: string,
    options: { page: number; limit: number },
  ): Promise<{ payments: PaymentHistoryRecord[]; total: number }>;

  /** Get invoice list for portal. */
  getInvoices(
    pelangganId: string,
    options: { page: number; limit: number; status?: string[] },
  ): Promise<{ invoices: unknown[]; total: number }>;

  /** Get invoices for payment validation. */
  getInvoicesByIds(
    ids: string[],
    pelangganId: string,
    validStatuses: string[],
  ): Promise<
    Array<
      { totalAmount: unknown; paidAmount: unknown } & Record<string, unknown>
    >
  >;

  /** Update sync status after RADIUS operation. */
  updateSyncStatus(
    id: string,
    status: string,
    error?: string | null,
  ): Promise<PelangganEntity>;

  /** Get customer auth payload by customer code or email. */
  findByIdentifierForAuth(
    identifier: string,
  ): Promise<PelangganAuthEntity | null>;

  /** Get customer with package relation. */
  findByIdWithHargaPaket(
    id: string,
  ): Promise<PelangganWithPackageEntity | null>;

  /** Get upgrade package options. */
  findUpgradePackageOptions(
    currentPrice: number,
    limit?: number,
  ): Promise<UpgradePackageOption[]>;

  /** Get customers eligible for billing. */
  findEligibleForBilling(
    targetDay: number,
    batchSize: number,
    offset: number,
  ): Promise<EligibleBillingCustomerEntity[]>;

  /** Get customer push token by id. */
  findByIdWithPushToken(
    pelangganId: string,
  ): Promise<PelangganPushTokenEntity | null>;

  /** Get customers by push token list. */
  findManyWithPushToken(tokens: string[]): Promise<PelangganPushTokenEntity[]>;

  /** Clear push tokens. */
  clearPushTokens(tokens: string[]): Promise<unknown>;

  /** Batalkan perubahan paket yang dijadwalkan (hapus pendingPackageId + pendingPackageApplyAt). */
  cancelPendingPackage(
    id: string,
    tenantId?: string | null,
  ): Promise<{ id: string; found: boolean; hasPendingPackage: boolean }>;
}
