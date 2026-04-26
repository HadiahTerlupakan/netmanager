import { prisma } from "@/lib/prisma";
import type { PrismaClient, Expense } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export interface ExpenseWithRelations extends Expense {
  user?: { name: string } | null;
  site?: { name: string } | null;
  expenseCategory?: { id: string; name: string; type: string } | null;
  rabProject?: { id: string; name: string } | null;
  rabItem?: { id: string; name: string } | null;
}

export interface ExpenseCreateInput {
  id: string;
  amount: bigint;
  depreciation: bigint;
  usefulLife: number;
  date: Date;
  category: string;
  expenseCategoryId?: string;
  description?: string;
  userId: string;
  siteId?: string;
  mixRadiusGroupId?: string;
  rabProjectId?: string;
  rabItemId?: string;
  invoiceNumber?: string;
  invoiceFile?: string;
  accountId?: string;
}

export class ExpenseRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findManyWithRelations(
    where: Prisma.ExpenseWhereInput,
  ): Promise<ExpenseWithRelations[]> {
    return this.client.expense.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      include: {
        user: { select: { name: true } },
        site: { select: { name: true } },
        expenseCategory: { select: { id: true, name: true, type: true } },
        rabProject: { select: { id: true, name: true } },
        rabItem: { select: { id: true, name: true } },
      },
    }) as Promise<ExpenseWithRelations[]>;
  }

  async createExpense(data: ExpenseCreateInput): Promise<Expense> {
    return this.client.expense.create({
      data: {
        id: data.id,
        amount: data.amount,
        depreciation: data.depreciation,
        usefulLife: data.usefulLife,
        date: data.date,
        category: data.category,
        ...(data.expenseCategoryId
          ? { expenseCategory: { connect: { id: data.expenseCategoryId } } }
          : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        user: { connect: { id: data.userId } },
        updatedAt: new Date(),
        ...(data.siteId ? { site: { connect: { id: data.siteId } } } : {}),
        ...(data.mixRadiusGroupId
          ? { mixRadiusGroupId: data.mixRadiusGroupId }
          : {}),
        ...(data.rabProjectId
          ? { rabProject: { connect: { id: data.rabProjectId } } }
          : {}),
        ...(data.rabItemId
          ? { rabItem: { connect: { id: data.rabItemId } } }
          : {}),
        ...(data.invoiceNumber ? { invoiceNumber: data.invoiceNumber } : {}),
        ...(data.invoiceFile ? { invoiceFile: data.invoiceFile } : {}),
        ...(data.accountId
          ? { financialAccount: { connect: { id: data.accountId } } }
          : {}),
      },
    });
  }

  async findManyByInvoiceNumber(invoiceNumber: string): Promise<Expense[]> {
    return this.client.expense.findMany({ where: { invoiceNumber } });
  }

  async createDepreciationExpense(data: {
    amount: bigint;
    date: Date;
    expenseCategoryId: string;
    category: string;
    description: string;
    userId: string;
  }): Promise<Expense> {
    return this.client.expense.create({
      data: {
        id: crypto.randomUUID(),
        amount: data.amount,
        depreciation: data.amount,
        usefulLife: 0,
        date: data.date,
        category: data.category,
        expenseCategory: { connect: { id: data.expenseCategoryId } },
        description: data.description,
        user: { connect: { id: data.userId } },
        updatedAt: new Date(),
      },
    });
  }

  async createInTx(
    tx: PrismaClient,
    data: {
      category: string;
      amount: number;
      date: Date;
      description?: string;
      invoiceNumber?: string;
    },
  ): Promise<Expense> {
    return tx.expense.create({ data });
  }
}
