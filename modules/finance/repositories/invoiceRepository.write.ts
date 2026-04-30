import { randomUUID } from "crypto";
import { prismaBilling } from "@/lib/prisma-billing";
import type { Prisma } from "@prisma/client-billing";
import type { InvoiceEntity } from "../domain/entities/InvoiceEntity";
import {
  mapInvoiceEntity,
  mapInvoiceWithItemsAndPayments,
} from "./shared/invoiceRepositoryMappers";

type InvoiceItemPayload = {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

type UpdateWithItemsOptions = {
  invoiceId: string;
  updateData: Prisma.InvoiceUpdateInput;
  invoiceItem?: InvoiceItemPayload[];
};

/** Memperbarui invoice dan item terkait dalam satu transaksi. */
export async function updateInvoiceWithItemsTransaction(
  options: UpdateWithItemsOptions,
): Promise<InvoiceEntity> {
  const invoice = await prismaBilling.$transaction(async (tx) => {
    await replaceInvoiceItemsIfProvided(tx, options);
    return tx.invoice.update({
      where: { id: options.invoiceId },
      data: options.updateData,
      include: {
        invoiceItem: true,
        payment: true,
      },
    });
  });

  return mapInvoiceWithItemsAndPayments(invoice) as InvoiceEntity;
}

/** Menjalankan void invoice dan sinkronisasi status payment. */
export async function voidInvoiceTransaction(
  invoiceId: string,
  reason: string,
  invoiceNotes: string | null,
) {
  return prismaBilling.$transaction(async (tx) => {
    await tx.payment.updateMany({
      where: { invoiceId, gatewayStatus: "PAID" },
      data: { gatewayStatus: "REFUNDED" },
    });
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "CANCELLED",
        paidAmount: 0,
        notes: buildVoidInvoiceNotes(invoiceNotes, reason),
      },
    });
  });
}

/** Membuat invoice baru sederhana. */
export async function createInvoice(
  data: Prisma.InvoiceCreateInput,
): Promise<InvoiceEntity> {
  const invoice = await prismaBilling.invoice.create({ data });
  return mapInvoiceEntity(invoice) as InvoiceEntity;
}

/** Membuat invoice beserta item dan payment. */
export async function createInvoiceWithItems(
  data: Prisma.InvoiceCreateInput,
): Promise<InvoiceEntity> {
  const invoice = await prismaBilling.invoice.create({
    data,
    include: {
      invoiceItem: true,
      payment: true,
    },
  });
  return mapInvoiceWithItemsAndPayments(invoice) as InvoiceEntity;
}

/** Membuat payment terkait invoice. */
export async function createInvoicePayment(data: Prisma.PaymentCreateInput) {
  return prismaBilling.payment.create({ data });
}

async function replaceInvoiceItemsIfProvided(
  tx: Prisma.TransactionClient,
  options: UpdateWithItemsOptions,
) {
  if (!options.invoiceItem?.length) {
    return;
  }

  await tx.invoiceItem.deleteMany({
    where: { invoiceId: options.invoiceId },
  });

  await tx.invoiceItem.createMany({
    data: options.invoiceItem.map((item) => ({
      id: item.id || randomUUID(),
      invoiceId: options.invoiceId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: BigInt(item.unitPrice),
      totalPrice: BigInt(item.totalPrice),
    })),
  });
}

function buildVoidInvoiceNotes(invoiceNotes: string | null, reason: string) {
  const voidNote = `[VOID] Reason: ${reason}`;
  return invoiceNotes ? `${invoiceNotes}\n${voidNote}` : voidNote;
}
