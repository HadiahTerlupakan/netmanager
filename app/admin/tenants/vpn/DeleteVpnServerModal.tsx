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
        setBlockingRouters(body.details?.routers ?? []);
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
