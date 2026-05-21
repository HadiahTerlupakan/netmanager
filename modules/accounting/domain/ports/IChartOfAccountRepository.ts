import type { ChartOfAccount, COAType } from "../entities/ChartOfAccount";

export interface CoaCreateInput {
  tenantId: string;
  code: string;
  name: string;
  type: COAType;
  subtype?: ChartOfAccount["subtype"];
  normalSide: ChartOfAccount["normalSide"];
  cashFlowCategory?: ChartOfAccount["cashFlowCategory"];
  parentId?: string | null;
  isPostable?: boolean;
  isSystem?: boolean;
  description?: string | null;
}

export interface CoaUpdateInput {
  name?: string;
  subtype?: ChartOfAccount["subtype"];
  cashFlowCategory?: ChartOfAccount["cashFlowCategory"];
  parentId?: string | null;
  isActive?: boolean;
  description?: string | null;
}

export interface AccountBalanceRow {
  coaId: string;
  side: "DEBIT" | "CREDIT";
  total: number;
}

export interface IChartOfAccountRepository {
  create(input: CoaCreateInput): Promise<ChartOfAccount>;
  update(id: string, input: CoaUpdateInput): Promise<ChartOfAccount>;
  findById(id: string): Promise<ChartOfAccount | null>;
  findByCode(tenantId: string, code: string): Promise<ChartOfAccount | null>;
  list(
    tenantId: string,
    filter?: { type?: COAType; isActive?: boolean },
  ): Promise<ChartOfAccount[]>;
  delete(id: string): Promise<void>;
  deleteSystemAccounts(tenantId: string): Promise<void>;
  countChildren(parentId: string): Promise<number>;
  countLines(coaId: string): Promise<number>;
  getAccountBalances(
    tenantId: string,
    coaIds: string[],
  ): Promise<AccountBalanceRow[]>;
}
