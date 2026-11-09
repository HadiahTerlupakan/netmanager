import { Prisma, PrismaClient } from "@prisma/client";

import {
  isPrismaErrorCode,
  isPrismaUniqueConstraintError,
} from "@/lib/prisma-errors";
import { prisma } from "@/modules/database";

import type {
  CreatePurchaseRecordInput,
  CreatePurchaseRecordOutcome,
  IRestockPurchaseRecordRepository,
  RestockPurchaseContext,
  RestockPurchaseContextItem,
  RestockPurchaseRecordView,
  VoidPurchaseRecordInput,
  VoidPurchaseRecordOutcome,
} from "../domain/ports/IRestockPurchaseRecordRepository";
import { MAX_RECORDS_PER_PURCHASE_LINK } from "../domain/restock-purchase-link";
import { isRequestFullyPurchased } from "../domain/restock-purchase-record";
import { revokePurchaseLinksWithin } from "./restock-purchase-link-revocation";
import {
  CONTEXT_ITEM_SELECT,
  isLegacyPurchaseOrderRow,
  LEGACY_PURCHASE_ORDER_SELECT,
  PURCHASE_CONTEXT_SELECT,
  PURCHASE_RECORD_VIEW_SELECT,
  toPurchaseContext,
  toPurchaseRecordView,
} from "./restock-purchase-record.mapper";

/** Status pesanan yang sudah tutup: belanja tidak boleh dicatat lagi. */
const CLOSED_ORDER_STATUSES: readonly string[] = ["RECEIVED", "CANCELLED"];
/** Kode galat Prisma untuk konflik tulis / deadlock di transaksi. */
const WRITE_CONFLICT_CODE = "P2034";
const POSTGRES_DEADLOCK_PATTERN = /40P01|deadlock/i;

/**
 * Data catatan yang tidak ikut ke tampilan, tapi disalin ke log aktivitas
 * saat dibatalkan: catatan batal bisa ikut terhapus bersama pesanannya.
 */
const VOID_AUDIT_SELECT = {
  purchaseLinkId: true,
  clientRequestId: true,
  ipAddress: true,
  userAgent: true,
} as const;

interface OwnedPurchaseRecord {
  purchaseOrderId: string;
  /** Barang pengajuan ini (baris ditolak tidak ikut). */
  ownedBarangIds: string[];
}

/** Dilempar di dalam transaksi supaya semua tulisan dibatalkan. */
class PurchaseRecordConcurrentChange extends Error {}

interface VoidCandidateLine {
  quantity: number;
  purchaseOrderItem: {
    purchasedQuantity: number;
    receivedQuantity: number;
    barang: { nama: string; satuan: string | null } | null;
  } | null;
}

/** Baris yang barangnya sudah datang melebihi jumlah dibeli sesudah dibatalkan. */
function findLinesAlreadyReceived(
  lines: VoidCandidateLine[],
): Array<{ nama: string; received: number; satuan: string | null }> {
  return lines.flatMap((line) => {
    const item = line.purchaseOrderItem;
    if (!item) return [];
    const purchasedAfter = Math.max(item.purchasedQuantity - line.quantity, 0);
    if (purchasedAfter >= item.receivedQuantity) return [];
    return [
      {
        nama: item.barang?.nama ?? "Barang",
        received: item.receivedQuantity,
        satuan: item.barang?.satuan ?? null,
      },
    ];
  });
}

function isConcurrencyFailure(error: unknown): boolean {
  if (error instanceof PurchaseRecordConcurrentChange) return true;
  if (isPrismaErrorCode(error, WRITE_CONFLICT_CODE)) return true;
  return (
    error instanceof Error && POSTGRES_DEADLOCK_PATTERN.test(error.message)
  );
}

/**
 * Akses data catatan belanja restock. Semua query Prisma alur ini terpusat
 * di sini agar service tetap bebas ORM.
 */
