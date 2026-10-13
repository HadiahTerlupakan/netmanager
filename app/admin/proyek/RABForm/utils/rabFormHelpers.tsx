import type { ComboboxOption } from "@/components/ui/Combobox";
import type { RABOpexBufferFundingMode } from "../../rabTypes";

export interface InvestorOption {
  id: string;
  namaLengkap: string;
}

export interface Category {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  code?: string;
}

export function shouldShowOpexBufferSafety(mode: RABOpexBufferFundingMode) {
  return mode === "SHARED_PERCENTAGE" || mode === "FIXED";
}

export function getDefaultOpexBufferShares(mode: RABOpexBufferFundingMode) {
  if (mode === "COMPANY") {
    return { investorPercent: 0, companyPercent: 100 };
  }

  if (mode === "SHARED_PERCENTAGE") {
    return { investorPercent: 50, companyPercent: 50 };
  }

  return { investorPercent: 100, companyPercent: 0 };
}

export function isInvestorOption(value: unknown): value is InvestorOption {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as InvestorOption).id === "string" &&
    typeof (value as InvestorOption).namaLengkap === "string"
  );
}

export function normalizeInvestorListResponse(
  response: unknown,
): InvestorOption[] {
  const payload =
    response && typeof response === "object" && "data" in response
      ? (response as { data: unknown }).data
      : response;

  return Array.isArray(payload) ? payload.filter(isInvestorOption) : [];
}

export function buildHierarchicalOptions(
  categories: Category[],
  expenseType: string,
): ComboboxOption[] {
  const filtered = categories.filter((c) => c.type === expenseType);
  const options: ComboboxOption[] = [];

  const addCategoryAndChildren = (parentId: string | null, depth: number) => {
    const children = filtered.filter((c) => c.parentId === parentId);

    children.forEach((child) => {
      const hasChildren = filtered.some((c) => c.parentId === child.id);

      if (hasChildren) {
        options.push({
          value: `__header__${child.id}`,
          label: (
            <span
              className={`flex items-center gap-1.5 text-gray-500 dark:text-gray-400 ${depth === 0 ? "text-xs font-bold uppercase tracking-wider mt-1" : "text-sm font-semibold"}`}
              style={{ paddingLeft: `${depth * 1}rem` }}
            >
              {depth > 0 && (
                <span className="text-gray-300 dark:text-gray-600 text-xs">
                  —
                </span>
              )}
              📁 {child.code ? `[${child.code}] ` : ""}
              {child.name}
            </span>
          ),
          searchLabel: child.name,
          disabled: true,
        });
      } else {
        options.push({
          value: child.id,
          label: (
            <span
              className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200"
              style={{ paddingLeft: `${depth * 1}rem` }}
            >
              {depth > 0 && (
                <span className="text-gray-300 dark:text-gray-600 text-xs">
                  —
                </span>
              )}
              📄 {child.code ? `[${child.code}] ` : ""}
              {child.name}
            </span>
          ),
          searchLabel: child.name,
          disabled: false,
        });
      }

      if (hasChildren) {
        addCategoryAndChildren(child.id, depth + 1);
      }
    });
  };

  addCategoryAndChildren(null, 0);

  return options;
}

export const DEFAULT_OPEX_BUFFER_SETTINGS = {
  opexBufferFundingMode: "INVESTOR" as RABOpexBufferFundingMode,
  opexBufferInvestorPercent: 100,
  opexBufferCompanyPercent: 0,
  opexBufferInvestorFixedAmount: 0,
  opexBufferSafetyPercent: 0,
};
