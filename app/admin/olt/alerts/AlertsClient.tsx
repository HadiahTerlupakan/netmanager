"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import ResponsiveTable, { type Column } from "@/components/ui/ResponsiveTable";
import { Button } from "@/components/ui/Button";
import PageLoader from "@/components/ui/PageLoader";

interface OltAlertItem {
  id: string;
  type: string;
  message: string;
  severity: string;
  isRead: boolean;
  createdAt: string;
  olt?: { name: string };
  onu?: { serialNumber: string };
}

export default function AlertsClient() {
  const [alerts, setAlerts] = useState<OltAlertItem[]>([]);
  const [loading, startTransition] = useTransition();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchAlerts = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (unreadOnly) params.set("unreadOnly", "true");
    const res = await fetch(`/api/olt/alerts?${params}`);
    const json = await res.json();
    if (json.success) {
      setAlerts(json.data.data);
      setTotalPages(json.data.pagination.totalPages);
    }
  }, [page, unreadOnly]);

  useEffect(() => {
    startTransition(async () => {
      await fetchAlerts();
    });
  }, [fetchAlerts]);

  const columns: Column<OltAlertItem>[] = [
    {
      key: "severity",
      header: "Severity",
      priority: "primary",
      render: (item) => {
        const colors: Record<string, string> = {
          CRITICAL:
            "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
          WARNING:
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
          INFO: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
        };
        return (
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[item.severity] ?? ""}`}
          >
            {item.severity}
          </span>
        );
      },
    },
    {
      key: "type",
      header: "Type",
      priority: "primary",
      render: (item) => <span className="font-mono text-xs">{item.type}</span>,
    },
    {
      key: "message",
      header: "Message",
      priority: "primary",
      render: (item) => (
        <span
          className={`text-sm ${item.isRead ? "text-gray-500 dark:text-gray-400" : "text-gray-900 dark:text-white font-medium"}`}
        >
          {item.message}
        </span>
      ),
    },
    {
      key: "olt",
      header: "OLT",
      priority: "secondary",
      render: (item) => (
        <span className="text-xs">{item.olt?.name ?? "-"}</span>
      ),
    },
    {
      key: "onu",
      header: "ONU",
      priority: "secondary",
      render: (item) => (
        <span className="font-mono text-xs">
          {item.onu?.serialNumber ?? "-"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Waktu",
      priority: "primary",
      render: (item) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(item.createdAt).toLocaleString("id-ID")}
        </span>
      ),
    },
  ];

  if (loading && alerts.length === 0) {
    return <PageLoader message="Memuat alerts..." variant="section" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            OLT Alerts
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Notifikasi LOS, low power, dan status kritis ONU
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => {
                setUnreadOnly(e.target.checked);
                setPage(1);
              }}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Unread only
          </label>
          <Button variant="secondary" size="sm" onClick={() => fetchAlerts()}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <ResponsiveTable
          data={alerts}
          columns={columns}
          keyField="id"
          loading={loading}
          emptyMessage="Tidak ada alert"
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
