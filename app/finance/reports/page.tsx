'use client';

import { useState, useEffect } from 'react';
import { useFinance } from '@/hooks/useFinance';
import {
  FiArrowPath,
  FiBars3,
  FiFileText,
  FiDollarSign,
  FiActivity,
  FiPieChart,
  FiTrendingUp,
  FiDownload,
  FiFilter,
  FiCalendar,
  FiAlertCircle,
  FiCheckCircle
} from 'react-icons/fi';

// Import v2 components
import BalanceSheetReport from '@/components/finance/reports/v2/BalanceSheet/BalanceSheetReport';
import ProfitLossReport from '@/components/finance/reports/v2/ProfitLoss/ProfitLossReport';

interface FinancialData {
  balanceSheet?: any;
  profitLoss?: any;
  cashFlow?: any;
  financialRatios?: any;
  healthCheck?: any;
  lastUpdated?: Date;
  warnings?: string[];
  errors?: string[];
}

const formatRupiah = (amount: number | string | bigint): string => {
  const numAmount = typeof amount === 'bigint' ? Number(amount) :
                   typeof amount === 'string' ? Number(amount) : amount;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(numAmount);
};

export default function FinancialReportsPage() {
  const { data: financeUser, loading: userLoading } = useFinance();
  const [activeReport, setActiveReport] = useState<'dashboard' | 'pl' | 'cashflow' | 'balance-sheet' | 'ratios' | 'health'>('dashboard');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [financialData, setFinancialData] = useState<FinancialData>({});
  const [loading, setLoading] = useState(true);
  const [useV2, setUseV2] = useState(true); // Toggle between old and new system
  const [showFilters, setShowFilters] = useState(false);

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('finance_token');
      if (!token) return;

      setLoading(true);

      if (useV2) {
        // Use v2 API endpoints
        const apiVersion = 'v2';

        // Fetch comprehensive report with all data
        const response = await fetch(
          `/api/finance/reports/${apiVersion}/comprehensive?month=${month}&year=${year}&includeDetails=true`,
          {
            headers: { 'x-finance-token': token },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setFinancialData({
              balanceSheet: data.data.financialStatements.balanceSheet,
              profitLoss: data.data.financialStatements.profitLoss,
              cashFlow: data.data.financialStatements.cashFlow,
              financialRatios: data.data.financialStatements.financialRatios,
              healthCheck: data.data.healthCheck,
              lastUpdated: new Date(data.metadata.calculatedAt),
              warnings: data.validation.warnings,
              errors: data.validation.errors,
            });
          }
        }
      } else {
        // Use original v1 API endpoints (fallback)
        const [plRes, cfRes, bsRes, compRes] = await Promise.all([
          fetch(`/api/finance/reports/profit-loss?month=${month}&year=${year}`, {
            headers: { 'x-finance-token': token },
          }),
          fetch(`/api/finance/reports/cash-flow?month=${month}&year=${year}`, {
            headers: { 'x-finance-token': token },
          }),
          fetch(`/api/finance/reports/balance-sheet?month=${month}&year=${year}`, {
            headers: { 'x-finance-token': token },
          }),
          fetch(`/api/finance/reports/comparison?month=${month}&year=${year}`, {
            headers: { 'x-finance-token': token },
          }),
        ]);

        // Process v1 responses
        const plData = plRes.ok ? await plRes.json() : null;
        const cfData = cfRes.ok ? await cfRes.json() : null;
        const bsData = bsRes.ok ? await bsRes.json() : null;
        const compData = compRes.ok ? await compRes.json() : null;

        setFinancialData({
          balanceSheet: bsData,
          profitLoss: plData,
          cashFlow: cfData,
          lastUpdated: new Date(),
          warnings: [],
          errors: [],
        });
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (financeUser) {
      fetchReports();
    }
  }, [financeUser, month, year, useV2]);

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const handleExport = () => {
    // Export functionality
    const token = localStorage.getItem('finance_token');
    if (!token) return;

    const endpoint = useV2
      ? `/api/finance/reports/v2/comprehensive?month=${month}&year=${year}&includeDetails=true`
      : `/api/finance/reports/profit-loss?month=${month}&year=${year}`;

    fetch(endpoint, {
      headers: { 'x-finance-token': token },
    })
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `financial-report-${year}-${month}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
      .catch(error => console.error('Export failed:', error));
  };

  // Render loading state
  if (userLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <FiArrowPath className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto mb-4" />
          <div className="text-gray-500 dark:text-gray-400">Memuat laporan keuangan...</div>
        </div>
      </div>
    );
  }

  // Main render function
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-lg safe-area-inset-top">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <button
                onClick={() => {
                  if ((window as any).toggleFinanceSidebar) {
                    (window as any).toggleFinanceSidebar();
                  }
                }}
                className="touch-target touch-manipulation p-2 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors md:hidden flex-shrink-0"
                aria-label="Open menu"
              >
                <FiBars3 className="w-6 h-6" />
              </button>
              <div className="w-9 h-9 md:w-10 md:h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <FiFileText className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <h1 className="text-lg md:text-xl font-bold truncate">Financial Reports</h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Version Toggle */}
              <div className="hidden sm:flex items-center gap-2 bg-white/10 px-3 py-1 rounded-lg">
                <span className="text-xs">System:</span>
                <button
                  onClick={() => setUseV2(!useV2)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    useV2
                      ? 'bg-white text-emerald-600'
                      : 'bg-transparent text-white hover:bg-white/20'
                  }`}
                >
                  v2
                </button>
                <button
                  onClick={() => setUseV2(!useV2)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    !useV2
                      ? 'bg-white text-emerald-600'
                      : 'bg-transparent text-white hover:bg-white/20'
                  }`}
                >
                  v1
                </button>
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className="touch-target touch-manipulation p-2 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors flex-shrink-0"
                title="Filters"
              >
                <FiFilter className="w-5 h-5" />
              </button>

              <button
                onClick={fetchReports}
                className="touch-target touch-manipulation p-2 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors flex-shrink-0"
                title="Refresh"
              >
                <FiArrowPath className="w-6 h-6" />
              </button>

              <button
                onClick={handleExport}
                className="touch-target touch-manipulation p-2 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors flex-shrink-0"
                title="Export"
              >
                <FiDownload className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Bulan
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {months.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tahun
              </label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Data Quality Indicator */}
            {(financialData.errors?.length || financialData.warnings?.length) > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg text-xs font-medium"
                   style={{
                     backgroundColor: financialData.errors?.length ? '#FEE2E2' :
                                     financialData.warnings?.length ? '#FEF3C7' : '#D1FAE5',
                     color: financialData.errors?.length ? '#DC2626' :
                             financialData.warnings?.length ? '#D97706' : '#059669'
                   }}>
                {financialData.errors?.length ? <FiAlertCircle className="w-4 h-4" /> : <FiCheckCircle className="w-4 h-4" />}
                <span>
                  {financialData.errors?.length ? `${financialData.errors.length} Error${financialData.errors.length > 1 ? 's' : ''}` :
                   financialData.warnings?.length ? `${financialData.warnings.length} Warning${financialData.warnings.length > 1 ? 's' : ''}` :
                   'Data Valid'}
                </span>
              </div>
            )}

            {financialData.lastUpdated && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Updated: {financialData.lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="px-4 py-4 md:px-6 lg:px-8">
        {useV2 ? (
          // V2 Enhanced Reports
          <>
            {/* Report Type Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md mb-6">
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex overflow-x-auto">
                  <button
                    onClick={() => setActiveReport('dashboard')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeReport === 'dashboard'
                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => setActiveReport('pl')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeReport === 'pl'
                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Profit & Loss
                  </button>
                  <button
                    onClick={() => setActiveReport('cashflow')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeReport === 'cashflow'
                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Cash Flow
                  </button>
                  <button
                    onClick={() => setActiveReport('balance-sheet')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeReport === 'balance-sheet'
                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Balance Sheet
                  </button>
                  <button
                    onClick={() => setActiveReport('ratios')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeReport === 'ratios'
                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Ratios
                  </button>
                  <button
                    onClick={() => setActiveReport('health')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeReport === 'health'
                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Health Check
                  </button>
                </nav>
              </div>

              <div className="p-6">
                {activeReport === 'pl' && financialData.profitLoss && (
                  <ProfitLossReport
                    data={financialData.profitLoss}
                    onRefresh={fetchReports}
                    onExport={handleExport}
                    isLoading={loading}
                    lastUpdated={financialData.lastUpdated}
                  />
                )}

                {activeReport === 'balance-sheet' && financialData.balanceSheet && (
                  <BalanceSheetReport
                    data={financialData.balanceSheet}
                    onRefresh={fetchReports}
                    onExport={handleExport}
                    isLoading={loading}
                    lastUpdated={financialData.lastUpdated}
                  />
                )}

                {activeReport === 'cashflow' && (
                  <div className="text-center py-12">
                    <FiActivity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Cash Flow Report
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Cash flow component coming soon...
                    </p>
                  </div>
                )}

                {activeReport === 'ratios' && (
                  <div className="text-center py-12">
                    <FiPieChart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Financial Ratios
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Ratios analysis component coming soon...
                    </p>
                  </div>
                )}

                {activeReport === 'health' && (
                  <div className="text-center py-12">
                    <FiTrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Financial Health Check
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Health analysis component coming soon...
                    </p>
                  </div>
                )}

                {activeReport === 'dashboard' && (
                  <div className="space-y-6">
                    {/* Dashboard Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-6 rounded-xl border border-emerald-200 dark:border-emerald-800">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Total Revenue</h3>
                          <FiDollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                          {financialData.profitLoss ? formatRupiah(financialData.profitLoss.totalRevenue) : '-'}
                        </p>
                      </div>

                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300">Net Profit</h3>
                          <FiTrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                          {financialData.profitLoss ? formatRupiah(financialData.profitLoss.netIncome) : '-'}
                        </p>
                      </div>

                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-xl border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-medium text-purple-700 dark:text-purple-300">Total Assets</h3>
                          <FiFileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                          {financialData.balanceSheet ? formatRupiah(financialData.balanceSheet.totalAssets) : '-'}
                        </p>
                      </div>

                      <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 p-6 rounded-xl border border-orange-200 dark:border-orange-800">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-medium text-orange-700 dark:text-orange-300">Cash Balance</h3>
                          <FiDollarSign className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                          {financialData.balanceSheet ? formatRupiah(financialData.balanceSheet.cashAndEquivalents) : '-'}
                        </p>
                      </div>
                    </div>

                    {/* Health Status */}
                    {financialData.healthCheck && (
                      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          Financial Health Status
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="text-center">
                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Overall</div>
                            <div className={`text-xl font-bold ${
                              financialData.healthCheck.overall === 'EXCELLENT' ? 'text-green-600' :
                              financialData.healthCheck.overall === 'GOOD' ? 'text-blue-600' :
                              financialData.healthCheck.overall === 'FAIR' ? 'text-yellow-600' :
                              financialData.healthCheck.overall === 'POOR' ? 'text-orange-600' :
                              'text-red-600'
                            }`}>
                              {financialData.healthCheck.overall}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Liquidity</div>
                            <div className="text-xl font-bold text-gray-900 dark:text-white">
                              {financialData.healthCheck.scores.liquidity}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Profitability</div>
                            <div className="text-xl font-bold text-gray-900 dark:text-white">
                              {financialData.healthCheck.scores.profitability}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Solvency</div>
                            <div className="text-xl font-bold text-gray-900 dark:text-white">
                              {financialData.healthCheck.scores.solvency}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          // V1 Original Reports (fallback)
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md mb-6">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setActiveReport('pl')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeReport === 'pl'
                      ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Profit & Loss
                </button>
                <button
                  onClick={() => setActiveReport('cashflow')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeReport === 'cashflow'
                      ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Cash Flow Statement
                </button>
                <button
                  onClick={() => setActiveReport('balance-sheet')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeReport === 'balance-sheet'
                      ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Balance Sheet
                </button>
              </nav>
            </div>

            <div className="p-6">
              {/* Render v1 components based on active report */}
              <div className="text-center py-8">
                <FiFileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  V1 Reports
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Original report system - Switch to V2 for enhanced features
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}