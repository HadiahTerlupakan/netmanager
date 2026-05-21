"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import PageLoader from "@/components/ui/PageLoader";

interface OltSummary {
  id: string;
  name: string;
  vendor: string;
  totalOnu: number;
  onlineOnu: number;
  offlineOnu: number;
  losOnu: number;
}

export default function MonitoringDashboardClient() {
  const [olts, setOlts] = useState<OltSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/olt/devices?limit=100");
        const json = await res.json();
        if (json.success) {
          setOlts(
            json.data.data.map((olt: Record<string, unknown>) => ({
              id: olt.id,
              name: olt.name,
              vendor: olt.vendor,
              totalOnu: 0,
              onlineOnu: 0,
              offlineOnu: 0,
              losOnu: 0,
            })),
          );
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return <PageLoader message="Memuat monitoring data..." variant="section" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          ONU Monitoring
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Monitoring optical power dan status ONU secara real-time
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total OLT
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {olts.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ONU Online
            </p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
              {olts.reduce((sum, o) => sum + o.onlineOnu, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ONU Offline
            </p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
              {olts.reduce((sum, o) => sum + o.offlineOnu, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">ONU LOS</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
              {olts.reduce((sum, o) => sum + o.losOnu, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Status per OLT
          </h3>
        </CardHeader>
        <CardContent>
          {olts.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              Belum ada OLT terdaftar
            </p>
          ) : (
            <div className="divide-y dark:divide-gray-700">
              {olts.map((olt) => (
                <div
                  key={olt.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {olt.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {olt.vendor}
                    </p>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-600 dark:text-green-400">
                      {olt.onlineOnu} online
                    </span>
                    <span className="text-red-600 dark:text-red-400">
                      {olt.offlineOnu} offline
                    </span>
                    <span className="text-orange-600 dark:text-orange-400">
                      {olt.losOnu} LOS
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Data monitoring di-update setiap 15 menit via cron job. Optical power
        history tersedia di halaman detail ONU.
      </p>
    </div>
  );
}
