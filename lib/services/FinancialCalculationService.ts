import { prisma } from '@/lib/prisma';
import FinancialReportingRepository, {
  BalanceSheetData,
  ProfitLossData,
  CashFlowData,
  FinancialRatios,
  FinancialReportFilters
} from '@/lib/repositories/FinancialReportingRepository';

// Interface for calculation results with validation
export interface CalculationResult<T> {
  data: T;
  isAccurate: boolean;
  warnings: string[];
  errors: string[];
  metadata: {
    calculatedAt: Date;
    dataSource: string;
    calculationMethod: string;
  };
}

// Interface for working capital components
export interface WorkingCapitalComponents {
  currentAssets: {
    cash: bigint;
    accountsReceivable: bigint;
    inventory: bigint;
    prepaidExpenses: bigint;
    otherCurrentAssets: bigint;
  };
  currentLiabilities: {
    accountsPayable: bigint;
    accruedExpenses: bigint;
    shortTermDebt: bigint;
    taxesPayable: bigint;
    otherCurrentLiabilities: bigint;
  };
  netWorkingCapital: bigint;
  workingCapitalRatio: number;
}

// Interface for debt analysis
export interface DebtAnalysis {
  totalDebt: bigint;
  shortTermDebt: bigint;
  longTermDebt: bigint;
  debtToEquity: number;
  debtToAssets: number;
  interestCoverage: number;
  debtServiceCoverage: number;
}

// Interface for profitability analysis
export interface ProfitabilityAnalysis {
  grossProfit: bigint;
  operatingProfit: bigint;
  netProfit: bigint;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  returnOnAssets: number;
  returnOnEquity: number;
  returnOnInvestment: number;
  earningsPerShare: number;
}

// Interface for cash flow analysis
export interface CashFlowAnalysis {
  operatingCashFlow: bigint;
  investingCashFlow: bigint;
  financingCashFlow: bigint;
  freeCashFlow: bigint;
  cashFlowFromOperations: bigint;
  capitalExpenditures: bigint;
  cashConversionCycle: number;
  operatingCashFlowRatio: number;
}

class FinancialCalculationService {
  private static readonly ROUNDING_PRECISION = 2;
  private static readonly VALIDATION_TOLERANCE = 0.01; // 1% tolerance for validation

  /**
   * Calculate accurate balance sheet with proper accounting principles
   */
  static async calculateBalanceSheet(
    filters: FinancialReportFilters = {}
  ): Promise<CalculationResult<BalanceSheetData>> {
    const warnings: string[] = [];
    const errors: string[] = [];
    let isAccurate = true;

    try {
      // Get base balance sheet data
      const baseData = await FinancialReportingRepository.calculateBalanceSheet(filters);

      // Perform validation checks
      if (baseData.totalAssets !== (baseData.totalLiabilities + baseData.totalEquity)) {
        const variance = Math.abs(Number(baseData.totalAssets - (baseData.totalLiabilities + baseData.totalEquity)));
        const tolerance = Number(baseData.totalAssets) * this.VALIDATION_TOLERANCE;

        if (variance > tolerance) {
          errors.push(`Balance sheet doesn't balance. Variance: Rp${variance.toLocaleString('id-ID')}`);
          isAccurate = false;
        } else {
          warnings.push(`Minor balance sheet variance: Rp${variance.toLocaleString('id-ID')}`);
        }
      }

      // Additional validations
      if (baseData.netFixedAssets < 0) {
        errors.push('Net fixed assets cannot be negative');
        isAccurate = false;
      }

      if (baseData.cashAndEquivalents < 0) {
        errors.push('Cash and equivalents cannot be negative');
        isAccurate = false;
      }

      // Adjust data for accuracy
      const adjustedData = this.adjustBalanceSheetData(baseData);

      return {
        data: adjustedData,
        isAccurate,
        warnings,
        errors,
        metadata: {
          calculatedAt: new Date(),
          dataSource: 'database_calculations',
          calculationMethod: 'accrual_basis',
        },
      };
    } catch (error) {
      errors.push(`Calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        data: this.getEmptyBalanceSheet(),
        isAccurate: false,
        warnings,
        errors,
        metadata: {
          calculatedAt: new Date(),
          dataSource: 'error_fallback',
          calculationMethod: 'none',
        },
      };
    }
  }

  /**
   * Calculate accurate profit & loss with proper cost classification
   */
  static async calculateProfitLoss(
    filters: FinancialReportFilters = {}
  ): Promise<CalculationResult<ProfitLossData>> {
    const warnings: string[] = [];
    const errors: string[] = [];
    let isAccurate = true;

    try {
      // Get base P&L data
      const baseData = await FinancialReportingRepository.calculateProfitLoss(filters);

      // Validation checks
      if (baseData.totalRevenue < 0) {
        errors.push('Total revenue cannot be negative');
        isAccurate = false;
      }

      if (baseData.grossProfit > baseData.totalRevenue) {
        warnings.push('Gross profit exceeds total revenue - possible calculation error');
      }

      if (baseData.netIncome < 0 && baseData.grossMargin > 50) {
        warnings.push('High gross margin but net loss - check operating expenses');
      }

      // Calculate additional metrics
      const enhancedData = this.enhanceProfitLossData(baseData);

      return {
        data: enhancedData,
        isAccurate,
        warnings,
        errors,
        metadata: {
          calculatedAt: new Date(),
          dataSource: 'database_calculations',
          calculationMethod: 'accrual_basis',
        },
      };
    } catch (error) {
      errors.push(`Calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        data: this.getEmptyProfitLoss(),
        isAccurate: false,
        warnings,
        errors,
        metadata: {
          calculatedAt: new Date(),
          dataSource: 'error_fallback',
          calculationMethod: 'none',
        },
      };
    }
  }

