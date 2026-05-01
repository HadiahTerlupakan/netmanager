import { randomUUID } from "crypto";
import { Prisma } from "../repositories/prisma-boundary";
import { ExpenseCategoryRepository, ExpenseRepository } from "../repositories";

type ExpenseRepo = Pick<
  ExpenseRepository,
  "findManyWithRelations" | "createExpense"
>;
type ExpenseCategoryRepo = Pick<
  ExpenseCategoryRepository,
  "findManyWithStats" | "findFirstDuplicate" | "createCategory"
>;

export class FinanceExpenseFacadeService {
  constructor(
    private readonly expenseRepo: ExpenseRepo = new ExpenseRepository(),
    private readonly expenseCategoryRepo: ExpenseCategoryRepo = new ExpenseCategoryRepository(),
  ) {}

  /** Get expenses with filtering and BigInt serialization. */
  async getExpenses(params: {
    startDate?: Date;
    endDate?: Date;
    siteId?: string | null;
    mixRadiusGroupId?: string | null;
    category?: string | null;
    expenseCategoryId?: string | null;
    scope?: string | null;
    restrictedSiteId?: string | null;
  }) {
    const where = this.buildExpenseWhere(params);
    const expenses = await this.expenseRepo.findManyWithRelations(where);

    return expenses.map((expense) => ({
      ...expense,
      amount: expense.amount.toString(),
      depreciation: expense.depreciation
        ? expense.depreciation.toString()
        : "0",
      usefulLife: expense.usefulLife || 0,
    }));
  }

  /** Create a new expense record. */
  async createExpense(
    data: {
      amount: bigint;
      depreciation?: bigint;
      usefulLife?: number;
      date: Date;
      category: string;
      expenseCategoryId?: string;
      description?: string;
      siteId?: string;
      mixRadiusGroupId?: string;
      rabProjectId?: string;
      rabItemId?: string;
      invoiceNumber?: string;
      invoiceFile?: string;
      accountId?: string;
    },
    userId: string,
  ) {
    const expense = await this.expenseRepo.createExpense({
      id: randomUUID(),
      amount: data.amount,
      depreciation: data.depreciation || BigInt(0),
      usefulLife: data.usefulLife || 0,
      date: data.date,
      category: data.category,
      expenseCategoryId: data.expenseCategoryId,
      description: data.description,
      userId,
      siteId: data.siteId,
      mixRadiusGroupId: data.mixRadiusGroupId,
      rabProjectId: data.rabProjectId,
      rabItemId: data.rabItemId,
      invoiceNumber: data.invoiceNumber,
      invoiceFile: data.invoiceFile,
      accountId: data.accountId,
    });

    return {
      ...expense,
      amount: expense.amount.toString(),
      depreciation: expense.depreciation
        ? expense.depreciation.toString()
        : "0",
      usefulLife: expense.usefulLife || 0,
    };
  }

  /** Get expense categories with statistics. */
  async getExpenseCategories(params?: {
    type?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: { type?: string } = {};
    if (params?.type) where.type = params.type;

    const expenseWhere: { date?: { gte: Date; lte: Date } } = {};
    if (params?.startDate && params?.endDate) {
      expenseWhere.date = { gte: params.startDate, lte: params.endDate };
    }

    return this.expenseCategoryRepo.findManyWithStats(where, expenseWhere);
  }

  /** Create a new expense category. */
  async createExpenseCategory(data: {
    name: string;
    type: string;
    parentId?: string | null;
  }) {
    const existing = await this.expenseCategoryRepo.findFirstDuplicate(
      data.name,
      data.type,
      data.parentId || null,
    );
    if (existing)
      throw new Error(`Kategori "${data.name}" sudah ada di level ini.`);

    return this.expenseCategoryRepo.createCategory({
      name: data.name,
      type: data.type,
      parentId: data.parentId ?? undefined,
    });
  }

  private buildExpenseWhere(params: {
    startDate?: Date;
    endDate?: Date;
    siteId?: string | null;
    mixRadiusGroupId?: string | null;
    category?: string | null;
    expenseCategoryId?: string | null;
    scope?: string | null;
    restrictedSiteId?: string | null;
  }): Prisma.ExpenseWhereInput {
    const where: Prisma.ExpenseWhereInput = {};
    if (params.startDate && params.endDate) {
      where.date = { gte: params.startDate, lte: params.endDate };
    }
    if (params.category) where.category = params.category;
    if (params.expenseCategoryId)
      where.expenseCategoryId = params.expenseCategoryId;

    this.applyExpenseScope(where, params);
    return where;
  }

  private applyExpenseScope(
    where: Prisma.ExpenseWhereInput,
    params: {
      restrictedSiteId?: string | null;
      scope?: string | null;
      mixRadiusGroupId?: string | null;
      siteId?: string | null;
    },
  ) {
    if (params.restrictedSiteId) {
      where.siteId = params.restrictedSiteId;
      return;
    }
    if (params.scope === "general") {
      where.siteId = null;
      where.mixRadiusGroupId = null;
      return;
    }
    if (params.mixRadiusGroupId)
      where.mixRadiusGroupId = params.mixRadiusGroupId;
    if (!params.mixRadiusGroupId && params.siteId) where.siteId = params.siteId;
  }
}
