"use client";

import { useState } from "react";
import {
  HiOutlineRefresh,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
} from "react-icons/hi";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface SyncResultStats {
  created: number;
  updated: number;
  deleted: number;
}

interface SyncControlsProps {
  onSynced?: (stats: SyncResultStats) => void;
  onError?: (message: string) => void;
}

interface SyncResponse {
  success: boolean;
  data?: { stats?: SyncResultStats };
  error?: string;
}

const ZERO_STATS: SyncResultStats = { created: 0, updated: 0, deleted: 0 };

async function postRadiusSync(): Promise<SyncResultStats> {
  const response = await fetch("/api/admin/radius/sync", { method: "POST" });
  const payload: SyncResponse | null = await response
    .json()
    .catch((): null => null);

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || "Sync failed");
  }

  return payload.data?.stats ?? ZERO_STATS;
}

export function SyncControls({ onSynced, onError }: SyncControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    try {
      const stats = await postRadiusSync();
      setIsOpen(false);
      onSynced?.(stats);
    } catch (error) {
      onError?.(
        error instanceof Error ? error.message : "Terjadi kesalahan saat sync",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
      >
        <HiOutlineRefresh className="h-4 w-4" />
        Sync All Users
      </Button>

      {isOpen && (
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Sync All Users to RADIUS"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This will synchronize all active customers from the database to
              RADIUS. Inactive customers will be removed from RADIUS.
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <HiOutlineCheckCircle className="h-5 w-5 text-green-600" />
                <span>Active customers will be synced</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <HiOutlineExclamationCircle className="h-5 w-5 text-orange-600" />
                <span>Inactive customers will be removed</span>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
              <Button
                onClick={() => setIsOpen(false)}
                disabled={loading}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button onClick={handleSync} disabled={loading}>
                {loading ? (
                  <>
                    <HiOutlineRefresh className="h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <HiOutlineRefresh className="h-4 w-4" />
                    Start Sync
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
