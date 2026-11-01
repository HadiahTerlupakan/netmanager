import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { Prisma } from "../repositories/prisma-boundary";
import { PurchaseOrderStatus } from "../types/asset.enums";
import { prisma } from "@/modules/database";
import { RestockStockReceiptService } from "./RestockStockReceiptService";
import {
  INVENTORY_ACTIVITY_ACTIONS,
  INVENTORY_ACTIVITY_SUBJECTS,
  recordInventoryActivity,
} from "./inventory-activity-log";
import {
  RESTOCK_MESSAGES,
  describeRestockStatus,
  restockServerErrorMessage,
} from "./restock-messages";

type TransactionClient = Prisma.TransactionClient;

const RESTOCK_RECEIPT_PHOTO_MISSING_MESSAGE =
  "Foto bukti barang datang belum diunggah. Foto barangnya dulu, lalu simpan.";

interface RestockRequestStatusInput {
  purchaseOrderId: string;
  action: unknown;
  items?: Record<string, number>;
  closePO?: boolean;
  actorId: string;
  fotoBukti?: string[];
}

export class RestockPurchaseOrderStatusService {
  private readonly stockReceiptService = new RestockStockReceiptService();
  /** Ubah status proses purchase order dari restock request. */
  async patchRestockRequestStatus(input: RestockRequestStatusInput) {
    try {
      const purchaseOrder = await this.getPurchaseOrderWithItems(
        input.purchaseOrderId,
      );
      if (!purchaseOrder) {
        return NextResponse.json(
          { error: RESTOCK_MESSAGES.purchaseOrderNotFound },
          { status: 404 },
        );
      }
      if (input.action === "START_SHOPPING") {
        return this.startPurchaseOrderShopping(purchaseOrder, input.actorId);
      }
      const validationError = this.validateReceiveInput(
        input,
        purchaseOrder.status,
      );
      if (validationError) return validationError;
      const result = await this.receivePurchaseOrder(input);
      return NextResponse.json(result);
    } catch (error: unknown) {
      logger.error(
        "Error updating restock purchase order status",
        error instanceof Error ? error : new Error(String(error)),
        {
          purchaseOrderId: input.purchaseOrderId,
          action: String(input.action),
        },
      );
      return NextResponse.json(
        { error: restockServerErrorMessage("Memproses pesanan", false) },
        { status: 500 },
      );
    }
  }

  private getPurchaseOrderWithItems(purchaseOrderId: string) {
    return prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: { items: { include: { barang: true } } },
    });
  }

  private async startPurchaseOrderShopping(
    purchaseOrder: {
      id: string;
      poNumber: string;
      status: PurchaseOrderStatus;
      tenantId: string | null;
    },
    actorId: string,
  ) {
    if (purchaseOrder.status !== "DRAFT") {
      return NextResponse.json(
        {
          error: `Pesanan ${purchaseOrder.poNumber} ${describeRestockStatus(purchaseOrder.status)}, jadi tidak bisa mulai dibelanjakan lagi. Muat ulang halaman untuk melihat keadaan terbarunya.`,
        },
        { status: 400 },
      );
    }
    const updatedPurchaseOrder = await prisma.purchaseOrder.update({
      where: { id: purchaseOrder.id },
      data: {
        status: "ORDERED",
        processedById: actorId,
        updatedAt: new Date(),
      },
    });
    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.START_SHOPPING,
      subject: INVENTORY_ACTIVITY_SUBJECTS.PURCHASE_ORDER,
      reference: purchaseOrder.poNumber,
      actorId,
      tenantId: purchaseOrder.tenantId,
      details: {
        purchaseOrderId: purchaseOrder.id,
        statusLama: purchaseOrder.status,
        statusBaru: "ORDERED",
      },
    });
    return NextResponse.json(updatedPurchaseOrder);
  }

  private validateReceiveInput(
    input: RestockRequestStatusInput,
    status: PurchaseOrderStatus,
  ) {
    if (input.action !== "RECEIVE") {
      return NextResponse.json(
        {
          error:
            "Tindakan ini tidak dikenal. Muat ulang halaman, lalu coba lagi.",
        },
        { status: 400 },
      );
    }
    if (!this.canReceivePurchaseOrder(status)) {
      return NextResponse.json(
        {
          error: `Pesanan ini ${describeRestockStatus(status)}, jadi barangnya tidak bisa diterima lagi.`,
        },
        { status: 400 },
      );
    }
    if (!input.fotoBukti?.length) {
      return NextResponse.json(
        { error: RESTOCK_RECEIPT_PHOTO_MISSING_MESSAGE },
        { status: 400 },
      );
    }
    return null;
  }

  private canReceivePurchaseOrder(status: string) {
    return status === "DRAFT" || status === "ORDERED" || status === "PARTIAL";
  }

  private receivePurchaseOrder(input: RestockRequestStatusInput) {
    return prisma.$transaction(async (transaction) => {
      const freshPurchaseOrder = await transaction.purchaseOrder.findUnique({
        where: { id: input.purchaseOrderId },
        include: { items: { include: { barang: true } } },
      });
      if (!freshPurchaseOrder || freshPurchaseOrder.items.length === 0) {
        throw new Error("Purchase Order tidak memiliki items");
      }
      for (const item of freshPurchaseOrder.items) {
        await this.stockReceiptService.processPurchaseOrderItem(transaction, {
          item,
          purchaseOrderId: input.purchaseOrderId,
          actorId: input.actorId,
          fotoBukti: input.fotoBukti ?? [],
          poNumber: freshPurchaseOrder.poNumber,
          receivedItems: input.items ?? {},
          tenantId: freshPurchaseOrder.tenantId,
        });
      }
      return this.finalizePurchaseOrderReceipt(transaction, {
        purchaseOrderId: input.purchaseOrderId,
        actorId: input.actorId,
        closePO: input.closePO,
        fotoBukti: input.fotoBukti ?? [],
      });
    });
  }

  private finalizePurchaseOrderReceipt(
    transaction: TransactionClient,
    input: {
      purchaseOrderId: string;
      actorId: string;
      closePO?: boolean;
      fotoBukti: string[];
    },
  ) {
    const nextStatus: PurchaseOrderStatus = input.closePO
      ? "RECEIVED"
      : "PARTIAL";
    return transaction.purchaseOrder
      .update({
        where: { id: input.purchaseOrderId },
        data: {
          status: nextStatus,
          ...(nextStatus === "RECEIVED" ? { receivedById: input.actorId } : {}),
          fotoBukti: { push: input.fotoBukti },
          updatedAt: new Date(),
        },
      })
      .then(async (updatedPurchaseOrder) => {
        if (nextStatus === "RECEIVED") {
          await transaction.purchaseRequest.updateMany({
            where: { purchaseOrderId: input.purchaseOrderId },
            data: { status: "RECEIVED" },
          });
        }
        return updatedPurchaseOrder;
      });
  }
}
