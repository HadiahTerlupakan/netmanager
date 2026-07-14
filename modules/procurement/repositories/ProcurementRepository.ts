import { prisma } from "@/lib/prisma";
import {
  PurchaseOrderStatus,
  PurchaseRequestStatus,
  Prisma,
} from "@prisma/client";

import type { PurchaseOrderEntity } from "../domain/entities/PurchaseOrder";
import type {
  PurchaseRequestEntity,
  PurchaseRequestSummaryEntity,
} from "../domain/entities/PurchaseRequest";
import type {
  CreatePurchaseOrderInput,
  IProcurementRepository,
  PurchaseRequestListFilter,
  PurchaseRequestListResult,
} from "../domain/ports/IProcurementRepository";
import {
  toPurchaseOrderDomain,
  toPurchaseRequestDomain,
} from "../mappers/ProcurementMapper";

const APPROVED_STATUS = "APPROVED";
const ORDERED_STATUS = "ORDERED";
const PO_NUMBER_PADDING = 4;
const PO_NUMBER_DEFAULT_SEQUENCE = "0001";
const PO_NUMBER_MONTH_OFFSET = 1;
const PO_NUMBER_PAD_CHARACTER = "0";
const PO_NUMBER_SEPARATOR = "/";

export class ProcurementRepository implements IProcurementRepository {
  /** Mengambil purchase request APPROVED yang belum terkait purchase order. */
  async findApprovedPRs(prIds: string[]): Promise<PurchaseRequestEntity[]> {
    const records = await prisma.purchaseRequest.findMany({
      where: {
        id: { in: prIds },
        status: APPROVED_STATUS,
        purchaseOrderId: null,
      },
      include: {
        items: {
          include: {
            barang: { select: { id: true, nama: true, supplierId: true } },
          },
        },
        jasaItems: {
          include: {
            jasa: {
              select: {
                id: true,
                kode: true,
                nama: true,
                satuan: true,
                supplierId: true,
              },
            },
          },
        },
      },
    });

    return records.map(toPurchaseRequestDomain);
  }

  /** Mengambil purchase order terakhir berdasarkan prefix nomor. */
  async findLastPOByNumberPrefix(
    prefix: string,
    tenantId?: string | null,
  ): Promise<PurchaseOrderEntity | null> {
    const record = await prisma.purchaseOrder.findFirst({
      where: { tenantId, poNumber: { startsWith: prefix } },
      orderBy: { poNumber: "desc" },
    });

    return record ? toPurchaseOrderDomain(record) : null;
  }

  /** Membuat purchase order dan menandai purchase request sebagai ordered. */
  async createPOWithItems(
    input: CreatePurchaseOrderInput,
  ): Promise<PurchaseOrderEntity> {
    const createdOrder = await prisma.$transaction(async (transaction) => {
      const purchaseOrder = await transaction.purchaseOrder.create({
        data: buildPurchaseOrderCreateData(input),
        include: { items: true, jasaItems: true },
      });

      await transaction.purchaseRequest.updateMany({
        where: { id: { in: input.prIds } },
        data: { status: ORDERED_STATUS },
      });

      return purchaseOrder;
    });

    return toPurchaseOrderDomain(createdOrder);
  }

  /** Membuat nomor purchase order baru berdasarkan tenant dan periode bulan. */
  async generatePONumber(tenantId?: string | null): Promise<string> {
    const prefix = createPONumberPrefix(new Date());
    const lastPurchaseOrder = await this.findLastPOByNumberPrefix(
      prefix,
      tenantId,
    );
    const nextSequence = getNextPONumberSequence(lastPurchaseOrder?.poNumber);

    return `${prefix}${PO_NUMBER_SEPARATOR}${nextSequence}`;
  }

  /** Listing ringkas purchase request — read-only untuk view procurement. */
  async listPurchaseRequests(
    filter: PurchaseRequestListFilter,
  ): Promise<PurchaseRequestListResult> {
    const where = buildPurchaseRequestListWhere(filter);
    const [records, total] = await Promise.all([
      prisma.purchaseRequest.findMany({
        where,
        include: {
          items: { select: { jumlah: true, totalHarga: true } },
          requester: { select: { name: true } },
          gudang: { select: { nama: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      prisma.purchaseRequest.count({ where }),
    ]);

    return {
      data: records.map(toPurchaseRequestSummary),
      total,
      page: filter.page,
      limit: filter.limit,
    };
  }
}

function buildPurchaseRequestListWhere(
  filter: PurchaseRequestListFilter,
): Prisma.PurchaseRequestWhereInput {
  const where: Prisma.PurchaseRequestWhereInput = { tenantId: filter.tenantId };
  if (filter.status) {
    where.status = filter.status as PurchaseRequestStatus;
  }
  if (filter.search) {
    where.nomorRequest = { contains: filter.search, mode: "insensitive" };
  }
  return where;
}

function toPurchaseRequestSummary(record: {
  id: string;
  nomorRequest: string;
  status: string;
  prioritas: string;
  tanggal: Date;
  approvedAt: Date | null;
  purchaseOrderId: string | null;
  tenantId: string | null;
  items: { jumlah: number; totalHarga: number }[];
  requester: { name: string | null } | null;
  gudang: { nama: string | null } | null;
}): PurchaseRequestSummaryEntity {
  return {
    id: record.id,
    nomorRequest: record.nomorRequest,
    status: record.status,
    prioritas: record.prioritas,
    tanggal: record.tanggal,
    approvedAt: record.approvedAt,
    purchaseOrderId: record.purchaseOrderId,
    tenantId: record.tenantId,
    requesterName: record.requester?.name ?? null,
    gudangNama: record.gudang?.nama ?? null,
    totalItems: record.items.reduce((sum, item) => sum + item.jumlah, 0),
    totalNilai: record.items.reduce((sum, item) => sum + item.totalHarga, 0),
  };
}

function buildPurchaseOrderCreateData(input: CreatePurchaseOrderInput) {
  return {
    id: input.id,
    poNumber: input.poNumber,
    supplierId: input.supplierId,
    status: PurchaseOrderStatus.DRAFT,
    createdBy: input.createdBy,
    tenantId: input.tenantId,
    totalAmount: input.totalAmount,
    items: { create: input.items },
    jasaItems: {
      create: input.jasaItems ?? [],
    },
    purchaseRequests: {
      connect: input.prIds.map((id) => ({ id })),
    },
  };
}

function createPONumberPrefix(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + PO_NUMBER_MONTH_OFFSET).padStart(
    2,
    PO_NUMBER_PAD_CHARACTER,
  );

  return `PO${PO_NUMBER_SEPARATOR}${year}${PO_NUMBER_SEPARATOR}${month}`;
}

function getNextPONumberSequence(poNumber?: string): string {
  if (!poNumber) {
    return PO_NUMBER_DEFAULT_SEQUENCE;
  }

  const lastSequence = extractPONumberSequence(poNumber);
  return String(lastSequence + 1).padStart(
    PO_NUMBER_PADDING,
    PO_NUMBER_PAD_CHARACTER,
  );
}

function extractPONumberSequence(poNumber: string): number {
  const segments = poNumber.split(PO_NUMBER_SEPARATOR);
  return Number.parseInt(segments.at(-1) ?? "0", 10);
}
