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
      'BALANCE_SHEET_V2',
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

    // Calculate balance sheet with proper accounting principles
    const balanceSheetResult = await FinancialCalculationService.calculateBalanceSheet(filters);

    // Additional calculations for comprehensive balance sheet
    const [workingCapital, debtAnalysis] = await Promise.all([
      FinancialCalculationService.calculateWorkingCapital(filters),
      FinancialCalculationService.calculateDebtAnalysis(filters),
    ]);

    // Construct comprehensive response
    const response = {
      success: true,
      data: {
        balanceSheet: balanceSheetResult.data,
        workingCapital: workingCapital.data,
        debtAnalysis: debtAnalysis.data,
      },
      metadata: {
        calculatedAt: balanceSheetResult.metadata.calculatedAt,
        dataSource: balanceSheetResult.metadata.dataSource,
        calculationMethod: balanceSheetResult.metadata.calculationMethod,
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
        isAccurate: balanceSheetResult.isAccurate,
        warnings: balanceSheetResult.warnings,
        errors: balanceSheetResult.errors,
        isBalanced: balanceSheetResult.data.isBalanced,
        variance: balanceSheetResult.data.variance.toString(),
      },
      financialHealth: {
        liquidityRatio: workingCapital.data.workingCapitalRatio,
        debtToEquity: debtAnalysis.data.debtToEquity,
        debtToAssets: debtAnalysis.data.debtToAssets,
        currentRatio: workingCapital.data.workingCapitalRatio,
        quickRatio: (Number(balanceSheetResult.data.currentAssets - balanceSheetResult.data.inventory)) /
                   Number(balanceSheetResult.data.currentLiabilities) || 0,
      },
    };

    // Set cache headers for better performance
    const responseHeaders = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600', // 5 minutes cache
    });

    return NextResponse.json(response, {
      status: balanceSheetResult.isAccurate ? 200 : 207, // 207 for success with warnings
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Balance sheet v2 API error:', error);

    // Log error for audit
    try {
      await FinanceAuthService.logFinancialAccess(
        request,
        { id: 'unknown', email: 'unknown', name: 'unknown', role: 'unknown' },
        'ERROR',
        'BALANCE_SHEET_V2',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error while calculating balance sheet',
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
      'BALANCE_SHEET_V2',
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
    const period = await FinancialCalculationService.getPeriodById(periodId);
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

    // Calculate balance sheet
    const balanceSheetResult = await FinancialCalculationService.calculateBalanceSheet(filters);

    if (!balanceSheetResult.isAccurate && !forceRecalculate) {
      return NextResponse.json(
        {
          success: false,
          error: 'Balance sheet calculation has accuracy issues',
          errorCode: 'CALCULATION_INACCURATE',
          warnings: balanceSheetResult.warnings,
          errors: balanceSheetResult.errors,
        },
        { status: 422 }
      );
    }

    // Create snapshot
    const snapshot = await FinancialCalculationService.createBalanceSheetSnapshot(
      periodId,
      balanceSheetResult.data
    );

    // Log snapshot creation
    await FinanceAuthService.logFinancialAccess(
      request,
      authResult.user!,
      'CREATE_SNAPSHOT',
      'BALANCE_SHEET_V2',
      { periodId, snapshotId: snapshot.id }
    );

    const response = {
      success: true,
      data: {
        snapshot,
        balanceSheet: balanceSheetResult.data,
      },
      metadata: {
        calculatedAt: balanceSheetResult.metadata.calculatedAt,
        createdBy: authResult.user!.id,
        periodId,
      },
      validation: {
        isAccurate: balanceSheetResult.isAccurate,
        warnings: balanceSheetResult.warnings,
        errors: balanceSheetResult.errors,
      },
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Balance sheet v2 POST error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error while creating balance sheet snapshot',
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
  // This would typically be in the repository
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