"use client";

import {
  HiOutlineArrowPath,
  HiOutlineCurrencyDollar,
  HiOutlineCog,
  HiOutlineCalendar,
  HiOutlineUser,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineArrowDown,
  HiOutlineMagnifyingGlass,
} from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import FeeConfigurationModal from "./FeeConfigurationModal";
import { isOnlinePaymentMethod } from "./calculations";
import { NPLSummary } from "@/components/mixradius/NPLSummary";
import { formatCurrency } from "@/lib/utils";

import { useIncomePeriodData } from "./hooks/useIncomePeriodData";
import { useRoiTracking } from "./hooks/useRoiTracking";
import { useMitraCommission } from "./hooks/useMitraCommission";

import IncomePeriodFilters from "./components/IncomePeriodFilters";
import SummaryCards from "./components/SummaryCards";
import RabProjectSection from "./components/RabProjectSection";
import MitraSalesTable from "./components/MitraSalesTable";

export default function IncomePeriodClient() {
  const {
    data,
    summary,
    loading,
    error,
    globalRecords,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    serviceType,
    setServiceType,
    paymentMethod,
    setPaymentMethod,
    groups,
    selectedGroup,
    setSelectedGroup,
    search,
    setSearch,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalRecords,
    totalPages,
    sortColumn,
    sortDirection,
    handleSort,
    feeConfig,
    showFeeModal,
    setShowFeeModal,
    netIncome,
    estGatewayFee,
    totalExpenses,
    specificExpenses,
    allocatedExpenses,
    isCalculatingNet,
    handleSaveFees,
    rabProject,
    rabProjects,
    selectedProject,
    rabLoading,
    handleProjectSelect,
    mitraSales,
    payouts,
    setPayouts,
    fetchData,
    handleExport,
  } = useIncomePeriodData();

  const roi = useRoiTracking({
    rabProject,
    feeConfig,
    groupsLength: groups.length,
  });

  const { syncingMitra, handleSyncCommission } = useMitraCommission({
    startDate,
    setPayouts,
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HiOutlineCurrencyDollar className="w-7 h-7 text-blue-500" />
            Laporan Pendapatan (MixRadius)
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Data pendapatan per periode dari server MixRadius
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setShowFeeModal(true)}>
            <HiOutlineCog className="w-5 h-5" />
            Config Fee
          </Button>
          <Button variant="secondary" onClick={handleExport}>
            <HiOutlineArrowDown className="w-5 h-5" />
            Export CSV
          </Button>
          <Button onClick={() => fetchData()} disabled={loading}>
            <HiOutlineArrowPath
              className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
            />
            {loading ? "Memuat..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <IncomePeriodFilters
        startDate={startDate}
        endDate={endDate}
        serviceType={serviceType}
        paymentMethod={paymentMethod}
        selectedGroup={selectedGroup}
        selectedProject={selectedProject}
        search={search}
        groups={groups}
        rabProjects={rabProjects}
        onStartDateChange={(v) => {
          setStartDate(v);
          setPage(0);
        }}
        onEndDateChange={(v) => {
          setEndDate(v);
          setPage(0);
        }}
        onServiceTypeChange={(v) => {
          setServiceType(v);
          setPage(0);
        }}
        onPaymentMethodChange={(v) => {
          setPaymentMethod(v);
          setPage(0);
        }}
        onGroupChange={(v) => {
          setSelectedGroup(v);
          handleProjectSelect("");
          setPage(0);
        }}
        onProjectSelect={handleProjectSelect}
        onSearchChange={setSearch}
      />

      <NPLSummary groupId={selectedGroup} />

      {/* RAB Project & ROI Section */}
      {selectedGroup && selectedGroup !== "all" && (
        <RabProjectSection
          rabProject={rabProject}
          rabLoading={rabLoading}
          roiLoading={roi.roiLoading}
          totalExpenses={totalExpenses}
          totalRecords={totalRecords}
          summary={summary}
          cumulativeRevenue={roi.cumulativeRevenue}
          cumulativeExpenses={roi.cumulativeExpenses}
          cumulativeNetIncome={roi.cumulativeNetIncome}
          cumulativeGatewayFee={roi.cumulativeGatewayFee}
          projectMonthsElapsed={roi.projectMonthsElapsed}
          cumCapexFromRab={roi.cumCapexFromRab}
          cumCapexUmum={roi.cumCapexUmum}
          cumOpexAktual={roi.cumOpexAktual}
          cumOpexUmum={roi.cumOpexUmum}
          cumOpexProyeksi={roi.cumOpexProyeksi}
          cumDepreciation={roi.cumDepreciation}
        />
      )}

      {/* Summary Cards */}
      <SummaryCards
        summary={summary}
        loading={loading}
        isCalculatingNet={isCalculatingNet}
        netIncome={netIncome}
        estGatewayFee={estGatewayFee}
        totalExpenses={totalExpenses}
        specificExpenses={specificExpenses}
        allocatedExpenses={allocatedExpenses}
        totalRecords={totalRecords}
        onOpenFeeModal={() => setShowFeeModal(true)}
      />

      {/* Mitra Sales Table */}
      {mitraSales.length > 0 && (
        <MitraSalesTable
          mitraSales={mitraSales}
          globalRecords={globalRecords}
          payouts={payouts}
          startDate={startDate}
          endDate={endDate}
          syncingMitra={syncingMitra}
          isCalculatingNet={isCalculatingNet}
          onSyncCommission={handleSyncCommission}
        />
      )}

      {/* Fee Configuration Modal */}
      <FeeConfigurationModal
        isOpen={showFeeModal}
        onClose={() => setShowFeeModal(false)}
        currentFees={feeConfig}
        onSave={handleSaveFees}
        availableMethods={Array.from(
          new Set(data.map((d) => d.payment_method || d.method)),
        ).filter(Boolean)}
      />

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-400">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <ResponsiveTable
          data={data}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          columns={[
            {
              key: "invoice",
              header: "Invoice",
              priority: "primary",
              sortable: true,
              render: (item) => (
                <span className="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">
                  {item.invoice}
                </span>
              ),
            },
            {
              key: "member_id",
              header: "ID Pelanggan",
              priority: "secondary",
              sortable: true,
              render: (item) => {
                const isMember = item.method === "MEMBER";
                let displayId = "n/a";
                if (item.member_id === "0") displayId = "n/a";
                else if (isMember) displayId = item.member_id;
                else displayId = item.username;

                return (
                  <span
                    className={`text-sm ${isMember ? "font-mono font-bold" : ""} text-gray-900 dark:text-white`}
                  >
                    {displayId}
                  </span>
                );
              },
            },
            {
              key: "fullname",
              header: "Nama",
              priority: "primary",
              sortable: true,
              render: (item) => (
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {item.fullname}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {item.username}
                  </span>
                </div>
              ),
            },
            {
              key: "nasporttype",
              header: "Tipe Service",
              priority: "secondary",
              sortable: true,
              render: (item) => {
                const isPrepaid = item.payment_type === "PREPAID";
                const typeLabel = isPrepaid ? "PRE" : "POST";
                const typeClass = isPrepaid
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";

                let serviceName = "HOTSPOT";
                if (item.nasporttype === "Ethernet") serviceName = "PPPOE";
                else if (item.nasporttype === "Virtual")
                  serviceName = "PPTP/L2TP";
                else if (item.nasporttype === "Async")
                  serviceName = "OVPN/SSTP";

                return (
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${typeClass}`}
                    >
                      {typeLabel}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {serviceName}
                    </span>
                  </div>
                );
              },
            },
            {
              key: "plan_name",
              header: "Paket Langganan",
              priority: "secondary",
              sortable: true,
            },
            {
              key: "total",
              header: "Harga [ +PPN ]",
              priority: "primary",
              sortable: true,
              render: (item) => (
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(item.total)}
                </span>
              ),
            },
            {
              key: "seller_fee",
              header: "Fee Seller",
              priority: "tertiary",
              sortable: true,
              render: (item) => (
                <span className="text-gray-500 dark:text-gray-400">
                  {parseInt(String(item.seller_fee)) > 0
                    ? formatCurrency(item.seller_fee)
                    : "-"}
                </span>
              ),
            },
            {
              key: "renewed_on",
              header: "Tanggal Aktif",
              priority: "secondary",
              sortable: true,
              render: (item) => (
                <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                  <HiOutlineCalendar className="w-4 h-4" />
                  {formatDate(item.renewed_on)}
                </div>
              ),
            },
            {
              key: "payment_method",
              header: "Metode Bayar",
              priority: "secondary",
              sortable: true,
              render: (item) => {
                const method = item.payment_method || item.method || "-";
                const isOnline = isOnlinePaymentMethod(
                  method,
                  item.payment_type,
                );

                return (
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      isOnline
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {method}
                  </span>
                );
              },
            },
            {
              key: "owner_name",
              header: "Owner Data",
              priority: "tertiary",
              sortable: true,
              render: (item) => (
                <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                  <HiOutlineUser className="w-4 h-4" />
                  {item.owner_name}
                </div>
              ),
            },
          ]}
          keyField="id"
          loading={loading}
          emptyMessage={
            <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
              <HiOutlineMagnifyingGlass className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
              <p>Tidak ada data laporan ditemukan</p>
            </div>
          }
        />

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Tampilkan
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value));
                setPage(0);
              }}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              data
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
            >
              <HiOutlineChevronLeft className="w-5 h-5" />
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {page + 1} / {totalPages || 1}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
            >
              <HiOutlineChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
