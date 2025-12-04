import { PrismaClient, Prisma } from '@prisma/client';
import { cache } from 'react';

const prisma = new PrismaClient();

// Type definitions for financial data
export interface BalanceSheetData {
  cashAndEquivalents: bigint;
  accountsReceivable: bigint;
  inventory: bigint;
  prepaidExpenses: bigint;
  currentAssets: bigint;
  fixedAssets: bigint;
  accumulatedDepreciation: bigint;
  netFixedAssets: bigint;
  totalAssets: bigint;
  accountsPayable: bigint;
  accruedExpenses: bigint;
  shortTermDebt: bigint;
  currentLiabilities: bigint;
  longTermDebt: bigint;
  totalLiabilities: bigint;
  initialCapital: bigint;
  retainedEarnings: bigint;
  currentPeriodEarnings: bigint;
  totalEquity: bigint;
  isBalanced: boolean;
  variance: bigint;
}

export interface ProfitLossData {
  salesRevenue: bigint;
  serviceRevenue: bigint;
  otherRevenue: bigint;
  totalRevenue: bigint;
  directCosts: bigint;
  cogs: bigint;
  grossProfit: bigint;
  grossMargin: number;
  operatingExpenses: bigint;
  operatingIncome: bigint;
  operatingMargin: number;
  interestIncome: bigint;
  interestExpense: bigint;
  otherIncome: bigint;
  otherExpenses: bigint;
  incomeBeforeTax: bigint;
  incomeTax: bigint;
  netIncome: bigint;
  netMargin: number;
  earningsPerShare: number;
  returnOnAssets: number;
  returnOnEquity: number;
}

export interface CashFlowData {
  netIncome: bigint;
  depreciation: bigint;
  workingCapitalChanges: bigint;
  operatingCashFlow: bigint;
  capex: bigint;
  assetSales: bigint;
  investingCashFlow: bigint;
  debtProceeds: bigint;
  debtRepayments: bigint;
  equityProceeds: bigint;
  dividends: bigint;
  financingCashFlow: bigint;
  cashFlowIncrease: bigint;
  beginningCash: bigint;
  endingCash: bigint;
}

export interface FinancialRatios {
  currentRatio: number;
  quickRatio: number;
  cashRatio: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  returnOnAssets: number;
  returnOnEquity: number;
  assetTurnover: number;
  inventoryTurnover: number;
  receivablesTurnover: number;
  debtToEquity: number;
  debtToAssets: number;
  interestCoverage: number;
}

export interface FinancialReportFilters {
  startDate?: Date;
  endDate?: Date;
  year?: number;
  month?: number;
  quarter?: number;
  includeUnapproved?: boolean;
  includeUnverified?: boolean;
}

export interface CashFlowItem {
  date: Date;
  description: string;
  category: string;
  amount: number;
  type: 'INFLOW' | 'OUTFLOW';
  activity: 'OPERATING' | 'INVESTING' | 'FINANCING';
}

class FinancialReportingRepository {
  // Cache configurations
  private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private static cache = new Map<string, { data: any; timestamp: number }>();

  private static getCacheKey(method: string, params: any): string {
    return `${method}:${JSON.stringify(params)}`;
  }

