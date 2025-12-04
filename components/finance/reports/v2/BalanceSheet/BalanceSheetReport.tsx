'use client';

import React, { useState, useEffect } from 'react';
import {
  FiDollarSign,
  FiCreditCard,
  FiPackage,
  FiHome,
  FiTrendingUp,
  FiTrendingDown,
  FiAlertTriangle,
  FiCheckCircle,
  FiPieChart,
  FiBarChart,
  FiDownload,
  FiRefreshCw
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import FinancialReportLayout, { QuickStatsCard, MetricCard } from '../FinancialReportLayout';

interface BalanceSheetData {
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

interface BalanceSheetReportProps {
  data: BalanceSheetData;
  previousData?: BalanceSheetData;
  onRefresh?: () => void;
  onExport?: () => void;
  isLoading?: boolean;
  lastUpdated?: Date;
}

export default function BalanceSheetReport({
  data,
  previousData,
  onRefresh,
  onExport,
  isLoading = false,
  lastUpdated,
}: BalanceSheetReportProps) {
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary');
  const [showComparison, setShowComparison] = useState(!!previousData);

  // Calculate key metrics
  const workingCapital = Number(data.currentAssets - data.currentLiabilities);
  const workingCapitalRatio = Number(data.currentAssets) / Number(data.currentLiabilities);
  const debtToEquity = Number(data.totalLiabilities) / Number(data.totalEquity);
  const debtToAssets = Number(data.totalLiabilities) / Number(data.totalAssets);

  // Calculate changes if previous data is available
  const calculateChange = (current: bigint, previous: bigint) => {
    if (!previous) return null;
    const change = Number(current - previous);
    const percentChange = previous > 0 ? (change / Number(previous)) * 100 : 0;
    return { change, percentChange };
  };

  const formatCurrency = (amount: bigint | number): string => {
    const num = typeof amount === 'bigint' ? Number(amount) : amount;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatLargeNumber = (amount: bigint | number): string => {
    const num = typeof amount === 'bigint' ? Number(amount) : amount;
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toString();
  };

  // Filter component
  const filters = (
    <div className="flex flex-wrap gap-4 items-center">
      <div className="flex items-center space-x-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">View:</label>
        <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
          <button
            onClick={() => setViewMode('summary')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'summary'
                ? 'bg-emerald-500 text-white'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setViewMode('detailed')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'detailed'
                ? 'bg-emerald-500 text-white'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            Detailed
          </button>
        </div>
      </div>

      {previousData && (
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="showComparison"
            checked={showComparison}
            onChange={(e) => setShowComparison(e.target.checked)}
            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          <label htmlFor="showComparison" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Show Comparison
          </label>
        </div>
      )}
    </div>
  );

  // Generate warnings based on data
  const warnings = [];
  const errors = [];

  if (!data.isBalanced && data.variance !== BigInt(0)) {
    errors.push(`Balance sheet doesn't balance. Variance: ${formatCurrency(data.variance)}`);
  }

  if (workingCapitalRatio < 1) {
    warnings.push('Working capital ratio below 1.0 - potential liquidity issues');
  }

  if (debtToEquity > 2) {
    warnings.push('High debt-to-equity ratio (>2.0) - financial risk concern');
  }

  return (
    <FinancialReportLayout
      title="Balance Sheet"
      description="Financial position statement showing assets, liabilities, and equity"
      onRefresh={onRefresh}
      onExport={onExport}
      isLoading={isLoading}
      isDataValid={data.isBalanced}
      warnings={warnings}
      errors={errors}
      lastUpdated={lastUpdated}
      filters={filters}
    >
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <QuickStatsCard
          title="Total Assets"
          value={formatLargeNumber(data.totalAssets)}
          change={previousData ? calculateChange(data.totalAssets, previousData.totalAssets)?.percentChange : undefined}
          changeType={previousData && data.totalAssets > previousData.totalAssets ? 'increase' : 'decrease'}
          icon={<FiDollarSign className="w-5 h-5" />}
          description="Total value of all assets"
        />

        <QuickStatsCard
          title="Working Capital"
          value={formatLargeNumber(workingCapital)}
          change={workingCapitalRatio > 1 ? 15 : -5} // Example change
          changeType={workingCapitalRatio > 1 ? 'increase' : 'decrease'}
          icon={<FiCreditCard className="w-5 h-5" />}
          description={`Ratio: ${workingCapitalRatio.toFixed(2)}`}
        />

        <QuickStatsCard
          title="Total Liabilities"
          value={formatLargeNumber(data.totalLiabilities)}
          change={previousData ? calculateChange(data.totalLiabilities, previousData.totalLiabilities)?.percentChange : undefined}
          changeType={previousData && data.totalLiabilities > previousData.totalLiabilities ? 'increase' : 'decrease'}
          icon={<FiTrendingUp className="w-5 h-5" />}
          description="Total obligations and debts"
        />

        <QuickStatsCard
          title="Total Equity"
          value={formatLargeNumber(data.totalEquity)}
          change={previousData ? calculateChange(data.totalEquity, previousData.totalEquity)?.percentChange : undefined}
          changeType={previousData && data.totalEquity > previousData.totalEquity ? 'increase' : 'decrease'}
          icon={<FiCheckCircle className="w-5 h-5" />}
          description="Owner's equity stake"
        />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Current Ratio"
          value={workingCapitalRatio.toFixed(2)}
          description="Current Assets ÷ Current Liabilities"
          color={workingCapitalRatio >= 2 ? 'green' : workingCapitalRatio >= 1 ? 'yellow' : 'red'}
          icon={<FiBarChart />}
        />

        <MetricCard
          title="Debt-to-Equity"
          value={debtToEquity.toFixed(2)}
          description="Total Liabilities ÷ Total Equity"
          color={debtToEquity <= 1 ? 'green' : debtToEquity <= 2 ? 'yellow' : 'red'}
          icon={<FiPieChart />}
        />

        <MetricCard
          title="Debt-to-Assets"
          value={(debtToAssets * 100).toFixed(1)}
          unit="%"
          description="Percentage of assets financed by debt"
          color={debtToAssets <= 0.4 ? 'green' : debtToAssets <= 0.7 ? 'yellow' : 'red'}
          icon={<FiTrendingDown />}
        />

        <MetricCard
          title="Net Fixed Assets"
          value={formatLargeNumber(data.netFixedAssets)}
          description="Fixed assets less depreciation"
          color="blue"
          icon={<FiHome />}
        />
      </div>

      {/* Detailed Balance Sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assets Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FiPackage className="w-5 h-5 text-emerald-500" />
              <span>Assets</span>
              <Badge variant="outline" className="text-xs">
                {formatCurrency(data.totalAssets)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Assets */}
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Current Assets</h4>
              <div className="space-y-2 pl-4 border-l-2 border-emerald-200 dark:border-emerald-800">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Cash & Equivalents</span>
                  <span className="font-medium">
                    {formatCurrency(data.cashAndEquivalents)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Accounts Receivable</span>
                  <span className="font-medium">
                    {formatCurrency(data.accountsReceivable)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Inventory</span>
                  <span className="font-medium">
                    {formatCurrency(data.inventory)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Prepaid Expenses</span>
                  <span className="font-medium">
                    {formatCurrency(data.prepaidExpenses)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span>Total Current Assets</span>
                  <span>{formatCurrency(data.currentAssets)}</span>
                </div>
              </div>
            </div>

            {/* Fixed Assets */}
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Fixed Assets</h4>
              <div className="space-y-2 pl-4 border-l-2 border-emerald-200 dark:border-emerald-800">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Gross Fixed Assets</span>
                  <span className="font-medium">
                    {formatCurrency(data.fixedAssets)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Accumulated Depreciation</span>
                  <span className="font-medium text-red-600">
                    ({formatCurrency(data.accumulatedDepreciation)})
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span>Net Fixed Assets</span>
                  <span>{formatCurrency(data.netFixedAssets)}</span>
                </div>
              </div>
            </div>

            {/* Total Assets */}
            <div className="flex justify-between font-bold text-lg border-t-2 border-emerald-500 pt-3">
              <span>Total Assets</span>
              <span>{formatCurrency(data.totalAssets)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Liabilities Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FiAlertTriangle className="w-5 h-5 text-red-500" />
              <span>Liabilities</span>
              <Badge variant="outline" className="text-xs">
                {formatCurrency(data.totalLiabilities)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Liabilities */}
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Current Liabilities</h4>
              <div className="space-y-2 pl-4 border-l-2 border-red-200 dark:border-red-800">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Accounts Payable</span>
                  <span className="font-medium">
                    {formatCurrency(data.accountsPayable)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Accrued Expenses</span>
                  <span className="font-medium">
                    {formatCurrency(data.accruedExpenses)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Short-term Debt</span>
                  <span className="font-medium">
                    {formatCurrency(data.shortTermDebt)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span>Total Current Liabilities</span>
                  <span>{formatCurrency(data.currentLiabilities)}</span>
                </div>
              </div>
            </div>

            {/* Long-term Liabilities */}
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Long-term Liabilities</h4>
              <div className="space-y-2 pl-4 border-l-2 border-red-200 dark:border-red-800">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Long-term Debt</span>
                  <span className="font-medium">
                    {formatCurrency(data.longTermDebt)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span>Total Long-term Liabilities</span>
                  <span>{formatCurrency(data.longTermDebt)}</span>
                </div>
              </div>
            </div>

            {/* Total Liabilities */}
            <div className="flex justify-between font-bold text-lg border-t-2 border-red-500 pt-3">
              <span>Total Liabilities</span>
              <span>{formatCurrency(data.totalLiabilities)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Equity Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FiCheckCircle className="w-5 h-5 text-blue-500" />
              <span>Equity</span>
              <Badge variant="outline" className="text-xs">
                {formatCurrency(data.totalEquity)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Equity Components */}
            <div className="space-y-2 pl-4 border-l-2 border-blue-200 dark:border-blue-800">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Initial Capital</span>
                <span className="font-medium">
                  {formatCurrency(data.initialCapital)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Retained Earnings</span>
                <span className="font-medium">
                  {formatCurrency(data.retainedEarnings)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Current Period Earnings</span>
                <span className="font-medium">
                  {formatCurrency(data.currentPeriodEarnings)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t pt-2">
                <span>Total Equity</span>
                <span>{formatCurrency(data.totalEquity)}</span>
              </div>
            </div>

            {/* Balance Check */}
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Balance Check</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Assets</span>
                  <span className="font-medium">{formatCurrency(data.totalAssets)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Liabilities + Equity</span>
                  <span className="font-medium">
                    {formatCurrency(data.totalLiabilities + data.totalEquity)}
                  </span>
                </div>
                <div className={`flex justify-between font-semibold border-t pt-1 ${
                  data.isBalanced ? 'text-green-600' : 'text-red-600'
                }`}>
                  <span>{data.isBalanced ? '✓ Balanced' : '✗ Not Balanced'}</span>
                  {data.variance !== BigInt(0) && (
                    <span>{formatCurrency(data.variance)}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Equity Ratio */}
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Ownership Structure</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Debt Ratio</span>
                  <span className="font-medium">{(debtToAssets * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Equity Ratio</span>
                  <span className="font-medium">{((1 - debtToAssets) * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comparison View */}
      {showComparison && previousData && (
        <Card>
          <CardHeader>
            <CardTitle>Period Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-4">Assets Changes</h4>
                <div className="space-y-2">
                  {[
                    { name: 'Cash & Equivalents', current: data.cashAndEquivalents, previous: previousData.cashAndEquivalents },
                    { name: 'Accounts Receivable', current: data.accountsReceivable, previous: previousData.accountsReceivable },
                    { name: 'Current Assets', current: data.currentAssets, previous: previousData.currentAssets },
                    { name: 'Net Fixed Assets', current: data.netFixedAssets, previous: previousData.netFixedAssets },
                  ].map((item) => {
                    const change = calculateChange(item.current, item.previous);
                    if (!change) return null;
                    return (
                      <div key={item.name} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 dark:text-gray-400">{item.name}</span>
                        <div className="flex items-center space-x-2">
                          <span>{formatCurrency(item.current)}</span>
                          <div className={`flex items-center space-x-1 text-xs ${
                            change.change > 0 ? 'text-green-600' : change.change < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {change.change > 0 && <FiTrendingUp className="w-3 h-3" />}
                            {change.change < 0 && <FiTrendingDown className="w-3 h-3" />}
                            <span>{Math.abs(change.percentChange).toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-4">Liabilities Changes</h4>
                <div className="space-y-2">
                  {[
                    { name: 'Accounts Payable', current: data.accountsPayable, previous: previousData.accountsPayable },
                    { name: 'Current Liabilities', current: data.currentLiabilities, previous: previousData.currentLiabilities },
                    { name: 'Total Liabilities', current: data.totalLiabilities, previous: previousData.totalLiabilities },
                  ].map((item) => {
                    const change = calculateChange(item.current, item.previous);
                    if (!change) return null;
                    return (
                      <div key={item.name} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 dark:text-gray-400">{item.name}</span>
                        <div className="flex items-center space-x-2">
                          <span>{formatCurrency(item.current)}</span>
                          <div className={`flex items-center space-x-1 text-xs ${
                            change.change > 0 ? 'text-red-600' : change.change < 0 ? 'text-green-600' : 'text-gray-600'
                          }`}>
                            {change.change > 0 && <FiTrendingUp className="w-3 h-3" />}
                            {change.change < 0 && <FiTrendingDown className="w-3 h-3" />}
                            <span>{Math.abs(change.percentChange).toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-4">Equity Changes</h4>
                <div className="space-y-2">
                  {[
                    { name: 'Retained Earnings', current: data.retainedEarnings, previous: previousData.retainedEarnings },
                    { name: 'Total Equity', current: data.totalEquity, previous: previousData.totalEquity },
                  ].map((item) => {
                    const change = calculateChange(item.current, item.previous);
                    if (!change) return null;
                    return (
                      <div key={item.name} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 dark:text-gray-400">{item.name}</span>
                        <div className="flex items-center space-x-2">
                          <span>{formatCurrency(item.current)}</span>
                          <div className={`flex items-center space-x-1 text-xs ${
                            change.change > 0 ? 'text-green-600' : change.change < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {change.change > 0 && <FiTrendingUp className="w-3 h-3" />}
                            {change.change < 0 && <FiTrendingDown className="w-3 h-3" />}
                            <span>{Math.abs(change.percentChange).toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </FinancialReportLayout>
  );
}