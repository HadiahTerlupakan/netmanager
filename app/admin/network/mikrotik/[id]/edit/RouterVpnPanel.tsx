"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { useApi } from "@/lib/hooks/useApi";
import { Button } from "@/components/ui/Button";
import { VpnServerList } from "@/app/admin/network/mikrotik/components/VpnServerList";
import { VpnLockdownGuide } from "@/app/admin/network/mikrotik/[id]/edit/VpnLockdownGuide";
import type { VpnServerOption } from "@/app/admin/network/mikrotik/mikrotikFormShared";

/** Jumlah riwayat perpindahan server yang ditampilkan, terbaru lebih dulu. */
const MAX_EVENTS_SHOWN = 10;
const SERVERS_URL = "/api/vpn-servers";
const STALE_WARNING =
  "Daftar server belum terkirim ke router. Akan dicoba lagi saat router online.";
const SAVED_MESSAGE = "Daftar server tersimpan";
const UNAVAILABLE_SERVER_STATUS = "tidak tersedia";

type RouterServer = { id: string; name: string; priority: number };
type SwitchEvent = { fromHubId: string | null; toHubId: string; at: string };

type RouterVpnDetail = {
  servers: RouterServer[];
  activeServerId: string | null;
  isOnBackup: boolean;
  lastHandshakeAt: string | null;
  events: SwitchEvent[];
  scriptStale: boolean;
};

type ApiBody = { error?: string; message?: string; data?: unknown };

/** Mengirim request JSON dan mengembalikan body-nya; melempar bila gagal. */
async function sendRequest(
  url: string,
  method: string,
  body?: unknown,
): Promise<ApiBody> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as ApiBody;
  if (!res.ok) throw new Error(json.error || json.message || "Gagal");
  return json;
}

/** Server tenant ditambah server router yang sudah tidak ada di daftar tenant. */
function buildOptions(
  tenantServers: VpnServerOption[],
  routerServers: RouterServer[],
): VpnServerOption[] {
  const missing = routerServers
    .filter((s) => !tenantServers.some((t) => t.id === s.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      publicHost: "-",
      status: UNAVAILABLE_SERVER_STATUS,
    }));
  return [...tenantServers, ...missing];
}

/** Panel VPN halaman edit: daftar server berurut, server aktif, riwayat, dan panduan. */
export function RouterVpnPanel({ routerId }: { routerId: string }) {
  const vpnUrl = `/api/mikrotik-routers/${routerId}/vpn`;
  const { data, error, refetch } = useApi<RouterVpnDetail>(vpnUrl);
  const { data: tenantData } = useApi<{ servers: VpnServerOption[] }>(
    SERVERS_URL,
  );
  const [draftIds, setDraftIds] = useState<string[] | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>
    );
  }
  if (!data) return null;

  const savedIds = data.servers.map((s) => s.id);
  const selectedIds = draftIds ?? savedIds;
  const options = buildOptions(tenantData?.servers ?? [], data.servers);
  const nameOf = (id: string | null) =>
    options.find((o) => o.id === id)?.name ?? id ?? "-";

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

  const handleSave = () =>
    run(async () => {
      const json = await sendRequest(vpnUrl, "PUT", { serverIds: selectedIds });
      const result = json.data as { scriptStale?: boolean } | undefined;
      if (result?.scriptStale) toast(STALE_WARNING, { icon: "⚠️" });
      else toast.success(SAVED_MESSAGE);
      setDraftIds(null);
      await refetch();
    }, "Gagal menyimpan daftar server");

  const handleReturn = () =>
    run(async () => {
      await sendRequest(`${vpnUrl}/first-server`, "POST");
      toast.success("Router diarahkan kembali ke server pertama");
      await refetch();
    }, "Gagal mengembalikan ke server pertama");

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          VPN
        </h2>
        {data.isOnBackup && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
            Berjalan di server cadangan
          </span>
        )}
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        Server aktif: {nameOf(data.activeServerId)}
      </p>
      {data.scriptStale && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {STALE_WARNING}
        </p>
      )}
      <VpnServerList
        servers={options}
        selectedIds={selectedIds}
        onChange={setDraftIds}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={isBusy || draftIds === null}
          onClick={() => void handleSave()}
        >
          Simpan Daftar Server
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={isBusy || !data.isOnBackup}
          onClick={() => void handleReturn()}
        >
          Kembalikan ke server pertama
        </Button>
      </div>
      {data.events.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Riwayat perpindahan
          </h3>
          <ul className="mt-1 space-y-1 text-xs text-gray-600 dark:text-gray-400">
            {[...data.events]
              .sort((a, b) => b.at.localeCompare(a.at))
              .slice(0, MAX_EVENTS_SHOWN)
              .map((event) => (
                <li key={`${event.at}-${event.toHubId}`}>
                  {new Date(event.at).toLocaleString("id-ID")}:{" "}
                  {nameOf(event.fromHubId)} → {nameOf(event.toHubId)}
                </li>
              ))}
          </ul>
        </div>
      )}
      <VpnLockdownGuide />
    </div>
  );
}
