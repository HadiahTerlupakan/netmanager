'use client';

import React, { useState, useEffect } from 'react';
import {
  FiFileText,
  FiTrendingUp,
  FiDollarSign,
  FiActivity,
  FiPieChart,
  FiBarChart2,
  FiDownload,
  FiRefreshCw,
  FiFilter,
  FiCalendar,
  FiAlertCircle,
  FiCheckCircle,
  FiXCircle,
  FiInfo
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FinancialReportLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  onRefresh?: () => void;
  onExport?: () => void;
  isLoading?: boolean;
  isDataValid?: boolean;
  warnings?: string[];
  errors?: string[];
  lastUpdated?: Date;
  filters?: React.ReactNode;
}

export default function FinancialReportLayout({
  children,
  title,
  description,
  onRefresh,
  onExport,
  isLoading = false,
  isDataValid = true,
  warnings = [],
  errors = [],
  lastUpdated,
  filters,
}: FinancialReportLayoutProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg text-white">
                  <FiFileText className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {title}
                  </h1>
                  {description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Data Quality Indicator */}
              <div className="flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium"
                   style={{
                     backgroundColor: errors.length > 0 ? '#FEE2E2' :
                                     warnings.length > 0 ? '#FEF3C7' :
                                     isDataValid ? '#D1FAE5' : '#F3F4F6',
                     color: errors.length > 0 ? '#DC2626' :
                           warnings.length > 0 ? '#D97706' :
                           isDataValid ? '#059669' : '#6B7280'
                   }}>
                {errors.length > 0 && <FiXCircle className="w-4 h-4" />}
                {warnings.length > 0 && <FiAlertCircle className="w-4 h-4" />}
                {errors.length === 0 && warnings.length === 0 && isDataValid && <FiCheckCircle className="w-4 h-4" />}
                <span className="hidden sm:inline">
                  {errors.length > 0 ? `${errors.length} Error${errors.length > 1 ? 's' : ''}` :
                   warnings.length > 0 ? `${warnings.length} Warning${warnings.length > 1 ? 's' : ''}` :
                   isDataValid ? 'Data Valid' : 'Data Issues'}
                </span>
              </div>

              {/* Last Updated */}
              {lastUpdated && (
                <div className="hidden sm:flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                  <FiCalendar className="w-4 h-4" />
                  <span>{formatDateTime(lastUpdated)}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                {filters && (
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Filters"
                  >
                    <FiFilter className="w-4 h-4" />
                  </button>
                )}

                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    disabled={isLoading}
                    className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Refresh"
                  >
                    <FiRefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                )}

                {onExport && (
                  <button
                    onClick={onExport}
                    className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Export"
                  >
                    <FiDownload className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && filters && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            {filters}
          </div>
        </div>
      )}

      {/* Alerts */}
      {(errors.length > 0 || warnings.length > 0) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          {errors.length > 0 && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start space-x-3">
                <FiXCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
                    {errors.length} Error{errors.length > 1 ? 's' : ''} Found
                  </h4>
                  <ul className="mt-2 text-sm text-red-700 dark:text-red-300 list-disc list-inside">
                    {errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-start space-x-3">
                <FiAlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    {warnings.length} Warning{warnings.length > 1 ? 's' : ''} Found
                  </h4>
                  <ul className="mt-2 text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside">
                    {warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <FiRefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading financial data...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to format date/time
function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// Quick Stats Card Component
interface QuickStatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon?: React.ReactNode;
  description?: string;
  loading?: boolean;
}

export function QuickStatsCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  description,
  loading = false,
}: QuickStatsCardProps) {
  const changeColor = changeType === 'increase' ? 'text-green-600' :
                     changeType === 'decrease' ? 'text-red-600' :
                     'text-gray-600';

  const bgColor = changeType === 'increase' ? 'bg-green-50 dark:bg-green-900/20' :
                  changeType === 'decrease' ? 'bg-red-50 dark:bg-red-900/20' :
                  'bg-gray-50 dark:bg-gray-900/20';

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </CardTitle>
        {icon && (
          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {loading ? (
              <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-8 w-32 rounded"></div>
            ) : (
              value
            )}
          </div>

          {change !== undefined && (
            <div className={`flex items-center space-x-1 text-sm ${changeColor} ${bgColor} px-2 py-1 rounded-full inline-flex`}>
              {changeType === 'increase' && <FiTrendingUp className="w-3 h-3" />}
              {changeType === 'decrease' && <FiTrendingUp className="w-3 h-3 rotate-180" />}
              <span>{Math.abs(change)}%</span>
            </div>
          )}

          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  description?: string;
  color?: 'green' | 'yellow' | 'red' | 'blue' | 'purple';
  icon?: React.ReactNode;
  loading?: boolean;
}

export function MetricCard({
  title,
  value,
  unit,
  description,
  color = 'blue',
  icon,
  loading = false,
}: MetricCardProps) {
  const colorClasses = {
    green: 'from-green-400 to-emerald-500',
    yellow: 'from-yellow-400 to-orange-500',
    red: 'from-red-400 to-pink-500',
    blue: 'from-blue-400 to-indigo-500',
    purple: 'from-purple-400 to-pink-500',
  };

  return (
    <Card className="group hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              {title}
            </p>
            <div className="flex items-baseline space-x-1">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {loading ? (
                  <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-8 w-24 rounded"></div>
                ) : (
                  value
                )}
              </span>
              {unit && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {unit}
                </span>
              )}
            </div>
            {description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {description}
              </p>
            )}
          </div>

          {icon && (
            <div className={`p-3 bg-gradient-to-br ${colorClasses[color]} rounded-lg text-white ml-4`}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}