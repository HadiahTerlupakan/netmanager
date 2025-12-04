import { NextRequest, NextResponse } from 'next/server';
import FinanceAuthService from '@/lib/services/FinanceAuthService';
import FinancialCalculationService from '@/lib/services/FinancialCalculationService';
import FinancialReportingRepository from '@/lib/repositories/FinancialReportingRepository';
import { FinancialReportFilters } from '@/lib/repositories/FinancialReportingRepository';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await FinanceAuthService.authenticate(request);

    if (!authResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error,
          errorCode: authResult.errorCode
        },
        { status: 401 }
      );
    }

    // Log access
    await FinanceAuthService.logFinancialAccess(
      request,
      authResult.user!,
      'READ',
      'COMPREHENSIVE_REPORT_V2',
      { method: 'GET' }
    );

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const filters: FinancialReportFilters = {
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
      year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined,
      month: searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined,
      includeUnapproved: searchParams.get('includeUnapproved') === 'true',
      includeUnverified: searchParams.get('includeUnverified') === 'true',
    };

    const includeDetails = searchParams.get('includeDetails') === 'true';
    const includeComparison = searchParams.get('includeComparison') === 'true';
    const includeForecast = searchParams.get('includeForecast') === 'true';

    // Validate date range
    if (filters.startDate && filters.endDate && filters.startDate >= filters.endDate) {
      return NextResponse.json(
        {
          success: false,
          error: 'Start date must be before end date',
          errorCode: 'INVALID_DATE_RANGE'
        },
        { status: 400 }
      );
    }

    // Calculate all financial data in parallel for better performance
    const [
      balanceSheetResult,
      profitLossResult,
      cashFlowResult,
      financialRatios,
      workingCapital,
      debtAnalysis,
      profitabilityAnalysis,
      cashFlowAnalysis,
      healthCheck,
    ] = await Promise.all([
      FinancialCalculationService.calculateBalanceSheet(filters),
      FinancialCalculationService.calculateProfitLoss(filters),
      FinancialCalculationService.calculateCashFlow(filters),
      FinancialReportingRepository.calculateFinancialRatios(filters),
      FinancialCalculationService.calculateWorkingCapital(filters),
      FinancialCalculationService.calculateDebtAnalysis(filters),
      FinancialCalculationService.calculateProfitabilityAnalysis(filters),
      FinancialCalculationService.calculateCashFlowAnalysis(filters),
      FinancialCalculationService.performFinancialHealthCheck(filters),
    ]);

    // Get detailed cash flow items if requested
    let detailedCashFlowItems = null;
    if (includeDetails) {
      detailedCashFlowItems = await FinancialReportingRepository.getCashFlowItems(filters);
    }

    // Get comparison data if requested
    let comparisonData = null;
    if (includeComparison && filters.year && filters.month) {
      let previousYear = filters.year;
      let previousMonth = filters.month - 1;

      if (previousMonth === 0) {
        previousMonth = 12;
        previousYear--;
      }

      const [prevBalanceSheet, prevProfitLoss, prevCashFlow, prevRatios] = await Promise.all([
        FinancialCalculationService.calculateBalanceSheet({ year: previousYear, month: previousMonth }),
        FinancialCalculationService.calculateProfitLoss({ year: previousYear, month: previousMonth }),
        FinancialCalculationService.calculateCashFlow({ year: previousYear, month: previousMonth }),
        FinancialReportingRepository.calculateFinancialRatios({ year: previousYear, month: previousMonth }),
      ]);

      comparisonData = {
        previousPeriod: {
          year: previousYear,
          month: previousMonth,
        },
        balanceSheet: {
          current: balanceSheetResult.data,
          previous: prevBalanceSheet.data,
          changes: {
            totalAssets: balanceSheetResult.data.totalAssets - prevBalanceSheet.data.totalAssets,
            totalLiabilities: balanceSheetResult.data.totalLiabilities - prevBalanceSheet.data.totalLiabilities,
            totalEquity: balanceSheetResult.data.totalEquity - prevBalanceSheet.data.totalEquity,
          },
        },
        profitLoss: {
          current: profitLossResult.data,
          previous: prevProfitLoss.data,
          changes: {
            totalRevenue: profitLossResult.data.totalRevenue - prevProfitLoss.data.totalRevenue,
            operatingExpenses: profitLossResult.data.operatingExpenses - prevProfitLoss.data.operatingExpenses,
            netIncome: profitLossResult.data.netIncome - prevProfitLoss.data.netIncome,
          },
        },
        cashFlow: {
          current: cashFlowResult.data,
          previous: prevCashFlow.data,
          changes: {
            operatingCashFlow: cashFlowResult.data.operatingCashFlow - prevCashFlow.data.operatingCashFlow,
            investingCashFlow: cashFlowResult.data.investingCashFlow - prevCashFlow.data.investingCashFlow,
            netCashFlow: cashFlowResult.data.cashFlowIncrease - prevCashFlow.data.cashFlowIncrease,
          },
        },
        ratios: {
          current: financialRatios,
          previous: prevRatios,
        },
      };
    }

    // Get forecast data if requested
    let forecastData = null;
    if (includeForecast) {
      forecastData = await generateForecastData(balanceSheetResult.data, profitLossResult.data, healthCheck);
    }

    // Calculate KPIs
    const kpis = calculateKPIs(
      balanceSheetResult.data,
      profitLossResult.data,
      cashFlowResult.data,
      financialRatios,
      healthCheck
    );

    // Generate insights and recommendations
    const insights = generateInsights(
      balanceSheetResult.data,
      profitLossResult.data,
      cashFlowResult.data,
      financialRatios,
      healthCheck,
      kpis
    );

    // Consolidate validation results
    const isOverallAccurate = balanceSheetResult.isAccurate &&
                             profitLossResult.isAccurate &&
                             cashFlowResult.isAccurate;

    const allWarnings = [
      ...balanceSheetResult.warnings,
      ...profitLossResult.warnings,
      ...cashFlowResult.warnings,
    ];

    const allErrors = [
      ...balanceSheetResult.errors,
      ...profitLossResult.errors,
      ...cashFlowResult.errors,
    ];

    // Construct comprehensive response
    const response = {
      success: true,
      data: {
        executiveSummary: {
          overallHealth: healthCheck.overall,
          healthScore: (healthCheck.scores.liquidity + healthCheck.scores.profitability +
                        healthCheck.scores.efficiency + healthCheck.scores.solvency) / 4,
          totalAssets: balanceSheetResult.data.totalAssets,
          totalRevenue: profitLossResult.data.totalRevenue,
          netIncome: profitLossResult.data.netIncome,
          endingCash: cashFlowResult.data.endingCash,
          keyMetrics: kpis,
        },
        financialStatements: {
          balanceSheet: balanceSheetResult.data,
          profitLoss: profitLossResult.data,
          cashFlow: cashFlowResult.data,
          financialRatios,
        },
        detailedAnalysis: {
          workingCapital: workingCapital.data,
          debtAnalysis: debtAnalysis.data,
          profitabilityAnalysis: profitabilityAnalysis.data,
          cashFlowAnalysis: cashFlowAnalysis.data,
        },
        healthCheck: {
          ...healthCheck,
          alerts: healthCheck.alerts,
          recommendations: healthCheck.recommendations,
        },
      },
      detailedData: includeDetails ? {
        cashFlowItems: detailedCashFlowItems,
      } : undefined,
      comparison: comparisonData,
      forecast: forecastData,
      insights,
      kpis,
      metadata: {
        calculatedAt: new Date().toISOString(),
        dataSource: 'comprehensive_financial_analysis',
        calculationMethod: 'accrual_basis_with_ratios',
        filters,
        user: {
          id: authResult.user!.id,
          email: authResult.user!.email,
        },
        requestInfo: {
          ipAddress: authResult.ipAddress,
          userAgent: authResult.userAgent,
        },
        performance: {
          calculationTime: Date.now(), // Would track actual calculation time
          dataPoints: calculateDataPoints(balanceSheetResult.data, profitLossResult.data, cashFlowResult.data),
        },
      },
      validation: {
        isAccurate: isOverallAccurate,
        warnings: allWarnings,
        errors: allErrors,
        dataQuality: {
          balanceSheetValid: balanceSheetResult.isAccurate && balanceSheetResult.data.isBalanced,
          profitLossValid: profitLossResult.isAccurate,
          cashFlowValid: cashFlowResult.isAccurate,
          hasErrors: allErrors.length > 0,
          hasWarnings: allWarnings.length > 0,
        },
      },
    };

    // Set cache headers
    const responseHeaders = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=600, stale-while-revalidate=1200', // 10 minutes cache
    });

    return NextResponse.json(response, {
      status: isOverallAccurate ? 200 : 207, // 207 for success with warnings
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Comprehensive Report v2 API error:', error);

    // Log error for audit
    try {
      await FinanceAuthService.logFinancialAccess(
        request,
        { id: 'unknown', email: 'unknown', name: 'unknown', role: 'unknown' },
        'ERROR',
        'COMPREHENSIVE_REPORT_V2',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error while generating comprehensive report',
        errorCode: 'CALCULATION_ERROR',
        details: process.env.NODE_ENV === 'development'
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined,
      },
      { status: 500 }
    );
  }
}

