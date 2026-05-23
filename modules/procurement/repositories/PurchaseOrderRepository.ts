import { prisma } from "@/lib/prisma";
import {
  PurchaseOrderStatus,
  type FinancialAccount,
  type PrismaClient,
  type PurchaseOrder,
  type Prisma,
  type PaymentStatus,
} from "@prisma/client";
import type {
  IPurchaseOrderRepository,
  PurchaseOrderCreateInput,
  PurchaseOrderListFilter,
  PurchaseOrderListResult,
  PurchaseOrderMetadataUpdate,
  PurchaseOrderPaymentInput,
  PurchaseOrderPaymentResult,
} from "../domain/ports/IPurchaseOrderRepository";

const PO_NUMBER_SEPARATOR = "/";
const PO_NUMBER_PADDING = 4;
const PO_NUMBER_PAD_CHARACTER = "0";
const PO_NUMBER_DEFAULT_SEQUENCE = "0001";
const PO_NUMBER_MONTH_OFFSET = 1;
const PAYMENT_TOLERANCE = 100;

export class PurchaseOrderRepository implements IPurchaseOrderRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findById(id: string): Promise<PurchaseOrder | null> {
    return this.client.purchaseOrder.findUnique({ where: { id } });
  }

  async findByIdWithRelations(id: string) {
    return this.client.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, npwp: true } },
        items: {
          include: {
            barang: { select: { id: true, nama: true } },
          },
        },
      },
    });
  }

  async list(
    filter: PurchaseOrderListFilter,
  ): Promise<PurchaseOrderListResult> {
    const where: Prisma.PurchaseOrderWhereInput = {
      tenantId: filter.tenantId,
    };
    if (filter.search) {
      where.poNumber = { contains: filter.search, mode: "insensitive" };
    }
    if (filter.status) {
      where.status = filter.status as PurchaseOrderStatus;
    }
    if (filter.paymentStatus) {
      where.paymentStatus = filter.paymentStatus;
    }

    const [items, total] = await Promise.all([
      this.client.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, npwp: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.client.purchaseOrder.count({ where }),
    ]);

    return { items, total, page: filter.page, limit: filter.limit };
  }

  async update(
    id: string,
    data: { paymentStatus?: PaymentStatus; paidFromAccountId?: string },
  ): Promise<PurchaseOrder> {
    return this.client.purchaseOrder.update({ where: { id }, data });
  }

  async updateMetadata(
    id: string,
    data: PurchaseOrderMetadataUpdate,
  ): Promise<PurchaseOrder> {
    return this.client.purchaseOrder.update({ where: { id }, data });
  }

  async create(input: PurchaseOrderCreateInput): Promise<PurchaseOrder> {
    const ppnRate = input.ppnRate ?? 0;
    const subtotal = input.items.reduce(
      (acc, item) => acc + item.quantity * item.unitPrice,
      0,
    );
    const ppnAmount = Math.round((subtotal * ppnRate) / 100);
    const grandTotal = subtotal + ppnAmount;

    return this.client.purchaseOrder.create({
      data: {
        poNumber: input.poNumber,
        supplierId: input.supplierId,
        createdBy: input.createdBy,
        tenantId: input.tenantId,
        status: PurchaseOrderStatus.DRAFT,
        totalAmount: subtotal,
        grandTotal,
        ppnAmount,
        ppnRate,
        vendorNpwp: input.vendorNpwp ?? null,
        expectedDate: input.expectedDate ?? null,
        notes: input.notes ?? null,
        items: {
          create: input.items.map((item) => ({
            barangId: item.barangId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            tenantId: input.tenantId,
          })),
        },
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      await tx.purchaseRequest.updateMany({
        where: { purchaseOrderId: id },
        data: { status: "APPROVED", purchaseOrderId: null },
      });
      await tx.purchaseOrder.delete({ where: { id } });
    });
  }

  async generatePoNumber(tenantId: string | null): Promise<string> {
    const prefix = createPONumberPrefix(new Date());
    const last = await this.client.purchaseOrder.findFirst({
      where: { tenantId, poNumber: { startsWith: prefix } },
      orderBy: { poNumber: "desc" },
    });
    const nextSequence = getNextPoNumberSequence(last?.poNumber);
    return `${prefix}${PO_NUMBER_SEPARATOR}${nextSequence}`;
  }

  async findManyWithTax(where: Prisma.PurchaseOrderWhereInput) {
    return this.client.purchaseOrder.findMany({
      where,
      select: {
        poNumber: true,
        ppnAmount: true,
        ppnRate: true,
        totalAmount: true,
        createdAt: true,
        supplier: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async processPaymentTransaction(
    input: PurchaseOrderPaymentInput,
  ): Promise<PurchaseOrderPaymentResult> {
    return this.client.$transaction(async (tx) => {
      if (input.paidFromAccountId) {
        const account = await tx.financialAccount.findUnique({
          where: { id: input.paidFromAccountId },
        });

        if (!account) throw new Error("Akun keuangan tidak ditemukan");
        if (account.balance < input.amount) {
          throw new Error(`Saldo akun ${account.name} tidak mencukupi.`);
        }

        await tx.financialAccount.update({
          where: { id: input.paidFromAccountId },
          data: { balance: { decrement: input.amount } },
        });
      }

      const expense = await tx.expense.create({
        data: {
          category: "Purchase Order Payment",
          amount: input.amount,
          date: input.date,
          description: input.notes || `Pembayaran PO #${input.po.poNumber}`,
          invoiceNumber: input.po.poNumber,
        },
      });

      const existingExpenses = await tx.expense.findMany({
        where: { invoiceNumber: input.po.poNumber },
      });

      const totalPaid = existingExpenses.reduce(
        (sum: number, e) => sum + Number(e.amount),
        0,
      );
      let newStatus: PaymentStatus = "UNPAID";
      const targetAmount =
        input.po.grandTotal > 0 ? input.po.grandTotal : input.po.totalAmount;

      if (totalPaid >= targetAmount - PAYMENT_TOLERANCE) {
        newStatus = "PAID";
      } else if (totalPaid > 0) {
        newStatus = "PARTIAL";
      }

      await tx.purchaseOrder.update({
        where: { id: input.poId },
        data: {
          paymentStatus: newStatus,
          ...(input.paidFromAccountId
            ? { paidFromAccountId: input.paidFromAccountId }
            : {}),
        },
      });

      return { expense, newStatus };
    });
  }

  async updateBalanceInTx(
    tx: PrismaClient,
    accountId: string,
    amount: number,
  ): Promise<FinancialAccount> {
    return tx.financialAccount.update({
      where: { id: accountId },
      data: { balance: { decrement: amount } },
    });
  }

  async findUniqueFinancialAccountInTx(
    tx: PrismaClient,
    id: string,
  ): Promise<FinancialAccount | null> {
    return tx.financialAccount.findUnique({ where: { id } });
  }
}

function createPONumberPrefix(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + PO_NUMBER_MONTH_OFFSET).padStart(
    2,
    PO_NUMBER_PAD_CHARACTER,
  );
  return `PO${PO_NUMBER_SEPARATOR}${year}${PO_NUMBER_SEPARATOR}${month}`;
}

function getNextPoNumberSequence(poNumber?: string | null): string {
  if (!poNumber) {
    return PO_NUMBER_DEFAULT_SEQUENCE;
  }
  const segments = poNumber.split(PO_NUMBER_SEPARATOR);
  const lastSequence = Number.parseInt(segments.at(-1) ?? "0", 10);
  return String(lastSequence + 1).padStart(
    PO_NUMBER_PADDING,
    PO_NUMBER_PAD_CHARACTER,
  );
}
