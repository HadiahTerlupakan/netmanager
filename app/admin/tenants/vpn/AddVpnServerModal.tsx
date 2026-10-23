"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { clientLogger } from "@/lib/client-logger";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import VpnCommandBox from "./VpnCommandBox";
import {
  VpnServerInstallSteps,
  VpnServerRequirements,
} from "./VpnServerInstallGuide";
import {
  VPN_COMMAND_VALIDITY_MS,
  VPN_DEFAULT_LISTEN_PORT,
  VPN_POLL_INTERVAL_MS,
  type VpnServerItem,
} from "./vpnShared";

const SERVERS_URL = "/api/admin/vpn-servers";
const INPUT_CLASS =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white";

interface CreatedServer {
  id: string;
  installCommand: string;
}

/**
 * Polling status server yang baru dibuat sampai `online`, modal ditutup
 * (unmount), atau perintah instal kedaluwarsa. Mengembalikan true bila online.
 */
function useServerOnline(serverId: string | null, onOnline: () => void) {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!serverId) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(SERVERS_URL);
        if (!res.ok) return;
        const body = await res.json();
        const servers: VpnServerItem[] = body.data ?? body;
        if (servers.find((s) => s.id === serverId)?.status !== "online") return;
        clearInterval(timer);
        clearTimeout(expiry);
        setIsOnline(true);
        onOnline();
      } catch (error) {
        clientLogger.error("Gagal memeriksa status server VPN", error);
      }
    }, VPN_POLL_INTERVAL_MS);
    const expiry = setTimeout(
      () => clearInterval(timer),
      VPN_COMMAND_VALIDITY_MS,
    );
    return () => {
      clearInterval(timer);
      clearTimeout(expiry);
    };
    // onOnline hanya memicu mutate daftar; tidak perlu mengulang polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId]);

  return isOnline;
}

/** Modal tambah server VPN: formulir, perintah instal, lalu pantau sambungan. */
export default function AddVpnServerModal({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [publicHost, setPublicHost] = useState("");
  const [listenPort, setListenPort] = useState(VPN_DEFAULT_LISTEN_PORT);
  const [isSaving, setIsSaving] = useState(false);
  const [created, setCreated] = useState<CreatedServer | null>(null);
  const isOnline = useServerOnline(created?.id ?? null, onChanged);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch(SERVERS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          publicHost,
          listenPort: Number(listenPort),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || "Gagal menambah server VPN");
        return;
      }
      const result = body.data ?? body;
      setCreated({
        id: result.server.id,
        installCommand: result.installCommand,
      });
      onChanged();
    } catch (error) {
      clientLogger.error("Error membuat server VPN:", error);
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Tambah Server VPN" size="lg">
      {created ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Jalankan sebagai root di VPS. Perintah berlaku 1 jam.
          </p>
          <VpnServerInstallSteps listenPort={Number(listenPort)} />
          <VpnCommandBox command={created.installCommand} />
          <p
            className={`text-sm font-medium ${isOnline ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}
          >
            {isOnline ? "Server tersambung" : "Menunggu server tersambung..."}
          </p>
          <ModalFooter>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Tutup
            </button>
          </ModalFooter>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <VpnServerRequirements listenPort={listenPort} />
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Nama server
            <input
              type="text"
              required
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${INPUT_CLASS} mt-1`}
              placeholder="Contoh: VPS Jakarta"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            IP / hostname publik
            <input
              type="text"
              required
              name="publicHost"
              value={publicHost}
              onChange={(e) => setPublicHost(e.target.value)}
              className={`${INPUT_CLASS} mt-1`}
              placeholder="vpn.contoh.com"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Port
            <input
              type="number"
              required
              name="listenPort"
              value={listenPort}
              onChange={(e) => setListenPort(e.target.value)}
              className={`${INPUT_CLASS} mt-1`}
            />
          </label>
          <ModalFooter className="mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50"
            >
              {isSaving ? "Menyimpan..." : "Buat Server"}
            </button>
          </ModalFooter>
        </form>
      )}
    </Modal>
  );
}
