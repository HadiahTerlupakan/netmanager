'use client';

import React, { useState } from 'react';
import {
  FiTrendingUp,
  FiTrendingDown,
  FiDollarSign,
  FiTarget,
  FiPercent,
  FiActivity,
  FiPieChart,
  FiDownload,
  FiRefreshCw,
  FiFilter,
  FiCalendar
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FinancialReportLayout, { QuickStatsCard, MetricCard } from '../FinancialReportLayout';

interface ProfitLossData {
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

interface ProfitLossReportProps {
  data: ProfitLossData;
  previousData?: ProfitLossData;
  onRefresh?: () => void;
  onExport?: () => void;
  isLoading?: boolean;
  lastUpdated?: Date;
}

export default function ProfitLossReport({
  data,
  previousData,
  onRefresh,
  onExport,
  isLoading = false,
  lastUpdated,
}: ProfitLossReportProps) {
  const [viewMode, setViewMode] = useState<'summary' | 'detailed' | 'trends'>('summary');
  const [showComparison, setShowComparison] = useState(!!previousData);

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

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const calculateChange = (current: bigint | number, previous: bigint | number) => {
    if (!previousData) return null;
    const change = Number(current) - Number(previous);
    const percentChange = Number(previous) > 0 ? (change / Number(previous)) * 100 : 0;
    return { change, percentChange };
  };

  // Revenue breakdown
  const revenueBreakdown = [
    { name: 'Sales Revenue', amount: data.salesRevenue, color: 'bg-emerald-500' },
    { name: 'Service Revenue', amount: data.serviceRevenue, color: 'bg-blue-500' },
    { name: 'Other Revenue', amount: data.otherRevenue, color: 'bg-purple-500' },
  ];

  // Profitability indicators
  const getProfitabilityColor = (margin: number): 'green' | 'yellow' | 'red' => {
    if (margin >= 15) return 'green';
    if (margin >= 5) return 'yellow';
    return 'red';
  };

  // Generate warnings
  const warnings = [];
  const errors = [];

  if (data.netMargin < 0) {
    errors.push('Company is operating at a loss');
  } else if (data.netMargin < 5) {
    warnings.push('Low profit margins - consider operational improvements');
  }

  if (data.grossMargin < 30) {
    warnings.push('Gross margin below industry average for ISP companies');
  }

  // Filter component
  const filters = (
    <div className="flex flex-wrap gap-4 items-center">
      <div className="flex items-center space-x-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">View:</label>
        <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="summary">Summary</SelectItem>
            <SelectItem value="detailed">Detailed</SelectItem>
            <SelectItem value="trends">Trends</SelectItem>
          </SelectContent>
        </Select>
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

  return (
    <FinancialReportLayout
      title="Profit & Loss Statement"
      description="Revenue, expenses, and profitability analysis"
      onRefresh={onRefresh}
      onExport={onExport}
      isLoading={isLoading}
      isDataValid={data.netMargin >= 0}
      warnings={warnings}
      errors={errors}
      lastUpdated={lastUpdated}
      filters={filters}
    >
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <QuickStatsCard
          title="Total Revenue"
          value={formatLargeNumber(data.totalRevenue)}
          change={previousData ? calculateChange(data.totalRevenue, previousData.totalRevenue)?.percentChange : undefined}
          changeType={previousData && data.totalRevenue > previousData.totalRevenue ? 'increase' : 'decrease'}
          icon={<FiDollarSign className="w-5 h-5" />}
          description="Total income from all sources"
        />

        <QuickStatsCard
          title="Gross Profit"
          value={formatLargeNumber(data.grossProfit)}
          change={previousData ? calculateChange(data.grossProfit, previousData.grossProfit)?.percentChange : undefined}
          changeType={previousData && data.grossProfit > previousData.grossProfit ? 'increase' : 'decrease'}
          icon={<FiTarget className="w-5 h-5" />}
          description={`Margin: ${formatPercentage(data.grossMargin)}`}
        />

        <QuickStatsCard
          title="Operating Income"
          value={formatLargeNumber(data.operatingIncome)}
          change={previousData ? calculateChange(data.operatingIncome, previousData.operatingIncome)?.percentChange : undefined}
          changeType={previousData && data.operatingIncome > previousData.operatingIncome ? 'increase' : 'decrease'}
          icon={<FiActivity className="w-5 h-5" />}
          description={`Margin: ${formatPercentage(data.operatingMargin)}`}
        />

        <QuickStatsCard
          title="Net Income"
          value={formatLargeNumber(data.netIncome)}
          change={previousData ? calculateChange(data.netIncome, previousData.netIncome)?.percentChange : undefined}
          changeType={previousData && data.netIncome > previousData.netIncome ? 'increase' : 'decrease'}
          icon={<FiTrendingUp className="w-5 h-5" />}
          description={`Margin: ${formatPercentage(data.netMargin)}`}
        />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Gross Margin"
          value={data.grossMargin}
          unit="%"
          description="Gross profit as % of revenue"
          color={getProfitabilityColor(data.grossMargin)}
          icon={<FiPercent />}
        />

        <MetricCard
          title="Operating Margin"
          value={data.operatingMargin}
          unit="%"
          description="Operating profit as % of revenue"
          color={getProfitabilityColor(data.operatingMargin)}
          icon={<FiActivity />}
        />

        <MetricCard
          title="Net Margin"
          value={data.netMargin}
          unit="%"
          description="Net profit as % of revenue"
          color={getProfitabilityColor(data.netMargin)}
          icon={<FiTrendingUp />}
        />

        <MetricCard
          title="Return on Equity"
          value={data.returnOnEquity * 100}
          unit="%"
          description="Net profit ÷ Total equity"
          color={data.returnOnEquity >= 0.1 ? 'green' : data.returnOnEquity >= 0.05 ? 'yellow' : 'red'}
          icon={<FiPieChart />}
        />
      </div>

      {/* Detailed P&L */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FiDollarSign className="w-5 h-5 text-emerald-500" />
              <span>Revenue</span>
              <Badge variant="outline" className="text-xs">
                {formatCurrency(data.totalRevenue)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {revenueBreakdown.map((item, index) => {
                const percentage = Number(data.totalRevenue) > 0
                  ? (Number(item.amount) / Number(data.totalRevenue)) * 100
                  : 0;

                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {item.name}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">
                          {formatCurrency(item.amount)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${item.color}`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between font-bold text-lg border-t-2 border-emerald-500 pt-3">
              <span>Total Revenue</span>
              <span>{formatCurrency(data.totalRevenue)}</span>
            </div>

            {/* Previous Period Comparison */}
            {showComparison && previousData && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Previous Period</div>
                <div className="flex justify-between text-sm">
                  <span>Total Revenue</span>
                  <span>{formatCurrency(previousData.totalRevenue)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Change</span>
                  <div className={`flex items-center space-x-1 ${
                    data.totalRevenue > previousData.totalRevenue ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {data.totalRevenue > previousData.totalRevenue ?
                      <FiTrendingUp className="w-3 h-3" /> :
                      <FiTrendingDown className="w-3 h-3" />
                    }
                    <span>
                      {Math.abs(calculateChange(data.totalRevenue, previousData.totalRevenue)?.percentChange || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expenses & Profit Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FiTarget className="w-5 h-5 text-red-500" />
              <span>Expenses & Profit</span>
              <Badge variant="outline" className="text-xs">
                {formatCurrency(data.operatingExpenses)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* COGS */}
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Cost of Goods Sold</h4>
              <div className="space-y-1 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Direct Costs</span>
                  <span>{formatCurrency(data.directCosts)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">COGS</span>
                  <span>{formatCurrency(data.cogs)}</span>
                </div>
              </div>
            </div>

            {/* Gross Profit */}
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium text-emerald-800 dark:text-emerald-200">Gross Profit</span>
                <div className="text-right">
                  <div className="font-bold text-emerald-900 dark:text-emerald-100">
                    {formatCurrency(data.grossProfit)}
                  </div>
                  <div className="text-sm text-emerald-700 dark:text-emerald-300">
                    {formatPercentage(data.grossMargin)}
                  </div>
                </div>
              </div>
            </div>

            {/* Operating Expenses */}
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Operating Expenses</h4>
              <div className="space-y-1 pl-4 border-l-2 border-red-200 dark:border-red-800">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Total OPEX</span>
                  <span className="font-medium text-red-600">
                    {formatCurrency(data.operatingExpenses)}
                  </span>
                </div>
              </div>
            </div>

            {/* Operating Income */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium text-blue-800 dark:text-blue-200">Operating Income</span>
                <div className="text-right">
                  <div className="font-bold text-blue-900 dark:text-blue-100">
                    {formatCurrency(data.operatingIncome)}
                  </div>
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    {formatPercentage(data.operatingMargin)}
                  </div>
                </div>
              </div>
            </div>

            {/* Other Income/Expenses */}
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Other Items</h4>
              <div className="space-y-1 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Interest Income</span>
                  <span className="text-green-600">
                    +{formatCurrency(data.interestIncome)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Interest Expense</span>
                  <span className="text-red-600">
                    -{formatCurrency(data.interestExpense)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Other Income</span>
                  <span className="text-green-600">
                    +{formatCurrency(data.otherIncome)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Other Expenses</span>
                  <span className="text-red-600">
                    -{formatCurrency(data.otherExpenses)}
                  </span>
                </div>
              </div>
            </div>

            {/* Net Income */}
            <div className={`p-3 rounded-lg border-2 ${
              data.netIncome >= 0
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500'
                : 'bg-red-50 dark:bg-red-900/20 border-red-500'
            }`}>
              <div className="flex justify-between items-center">
                <span className={`font-medium ${
                  data.netIncome >= 0 ? 'text-emerald-800 dark:text-emerald-200' : 'text-red-800 dark:text-red-200'
                }`}>
                  Net Income
                </span>
                <div className="text-right">
                  <div className={`font-bold ${
                    data.netIncome >= 0 ? 'text-emerald-900 dark:text-emerald-100' : 'text-red-900 dark:text-red-100'
                  }`}>
                    {formatCurrency(data.netIncome)}
                  </div>
                  <div className={`text-sm ${
                    data.netIncome >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'
                  }`}>
                    {formatPercentage(data.netMargin)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profitability Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Margin Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Profitability Margins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Gross Margin', value: data.grossMargin, color: 'emerald' },
                { name: 'Operating Margin', value: data.operatingMargin, color: 'blue' },
                { name: 'Net Margin', value: data.netMargin, color: 'purple' },
              ].map((margin) => (
                <div key={margin.name} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {margin.name}
                    </span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatPercentage(margin.value)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full bg-${margin.color}-500`}
                      style={{ width: `${Math.min(Math.max(margin.value, 0), 100)}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {margin.value >= 15 ? 'Excellent' :
                     margin.value >= 10 ? 'Good' :
                     margin.value >= 5 ? 'Fair' :
                     margin.value >= 0 ? 'Poor' : 'Critical'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Key Ratios */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Ratios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <MetricCard
                title="Return on Assets"
                value={data.returnOnAssets * 100}
                unit="%"
                description="Net income ÷ Total assets"
                color={data.returnOnAssets >= 0.1 ? 'green' : data.returnOnAssets >= 0.05 ? 'yellow' : 'red'}
              />

              <MetricCard
                title="Return on Equity"
                value={data.returnOnEquity * 100}
                unit="%"
                description="Net income ÷ Total equity"
                color={data.returnOnEquity >= 0.15 ? 'green' : data.returnOnEquity >= 0.1 ? 'yellow' : 'red'}
              />

              <MetricCard
                title="Expense Ratio"
                value={(Number(data.operatingExpenses) / Number(data.totalRevenue)) * 100}
                unit="%"
                description="Operating expenses ÷ Revenue"
                color="blue"
              />

              <MetricCard
                title="Tax Rate"
                value={Number(data.totalRevenue) > 0 ? (Number(data.incomeTax) / Number(data.totalRevenue)) * 100 : 0}
                unit="%"
                description="Tax ÷ Total revenue"
                color="purple"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </FinancialReportLayout>
  );
}