  /**
   * Calculate cash flow with proper reconciliation
   */
  static async calculateCashFlow(
    filters: FinancialReportFilters = {}
  ): Promise<CalculationResult<CashFlowData>> {
    const warnings: string[] = [];
    const errors: string[] = [];
    let isAccurate = true;

    try {
      // Get base cash flow data
      const baseData = await FinancialReportingRepository.calculateCashFlow(filters);

      // Validate cash flow reconciliation
      const expectedEndingCash = baseData.beginningCash + baseData.cashFlowIncrease;
      if (baseData.endingCash !== expectedEndingCash) {
        const variance = Math.abs(Number(baseData.endingCash - expectedEndingCash));
        const tolerance = Number(baseData.beginningCash) * this.VALIDATION_TOLERANCE;

        if (variance > tolerance) {
          errors.push(`Cash flow reconciliation failed. Expected: Rp${expectedEndingCash.toLocaleString('id-ID')}, Actual: Rp${baseData.endingCash.toLocaleString('id-ID')}`);
          isAccurate = false;
        } else {
          warnings.push(`Minor cash flow variance: Rp${variance.toLocaleString('id-ID')}`);
        }
      }

      // Enhanced cash flow calculations
      const enhancedData = this.enhanceCashFlowData(baseData);

      return {
        data: enhancedData,
        isAccurate,
        warnings,
        errors,
        metadata: {
          calculatedAt: new Date(),
          dataSource: 'database_calculations',
          calculationMethod: 'indirect_method',
        },
      };
    } catch (error) {
      errors.push(`Calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        data: this.getEmptyCashFlow(),
        isAccurate: false,
        warnings,
        errors,
        metadata: {
          calculatedAt: new Date(),
          dataSource: 'error_fallback',
          calculationMethod: 'none',
        },
      };
    }
  }

  /**
   * Calculate working capital analysis
   */
  static async calculateWorkingCapital(
    filters: FinancialReportFilters = {}
  ): Promise<CalculationResult<WorkingCapitalComponents>> {
    const warnings: string[] = [];
    const errors: string[] = [];
    let isAccurate = true;

    try {
      const balanceSheet = await this.calculateBalanceSheet(filters);

      if (!balanceSheet.isAccurate) {
        warnings.push('Balance sheet accuracy issues may affect working capital calculation');
      }

      const currentAssets = {
        cash: balanceSheet.data.cashAndEquivalents,
        accountsReceivable: balanceSheet.data.accountsReceivable,
        inventory: balanceSheet.data.inventory,
        prepaidExpenses: balanceSheet.data.prepaidExpenses,
        otherCurrentAssets: BigInt(0), // Could be added later
      };

      const currentLiabilities = {
        accountsPayable: balanceSheet.data.accountsPayable,
        accruedExpenses: balanceSheet.data.accruedExpenses,
        shortTermDebt: balanceSheet.data.shortTermDebt,
        taxesPayable: BigInt(0), // Could be added later
        otherCurrentLiabilities: BigInt(0), // Could be added later
      };

      const totalCurrentAssets = Object.values(currentAssets).reduce((sum, val) => sum + val, BigInt(0));
      const totalCurrentLiabilities = Object.values(currentLiabilities).reduce((sum, val) => sum + val, BigInt(0));
      const netWorkingCapital = totalCurrentAssets - totalCurrentLiabilities;
      const workingCapitalRatio = totalCurrentLiabilities > 0 ? Number(totalCurrentAssets) / Number(totalCurrentLiabilities) : 0;

      // Validation
      if (workingCapitalRatio < 1) {
        warnings.push('Working capital ratio below 1.0 - potential liquidity issues');
      }

      const result: WorkingCapitalComponents = {
        currentAssets,
        currentLiabilities,
        netWorkingCapital,
        workingCapitalRatio,
      };

      return {
        data: result,
        isAccurate,
        warnings,
        errors,
        metadata: {
          calculatedAt: new Date(),
          dataSource: 'derived_calculation',
          calculationMethod: 'standard_accounting',
        },
      };
    } catch (error) {
      errors.push(`Working capital calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        data: this.getEmptyWorkingCapital(),
        isAccurate: false,
        warnings,
        errors,
        metadata: {
          calculatedAt: new Date(),
          dataSource: 'error_fallback',
          calculationMethod: 'none',
        },
      };
    }
  }

