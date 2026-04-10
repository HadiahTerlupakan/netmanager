"use client";

import { useEffect, useState } from "react";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";
import {
  HiOutlineCube,
  HiOutlineArchiveBox,
  HiOutlineBuildingOffice2,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";

interface StatsData {
  totalBarang: number;
  totalStok: number;
  totalGudang: number;
  lowStock: number;
}

interface BarangItem {
  id: string;
  totalStock?: number;
  stockPerGudang?: Array<{
    gudangId: string;
    stok: number;
  }>;
}

export function StatsCards() {
  const [stats, setStats] = useState<StatsData>({
    totalBarang: 0,
    totalStok: 0,
    totalGudang: 0,
    lowStock: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/inventory/barang?limit=1");
      const data = await response.json();
      // Standardized apiSuccess: { success: true, data: { barangs, pagination } }
      const result = data.data || data;
      const totalBarang = result.pagination?.total || 0;
      const totalStok = result.barangs?.reduce(
        (sum: number, item: BarangItem) => sum + (item.totalStock || 0),
        0,
      );

      // Get gudang count
      const gudangResponse = await fetch("/api/inventory/gudang");
      const gudangData = await gudangResponse.json();
      const gudangResult = gudangData.data || gudangData;
      const totalGudang = gudangResult.gudangs?.length || 0;

      // Get low stock items (stok < 5)
      const lowStockResponse = await fetch("/api/inventory/barang?limit=100");
      const lowStockData = await lowStockResponse.json();
      const lowStockResult = lowStockData.data || lowStockData;
      const lowStock =
        lowStockResult.barangs?.filter((item: BarangItem) => {
          const minStock = Math.min(
            ...(item.stockPerGudang?.map((s: { stok: number }) => s.stok) || [
              Infinity,
            ]),
          );
          return minStock < 5;
        }).length || 0;

      setStats({
        totalBarang,
        totalStok,
        totalGudang,
        lowStock,
      });
    } catch (error) {
      console.error("Failed to fetch inventory stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useRealtimeScope({ kind: "admin", id: "inventory" });

  // Listen for inventory updates
  useRealtimeEvent("inventory.update", () => {
    console.log("[Inventory] Stats received update, refreshing...");
    fetchStats();
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const statsCards = [
    {
      title: "Total Barang",
      value: loading ? "..." : stats.totalBarang.toLocaleString("id-ID"),
      icon: <HiOutlineCube className="w-6 h-6" />,
      color: "bg-blue-100 dark:bg-blue-900",
      textColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Total Stok",
      value: loading ? "..." : stats.totalStok.toLocaleString("id-ID"),
      icon: <HiOutlineArchiveBox className="w-6 h-6" />,
      color: "bg-green-100 dark:bg-green-900",
      textColor: "text-green-600 dark:text-green-400",
    },
    {
      title: "Gudang",
      value: loading ? "..." : stats.totalGudang.toLocaleString("id-ID"),
      icon: <HiOutlineBuildingOffice2 className="w-6 h-6" />,
      color: "bg-purple-100 dark:bg-purple-900",
      textColor: "text-purple-600 dark:text-purple-400",
    },
    {
      title: "Stok Menipis",
      value: loading ? "..." : stats.lowStock.toLocaleString("id-ID"),
      icon: <HiOutlineExclamationTriangle className="w-6 h-6" />,
      color: "bg-red-100 dark:bg-red-900",
      textColor: "text-red-600 dark:text-red-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {statsCards.map((stat, index) => (
        <div key={index} className={`${stat.color} rounded-lg p-4`}>
          <div className="flex items-center">
            <div className={`${stat.textColor} p-3 rounded-full`}>
              {stat.icon}
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-200">
                {stat.title}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stat.value}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