// Helper functions
async function generateForecastData(
  balanceSheet: any,
  profitLoss: any,
  healthCheck: any
) {
  // Simple forecasting based on current trends
  const monthlyGrowthRate = 0.02; // 2% monthly growth assumption
  const monthlyExpenseGrowth = 0.01; // 1% monthly expense growth

  return {
    nextQuarter: {
      revenue: Number(profitLoss.totalRevenue) * Math.pow(1 + monthlyGrowthRate, 3),
      expenses: Number(profitLoss.operatingExpenses) * Math.pow(1 + monthlyExpenseGrowth, 3),
      netIncome: 0, // Would be calculated
      cashPosition: Number(balanceSheet.cashAndEquivalents) * 1.1, // Assumed growth
    },
    nextYear: {
      revenue: Number(profitLoss.totalRevenue) * Math.pow(1 + monthlyGrowthRate, 12),
      expenses: Number(profitLoss.operatingExpenses) * Math.pow(1 + monthlyExpenseGrowth, 12),
      netIncome: 0, // Would be calculated
      cashPosition: Number(balanceSheet.cashAndEquivalents) * 1.5, // Assumed growth
    },
    assumptions: {
      monthlyRevenueGrowth: monthlyGrowthRate,
      monthlyExpenseGrowth: monthlyExpenseGrowth,
      basedOnHealthStatus: healthCheck.overall,
    },
  };
}