  private static getCachedData(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private static setCachedData(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // Clear cache for data mutations
  static clearCache(): void {
    this.cache.clear();
  }

  // Accounting Period Management
  static async createAccountingPeriod(data: {
    year: number;
    month?: number;
    quarter?: number;
    name: string;
    startDate: Date;
    endDate: Date;
    isActive?: boolean;
  }) {
    return await prisma.accountingPeriod.create({
      data,
      include: {
        balanceSheet: true,
        profitLoss: true,
        cashFlow: true,
        financialRatios: true,
      },
    });
  }

  static async getAccountingPeriod(year: number, month?: number, quarter?: number) {
    const cacheKey = this.getCacheKey('getAccountingPeriod', { year, month, quarter });
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const result = await prisma.accountingPeriod.findFirst({
      where: { year, month, quarter },
      include: {
        balanceSheet: true,
        profitLoss: true,
        cashFlow: true,
        financialRatios: true,
      },
    });

    if (result) {
      this.setCachedData(cacheKey, result);
    }
    return result;
  }

  static async getActivePeriod() {
    const cacheKey = this.getCacheKey('getActivePeriod', {});
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const result = await prisma.accountingPeriod.findFirst({
      where: { isActive: true },
      include: {
        balanceSheet: true,
        profitLoss: true,
        cashFlow: true,
        financialRatios: true,
      },
    });

    if (result) {
      this.setCachedData(cacheKey, result);
    }
    return result;
  }

  // Balance Sheet Calculations
  static async calculateBalanceSheet(filters: FinancialReportFilters = {}): Promise<BalanceSheetData> {
    const cacheKey = this.getCacheKey('calculateBalanceSheet', filters);
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const { startDate, endDate, year, month } = filters;
    const dateFilter = this.buildDateFilter(startDate, endDate, year, month);

    // Calculate Assets
    const cashAndEquivalents = await this.calculateCashAndEquivalents(dateFilter);
    const accountsReceivable = await this.calculateAccountsReceivable(dateFilter);
    const inventory = BigInt(0); // No inventory in ISP business
    const prepaidExpenses = await this.calculatePrepaidExpenses(dateFilter);

    const currentAssets = cashAndEquivalents + accountsReceivable + inventory + prepaidExpenses;

    const fixedAssets = await this.calculateFixedAssets(dateFilter);
    const accumulatedDepreciation = await this.calculateAccumulatedDepreciation(dateFilter);
    const netFixedAssets = fixedAssets - accumulatedDepreciation;

    const totalAssets = currentAssets + netFixedAssets;

    // Calculate Liabilities
    const accountsPayable = await this.calculateAccountsPayable(dateFilter);
    const accruedExpenses = await this.calculateAccruedExpenses(dateFilter);
    const shortTermDebt = BigInt(0); // Could be added later
    const currentLiabilities = accountsPayable + accruedExpenses + shortTermDebt;

    const longTermDebt = BigInt(0); // Could be added later
    const totalLiabilities = currentLiabilities + longTermDebt;

    // Calculate Equity
    const initialCapital = BigInt(0); // Could be tracked separately
    const retainedEarnings = await this.calculateRetainedEarnings(dateFilter);
    const currentPeriodEarnings = await this.calculateCurrentPeriodEarnings(dateFilter);
    const totalEquity = initialCapital + retainedEarnings + currentPeriodEarnings;

    // Validate balance
    const variance = totalAssets - (totalLiabilities + totalEquity);
    const isBalanced = variance === BigInt(0);

    const result: BalanceSheetData = {
      cashAndEquivalents,
      accountsReceivable,
      inventory,
      prepaidExpenses,
      currentAssets,
      fixedAssets,
      accumulatedDepreciation,
      netFixedAssets,
      totalAssets,
      accountsPayable,
      accruedExpenses,
      shortTermDebt,
      currentLiabilities,
      longTermDebt,
      totalLiabilities,
      initialCapital,
      retainedEarnings,
      currentPeriodEarnings,
      totalEquity,
      isBalanced,
      variance,
    };

    this.setCachedData(cacheKey, result);
    return result;
  }

  // Profit & Loss Calculations
  static async calculateProfitLoss(filters: FinancialReportFilters = {}): Promise<ProfitLossData> {
    const cacheKey = this.getCacheKey('calculateProfitLoss', filters);
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const dateFilter = this.buildDateFilter(filters.startDate, filters.endDate, filters.year, filters.month);

    // Calculate Revenue
    const salesRevenue = await this.calculateSalesRevenue(dateFilter);
    const serviceRevenue = await this.calculateServiceRevenue(dateFilter);
    const otherRevenue = await this.calculateOtherIncome(dateFilter);
    const totalRevenue = salesRevenue + serviceRevenue + otherRevenue;

    // Calculate COGS
    const directCosts = BigInt(0); // ISP typically has minimal COGS
    const cogs = directCosts;
    const grossProfit = totalRevenue - cogs;
    const grossMargin = totalRevenue > 0 ? Number((grossProfit * BigInt(100)) / totalRevenue) : 0;

    // Calculate Operating Expenses
    const operatingExpenses = await this.calculateOperatingExpenses(dateFilter);
    const operatingIncome = grossProfit - operatingExpenses;
    const operatingMargin = totalRevenue > 0 ? Number((operatingIncome * BigInt(100)) / totalRevenue) : 0;

    // Non-Operating Items
    const interestIncome = BigInt(0);
    const interestExpense = BigInt(0);
    const otherIncome = BigInt(0);
    const otherExpenses = BigInt(0);
    const incomeBeforeTax = operatingIncome + interestIncome - interestExpense + otherIncome - otherExpenses;

    // Tax
    const incomeTax = BigInt(0); // Simplified, could add tax calculations
    const netIncome = incomeBeforeTax - incomeTax;
    const netMargin = totalRevenue > 0 ? Number((netIncome * BigInt(100)) / totalRevenue) : 0;

    // Additional Metrics
    const earningsPerShare = 0; // Not applicable for private company
    const returnOnAssets = 0; // Would need average assets
    const returnOnEquity = 0; // Would need average equity

    const result: ProfitLossData = {
      salesRevenue,
      serviceRevenue,
      otherRevenue,
      totalRevenue,
      directCosts,
      cogs,
      grossProfit,
      grossMargin,
      operatingExpenses,
      operatingIncome,
      operatingMargin,
      interestIncome,
      interestExpense,
      otherIncome,
      otherExpenses,
      incomeBeforeTax,
      incomeTax,
      netIncome,
      netMargin,
      earningsPerShare,
      returnOnAssets,
      returnOnEquity,
    };

    this.setCachedData(cacheKey, result);
    return result;
  }

  // Cash Flow Calculations
  static async calculateCashFlow(filters: FinancialReportFilters = {}): Promise<CashFlowData> {
    const cacheKey = this.getCacheKey('calculateCashFlow', filters);
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const dateFilter = this.buildDateFilter(filters.startDate, filters.endDate, filters.year, filters.month);

    // Get net income from P&L
    const profitLoss = await this.calculateProfitLoss(filters);
    const netIncome = profitLoss.netIncome;

    // Operating Activities
    const depreciation = await this.calculateCurrentPeriodDepreciation(dateFilter);
    const workingCapitalChanges = await this.calculateWorkingCapitalChanges(dateFilter);
    const operatingCashFlow = netIncome + depreciation + workingCapitalChanges;

    // Investing Activities
    const capex = await this.calculateCAPEX(dateFilter);
    const assetSales = BigInt(0); // Could be added later
    const investingCashFlow = assetSales - capex;

    // Financing Activities
    const debtProceeds = BigInt(0);
    const debtRepayments = BigInt(0);
    const equityProceeds = BigInt(0);
    const dividends = BigInt(0);
    const financingCashFlow = debtProceeds - debtRepayments + equityProceeds - dividends;

    // Net Change
    const cashFlowIncrease = operatingCashFlow + investingCashFlow + financingCashFlow;
    const beginningCash = await this.getBeginningCash(dateFilter);
    const endingCash = beginningCash + cashFlowIncrease;

    const result: CashFlowData = {
      netIncome,
      depreciation,
      workingCapitalChanges,
      operatingCashFlow,
      capex,
      assetSales,
      investingCashFlow,
      debtProceeds,
      debtRepayments,
      equityProceeds,
      dividends,
      financingCashFlow,
      cashFlowIncrease,
      beginningCash,
      endingCash,
    };

    this.setCachedData(cacheKey, result);
    return result;
  }

  // Financial Ratios
  static async calculateFinancialRatios(filters: FinancialReportFilters = {}): Promise<FinancialRatios> {
    const cacheKey = this.getCacheKey('calculateFinancialRatios', filters);
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const balanceSheet = await this.calculateBalanceSheet(filters);
    const profitLoss = await this.calculateProfitLoss(filters);

    // Liquidity Ratios
    const currentRatio = balanceSheet.currentLiabilities > 0
      ? Number(balanceSheet.currentAssets) / Number(balanceSheet.currentLiabilities)
      : 0;
    const quickRatio = balanceSheet.currentLiabilities > 0
      ? Number((balanceSheet.currentAssets - balanceSheet.inventory)) / Number(balanceSheet.currentLiabilities)
      : 0;
    const cashRatio = balanceSheet.currentLiabilities > 0
      ? Number(balanceSheet.cashAndEquivalents) / Number(balanceSheet.currentLiabilities)
      : 0;

    // Profitability Ratios (from P&L)
    const grossMargin = profitLoss.grossMargin;
    const operatingMargin = profitLoss.operatingMargin;
    const netMargin = profitLoss.netMargin;
    const returnOnAssets = balanceSheet.totalAssets > 0
      ? Number(profitLoss.netIncome) / Number(balanceSheet.totalAssets)
      : 0;
    const returnOnEquity = balanceSheet.totalEquity > 0
      ? Number(profitLoss.netIncome) / Number(balanceSheet.totalEquity)
      : 0;

    // Efficiency Ratios
    const assetTurnover = balanceSheet.totalAssets > 0
      ? Number(profitLoss.totalRevenue) / Number(balanceSheet.totalAssets)
      : 0;
    const inventoryTurnover = 0; // No inventory in ISP
    const receivablesTurnover = balanceSheet.accountsReceivable > 0
      ? Number(profitLoss.totalRevenue) / Number(balanceSheet.accountsReceivable)
      : 0;

    // Solvency Ratios
    const debtToEquity = balanceSheet.totalEquity > 0
      ? Number(balanceSheet.totalLiabilities) / Number(balanceSheet.totalEquity)
      : 0;
    const debtToAssets = balanceSheet.totalAssets > 0
      ? Number(balanceSheet.totalLiabilities) / Number(balanceSheet.totalAssets)
      : 0;
    const interestCoverage = profitLoss.interestExpense > 0
      ? Number(profitLoss.operatingIncome) / Number(profitLoss.interestExpense)
      : 0;

    const result: FinancialRatios = {
      currentRatio,
      quickRatio,
      cashRatio,
      grossMargin,
      operatingMargin,
      netMargin,
      returnOnAssets,
      returnOnEquity,
      assetTurnover,
      inventoryTurnover,
      receivablesTurnover,
      debtToEquity,
      debtToAssets,
      interestCoverage,
    };

    this.setCachedData(cacheKey, result);
    return result;
  }

  // Cash Flow Items for detailed cash flow statement
  static async getCashFlowItems(filters: FinancialReportFilters = {}): Promise<CashFlowItem[]> {
    const cacheKey = this.getCacheKey('getCashFlowItems', filters);
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const dateFilter = this.buildDateFilter(filters.startDate, filters.endDate, filters.year, filters.month);

    // Get all cash-related transactions
    const cashFlowItems: CashFlowItem[] = [];

    // Customer payments (Operating Inflow)
    const customerPayments = await prisma.tagihan.findMany({
      where: {
        status: 'LUNAS',
        tanggalBayar: { gte: dateFilter.startDate, lte: dateFilter.endDate },
      },
      select: {
        tanggalBayar: true,
        total: true,
        noTagihan: true,
        pelanggan: { select: { nama: true } },
      },
    });

    customerPayments.forEach(payment => {
      if (payment.tanggalBayar) {
        cashFlowItems.push({
          date: payment.tanggalBayar,
          description: `Payment from ${payment.pelanggan.nama} - ${payment.noTagihan}`,
          category: 'Customer Payments',
          amount: payment.total,
          type: 'INFLOW',
          activity: 'OPERATING',
        });
      }
    });

    // Manual income (Operating Inflow)
    const manualIncome = await prisma.pemasukan.findMany({
      where: {
        tanggal: { gte: dateFilter.startDate, lte: dateFilter.endDate },
        isVerified: filters.includeUnverified !== false ? undefined : true,
      },
      select: {
        tanggal: true,
        jumlah: true,
        deskripsi: true,
        kategori: true,
      },
    });

    manualIncome.forEach(income => {
      cashFlowItems.push({
        date: income.tanggal,
        description: income.deskripsi,
        category: income.kategori,
        amount: Number(income.jumlah),
        type: 'INFLOW',
        activity: 'OPERATING',
      });
    });

    // Expenses (Operating Outflow)
    const expenses = await prisma.pengeluaran.findMany({
      where: {
        tanggal: { gte: dateFilter.startDate, lte: dateFilter.endDate },
        isApproved: filters.includeUnapproved !== false ? undefined : true,
      },
      select: {
        tanggal: true,
        jumlah: true,
        deskripsi: true,
        kategori: true,
        tipePengeluaran: true,
      },
    });

    expenses.forEach(expense => {
      const activity = expense.tipePengeluaran === 'CAPEX' ? 'INVESTING' : 'OPERATING';
      cashFlowItems.push({
        date: expense.tanggal,
        description: expense.deskripsi,
        category: expense.kategori,
        amount: Number(expense.jumlah),
        type: 'OUTFLOW',
        activity,
      });
    });

    // Sort by date
    cashFlowItems.sort((a, b) => a.date.getTime() - b.date.getTime());

    this.setCachedData(cacheKey, cashFlowItems);
    return cashFlowItems;
  }

  // Helper Methods
  private static buildDateFilter(startDate?: Date, endDate?: Date, year?: number, month?: number) {
    const now = new Date();

    if (year && month) {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
    } else if (year) {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    } else if (!startDate || !endDate) {
      // Default to current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    return { startDate: startDate!, endDate: endDate! };
  }

  private static async calculateCashAndEquivalents(dateFilter: { startDate: Date; endDate: Date }): Promise<bigint> {
    // Sum of all bank balances
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { isActive: true },
      select: { saldoSaatIni: true },
    });

    return bankAccounts.reduce((total, account) => total + account.saldoSaatIni, BigInt(0));
  }

  private static async calculateAccountsReceivable(dateFilter: { startDate: Date; endDate: Date }): Promise<bigint> {
    // Sum of unpaid invoices
    const result = await prisma.tagihan.aggregate({
      where: {
        status: { in: ['BELUM_LUNAS', 'TERLAMBAT'] },
        createdAt: { lte: dateFilter.endDate },
      },
      _sum: { total: true },
    });

    return BigInt(result._sum.total || 0);
  }

  private static async calculatePrepaidExpenses(dateFilter: { startDate: Date; endDate: Date }): Promise<bigint> {
    // Could be implemented based on business logic
    return BigInt(0);
  }

  private static async calculateFixedAssets(dateFilter: { startDate: Date; endDate: Date }): Promise<bigint> {
    // Sum of all fixed assets
    const result = await prisma.fixedAsset.aggregate({
      where: { status: 'ACTIVE' },
      _sum: { currentValue: true },
    });

    return result._sum.currentValue || BigInt(0);
  }

  private static async calculateAccumulatedDepreciation(dateFilter: { startDate: Date; endDate: Date }): Promise<bigint> {
    // Sum of accumulated depreciation
    const result = await prisma.depreciationSchedule.aggregate({
      where: { isActive: true },
      _sum: { accumulatedDepreciation: true },
    });

    return result._sum.accumulatedDepreciation || BigInt(0);
  }

  private static async calculateAccountsPayable(dateFilter: { startDate: Date; endDate: Date }): Promise<bigint> {
    // Could be implemented for vendor payments
    return BigInt(0);
  }

  private static async calculateAccruedExpenses(dateFilter: { startDate: Date; endDate: Date }): Promise<bigint> {
    // Could be implemented for accrued expenses
    return BigInt(0);
  }

  private static async calculateRetainedEarnings(dateFilter: { startDate: Date; endDate: Date }): Promise<bigint> {
    // Sum of all previous periods' earnings
    const previousPeriods = await prisma.profitLossSnapshot.findMany({
      where: {
        period: {
          endDate: { lt: dateFilter.startDate },
        },
      },
      select: { netIncome: true },
    });

    return previousPeriods.reduce((total, period) => total + period.netIncome, BigInt(0));
  }

  private static async calculateCurrentPeriodEarnings(dateFilter: { startDate: Date; endDate: Date }): Promise<bigint> {
    const profitLoss = await this.calculateProfitLoss({
      startDate: dateFilter.startDate,
      endDate: dateFilter.endDate,
    });
    return profitLoss.netIncome;
  }

  private static async calculateSalesRevenue(dateFilter: { startDate: Date; endDate: Date }): Promise<bigint> {
    // Revenue from paid invoices (excluding installation fees)
    const result = await prisma.tagihan.aggregate({
      where: {
        status: 'LUNAS',
        tanggalBayar: { gte: dateFilter.startDate, lte: dateFilter.endDate },
      },
      _sum: { total: true },
    });

    return BigInt(result._sum.total || 0);
  }

  private static async calculateServiceRevenue(dateFilter: { startDate: Date; endDate: Date }): Promise<bigint> {
    // Revenue from manual income entries
    const result = await prisma.pemasukan.aggregate({
      where: {
        kategori: { in: ['PENJUALAN', 'SEWA'] },
        tanggal: { gte: dateFilter.startDate, lte: dateFilter.endDate },
        isVerified: true,
      },
      _sum: { jumlah: true },
    });

    return result._sum.jumlah || BigInt(0);
  }

  private static async calculateOtherIncome(dateFilter: { startDate: Date; endDate: Date }): Promise<bigint> {
    // Other income (bonuses, hadiah, etc.)
    const result = await prisma.pemasukan.aggregate({
      where: {
        kategori: { in: ['BONUS', 'HADIAH', 'INVESTASI', 'LAINNYA'] },
        tanggal: { gte: dateFilter.startDate, lte: dateFilter.endDate },
        isVerified: true,
      },
      _sum: { jumlah: true },
    });

    return result._sum.jumlah || BigInt(0);
  }

  private static async calculateOperatingExpenses(dateFilter: { startDate: Date; endDate: Date }): Promise<bigint> {
    // All OPEX expenses
    const result = await prisma.pengeluaran.aggregate({
      where: {
        tipePengeluaran: 'OPEX',
        tanggal: { gte: dateFilter.startDate, lte: dateFilter.endDate },
        isApproved: true,
      },
      _sum: { jumlah: true },
    });

    return result._sum.jumlah || BigInt(0);
  }

  private static async calculateCAPEX(dateFilter: { startDate: Date; endDate: Date }): Promise<bigint> {
    // All CAPEX expenses
    const result = await prisma.pengeluaran.aggregate({
      where: {
        tipePengeluaran: 'CAPEX',
        tanggal: { gte: dateFilter.startDate, lte: dateFilter.endDate },
        isApproved: true,
      },
      _sum: { jumlah: true },
    });

    return result._sum.jumlah || BigInt(0);
  }

  private static async calculateCurrentPeriodDepreciation(dateFilter: { startDate: Date; endDate: Date }): Promise<bigint> {
    // Depreciation for the current period
    const result = await prisma.depreciationRecord.aggregate({
      where: {
        year: dateFilter.startDate.getFullYear(),
        month: dateFilter.startDate.getMonth() + 1,
      },
      _sum: { depreciationAmount: true },
    });

    return result._sum.depreciationAmount || BigInt(0);
  }

  private static async calculateWorkingCapitalChanges(dateFilter: { startDate: Date; endDate: Date }): Promise<bigint> {
    // Changes in working capital components
    // This is a simplified calculation
    return BigInt(0);
  }

  private static async getBeginningCash(dateFilter: { startDate: Date; endDate: Date }): Promise<bigint> {
    // Get cash balance at the beginning of the period
    const previousBalanceSheet = await prisma.balanceSheetSnapshot.findFirst({
      where: {
        period: {
          endDate: { lt: dateFilter.startDate },
        },
      },
      orderBy: {
        period: { endDate: 'desc' },
      },
    });

    return previousBalanceSheet?.cashAndEquivalents || BigInt(0);
  }

  // Period Comparison Methods
  static async getPeriodComparison(
    currentPeriod: { year: number; month?: number },
    previousPeriod: { year: number; month?: number }
  ) {
    const [currentData, previousData] = await Promise.all([
      this.getFinancialOverview(currentPeriod),
      this.getFinancialOverview(previousPeriod),
    ]);

    return {
      revenue: {
        current: currentData.profitLoss.totalRevenue,
        previous: previousData.profitLoss.totalRevenue,
        change: currentData.profitLoss.totalRevenue - previousData.profitLoss.totalRevenue,
        changePercent: previousData.profitLoss.totalRevenue > 0
          ? Number(((currentData.profitLoss.totalRevenue - previousData.profitLoss.totalRevenue) * BigInt(100)) / previousData.profitLoss.totalRevenue)
          : 0,
      },
      expenses: {
        current: currentData.profitLoss.operatingExpenses,
        previous: previousData.profitLoss.operatingExpenses,
        change: currentData.profitLoss.operatingExpenses - previousData.profitLoss.operatingExpenses,
        changePercent: previousData.profitLoss.operatingExpenses > 0
          ? Number(((currentData.profitLoss.operatingExpenses - previousData.profitLoss.operatingExpenses) * BigInt(100)) / previousData.profitLoss.operatingExpenses)
          : 0,
      },
      netIncome: {
        current: currentData.profitLoss.netIncome,
        previous: previousData.profitLoss.netIncome,
        change: currentData.profitLoss.netIncome - previousData.profitLoss.netIncome,
        changePercent: previousData.profitLoss.netIncome > 0
          ? Number(((currentData.profitLoss.netIncome - previousData.profitLoss.netIncome) * BigInt(100)) / previousData.profitLoss.netIncome)
          : 0,
      },
    };
  }

  static async getFinancialOverview(period: { year: number; month?: number }) {
    const [balanceSheet, profitLoss, cashFlow, ratios] = await Promise.all([
      this.calculateBalanceSheet(period),
      this.calculateProfitLoss(period),
      this.calculateCashFlow(period),
      this.calculateFinancialRatios(period),
    ]);

    return { balanceSheet, profitLoss, cashFlow, ratios };
  }

  // Snapshot Management
  static async createFinancialSnapshot(
    periodId: string,
    type: 'BALANCE_SHEET' | 'PROFIT_LOSS' | 'CASH_FLOW' | 'RATIOS',
    data: any
  ) {
    this.clearCache(); // Clear cache when creating snapshots

    switch (type) {
      case 'BALANCE_SHEET':
        return await prisma.balanceSheetSnapshot.create({
          data: { periodId, ...data },
        });
      case 'PROFIT_LOSS':
        return await prisma.profitLossSnapshot.create({
          data: { periodId, ...data },
        });
      case 'CASH_FLOW':
        return await prisma.cashFlowSnapshot.create({
          data: { periodId, ...data },
        });
      case 'RATIOS':
        return await prisma.financialRatioSnapshot.create({
          data: { periodId, ...data },
        });
      default:
        throw new Error(`Unknown snapshot type: ${type}`);
    }
  }

  static async getFinancialSnapshots(periodId: string) {
    return await prisma.accountingPeriod.findUnique({
      where: { id: periodId },
      include: {
        balanceSheet: true,
        profitLoss: true,
        cashFlow: true,
        financialRatios: true,
      },
    });
  }

  // Audit Logging
  static async logFinancialActivity(data: {
    periodId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    description: string;
    userId: string;
    userName?: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return await prisma.financialAuditLog.create({
      data,
    });
  }

  static async getFinancialAuditLogs(filters: {
    periodId?: string;
    entityType?: string;
    userId?: string;
    limit?: number;
  } = {}) {
    const { limit = 100, ...where } = filters;

    return await prisma.financialAuditLog.findMany({
      where: Object.fromEntries(
        Object.entries(where).filter(([_, value]) => value !== undefined)
      ),
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

export default FinancialReportingRepository;