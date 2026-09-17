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
  rabProjectId?: string;
  rabItemId?: string;
  invoiceNumber?: string;
  invoiceFile?: string;
  accountId?: string;
}

export class ExpenseRepository {
  constructor(private client: PrismaClient = prisma) {}

  /** Get expenses with common route relations. */
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

  /** Create an expense record. */
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

  /** Find expenses by invoice number. */
  async findManyByInvoiceNumber(invoiceNumber: string): Promise<Expense[]> {
    return this.client.expense.findMany({ where: { invoiceNumber } });
  }

  /** Create a depreciation expense entry. */
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

  /** Create an expense inside an existing transaction. */
  /** Create many expenses in a single transaction. */
  async createManyExpenses(entries: ExpenseCreateInput[]) {
    return this.client.$transaction(
      entries.map((entry) =>
        this.client.expense.create({
          data: {
            id: entry.id,
            amount: entry.amount,
            depreciation: entry.depreciation,
            usefulLife: entry.usefulLife,
            date: entry.date,
            category: entry.category,
            ...(entry.expenseCategoryId
              ? {
                  expenseCategory: { connect: { id: entry.expenseCategoryId } },
                }
              : {}),
            ...(entry.description !== undefined
              ? { description: entry.description }
              : {}),
            user: { connect: { id: entry.userId } },
            updatedAt: new Date(),
            ...(entry.siteId
              ? { site: { connect: { id: entry.siteId } } }
              : {}),
            ...(entry.rabProjectId
              ? { rabProject: { connect: { id: entry.rabProjectId } } }
              : {}),
            ...(entry.rabItemId
              ? { rabItem: { connect: { id: entry.rabItemId } } }
              : {}),
            ...(entry.invoiceNumber
              ? { invoiceNumber: entry.invoiceNumber }
              : {}),
            ...(entry.invoiceFile ? { invoiceFile: entry.invoiceFile } : {}),
            ...(entry.accountId
              ? { financialAccount: { connect: { id: entry.accountId } } }
              : {}),
          },
        }),
      ),
    );
  }

  /** Find user site restriction context. */
  async findUserSiteContext(userId: string) {
    return this.client.user.findUnique({
      where: { id: userId },
      select: { siteId: true },
    });
  }

  /** Find a single expense with route relations. */
  async findExpenseById(id: string) {
    return this.client.expense.findUnique({
      where: { id },
      include: {
        user: { select: { name: true } },
        expenseCategory: { select: { id: true, name: true, type: true } },
      },
    });
  }

  /** Update an expense with route relations. */
  async updateExpense(
    where: Prisma.ExpenseWhereUniqueInput,
    data: Prisma.ExpenseUpdateInput,
  ) {
    return this.client.expense.update({
      where,
      data,
      include: {
        user: { select: { name: true } },
        expenseCategory: { select: { id: true, name: true, type: true } },
      },
    });
  }

  /** Delete an expense by constrained identifier. */
  async deleteExpense(where: Prisma.ExpenseWhereUniqueInput) {
    return this.client.expense.delete({ where });
  }

  /** Find expense realizations for a RAB project. */
  async findProjectExpenses(projectId: string) {
    return this.client.expense.findMany({
      where: { rabProjectId: projectId },
      select: {
        id: true,
        amount: true,
        category: true,
        rabItemId: true,
        description: true,
        rabItem: {
          select: {
            id: true,
            expenseType: true,
          },
        },
      },
    });
  }

  /** Create an expense inside an existing transaction. */
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
