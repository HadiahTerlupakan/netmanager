import { NextRequest, NextResponse } from 'next/server';
import FinanceAuthService from '@/lib/services/FinanceAuthService';
import FinancialCalculationService from '@/lib/services/FinancialCalculationService';
import FinancialReportingRepository, { CashFlowItem } from '@/lib/repositories/FinancialReportingRepository';
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
      'CASH_FLOW_V2',
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

    const includeDetailedItems = searchParams.get('includeDetails') === 'true';
    const groupByCategory = searchParams.get('groupByCategory') === 'true';

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

    // Calculate cash flow with proper reconciliation
    const cashFlowResult = await FinancialCalculationService.calculateCashFlow(filters);

    // Additional calculations for comprehensive cash flow analysis
    const [cashFlowAnalysis] = await Promise.all([
      FinancialCalculationService.calculateCashFlowAnalysis(filters),
    ]);

    // Get detailed cash flow items if requested
    let detailedCashFlowItems: CashFlowItem[] = [];
    let categoryBreakdown: Record<string, { inflow: bigint; outflow: bigint; net: bigint }> = {};

    if (includeDetailedItems) {
      detailedCashFlowItems = await FinancialReportingRepository.getCashFlowItems(filters);

      if (groupByCategory) {
        // Group items by category
        categoryBreakdown = detailedCashFlowItems.reduce((acc, item) => {
          const category = item.category;
          if (!acc[category]) {
            acc[category] = { inflow: BigInt(0), outflow: BigInt(0), net: BigInt(0) };
          }

          if (item.type === 'INFLOW') {
            acc[category].inflow += item.amount;
            acc[category].net += item.amount;
          } else {
            acc[category].outflow += item.amount;
            acc[category].net -= item.amount;
          }

          return acc;
        }, {} as Record<string, { inflow: bigint; outflow: bigint; net: bigint }>);
      }
    }

    // Get previous period data for comparison if requested
    let periodComparison = null;
    if (searchParams.get('includeComparison') === 'true' && filters.year && filters.month) {
      let previousYear = filters.year;
      let previousMonth = filters.month - 1;

      if (previousMonth === 0) {
        previousMonth = 12;
        previousYear--;
      }

      const previousPeriodData = await FinancialCalculationService.calculateCashFlow({
        year: previousYear,
        month: previousMonth,
      });

      periodComparison = {
        previousPeriod: {
          year: previousYear,
          month: previousMonth,
        },
        operatingCashFlow: {
          current: cashFlowResult.data.operatingCashFlow,
          previous: previousPeriodData.data.operatingCashFlow,
          change: cashFlowResult.data.operatingCashFlow - previousPeriodData.data.operatingCashFlow,
          changePercent: previousPeriodData.data.operatingCashFlow > 0
            ? Number(((cashFlowResult.data.operatingCashFlow - previousPeriodData.data.operatingCashFlow) * BigInt(100)) / previousPeriodData.data.operatingCashFlow)
            : 0,
        },
        investingCashFlow: {
          current: cashFlowResult.data.investingCashFlow,
          previous: previousPeriodData.data.investingCashFlow,
          change: cashFlowResult.data.investingCashFlow - previousPeriodData.data.investingCashFlow,
          changePercent: previousPeriodData.data.investingCashFlow !== BigInt(0)
            ? Number(((cashFlowResult.data.investingCashFlow - previousPeriodData.data.investingCashFlow) * BigInt(100)) / Math.abs(Number(previousPeriodData.data.investingCashFlow)))
            : 0,
        },
        netCashFlow: {
          current: cashFlowResult.data.cashFlowIncrease,
          previous: previousPeriodData.data.cashFlowIncrease,
          change: cashFlowResult.data.cashFlowIncrease - previousPeriodData.data.cashFlowIncrease,
          changePercent: previousPeriodData.data.cashFlowIncrease !== BigInt(0)
            ? Number(((cashFlowResult.data.cashFlowIncrease - previousPeriodData.data.cashFlowIncrease) * BigInt(100)) / Math.abs(Number(previousPeriodData.data.cashFlowIncrease)))
            : 0,
        },
      };
    }

    // Construct comprehensive response
    const response = {
      success: true,
      data: {
        cashFlow: cashFlowResult.data,
        cashFlowAnalysis: cashFlowAnalysis.data,
        detailedItems: includeDetailedItems ? detailedCashFlowItems : undefined,
        categoryBreakdown: Object.keys(categoryBreakdown).length > 0 ? categoryBreakdown : undefined,
      },
      metadata: {
        calculatedAt: cashFlowResult.metadata.calculatedAt,
        dataSource: cashFlowResult.metadata.dataSource,
        calculationMethod: cashFlowResult.metadata.calculationMethod,
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
        isAccurate: cashFlowResult.isAccurate,
        warnings: cashFlowResult.warnings,
        errors: cashFlowResult.errors,
        cashFlowReconciled: cashFlowResult.data.beginningCash + cashFlowResult.data.cashFlowIncrease === cashFlowResult.data.endingCash,
      },
      cashFlowMetrics: {
        operatingActivities: {
          netIncome: cashFlowResult.data.netIncome,
          depreciation: cashFlowResult.data.depreciation,
          workingCapitalChanges: cashFlowResult.data.workingCapitalChanges,
          operatingCashFlow: cashFlowResult.data.operatingCashFlow,
        },
        investingActivities: {
          capex: cashFlowResult.data.capex,
          assetSales: cashFlowResult.data.assetSales,
          investingCashFlow: cashFlowResult.data.investingCashFlow,
        },
        financingActivities: {
          debtProceeds: cashFlowResult.data.debtProceeds,
          debtRepayments: cashFlowResult.data.debtRepayments,
          equityProceeds: cashFlowResult.data.equityProceeds,
          dividends: cashFlowResult.data.dividends,
          financingCashFlow: cashFlowResult.data.financingCashFlow,
        },
        cashPosition: {
          beginningCash: cashFlowResult.data.beginningCash,
          cashFlowIncrease: cashFlowResult.data.cashFlowIncrease,
          endingCash: cashFlowResult.data.endingCash,
          freeCashFlow: cashFlowAnalysis.data.freeCashFlow,
        },
      },
      periodComparison,
    };

    // Set cache headers for better performance
    const responseHeaders = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600', // 5 minutes cache
    });

    return NextResponse.json(response, {
      status: cashFlowResult.isAccurate ? 200 : 207, // 207 for success with warnings
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Cash Flow v2 API error:', error);

    // Log error for audit
    try {
      await FinanceAuthService.logFinancialAccess(
        request,
        { id: 'unknown', email: 'unknown', name: 'unknown', role: 'unknown' },
        'ERROR',
        'CASH_FLOW_V2',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error while calculating cash flow',
        errorCode: 'CALCULATION_ERROR',
        details: process.env.NODE_ENV === 'development'
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user (require higher permissions for creating snapshots)
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
      'CREATE',
      'CASH_FLOW_V2',
      { method: 'POST' }
    );

    const body = await request.json();
    const { periodId, forceRecalculate = false } = body;

    if (!periodId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Period ID is required',
          errorCode: 'MISSING_PERIOD_ID'
        },
        { status: 400 }
      );
    }

    // Get period filters
    const period = await getPeriodById(periodId);
    if (!period) {
      return NextResponse.json(
        {
          success: false,
          error: 'Period not found',
          errorCode: 'PERIOD_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    const filters: FinancialReportFilters = {
      year: period.year,
      month: period.month,
      quarter: period.quarter,
    };

    // Calculate cash flow
    const cashFlowResult = await FinancialCalculationService.calculateCashFlow(filters);

    if (!cashFlowResult.isAccurate && !forceRecalculate) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cash Flow calculation has accuracy issues',
          errorCode: 'CALCULATION_INACCURATE',
          warnings: cashFlowResult.warnings,
          errors: cashFlowResult.errors,
        },
        { status: 422 }
      );
    }

    // Create snapshot
    const snapshot = await FinancialCalculationService.createCashFlowSnapshot(
      periodId,
      cashFlowResult.data
    );

    // Log snapshot creation
    await FinanceAuthService.logFinancialAccess(
      request,
      authResult.user!,
      'CREATE_SNAPSHOT',
      'CASH_FLOW_V2',
      { periodId, snapshotId: snapshot.id }
    );

    const response = {
      success: true,
      data: {
        snapshot,
        cashFlow: cashFlowResult.data,
      },
      metadata: {
        calculatedAt: cashFlowResult.metadata.calculatedAt,
        createdBy: authResult.user!.id,
        periodId,
      },
      validation: {
        isAccurate: cashFlowResult.isAccurate,
        warnings: cashFlowResult.warnings,
        errors: cashFlowResult.errors,
      },
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Cash Flow v2 POST error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error while creating cash flow snapshot',
        errorCode: 'SNAPSHOT_CREATION_ERROR',
        details: process.env.NODE_ENV === 'development'
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined,
      },
      { status: 500 }
    );
  }
}

// Helper function to get period by ID
async function getPeriodById(periodId: string) {
  try {
    const { prisma } = await import('@/lib/prisma');
    return await prisma.accountingPeriod.findUnique({
      where: { id: periodId },
    });
  } catch (error) {
    console.error('Error getting period:', error);
    return null;
  }
}