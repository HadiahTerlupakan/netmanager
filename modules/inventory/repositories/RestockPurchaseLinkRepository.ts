import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/modules/database";

import type {
  IRestockPurchaseLinkRepository,
  PublicPurchaseListSource,
  PurchaseLinkRecord,
  PurchaseLinkSummary,
} from "../domain/ports/IRestockPurchaseLinkRepository";
import { PURCHASE_LINK_TOUCH_INTERVAL_MS } from "../domain/restock-purchase-link";
import { revokePurchaseLinksWithin } from "./restock-purchase-link-revocation";
import {
  PURCHASE_CONTEXT_SELECT,
  toPurchaseContext,
} from "./restock-purchase-record.mapper";

const LINK_RECORD_SELECT = {
  id: true,
  purchaseRequestId: true,
  tenantId: true,
  createdById: true,
  expiresAt: true,
  revokedAt: true,
  lastUsedAt: true,
  createdAt: true,
  createdBy: { select: { isActive: true } },
} as const;

const LINK_SUMMARY_SELECT = {
  id: true,
  createdAt: true,
  expiresAt: true,
  lastUsedAt: true,
  createdBy: { select: { name: true } },
} as const;

interface LinkSummaryRow {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date | null;
  createdBy: { name: string | null } | null;
}

function toLinkSummary(row: LinkSummaryRow): PurchaseLinkSummary {
  return {
    id: row.id,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    lastUsedAt: row.lastUsedAt,
    createdByName: row.createdBy?.name ?? null,
  };
}

function activeLinkWhere(
  purchaseRequestId: string,
  tenantId: string,
  now: Date,
): Prisma.RestockPurchaseLinkWhereInput {
  return {
    purchaseRequestId,
    tenantId,
    revokedAt: null,
    expiresAt: { gt: now },
  };
}

/**
 * Akses data link belanja tanpa login. Kecuali `findByTokenHash`, setiap
 * query menulis `tenantId` secara eksplisit supaya aman walau dipanggil di
 * luar konteks tenant.
 */
export class RestockPurchaseLinkRepository implements IRestockPurchaseLinkRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /** Cari link lewat sidik jari token (indeks unik). */
  async findByTokenHash(tokenHash: string): Promise<PurchaseLinkRecord | null> {
    const row = await this.db.restockPurchaseLink.findUnique({
      where: { tokenHash },
      select: LINK_RECORD_SELECT,
    });
    if (!row) return null;
    const { createdBy, ...link } = row;
    return { ...link, isCreatorActive: createdBy.isActive };
  }

  /** Link aktif terbaru untuk pengajuan ini. */
  async findActiveForRequest(
    purchaseRequestId: string,
    tenantId: string,
    now: Date,
  ): Promise<PurchaseLinkSummary | null> {
    const row = await this.db.restockPurchaseLink.findFirst({
      where: activeLinkWhere(purchaseRequestId, tenantId, now),
      orderBy: { createdAt: "desc" },
      select: LINK_SUMMARY_SELECT,
    });
    return row ? toLinkSummary(row) : null;
  }

  /** Cabut link aktif lalu buat yang baru, di bawah kunci pengajuan. */
  async replaceActiveLink(input: {
    purchaseRequestId: string;
    tenantId: string;
    tokenHash: string;
    expiresAt: Date;
    createdById: string;
    now: Date;
  }): Promise<PurchaseLinkSummary> {
    return this.db.$transaction(async (tx) => {
      await this.lockRequest(tx, input.purchaseRequestId, input.tenantId);
      await this.revokeWithin(tx, {
        purchaseRequestId: input.purchaseRequestId,
        tenantId: input.tenantId,
        revokedById: input.createdById,
        now: input.now,
      });
      const row = await tx.restockPurchaseLink.create({
        data: {
          purchaseRequestId: input.purchaseRequestId,
          tenantId: input.tenantId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          createdById: input.createdById,
        },
        select: LINK_SUMMARY_SELECT,
      });
      return toLinkSummary(row);
    });
  }

  /** Matikan semua link aktif pengajuan. */
  async revokeActiveLinks(
    purchaseRequestId: string,
    tenantId: string,
    revokedById: string,
    now: Date,
  ): Promise<number> {
    return this.db.$transaction(async (tx) => {
      await this.lockRequest(tx, purchaseRequestId, tenantId);
      return this.revokeWithin(tx, {
        purchaseRequestId,
        tenantId,
        revokedById,
        now,
      });
    });
  }

  /** Catat waktu terakhir link dibuka, dibatasi sekali per selang throttle. */
  async touchLastUsed(
    linkId: string,
    tenantId: string,
    now: Date,
  ): Promise<void> {
    const threshold = new Date(now.getTime() - PURCHASE_LINK_TOUCH_INTERVAL_MS);
    await this.db.restockPurchaseLink.updateMany({
      where: {
        id: linkId,
        tenantId,
        OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: threshold } }],
      },
      data: { lastUsedAt: now },
    });
  }

  /** Bahan daftar belanja publik: konteks, nama gudang, catatan belanja. */
  async findPublicListSource(
    purchaseRequestId: string,
    tenantId: string,
  ): Promise<PublicPurchaseListSource | null> {
    const request = await this.db.purchaseRequest.findFirst({
      where: { id: purchaseRequestId, tenantId },
      select: {
        ...PURCHASE_CONTEXT_SELECT,
        gudang: { select: { nama: true } },
      },
    });
    if (!request) return null;

    const { gudang, ...contextRow } = request;
    const context = toPurchaseContext(contextRow, tenantId);
    const records = context.purchaseOrder
      ? await this.db.purchaseRecord.findMany({
          // Catatan yang dibatalkan admin tidak lagi dihitung sebagai belanja.
          where: {
            purchaseOrderId: context.purchaseOrder.id,
            tenantId,
            voidedAt: null,
          },
          orderBy: [{ purchasedAt: "asc" }, { createdAt: "asc" }],
          select: {
            storeName: true,
            purchasedAt: true,
            items: {
              where: { tenantId },
              select: { purchaseOrderItemId: true, quantity: true },
            },
          },
        })
      : [];

    return { context, warehouseName: gudang.nama, records };
  }

  private async lockRequest(
    tx: Prisma.TransactionClient,
    purchaseRequestId: string,
    tenantId: string,
  ): Promise<void> {
    await tx.$queryRaw`
      SELECT id FROM purchase_requests
      WHERE id = ${purchaseRequestId} AND "tenantId" = ${tenantId}
      FOR UPDATE`;
  }

  private async revokeWithin(
    tx: Prisma.TransactionClient,
    input: {
      purchaseRequestId: string;
      tenantId: string;
      revokedById: string;
      now: Date;
    },
  ): Promise<number> {
    return revokePurchaseLinksWithin(tx, {
      scope: { id: input.purchaseRequestId },
      tenantId: input.tenantId,
      revokedById: input.revokedById,
      now: input.now,
    });
  }
}
