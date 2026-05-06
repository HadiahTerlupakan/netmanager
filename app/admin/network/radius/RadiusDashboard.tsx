"use client";

import { HiOutlineRefresh } from "react-icons/hi";

import { SessionsTable } from "@/components/admin/radius/sessions-table";
import { SessionHistoryModal } from "@/components/admin/radius/session-history-modal";
import { StatsCards } from "@/components/admin/radius/stats-cards";
import { SyncControls } from "@/components/admin/radius/sync-controls";
import { InlineAlert } from "@/components/admin/radius/inline-alert";
import { useRadiusDashboardData } from "@/app/admin/network/radius/hooks/useRadiusDashboardData";

export default function RadiusDashboard() {
  const {
    stats,
    sessions,
    loading,
    refreshing,
    dashboardError,
    setDashboardError,
    isConnected,
    resettingUsername,
    viewingHistoryUsername,
    historyModalOpen,
    historyLoading,
    historyError,
    historyData,
    historyStartDate,
    historyEndDate,
    setHistoryStartDate,
    setHistoryEndDate,
    applyHistoryFilter,
    resetHistoryFilter,
    actionError,
    actionSuccess,
    setActionError,
    setActionSuccess,
    viewHistory,
    changeHistoryPage,
    closeHistoryModal,
    resetConnection,
    refresh,
  } = useRadiusDashboardData();

  const showStatsLoading = loading && !stats;

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            RADIUS Dashboard
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Monitor PPPoE sessions and user statistics
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => {
              void refresh();
            }}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <HiOutlineRefresh
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <SyncControls />
        </div>
      </div>

      {dashboardError && (
        <InlineAlert
          tone="error"
          message={dashboardError}
          onClose={() => setDashboardError(null)}
        />
      )}

      {stats && (
        <StatsCards
          totalUsers={stats.totalUsers}
          onlineUsers={stats.onlineUsers}
          offlineUsers={stats.offlineUsers}
          trafficToday={{
            downloadGB: stats.totalTrafficToday.downloadGB,
            uploadGB: stats.totalTrafficToday.uploadGB,
          }}
          loading={false}
        />
      )}

      {!stats && showStatsLoading && (
        <StatsCards
          totalUsers={0}
          onlineUsers={0}
          offlineUsers={0}
          trafficToday={{ downloadGB: 0, uploadGB: 0 }}
          loading
        />
      )}

      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Active Sessions
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {sessions.length} users currently online
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <div
                className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-600 animate-pulse" : "bg-red-500"}`}
              />
              <span>{isConnected ? "Live Updates" : "Offline"}</span>
            </div>
          </div>
        </div>
        <div className="space-y-3 p-6">
          {actionSuccess && (
            <InlineAlert
              tone="success"
              message={actionSuccess}
              onClose={() => setActionSuccess(null)}
            />
          )}
          {actionError && (
            <InlineAlert
              tone="error"
              message={actionError}
              onClose={() => setActionError(null)}
            />
          )}
          <SessionsTable
            sessions={sessions}
            loading={loading}
            onViewHistory={viewHistory}
            onResetConnection={resetConnection}
            resettingUsername={resettingUsername}
            viewingHistoryUsername={viewingHistoryUsername}
          />
        </div>
      </div>

      <SessionHistoryModal
        isOpen={historyModalOpen}
        onClose={closeHistoryModal}
        loading={historyLoading}
        error={historyError}
        data={historyData}
        historyStartDate={historyStartDate}
        historyEndDate={historyEndDate}
        onChangeStartDate={setHistoryStartDate}
        onChangeEndDate={setHistoryEndDate}
        onApplyFilter={applyHistoryFilter}
        onResetFilter={resetHistoryFilter}
        onPageChange={changeHistoryPage}
      />

      {stats?.lastSyncTime && (
        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          Last sync: {new Date(stats.lastSyncTime).toLocaleString("id-ID")}
          {stats.lastSyncStats &&
            stats.lastSyncStats.created +
              stats.lastSyncStats.updated +
              stats.lastSyncStats.deleted >
              0 && (
              <span className="ml-2">
                (Created: {stats.lastSyncStats.created}, Updated:{" "}
                {stats.lastSyncStats.updated}, Deleted:{" "}
                {stats.lastSyncStats.deleted})
              </span>
            )}
        </div>
      )}
    </div>
  );
}
