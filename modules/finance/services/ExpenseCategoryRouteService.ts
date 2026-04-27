import { logActivitySafe } from "@/lib/logger";

import { ExpenseCategoryRepository } from "../repositories/ExpenseCategoryRepository";
import { createRouteServiceError } from "./RouteServiceError";

export class ExpenseCategoryRouteService {
  constructor(
    private readonly categoryRepository = new ExpenseCategoryRepository(),
  ) {}

  /** Update an expense category after route validation. */
  async updateCategory(input: {
    id: string;
    name: string;
    type: string;
    parentId: string | null;
    userId: string;
  }) {
    const category = await this.categoryRepository.updateCategory(input.id, {
      name: input.name,
      type: input.type,
      parentId: input.parentId,
    });

    logActivitySafe({
      action: "UPDATE",
      subject: "ExpenseCategory",
      details: {
        id: category.id,
        name: category.name,
        type: category.type,
        parentId: input.parentId,
      },
      userId: input.userId,
    });

    return category;
  }

  /** Delete an expense category when it is not in use. */
  async deleteCategory(id: string, userId: string) {
    const category = await this.categoryRepository.findByIdWithExpenseCount(id);

    if (!category) {
      throw createRouteServiceError("Kategori pengeluaran", 404);
    }

    if (category._count.expenses > 0) {
      throw createRouteServiceError(
        "Tidak bisa dihapus. Kategori ini sedang digunakan oleh data pengeluaran.",
        400,
      );
    }

    await this.categoryRepository.deleteCategory(id);
    logActivitySafe({
      action: "DELETE",
      subject: "ExpenseCategory",
      details: { id },
      userId,
    });
  }
}
