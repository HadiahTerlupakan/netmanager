"use client";

import { useState, useEffect, useReducer } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import ResponsiveTable, { type Column } from "@/components/ui/ResponsiveTable";
import PageLoader from "@/components/ui/PageLoader";

interface PreRegItem {
  id: string;
  serialNumber: string;
  oltId: string | null;
  pelangganId: string | null;
  bandwidthProfile: string | null;
  vlanId: number | null;
  status: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800",
  COMPLETED:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800",
  EXPIRED:
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700",
  CANCELLED:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800",
};

export default function PreRegisterClient() {
  const [items, setItems] = useState<PreRegItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [serialNumber, setSerialNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, refresh] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/olt/onu/pre-register")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.success) setItems(json.data.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!serialNumber.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/olt/onu/pre-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serialNumber: serialNumber.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Gagal pre-register");
        return;
      }
      setSerialNumber("");
      setLoading(true);
      refresh();
    } catch {
      setError("Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<PreRegItem>[] = [
    {
      key: "serialNumber",
      header: "Serial Number",
      priority: "primary",
      render: (item) => (
        <span className="font-mono text-xs text-gray-900 dark:text-white">
          {item.serialNumber}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      priority: "primary",
      render: (item) => (
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
        >
          {item.status}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Tanggal",
      priority: "secondary",
      render: (item) => (
        <span className="text-gray-600 dark:text-gray-400 text-xs">
          {new Date(item.createdAt).toLocaleString("id-ID")}
        </span>
      ),
    },
  ];

  if (loading && items.length === 0) {
    return (
      <PageLoader variant="section" message="Memuat pre-registration..." />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Pre-Register ONU
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Daftarkan serial number ONU sebelum pemasangan di lapangan
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Tambah Pre-Registration</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-3 items-end"
          >
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Serial Number ONU
              </label>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="Masukkan SN ONU yang akan dipasang..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <Button
              type="submit"
              variant="default"
              loading={submitting}
              disabled={!serialNumber.trim()}
            >
              Pre-Register
            </Button>
          </form>

          {error && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800 text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <ResponsiveTable
          data={items}
          columns={columns}
          keyField="id"
          loading={loading}
          emptyMessage="Belum ada pre-registration"
        />
      </div>
    </div>
  );
}
