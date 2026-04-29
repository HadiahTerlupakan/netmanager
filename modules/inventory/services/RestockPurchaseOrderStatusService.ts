import { NextResponse } from "next/server";
import { PurchaseOrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/modules/database";
import { RestockStockReceiptService } from "./RestockStockReceiptService";

type TransactionClient = Prisma.TransactionClient;

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
          { error: "Purchase Order not found" },
          { status: 404 },
        );
      }
      if (input.action === "START_SHOPPING") {
        return this.startPurchaseOrderShopping(
          purchaseOrder.id,
          purchaseOrder.status,
          input.actorId,
        );
      }
      const validationError = this.validateReceiveInput(
        input,
        purchaseOrder.status,
      );
      if (validationError) return validationError;
      const result = await this.receivePurchaseOrder(input);
      return NextResponse.json(result);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan server";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  private getPurchaseOrderWithItems(purchaseOrderId: string) {
    return prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: { items: { include: { barang: true } } },
    });
  }

  private async startPurchaseOrderShopping(
    id: string,
    status: PurchaseOrderStatus,
    actorId: string,
  ) {
    if (status !== "DRAFT") {
      return NextResponse.json(
        { error: "Hanya PO Draft yang bisa mulai diproses" },
        { status: 400 },
      );
    }
    const updatedPurchaseOrder = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: "ORDERED",
        processedById: actorId,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json(updatedPurchaseOrder);
  }

  private validateReceiveInput(
    input: RestockRequestStatusInput,
    status: PurchaseOrderStatus,
  ) {
    if (input.action !== "RECEIVE") {
      return NextResponse.json({ error: "Aksi tidak valid" }, { status: 400 });
    }
    if (!this.canReceivePurchaseOrder(status)) {
      return NextResponse.json(
        { error: "Hanya PO dalam proses yang bisa diterima" },
        { status: 400 },
      );
    }
    if (!input.fotoBukti?.length) {
      return NextResponse.json(
        { error: "Foto bukti penerimaan barang wajib diunggah" },
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
