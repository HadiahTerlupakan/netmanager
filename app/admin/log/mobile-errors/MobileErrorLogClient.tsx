"use client";

import { clientLogger } from "@/lib/client-logger";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";

import { Button } from "@/components/ui/Button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";

type SystemLogItem = {
  id: string;
  type: string;
  action: string;
  subject: string;
  details: string | null;
  userId?: string | null;
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
};

type MobileErrorDetails = {
  message?: string | null;
  kind?: string | null;
  source?: string | null;
  severity?: string | null;
  route?: string | null;
  screen?: string | null;
  appVersion?: string | null;
  platform?: string | null;
  occurredAt?: string | null;
  stack?: string | null;
  breadcrumbs?: unknown[];
  context?: Record<string, unknown>;
  authContext?: Record<string, unknown> | null;
};

type ApiResponse = {
  success: boolean;
  data: {
    logs: SystemLogItem[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
};

const parseDetails = (details: string | null): MobileErrorDetails => {
  if (!details) {
    return {};
  }

  try {
    const parsed = JSON.parse(details) as MobileErrorDetails;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const severityStyles: Record<string, string> = {
  error: "bg-red-100 text-red-700",
  warning: "bg-yellow-100 text-yellow-700",
  info: "bg-blue-100 text-blue-700",
};

export default function MobileErrorLogClient() {
  const [logs, setLogs] = useState<SystemLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<SystemLogItem | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const fetchLogs = useCallback(
    async (targetPage = 1, isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({
          type: "SYSTEM",
          action: "MOBILE_ERROR_REPORT",
          page: String(targetPage),
          limit: "20",
        });

        if (debouncedSearch.trim()) {
          params.set("search", debouncedSearch.trim());
        }

        const response = await fetch(
          `/api/admin/system-logs?${params.toString()}`,
        );
        const json = (await response.json()) as ApiResponse;

        if (!response.ok || !json.success) {
          throw new Error("Gagal memuat mobile error reports");
        }

        setLogs(json.data.logs);
        setPagination(json.data.pagination);
      } catch (error) {
        clientLogger.error("Failed to fetch mobile error logs:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [debouncedSearch],
  );

  useEffect(() => {
    fetchLogs(page);
  }, [fetchLogs, page]);

  const rows = useMemo(() => {
    return logs.map((log) => {
      const details = parseDetails(log.details);
      return {
        ...log,
        parsedDetails: details,
      };
    });
  }, [logs]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mobile Error Reports</h1>
          <p className="text-sm text-muted-foreground">
            Lihat error report dari aplikasi mobile yang dikirim ke backend.
          </p>
        </div>

        <div className="flex w-full gap-2 md:w-auto">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari message, route, screen, user, atau source..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm md:w-96"
          />
          <Button onClick={() => fetchLogs(page, true)} loading={refreshing}>
            Refresh
          </Button>
        </div>
      </div>

      <ResponsiveTable
        data={rows}
        keyField="id"
        loading={loading}
        emptyMessage="Belum ada mobile error report"
        onRowClick={(item) => setSelectedLog(item)}
        columns={[
          {
            key: "message",
            header: "Message",
            priority: "primary",
            render: (item) => (
              <div className="space-y-1">
                <p className="font-medium">
                  {item.parsedDetails.message || item.subject}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.parsedDetails.screen || "-"} •{" "}
                  {item.parsedDetails.route || "-"}
                </p>
              </div>
            ),
          },
          {
            key: "severity",
            header: "Severity",
            priority: "secondary",
            render: (item) => {
              const severity = item.parsedDetails.severity || "error";
              return (
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${severityStyles[severity] || severityStyles.error}`}
                >
                  {severity}
                </span>
              );
            },
          },
          {
            key: "source",
            header: "Source",
            priority: "secondary",
            render: (item) => item.parsedDetails.source || "-",
          },
          {
            key: "user",
            header: "User",
            priority: "tertiary",
            render: (item) => item.user?.email || item.user?.name || "-",
          },
          {
            key: "version",
            header: "Versi",
            priority: "tertiary",
            render: (item) => item.parsedDetails.appVersion || "-",
          },
          {
            key: "createdAt",
            header: "Waktu",
            priority: "secondary",
            render: (item) =>
              format(new Date(item.createdAt), "dd/MM/yyyy HH:mm:ss"),
          },
        ]}
      />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Total: {pagination.total}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Sebelumnya
          </Button>
          <span>
            Halaman {pagination.page} / {Math.max(pagination.totalPages, 1)}
          </span>
          <Button
            variant="outline"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Berikutnya
          </Button>
        </div>
      </div>

      <Modal
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="Detail Mobile Error Report"
        description="Ringkasan payload error yang dikirim aplikasi mobile"
        size="2xl"
      >
        {selectedLog &&
          (() => {
            const details = parseDetails(selectedLog.details);

            return (
              <>
                <ModalBody>
                  <div className="space-y-4 text-sm">
                    <div>
                      <h4 className="font-semibold">Message</h4>
                      <p className="mt-1 text-muted-foreground">
                        {details.message || "-"}
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="font-semibold">Screen</h4>
                        <p className="mt-1 text-muted-foreground">
                          {details.screen || "-"}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold">Route</h4>
                        <p className="mt-1 text-muted-foreground">
                          {details.route || "-"}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold">Source</h4>
                        <p className="mt-1 text-muted-foreground">
                          {details.source || "-"}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold">Severity</h4>
                        <p className="mt-1 text-muted-foreground">
                          {details.severity || "-"}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold">App Version</h4>
                        <p className="mt-1 text-muted-foreground">
                          {details.appVersion || "-"}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold">Platform</h4>
                        <p className="mt-1 text-muted-foreground">
                          {details.platform || "-"}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold">Stack</h4>
                      <pre className="mt-1 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
                        {details.stack || "-"}
                      </pre>
                    </div>

                    <div>
                      <h4 className="font-semibold">Breadcrumbs</h4>
                      <pre className="mt-1 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
                        {JSON.stringify(details.breadcrumbs || [], null, 2)}
                      </pre>
                    </div>

                    <div>
                      <h4 className="font-semibold">Context</h4>
                      <pre className="mt-1 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
                        {JSON.stringify(details.context || {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedLog(null)}
                  >
                    Tutup
                  </Button>
                </ModalFooter>
              </>
            );
          })()}
      </Modal>
    </div>
  );
}
