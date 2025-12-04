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
      'FINANCIAL_RATIOS_V2',
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

    const includeComparison = searchParams.get('includeComparison') === 'true';
    const includeIndustryBenchmarks = searchParams.get('includeIndustryBenchmarks') === 'true';

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

    // Calculate all financial ratios and related analyses
    const [
      balanceSheet,
      profitLoss,
      cashFlow,
      financialRatios,
      workingCapital,
      debtAnalysis,
      profitabilityAnalysis,
      cashFlowAnalysis,
    ] = await Promise.all([
      FinancialCalculationService.calculateBalanceSheet(filters),
      FinancialCalculationService.calculateProfitLoss(filters),
      FinancialCalculationService.calculateCashFlow(filters),
      FinancialReportingRepository.calculateFinancialRatios(filters),
      FinancialCalculationService.calculateWorkingCapital(filters),
      FinancialCalculationService.calculateDebtAnalysis(filters),
      FinancialCalculationService.calculateProfitabilityAnalysis(filters),
      FinancialCalculationService.calculateCashFlowAnalysis(filters),
    ]);

    // Get comparison data if requested
    let comparisonData = null;
    if (includeComparison && filters.year && filters.month) {
      let previousYear = filters.year;
      let previousMonth = filters.month - 1;

      if (previousMonth === 0) {
        previousMonth = 12;
        previousYear--;
      }

      const previousRatios = await FinancialReportingRepository.calculateFinancialRatios({
        year: previousYear,
        month: previousMonth,
      });

      comparisonData = {
        previousPeriod: {
          year: previousYear,
          month: previousMonth,
        },
        ratios: {
          current: financialRatios,
          previous: previousRatios,
          changes: {
            currentRatio: financialRatios.currentRatio - previousRatios.currentRatio,
            quickRatio: financialRatios.quickRatio - previousRatios.quickRatio,
            grossMargin: financialRatios.grossMargin - previousRatios.grossMargin,
            netMargin: financialRatios.netMargin - previousRatios.netMargin,
            returnOnAssets: financialRatios.returnOnAssets - previousRatios.returnOnAssets,
            returnOnEquity: financialRatios.returnOnEquity - previousRatios.returnOnEquity,
            debtToEquity: financialRatios.debtToEquity - previousRatios.debtToEquity,
          },
        },
      };
    }

    // Industry benchmarks for ISP/Telecom companies
    const industryBenchmarks = includeIndustryBenchmarks ? {
      liquidity: {
        currentRatio: { min: 1.2, max: 2.0, average: 1.5 },
        quickRatio: { min: 0.8, max: 1.5, average: 1.1 },
        cashRatio: { min: 0.2, max: 0.8, average: 0.4 },
      },
      profitability: {
        grossMargin: { min: 30, max: 60, average: 45 }, // ISP typically has high margins
        operatingMargin: { min: 10, max: 35, average: 20 },
        netMargin: { min: 5, max: 25, average: 12 },
        returnOnAssets: { min: 2, max: 15, average: 6 },
        returnOnEquity: { min: 5, max: 20, average: 10 },
      },
      efficiency: {
        assetTurnover: { min: 0.5, max: 2.0, average: 1.0 },
        receivablesTurnover: { min: 4, max: 12, average: 6 },
        inventoryTurnover: { min: 0, max: 2, average: 0.5 }, // ISPs typically have low inventory
      },
      solvency: {
        debtToEquity: { min: 0.3, max: 2.0, average: 1.0 },
        debtToAssets: { min: 0.2, max: 0.7, average: 0.4 },
        interestCoverage: { min: 2, max: 10, average: 4 },
      },
    } : null;

    // Calculate ratio health scores
    const ratioHealthScores = {
      liquidity: calculateRatioHealth(financialRatios.currentRatio, 1.5, 'higher'), // Optimal: 1.5
      quickRatio: calculateRatioHealth(financialRatios.quickRatio, 1.1, 'higher'), // Optimal: 1.1
      profitability: calculateRatioHealth(financialRatios.netMargin, 12, 'higher'), // Optimal: 12%
      efficiency: calculateRatioHealth(financialRatios.assetTurnover, 1.0, 'higher'), // Optimal: 1.0
      solvency: calculateRatioHealth(financialRatios.debtToEquity, 1.0, 'lower'), // Optimal: 1.0 or lower
      overall: 0, // Will be calculated below
    };

    ratioHealthScores.overall = (
      ratioHealthScores.liquidity +
      ratioHealthScores.quickRatio +
      ratioHealthScores.profitability +
      ratioHealthScores.efficiency +
      ratioHealthScores.solvency
    ) / 5;

    // Generate recommendations based on ratios
    const recommendations = generateRatioRecommendations(
      financialRatios,
      ratioHealthScores,
      industryBenchmarks
    );

    // Construct comprehensive response
    const response = {
      success: true,
      data: {
        financialRatios,
        detailedAnalysis: {
          balanceSheet: balanceSheet.data,
          profitLoss: profitLoss.data,
          cashFlow: cashFlow.data,
          workingCapital: workingCapital.data,
          debtAnalysis: debtAnalysis.data,
          profitabilityAnalysis: profitabilityAnalysis.data,
          cashFlowAnalysis: cashFlowAnalysis.data,
        },
      },
      metadata: {
        calculatedAt: new Date().toISOString(),
        dataSource: 'comprehensive_calculation',
        calculationMethod: 'standard_financial_ratios',
        filters,
        user: {
          id: authResult.user!.id,
          email: authResult.user!.email,
        },
        requestInfo: {
          ipAddress: authResult.ipAddress,
          userAgent: authResult.userAgent,
        },
      },
      validation: {
        isAccurate: balanceSheet.isAccurate && profitLoss.isAccurate && cashFlow.isAccurate,
        warnings: [
          ...balanceSheet.warnings,
          ...profitLoss.warnings,
          ...cashFlow.warnings,
        ],
        errors: [
          ...balanceSheet.errors,
          ...profitLoss.errors,
          ...cashFlow.errors,
        ],
      },
      ratioAnalysis: {
        healthScores: ratioHealthScores,
        recommendations,
        industryComparison: industryBenchmarks ? {
          currentRatios: financialRatios,
          benchmarks: industryBenchmarks,
          performance: {
            liquidity: compareWithBenchmark(financialRatios.currentRatio, industryBenchmarks.liquidity.currentRatio),
            profitability: compareWithBenchmark(financialRatios.netMargin, industryBenchmarks.profitability.netMargin),
            efficiency: compareWithBenchmark(financialRatios.assetTurnover, industryBenchmarks.efficiency.assetTurnover),
            solvency: compareWithBenchmark(financialRatios.debtToEquity, industryBenchmarks.solvency.debtToEquity, true),
          },
        } : null,
      },
      periodComparison: comparisonData,
    };

    // Set cache headers for better performance
    const responseHeaders = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=600, stale-while-revalidate=1200', // 10 minutes cache
    });

    return NextResponse.json(response, {
      status: 200,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Financial Ratios v2 API error:', error);

    // Log error for audit
    try {
      await FinanceAuthService.logFinancialAccess(
        request,
        { id: 'unknown', email: 'unknown', name: 'unknown', role: 'unknown' },
        'ERROR',
        'FINANCIAL_RATIOS_V2',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error while calculating financial ratios',
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
function calculateRatioHealth(value: number, optimal: number, direction: 'higher' | 'lower'): number {
  if (direction === 'higher') {
    if (value >= optimal) return 100;
    if (value >= optimal * 0.8) return 85;
    if (value >= optimal * 0.6) return 70;
    if (value >= optimal * 0.4) return 55;
    if (value >= optimal * 0.2) return 40;
    return 20;
  } else {
    if (value <= optimal) return 100;
    if (value <= optimal * 1.2) return 85;
    if (value <= optimal * 1.4) return 70;
    if (value <= optimal * 1.6) return 55;
    if (value <= optimal * 1.8) return 40;
    return 20;
  }
}

function compareWithBenchmark(value: number, benchmark: { min: number; max: number; average: number }, inverse: boolean = false): string {
  if (inverse) {
    // For ratios where lower is better (like debt ratios)
    if (value <= benchmark.min) return 'EXCELLENT';
    if (value <= benchmark.average) return 'GOOD';
    if (value <= benchmark.max) return 'FAIR';
    return 'POOR';
  } else {
    // For ratios where higher is better
    if (value >= benchmark.max) return 'EXCELLENT';
    if (value >= benchmark.average) return 'GOOD';
    if (value >= benchmark.min) return 'FAIR';
    return 'POOR';
  }
}

function generateRatioRecommendations(
  ratios: any,
  healthScores: any,
  benchmarks: any
): string[] {
  const recommendations: string[] = [];

  // Liquidity recommendations
  if (healthScores.liquidity < 60) {
    recommendations.push('Improve liquidity by increasing cash reserves or reducing current liabilities');
  }
  if (ratios.currentRatio < 1) {
    recommendations.push('Current ratio is below 1.0 - immediate attention needed for short-term obligations');
  }

  // Profitability recommendations
  if (healthScores.profitability < 60) {
    recommendations.push('Review pricing strategy and cost structure to improve profitability');
  }
  if (ratios.netMargin < 5) {
    recommendations.push('Net margin is below 5% - consider operational improvements');
  }

  // Efficiency recommendations
  if (healthScores.efficiency < 60) {
    recommendations.push('Improve asset utilization to enhance operational efficiency');
  }
  if (ratios.assetTurnover < 0.5) {
    recommendations.push('Low asset turnover indicates underutilized assets - review asset deployment');
  }

  // Solvency recommendations
  if (healthScores.solvency < 60) {
    recommendations.push('Reduce debt levels or improve equity position to strengthen financial stability');
  }
  if (ratios.debtToEquity > 2) {
    recommendations.push('High debt-to-equity ratio (>2.0) - consider debt restructuring or equity infusion');
  }

  // Industry-specific recommendations for ISP
  if (benchmarks) {
    if (ratios.grossMargin < benchmarks.profitability.grossMargin.min) {
      recommendations.push('Gross margin is below industry average for ISP companies - review service pricing');
    }
    if (ratios.receivablesTurnover < benchmarks.efficiency.receivablesTurnover.min) {
      recommendations.push('Improve collection process to accelerate receivables turnover');
    }
  }

  return recommendations;
}