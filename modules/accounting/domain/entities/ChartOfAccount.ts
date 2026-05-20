export type COAType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

export type COASubtype =
  | "CURRENT_ASSET"
  | "FIXED_ASSET"
  | "CURRENT_LIABILITY"
  | "LONG_TERM_LIABILITY"
  | "CONTRIBUTED_CAPITAL"
  | "RETAINED_EARNINGS"
  | "OPERATING_REVENUE"
  | "OTHER_REVENUE"
  | "COGS"
  | "OPEX"
  | "OTHER_EXPENSE";

export type DebitCredit = "DEBIT" | "CREDIT";
export type CashFlowCategory = "OPERATING" | "INVESTING" | "FINANCING";

export interface ChartOfAccount {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: COAType;
  subtype: COASubtype | null;
  normalSide: DebitCredit;
  cashFlowCategory: CashFlowCategory | null;
  parentId: string | null;
  isPostable: boolean;
  isSystem: boolean;
  isActive: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function normalSideForType(type: COAType): DebitCredit {
  return type === "ASSET" || type === "EXPENSE" ? "DEBIT" : "CREDIT";
}
