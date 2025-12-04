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
      'FINANCIAL_HEALTH_CHECK_V2',
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

    const includeDetailedAnalysis = searchParams.get('detailed') === 'true';

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

    // Perform comprehensive financial health check
    const healthCheck = await FinancialCalculationService.performFinancialHealthCheck(filters);

    // Get detailed financial data if requested
    let detailedData = null;
    if (includeDetailedAnalysis) {
      const [
        balanceSheet,
        profitLoss,
        cashFlow,
        workingCapital,
        debtAnalysis,
        profitabilityAnalysis,
        cashFlowAnalysis,
      ] = await Promise.all([
        FinancialCalculationService.calculateBalanceSheet(filters),
        FinancialCalculationService.calculateProfitLoss(filters),
        FinancialCalculationService.calculateCashFlow(filters),
        FinancialCalculationService.calculateWorkingCapital(filters),
        FinancialCalculationService.calculateDebtAnalysis(filters),
        FinancialCalculationService.calculateProfitabilityAnalysis(filters),
        FinancialCalculationService.calculateCashFlowAnalysis(filters),
      ]);

      detailedData = {
        balanceSheet: {
          data: balanceSheet.data,
          isAccurate: balanceSheet.isAccurate,
          warnings: balanceSheet.warnings,
          errors: balanceSheet.errors,
        },
        profitLoss: {
          data: profitLoss.data,
          isAccurate: profitLoss.isAccurate,
          warnings: profitLoss.warnings,
          errors: profitLoss.errors,
        },
        cashFlow: {
          data: cashFlow.data,
          isAccurate: cashFlow.isAccurate,
          warnings: cashFlow.warnings,
          errors: cashFlow.errors,
        },
        analyses: {
          workingCapital: workingCapital.data,
          debtAnalysis: debtAnalysis.data,
          profitabilityAnalysis: profitabilityAnalysis.data,
          cashFlowAnalysis: cashFlowAnalysis.data,
        },
      };
    }

    // Calculate additional metrics
    const additionalMetrics = await calculateAdditionalHealthMetrics(filters);

    // Generate action plan based on health status
    const actionPlan = generateActionPlan(healthCheck, additionalMetrics);

    // Risk assessment
    const riskAssessment = performRiskAssessment(healthCheck, additionalMetrics);

    // Forecast recommendations
    const forecastRecommendations = generateForecastRecommendations(healthCheck, additionalMetrics);

    const response = {
      success: true,
      data: {
        healthCheck,
        additionalMetrics,
        actionPlan,
        riskAssessment,
        forecastRecommendations,
      },
      detailedData,
      metadata: {
        calculatedAt: new Date().toISOString(),
        dataSource: 'comprehensive_health_analysis',
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
    };

    // Set cache headers
    const responseHeaders = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600', // 5 minutes cache
    });

    return NextResponse.json(response, {
      status: 200,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Financial Health Check v2 API error:', error);

    // Log error for audit
    try {
      await FinanceAuthService.logFinancialAccess(
        request,
        { id: 'unknown', email: 'unknown', name: 'unknown', role: 'unknown' },
        'ERROR',
        'FINANCIAL_HEALTH_CHECK_V2',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error while performing financial health check',
        errorCode: 'CALCULATION_ERROR',
        details: process.env.NODE_ENV === 'development'
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined,
      },
      { status: 500 }
    );
  }
}

// Helper functions for additional calculations
async function calculateAdditionalHealthMetrics(filters: FinancialReportFilters) {
  // This would typically calculate additional KPIs specific to ISP business
  return {
    operationalMetrics: {
      averageRevenuePerUser: 250000, // Example value
      customerAcquisitionCost: 500000, // Example value
      customerLifetimeValue: 3000000, // Example value
      monthlyChurnRate: 2.5, // Percentage
    },
    cashMetrics: {
      cashBurnRate: 50000000, // Monthly burn
      runwayMonths: 12, // How many months until cash runs out
      cashConversionCycle: 45, // Days
    },
    growthMetrics: {
      monthlyRecurringRevenue: 500000000, // MRR
      annualRecurringRevenue: 6000000000, // ARR
      monthOverMonthGrowth: 5.2, // Percentage
      yearOverYearGrowth: 15.8, // Percentage
    },
  };
}

