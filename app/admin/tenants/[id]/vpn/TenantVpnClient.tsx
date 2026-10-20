"use client";

import { clientLogger } from "@/lib/client-logger";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  HiOutlineArrowLeft,
  HiOutlineCheck,
  HiOutlineServerStack,
} from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { toast } from "react-hot-toast";
import { useApi } from "@/lib/hooks/useApi";
import VpnNotConfiguredCard from "../../vpn/VpnNotConfiguredCard";
import VpnStatusBadge from "../../vpn/VpnStatusBadge";
import {
  isVpnNotConfigured,
  readErrorBody,
  type BlockingRouter,
  type VpnServerItem,
} from "../../vpn/vpnShared";

/** Halaman superadmin: server VPN mana saja yang boleh dipakai tenant ini. */
export default function TenantVpnClient({ tenantId }: { tenantId: string }) {
  const tenantUrl = `/api/admin/tenants/${tenantId}/vpn-servers`;
  const serversQuery = useApi<VpnServerItem[] | { data?: VpnServerItem[] }>(
    "/api/admin/vpn-servers",
  );
  const assignedQuery = useApi<{ serverIds: string[] }>(tenantUrl);
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>(
    {},
  );
  const [blockingRouters, setBlockingRouters] = useState<BlockingRouter[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const assignedError = assignedQuery.error;
  const serversError = serversQuery.error;
  const notConfigured = isVpnNotConfigured(serversError);
  useEffect(() => {
    if (serversError && !notConfigured) {
      clientLogger.error("Gagal memuat server VPN", serversError);
      toast.error(serversError.message || "Gagal memuat server VPN");
    }
  }, [serversError, notConfigured]);
  useEffect(() => {
    if (assignedError) {
      clientLogger.error("Gagal memuat server VPN tenant", assignedError);
    }
  }, [assignedError]);

  const servers: VpnServerItem[] = Array.isArray(serversQuery.data)
    ? serversQuery.data
    : (serversQuery.data?.data ?? []);
  const assignedIds = assignedQuery.data?.serverIds ?? [];
  const hasChanges = Object.keys(pendingChanges).length > 0;

  const isChecked = (id: string): boolean =>
    id in pendingChanges ? pendingChanges[id]! : assignedIds.includes(id);

  const handleToggle = (id: string) => {
    setPendingChanges((prev) => {
      const next = { ...prev };
      const wanted = !isChecked(id);
      if (assignedIds.includes(id) === wanted) delete next[id];
      else next[id] = wanted;
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setBlockingRouters([]);
    try {
      const res = await fetch(tenantUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverIds: servers.filter((s) => isChecked(s.id)).map((s) => s.id),
        }),
      });
      if (res.ok) {
        toast.success("Server VPN tenant diperbarui");
        setPendingChanges({});
        await assignedQuery.mutate();
        return;
      }
      const body = await readErrorBody(res);
      setBlockingRouters(body.details?.routers ?? []);
      toast.error(body.error || "Gagal menyimpan perubahan");
    } catch (err) {
      clientLogger.error("Error menyimpan server VPN tenant:", err);
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsSaving(false);
    }
  };

  if (serversQuery.isLoading || assignedQuery.isLoading) {
    return <PageLoader variant="section" message="Memuat server VPN..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/tenants"
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-2"
          >
            <HiOutlineArrowLeft className="w-4 h-4" />
            Kembali ke daftar tenant
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HiOutlineServerStack className="w-6 h-6" />
            Server VPN Tenant
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Pilih server VPN yang boleh dipakai router milik tenant ini.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving || !!assignedError}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <HiOutlineCheck className="w-5 h-5" />
          {isSaving
            ? "Menyimpan..."
            : hasChanges
              ? `Simpan (${Object.keys(pendingChanges).length})`
              : "Tidak ada perubahan"}
        </button>
      </div>

      {blockingRouters.length > 0 ? (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-300">
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

      {assignedError ? (
        <div
          role="alert"
          className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-300"
        >
          Gagal memuat server VPN tenant ini. Muat ulang halaman sebelum
          mengubah pilihan.
        </div>
      ) : notConfigured ? (
        <VpnNotConfiguredCard />
      ) : (
        <ul className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {servers.length === 0 ? (
            <li className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
              Belum ada server VPN
            </li>
          ) : null}
          {servers.map((server) => (
            <li key={server.id} className="px-6 py-4 flex items-center gap-4">
              <input
                type="checkbox"
                id={`vpn-${server.id}`}
                checked={isChecked(server.id)}
                onChange={() => handleToggle(server.id)}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor={`vpn-${server.id}`} className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-gray-900 dark:text-white">
                  {server.name}
                </span>
                <code className="text-xs text-gray-500 dark:text-gray-400">
                  {server.publicHost}:{server.listenPort}
                </code>
              </label>
              <VpnStatusBadge status={server.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