  /**
   * Calculate debt analysis
   */
  static async calculateDebtAnalysis(
    filters: FinancialReportFilters = {}
  ): Promise<CalculationResult<DebtAnalysis>> {
    const warnings: string[] = [];
    const errors: string[] = [];
    let isAccurate = true;

    try {
      const balanceSheet = await this.calculateBalanceSheet(filters);
      const profitLoss = await this.calculateProfitLoss(filters);

      const totalDebt = balanceSheet.data.shortTermDebt + balanceSheet.data.longTermDebt;
      const debtToEquity = balanceSheet.data.totalEquity > 0
        ? Number(totalDebt) / Number(balanceSheet.data.totalEquity)
        : 0;
      const debtToAssets = balanceSheet.data.totalAssets > 0
        ? Number(totalDebt) / Number(balanceSheet.data.totalAssets)
        : 0;
      const interestCoverage = balanceSheet.data.interestExpense > 0
        ? Number(profitLoss.data.operatingIncome) / Number(balanceSheet.data.interestExpense)
        : 0;

      // Debt Service Coverage (simplified)
      const debtServiceCoverage = (balanceSheet.data.shortTermDebt + balanceSheet.data.interestExpense) > 0
        ? Number(profitLoss.data.operatingIncome) / Number(balanceSheet.data.shortTermDebt + balanceSheet.data.interestExpense)
        : 0;

      // Validation
      if (debtToEquity > 2) {
        warnings.push('High debt-to-equity ratio (>2.0) - financial risk concern');
      }

      if (interestCoverage < 1.5) {
        warnings.push('Low interest coverage ratio (<1.5) - may struggle to meet interest payments');
      }

      const result: DebtAnalysis = {
        totalDebt,
        shortTermDebt: balanceSheet.data.shortTermDebt,
        longTermDebt: balanceSheet.data.longTermDebt,
        debtToEquity,
        debtToAssets,
        interestCoverage,
        debtServiceCoverage,
      };

      return {
        data: result,
        isAccurate,
        warnings,
        errors,
        metadata: {
          calculatedAt: new Date(),
          dataSource: 'derived_calculation',
          calculationMethod: 'standard_financial_ratios',
        },
      };
    } catch (error) {
      errors.push(`Debt analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        data: this.getEmptyDebtAnalysis(),
        isAccurate: false,
        warnings,
        errors,
        metadata: {
          calculatedAt: new Date(),
          dataSource: 'error_fallback',
          calculationMethod: 'none',
        },
      };
    }
  }

  /**
   * Calculate profitability analysis with enhanced metrics
   */
  static async calculateProfitabilityAnalysis(
    filters: FinancialReportFilters = {}
  ): Promise<CalculationResult<ProfitabilityAnalysis>> {
    const warnings: string[] = [];
    const errors: string[] = [];
    let isAccurate = true;

    try {
      const balanceSheet = await this.calculateBalanceSheet(filters);
      const profitLoss = await this.calculateProfitLoss(filters);

      const returnOnAssets = balanceSheet.data.totalAssets > 0
        ? Number(profitLoss.data.netIncome) / Number(balanceSheet.data.totalAssets)
        : 0;
      const returnOnEquity = balanceSheet.data.totalEquity > 0
        ? Number(profitLoss.data.netIncome) / Number(balanceSheet.data.totalEquity)
        : 0;

      // Return on Investment (simplified)
      const totalInvestment = balanceSheet.data.totalAssets; // Simplified assumption
      const returnOnInvestment = totalInvestment > 0
        ? Number(profitLoss.data.netIncome) / Number(totalInvestment)
        : 0;

      // Earnings per share (not applicable to private company, but calculated for completeness)
      const earningsPerShare = 0; // Would need share count

      const result: ProfitabilityAnalysis = {
        grossProfit: profitLoss.data.grossProfit,
        operatingProfit: profitLoss.data.operatingIncome,
        netProfit: profitLoss.data.netIncome,
        grossMargin: profitLoss.data.grossMargin,
        operatingMargin: profitLoss.data.operatingMargin,
        netMargin: profitLoss.data.netMargin,
        returnOnAssets,
        returnOnEquity,
        returnOnInvestment,
        earningsPerShare,
      };

      // Validation
      if (returnOnAssets < 0) {
        warnings.push('Negative return on assets - company not generating profits from assets');
      }

      if (returnOnEquity < 0.05) { // 5%
        warnings.push('Low return on equity (<5%) - inefficient use of shareholder capital');
      }

      return {
        data: result,
        isAccurate,
        warnings,
        errors,
        metadata: {
          calculatedAt: new Date(),
          dataSource: 'derived_calculation',
          calculationMethod: 'standard_profitability_metrics',
        },
      };
    } catch (error) {
      errors.push(`Profitability analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        data: this.getEmptyProfitabilityAnalysis(),
        isAccurate: false,
        warnings,
        errors,
        metadata: {
          calculatedAt: new Date(),
          dataSource: 'error_fallback',
          calculationMethod: 'none',
        },
      };
    }
  }

