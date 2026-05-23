"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface TrafficStats {
  rxBytes: number;
  txBytes: number;
  rxUnicastPkts: number;
  txUnicastPkts: number;
  rxNonUnicastPkts: number;
  txNonUnicastPkts: number;
  timestamp: string;
}

interface TrafficSnapshot {
  stats: TrafficStats | null;
  rxRate: number;
  txRate: number;
}

const POLL_INTERVAL_MS = 3000;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx++;
  }
  return `${value.toFixed(2)} ${units[unitIdx]}`;
}

function formatRate(bytesPerSec: number): string {
  const bitsPerSec = bytesPerSec * 8;
  if (bitsPerSec < 1000) return `${bitsPerSec.toFixed(0)} bps`;
  if (bitsPerSec < 1_000_000) return `${(bitsPerSec / 1000).toFixed(2)} Kbps`;
  if (bitsPerSec < 1_000_000_000)
    return `${(bitsPerSec / 1_000_000).toFixed(2)} Mbps`;
  return `${(bitsPerSec / 1_000_000_000).toFixed(2)} Gbps`;
}

function formatPkts(pkts: number): string {
  if (pkts < 1000) return pkts.toString();
  if (pkts < 1_000_000) return `${(pkts / 1000).toFixed(2)}K`;
  if (pkts < 1_000_000_000) return `${(pkts / 1_000_000).toFixed(2)}M`;
  return `${(pkts / 1_000_000_000).toFixed(2)}G`;
}

export default function TrafficCounterCard({ onuId }: { onuId: string }) {
  const [snapshot, setSnapshot] = useState<TrafficSnapshot>({
    stats: null,
    rxRate: 0,
    txRate: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const previousRef = useRef<TrafficStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/olt/onu/${onuId}/traffic`);
        const json = await res.json();
        if (cancelled) return;

        if (
          !json.success ||
          !json.data ||
          json.data.rxBytes === undefined ||
          json.data.rxBytes === null
        ) {
          setError(json.data?.error ?? "Gagal membaca traffic");
          previousRef.current = null;
          setSnapshot({ stats: null, rxRate: 0, txRate: 0 });
        } else {
          const current: TrafficStats = json.data;
          const prev = previousRef.current;
          let rxRate = 0;
          let txRate = 0;
          if (prev) {
            const dt =
              (new Date(current.timestamp).getTime() -
                new Date(prev.timestamp).getTime()) /
              1000;
            if (dt > 0) {
              rxRate = Math.max(0, (current.rxBytes - prev.rxBytes) / dt);
              txRate = Math.max(0, (current.txBytes - prev.txBytes) / dt);
            }
          }
          previousRef.current = current;
          setSnapshot({ stats: current, rxRate, txRate });
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Gagal menghubungi server");
      } finally {
        if (!cancelled) setLoading(false);
      }

      if (!cancelled) {
        timer = setTimeout(fetchStats, POLL_INTERVAL_MS);
      }
    };

    fetchStats();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [onuId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Traffic Realtime</span>
          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
            Update tiap 3 detik
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs">
            {error}
          </div>
        )}

        {loading && !snapshot.stats ? (
          <p className="text-gray-500 text-sm">Memuat traffic counter...</p>
        ) : !snapshot.stats ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Tidak ada data traffic
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                <div className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">
                  RX (Download)
                </div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100 font-mono">
                  {formatRate(snapshot.rxRate)}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Total: {formatBytes(snapshot.stats.rxBytes)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
                <div className="text-xs text-green-700 dark:text-green-300 font-medium mb-1">
                  TX (Upload)
                </div>
                <div className="text-2xl font-bold text-green-900 dark:text-green-100 font-mono">
                  {formatRate(snapshot.txRate)}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Total: {formatBytes(snapshot.stats.txBytes)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-gray-500 dark:text-gray-400 mb-1">
                  RX Packets
                </div>
                <div className="font-mono text-gray-700 dark:text-gray-300">
                  Unicast: {formatPkts(snapshot.stats.rxUnicastPkts)}
                </div>
                <div className="font-mono text-gray-700 dark:text-gray-300">
                  Non-Unicast: {formatPkts(snapshot.stats.rxNonUnicastPkts)}
                </div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400 mb-1">
                  TX Packets
                </div>
                <div className="font-mono text-gray-700 dark:text-gray-300">
                  Unicast: {formatPkts(snapshot.stats.txUnicastPkts)}
                </div>
                <div className="font-mono text-gray-700 dark:text-gray-300">
                  Non-Unicast: {formatPkts(snapshot.stats.txNonUnicastPkts)}
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500 italic">
              Last update:{" "}
              {new Date(snapshot.stats.timestamp).toLocaleTimeString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
