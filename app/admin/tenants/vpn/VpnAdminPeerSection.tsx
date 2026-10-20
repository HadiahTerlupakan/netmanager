"use client";

import { useEffect, useState } from "react";
import { HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import { toast } from "react-hot-toast";
import { clientLogger } from "@/lib/client-logger";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { useApi } from "@/lib/hooks/useApi";
import {
  copyToClipboard,
  readErrorBody,
  type VpnAdminPeerItem,
} from "./vpnShared";

const PEERS_URL = "/api/admin/vpn-admin-peers";

const COLUMNS: Column<VpnAdminPeerItem>[] = [
  { key: "label", header: "Label", priority: "primary" },
  { key: "address", header: "Alamat VPN", priority: "secondary" },
];

/** Bagian "Perangkat admin": daftar peer WireGuard admin, tambah (menampilkan config), hapus. */
export default function VpnAdminPeerSection() {
  const { data, error, mutate } = useApi<
    VpnAdminPeerItem[] | { data?: VpnAdminPeerItem[] }
  >(PEERS_URL);
  const [label, setLabel] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<{
    id: string;
    text: string;
    downloadUrl: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<VpnAdminPeerItem | null>(null);

  useEffect(() => {
    const downloadUrl = config?.downloadUrl;
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [config]);

  useEffect(() => {
    if (error) {
      clientLogger.error("Gagal memuat perangkat admin VPN", error);
      toast.error(error.message || "Gagal memuat perangkat admin");
    }
  }, [error]);

  const peers: VpnAdminPeerItem[] = Array.isArray(data)
    ? data
    : (data?.data ?? []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch(PEERS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || "Gagal menambah perangkat admin");
        return;
      }
      const peer: VpnAdminPeerItem = body.data ?? body;
      const configRes = await fetch(`${PEERS_URL}/${peer.id}/config`);
      if (configRes.ok) {
        const text = await configRes.text();
        setConfig({
          id: peer.id,
          text,
          downloadUrl: URL.createObjectURL(
            new Blob([text], { type: "text/plain" }),
          ),
        });
      } else {
        toast.error("Perangkat dibuat, tetapi konfigurasi gagal dimuat");
      }
      setLabel("");
      await mutate();
    } catch (err) {
      clientLogger.error("Error menambah perangkat admin VPN:", err);
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      const res = await fetch(`${PEERS_URL}/${deleting.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error((await readErrorBody(res)).error || "Gagal menghapus");
        return;
      }
      toast.success("Perangkat admin dihapus");
      if (config?.id === deleting.id) setConfig(null);
      setDeleting(null);
      await mutate();
    } catch (err) {
      clientLogger.error("Error menghapus perangkat admin VPN:", err);
      toast.error("Terjadi kesalahan sistem");
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        Perangkat admin
      </h2>
      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          aria-label="Label perangkat"
          placeholder="Label perangkat, mis. Laptop Budi"
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          <HiOutlinePlus className="w-5 h-5" />
          {isSaving ? "Menyimpan..." : "Tambah Perangkat"}
        </button>
      </form>

      {config ? (
        <div className="space-y-2 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Konfigurasi wg-quick ini memuat kunci privat dan hanya tampil sekali
            di sini. Simpan sekarang.
          </p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-gray-900 p-3 text-xs text-green-300">
            {config.text}
          </pre>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                copyToClipboard(config.text, "Konfigurasi disalin")
              }
              className="px-3 py-1.5 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 transition-colors"
            >
              Salin
            </button>
            <a
              href={config.downloadUrl}
              download={`netmanager-admin-${config.id}.conf`}
              className="px-3 py-1.5 text-sm bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 rounded-md hover:bg-sky-100 transition-colors"
            >
              Unduh
            </a>
          </div>
        </div>
      ) : null}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <ResponsiveTable
          data={peers}
          columns={COLUMNS}
          keyField="id"
          emptyMessage="Belum ada perangkat admin"
          renderActions={(peer) => (
            <button
              onClick={() => setDeleting(peer)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md hover:bg-red-100 transition-colors"
            >
              <HiOutlineTrash className="w-4 h-4" />
              Hapus
            </button>
          )}
        />
      </div>

      <Modal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Hapus perangkat admin?"
        size="md"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Perangkat <strong>{deleting?.label}</strong> tidak akan bisa lagi
          tersambung ke VPN.
        </p>
        <ModalFooter>
          <button
            onClick={() => setDeleting(null)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Ya, Hapus
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