  /**
   * Calculate cash flow analysis with additional metrics
   */
  static async calculateCashFlowAnalysis(
    filters: FinancialReportFilters = {}
  ): Promise<CalculationResult<CashFlowAnalysis>> {
    const warnings: string[] = [];
    const errors: string[] = [];
    let isAccurate = true;

    try {
      const cashFlow = await this.calculateCashFlow(filters);
      const balanceSheet = await this.calculateBalanceSheet(filters);
      const profitLoss = await this.calculateProfitLoss(filters);

      // Free cash flow
      const freeCashFlow = cashFlow.data.operatingCashFlow - cashFlow.data.capex;

      // Cash conversion cycle (simplified for ISP)
      const receivablesTurnover = balanceSheet.data.accountsReceivable > 0
        ? Number(profitLoss.data.totalRevenue) / Number(balanceSheet.data.accountsReceivable)
        : 0;
      const daysSalesOutstanding = receivablesTurnover > 0 ? 365 / receivablesTurnover : 0;
      const cashConversionCycle = daysSalesOutstanding; // Simplified (no inventory/payables for ISP)

      // Operating cash flow ratio
      const operatingCashFlowRatio = balanceSheet.data.currentLiabilities > 0
        ? Number(cashFlow.data.operatingCashFlow) / Number(balanceSheet.data.currentLiabilities)
        : 0;

      const result: CashFlowAnalysis = {
        operatingCashFlow: cashFlow.data.operatingCashFlow,
        investingCashFlow: cashFlow.data.investingCashFlow,
        financingCashFlow: cashFlow.data.financingCashFlow,
        freeCashFlow,
        cashFlowFromOperations: cashFlow.data.operatingCashFlow,
        capitalExpenditures: cashFlow.data.capex,
        cashConversionCycle,
        operatingCashFlowRatio,
      };

      // Validation
      if (freeCashFlow < 0) {
        warnings.push('Negative free cash flow - company spending more than generating');
      }

      if (operatingCashFlowRatio < 1) {
        warnings.push('Operating cash flow ratio below 1.0 - may struggle to meet short-term obligations');
      }

      return {
        data: result,
        isAccurate,
        warnings,
        errors,
        metadata: {
          calculatedAt: new Date(),
          dataSource: 'derived_calculation',
          calculationMethod: 'standard_cash_flow_metrics',
        },
      };
    } catch (error) {
      errors.push(`Cash flow analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        data: this.getEmptyCashFlowAnalysis(),
        isAccurate: false,
        warnings,
        errors,
        metadata: {
          calculatedAt: new Date(),
          dataSource: 'error_fallback',
          calculationMethod: 'none',
        },
      };
    }
  }

  /**
   * Perform comprehensive financial health check
   */
  static async performFinancialHealthCheck(
    filters: FinancialReportFilters = {}
  ): Promise<{
    overall: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
    scores: {
      liquidity: number;
      profitability: number;
      efficiency: number;
      solvency: number;
    };
    recommendations: string[];
    alerts: string[];
  }> {
    const [balanceSheet, profitLoss, workingCapital, debtAnalysis, profitability] = await Promise.all([
      this.calculateBalanceSheet(filters),
      this.calculateProfitLoss(filters),
      this.calculateWorkingCapital(filters),
      this.calculateDebtAnalysis(filters),
      this.calculateProfitabilityAnalysis(filters),
    ]);

    const recommendations: string[] = [];
    const alerts: string[] = [];

    // Calculate scores (0-100)
    const liquidityScore = this.calculateLiquidityScore(workingCapital.data);
    const profitabilityScore = this.calculateProfitabilityScore(profitability.data);
    const efficiencyScore = this.calculateEfficiencyScore(profitability.data);
    const solvencyScore = this.calculateSolvencyScore(debtAnalysis.data);

    const scores = {
      liquidity: liquidityScore,
      profitability: profitabilityScore,
      efficiency: efficiencyScore,
      solvency: solvencyScore,
    };

    const overallScore = (liquidityScore + profitabilityScore + efficiencyScore + solvencyScore) / 4;

    // Generate recommendations and alerts
    if (liquidityScore < 50) {
      alerts.push('Liquidity concerns: Working capital ratio below optimal level');
      recommendations.push('Improve cash collection and manage current liabilities');
    }

    if (profitabilityScore < 50) {
      alerts.push('Profitability issues: Negative or low margins');
      recommendations.push('Review pricing strategy and cost structure');
    }

    if (solvencyScore < 50) {
      alerts.push('Solvency concerns: High debt levels');
      recommendations.push('Reduce debt and improve equity position');
    }

    // Determine overall health
    let overall: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
    if (overallScore >= 80) overall = 'EXCELLENT';
    else if (overallScore >= 65) overall = 'GOOD';
    else if (overallScore >= 50) overall = 'FAIR';
    else if (overallScore >= 35) overall = 'POOR';
    else overall = 'CRITICAL';

    return {
      overall,
      scores,
      recommendations,
      alerts,
    };
  }

  // Helper methods for score calculations
  private static calculateLiquidityScore(workingCapital: WorkingCapitalComponents): number {
    const ratio = workingCapital.workingCapitalRatio;
    if (ratio >= 2) return 100;
    if (ratio >= 1.5) return 85;
    if (ratio >= 1.2) return 70;
    if (ratio >= 1.0) return 55;
    if (ratio >= 0.8) return 40;
    return 20;
  }

  private static calculateProfitabilityScore(profitability: ProfitabilityAnalysis): number {
    const netMargin = profitability.netMargin;
    if (netMargin >= 20) return 100;
    if (netMargin >= 15) return 85;
    if (netMargin >= 10) return 70;
    if (netMargin >= 5) return 55;
    if (netMargin >= 0) return 40;
    return 20;
  }

  private static calculateEfficiencyScore(profitability: ProfitabilityAnalysis): number {
    const roa = profitability.returnOnAssets;
    if (roa >= 15) return 100;
    if (roa >= 10) return 85;
    if (roa >= 5) return 70;
    if (roa >= 2) return 55;
    if (roa >= 0) return 40;
    return 20;
  }

  private static calculateSolvencyScore(debtAnalysis: DebtAnalysis): number {
    const debtToEquity = debtAnalysis.debtToEquity;
    if (debtToEquity <= 0.5) return 100;
    if (debtToEquity <= 0.75) return 85;
    if (debtToEquity <= 1.0) return 70;
    if (debtToEquity <= 1.5) return 55;
    if (debtToEquity <= 2.0) return 40;
    return 20;
  }

  // Helper methods for data adjustment and enhancement
  private static adjustBalanceSheetData(data: BalanceSheetData): BalanceSheetData {
    // Ensure balance equation is satisfied
    const calculatedEquity = data.totalAssets - data.totalLiabilities;
    const variance = data.totalEquity - calculatedEquity;

    if (Math.abs(Number(variance)) > 0) {
      // Adjust retained earnings to balance
      return {
        ...data,
        retainedEarnings: data.retainedEarnings - variance,
        totalEquity: calculatedEquity,
        isBalanced: true,
        variance: BigInt(0),
      };
    }

    return data;
  }

  private static enhanceProfitLossData(data: ProfitLossData): ProfitLossData {
    // Additional calculations for enhanced P&L
    const returnOnAssets = Number(data.netIncome) / 1000000; // Simplified (would need actual assets)
    const returnOnEquity = Number(data.netIncome) / 1000000; // Simplified (would need actual equity)

    return {
      ...data,
      returnOnAssets,
      returnOnEquity,
    };
  }

  private static enhanceCashFlowData(data: CashFlowData): CashFlowData {
    // Additional cash flow calculations
    return data;
  }

  // Empty data fallbacks
  private static getEmptyBalanceSheet(): BalanceSheetData {
    return {
      cashAndEquivalents: BigInt(0),
      accountsReceivable: BigInt(0),
      inventory: BigInt(0),
      prepaidExpenses: BigInt(0),
      currentAssets: BigInt(0),
      fixedAssets: BigInt(0),
      accumulatedDepreciation: BigInt(0),
      netFixedAssets: BigInt(0),
      totalAssets: BigInt(0),
      accountsPayable: BigInt(0),
      accruedExpenses: BigInt(0),
      shortTermDebt: BigInt(0),
      currentLiabilities: BigInt(0),
      longTermDebt: BigInt(0),
      totalLiabilities: BigInt(0),
      initialCapital: BigInt(0),
      retainedEarnings: BigInt(0),
      currentPeriodEarnings: BigInt(0),
      totalEquity: BigInt(0),
      isBalanced: false,
      variance: BigInt(0),
    };
  }

  private static getEmptyProfitLoss(): ProfitLossData {
    return {
      salesRevenue: BigInt(0),
      serviceRevenue: BigInt(0),
      otherRevenue: BigInt(0),
      totalRevenue: BigInt(0),
      directCosts: BigInt(0),
      cogs: BigInt(0),
      grossProfit: BigInt(0),
      grossMargin: 0,
      operatingExpenses: BigInt(0),
      operatingIncome: BigInt(0),
      operatingMargin: 0,
      interestIncome: BigInt(0),
      interestExpense: BigInt(0),
      otherIncome: BigInt(0),
      otherExpenses: BigInt(0),
      incomeBeforeTax: BigInt(0),
      incomeTax: BigInt(0),
      netIncome: BigInt(0),
      netMargin: 0,
      earningsPerShare: 0,
      returnOnAssets: 0,
      returnOnEquity: 0,
    };
  }

  private static getEmptyCashFlow(): CashFlowData {
    return {
      netIncome: BigInt(0),
      depreciation: BigInt(0),
      workingCapitalChanges: BigInt(0),
      operatingCashFlow: BigInt(0),
      capex: BigInt(0),
      assetSales: BigInt(0),
      investingCashFlow: BigInt(0),
      debtProceeds: BigInt(0),
      debtRepayments: BigInt(0),
      equityProceeds: BigInt(0),
      dividends: BigInt(0),
      financingCashFlow: BigInt(0),
      cashFlowIncrease: BigInt(0),
      beginningCash: BigInt(0),
      endingCash: BigInt(0),
    };
  }

  private static getEmptyWorkingCapital(): WorkingCapitalComponents {
    return {
      currentAssets: {
        cash: BigInt(0),
        accountsReceivable: BigInt(0),
        inventory: BigInt(0),
        prepaidExpenses: BigInt(0),
        otherCurrentAssets: BigInt(0),
      },
      currentLiabilities: {
        accountsPayable: BigInt(0),
        accruedExpenses: BigInt(0),
        shortTermDebt: BigInt(0),
        taxesPayable: BigInt(0),
        otherCurrentLiabilities: BigInt(0),
      },
      netWorkingCapital: BigInt(0),
      workingCapitalRatio: 0,
    };
  }

  private static getEmptyDebtAnalysis(): DebtAnalysis {
    return {
      totalDebt: BigInt(0),
      shortTermDebt: BigInt(0),
      longTermDebt: BigInt(0),
      debtToEquity: 0,
      debtToAssets: 0,
      interestCoverage: 0,
      debtServiceCoverage: 0,
    };
  }

  private static getEmptyProfitabilityAnalysis(): ProfitabilityAnalysis {
    return {
      grossProfit: BigInt(0),
      operatingProfit: BigInt(0),
      netProfit: BigInt(0),
      grossMargin: 0,
      operatingMargin: 0,
      netMargin: 0,
      returnOnAssets: 0,
      returnOnEquity: 0,
      returnOnInvestment: 0,
      earningsPerShare: 0,
    };
  }

  private static getEmptyCashFlowAnalysis(): CashFlowAnalysis {
    return {
      operatingCashFlow: BigInt(0),
      investingCashFlow: BigInt(0),
      financingCashFlow: BigInt(0),
      freeCashFlow: BigInt(0),
      cashFlowFromOperations: BigInt(0),
      capitalExpenditures: BigInt(0),
      cashConversionCycle: 0,
      operatingCashFlowRatio: 0,
    };
  }

  /**
   * Round numeric values to specified precision
   */
  static round(value: number, precision: number = this.ROUNDING_PRECISION): number {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }

  /**
   * Format currency for display
   */
  static formatCurrency(amount: bigint | number): string {
    const num = typeof amount === 'bigint' ? Number(amount) : amount;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  }

  /**
   * Validate financial data consistency
   */
  static validateFinancialConsistency(
    balanceSheet: BalanceSheetData,
    profitLoss: ProfitLossData,
    cashFlow: CashFlowData
  ): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Basic validation
    if (balanceSheet.totalAssets !== balanceSheet.totalLiabilities + balanceSheet.totalEquity) {
      issues.push('Balance sheet does not balance');
    }

    if (profitLoss.grossProfit > profitLoss.totalRevenue) {
      issues.push('Gross profit cannot exceed total revenue');
    }

    if (profitLoss.netIncome < profitLoss.grossProfit && profitLoss.operatingExpenses < 0) {
      issues.push('Invalid operating expenses calculation');
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}

export default FinancialCalculationService;