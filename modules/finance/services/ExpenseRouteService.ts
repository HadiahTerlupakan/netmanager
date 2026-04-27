import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";

import { ExpenseRepository } from "../repositories/ExpenseRepository";
import {
  createRouteServiceError,
  RouteServiceError,
} from "./RouteServiceError";

const ZERO_DEPRECIATION = 0n;
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
  mixRadiusGroupId?: string;
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
  mixRadiusGroupId?: string;
  categoryId?: string;
  accountId?: string;
  rabProjectId?: string;
  rabItemId?: string;
  invoiceNumber?: string;
  invoiceFile?: string;
};

export class ExpenseRouteService {
  constructor(private readonly expenseRepository = new ExpenseRepository()) {}

  /** Resolve effective site restriction for expense mutation. */
  async resolveRestrictedSiteId(userId: string) {
    const user = await this.expenseRepository.findUserSiteContext(userId);
    const userSiteId = user?.siteId;

    if (!userSiteId) {
      throw createRouteServiceError(
        "Akses terbatas: Site tidak ditemukan di profil anda",
        403,
      );
    }

    return userSiteId;
  }

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
      mixRadiusGroupId: input.mixRadiusGroupId,
      rabProjectId: item.rabProjectId,
      rabItemId: item.rabItemId,
      invoiceNumber: input.invoiceNumber,
      invoiceFile: input.invoiceFile,
    }));

    const expenses = await this.expenseRepository.createManyExpenses(entries);
    return expenses.map(this.serializeExpense);
  }

  /** Update an expense with optional site restriction. */
  async updateExpense(
    id: string,
    input: ExpenseUpdateInput,
    options: {
      isSiteRestricted: boolean;
      userSiteId?: string;
    },
  ) {
    const where = this.buildExpenseWhere(id, options.userSiteId);
    const data = this.buildExpenseUpdateData(input, options);

    try {
      const expense = await this.expenseRepository.updateExpense(where, data);
      return this.serializeExpense(expense);
    } catch (error) {
      this.rethrowNotFound(error);
      throw error;
    }
  }

  /** Delete an expense with optional site restriction. */
  async deleteExpense(id: string, userSiteId?: string) {
    const where = this.buildExpenseWhere(id, userSiteId);
    const expense = await this.expenseRepository.findExpenseById(id);

    if (!expense || !this.canAccessExpense(expense.siteId, userSiteId)) {
      throw createRouteServiceError(
        "Pengeluaran tidak ditemukan atau anda tidak memiliki akses",
        404,
      );
    }

    const deletedExpense = await this.expenseRepository.deleteExpense(where);
    return this.serializeExpense(deletedExpense);
  }

  private buildExpenseWhere(id: string, userSiteId?: string) {
    const where: Prisma.ExpenseWhereUniqueInput = { id };

    if (userSiteId) {
      where.siteId = userSiteId;
    }

    return where;
  }

  private buildExpenseUpdateData(
    input: ExpenseUpdateInput,
    options: { isSiteRestricted: boolean; userSiteId?: string },
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
      ...(input.mixRadiusGroupId !== undefined
        ? { mixRadiusGroupId: input.mixRadiusGroupId || null }
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

    if (options.isSiteRestricted) {
      data.site = options.userSiteId
        ? { connect: { id: options.userSiteId } }
        : undefined;
      return data;
    }

    if (input.siteId !== undefined) {
      data.site = input.siteId
        ? { connect: { id: input.siteId } }
        : { disconnect: true };
    }

    return data;
  }

  private canAccessExpense(siteId: string | null, userSiteId?: string) {
    if (!userSiteId) {
      return true;
    }

    return siteId === userSiteId;
  }

  private rethrowNotFound(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new RouteServiceError(
        "Pengeluaran tidak ditemukan atau anda tidak memiliki akses",
        404,
      );
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
