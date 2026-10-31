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

/**
 * Void invoice PAID/PARTIAL_PAID dan kembalikan payment PAID-nya (REFUNDED).
 * Bersyarat pada statusnya, sehingga dua void bersamaan hanya berhasil sekali
 * dan saldo kredit serta jatuh tempo tidak dikembalikan dua kali.
 *
 * @returns false bila invoice tidak lagi PAID/PARTIAL_PAID.
 */
export async function voidInvoiceTransaction(
  invoiceId: string,
  reason: string,
  invoiceNotes: string | null,
): Promise<boolean> {
  return prismaBilling.$transaction(async (tx) => {
    const { count } = await tx.invoice.updateMany({
      where: { id: invoiceId, status: { in: ["PAID", "PARTIAL_PAID"] } },
      data: {
        status: "CANCELLED",
        paidAmount: 0,
        notes: buildVoidInvoiceNotes(invoiceNotes, reason),
      },
    });
    if (count === 0) return false;
    await tx.payment.updateMany({
      where: { invoiceId, gatewayStatus: "PAID" },
      data: { gatewayStatus: "REFUNDED" },
    });
    return true;
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
