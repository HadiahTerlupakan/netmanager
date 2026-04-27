import { InvoiceStatus, Prisma as PrismaBilling } from "@prisma/client-billing";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { prismaBilling } from "@/lib/prisma-billing";
import { Prisma } from "@prisma/client";
import type {
  Status,
  TipePelanggan,
  DiscountType,
  DurasiUnit,
} from "@prisma/client";

import type { IPelangganRepository } from "../domain/ports/IPelangganRepository";
import { PelangganMapper } from "../mappers/PelangganMapper";

const ACTIVE_PACKAGE_STATUS = "AKTIF";

const adminMutationSelect = {
  id: true,
  username: true,
  password: true,
  passwordHash: true,
  hargaPaketId: true,
  tipe: true,
  status: true,
  autoIsolir: true,
  siteId: true,
} satisfies Prisma.PelangganSelect;

const adminDeleteSelect = {
  id: true,
  nama: true,
  username: true,
  siteId: true,
} satisfies Prisma.PelangganSelect;

const adminMutationContextSelect = {
  id: true,
  username: true,
  status: true,
  siteId: true,
  nama: true,
} satisfies Prisma.PelangganSelect;

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
  include: {
    site: true,
    hargaPaket: {
      include: {
        profilePPP: true,
        bandwidth: true,
      },
    },
  },
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
    const where = this.buildWhereClause(filter);
    const pelanggan = await prisma.pelanggan.findMany({
      where,
      include: {
        site: true,
        hargaPaket: {
          include: {
            profilePPP: true,
            bandwidth: true,
          },
        },
      },
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
    const where = this.buildWhereClause(filter);
    const [data, total] = await Promise.all([
      prisma.pelanggan.findMany({
        where,
        include: {
          site: true,
          hargaPaket: {
            include: {
              profilePPP: true,
              bandwidth: true,
            },
          },
        },
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

  /** Build pelanggan where clause. */
  private buildWhereClause(filter?: FilterOptions): Prisma.PelangganWhereInput {
    const where: Prisma.PelangganWhereInput = {};

    if (filter?.status) {
      where.status = filter.status;
    }

    if (filter?.siteId) {
      where.siteId = filter.siteId;
    }

    if (filter?.search) {
      where.OR = [
        { nama: { contains: filter.search, mode: "insensitive" } },
        { idPelanggan: { contains: filter.search, mode: "insensitive" } },
        { username: { contains: filter.search, mode: "insensitive" } },
      ];
    }

    return where;
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
    const pelanggan = await prisma.pelanggan.create({
      data: {
        id: randomUUID(),
        updatedAt: new Date(),
        idPelanggan: data.idPelanggan,
        nama: data.nama,
        username: data.username,
        password: data.password,
        passwordHash: data.passwordHash,
        hargaPaketId: data.hargaPaketId,
        tipe: data.tipe,
        tanggalAktif: data.tanggalAktif,
        jatuhTempo: data.jatuhTempo,
        status: data.status,
        autoIsolir: data.autoIsolir ?? true,
        alamat: data.alamat,
        provinsi: data.provinsi,
        kabupatenKota: data.kabupatenKota,
        kelurahanDesa: data.kelurahanDesa,
        kecamatan: data.kecamatan,
        noTelp: data.noTelp,
        email: data.email,
        latitude: data.latitude,
        longitude: data.longitude,
        jenisDokumen: data.jenisDokumen,
        noDokumen: data.noDokumen,
        fileKTP: data.fileKTP,
        fileRumahSekitar: data.fileRumahSekitar,
        fileBAST: data.fileBAST,
        catatan: data.catatan,
        usePPN: data.usePPN ?? true,
        useDiscount: data.useDiscount ?? false,
        useProrate: data.useProrate ?? false,
        discountType: data.discountType,
        discountValue: data.discountValue,
        discountDuration: data.discountDuration,
        discountDurationUnit: data.discountDurationUnit,
        biayaInstalasi: data.biayaInstalasi,
        biayaInstalasiIsRecurring: data.biayaInstalasiIsRecurring ?? false,
        biayaInstalasiDiskon: data.biayaInstalasiDiskon,
        biayaSewaPerangkat: data.biayaSewaPerangkat,
        biayaSewaPerangkatIsRecurring:
          data.biayaSewaPerangkatIsRecurring ?? true,
        biayaSewaPerangkatDiskon: data.biayaSewaPerangkatDiskon,
        biayaLainnya: data.biayaLainnya,
        biayaLainnyaIsRecurring: data.biayaLainnyaIsRecurring ?? false,
        biayaLainnyaDiskon: data.biayaLainnyaDiskon,
        keteranganBiayaLainnya: data.keteranganBiayaLainnya,
        odpId: data.odpId,
        siteId: data.siteId,
      },
      include: {
        site: true,
        hargaPaket: {
          include: {
            profilePPP: true,
            bandwidth: true,
          },
        },
      },
    });

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
    return prisma.pelanggan.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      select: adminMutationSelect,
    });
  }

  /** Update customer PPP fields from admin mutation flow. */
  async updateAdminPppById(
    id: string,
    data: Prisma.PelangganUncheckedUpdateInput,
  ) {
    const pelanggan = await prisma.pelanggan.update({
      where: { id },
      data,
    });

    return PelangganMapper.toDomain(pelanggan);
  }

  /** Get customer data needed for admin delete flow. */
  async findForAdminDelete(id: string, tenantId?: string | null) {
    return prisma.pelanggan.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      select: adminDeleteSelect,
    });
  }

  /** Get customer detail with package and ODP for admin query flow. */
  async findAdminPppDetail(id: string, tenantId?: string | null) {
    const pelanggan = await prisma.pelanggan.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      include: {
        hargaPaket: {
          include: {
            profilePPP: {
              include: {
                mikroTikRouter: true,
              },
            },
            bandwidth: true,
          },
        },
        odp: {
          select: {
            name: true,
            location: true,
          },
        },
      },
    });

    return pelanggan ? PelangganMapper.toDomainWithPackage(pelanggan) : null;
  }

  /** Get minimal customer context for admin PPP mutation. */
  async findAdminMutationContext(id: string, tenantId?: string | null) {
    return prisma.pelanggan.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      select: adminMutationContextSelect,
    });
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
    return prisma.pelanggan.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        noTelp: true,
        is2FAEnabled: true,
        isBillNotifEnabled: true,
        isPromoEnabled: true,
        updatedAt: true,
      },
    });
  }

  /** Get password hash for verification. */
  async getPasswordHash(id: string): Promise<string | null> {
    const customer = await prisma.pelanggan.findUnique({
      where: { id },
      select: { passwordHash: true },
    });

    return customer?.passwordHash || null;
  }

  /** Get payment history with pagination. */
  async getPaymentHistory(
    pelangganId: string,
    options: { page: number; limit: number },
  ) {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      prismaBilling.payment.findMany({
        where: { pelangganId },
        orderBy: { paymentDate: "desc" },
        skip,
        take: limit,
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              status: true,
            },
          },
        },
      }),
      prismaBilling.payment.count({ where: { pelangganId } }),
    ]);

    return { payments, total };
  }

  /** Get invoices with pagination. */
  async getInvoices(
    pelangganId: string,
    options: { page: number; limit: number; status?: string[] },
  ) {
    const { page, limit, status } = options;
    const skip = (page - 1) * limit;
    const where: PrismaBilling.InvoiceWhereInput = { pelangganId };

    if (status && status.length > 0) {
      where.status = { in: status as InvoiceStatus[] };
    }

    const [invoices, total] = await Promise.all([
      prismaBilling.invoice.findMany({
        where,
        orderBy: { dueDate: "desc" },
        skip,
        take: limit,
      }),
      prismaBilling.invoice.count({ where }),
    ]);

    return { invoices, total };
  }

  /** Get invoices by IDs for payment validation. */
  async getInvoicesByIds(
    ids: string[],
    pelangganId: string,
    validStatuses: string[],
  ) {
    return prismaBilling.invoice.findMany({
      where: {
        id: { in: ids },
        pelangganId,
        status: { in: validStatuses as InvoiceStatus[] },
      },
    });
  }

  /** Update sync status after RADIUS operation. */
  async updateSyncStatus(id: string, status: string, error?: string | null) {
    const data: Prisma.PelangganUpdateInput = {
      syncStatus: status,
      syncError: error,
      updatedAt: new Date(),
    };

    if (status === "FAILED") {
      data.syncRetryCount = { increment: 1 };
    } else if (status === "SYNCED") {
      data.syncRetryCount = 0;
      data.lastSyncedAt = new Date();
    }

    const pelanggan = await prisma.pelanggan.update({
      where: { id },
      data,
    });

    return PelangganMapper.toDomain(pelanggan);
  }

  /** Get auth payload by identifier. */
  async findByIdentifierForAuth(identifier: string) {
    return prisma.pelanggan.findFirst({
      where: {
        OR: [
          { idPelanggan: identifier.toUpperCase() },
          { email: identifier.toLowerCase() },
        ],
      },
      select: {
        id: true,
        idPelanggan: true,
        nama: true,
        username: true,
        email: true,
        status: true,
        passwordHash: true,
        tenantId: true,
      },
    });
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
    return prisma.hargaPaket.findMany({
      where: {
        status: ACTIVE_PACKAGE_STATUS as Status,
        harga: { gt: currentPrice },
      },
      include: {
        bandwidth: true,
      },
      orderBy: { harga: "asc" },
      take: limit,
    });
  }

  /** Get customers eligible for automatic billing. */
  async findEligibleForBilling(
    targetDay: number,
    batchSize: number,
    offset: number,
  ) {
    return prisma.$queryRaw<EligibleBillingCustomer[]>(
      Prisma.sql`
        SELECT
          p.id, p.nama, p."jatuhTempo", p."userId", p."usePPN", p."hargaPaketId", p.tipe, p.status,
          h.name AS "paketName", h.harga AS "paketHarga",
          h."usePPN" AS "paketUsePPN", h."ppnPercentage" AS "paketPpnPercentage"
        FROM "Pelanggan" p
        INNER JOIN "HargaPaket" h ON p."hargaPaketId" = h.id
        WHERE (p.status = 'AKTIF' OR (p.status = 'ISOLIR' AND p.tipe = 'REGULER'))
          AND p."hargaPaketId" != ''
          AND EXTRACT(DAY FROM p."jatuhTempo") = ${targetDay}
        ORDER BY p.id ASC
        LIMIT ${batchSize} OFFSET ${offset}
      `,
    );
  }

  /** Get customer push token by id. */
  async findByIdWithPushToken(pelangganId: string) {
    return prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      select: { id: true, pushToken: true },
    });
  }

  /** Get customers by push token list. */
  async findManyWithPushToken(tokens: string[]) {
    return prisma.pelanggan.findMany({
      where: { pushToken: { in: tokens } },
      select: { id: true, pushToken: true },
    });
  }

  /** Clear customer push tokens. */
  async clearPushTokens(tokens: string[]) {
    return prisma.pelanggan.updateMany({
      where: { pushToken: { in: tokens } },
      data: { pushToken: null },
    });
  }
}

interface EligibleBillingCustomer {
  id: string;
  nama: string;
  jatuhTempo: Date;
  userId: string | null;
  usePPN: boolean;
  tipe: string;
  status: string;
  hargaPaketId: string;
  paketName: string;
  paketHarga: number;
  paketUsePPN: boolean;
  paketPpnPercentage: number | null;
}
