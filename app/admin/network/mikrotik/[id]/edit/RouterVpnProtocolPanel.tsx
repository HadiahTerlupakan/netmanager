"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { useApi } from "@/lib/hooks/useApi";
import { Button } from "@/components/ui/Button";
import VpnCommandBox from "@/app/admin/tenants/vpn/VpnCommandBox";
import { VpnProtocolPicker } from "@/app/admin/network/mikrotik/components/VpnProtocolPicker";
import { VPN_DRAFT_POLL_INTERVAL_MS } from "@/app/admin/network/mikrotik/hooks/useVpnDraftStatus";
import { sendRequest } from "@/app/admin/network/mikrotik/[id]/edit/routerVpnRequest";
import type { VpnProtocol } from "@/app/admin/network/mikrotik/mikrotikFormShared";

const PASTE_NOTE =
  "Tempel di router, lalu tekan Terapkan. Tunnel lama putus di akhir script; router offline sampai Terapkan ditekan.";

type RouterVpnStatus = {
  protocol: VpnProtocol;
  lastHandshakeAt: string | null;
};

type ProtocolScript = { protocol: VpnProtocol; text: string };

/** Handshake yang terjadi setelah `since` (epoch ms) berarti tunnel protokol baru hidup. */
function isHandshakeAfter(lastHandshakeAt: string | null, since: number) {
  return lastHandshakeAt !== null && Date.parse(lastHandshakeAt) > since;
}

/**
 * Ganti protokol VPN router: buat script protokol baru, tempel di router,
 * lalu Terapkan memindah core dan hub; panel menunggu handshake baru.
 */
export function RouterVpnProtocolPanel({ routerId }: { routerId: string }) {
  const vpnUrl = `/api/mikrotik-routers/${routerId}/vpn`;
  const [selected, setSelected] = useState<VpnProtocol | null>(null);
  const [script, setScript] = useState<ProtocolScript | null>(null);
  const [appliedAt, setAppliedAt] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const { data, refetch } = useApi<RouterVpnStatus>(vpnUrl, {
    refreshInterval: isPolling ? VPN_DRAFT_POLL_INTERVAL_MS : 0,
    onSuccess: (status) => {
      if (
        appliedAt !== null &&
        isHandshakeAfter(status.lastHandshakeAt, appliedAt)
      ) {
        setIsPolling(false);
      }
    },
  });

  if (!data) return null;

  const isConnected =
    appliedAt !== null && isHandshakeAfter(data.lastHandshakeAt, appliedAt);

  const isNewProtocol = selected !== null && selected !== data.protocol;
  const hasScript = isNewProtocol && script?.protocol === selected;

  const run = async (action: () => Promise<void>, failure: string) => {
    setIsBusy(true);
    try {
      await action();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failure);
    } finally {
      setIsBusy(false);
    }
  };

  const handleGenerate = () =>
    run(async () => {
      if (!selected) return;
      const json = await sendRequest(`${vpnUrl}/protocol-script`, "POST", {
        protocol: selected,
      });
      const { script: text } = json.data as { script: string };
      setScript({ protocol: selected, text });
    }, "Gagal membuat script");

  const handleApply = () =>
    run(async () => {
      if (!selected) return;
      const pressedAt = Date.now();
      await sendRequest(`${vpnUrl}/protocol`, "POST", { protocol: selected });
      setAppliedAt(pressedAt);
      setIsPolling(true);
      setSelected(null);
      setScript(null);
      await refetch();
    }, "Gagal menerapkan protokol");

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        Ganti protokol VPN
      </h2>
      <VpnProtocolPicker
        idPrefix="vpn-router-protocol"
        value={selected ?? data.protocol}
        disabledValue={data.protocol}
        onChange={(next) => {
          setSelected(next);
          setScript(null);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={isBusy || !isNewProtocol}
          onClick={() => void handleGenerate()}
        >
          Buat script
        </Button>
        <Button
          type="button"
          disabled={isBusy || !hasScript}
          onClick={() => void handleApply()}
        >
          Terapkan
        </Button>
      </div>
      {hasScript && (
        <div className="space-y-2">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {PASTE_NOTE}
          </p>
          <VpnCommandBox command={script.text} />
        </div>
      )}
      {appliedAt !== null && (
        <p
          className={`text-sm font-medium ${isConnected ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}
        >
          {isConnected ? "Tunnel tersambung" : "Menunggu tunnel tersambung..."}
        </p>
      )}
    </div>
  );
}