export class RestockPurchaseRecordRepository implements IRestockPurchaseRecordRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /** Pengajuan milik tenant beserta pesanan & item pesanannya. */
  async findPurchaseContext(
    purchaseRequestId: string,
    tenantId: string,
  ): Promise<RestockPurchaseContext | null> {
    const request = await this.db.purchaseRequest.findFirst({
      where: { id: purchaseRequestId, tenantId },
      select: PURCHASE_CONTEXT_SELECT,
    });
    return request ? toPurchaseContext(request, tenantId) : null;
  }

  /**
   * Simpan catatan belanja beserta kenaikan jumlah dibeli per item.
   *
   * Baris pesanan dikunci dulu (`FOR UPDATE`), urutannya sama dengan
   * perubahan isi pesanan di procurement supaya keduanya tidak saling
   * deadlock. Setiap item dinaikkan dengan UPDATE bersyarat snapshot dan
   * batas sisa; bila satu saja gagal, seluruh transaksi dibatalkan.
   */
  async createPurchaseRecord(
    input: CreatePurchaseRecordInput,
  ): Promise<CreatePurchaseRecordOutcome> {
    try {
      const outcome = await this.db.$transaction((tx) =>
        this.writePurchaseRecord(tx, input),
      );
      // Kiriman pertama yang melengkapi daftar mencabut link-nya; kiriman
      // dobel yang menunggu kunci lalu melihat link mati tetap dikenali
      // sebagai kiriman ulang, bukan "link tidak berlaku".
      if (outcome.kind === "LINK_INACTIVE") {
        const duplicate = await this.findLinkDuplicate(input);
        if (duplicate) return { kind: "DUPLICATE", record: duplicate };
      }
      return outcome;
    } catch (error) {
      // Kiriman dobel yang bersamaan bisa gagal di UPDATE bersyarat (sisa
      // sudah habis oleh kiriman pertama) sebelum sempat kena indeks unik,
      // jadi kiriman ulang dicek dulu sebelum dianggap konflik.
      const duplicate = await this.findDuplicateAfterWriteError(error, input);
      if (duplicate) return { kind: "DUPLICATE", record: duplicate };
      if (isConcurrencyFailure(error)) return { kind: "CONFLICT" };
      // `clientRequestId` milik catatan yang sudah dibatalkan: kiriman ini
      // diperlakukan sebagai konflik supaya peramban membuat penanda baru.
      if (isPrismaUniqueConstraintError(error)) {
        return { kind: "CONFLICT" };
      }
      throw error;
    }
  }

  /** Catatan lewat link dengan `clientRequestId` ini, di tenant ini. */
  async findByClientRequestId(
    purchaseLinkId: string,
    clientRequestId: string,
    tenantId: string,
  ): Promise<RestockPurchaseRecordView | null> {
    const row = await this.db.purchaseRecord.findFirst({
      where: { purchaseLinkId, clientRequestId, tenantId, voidedAt: null },
      select: PURCHASE_RECORD_VIEW_SELECT,
    });
    return row ? toPurchaseRecordView(row) : null;
  }

  /**
   * Batalkan catatan belanja. Pesanan dikunci (`FOR UPDATE`) seperti saat
   * mencatat, lalu catatan ditandai batal secara bersyarat (belum batal) dan
   * jumlah dibeli tiap barisnya diturunkan, tidak sampai di bawah nol.
   * Ditolak bila jumlah dibeli sesudahnya lebih kecil dari jumlah yang sudah
   * datang: barang di gudang tidak boleh tercatat belum dibeli. Pencatatan
   * barang datang mengunci pesanan yang sama lebih dulu, jadi pemeriksaan
   * ini tidak bisa disusul kiriman yang masuk bersamaan.
   */
  async voidPurchaseRecord(
    input: VoidPurchaseRecordInput,
  ): Promise<VoidPurchaseRecordOutcome> {
    return this.db.$transaction(async (tx) => {
      const owned = await this.findOwnedRecord(tx, input);
      if (!owned) return { kind: "NOT_FOUND" };
      const { purchaseOrderId } = owned;

      const locked = await tx.$queryRaw<
        Array<{ status: string; poNumber: string }>
      >`
        SELECT status, "poNumber" FROM purchase_orders WHERE id = ${purchaseOrderId} FOR UPDATE`;
      const order = locked[0];
      if (!order) return { kind: "NOT_FOUND" };
      if (CLOSED_ORDER_STATUSES.includes(order.status)) {
        return { kind: "CLOSED" };
      }
      // Diperiksa sesudah pesanan dikunci: penggabungan pesanan yang masuk
      // bersamaan tidak bisa lolos di sela pemeriksaan dan penulisan.
      if (await this.hasLinesOfOtherRequests(tx, input, owned)) {
        return { kind: "SHARED_WITH_OTHER_REQUEST" };
      }

      const lines = await tx.purchaseRecordItem.findMany({
        where: { purchaseRecordId: input.recordId, tenantId: input.tenantId },
        select: {
          purchaseOrderItemId: true,
          quantity: true,
          purchaseOrderItem: {
            select: {
              purchasedQuantity: true,
              receivedQuantity: true,
              barang: { select: { nama: true, satuan: true } },
            },
          },
        },
      });
      const receivedLines = findLinesAlreadyReceived(lines);
      if (receivedLines.length > 0) {
        return { kind: "ALREADY_RECEIVED", lines: receivedLines };
      }

      const marked = await tx.purchaseRecord.updateMany({
        where: { id: input.recordId, tenantId: input.tenantId, voidedAt: null },
        data: {
          voidedAt: input.now,
          voidedById: input.actorId,
          voidReason: input.reason,
        },
      });
      if (marked.count === 0) return { kind: "ALREADY_VOIDED" };

      for (const line of lines) {
        await tx.$executeRaw`
          UPDATE purchase_order_items
          SET "purchasedQuantity" = GREATEST("purchasedQuantity" - ${line.quantity}, 0)
          WHERE id = ${line.purchaseOrderItemId}
            AND "purchaseOrderId" = ${purchaseOrderId}`;
      }

      const record = await tx.purchaseRecord.findUniqueOrThrow({
        where: { id: input.recordId },
        select: { ...PURCHASE_RECORD_VIEW_SELECT, ...VOID_AUDIT_SELECT },
      });
      return {
        kind: "VOIDED",
        record: toPurchaseRecordView(record),
        audit: {
          buyerSignatureKey: record.buyerSignatureKey,
          purchaseLinkId: record.purchaseLinkId,
          clientRequestId: record.clientRequestId,
          ipAddress: record.ipAddress,
          userAgent: record.userAgent,
        },
        poNumber: order.poNumber,
      };
    });
  }

  /**
   * Kunci tanda tangan catatan belanja milik pesanan pengajuan ini. Catatan
   * yang tidak memuat satu pun barang milik pengajuan (pesanan gabungan)
   * diperlakukan seperti tidak ada.
   */
  async findSignatureKey(input: {
    purchaseRequestId: string;
    recordId: string;
    tenantId: string;
  }): Promise<string | null> {
    const request = await this.db.purchaseRequest.findFirst({
      where: { id: input.purchaseRequestId, tenantId: input.tenantId },
      select: {
        purchaseOrderId: true,
        items: {
          where: { statusApproval: { not: "REJECTED" } },
          select: { barangId: true },
        },
      },
    });
    if (!request?.purchaseOrderId) return null;

    const ownedBarangIds = request.items.map((item) => item.barangId);
    if (ownedBarangIds.length === 0) return null;

    const record = await this.db.purchaseRecord.findFirst({
      where: {
        id: input.recordId,
        tenantId: input.tenantId,
        purchaseOrderId: request.purchaseOrderId,
        items: {
          some: {
            tenantId: input.tenantId,
            purchaseOrderItem: {
              purchaseOrderId: request.purchaseOrderId,
              barangId: { in: ownedBarangIds },
            },
          },
        },
      },
      select: { buyerSignatureKey: true },
    });
    return record?.buyerSignatureKey ?? null;
  }

  /**
   * Pesanan catatan ini beserta barang milik pengajuan, bila catatannya
   * milik pesanan pengajuan ini, di tenant ini, dan memuat minimal satu
   * barang milik pengajuan.
   */
  private async findOwnedRecord(
    tx: Prisma.TransactionClient,
    input: VoidPurchaseRecordInput,
  ): Promise<OwnedPurchaseRecord | null> {
    const request = await tx.purchaseRequest.findFirst({
      where: { id: input.purchaseRequestId, tenantId: input.tenantId },
      select: {
        purchaseOrderId: true,
        items: {
          where: { statusApproval: { not: "REJECTED" } },
          select: { barangId: true },
        },
      },
    });
    if (!request?.purchaseOrderId || request.items.length === 0) return null;
    const ownedBarangIds = request.items.map((item) => item.barangId);

    const record = await tx.purchaseRecord.findFirst({
      where: {
        id: input.recordId,
        tenantId: input.tenantId,
        purchaseOrderId: request.purchaseOrderId,
        items: {
          some: {
            tenantId: input.tenantId,
            purchaseOrderItem: {
              purchaseOrderId: request.purchaseOrderId,
              barangId: { in: ownedBarangIds },
            },
          },
        },
      },
      select: { purchaseOrderId: true },
    });
    return record
      ? { purchaseOrderId: record.purchaseOrderId, ownedBarangIds }
      : null;
  }

  /**
   * Pesanan gabungan: catatan ini juga memuat barang yang bukan milik
   * pengajuan ini (milik pengajuan lain, bisa di gudang lain). Pembatalan
   * dari pengajuan ini ditolak supaya jumlah dibeli barang pengajuan lain
   * tidak ikut turun tanpa terlihat dan tanpa izin gudangnya.
   */
  private async hasLinesOfOtherRequests(
    tx: Prisma.TransactionClient,
    input: VoidPurchaseRecordInput,
    owned: OwnedPurchaseRecord,
  ): Promise<boolean> {
    const linkedRequestCount = await tx.purchaseRequest.count({
      where: { purchaseOrderId: owned.purchaseOrderId },
    });
    if (linkedRequestCount <= 1) return false;
    const foreignLineCount = await tx.purchaseRecordItem.count({
      where: {
        purchaseRecordId: input.recordId,
        tenantId: input.tenantId,
        purchaseOrderItem: { barangId: { notIn: owned.ownedBarangIds } },
      },
    });
    return foreignLineCount > 0;
  }

  private async findDuplicateAfterWriteError(
    error: unknown,
    input: CreatePurchaseRecordInput,
  ): Promise<RestockPurchaseRecordView | null> {
    if (!isPrismaUniqueConstraintError(error) && !isConcurrencyFailure(error)) {
      return null;
    }
    return this.findLinkDuplicate(input);
  }

  private async findLinkDuplicate(
    input: CreatePurchaseRecordInput,
  ): Promise<RestockPurchaseRecordView | null> {
    return this.findByClientRequestId(
      input.purchaseLinkId,
      input.clientRequestId,
      input.tenantId,
    );
  }

  private async writePurchaseRecord(
    tx: Prisma.TransactionClient,
    input: CreatePurchaseRecordInput,
  ): Promise<CreatePurchaseRecordOutcome> {
    // Urutan kunci: pesanan dulu, baru link. Semua penulis yang menyentuh
    // keduanya (pencatatan, pembatalan, pencabutan otomatis) memakai urutan
    // yang sama supaya tidak saling deadlock.
    const locked = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM purchase_orders WHERE id = ${input.purchaseOrderId} FOR UPDATE`;
    const previousStatus = locked[0]?.status;
    if (!previousStatus) throw new PurchaseRecordConcurrentChange();

    const linkBlock = await this.checkLinkWithin(tx, {
      purchaseLinkId: input.purchaseLinkId,
      purchaseOrderId: input.purchaseOrderId,
      tenantId: input.tenantId,
    });
    if (linkBlock) return linkBlock;
    if (CLOSED_ORDER_STATUSES.includes(previousStatus)) {
      return { kind: "CLOSED" };
    }

    for (const line of input.lines) {
      const maxEffectiveBefore =
        line.expected.quantity -
        line.expected.cancelledQuantity -
        line.quantity;
      // Barang yang sudah datang tanpa catatan belanja dihitung sudah dibeli,
      // jadi kenaikan dimulai dari GREATEST(dibeli, datang). Dengan begitu
      // sisa belum dibeli selalu turun sebesar yang dicatat.
      const updated = await tx.$executeRaw`
        UPDATE purchase_order_items
        SET "purchasedQuantity" = GREATEST("purchasedQuantity", "receivedQuantity") + ${line.quantity}
        WHERE id = ${line.purchaseOrderItemId}
          AND "purchaseOrderId" = ${input.purchaseOrderId}
          AND quantity = ${line.expected.quantity}
          AND "cancelledQuantity" = ${line.expected.cancelledQuantity}
          AND GREATEST("purchasedQuantity", "receivedQuantity") <= ${maxEffectiveBefore}`;
      if (updated === 0) throw new PurchaseRecordConcurrentChange();
    }

    const purchaseOrderStatus =
      previousStatus === "DRAFT" ? "ORDERED" : previousStatus;
    if (previousStatus === "DRAFT") {
      await tx.purchaseOrder.update({
        where: { id: input.purchaseOrderId },
        data: {
          status: "ORDERED",
          issuedAt: input.issuedAt,
          processedById: input.recordedById,
        },
      });
    }

    const record = await tx.purchaseRecord.create({
      data: {
        purchaseOrderId: input.purchaseOrderId,
        storeName: input.storeName,
        supplierId: null,
        purchasedAt: input.purchasedAt,
        recordedById: input.recordedById,
        notes: input.notes,
        fotoNota: [],
        tenantId: input.tenantId,
        buyerName: input.buyerName,
        buyerSignatureKey: input.buyerSignatureKey,
        source: "PUBLIC_LINK",
        purchaseLinkId: input.purchaseLinkId,
        clientRequestId: input.clientRequestId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        items: {
          create: input.lines.map((line) => ({
            purchaseOrderItemId: line.purchaseOrderItemId,
            barangId: line.barangId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            tenantId: input.tenantId,
          })),
        },
      },
      select: PURCHASE_RECORD_VIEW_SELECT,
    });

    const items: RestockPurchaseContextItem[] =
      await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: input.purchaseOrderId },
        select: CONTEXT_ITEM_SELECT,
      });

    // Semua barang pengajuan sudah dibeli: link belanjanya tidak diperlukan
    // lagi dan dicabut di transaksi yang sama.
    const revokedLinkCount = isRequestFullyPurchased(
      items,
      input.receivableBarangIds,
    )
      ? await revokePurchaseLinksWithin(tx, {
          scope: { id: input.purchaseRequestId },
          tenantId: input.tenantId,
          revokedById: null,
          now: new Date(),
        })
      : 0;

    return {
      kind: "CREATED",
      record: toPurchaseRecordView(record),
      previousStatus,
      purchaseOrderStatus,
      items,
      revokedLinkCount,
    };
  }

  /**
   * Pemeriksaan link di dalam transaksi (pesanan sudah dikunci): link masih
   * berlaku, pesanannya tidak dipakai pengajuan lain (penggabungan bisa
   * terjadi setelah link dibuat), pesanannya bukan data lama (sudah dibeli
   * sebelum ada link), dan batas jumlah catatan belum tercapai. Null bila
   * boleh lanjut.
   */
  private async checkLinkWithin(
    tx: Prisma.TransactionClient,
    input: {
      purchaseLinkId: string;
      purchaseOrderId: string;
      tenantId: string;
    },
  ): Promise<CreatePurchaseRecordOutcome | null> {
    if (
      !(await this.lockUsableLink(tx, input.purchaseLinkId, input.tenantId))
    ) {
      return { kind: "LINK_INACTIVE" };
    }
    const order = await tx.purchaseOrder.findUnique({
      where: { id: input.purchaseOrderId },
      select: LEGACY_PURCHASE_ORDER_SELECT,
    });
    if (!order) throw new PurchaseRecordConcurrentChange();
    if (order._count.purchaseRequests > 1 || isLegacyPurchaseOrderRow(order)) {
      return { kind: "LINK_INACTIVE" };
    }

    const linkRecordCount = await tx.purchaseRecord.count({
      where: { purchaseLinkId: input.purchaseLinkId, tenantId: input.tenantId },
    });
    if (linkRecordCount >= MAX_RECORDS_PER_PURCHASE_LINK) {
      return { kind: "LINK_LIMIT" };
    }
    return null;
  }

  /**
   * Kunci link (`FOR SHARE`) selama transaksi dan pastikan masih berlaku,
   * termasuk pembuatnya masih aktif. Pencabutan oleh admin menunggu kunci
   * ini, jadi tidak ada catatan yang lolos setelah link dimatikan. Dipanggil
   * sesudah pesanan dikunci, jadi dua kiriman lewat link yang sama tidak
   * pernah sama-sama memegang kunci link sambil menunggu pesanan.
   */
  private async lockUsableLink(
    tx: Prisma.TransactionClient,
    purchaseLinkId: string,
    tenantId: string,
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT link.id FROM restock_purchase_links link
      JOIN "User" creator ON creator.id = link."createdById"
      WHERE link.id = ${purchaseLinkId}
        AND link."tenantId" = ${tenantId}
        AND link."revokedAt" IS NULL
        AND link."expiresAt" > now()
        AND creator."isActive" = true
      FOR SHARE OF link`;
    return rows.length > 0;
  }
}
