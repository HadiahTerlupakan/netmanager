import { randomUUID } from "crypto";
import {
  publishExpenseRecorded,
  resyncExpenseBooks,
} from "./expense-journal-events";
import { Prisma } from "../repositories/prisma-boundary";

import { ExpenseRepository } from "../repositories/ExpenseRepository";
import {
  createRouteServiceError,
  RouteServiceError,
} from "./RouteServiceError";
import {
  assertExpenseScopeHasSite,
  resolveExpenseTargetSiteId,
} from "./expense-site-scope";
import {
  TANPA_BATAS,
  filterSitePrisma,
  siteBolehDiakses,
  type LingkupSite,
} from "@/modules/roles/client";

const ZERO_DEPRECIATION = 0n;
const HTTP_NOT_FOUND = 404;
const EXPENSE_NOT_FOUND_MESSAGE =
  "Pengeluaran tidak ditemukan atau anda tidak memiliki akses";
const ZERO_USEFUL_LIFE = 0;

type BatchExpenseItemInput = {
  amount: bigint;
  category: string;
  expenseCategoryId?: string;
  depreciation?: bigint;
  usefulLife?: number;
  description?: string;
  rabProjectId?: string;
  rabItemId?: string;
};

type BatchExpenseInput = {
  date: Date;
  siteId?: string;
  /** Akun kas/bank sumber dana; menentukan apakah jurnal otomatis terbentuk. */
  accountId?: string;
  invoiceNumber?: string;
  invoiceFile?: string;
  items: BatchExpenseItemInput[];
};

type ExpenseUpdateInput = {
  amount: bigint;
  date: Date;
  category: string;
  expenseCategoryId?: string;
  description?: string;
  siteId?: string;
  categoryId?: string;
  accountId?: string;
  rabProjectId?: string;
  rabItemId?: string;
  invoiceNumber?: string;
  invoiceFile?: string;
};

export class ExpenseRouteService {
  constructor(private readonly expenseRepository = new ExpenseRepository()) {}

  /** Create many expenses for batch route handling. */
  async createBatchExpenses(input: BatchExpenseInput, userId: string) {
    const entries = input.items.map((item) => ({
      id: randomUUID(),
      amount: item.amount,
      depreciation: item.depreciation ?? ZERO_DEPRECIATION,
      usefulLife: item.usefulLife ?? ZERO_USEFUL_LIFE,
      date: input.date,
      category: item.category,
      expenseCategoryId: item.expenseCategoryId,
      description: item.description,
      userId,
      siteId: input.siteId,
      rabProjectId: item.rabProjectId,
      rabItemId: item.rabItemId,
      invoiceNumber: input.invoiceNumber,
      invoiceFile: input.invoiceFile,
      accountId: input.accountId,
    }));

    const expenses = await this.expenseRepository.createManyExpenses(entries);

    for (const expense of expenses) {
      publishExpenseRecorded(expense);
    }

    return expenses.map(this.serializeExpense);
  }

  /**
   * Update an expense within the caller's site scope. Pengeluaran di luar
   * lingkup dijawab 404; site tujuan pengguna terbatas wajib di lingkupnya.
   */
  async updateExpense(
    id: string,
    input: ExpenseUpdateInput,
    siteScope: LingkupSite = TANPA_BATAS,
  ) {
    const targetSiteId = resolveExpenseTargetSiteId(siteScope, input.siteId);
    const where = this.buildExpenseWhere(id, siteScope);
    const data = this.buildExpenseUpdateData(input, targetSiteId);

    try {
      const expense = await this.expenseRepository.updateExpense(where, data);
      await resyncExpenseBooks({
        tenantId: expense.tenantId,
        expenseId: expense.id,
        reason: "Pengeluaran diubah",
      });
      return this.serializeExpense(expense);
    } catch (error) {
      this.rethrowNotFound(error);
      throw error;
    }
  }

  /** Delete an expense within the caller's site scope (404 di luar lingkup). */
  async deleteExpense(id: string, siteScope: LingkupSite = TANPA_BATAS) {
    assertExpenseScopeHasSite(siteScope);
    const where = this.buildExpenseWhere(id, siteScope);
    const expense = await this.expenseRepository.findExpenseById(id);

    if (!expense || !siteBolehDiakses(siteScope, expense.siteId)) {
      throw createRouteServiceError(EXPENSE_NOT_FOUND_MESSAGE, HTTP_NOT_FOUND);
    }

    const deletedExpense = await this.expenseRepository.deleteExpense(where);
    await resyncExpenseBooks({
      tenantId: deletedExpense.tenantId,
      expenseId: deletedExpense.id,
      reason: "Pengeluaran dihapus",
    });
    return this.serializeExpense(deletedExpense);
  }

  private buildExpenseWhere(
    id: string,
    siteScope: LingkupSite,
  ): Prisma.ExpenseWhereUniqueInput {
    const siteFilter = filterSitePrisma(siteScope);
    return siteFilter ? { id, siteId: siteFilter } : { id };
  }

  private buildExpenseUpdateData(
    input: ExpenseUpdateInput,
    targetSiteId: string | undefined,
  ): Prisma.ExpenseUpdateInput {
    const data: Prisma.ExpenseUpdateInput = {
      amount: input.amount,
      date: input.date,
      category: input.category,
      ...(input.expenseCategoryId !== undefined
        ? {
            expenseCategory: input.expenseCategoryId
              ? { connect: { id: input.expenseCategoryId } }
              : { disconnect: true },
          }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.categoryId !== undefined
        ? { categoryId: input.categoryId || null }
        : {}),
      ...(input.accountId !== undefined
        ? {
            financialAccount: input.accountId
              ? { connect: { id: input.accountId } }
              : { disconnect: true },
          }
        : {}),
      ...(input.rabProjectId !== undefined
        ? {
            rabProject: input.rabProjectId
              ? { connect: { id: input.rabProjectId } }
              : { disconnect: true },
          }
        : {}),
      ...(input.rabItemId !== undefined
        ? {
            rabItem: input.rabItemId
              ? { connect: { id: input.rabItemId } }
              : { disconnect: true },
          }
        : {}),
      ...(input.invoiceNumber !== undefined
        ? { invoiceNumber: input.invoiceNumber || null }
        : {}),
      ...(input.invoiceFile !== undefined
        ? { invoiceFile: input.invoiceFile || null }
        : {}),
    };

    if (targetSiteId !== undefined) {
      data.site = targetSiteId
        ? { connect: { id: targetSiteId } }
        : { disconnect: true };
    }

    return data;
  }

  private rethrowNotFound(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new RouteServiceError(EXPENSE_NOT_FOUND_MESSAGE, HTTP_NOT_FOUND);
    }
  }

  private serializeExpense(
    expense: {
      amount: bigint;
      depreciation?: bigint | null;
      usefulLife?: number | null;
    } & Record<string, unknown>,
  ) {
    return {
      ...expense,
      amount: expense.amount.toString(),
      depreciation: expense.depreciation?.toString() || "0",
      usefulLife: expense.usefulLife || 0,
    };
  }
}