function generateActionPlan(healthCheck: any, additionalMetrics: any) {
  const actions = [];

  // Based on overall health
  switch (healthCheck.overall) {
    case 'CRITICAL':
      actions.push({
        priority: 'URGENT',
        category: 'SURVIVAL',
        title: 'Immediate Cash Management',
        description: 'Conserve cash and secure emergency funding immediately',
        timeframe: '0-30 days',
        estimatedImpact: 'HIGH'
      });
      break;
    case 'POOR':
      actions.push({
        priority: 'HIGH',
        category: 'STABILIZATION',
        title: 'Financial Stabilization',
        description: 'Implement cost control and revenue improvement measures',
        timeframe: '30-60 days',
        estimatedImpact: 'HIGH'
      });
      break;
    case 'FAIR':
      actions.push({
        priority: 'MEDIUM',
        category: 'IMPROVEMENT',
        title: 'Operational Efficiency',
        description: 'Optimize operations and improve profitability',
        timeframe: '60-90 days',
        estimatedImpact: 'MEDIUM'
      });
      break;
    case 'GOOD':
      actions.push({
        priority: 'LOW',
        category: 'OPTIMIZATION',
        title: 'Strategic Growth',
        description: 'Focus on growth opportunities and market expansion',
        timeframe: '90-180 days',
        estimatedImpact: 'MEDIUM'
      });
      break;
    case 'EXCELLENT':
      actions.push({
        priority: 'LOW',
        category: 'SCALE',
        title: 'Scaling Operations',
        description: 'Prepare for scaling and diversification',
        timeframe: '180+ days',
        estimatedImpact: 'HIGH'
      });
      break;
  }

  // Based on specific scores
  if (healthCheck.scores.liquidity < 60) {
    actions.push({
      priority: 'HIGH',
      category: 'LIQUIDITY',
      title: 'Improve Cash Position',
      description: 'Accelerate collections and negotiate better payment terms',
      timeframe: '30-45 days',
      estimatedImpact: 'HIGH'
    });
  }

  if (healthCheck.scores.profitability < 60) {
    actions.push({
      priority: 'MEDIUM',
      category: 'PROFITABILITY',
      title: 'Enhance Profit Margins',
      description: 'Review pricing strategy and implement cost controls',
      timeframe: '45-60 days',
      estimatedImpact: 'MEDIUM'
    });
  }

  if (healthCheck.scores.solvency < 60) {
    actions.push({
      priority: 'HIGH',
      category: 'SOLVENCY',
      title: 'Debt Restructuring',
      description: 'Renegotiate debt terms and improve capital structure',
      timeframe: '60-90 days',
      estimatedImpact: 'HIGH'
    });
  }

  return actions;
}

