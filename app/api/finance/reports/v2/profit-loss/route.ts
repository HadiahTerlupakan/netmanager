import { NextRequest, NextResponse } from 'next/server';
import FinanceAuthService from '@/lib/services/FinanceAuthService';
import FinancialCalculationService from '@/lib/services/FinancialCalculationService';
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
      'PROFIT_LOSS_V2',
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

    // Calculate profit & loss with enhanced accuracy
    const profitLossResult = await FinancialCalculationService.calculateProfitLoss(filters);

    // Additional calculations for comprehensive P&L analysis
    const [profitabilityAnalysis, workingCapital] = await Promise.all([
      FinancialCalculationService.calculateProfitabilityAnalysis(filters),
      FinancialCalculationService.calculateWorkingCapital(filters),
    ]);

    // Get previous period data for comparison if requested
    let periodComparison = null;
    if (searchParams.get('includeComparison') === 'true' && filters.year && filters.month) {
      let previousYear = filters.year;
      let previousMonth = filters.month - 1;

      if (previousMonth === 0) {
        previousMonth = 12;
        previousYear--;
      }

      const previousPeriodData = await FinancialCalculationService.calculateProfitLoss({
        year: previousYear,
        month: previousMonth,
      });

      periodComparison = {
        previousPeriod: {
          year: previousYear,
          month: previousMonth,
        },
        revenue: {
          current: profitLossResult.data.totalRevenue,
          previous: previousPeriodData.data.totalRevenue,
          change: profitLossResult.data.totalRevenue - previousPeriodData.data.totalRevenue,
          changePercent: previousPeriodData.data.totalRevenue > 0
            ? Number(((profitLossResult.data.totalRevenue - previousPeriodData.data.totalRevenue) * BigInt(100)) / previousPeriodData.data.totalRevenue)
            : 0,
        },
        expenses: {
          current: profitLossResult.data.operatingExpenses,
          previous: previousPeriodData.data.operatingExpenses,
          change: profitLossResult.data.operatingExpenses - previousPeriodData.data.operatingExpenses,
          changePercent: previousPeriodData.data.operatingExpenses > 0
            ? Number(((profitLossResult.data.operatingExpenses - previousPeriodData.data.operatingExpenses) * BigInt(100)) / previousPeriodData.data.operatingExpenses)
            : 0,
        },
        netIncome: {
          current: profitLossResult.data.netIncome,
          previous: previousPeriodData.data.netIncome,
          change: profitLossResult.data.netIncome - previousPeriodData.data.netIncome,
          changePercent: previousPeriodData.data.netIncome > 0
            ? Number(((profitLossResult.data.netIncome - previousPeriodData.data.netIncome) * BigInt(100)) / previousPeriodData.data.netIncome)
            : 0,
        },
      };
    }

    // Construct comprehensive response
    const response = {
      success: true,
      data: {
        profitLoss: profitLossResult.data,
        profitabilityAnalysis: profitabilityAnalysis.data,
        workingCapital: workingCapital.data,
      },
      metadata: {
        calculatedAt: profitLossResult.metadata.calculatedAt,
        dataSource: profitLossResult.metadata.dataSource,
        calculationMethod: profitLossResult.metadata.calculationMethod,
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
        isAccurate: profitLossResult.isAccurate,
        warnings: profitLossResult.warnings,
        errors: profitLossResult.errors,
      },
      financialMetrics: {
        revenueBreakdown: {
          salesRevenue: profitLossResult.data.salesRevenue,
          serviceRevenue: profitLossResult.data.serviceRevenue,
          otherRevenue: profitLossResult.data.otherRevenue,
          totalRevenue: profitLossResult.data.totalRevenue,
        },
        profitMetrics: {
          grossProfit: profitLossResult.data.grossProfit,
          grossMargin: profitLossResult.data.grossMargin,
          operatingProfit: profitLossResult.data.operatingIncome,
          operatingMargin: profitLossResult.data.operatingMargin,
          netProfit: profitLossResult.data.netIncome,
          netMargin: profitLossResult.data.netMargin,
        },
        profitabilityRatios: {
          returnOnAssets: profitabilityAnalysis.data.returnOnAssets,
          returnOnEquity: profitabilityAnalysis.data.returnOnEquity,
          returnOnInvestment: profitabilityAnalysis.data.returnOnInvestment,
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
      status: profitLossResult.isAccurate ? 200 : 207, // 207 for success with warnings
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Profit & Loss v2 API error:', error);

    // Log error for audit
    try {
      await FinanceAuthService.logFinancialAccess(
        request,
        { id: 'unknown', email: 'unknown', name: 'unknown', role: 'unknown' },
        'ERROR',
        'PROFIT_LOSS_V2',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error while calculating profit & loss',
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
      'PROFIT_LOSS_V2',
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

    // Calculate profit & loss
    const profitLossResult = await FinancialCalculationService.calculateProfitLoss(filters);

    if (!profitLossResult.isAccurate && !forceRecalculate) {
      return NextResponse.json(
        {
          success: false,
          error: 'Profit & Loss calculation has accuracy issues',
          errorCode: 'CALCULATION_INACCURATE',
          warnings: profitLossResult.warnings,
          errors: profitLossResult.errors,
        },
        { status: 422 }
      );
    }

    // Create snapshot
    const snapshot = await FinancialCalculationService.createProfitLossSnapshot(
      periodId,
      profitLossResult.data
    );

    // Log snapshot creation
    await FinanceAuthService.logFinancialAccess(
      request,
      authResult.user!,
      'CREATE_SNAPSHOT',
      'PROFIT_LOSS_V2',
      { periodId, snapshotId: snapshot.id }
    );

    const response = {
      success: true,
      data: {
        snapshot,
        profitLoss: profitLossResult.data,
      },
      metadata: {
        calculatedAt: profitLossResult.metadata.calculatedAt,
        createdBy: authResult.user!.id,
        periodId,
      },
      validation: {
        isAccurate: profitLossResult.isAccurate,
        warnings: profitLossResult.warnings,
        errors: profitLossResult.errors,
      },
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Profit & Loss v2 POST error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error while creating profit & loss snapshot',
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