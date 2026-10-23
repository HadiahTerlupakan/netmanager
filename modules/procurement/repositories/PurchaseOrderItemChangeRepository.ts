import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProcurementPaymentStatus } from "../domain/ports/IPurchaseOrderRepository";
import type {
  ApplyPurchaseOrderItemChangeInput,
  IPurchaseOrderItemChangeRepository,
  PurchaseOrderForItemChange,
  PurchaseOrderItemChangeResult,
  PurchaseOrderStatusValue,
} from "../domain/ports/IPurchaseOrderItemChangeRepository";
import {
  PAYMENT_TOLERANCE,
  PURCHASE_ORDER_PAYMENT_CATEGORY,
} from "./PurchaseOrderRepository";

type Tx = Prisma.TransactionClient;

async function readForItemChange(
  client: Tx | PrismaClient,
  id: string,
): Promise<PurchaseOrderForItemChange | null> {
  const po = await client.purchaseOrder.findUnique({
    where: { id },
    select: {
      id: true,
      poNumber: true,
      tenantId: true,
      status: true,
      grandTotal: true,
      ppnRate: true,
      items: {
        select: {
          id: true,
          barangId: true,
          quantity: true,
          receivedQuantity: true,
          cancelledQuantity: true,
          unitPrice: true,
          barang: { select: { nama: true } },
        },
      },
      purchaseRequests: {
        select: { id: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!po) return null;

  return {
    id: po.id,
    poNumber: po.poNumber,
    tenantId: po.tenantId,
    status: po.status,
    grandTotal: po.grandTotal,
    ppnRate: po.ppnRate,
    items: po.items.map(({ barang, ...item }) => ({
      ...item,
      barangName: barang?.nama ?? item.barangId,
    })),
    purchaseRequestIds: po.purchaseRequests.map((request) => request.id),
  };
}

export class PurchaseOrderItemChangeRepository implements IPurchaseOrderItemChangeRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async findForItemChange(
    id: string,
  ): Promise<PurchaseOrderForItemChange | null> {
    return readForItemChange(this.db, id);
  }

  async findBarangs(barangIds: string[], tenantId: string | null) {
    return this.db.barang.findMany({
      where: { id: { in: barangIds }, tenantId },
      select: { id: true, nama: true },
    });
  }

  async applyItemChange(
    input: ApplyPurchaseOrderItemChangeInput,
    assertStillValid: (po: PurchaseOrderForItemChange) => void,
  ): Promise<PurchaseOrderItemChangeResult> {
    return this.db.$transaction(async (tx: Tx) => {
      // Penerimaan barang (GRN, verifikasi restock) dan perubahan lain bisa
      // berjalan bersamaan. Kunci PO dan barisnya, lalu periksa ulang aturan
      // terhadap data terbaru sebelum menulis.
      await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${input.purchaseOrderId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM purchase_order_items WHERE "purchaseOrderId" = ${input.purchaseOrderId} FOR UPDATE`;
      const locked = await readForItemChange(tx, input.purchaseOrderId);
      if (!locked) {
        throw new Error(
          `Purchase Order ${input.purchaseOrderId} tidak ditemukan`,
        );
      }
      assertStillValid(locked);

      for (const change of input.quantityChanges) {
        const item = locked.items.find(
          (candidate) => candidate.id === change.purchaseOrderItemId,
        );
        if (!item) {
          throw new Error(
            `Item PO ${change.purchaseOrderItemId} tidak ditemukan`,
          );
        }
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: {
            quantity: change.quantity,
            totalPrice: change.quantity * item.unitPrice,
          },
        });
      }

      await this.createAdditions(tx, input);
      const grandTotal = await this.recalculateTotals(
        tx,
        input.purchaseOrderId,
      );
      const paymentStatus = await this.recalculatePaymentStatus(
        tx,
        input,
        grandTotal,
      );
      const status = await this.recalculateStatus(tx, input);
      return { status, paymentStatus, grandTotal };
    });
  }

  private async createAdditions(
    tx: Tx,
    input: ApplyPurchaseOrderItemChangeInput,
  ): Promise<void> {
    if (input.additions.length === 0) return;

    await tx.purchaseOrderItem.createMany({
      data: input.additions.map((addition) => ({
        purchaseOrderId: input.purchaseOrderId,
        barangId: addition.barangId,
        quantity: addition.quantity,
        unitPrice: addition.unitPrice,
        totalPrice: addition.quantity * addition.unitPrice,
        tenantId: input.tenantId,
      })),
    });

    if (!input.purchaseRequestId) return;
    await tx.purchaseRequestItem.createMany({
      data: input.additions.map((addition) => ({
        id: randomUUID(),
        purchaseRequestId: input.purchaseRequestId as string,
        barangId: addition.barangId,
        jumlah: addition.quantity,
        hargaPerUnit: addition.unitPrice,
        totalHarga: addition.quantity * addition.unitPrice,
        keterangan: "Ditambahkan lewat ubah isi PO",
        tenantId: input.tenantId,
      })),
    });
  }

  /** Hitung ulang subtotal, PPN, dan grand total dengan rumus edit PO. */
  private async recalculateTotals(
    tx: Tx,
    purchaseOrderId: string,
  ): Promise<number> {
    const [barangItems, jasaItems, po] = await Promise.all([
      tx.purchaseOrderItem.findMany({ where: { purchaseOrderId } }),
      tx.purchaseOrderJasaItem.findMany({ where: { purchaseOrderId } }),
      tx.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        select: { ppnRate: true },
      }),
    ]);
    const subtotal = [...barangItems, ...jasaItems].reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const ppnAmount = Math.round((subtotal * (po?.ppnRate ?? 0)) / 100);
    const grandTotal = subtotal + ppnAmount;

    await tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { totalAmount: subtotal, ppnAmount, grandTotal },
    });
    return grandTotal;
  }

  /**
   * Status bayar dihitung ulang dari pembayaran yang tercatat, dengan aturan
   * yang sama seperti saat pembayaran: total naik membuat PO lunas jadi
   * sebagian, total turun bisa membuat PO sebagian jadi lunas.
   */
  private async recalculatePaymentStatus(
    tx: Tx,
    input: ApplyPurchaseOrderItemChangeInput,
    grandTotal: number,
  ): Promise<ProcurementPaymentStatus> {
    const payments = await tx.expense.findMany({
      // Nomor PO berulang di setiap tenant, jadi pembayaran disaring per tenant.
      where: {
        invoiceNumber: input.poNumber,
        tenantId: input.tenantId,
        category: PURCHASE_ORDER_PAYMENT_CATEGORY,
      },
      select: { amount: true },
    });
    const totalPaid = payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );

    let paymentStatus: ProcurementPaymentStatus = "UNPAID";
    if (totalPaid > 0 && totalPaid >= grandTotal - PAYMENT_TOLERANCE) {
      paymentStatus = "PAID";
    } else if (totalPaid > 0) {
      paymentStatus = "PARTIAL";
    }

    await tx.purchaseOrder.update({
      where: { id: input.purchaseOrderId },
      data: { paymentStatus },
    });
    return paymentStatus;
  }

  /**
   * Mengurangi jumlah bisa membuat semua sisa pesanan habis; saat itu PO dan
   * pengajuannya ditutup seperti penerimaan terakhir.
   */
  private async recalculateStatus(
    tx: Tx,
    input: ApplyPurchaseOrderItemChangeInput,
  ): Promise<PurchaseOrderStatusValue> {
    const po = await tx.purchaseOrder.findUniqueOrThrow({
      where: { id: input.purchaseOrderId },
      select: {
        status: true,
        items: {
          select: {
            quantity: true,
            receivedQuantity: true,
            cancelledQuantity: true,
          },
        },
      },
    });
    const totalOrdered = po.items.reduce(
      (sum, item) => sum + item.quantity - item.cancelledQuantity,
      0,
    );
    const totalReceived = po.items.reduce(
      (sum, item) => sum + item.receivedQuantity,
      0,
    );

    if (totalOrdered > 0 && totalReceived >= totalOrdered) {
      await tx.purchaseOrder.update({
        where: { id: input.purchaseOrderId },
        data: { status: "RECEIVED", receivedById: input.actorId },
      });
      await tx.purchaseRequest.updateMany({
        where: { purchaseOrderId: input.purchaseOrderId },
        data: { status: "RECEIVED" },
      });
      return "RECEIVED";
    }
    return po.status;
  }
}
