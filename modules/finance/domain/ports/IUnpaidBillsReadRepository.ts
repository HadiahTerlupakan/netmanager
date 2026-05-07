export type UnpaidBillsAccount = {
  id: string;
  accountNumber: string | null;
  name: string;
  type:
    | "ASSET"
    | "LIABILITY"
    | "EQUITY"
    | "REVENUE"
    | "EXPENSE"
    | "BANK"
    | "CASH"
    | "EWALLET"
    | "OTHER";
  balance: number;
  parentAccountId?: string | null;
  isActive?: boolean;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UnpaidPurchaseOrderWithTransactions = {
  id: string;
  poNumber: string;
  totalAmount: number;
  ppnAmount: number;
  ppnRate: number;
  grandTotal: number;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  createdAt: string | Date;
  supplier?: {
    name: string;
  } | null;
  transactions: Array<{
    amount: number;
  }>;
};

/** Repository port for unpaid bills page queries. */
export interface IUnpaidBillsReadRepository {
  findUnpaidBillsPageData(): Promise<{
    unpaidPos: UnpaidPurchaseOrderWithTransactions[];
    accounts: UnpaidBillsAccount[];
  }>;
}
