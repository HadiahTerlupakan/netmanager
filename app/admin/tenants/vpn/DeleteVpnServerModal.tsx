"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { clientLogger } from "@/lib/client-logger";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import {
  readErrorBody,
  type BlockingRouter,
  type VpnServerItem,
} from "./vpnShared";

const HTTP_CONFLICT = 409;
const STALE_ROUTERS_MESSAGE =
  "Server masih tercatat di router yang belum menerima daftar baru. Coba hapus lagi setelah beberapa menit.";

interface DetachResult {
  detached: number;
  onlyServer: BlockingRouter[];
}

/** Konfirmasi hapus server VPN; bila ditolak 409, menampilkan router yang harus dipindah. */
export default function DeleteVpnServerModal({
  server,
  onClose,
  onDeleted,
}: {
  server: VpnServerItem;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [blockingRouters, setBlockingRouters] = useState<BlockingRouter[]>([]);
  const [pendingCore, setPendingCore] = useState(false);
  const [confirmDetach, setConfirmDetach] = useState(false);
  const [detachResult, setDetachResult] = useState<DetachResult | null>(null);

  const handleDetach = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/vpn-servers/${server.id}/routers`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(
          (await readErrorBody(res)).error ||
            "Gagal mengeluarkan server dari router",
        );
        return;
      }
      const body = (await res.json()) as { data: DetachResult };
      setDetachResult(body.data);
      setBlockingRouters([]);
      setConfirmDetach(false);
    } catch (error) {
      clientLogger.error("Error mengeluarkan server VPN dari router:", error);
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/vpn-servers/${server.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Server VPN dihapus");
        onDeleted();
        return;
      }
      const body = await readErrorBody(res);
      if (res.status === HTTP_CONFLICT) {
        const routers = body.details?.routers ?? [];
        setBlockingRouters(routers);
        setPendingCore(routers.length === 0);
        setDetachResult(null);
      }
      toast.error(body.error || "Gagal menghapus server VPN");
    } catch (error) {
      clientLogger.error("Error menghapus server VPN:", error);
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Hapus Server VPN?" size="md">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Server <strong>{server.name}</strong> akan dihapus. Tindakan ini tidak
        dapat dibatalkan.
      </p>
      {blockingRouters.length > 0 ? (
        <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-300">
          <p className="font-medium">
            Pindahkan router berikut ke server lain terlebih dahulu:
          </p>
          <ul className="mt-2 list-disc pl-5">
            {blockingRouters.map((router) => (
              <li key={router.id}>
                {router.name} ({router.tenantName})
              </li>
            ))}
          </ul>
          {confirmDetach ? (
            <div className="mt-3 flex items-center gap-2">
              <span>Server dikeluarkan dari semua router di atas?</span>
              <button
                onClick={handleDetach}
                disabled={isDeleting}
                className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Ya, Keluarkan
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDetach(true)}
              disabled={isDeleting}
              className="mt-3 px-3 py-1 border border-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40"
            >
              Keluarkan dari semua router
            </button>
          )}
        </div>
      ) : null}
      {pendingCore ? (
        <p className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-300">
          {STALE_ROUTERS_MESSAGE}
        </p>
      ) : null}
      {detachResult ? (
        <div className="mt-4 rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-sm text-gray-800 dark:text-gray-200">
          <p>Dikeluarkan dari {detachResult.detached} router.</p>
          {detachResult.onlyServer.length > 0 ? (
            <>
              <p className="mt-2 font-medium">
                Router berikut hanya memakai server ini; tambahkan server lain
                dulu:
              </p>
              <ul className="mt-2 list-disc pl-5">
                {detachResult.onlyServer.map((router) => (
                  <li key={router.id}>
                    {router.name} ({router.tenantName})
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
      <ModalFooter>
        <button
          onClick={onClose}
          disabled={isDeleting}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Batal
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {isDeleting ? "Menghapus..." : "Ya, Hapus"}
        </button>
      </ModalFooter>
    </Modal>
  );
}