function performRiskAssessment(healthCheck: any, additionalMetrics: any) {
  const risks = [];
  const overallScore = (healthCheck.scores.liquidity + healthCheck.scores.profitability +
                      healthCheck.scores.efficiency + healthCheck.scores.solvency) / 4;

  // Liquidity risks
  if (healthCheck.scores.liquidity < 40) {
    risks.push({
      type: 'LIQUIDITY_RISK',
      level: 'HIGH',
      description: 'Insufficient liquid assets to meet short-term obligations',
      probability: 'HIGH',
      impact: 'SEVERE',
      mitigation: 'Secure emergency funding and improve cash collection'
    });
  } else if (healthCheck.scores.liquidity < 60) {
    risks.push({
      type: 'LIQUIDITY_RISK',
      level: 'MEDIUM',
      description: 'Adequate but tight liquidity position',
      probability: 'MEDIUM',
      impact: 'MODERATE',
      mitigation: 'Monitor cash flow closely and maintain credit facilities'
    });
  }

  // Profitability risks
  if (healthCheck.scores.profitability < 40) {
    risks.push({
      type: 'PROFITABILITY_RISK',
      level: 'HIGH',
      description: 'Sustained losses threaten business viability',
      probability: 'HIGH',
      impact: 'SEVERE',
      mitigation: 'Immediate cost restructuring and revenue enhancement'
    });
  } else if (healthCheck.scores.profitability < 60) {
    risks.push({
      type: 'PROFITABILITY_RISK',
      level: 'MEDIUM',
      description: 'Thin profit margins vulnerable to market changes',
      probability: 'MEDIUM',
      impact: 'MODERATE',
      mitigation: 'Improve operational efficiency and pricing strategy'
    });
  }

  // Solvency risks
  if (healthCheck.scores.solvency < 40) {
    risks.push({
      type: 'SOLVENCY_RISK',
      level: 'HIGH',
      description: 'Excessive debt levels threaten long-term viability',
      probability: 'HIGH',
      impact: 'SEVERE',
      mitigation: 'Debt restructuring and equity infusion'
    });
  }

  // Business model risks (ISP specific)
  if (additionalMetrics.operationalMetrics.monthlyChurnRate > 5) {
    risks.push({
      type: 'BUSINESS_RISK',
      level: 'MEDIUM',
      description: 'High customer churn rate affecting revenue stability',
      probability: 'MEDIUM',
      impact: 'MODERATE',
      mitigation: 'Improve customer retention and service quality'
    });
  }

  if (additionalMetrics.cashMetrics.runwayMonths < 6) {
    risks.push({
      type: 'RUNWAY_RISK',
      level: 'HIGH',
      description: 'Limited cash runway threatens operations',
      probability: 'HIGH',
      impact: 'SEVERE',
      mitigation: 'Immediate funding needs and expense reduction'
    });
  }

  return {
    overallRiskLevel: overallScore < 40 ? 'HIGH' : overallScore < 60 ? 'MEDIUM' : overallScore < 80 ? 'LOW' : 'MINIMAL',
    risks,
    riskFactors: {
      financial: healthCheck.scores,
      operational: additionalMetrics.operationalMetrics,
      cash: additionalMetrics.cashMetrics,
    },
    recommendedActions: risks.filter(r => r.level === 'HIGH').map(r => r.mitigation),
  };
}

function generateForecastRecommendations(healthCheck: any, additionalMetrics: any) {
  const recommendations = [];

  // Based on current trajectory
  if (healthCheck.overall === 'POOR' || healthCheck.overall === 'CRITICAL') {
    recommendations.push({
      timeframe: 'QUARTERLY',
      type: 'RECOVERY',
      title: 'Recovery Plan',
      description: 'Focus on stabilizing operations and achieving profitability',
      keyMilestones: [
        'Positive cash flow within 3 months',
        'Break-even operations within 6 months',
        'Debt reduction plan implementation'
      ]
    });
  }

  if (healthCheck.overall === 'FAIR' || healthCheck.overall === 'GOOD') {
    recommendations.push({
      timeframe: 'ANNUALLY',
      type: 'GROWTH',
      title: 'Growth Strategy',
      description: 'Leverage stable position for sustainable growth',
      keyMilestones: [
        '20% revenue growth target',
        'Market expansion to new areas',
        'Service portfolio diversification'
      ]
    });
  }

  if (healthCheck.overall === 'EXCELLENT') {
    recommendations.push({
      timeframe: 'STRATEGIC',
      type: 'EXPANSION',
      title: 'Strategic Expansion',
      description: 'Scale operations and explore new business models',
      keyMilestones: [
        'Geographic expansion',
        'New service offerings',
        'Strategic partnerships',
        'Technology investments'
      ]
    });
  }

  // Cash-specific recommendations
  if (additionalMetrics.cashMetrics.runwayMonths < 12) {
    recommendations.push({
      timeframe: 'IMMEDIATE',
      type: 'CASH',
      title: 'Cash Preservation',
      description: 'Extend cash runway through strategic initiatives',
      keyMilestones: [
        'Reduce non-essential expenses',
        'Accelerate revenue collection',
        'Explore financing options',
        'Optimize working capital'
      ]
    });
  }

  return recommendations;
}