/**
 * Finance-related types untuk accounting, invoicing, dan payment
 */

import type { Timestamps } from "./common";

// Account types
export interface Account extends Timestamps {
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
  parentAccountId?: string;
  isActive?: boolean;
  description?: string | null;
  /**
   * COA pasangan jurnal untuk akun kas/bank. Handler akuntansi menurunkan sisi
   * kredit dari tautan ini; selama kosong, transaksi akun ini tidak pernah
   * menghasilkan jurnal sehingga Laporan Arus Kas tetap nol.
   */
  coaId?: string | null;
}

// Transaction Category
export interface Category extends Timestamps {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  expenseType?: string | null;
  isSystem?: boolean;
  description?: string | null;
  isActive?: boolean;
}

// Invoice types
export type InvoiceStatus =
  | "DRAFT"
  | "SENT"
  | "PAID"
  | "PARTIAL"
  | "OVERDUE"
  | "CANCELLED";

export interface Invoice extends Timestamps {
  id: string;
  invoiceNumber: string;
  pelangganId: string;
  pelanggan?: {
    id: string;
    idPelanggan: string;
    nama: string;
  };
  status: InvoiceStatus;
  totalAmount: number;
  paidAmount: number;
  remainingAmount?: number;
  dueDate: Date | string;
  issueDate: Date | string;
  notes?: string | null;
  paymentMethod?: string;
}

// Invoice Item
export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxAmount?: number;
}

// Payment types
export type PaymentMethod =
  | "CASH"
  | "TRANSFER"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "E_WALLET"
  | "OTHER";
export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";

export interface Payment extends Timestamps {
  id: string;
  invoiceId?: string;
  pelangganId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  transactionId?: string;
  paymentDate: Date;
  notes?: string;
  receiptUrl?: string;
}

// Purchase Order types
export type PurchaseOrderStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED"
  | "CANCELLED"
  | "PARTIAL"
  | "ORDERED"
  | "RECEIVED";

export interface PurchaseOrder extends Timestamps {
  id: string;
  poNumber: string;
  supplierId: string | null;
  supplier?: Supplier | null;
  status: PurchaseOrderStatus;
  paymentStatus?: "PAID" | "PARTIAL" | "UNPAID";
  totalAmount: number;
  taxAmount?: number;
  ppnAmount: number;
  ppnRate: number;
  shippingCost?: number;
  discount?: number;
  grandTotal: number;
  requestedBy?: string;
  approvedBy?: string;
  approvedAt?: Date;
  deliveryDate?: Date | string;
  dueDate?: Date | string;
  notes?: string;
  transactions: Transaction[];
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  barangId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  receivedQuantity?: number;
  notes?: string;
}

// Expense types
export type ExpenseCategory =
  | "OPERATIONAL"
  | "SALARY"
  | "MAINTENANCE"
  | "UTILITIES"
  | "OTHER";

export interface Expense extends Timestamps {
  id: string;
  expenseNumber: string;
  categoryId?: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  expenseDate: Date | string;
  userId: string;
  receiptUrl?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approvedBy?: string;
  approvedAt?: Date;
  notes?: string;
}

// Receivable (Piutang)
export type Receivable = Invoice;

// Unpaid Bill (Hutang)
export type UnpaidBill = PurchaseOrder;

// Financial Transaction
export interface Transaction extends Timestamps {
  id: string;
  transactionNumber?: string;
  accountId: string;
  categoryId?: string;
  category?: Category;
  type: "DEBIT" | "CREDIT" | "INCOME" | "EXPENSE";
  amount: number;
  description: string;
  date: Date | string;
  referenceType?: "INVOICE" | "PAYMENT" | "EXPENSE" | "PURCHASE_ORDER";
  referenceId?: string;
  userId?: string;
  createdBy?: { name: string };
  purchaseOrder?: PurchaseOrder;
  attachments?: string[];
}

// AR Aging (Accounts Receivable Aging)
export interface ARAgingSnapshot extends Timestamps {
  id: string;
  pelangganId: string;
  snapshotDate: Date;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  days120Plus: number;
  totalOutstanding: number;
}

// Revenue Snapshot
export interface RevenueSnapshot extends Timestamps {
  id: string;
  date: Date;
  revenue: number;
  expenses: number;
  netIncome: number;
  period: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
}

// MRR Movement (Monthly Recurring Revenue)
export interface MRRMovement extends Timestamps {
  id: string;
  pelangganId: string;
  month: Date;
  previousMRR: number;
  currentMRR: number;
  change: number;
  changeType: "NEW" | "EXPANSION" | "CONTRACTION" | "CHURN" | "REACTIVATION";
  reason?: string;
}

// Customer Cohort (for analytics)
export interface CustomerCohort extends Timestamps {
  id: string;
  cohortMonth: Date;
  customersCount: number;
  revenue: number;
  retentionRate?: number;
}

// Supplier
export interface Supplier extends Timestamps {
  id: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string;
  isActive?: boolean;
  notes?: string;
}

// Financial Account (for accounting)
export interface FinancialAccount extends Timestamps {
  id: string;
  accountCode: string;
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
  parentId?: string;
  balance: number;
  isActive: boolean;
  description?: string;
}

// Summary types for dashboards
export interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  totalReceivables: number;
  totalPayables: number;
  cashBalance: number;
}

export interface PaymentSummary {
  totalPaid: number;
  totalPending: number;
  totalFailed: number;
  count: number;
}

export interface InvoiceSummary {
  totalInvoices: number;
  totalPaid: number;
  totalUnpaid: number;
  totalOverdue: number;
  totalAmount: number;
}
