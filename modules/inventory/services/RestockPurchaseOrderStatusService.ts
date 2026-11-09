import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import type { IRestockGoodsReceiptRepository } from "../domain/ports/IRestockGoodsReceiptRepository";
import { RestockGoodsReceiptRepository } from "../repositories/RestockGoodsReceiptRepository";
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

const UNKNOWN_ACTION_MESSAGE =
  "Tindakan ini tidak dikenal. Muat ulang halaman, lalu coba lagi.";
const ALREADY_PURCHASED_MESSAGE =
  "Pesanan ini sudah tercatat dibeli. Muat ulang halaman untuk melihat keadaan terbarunya.";

/** Pesan saat pesanan yang bukan DRAFT diminta ditandai sudah dibeli. */
function describeAlreadyPurchased(status: string | null | undefined): string {
  if (status !== "CANCELLED") return ALREADY_PURCHASED_MESSAGE;
  return `Pesanan ini ${describeRestockStatus(status)}, jadi tidak bisa ditandai sudah dibeli. Muat ulang halaman untuk melihat keadaan terbarunya.`;
}

interface RestockRequestStatusInput {
  purchaseOrderId: string;
  action: unknown;
  actorId: string;
}

/**
 * Langkah "Tandai Sudah Dibeli": pesanan DRAFT menjadi ORDERED beserta siapa
 * yang membeli dan kapan. Penerimaan barang ditangani
 * RestockGoodsReceiptService lewat GRN.
 */
export class RestockPurchaseOrderStatusService {
  constructor(
    private readonly repository: IRestockGoodsReceiptRepository = new RestockGoodsReceiptRepository(),
  ) {}

  /** Ubah status proses purchase order dari restock request. */
  async patchRestockRequestStatus(input: RestockRequestStatusInput) {
    if (input.action !== "START_SHOPPING") {
      return NextResponse.json(
        { error: UNKNOWN_ACTION_MESSAGE },
        { status: 400 },
      );
    }
    try {
      return await this.startPurchaseOrderShopping(
        input.purchaseOrderId,
        input.actorId,
      );
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

  private async startPurchaseOrderShopping(
    purchaseOrderId: string,
    actorId: string,
  ) {
    const purchaseOrder =
      await this.repository.findPurchaseOrderWithItems(purchaseOrderId);
    if (!purchaseOrder) {
      return NextResponse.json(
        { error: RESTOCK_MESSAGES.purchaseOrderNotFound },
        { status: 404 },
      );
    }
    const updatedPurchaseOrder =
      purchaseOrder.status === "DRAFT"
        ? await this.repository.markPurchaseOrderOrdered({
            purchaseOrderId,
            processedById: actorId,
            issuedAt: new Date(),
          })
        : null;
    if (!updatedPurchaseOrder) {
      const latestStatus =
        (await this.repository.findPurchaseOrderStatus(purchaseOrderId)) ??
        purchaseOrder.status;
      return NextResponse.json(
        { error: describeAlreadyPurchased(latestStatus) },
        { status: 400 },
      );
    }

    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.START_SHOPPING,
      subject: INVENTORY_ACTIVITY_SUBJECTS.PURCHASE_ORDER,
      reference: purchaseOrder.poNumber ?? purchaseOrderId,
      actorId,
      tenantId: purchaseOrder.tenantId,
      details: {
        purchaseOrderId,
        statusLama: purchaseOrder.status,
        statusBaru: "ORDERED",
      },
    });
    return NextResponse.json(updatedPurchaseOrder);
  }
}
