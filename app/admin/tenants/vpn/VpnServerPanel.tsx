"use client";

import { useEffect, useState } from "react";
import { HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import { toast } from "react-hot-toast";
import { clientLogger } from "@/lib/client-logger";
import PageLoader from "@/components/ui/PageLoader";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { useApi } from "@/lib/hooks/useApi";
import AddVpnServerModal from "./AddVpnServerModal";
import DeleteVpnServerModal from "./DeleteVpnServerModal";
import VpnAdminPeerSection from "./VpnAdminPeerSection";
import VpnCommandBox from "./VpnCommandBox";
import VpnNotConfiguredCard from "./VpnNotConfiguredCard";
import VpnStatusBadge from "./VpnStatusBadge";
import { isVpnNotConfigured, type VpnServerItem } from "./vpnShared";

const SERVERS_URL = "/api/admin/vpn-servers";
const ACTION_CLASS =
  "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors";

interface CommandView {
  title: string;
  command: string;
}

/** Tab "Server VPN": daftar server, tambah/hapus, perintah instal & upgrade, perangkat admin. */
export default function VpnServerPanel() {
  const { data, error, isLoading, mutate } = useApi<
    VpnServerItem[] | { data?: VpnServerItem[] }
  >(SERVERS_URL);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<VpnServerItem | null>(null);
  const [commandView, setCommandView] = useState<CommandView | null>(null);
  const notConfigured = isVpnNotConfigured(error);

  useEffect(() => {
    if (error && !notConfigured) {
      clientLogger.error("Gagal memuat server VPN", error);
      toast.error(error.message || "Gagal memuat server VPN");
    }
  }, [error, notConfigured]);

  const servers: VpnServerItem[] = Array.isArray(data)
    ? data
    : (data?.data ?? []);

  const showCommand = async (
    server: VpnServerItem,
    request: { url: string; method?: string; title: string },
    pick: (body: Record<string, string>) => string,
  ) => {
    try {
      const res = await fetch(request.url, { method: request.method });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || `Gagal memuat perintah ${server.name}`);
        return;
      }
      setCommandView({
        title: request.title,
        command: pick(body.data ?? body),
      });
      await mutate();
    } catch (err) {
      clientLogger.error("Error memuat perintah server VPN:", err);
      toast.error("Terjadi kesalahan sistem");
    }
  };

  const columns: Column<VpnServerItem>[] = [
    {
      key: "name",
      header: "Nama",
      priority: "primary",
      render: (s) => (
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {s.name}
        </span>
      ),
    },
    {
      key: "publicHost",
      header: "Host:Port",
      priority: "secondary",
      render: (s) => (
        <code className="text-sm text-gray-600 dark:text-gray-400">
          {s.publicHost}:{s.listenPort}
        </code>
      ),
    },
    {
      key: "status",
      header: "Status",
      priority: "primary",
      render: (s) => <VpnStatusBadge status={s.status} />,
    },
    { key: "routerCount", header: "Router", priority: "secondary" },
    {
      key: "lastSeenAt",
      header: "Handshake terakhir",
      priority: "secondary",
      render: (s) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleString("id-ID") : "-"}
        </span>
      ),
    },
  ];

  const renderActions = (server: VpnServerItem) => (
    <>
      <button
        onClick={() =>
          showCommand(
            server,
            {
              url: `${SERVERS_URL}/${server.id}/upgrade-command`,
              title: `Perintah upgrade ${server.name}`,
            },
            (b) => b.command,
          )
        }
        className={`${ACTION_CLASS} bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/50`}
      >
        Perintah upgrade
      </button>
      {server.status === "pending_install" || server.status === "expired" ? (
        <button
          onClick={() =>
            showCommand(
              server,
              {
                url: `${SERVERS_URL}/${server.id}/reissue`,
                method: "POST",
                title: `Perintah instal ${server.name}`,
              },
              (b) => b.installCommand,
            )
          }
          className={`${ACTION_CLASS} bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50`}
        >
          Buat ulang perintah instal
        </button>
      ) : null}
      <button
        onClick={() => setDeleting(server)}
        className={`${ACTION_CLASS} bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50`}
      >
        <HiOutlineTrash className="w-4 h-4" />
        Hapus
      </button>
    </>
  );

  if (isLoading) {
    return <PageLoader variant="section" message="Memuat server VPN..." />;
  }
  if (notConfigured) return <VpnNotConfiguredCard />;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Server VPN
          </h2>
          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors shadow-sm"
          >
            <HiOutlinePlus className="w-5 h-5" />
            <span>Tambah Server VPN</span>
          </button>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <ResponsiveTable
            data={servers}
            columns={columns}
            keyField="id"
            renderActions={renderActions}
            emptyMessage="Belum ada server VPN"
          />
        </div>
      </div>

      <VpnAdminPeerSection />

      {isAddOpen ? (
        <AddVpnServerModal
          onClose={() => setIsAddOpen(false)}
          onChanged={() => void mutate()}
        />
      ) : null}
      {deleting ? (
        <DeleteVpnServerModal
          server={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            void mutate();
          }}
        />
      ) : null}
      <Modal
        isOpen={commandView !== null}
        onClose={() => setCommandView(null)}
        title={commandView?.title}
        size="lg"
      >
        {commandView ? <VpnCommandBox command={commandView.command} /> : null}
        <ModalFooter>
          <button
            onClick={() => setCommandView(null)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Tutup
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
