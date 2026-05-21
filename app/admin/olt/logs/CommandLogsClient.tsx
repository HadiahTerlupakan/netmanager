"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import ResponsiveTable, { type Column } from "@/components/ui/ResponsiveTable";
import PageLoader from "@/components/ui/PageLoader";

interface CommandLog {
  id: string;
  oltId: string;
  onuId: string | null;
  command: string;
  params: Record<string, unknown>;
  result: string;
  errorMsg: string | null;
  executedBy: string;
  executedAt: string;
}

export default function CommandLogsClient() {
  const [logs, setLogs] = useState<CommandLog[]>([]);
  const [loading, startTransition] = useTransition();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const fetchLogs = useCallback(async () => {
    const res = await fetch(`/api/olt/command-logs?page=${page}&limit=20`);
    const json = await res.json();
    if (json.success) {
      setLogs(json.data.data);
      setTotalPages(json.data.pagination.totalPages);
    }
  }, [page]);

  useEffect(() => {
    startTransition(async () => {
      await fetchLogs();
    });
  }, [fetchLogs]);

  const columns: Column<CommandLog>[] = [
    {
      key: "command",
      header: "Command",
      priority: "primary",
      render: (item) => (
        <span className="font-mono text-xs font-medium text-gray-900 dark:text-white">
          {item.command}
        </span>
      ),
    },
    {
      key: "result",
      header: "Result",
      priority: "primary",
      render: (item) => {
        const colors: Record<string, string> = {
          SUCCESS:
            "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
          FAILED:
            "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
          TIMEOUT:
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
          PENDING:
            "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
        };
        return (
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[item.result] ?? ""}`}
          >
            {item.result}
          </span>
        );
      },
    },
    {
      key: "errorMsg",
      header: "Error",
      priority: "secondary",
      render: (item) => (
        <span className="text-xs text-red-600 dark:text-red-400">
          {item.errorMsg ?? "-"}
        </span>
      ),
    },
    {
      key: "executedBy",
      header: "User",
      priority: "secondary",
      render: (item) => <span className="text-xs">{item.executedBy}</span>,
    },
    {
      key: "executedAt",
      header: "Waktu",
      priority: "primary",
      render: (item) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(item.executedAt).toLocaleString("id-ID")}
        </span>
      ),
    },
  ];

  if (loading && logs.length === 0) {
    return <PageLoader message="Memuat command logs..." variant="section" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Command Logs
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Audit trail semua operasi provisioning OLT
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <ResponsiveTable
          data={logs}
          columns={columns}
          keyField="id"
          loading={loading}
          emptyMessage="Belum ada command log"
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
