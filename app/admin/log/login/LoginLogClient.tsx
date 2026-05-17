"use client";

import { clientLogger } from "@/lib/client-logger";
import { useState, useMemo } from "react";
import { HiOutlineRefresh } from "react-icons/hi";
import {
  HiOutlineClock,
  HiOutlineShieldCheck,
  HiOutlineUser,
  HiOutlineEye,
} from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import PageLoader from "@/components/ui/PageLoader";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { useApi } from "@/lib/hooks/useApi";

interface SystemLog {
  id: string;
  action: string;
  details: Record<string, unknown> | string | null;
  createdAt: string;
  user: {
    name: string | null;
    email: string;
  } | null;
  ipAddress: string | null;
  userAgent: string | null;
}

interface LogDetails {
  email?: string;
  name?: string;
  role?: string;
  portal?: string;
  provider?: string;
  isNewUser?: boolean;
  loginTime?: string;
  [key: string]: string | boolean | undefined;
}

type Pagination = {
  page: number;
  limit: number;
  totalPages: number;
  total: number;
};

type LogsPayload =
  | { logs?: SystemLog[]; pagination?: Pagination }
  | SystemLog[];

const DEFAULT_PAGINATION: Pagination = {
  page: 1,
  limit: 20,
  totalPages: 1,
  total: 0,
};

export function ClientComponent() {
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
  const [showModal, setShowModal] = useState(false);

  const logsUrl = `/api/admin/system-logs?type=AUTH&page=${page}&limit=20`;

  const {
    data: rawLogs,
    isLoading: loading,
    mutate: refetchLogs,
  } = useApi<LogsPayload>(logsUrl, {
    onError: (err) => {
      clientLogger.error("Gagal memuat log login", err);
    },
  });

  const logs: SystemLog[] = useMemo(() => {
    if (Array.isArray(rawLogs)) return rawLogs;
    return rawLogs?.logs ?? [];
  }, [rawLogs]);

  const pagination: Pagination = useMemo(() => {
    if (Array.isArray(rawLogs)) return DEFAULT_PAGINATION;
    return rawLogs?.pagination ?? DEFAULT_PAGINATION;
  }, [rawLogs]);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= pagination.totalPages) {
      setPage(newPage);
    }
  };

  const openDetail = (log: SystemLog) => {
    setSelectedLog(log);
    setShowModal(true);
  };

  const parseDetails = (
    details: Record<string, unknown> | string | null,
  ): LogDetails => {
    if (!details) return {};
    if (typeof details === "object") {
      return details as LogDetails;
    }
    try {
      return JSON.parse(details) as LogDetails;
    } catch {
      return {};
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Log Login
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Riwayat aktivitas login pengguna ke sistem
          </p>
        </div>
        <Button variant="outline" onClick={() => void refetchLogs()}>
          <HiOutlineRefresh
            className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading && logs.length === 0 ? (
          <PageLoader variant="section" message="Memuat log login..." />
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <HiOutlineShieldCheck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Belum ada data log login.</p>
          </div>
        ) : (
          <>
            <ResponsiveTable
              data={logs}
              loading={loading}
              keyField="id"
              columns={[
                {
                  key: "createdAt",
                  header: "Waktu",
                  priority: "primary",
                  render: (item) => (
                    <div className="flex items-center gap-2">
                      <HiOutlineClock className="w-4 h-4 text-gray-400" />
                      {format(
                        new Date(item.createdAt),
                        "dd MMM yyyy HH:mm:ss",
                        { locale: id },
                      )}
                    </div>
                  ),
                },
                {
                  key: "user",
                  header: "Pengguna",
                  priority: "primary",
                  render: (item) => (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                        <HiOutlineUser className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.user?.name || "-"}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {item.user?.email || "-"}
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  key: "action",
                  header: "Aksi",
                  priority: "primary",
                  render: (item) => (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      {item.action}
                    </span>
                  ),
                },
                {
                  key: "detail",
                  header: "Detail",
                  priority: "secondary",
                  render: (item) => (
                    <Button size="sm" onClick={() => openDetail(item)}>
                      <HiOutlineEye className="w-4 h-4" />
                      Lihat Detail
                    </Button>
                  ),
                },
              ]}
              emptyMessage="Belum ada data log login."
            />

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Hal {pagination.page} dari {pagination.totalPages} (
                  {pagination.total} Log)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sebelumnya
                  </Button>
                  <Button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Selanjutnya
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={showModal && !!selectedLog}
        onClose={() => setShowModal(false)}
        title="Detail Log Login"
        size="lg"
      >
        <div className="space-y-4">
          {selectedLog &&
            (() => {
              const details = parseDetails(selectedLog.details);
              return (
                <>
                  {/* User Info */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-3">
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Informasi Pengguna
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Nama
                        </p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {details.name || selectedLog.user?.name || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Email
                        </p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {details.email || selectedLog.user?.email || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Role
                        </p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                          {details.role || "-"}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Portal
                        </p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                          {details.portal || "-"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Login Info */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-3">
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Informasi Login
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Provider
                        </p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                          {details.provider || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Status
                        </p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                          {selectedLog.action}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          User Baru
                        </p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {details.isNewUser ? "Ya" : "Tidak"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Waktu Login
                        </p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {details.loginTime
                            ? format(new Date(details.loginTime), "HH:mm:ss", {
                                locale: id,
                              })
                            : "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Technical Info */}
                  {(selectedLog.ipAddress || selectedLog.userAgent) && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-3">
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Informasi Teknis
                      </h4>
                      {selectedLog.ipAddress && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            IP Address
                          </p>
                          <p className="text-sm font-mono text-gray-900 dark:text-white">
                            {selectedLog.ipAddress}
                          </p>
                        </div>
                      )}
                      {selectedLog.userAgent && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            User Agent
                          </p>
                          <p className="text-sm font-mono text-gray-900 dark:text-white break-all">
                            {selectedLog.userAgent}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
        </div>

        {/* Footer */}
        <ModalFooter>
          <Button
            onClick={() => setShowModal(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Tutup
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
