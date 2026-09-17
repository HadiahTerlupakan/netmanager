export interface ExpenseFormItem {
  id?: string;
  amount: string;
  description: string;
  rabProjectId: string;
  rabItemId: string;
  category?: string;
  expenseCategoryId: string;
  isUsefulLifeEnabled: boolean;
  usefulLife: number;
  depreciation: string;
}

export interface ExpenseItem {
  id: string;
  date: string;
  amount: string;
  category: string;
  expenseCategoryId?: string;
  expenseCategory?: {
    id: string;
    name: string;
    type: string;
  };
  categoryId?: string;
  transactionCategory?: {
    id: string;
    name: string;
  };
  accountId?: string;
  financialAccount?: {
    id: string;
    name: string;
    balance: number;
  };
  depreciation?: string;
  usefulLife?: number;
  description?: string;
  siteId?: string;
  invoiceNumber?: string;
  invoiceFile?: string;
  site?: {
    id: string;
    name: string;
  };
  user?: {
    name: string;
  };
  rabProject?: {
    id: string;
    name: string;
  };
  rabItem?: {
    id: string;
    name: string;
  };
}

export interface SiteOption {
  id: string;
  name: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  _count?: { children: number };
}

export interface RabBottleneckMetrics {
  pendingApprovalCount: number;
  oldestPendingDays: number;
  oldestPendingProjectName: string | null;
  averageApprovalLeadHours: number;
}

export interface ExpensesFormState {
  date: string;
  category: string;
  siteId: string;
  invoiceNumber: string;
  invoiceFile: string;
}
