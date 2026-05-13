"use client";

import { useCallback, useState } from "react";
import { HiOutlineTrash, HiOutlineExclamationTriangle } from "react-icons/hi2";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface OrphanUsersResponse {
  success: boolean;
  data?: { orphans: string[]; total: number };
  error?: string;
}

interface DeleteOrphansResponse {
  success: boolean;
  data?: { deleted: number };
  error?: string;
}

interface OrphanCleanupPanelProps {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export function OrphanCleanupPanel({
  onSuccess,
  onError,
}: OrphanCleanupPanelProps) {
  const [orphans, setOrphans] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchOrphans = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/radius/orphans");
      const payload: OrphanUsersResponse | null = await response
        .json()
        .catch((): null => null);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Gagal memuat orphan users");
      }

      const list = payload.data?.orphans ?? [];
      setOrphans(list);
      setSelected(new Set(list));
      setFetched(true);

      if (list.length === 0) {
        onSuccess?.("Tidak ada user orphan ditemukan");
      } else {
        setModalOpen(true);
      }
    } catch (error) {
      onError?.(
        error instanceof Error ? error.message : "Gagal memuat orphan users",
      );
    } finally {
      setLoading(false);
    }
  }, [onSuccess, onError]);

  const handleDelete = useCallback(async () => {
    if (selected.size === 0) return;

    setDeleting(true);
    try {
      const response = await fetch("/api/admin/radius/orphans", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: Array.from(selected) }),
      });

      const payload: DeleteOrphansResponse | null = await response
        .json()
        .catch((): null => null);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Gagal menghapus orphan users");
      }

      const deleted = payload.data?.deleted ?? 0;
      setModalOpen(false);
      setOrphans([]);
      setSelected(new Set());
      setFetched(false);
      onSuccess?.(`${deleted} user orphan berhasil dihapus dari RADIUS`);
    } catch (error) {
      onError?.(
        error instanceof Error ? error.message : "Gagal menghapus orphan users",
      );
    } finally {
      setDeleting(false);
    }
  }, [selected, onSuccess, onError]);

  const toggleSelect = (username: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(username)) {
        next.delete(username);
      } else {
        next.add(username);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === orphans.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(orphans));
    }
  };

  return (
    <>
      <Button
        onClick={() => {
          void fetchOrphans();
        }}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-gray-700"
      >
        <HiOutlineTrash className="h-4 w-4" />
        {loading ? "Scanning..." : "Cleanup Orphans"}
      </Button>

      {modalOpen && fetched && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Orphan RADIUS Users"
          description="User yang terdaftar di RADIUS tapi tidak punya pelanggan terkait"
          size="2xl"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <HiOutlineExclamationTriangle className="h-4 w-4 shrink-0" />
              <span>
                Ditemukan {orphans.length} user orphan. Pilih yang ingin
                dihapus.
              </span>
            </div>

            <div className="flex items-center gap-2 border-b border-gray-200 pb-2 dark:border-gray-700">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={selected.size === orphans.length}
                  onChange={toggleAll}
                  className="rounded border-gray-300"
                />
                Pilih semua ({selected.size}/{orphans.length})
              </label>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700">
              {orphans.map((username) => (
                <label
                  key={username}
                  className="flex items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(username)}
                    onChange={() => toggleSelect(username)}
                    className="rounded border-gray-300"
                  />
                  <span className="font-mono text-gray-800 dark:text-gray-200">
                    {username}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
              <Button
                onClick={() => setModalOpen(false)}
                disabled={deleting}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Batal
              </Button>
              <Button
                onClick={() => {
                  void handleDelete();
                }}
                disabled={deleting || selected.size === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                <HiOutlineTrash className="h-4 w-4" />
                {deleting ? "Menghapus..." : `Hapus ${selected.size} User`}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