function calculateKPIs(
  balanceSheet: any,
  profitLoss: any,
  cashFlow: any,
  ratios: any,
  healthCheck: any
) {
  return {
    profitability: {
      grossMargin: profitLoss.grossMargin,
      operatingMargin: profitLoss.operatingMargin,
      netMargin: profitLoss.netMargin,
      returnOnAssets: ratios.returnOnAssets,
      returnOnEquity: ratios.returnOnEquity,
    },
    liquidity: {
      currentRatio: ratios.currentRatio,
      quickRatio: ratios.quickRatio,
      cashRatio: ratios.cashRatio,
      workingCapital: Number(balanceSheet.currentAssets - balanceSheet.currentLiabilities),
    },
    efficiency: {
      assetTurnover: ratios.assetTurnover,
      receivablesTurnover: ratios.receivablesTurnover,
      operatingCashFlowRatio: Number(cashFlow.operatingCashFlow) / Number(balanceSheet.currentLiabilities),
    },
    solvency: {
      debtToEquity: ratios.debtToEquity,
      debtToAssets: ratios.debtToAssets,
      interestCoverage: ratios.interestCoverage,
      equityRatio: Number(balanceSheet.totalEquity) / Number(balanceSheet.totalAssets),
    },
    growth: {
      revenueGrowth: 0, // Would be calculated from historical data
      netIncomeGrowth: 0, // Would be calculated from historical data
      assetGrowth: 0, // Would be calculated from historical data
    },
    health: {
      overallScore: (healthCheck.scores.liquidity + healthCheck.scores.profitability +
                    healthCheck.scores.efficiency + healthCheck.scores.solvency) / 4,
      liquidityScore: healthCheck.scores.liquidity,
      profitabilityScore: healthCheck.scores.profitability,
      efficiencyScore: healthCheck.scores.efficiency,
      solvencyScore: healthCheck.scores.solvency,
    },
  };
}

