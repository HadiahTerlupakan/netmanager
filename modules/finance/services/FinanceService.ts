import {
  RabExpenseType,
  RabGrowthType,
  RabInvestorProfitShareMode,
  RabItemCategory,
  RabOpexBufferFundingMode,
  RabPaymentType,
  RabTargetBasis,
} from "../repositories/prisma-boundary";
import {
  getPurchaseOrderPaymentService,
  type PurchaseOrderPaymentService,
} from "@/modules/procurement";
import { FinanceAccountFacadeService } from "./FinanceAccountFacadeService";
import { FinanceExpenseFacadeService } from "./FinanceExpenseFacadeService";
import { FinanceRabFacadeService } from "./FinanceRabFacadeService";
import { FinanceReportService } from "./FinanceReportService";

export class FinanceService {
  constructor(
    private readonly accountService = new FinanceAccountFacadeService(),
    private readonly expenseService = new FinanceExpenseFacadeService(),
    private readonly rabService = new FinanceRabFacadeService(),
    private readonly paymentService: PurchaseOrderPaymentService = getPurchaseOrderPaymentService(),
    private readonly reportService = new FinanceReportService(),
  ) {}

  /** Get all active financial accounts. */
  async getAccounts() {
    return this.accountService.getAccounts();
  }

  /** Riwayat mutasi saldo antar akun, terbaru lebih dulu. */
  async getTreasuryMutations(limit?: number) {
    return this.accountService.getRecentMutations(limit);
  }

  /** Create a new financial account. */
  async createAccount(data: {
    name: string;
    type: "BANK" | "CASH" | "EWALLET" | "OTHER";
    accountNumber?: string;
    description?: string;
    initialBalance?: number;
    coaId?: string;
    tenantId?: string | null;
  }) {
    return this.accountService.createAccount(data);
  }

  /** Ubah akun kas/bank, termasuk menautkannya ke COA untuk jurnal otomatis. */
  async updateAccount(
    id: string,
    tenantId: string | null,
    data: {
      name?: string;
      type?: "BANK" | "CASH" | "EWALLET" | "OTHER";
      accountNumber?: string | null;
      description?: string | null;
      coaId?: string | null;
      isActive?: boolean;
    },
  ) {
    return this.accountService.updateAccount(id, tenantId, data);
  }

  /** Get expenses with filtering and BigInt serialization. */
  async getExpenses(params: {
    startDate?: Date;
    endDate?: Date;
    siteId?: string | null;
    category?: string | null;
    expenseCategoryId?: string | null;
    scope?: string | null;
    restrictedSiteId?: string | null;
  }) {
    return this.expenseService.getExpenses(params);
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
      rabProjectId?: string;
      rabItemId?: string;
      invoiceNumber?: string;
      invoiceFile?: string;
      accountId?: string;
    },
    userId: string,
  ) {
    return this.expenseService.createExpense(data, userId);
  }

  /** Get expense categories with statistics. */
  async getExpenseCategories(params?: {
    type?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    return this.expenseService.getExpenseCategories(params);
  }

  /** Create a new expense category. */
  async createExpenseCategory(data: {
    name: string;
    type: string;
    parentId?: string | null;
  }) {
    return this.expenseService.createExpenseCategory(data);
  }

  /** Get RAB projects with nested data and serialization. */
  async getRabProjects(params: {
    siteId?: string | null;
    status?: string | null;
  }) {
    return this.rabService.getRabProjects(params);
  }

  /** Create a new RAB project with nested items, WBS, and investors. */
  async createRabProject(
    data: {
      name: string;
      description?: string;
      siteId?: string | null;
      projectedRevenue: bigint;
      projectedOpex: bigint;
      targetBasis: RabTargetBasis;
      targetHomepass?: number;
      targetTakeUpRatePercent: number;
      targetSubscribers?: number;
      arpu?: bigint;
      growthType: RabGrowthType;
      paymentType: RabPaymentType;
      growthSettings?: unknown;
      startDate?: Date;
      investmentDurationMonths: number;
      investmentRecoveryType: "PERCENTAGE" | "FIXED";
      investmentRecoveryValue: number;
      investorProfitSharePercent: number;
      investorProfitShareMode: RabInvestorProfitShareMode;
      investorProfitShareBeforeBepPercent: number;
      investorProfitShareAfterBepPercent: number;
      contingencyPercent: number;
      contingencyAmount: bigint;
      nplTolerancePercent: number;
      opexBufferFundingMode: RabOpexBufferFundingMode;
      opexBufferInvestorPercent: number;
      opexBufferCompanyPercent: number;
      opexBufferInvestorFixedAmount: bigint;
      opexBufferSafetyPercent: number;
      hasDisbursementPlan: boolean;
      wbsGroups: Array<{ id?: string; name: string; order: number }>;
      investorIds: string[];
      items: Array<{
        name: string;
        description?: string;
        quantity: number;
        unitPrice: bigint;
        category: RabItemCategory;
        expenseType: RabExpenseType;
        expenseCategoryId?: string;
        wbsGroupId?: string;
        disbursements: Array<{
          id?: string;
          name: string;
          percentage: number;
          amount: bigint;
          estimatedDate?: Date;
          isPaid: boolean;
        }>;
      }>;
    },
    userId: string,
  ) {
    return this.rabService.createRabProject(data, userId);
  }

  /** Process payment for a Purchase Order. */
  async payPurchaseOrder(input: {
    poId: string;
    amount: number;
    date: Date | string;
    notes?: string;
    createdById: string;
    paidFromAccountId?: string;
  }) {
    return this.paymentService.payPurchaseOrder(input);
  }

  /** Get reports (CAPEX/OPEX or TAX). */
  async getReports(type: "CAPEX_OPEX" | "TAX") {
    return this.reportService.getReports(type);
  }

  /** Transfer funds between accounts. */
  async transferFunds(data: {
    sourceAccountId: string;
    destinationAccountId: string;
    amount: number;
    date: Date | string;
    description?: string;
    createdById: string;
  }) {
    return this.accountService.transferFunds(data);
  }
}
