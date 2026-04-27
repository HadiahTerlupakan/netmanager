import { prisma } from "@/lib/prisma";
import type { PrismaClient, ExpenseCategory } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export interface ExpenseCategoryWithStats extends ExpenseCategory {
  parent?: { name: string } | null;
  _count?: { children: number };
  totalDirect: number;
}

export class ExpenseCategoryRepository {
  constructor(private client: PrismaClient = prisma) {}

  /** Get expense categories with aggregated usage stats. */
  async findManyWithStats(
    where: { type?: string },
    expenseWhere: { date?: { gte: Date; lte: Date } },
  ): Promise<ExpenseCategoryWithStats[]> {
    const categories = await this.client.expenseCategory.findMany({
      where,
      include: {
        parent: { select: { name: true } },
        _count: { select: { children: true } },
        expenses: { where: expenseWhere, select: { amount: true } },
      },
      orderBy: { name: "asc" },
    });

    return categories.map((cat) => {
      const { expenses, ...rest } = cat;
      return {
        ...rest,
        totalDirect: expenses.reduce((sum, e) => sum + Number(e.amount), 0),
      };
    });
  }

  /** Find duplicate category by case-insensitive name and level. */
  async findFirstDuplicate(
    name: string,
    type: string,
    parentId: string | null,
  ): Promise<ExpenseCategory | null> {
    return this.client.expenseCategory.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        type,
        parentId: parentId || null,
      },
    });
  }

  /** Create a new expense category. */
  async createCategory(data: {
    name: string;
    type: string;
    parentId?: string;
  }): Promise<ExpenseCategory> {
    return this.client.expenseCategory.create({
      data: {
        name: data.name,
        type: data.type,
        ...(data.parentId ? { parentId: data.parentId } : {}),
      },
    });
  }

  /** Find one category by arbitrary filter. */
  async findFirst(
    where: Prisma.ExpenseCategoryWhereInput,
  ): Promise<ExpenseCategory | null> {
    return this.client.expenseCategory.findFirst({ where });
  }

  /** Find a category detail with expense usage count. */
  async findByIdWithExpenseCount(id: string) {
    return this.client.expenseCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { expenses: true } },
      },
    });
  }

  /** Update an expense category. */
  async updateCategory(
    id: string,
    data: {
      name: string;
      type: string;
      parentId: string | null;
    },
  ) {
    return this.client.expenseCategory.update({
      where: { id },
      data,
    });
  }

  /** Delete an expense category by id. */
  async deleteCategory(id: string) {
    return this.client.expenseCategory.delete({
      where: { id },
    });
  }
}
