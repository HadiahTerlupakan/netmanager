"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { FiEye, FiSearch } from "react-icons/fi";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { formatCurrency } from "@/lib/utils"; // Assuming utility exists
import { clientLogger } from "@/lib/client-logger";

interface Asset {
  id: string;
  kodeAsset: string;
  status: string;
  purchaseDate: string;
  purchasePrice: string | number;
  currentValue: string | number;
  location?: string;
  barang: {
    nama: string;
    kode: string;
    satuan: string;
  };
}

export function AssetTable() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter) params.append("status", statusFilter);

      const res = await fetch(`/api/inventory/assets?${params}`);
      const data = await res.json();

      setAssets(data.assets || []);
    } catch (err: unknown) {
      clientLogger.error("Failed to fetch assets", err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const columns: Column<Asset>[] = [
    {
      key: "kodeAsset",
      header: "Kode Aset",
      priority: "primary",
      render: (item) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-900 dark:text-white">
            {item.kodeAsset}
          </span>
        </div>
      ),
    },
    {
      key: "barang",
      header: "Nama Barang",
      priority: "primary",
      render: (item) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{item.barang.nama}</span>
          <span className="text-xs text-gray-500">{item.barang.kode}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      priority: "secondary",
      render: (item) => (
        <span
          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
            item.status === "ACTIVE"
              ? "bg-green-100 text-green-800"
              : item.status === "INSTALLED"
                ? "bg-blue-100 text-blue-800"
                : item.status === "SOLD"
                  ? "bg-gray-100 text-gray-800"
                  : item.status === "DISPOSED"
                    ? "bg-red-100 text-red-800"
                    : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {item.status}
        </span>
      ),
    },
    {
      key: "currentValue",
      header: "Nilai Buku",
      priority: "primary",
      align: "right",
      render: (item) => (
        <div className="text-sm font-medium">
          {formatCurrency(Number(item.currentValue))}
          <div className="text-xs text-gray-400">
            Beli: {formatCurrency(Number(item.purchasePrice))}
          </div>
        </div>
      ),
    },
  ];

  const renderActions = (item: Asset) => (
    <div className="flex gap-2">
      <Link
        href={`/admin/inventory/assets/${item.id}`}
        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
      >
        <FiEye />
      </Link>
      {/* Add Edit/Delete permissions check later */}
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex gap-4">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Cari aset..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border rounded-lg px-4 py-2 dark:bg-gray-800 dark:border-gray-700"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Semua Status</option>
          <option value="ACTIVE">Active (Gudang)</option>
          <option value="INSTALLED">Installed (Terpasang)</option>
          <option value="SOLD">Sold</option>
          <option value="DISPOSED">Disposed</option>
          <option value="LOST">Lost</option>
          <option value="REPAIR">Repair</option>
        </select>
      </div>

      <ResponsiveTable
        data={assets}
        columns={columns}
        loading={loading}
        keyField="id"
        renderActions={renderActions}
        emptyMessage="Belum ada data aset"
      />
    </div>
  );
}
