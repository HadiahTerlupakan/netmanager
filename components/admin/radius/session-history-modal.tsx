'use client';

import { Modal } from '@/components/ui/Modal';

interface SessionHistorySummary {
  totalSessions: number;
  activeSessions: number;
  totalSessionTime: string;
  totalSessionHours: number;
  totalInputOctets: string;
  totalOutputOctets: string;
  totalOctets: string;
  totalInputMB: number;
  totalOutputMB: number;
  totalMB: number;
  totalInputGB: number;
  totalOutputGB: number;
  totalGB: number;
}

interface SessionHistoryItem {
  radAcctId: string;
  username: string | null;
  nasIpAddress: string;
  framedIpAddress: string | null;
  acctStartTime: string | null;
  acctStopTime: string | null;
  acctSessionTime: string;
  acctSessionHours: number;
  acctInputOctets: string;
  acctOutputOctets: string;
  totalOctets: string;
  uploadMB: number;
  downloadMB: number;
  totalMB: number;
  uploadGB: number;
  downloadGB: number;
  totalGB: number;
  isOnline: boolean;
}

interface SessionHistoryData {
  username: string;
  summary: SessionHistorySummary;
  sessions: SessionHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  period?: {
    startDate?: string | null;
    endDate?: string | null;
  };
}

interface SessionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  data: SessionHistoryData | null;
  historyStartDate: string;
  historyEndDate: string;
  onChangeStartDate: (value: string) => void;
  onChangeEndDate: (value: string) => void;
  onApplyFilter: () => Promise<void>;
  onResetFilter: () => Promise<void>;
  onPageChange: (page: number) => Promise<void>;
}

function formatUsageMB(valueMB: number): string {
  if (!Number.isFinite(valueMB) || valueMB <= 0) return '0 B';

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = valueMB;
  let unitIndex = 1;

  if (value < 1) {
    value *= 1024;
    unitIndex = 0;
  }

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('id-ID');
}

function formatDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0 jam';
  if (hours < 1) return `${Math.round(hours * 60)} menit`;
  return `${hours.toFixed(2)} jam`;
}

export function SessionHistoryModal({
  isOpen,
  onClose,
  loading,
  error,
  data,
  historyStartDate,
  historyEndDate,
  onChangeStartDate,
  onChangeEndDate,
  onApplyFilter,
  onResetFilter,
  onPageChange,
}: SessionHistoryModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={data ? `History: ${data.username}` : 'Session History'}
      description="Detail login/logout dan pemakaian bandwidth per sesi"
      size="4xl"
    >
      <div className="space-y-4">
        {loading && (
          <div className="rounded-md border border-gray-200 dark:border-gray-700 px-4 py-6 text-sm text-gray-600 dark:text-gray-300">
            Memuat histori sesi...
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Sessions</p>
                <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{data.summary.totalSessions}</p>
              </div>
              <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Download</p>
                <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{formatUsageMB(data.summary.totalOutputMB)}</p>
              </div>
              <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Upload</p>
                <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{formatUsageMB(data.summary.totalInputMB)}</p>
              </div>
              <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Usage</p>
                <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{formatUsageMB(data.summary.totalMB)}</p>
              </div>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400">
              Total durasi: {formatDuration(data.summary.totalSessionHours)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-1">
                <label htmlFor="history-start-date" className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                  Start Date
                </label>
                <input
                  id="history-start-date"
                  type="date"
                  value={historyStartDate}
                  onChange={(event) => onChangeStartDate(event.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
                />
              </div>
              <div className="md:col-span-1">
                <label htmlFor="history-end-date" className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                  End Date
                </label>
                <input
                  id="history-end-date"
                  type="date"
                  value={historyEndDate}
                  onChange={(event) => onChangeEndDate(event.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
                />
              </div>
              <div className="md:col-span-2 flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => { void onApplyFilter(); }}
                  disabled={loading}
                  className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => { void onResetFilter(); }}
                  disabled={loading}
                  className="rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Login</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Logout</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Durasi</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Download</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Upload</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                  {data.sessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        Belum ada histori sesi
                      </td>
                    </tr>
                  ) : (
                    data.sessions.map((item) => (
                      <tr key={item.radAcctId}>
                        <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{formatDate(item.acctStartTime)}</td>
                        <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{item.isOnline ? 'Online' : formatDate(item.acctStopTime)}</td>
                        <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{formatDuration(item.acctSessionHours)}</td>
                        <td className="px-3 py-2 text-sm text-right font-mono text-gray-700 dark:text-gray-300">{formatUsageMB(item.downloadMB)}</td>
                        <td className="px-3 py-2 text-sm text-right font-mono text-gray-700 dark:text-gray-300">{formatUsageMB(item.uploadMB)}</td>
                        <td className="px-3 py-2 text-sm text-right font-mono text-gray-700 dark:text-gray-300">{formatUsageMB(item.totalMB)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Page {data.pagination.page} / {data.pagination.totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { void onPageChange(data.pagination.page - 1); }}
                    disabled={data.pagination.page <= 1 || loading}
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => { void onPageChange(data.pagination.page + 1); }}
                    disabled={data.pagination.page >= data.pagination.totalPages || loading}
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
