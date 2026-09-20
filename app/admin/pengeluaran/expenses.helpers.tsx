import type { ComboboxOption } from "@/components/ui/Combobox";
import type {
  CategoryOption,
  ExpenseItem,
  ExpenseFormItem,
  ExpensesFormState,
} from "./expenses.types";

const DEFAULT_EXPENSE_CATEGORY = "OPEX";
const DEFAULT_USEFUL_LIFE = 0;
const DEFAULT_DEPRECIATION = "";

/** Menghasilkan nilai default item form pengeluaran baru. */
export function createDefaultExpenseItem(): ExpenseFormItem {
  return {
    amount: "",
    description: "",
    rabProjectId: "",
    rabItemId: "",
    category: DEFAULT_EXPENSE_CATEGORY,
    expenseCategoryId: "",
    isUsefulLifeEnabled: false,
    usefulLife: DEFAULT_USEFUL_LIFE,
    depreciation: DEFAULT_DEPRECIATION,
  };
}

/** Menghasilkan nilai default form pengeluaran baru. */
export function createDefaultExpenseFormData(): ExpensesFormState {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");

  return {
    date: `${year}-${month}-${day}`,
    category: DEFAULT_EXPENSE_CATEGORY,
    siteId: "",
    accountId: "",
    invoiceNumber: "",
    invoiceFile: "",
  };
}

/** Membuat key idempotency untuk request create expense. */
export function buildExpenseIdempotencyKey(scope: "single" | "batch") {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `expenses-${scope}-${Date.now()}-${randomPart}`;
}

/** Mengubah expense untuk mode edit menjadi state form. */
export function mapExpenseToFormState(item: ExpenseItem) {
  return {
    formData: {
      date: new Date(item.date).toISOString().split("T")[0],
      category: item.category,
      siteId: item.siteId || "",
      accountId: item.accountId || "",
      invoiceNumber: item.invoiceNumber || "",
      invoiceFile: item.invoiceFile || "",
    },
    items: [
      {
        id: item.id,
        amount: item.amount.toString(),
        description: item.description || "",
        rabProjectId: item.rabProject?.id || "",
        rabItemId: item.rabItem?.id || "",
        category: item.category,
        expenseCategoryId: item.expenseCategoryId || "",
        isUsefulLifeEnabled: (item.usefulLife || 0) > 0,
        usefulLife: item.usefulLife || 0,
        depreciation: item.depreciation ? item.depreciation.toString() : "",
      },
    ],
  };
}

/** Menghasilkan opsi kategori bertingkat untuk combobox. */
export function buildHierarchicalCategoryOptions(
  categories: CategoryOption[],
): ComboboxOption[] {
  if (!categories.length) return [];

  const roots = categories.filter((category) => !category.parentId);
  const childrenMap = new Map<string, CategoryOption[]>();

  categories.forEach((category) => {
    if (!category.parentId) return;
    const items = childrenMap.get(category.parentId) || [];
    items.push(category);
    childrenMap.set(category.parentId, items);
  });

  const result: ComboboxOption[] = [];
  const flattenCategories = (items: CategoryOption[], depth: number) => {
    items.forEach((category) => {
      const children = childrenMap.get(category.id) || [];
      const indent = depth > 0 ? " ".repeat(depth) : "";
      const prefix = depth > 0 ? "└ " : "";
      const hasChildren = children.length > 0;

      result.push({
        value: category.id,
        label: (
          <span
            className={`flex items-center gap-1 ${hasChildren && depth === 0 ? "font-semibold text-gray-700 dark:text-gray-200" : ""}`}
          >
            <span className="text-gray-400">
              {indent}
              {prefix}
            </span>
            <span>{category.name}</span>
            {hasChildren && (
              <span className="ml-1 text-[10px] text-gray-400">
                ({children.length})
              </span>
            )}
          </span>
        ),
        searchLabel: category.name,
      });

      if (!hasChildren) return;
      flattenCategories(
        children.sort((left, right) => left.name.localeCompare(right.name)),
        depth + 1,
      );
    });
  };

  flattenCategories(
    roots.sort((left, right) => left.name.localeCompare(right.name)),
    0,
  );
  return result;
}

/** Memfilter opsi kategori berdasarkan tipe expense. */
export function filterCategoryOptionsByType(
  options: ComboboxOption[],
  categories: CategoryOption[],
  type: "CAPEX" | "OPEX",
) {
  return options.filter((option) => {
    const category = categories.find((item) => item.id === option.value);
    return category?.type === type;
  });
}
