"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { useApi } from "@/lib/hooks/useApi";
import { Button } from "@/components/ui/Button";
import VpnScriptModal, {
  type VpnApiCheckState,
  type VpnScriptDraft,
} from "@/components/mikrotik/VpnScriptModal";
import { VpnServerList } from "@/app/admin/network/mikrotik/components/VpnServerList";
import {
  isVpnNotConfigured,
  VPN_NOT_CONFIGURED_MESSAGE,
} from "@/app/admin/tenants/vpn/vpnShared";
import {
  RouterVpnRequestError,
  sendRequest,
} from "@/app/admin/network/mikrotik/[id]/edit/routerVpnRequest";
import {
  isVpnDraftSpent,
  type VpnServerOption,
} from "@/app/admin/network/mikrotik/mikrotikFormShared";

const SERVERS_URL = "/api/vpn-servers";
const ONLINE_STATUS = "online";

type RouterVpnEnablePanelProps = {
  routerId: string;
  /** Dipanggil setelah router berhasil pindah ke VPN. */
  onMigrated: () => Promise<void> | void;
};

function onlineIds(servers: VpnServerOption[]): string[] {
  return servers.filter((s) => s.status === ONLINE_STATUS).map((s) => s.id);
}

/**
 * Panel router publik RouterOS v7: pilih server, tempel script, lalu pindahkan
 * router ke VPN setelah tunnel hidup dan API teruji lewat tunnel.
 */
export function RouterVpnEnablePanel({
  routerId,
  onMigrated,
}: RouterVpnEnablePanelProps) {
  const vpnUrl = `/api/mikrotik-routers/${routerId}/vpn`;
  const { data, error } = useApi<{ servers: VpnServerOption[] }>(SERVERS_URL);
  const [pickedIds, setPickedIds] = useState<string[] | null>(null);
  const [draft, setDraft] = useState<VpnScriptDraft | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [apiCheck, setApiCheck] = useState<VpnApiCheckState>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  if (error) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-400">
        {isVpnNotConfigured(error) ? VPN_NOT_CONFIGURED_MESSAGE : error.message}
      </p>
    );
  }
  if (!data) return null;

  const servers = data.servers;
  const selectedIds = pickedIds ?? onlineIds(servers);
  const isTunnelTested = apiCheck?.status === "passed";

  const testTunnel = async (draftId: string) => {
    setApiCheck({ status: "testing" });
    try {
      const json = await sendRequest(`${vpnUrl}/tunnel-test`, "POST", {
        draftId,
      });
      const { version } = json.data as { version: string };
      setApiCheck({
        status: "passed",
        message: `API tersambung lewat tunnel (RouterOS ${version})`,
      });
    } catch (err) {
      setApiCheck({
        status: "failed",
        message: err instanceof Error ? err.message : "Test API gagal",
      });
    }
  };

  const openModal = () => {
    setApiCheck(null);
    setIsModalOpen(true);
  };

  const migrate = async () => {
    if (!draft) return;
    setIsMigrating(true);
    try {
      const json = await sendRequest(`${vpnUrl}/migrate`, "POST", {
        draftId: draft.draftId,
        serverIds: selectedIds,
      });
      const result = json.data as { warning?: string };
      toast.success("Router dipindahkan ke VPN");
      if (result.warning) toast(result.warning, { icon: "⚠️" });
      setIsModalOpen(false);
      await onMigrated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal pindah ke VPN");
      if (err instanceof RouterVpnRequestError && isVpnDraftSpent(err.status)) {
        // Draft ini tidak boleh dipakai lagi; buka ulang membuat script baru.
        setDraft(null);
        setApiCheck(null);
        setIsModalOpen(false);
      }
    } finally {
      setIsMigrating(false);
    }
  };

  const migrateButton = (
    <Button
      type="button"
      disabled={!isTunnelTested || isMigrating}
      onClick={() => void migrate()}
    >
      Pindahkan ke VPN
    </Button>
  );

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        VPN
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Router ini masih memakai IP publik. Script VPN hanya menambah akses API
        dari server VPN ke user API yang sudah dipakai; tidak ada user baru.
      </p>
      {servers.length === 0 ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Belum ada server VPN untuk tenant ini
        </p>
      ) : (
        <VpnServerList
          servers={servers}
          selectedIds={selectedIds}
          onChange={setPickedIds}
        />
      )}
      <Button
        type="button"
        disabled={selectedIds.length === 0}
        onClick={openModal}
      >
        Aktifkan VPN
      </Button>
      {isModalOpen && (
        <VpnScriptModal<VpnScriptDraft>
          request={{
            serverIds: selectedIds,
            previousDraftId: draft?.draftId,
          }}
          draftUrl={`${vpnUrl}/enable`}
          apiCheck={apiCheck}
          onClose={() => setIsModalOpen(false)}
          onDraftReady={setDraft}
          onTunnelUp={() => draft && void testTunnel(draft.draftId)}
          footerAction={migrateButton}
        />
      )}
    </div>
  );
}