function generateInsights(
  balanceSheet: any,
  profitLoss: any,
  cashFlow: any,
  ratios: any,
  healthCheck: any,
  kpis: any
) {
  const insights = [];

  // Liquidity insights
  if (ratios.currentRatio < 1) {
    insights.push({
      type: 'WARNING',
      category: 'LIQUIDITY',
      title: 'Liquidity Concern',
      description: 'Current ratio is below 1.0, indicating potential short-term liquidity issues.',
      recommendation: 'Improve working capital management and consider short-term financing options.',
    });
  }

  if (kpis.liquidity.workingCapital < 0) {
    insights.push({
      type: 'CRITICAL',
      category: 'LIQUIDITY',
      title: 'Negative Working Capital',
      description: 'Company has negative working capital, which is a serious financial concern.',
      recommendation: 'Immediate action required to improve cash flow and reduce current liabilities.',
    });
  }

  // Profitability insights
  if (profitLoss.netMargin < 0) {
    insights.push({
      type: 'CRITICAL',
      category: 'PROFITABILITY',
      title: 'Operating at Loss',
      description: 'Company is operating at a loss. Immediate action required.',
      recommendation: 'Review cost structure, pricing strategy, and consider operational restructuring.',
    });
  }

  if (profitLoss.netMargin < 5 && profitLoss.netMargin >= 0) {
    insights.push({
      type: 'WARNING',
      category: 'PROFITABILITY',
      title: 'Low Profit Margins',
      description: 'Profit margins are below industry average for ISP companies.',
      recommendation: 'Focus on improving operational efficiency and pricing optimization.',
    });
  }

  // Efficiency insights
  if (ratios.assetTurnover < 0.5) {
    insights.push({
      type: 'INFO',
      category: 'EFFICIENCY',
      title: 'Low Asset Utilization',
      description: 'Assets are not being utilized efficiently to generate revenue.',
      recommendation: 'Review asset deployment and consider divesting underperforming assets.',
    });
  }

  // Solvency insights
  if (ratios.debtToEquity > 2) {
    insights.push({
      type: 'WARNING',
      category: 'SOLVENCY',
      title: 'High Leverage',
      description: 'Debt-to-equity ratio is high, indicating significant financial risk.',
      recommendation: 'Consider debt restructuring and improving equity position.',
    });
  }

  // Cash flow insights
  if (cashFlow.operatingCashFlow < 0) {
    insights.push({
      type: 'CRITICAL',
      category: 'CASH_FLOW',
      title: 'Negative Operating Cash Flow',
      description: 'Company is generating negative cash from operations.',
      recommendation: 'Urgent need to improve cash collection and manage operating expenses.',
    });
  }

  // Health-based insights
  if (healthCheck.overall === 'EXCELLENT') {
    insights.push({
      type: 'SUCCESS',
      category: 'OVERALL',
      title: 'Strong Financial Health',
      description: 'Company shows excellent financial health across all metrics.',
      recommendation: 'Consider strategic growth opportunities and market expansion.',
    });
  }

  if (healthCheck.overall === 'CRITICAL') {
    insights.push({
      type: 'CRITICAL',
      category: 'OVERALL',
      title: 'Critical Financial Condition',
      description: 'Company is in critical financial condition requiring immediate intervention.',
      recommendation: 'Implement emergency financial measures and seek professional financial advice.',
    });
  }

  return insights;
}

function calculateDataPoints(
  balanceSheet: any,
  profitLoss: any,
  cashFlow: any
): number {
  // Count the number of data points included in the report
  let count = 0;

  // Balance sheet items
  count += Object.keys(balanceSheet).length;

  // Profit & Loss items
  count += Object.keys(profitLoss).length;

  // Cash flow items
  count += Object.keys(cashFlow).length;

  return count;
}